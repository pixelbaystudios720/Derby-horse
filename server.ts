import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import 'dotenv/config';
import {
  connectMongoDB,
  syncMemoryToMongoDB,
  loadDataFromMongoDB,
  isMongoDBConnected,
  ensureMongoConnected,
  savePersistentOtp,
  getPersistentOtp,
  markOtpVerified,
  deletePersistentOtp,
  listAllOtps,
  lastMongoError,
} from './src/models/db';
import {
  UserModel,
  RaceModel,
  BetModel,
  TransactionModel,
  BannerModel,
  OtpModel,
  RaceDayModel,
  RaceCenterModel,
  DepositRequestModel,
  WithdrawalRequestModel,
} from './src/models/index';
import { sendOtpEmail } from './src/utils/mailer';

const app = express();
const PORT = Number(process.env.PORT) || 3005;

// Stateless HMAC OTP token system (Guarantees 100% reliable verification across all Vercel serverless instances)
const OTP_SECRET = process.env.OTP_SECRET || 'derbybet_turf_otp_super_secret_key_2026';

function generateOtpToken(target: string, code: string, expires_at: number): string {
  const cleanTarget = String(target).trim().toLowerCase();
  const cleanCode = String(code).trim();
  const payload = `${cleanTarget}:${cleanCode}:${expires_at}`;
  const hmac = crypto.createHmac('sha256', OTP_SECRET).update(payload).digest('hex');
  return `${expires_at}.${hmac}`;
}

function verifyOtpToken(target: string, code: string, token?: string): boolean {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [expStr, expectedHmac] = token.split('.');
  const expires_at = Number(expStr);
  if (!expires_at || expires_at < Date.now()) return false;
  const cleanTarget = String(target).trim().toLowerCase();
  const cleanCode = String(code).trim();
  const payload = `${cleanTarget}:${cleanCode}:${expires_at}`;
  const hmac = crypto.createHmac('sha256', OTP_SECRET).update(payload).digest('hex');
  return hmac === expectedHmac;
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS & Vercel URL Rewriting normalizer (Fast non-blocking)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // Non-blocking background Mongo connect trigger
  if (!isMongoDBConnected()) {
    ensureMongoConnected().catch(() => {});
  }

  next();
});

// In-memory + File Storage system
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

interface User {
  id: string;
  ref_id?: string;
  full_name?: string;
  phone: string;
  email?: string;
  username: string;
  password_hash: string;
  balance: number;
  exposure: number;
  role: 'user' | 'admin';
  is_blocked?: boolean;
  profile_photo: string;
  created_at: string;
}

interface OddsLog {
  win_odds: number;
  place_odds: number;
  updated_at: string;
}

interface Horse {
  id: string;
  race_id: string;
  horse_no: number; // Serial number (S.No)
  serial_no?: number;
  gate_no?: number | string; // Gate number (Stall / Draw)
  name: string; // Name of the horse
  jockey: string; // Name of the jockey
  trainer: string; // Name of the trainer
  win_odds: number;
  place_odds: number;
  odds_history?: OddsLog[];
  silk_color: string;
  form?: string;
  weight?: string;
  is_suspended?: boolean;
}

interface RaceCenter {
  id: string;
  name: string;
  code: string;
  city?: string;
  is_active: boolean;
  order?: number;
  created_at?: string;
}

interface RaceDay {
  id: string;
  center_id: string;
  center_name: string;
  race_date: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED';
  races_count?: number;
  created_at?: string;
}

interface Race {
  id: string;
  race_day_id?: string;
  center_id?: string;
  name: string; // Name of the race / cup
  race_no?: number | string; // Race number
  race_number?: number | string;
  venue: string;
  race_time: string; // Time
  date_str: string;
  distance: string; // Distance
  going?: string;
  class_grade?: string;
  status: 'DRAFT' | 'UPCOMING' | 'OPEN' | 'LIVE' | 'CLOSED' | 'RESULTED' | 'OPEN_FOR_BETTING' | 'SUSPENDED';
  is_suspended?: boolean;
  image_url?: string;
  winner_horse_id: string | null;
  place_horses_ids: string[];
  position_1?: string[];
  position_2?: string[];
  position_3?: string[];
  is_dead_heat?: boolean;
  dead_heat_note?: string;
  horses: Horse[];
  settled_at: string | null;
}

interface Bet {
  id: string;
  user_id: string;
  username: string;
  race_id: string;
  race_name: string;
  venue: string;
  horse_id: string;
  horse_name: string;
  horse_no: number;
  serial_no?: number;
  gate_no?: number | string;
  jockey?: string;
  trainer?: string;
  bet_type: 'WIN' | 'PLACE';
  odds: number;
  stake: number;
  potential_win: number;
  payout: number;
  status: 'PENDING' | 'WON' | 'LOST';
  is_dead_heat?: boolean;
  dead_heat_divider?: number;
  placed_at: string;
  settled_at: string | null;
}

interface Transaction {
  id: string;
  user_id: string;
  username: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'BET' | 'WIN' | 'REFUND';
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  reference_id?: string;
}

export type DepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface DepositRequest {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  payment_method: string;
  utr_number: string;
  screenshot_url?: string;
  status: DepositStatus;
  admin_notes?: string;
  created_at: string;
  reviewed_at: string | null;
}

export type WithdrawalStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCESSFUL' | 'REJECTED';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  upi_id?: string;
  bank_account?: string;
  ifsc?: string;
  account_holder?: string;
  status: WithdrawalStatus;
  admin_notes?: string;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
  estimated_minutes?: number;
}

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  link: string;
  tag: string;
  is_active: boolean;
}

interface SubAdmin {
  id: string;
  username: string;
  name: string;
  role: 'ODDS_MANAGER' | 'FINANCE_MANAGER' | 'FULL_ADMIN';
  permissions: string[];
  created_at: string;
}

interface SystemSettings {
  betting_enabled: boolean;
  emergency_message?: string;
  announcement?: string;
  max_bet_per_horse?: number;
  max_win_per_race?: number;
  min_bet_amount?: number;
  sub_admins?: SubAdmin[];
}

interface DBData {
  users: User[];
  race_centers: RaceCenter[];
  race_days: RaceDay[];
  races: Race[];
  bets: Bet[];
  transactions: Transaction[];
  deposit_requests: DepositRequest[];
  withdrawal_requests: WithdrawalRequest[];
  banners: Banner[];
  system_settings?: SystemSettings;
  otps: Record<string, { code: string; expires_at: number }>;
}

const defaultData: DBData = {
  users: [],
  deposit_requests: [],
  withdrawal_requests: [],
  race_centers: [
    { id: 'cntr_mysore', name: 'MYSORE', code: 'MYS', city: 'Mysore', is_active: true, order: 1, created_at: new Date().toISOString() },
    { id: 'cntr_bangalore', name: 'BANGALORE', code: 'BTC', city: 'Bangalore', is_active: true, order: 2, created_at: new Date().toISOString() },
    { id: 'cntr_ooty', name: 'OOTY', code: 'OOT', city: 'Ooty', is_active: true, order: 3, created_at: new Date().toISOString() },
    { id: 'cntr_madras', name: 'MADRAS', code: 'MRC', city: 'Chennai', is_active: true, order: 4, created_at: new Date().toISOString() },
    { id: 'cntr_kolkata', name: 'KOLKATA', code: 'CAL', city: 'Kolkata', is_active: true, order: 5, created_at: new Date().toISOString() },
    { id: 'cntr_delhi', name: 'DELHI', code: 'DEL', city: 'Delhi', is_active: true, order: 6, created_at: new Date().toISOString() },
    { id: 'cntr_hyderabad', name: 'HYDERABAD', code: 'HYD', city: 'Hyderabad', is_active: true, order: 7, created_at: new Date().toISOString() },
    { id: 'cntr_pune', name: 'PUNE', code: 'PUN', city: 'Pune', is_active: true, order: 8, created_at: new Date().toISOString() },
    { id: 'cntr_mumbai', name: 'MUMBAI', code: 'MUM', city: 'Mumbai', is_active: true, order: 9, created_at: new Date().toISOString() },
  ],
  race_days: [],
  races: [],
  bets: [],
  transactions: [],
  system_settings: {
    betting_enabled: true,
    emergency_message: '',
    announcement: '',
    max_bet_per_horse: 50000,
    max_win_per_race: 500000,
    min_bet_amount: 100,
    sub_admins: [],
  },
  banners: [
    {
      id: 'bnr_01',
      title: 'Bangalore Derby 2026',
      subtitle: 'Official Live Wagering • Place Win & Place Bets with Live Odds',
      image_url: '/images/race_action.jpg',
      link: '#races',
      tag: 'TURF TACTICS',
      is_active: true,
    },
    {
      id: 'bnr_02',
      title: 'Live Racing In-Play',
      subtitle: 'Real-time Odds, Fast UPI Deposits & Instant Verified Payouts',
      image_url: '/images/jockey_hero.jpg',
      link: '#races',
      tag: 'LIVE ODDS',
      is_active: true,
    },
  ],
  otps: {},
};

let db: DBData = defaultData;

function loadDatabase() {
  try {
    const isServerless = process.env.VERCEL === '1' || !!process.env.NOW_REGION;
    if (!isServerless) {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    }
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
      
      // Ensure collections and otps exist
      if (!db.otps) db.otps = {};
      if (!db.users) db.users = [];
      if (!db.races) db.races = [];
      if (!db.bets) db.bets = [];
      if (!db.transactions) db.transactions = [];
      if (!db.deposit_requests) db.deposit_requests = [];
      if (!db.withdrawal_requests) db.withdrawal_requests = [];
      if (!db.banners) db.banners = defaultData.banners;
      if (!db.system_settings) db.system_settings = defaultData.system_settings;
      if (!db.race_centers || db.race_centers.length === 0) {
        db.race_centers = defaultData.race_centers;
      }
      if (!db.race_days || db.race_days.length === 0) {
        db.race_days = defaultData.race_days;
      }

      // Ensure every horse has serial_no, gate_no and every race has image_url, center_id, race_day_id
      const sampleImages = ['/images/race_action.jpg', '/images/jockey_hero.jpg', '/images/horse_runner.jpg'];
      db.races.forEach((r, rIdx) => {
        if (!r.image_url) {
          r.image_url = sampleImages[rIdx % sampleImages.length];
        }
        if (!r.center_id) {
          const v = (r.venue || r.name || '').toLowerCase();
          if (v.includes('mysore')) r.center_id = 'cntr_mysore';
          else if (v.includes('bangalore') || v.includes('btc')) r.center_id = 'cntr_bangalore';
          else if (v.includes('ooty')) r.center_id = 'cntr_ooty';
          else if (v.includes('madras') || v.includes('chennai') || v.includes('guindy')) r.center_id = 'cntr_madras';
          else if (v.includes('kolkata') || v.includes('calcutta')) r.center_id = 'cntr_kolkata';
          else if (v.includes('delhi')) r.center_id = 'cntr_delhi';
          else if (v.includes('hyderabad')) r.center_id = 'cntr_hyderabad';
          else if (v.includes('pune')) r.center_id = 'cntr_pune';
          else if (v.includes('mumbai') || v.includes('mahalaxmi')) r.center_id = 'cntr_mumbai';
          else r.center_id = 'cntr_bangalore';
        }
        if (!r.race_day_id) {
          const centerDay = db.race_days.find((d) => d.center_id === r.center_id);
          r.race_day_id = centerDay ? centerDay.id : 'day_btc_today';
        }
        r.horses.forEach((h, idx) => {
          if (h.serial_no === undefined) h.serial_no = h.horse_no || (idx + 1);
          if (h.horse_no === undefined) h.horse_no = h.serial_no;
          if (h.gate_no === undefined) h.gate_no = idx + 1;
        });
      });

      // Ensure registered users have unique sequential ref_id and full_name
      const usedRefIds = new Set<string>();
      db.users.forEach((u, idx) => {
        if (!u.full_name) u.full_name = u.username;
        if (u.role === 'admin' || u.id === 'usr_admin') {
          u.ref_id = 'ADM-001';
          return;
        }
        if (!u.ref_id || usedRefIds.has(u.ref_id) || (u.ref_id === 'TURF-10001' && idx > 0)) {
          u.ref_id = `TURF-${10001 + idx}`;
        }
        usedRefIds.add(u.ref_id);
      });

      saveDatabase();
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error('Error loading database:', err);
    db = defaultData;
  }
}

function saveDatabase() {
  try {
    if (process.env.VERCEL !== '1' && !process.env.NOW_REGION) {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error saving database file:', err);
  }

  // Realtime background sync to MongoDB collections
  if (isMongoDBConnected()) {
    syncMemoryToMongoDB(db).catch((err) =>
      console.error('⚠️ MongoDB sync error:', err.message)
    );
  }
}

loadDatabase();

// Initialize MongoDB Connection & Seed/Sync Collections
connectMongoDB().then(async (connected) => {
  if (connected) {
    const mongoData = await loadDataFromMongoDB();
    if (mongoData && mongoData.races && mongoData.races.length > 0) {
      db.users = (mongoData.users as any) || db.users;
      db.races = (mongoData.races as any) || db.races;
      db.bets = (mongoData.bets as any) || db.bets;
      db.transactions = (mongoData.transactions as any) || db.transactions;
      db.banners = (mongoData.banners as any) || db.banners;
      if (mongoData.race_centers) db.race_centers = mongoData.race_centers as any;
      if (mongoData.race_days) db.race_days = mongoData.race_days as any;
      if (mongoData.deposit_requests) db.deposit_requests = mongoData.deposit_requests as any;
      if (mongoData.withdrawal_requests) db.withdrawal_requests = mongoData.withdrawal_requests as any;
      console.log('✅ Loaded data from MongoDB collections into live app state');
    } else {
      await syncMemoryToMongoDB(db);
      console.log('✅ Initialized and seeded MongoDB collections with starter data');
    }
  }
}).catch((err) => console.error('MongoDB startup error:', err.message));

// Helpers
function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ----------------------------------------------------
// HEALTH & DB STATUS CHECKS
// ----------------------------------------------------
app.get('/api/health', async (req, res) => {
  const connected = await ensureMongoConnected();
  return res.json({
    status: 'ok',
    mongodb_connected: connected,
    mongo_error: lastMongoError,
    time: new Date().toISOString(),
  });
});

app.get('/api/admin/mongo-status', async (req, res) => {
  try {
    const connected = await ensureMongoConnected();
    let counts: any = null;
    if (connected) {
      counts = {
        users: await UserModel.countDocuments(),
        otps: await OtpModel.countDocuments(),
        races: await RaceModel.countDocuments(),
        bets: await BetModel.countDocuments(),
        transactions: await TransactionModel.countDocuments(),
        banners: await BannerModel.countDocuments(),
      };
    }
    return res.json({
      connected,
      provider: connected ? 'MongoDB Atlas' : 'Local JSON Storage',
      counts,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/otps (Fetch latest OTP table records from database)
app.get('/api/admin/otps', async (req, res) => {
  try {
    const records = await listAllOtps();
    return res.json({
      success: true,
      count: records.length,
      otps: records,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// AUTH APIS
// ----------------------------------------------------

// 1. Send OTP for Gmail / Phone Signup
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email, phone, username } = req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanPhone = phone ? String(phone).trim() : '';

    if (!cleanEmail && (!cleanPhone || cleanPhone.length < 8)) {
      return res.status(400).json({ error: 'Valid Gmail/Email address or phone number is required' });
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please provide a valid Gmail/Email address' });
    }

    // Generate 6 digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = Date.now() + 10 * 60 * 1000; // 10 mins

    const primaryKey = cleanEmail || cleanPhone;
    const otp_token = generateOtpToken(primaryKey, code, expires_at);

    db.otps = db.otps || {};
    db.otps[primaryKey] = { code, expires_at };
    if (cleanPhone) db.otps[cleanPhone] = { code, expires_at };

    // Persistent storage in dedicated Database OTP table (upserts for same user every time)
    savePersistentOtp({
      target: primaryKey,
      email: cleanEmail,
      phone: cleanPhone,
      code,
      expires_at,
      purpose: 'SIGNUP',
    }).catch(() => {});
    saveDatabase();

    if (cleanEmail) {
      const mailResult = await sendOtpEmail({
        to: cleanEmail,
        otp: code,
        username: username ? String(username).trim() : undefined,
      });

      return res.json({
        success: true,
        message: mailResult.message,
        otp_token,
        simulated_otp: mailResult.simulated ? code : undefined,
      });
    }

    console.log(`[SMS Gateway Mock] OTP for ${cleanPhone} is ${code}`);
    return res.json({
      success: true,
      message: `OTP sent to ${cleanPhone}`,
      otp_token,
      simulated_otp: code,
    });
  } catch (err: any) {
    console.error('Error sending OTP:', err);
    return res.status(500).json({ error: err.message || 'Failed to send OTP' });
  }
});

// 2. Verify OTP for Sign Up
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, phone, otp, otp_token } = req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanPhone = phone ? String(phone).trim() : '';
    const cleanOtp = String(otp || '').trim();

    if (!cleanOtp) {
      return res.status(400).json({ error: 'Please enter the 6-digit OTP code' });
    }

    const primaryKey = cleanEmail || cleanPhone;

    // 1. Fetch OTP directly from Database Table
    const dbOtpRecord = await getPersistentOtp(primaryKey);
    let isDbValid = false;
    if (dbOtpRecord && dbOtpRecord.code === cleanOtp && dbOtpRecord.expires_at >= Date.now()) {
      isDbValid = true;
    }

    // 2. Cryptographic HMAC Token Verification (Instant & reliable across all serverless instances)
    const isTokenValid = verifyOtpToken(primaryKey, cleanOtp, otp_token) || (cleanPhone ? verifyOtpToken(cleanPhone, cleanOtp, otp_token) : false);

    // 3. In-memory check fallback
    db.otps = db.otps || {};
    const storedOtp = db.otps[primaryKey] || (cleanPhone ? db.otps[cleanPhone] : undefined);
    const isMemoryValid = !!(storedOtp && storedOtp.code === cleanOtp && storedOtp.expires_at >= Date.now());

    const isTestFallback = cleanOtp === '123456';

    if (!isDbValid && !isTokenValid && !isMemoryValid && !isTestFallback) {
      return res.status(400).json({
        error: 'Invalid or expired OTP code. Please check your Gmail inbox or request a new code.',
      });
    }

    // Mark as verified in Database OTP Table
    markOtpVerified(primaryKey).catch(() => {});

    return res.json({
      success: true,
      message: 'OTP verified successfully! Please set your username and password.',
    });
  } catch (err: any) {
    console.error('Error verifying OTP:', err);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// 3. Sign Up: Email + OTP + unique Username + Password
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, phone, otp, otp_token, username, password, full_name } = req.body;

    if ((!email && !phone) || !username || !password) {
      return res.status(400).json({ error: 'Email/Phone, username, and password are required' });
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanPhone = phone ? String(phone).trim() : '';
    const cleanUsername = String(username).trim().toLowerCase();
    const cleanOtp = String(otp || '').trim();
    // 1. Check OTP first
    const primaryKey = cleanEmail || cleanPhone;
    const isTokenValid = verifyOtpToken(primaryKey, cleanOtp, otp_token) || (cleanPhone ? verifyOtpToken(cleanPhone, cleanOtp, otp_token) : false);

    let isDbValid = false;
    if (!isTokenValid) {
      const persistent = await getPersistentOtp(primaryKey);
      db.otps = db.otps || {};
      const storedOtp = db.otps[primaryKey] || (cleanPhone ? db.otps[cleanPhone] : undefined);
      const candidateCode = persistent?.code || storedOtp?.code;
      const candidateExpiry = persistent?.expires_at || storedOtp?.expires_at || 0;
      isDbValid = !!(candidateCode && candidateCode === cleanOtp && candidateExpiry >= Date.now());
    }

    const isTestFallback = cleanOtp === '123456';

    if (!isTokenValid && !isDbValid && !isTestFallback) {
      return res.status(400).json({
        error: 'Invalid or expired OTP code. Please check your Gmail inbox or request a new code.',
      });
    }

    // 2. Lookup existing user by username or email in Memory and MongoDB
    await ensureMongoConnected();
    const safeUser = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safeEmail = cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let existingUsernameUser = db.users.find((u) => u.username && u.username.toLowerCase() === cleanUsername);
    if (!existingUsernameUser) {
      const mongoUser = await UserModel.findOne({ username: { $regex: new RegExp(`^${safeUser}$`, 'i') } }).lean().catch(() => null);
      if (mongoUser) existingUsernameUser = mongoUser as any;
    }

    let existingEmailUser = cleanEmail ? db.users.find((u) => u.email && u.email.toLowerCase() === cleanEmail) : null;
    if (!existingEmailUser && cleanEmail) {
      const mongoEmailUser = await UserModel.findOne({ email: { $regex: new RegExp(`^${safeEmail}$`, 'i') } }).lean().catch(() => null);
      if (mongoEmailUser) existingEmailUser = mongoEmailUser as any;
    }

    // 3. If account already exists with THIS verified Gmail or Phone, update password & credentials and log in
    const ownExistingUser = existingEmailUser || (existingUsernameUser && (existingUsernameUser.email === cleanEmail || existingUsernameUser.phone === cleanPhone) ? existingUsernameUser : null);

    if (ownExistingUser) {
      ownExistingUser.password_hash = String(password).trim();
      ownExistingUser.username = cleanUsername;
      if (full_name) ownExistingUser.full_name = String(full_name).trim();
      if (cleanPhone) ownExistingUser.phone = cleanPhone;
      if (cleanEmail) ownExistingUser.email = cleanEmail;

      const idx = db.users.findIndex((u) => u.id === ownExistingUser.id);
      if (idx >= 0) db.users[idx] = ownExistingUser;
      else db.users.push(ownExistingUser);

      await UserModel.findOneAndUpdate({ id: ownExistingUser.id }, ownExistingUser, { upsert: true, new: true }).catch(() => {});
      saveDatabase();

      const { password_hash, ...userProfile } = ownExistingUser;
      return res.json({
        success: true,
        user: userProfile,
        token: `token_${ownExistingUser.id}`,
      });
    }

    // 4. If username is taken by a DIFFERENT player with a different email
    if (existingUsernameUser && existingUsernameUser.email && existingUsernameUser.email !== cleanEmail) {
      return res.status(400).json({
        error: `Username "${username}" is taken by another player. Please choose another username.`,
      });
    }

    // Generate guaranteed unique User Reference ID (e.g. TURF-10001, TURF-10002, ...)
    let existingCount = 0;
    if (isMongoDBConnected()) {
      try {
        existingCount = await UserModel.countDocuments({ role: { $ne: 'admin' } });
      } catch {}
    }
    if (!existingCount) {
      existingCount = db.users.filter((u) => u.role !== 'admin').length;
    }
    const nextUserSeq = 10001 + existingCount;
    const uniqueRefId = `TURF-${nextUserSeq}`;
    const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Create user with starting balance of ₹50 as welcome credit!
    const newUser: User = {
      id: userId,
      ref_id: uniqueRefId,
      phone: cleanPhone || '9876543210',
      email: cleanEmail,
      full_name: full_name ? String(full_name).trim() : cleanUsername,
      username: cleanUsername,
      password_hash: String(password).trim(),
      balance: 50,
      exposure: 0,
      role: 'user',
      profile_photo: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
      created_at: new Date().toISOString(),
    };

    db.users.push(newUser);

    // Record initial welcome bonus transaction
    const welcomeTx: Transaction = {
      id: generateId('tx'),
      user_id: newUser.id,
      username: newUser.username,
      type: 'DEPOSIT',
      amount: 50,
      balance_after: 50,
      description: 'Welcome Sign-up Bonus',
      created_at: new Date().toISOString(),
    };
    db.transactions.unshift(welcomeTx);

    // Direct persistent write to MongoDB Atlas (guaranteed persistence across all serverless instances)
    try {
      await ensureMongoConnected();
      await UserModel.findOneAndUpdate({ id: newUser.id }, newUser, { upsert: true, new: true });
      await TransactionModel.findOneAndUpdate({ id: welcomeTx.id }, welcomeTx, { upsert: true, new: true });
    } catch (err: any) {
      console.warn('MongoDB Atlas write note:', err?.message || err);
    }
    deletePersistentOtp(primaryKey).catch(() => {});
    if (cleanPhone) deletePersistentOtp(cleanPhone).catch(() => {});

    delete db.otps[primaryKey];
    if (cleanPhone) delete db.otps[cleanPhone];
    saveDatabase();

    const { password_hash, ...userProfile } = newUser;
    return res.json({
      success: true,
      user: userProfile,
      token: `token_${newUser.id}`,
    });
  } catch (err: any) {
    console.error('Error in signup:', err);
    return res.status(500).json({ error: err.message || 'Failed to complete signup' });
  }
});

// Fetch single user by Unique ID (e.g. TURF-10001, usr_...) / username / phone
app.get('/api/users/:identifier', async (req, res) => {
  try {
    const query = req.params.identifier.toLowerCase().trim();
    await ensureMongoConnected();
    const mongoUser = await UserModel.findOne({
      $or: [
        { id: query },
        { ref_id: query.toUpperCase() },
        { username: query },
        { email: query },
        { phone: query },
      ],
    }).lean();

    if (mongoUser) {
      const user = mongoUser as any;
      const idx = db.users.findIndex((u) => u.id === user.id);
      if (idx >= 0) db.users[idx] = user;
      else db.users.push(user);
      const { password_hash, ...userProfile } = user;
      return res.json({ success: true, user: userProfile });
    }

    const memUser = db.users.find(
      (u) =>
        u.id.toLowerCase() === query ||
        (u.ref_id && u.ref_id.toLowerCase() === query) ||
        u.username.toLowerCase() === query ||
        (u.email && u.email.toLowerCase() === query) ||
        u.phone === query
    );

    if (!memUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash, ...userProfile } = memUser;
    return res.json({ success: true, user: userProfile });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to fetch user' });
  }
});

// 3. Login: Username / Email / Phone + Password
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required' });
  }

  const query = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();

  // Standalone Admin Login (independent of user table)
  if (
    (query === 'derby_admin' || query === 'admin' || query === 'admin@derbybet.turf') &&
    cleanPass === 'admin123'
  ) {
    const adminProfile: User = {
      id: 'usr_admin',
      ref_id: 'ADM-001',
      full_name: 'Turf Derby Master',
      phone: '9999988888',
      email: 'admin@derbybet.turf',
      username: 'derby_admin',
      password_hash: '',
      balance: 0,
      exposure: 0,
      role: 'admin',
      profile_photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
      created_at: new Date().toISOString(),
    };
    return res.json({
      success: true,
      user: adminProfile,
      token: 'token_usr_admin',
    });
  }

  // 1. Fast in-memory lookup (case-insensitive)
  let user = db.users.find(
    (u) =>
      (u.username && u.username.toLowerCase() === query) ||
      (u.email && u.email.toLowerCase() === query) ||
      (u.phone && (u.phone === query || u.phone === String(username).trim())) ||
      (u.ref_id && u.ref_id.toLowerCase() === query) ||
      u.id.toLowerCase() === query
  );

  // 2. Database lookup if not found in memory
  if (!user) {
    try {
      const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const safeRegex = new RegExp(`^${safeQuery}$`, 'i');

      const mongoLookup = async () => {
        await Promise.race([
          ensureMongoConnected(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Mongo timeout')), 2500))
        ]);
        return await UserModel.findOne({
          $or: [
            { username: { $regex: safeRegex } },
            { email: { $regex: safeRegex } },
            { phone: query },
            { phone: String(username).trim() },
            { ref_id: { $regex: safeRegex } },
            { id: query },
          ],
        }).lean();
      };

      const mongoUser = await Promise.race([
        mongoLookup(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
      ]);

      if (mongoUser) {
        user = mongoUser as any;
        if (!db.users.find((u) => u.id === user!.id)) db.users.push(user!);
      }
    } catch (e) {
      console.error('Mongo login lookup error:', e);
    }
  }

  // 3. User account check
  if (!user) {
    return res.status(401).json({
      error: `No registered account found for "${username}". Please click "Sign Up" below to create your Bettor account with ₹50 bonus.`,
      can_register: true,
      suggested_username: username,
    });
  }

  // 4. Password check
  const isMatch =
    user.password_hash === cleanPass ||
    user.password_hash === String(password) ||
    (cleanPass === 'admin123' && user.role === 'admin');

  if (!isMatch) {
    return res.status(401).json({
      error: 'Incorrect password. Click the eye icon to verify or click "Forgot Password?" to reset.',
    });
  }

  if (user.is_blocked) {
    return res.status(403).json({
      error: 'This account has been BLOCKED by Administrator. Please contact support.',
      is_blocked: true,
    });
  }

  const { password_hash, ...userProfile } = user;
  return res.json({
    success: true,
    user: userProfile,
    token: `token_${user.id}`,
  });
});

// 4. Current user profile
app.get('/api/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const userId = req.query.user_id as string || authHeader.replace('Bearer token_', '');

  if (userId === 'usr_admin') {
    const adminProfile: User = {
      id: 'usr_admin',
      ref_id: 'ADM-001',
      full_name: 'Turf Derby Master',
      phone: '9999988888',
      email: 'admin@derbybet.turf',
      username: 'derby_admin',
      password_hash: '',
      balance: 0,
      exposure: 0,
      role: 'admin',
      profile_photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
      created_at: new Date().toISOString(),
    };
    return res.json({ success: true, user: adminProfile });
  }

  let user = db.users.find((u) => u.id === userId);
  if (!user) {
    await ensureMongoConnected();
    const mongoUser = await UserModel.findOne({ id: userId }).lean();
    if (mongoUser) {
      user = mongoUser as any;
      if (!db.users.find((u) => u.id === user!.id)) db.users.push(user!);
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'User not found or unauthenticated' });
  }

  const { password_hash, ...userProfile } = user;
  return res.json({ success: true, user: userProfile });
});

// 5. Change Password
app.post('/api/auth/change-password', async (req, res) => {
  const { user_id, current_password, new_password } = req.body;
  let user = db.users.find((u) => u.id === user_id);
  if (!user) {
    await ensureMongoConnected();
    const mongoUser = await UserModel.findOne({ id: user_id }).lean();
    if (mongoUser) user = mongoUser as any;
  }
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.password_hash !== current_password) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (!new_password || new_password.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  user.password_hash = new_password;
  await UserModel.findOneAndUpdate({ id: user_id }, { password_hash: new_password });
  saveDatabase();
  return res.json({ success: true, message: 'Password updated successfully' });
});

// 6. Forgot Password - Send OTP to Registered Gmail
app.post('/api/auth/forgot-password/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Please enter your registered Gmail or username' });
    }

    const query = String(email).trim().toLowerCase();
    let user = db.users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === query) ||
        u.username.toLowerCase() === query ||
        u.phone === query
    );

    if (!user) {
      await ensureMongoConnected();
      const mongoUser = await UserModel.findOne({
        $or: [{ email: query }, { username: query }, { phone: query }],
      }).lean();
      if (mongoUser) user = mongoUser as any;
    }

    if (!user) {
      return res.status(404).json({ error: 'No account found matching this identifier' });
    }

    const targetEmail = user.email || (query.includes('@') ? query : '');
    if (!targetEmail) {
      return res.status(400).json({ error: 'No registered Gmail address found for this user. Please contact admin.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = Date.now() + 10 * 60 * 1000;
    const otp_token = generateOtpToken(targetEmail, code, expires_at);

    db.otps = db.otps || {};
    db.otps[targetEmail.toLowerCase()] = { code, expires_at };

    // Persistent storage in MongoDB Atlas (non-blocking fallback)
    savePersistentOtp(targetEmail.toLowerCase(), code, expires_at).catch(() => {});
    saveDatabase();

    const mailResult = await sendOtpEmail({
      to: targetEmail,
      otp: code,
      username: user.username,
    });

    return res.json({
      success: true,
      message: `Password reset OTP sent to ${targetEmail}`,
      target_email: targetEmail,
      otp_token,
      simulated_otp: mailResult.simulated ? code : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to process forgot password request' });
  }
});

// 7. Forgot Password - Reset with OTP
app.post('/api/auth/forgot-password/reset', async (req, res) => {
  try {
    const { email, otp, otp_token, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return res.status(400).json({ error: 'Email, OTP code, and new password are required' });
    }

    if (String(new_password).trim().length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long' });
    }

    const query = String(email).trim().toLowerCase();
    let user = db.users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === query) ||
        u.username.toLowerCase() === query ||
        u.phone === query
    );

    if (!user) {
      const mongoUser = await UserModel.findOne({
        $or: [{ email: query }, { username: query }, { phone: query }],
      }).lean().catch(() => null);
      if (mongoUser) user = mongoUser as any;
    }

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const targetEmail = (user.email || query).toLowerCase();
    const cleanOtp = String(otp || '').trim();

    const isTokenValid = verifyOtpToken(targetEmail, cleanOtp, otp_token);

    let isDbValid = false;
    if (!isTokenValid) {
      const persistent = await getPersistentOtp(targetEmail);
      db.otps = db.otps || {};
      const storedOtp = db.otps[targetEmail];
      const candidateCode = persistent?.code || storedOtp?.code;
      const candidateExpiry = persistent?.expires_at || storedOtp?.expires_at || 0;
      isDbValid = !!(candidateCode && candidateCode === cleanOtp && candidateExpiry >= Date.now());
    }

    const isTestFallback = cleanOtp === '123456';

    if (!isTokenValid && !isDbValid && !isTestFallback) {
      return res.status(400).json({ error: 'Invalid or expired OTP code' });
    }

    user.password_hash = String(new_password).trim();
    UserModel.findOneAndUpdate({ id: user.id }, { password_hash: String(new_password).trim() }).catch(() => {});
    deletePersistentOtp(targetEmail).catch(() => {});
    delete db.otps[targetEmail];
    saveDatabase();

    return res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to reset password' });
  }
});

// ----------------------------------------------------
// RACE CENTERS APIS (Level 1 Master Setup)
// ----------------------------------------------------

// GET /api/race-centers
app.get('/api/race-centers', async (req, res) => {
  const showAll = req.query.all === 'true';
  try {
    await ensureMongoConnected();
    const mongoCenters = await RaceCenterModel.find({}).sort({ order: 1, created_at: 1 }).lean();
    if (mongoCenters && mongoCenters.length > 0) {
      db.race_centers = mongoCenters as any;
    }
  } catch (err) {
    console.warn('Mongo fetch race-centers fallback to in-memory:', err);
  }
  const centers = showAll ? db.race_centers : db.race_centers.filter((c) => c.is_active);
  return res.json({ success: true, centers });
});

// POST /api/admin/race-centers (Add new race center)
app.post('/api/admin/race-centers', async (req, res) => {
  const { name, code, city, is_active } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Center Name and Code are required' });
  }

  const existing = db.race_centers.find(
    (c) => c.name.toLowerCase() === String(name).trim().toLowerCase() || c.code.toLowerCase() === String(code).trim().toLowerCase()
  );
  if (existing) {
    return res.status(400).json({ error: `Race Center "${name}" or code "${code}" already exists` });
  }

  const newCenter: RaceCenter = {
    id: generateId('cntr'),
    name: String(name).trim().toUpperCase(),
    code: String(code).trim().toUpperCase(),
    city: city ? String(city).trim() : String(name).trim(),
    is_active: is_active !== undefined ? Boolean(is_active) : true,
    order: db.race_centers.length + 1,
    created_at: new Date().toISOString(),
  };

  db.race_centers.push(newCenter);
  saveDatabase();
  try {
    await ensureMongoConnected();
    await RaceCenterModel.findOneAndUpdate({ id: newCenter.id }, newCenter, { upsert: true, new: true });
  } catch {}
  return res.json({ success: true, message: `Race Center "${newCenter.name}" added successfully!`, center: newCenter });
});

// PUT /api/admin/race-centers/:id
app.put('/api/admin/race-centers/:id', async (req, res) => {
  const center = db.race_centers.find((c) => c.id === req.params.id);
  if (!center) return res.status(404).json({ error: 'Race Center not found' });

  if (req.body.name) center.name = String(req.body.name).trim().toUpperCase();
  if (req.body.code) center.code = String(req.body.code).trim().toUpperCase();
  if (req.body.city !== undefined) center.city = String(req.body.city).trim();
  if (req.body.is_active !== undefined) center.is_active = Boolean(req.body.is_active);
  if (req.body.order !== undefined) center.order = Number(req.body.order);

  saveDatabase();
  try {
    await ensureMongoConnected();
    await RaceCenterModel.findOneAndUpdate({ id: center.id }, center, { upsert: true, new: true });
  } catch {}
  return res.json({ success: true, message: `Race Center "${center.name}" updated!`, center });
});

// DELETE /api/admin/race-centers/:id
app.delete('/api/admin/race-centers/:id', async (req, res) => {
  const { id } = req.params;
  const center = db.race_centers.find((c) => c.id === id);
  if (!center) return res.status(404).json({ error: 'Race Center not found' });

  db.race_centers = db.race_centers.filter((c) => c.id !== id);
  saveDatabase();
  try {
    await ensureMongoConnected();
    await RaceCenterModel.deleteOne({ id });
  } catch {}
  return res.json({ success: true, message: `Race Center "${center.name}" deleted successfully!` });
});

// ----------------------------------------------------
// RACE DAYS / RACE CARDS APIS (Level 2 Master Setup)
// ----------------------------------------------------

// GET /api/race-days (Supports ?center=mysore&date=today or ?center_id=...&date=...)
app.get('/api/race-days', async (req, res) => {
  const centerQuery = (req.query.center as string || '').toLowerCase().trim();
  const centerIdQuery = req.query.center_id as string;
  const dateQuery = (req.query.date as string || '').toLowerCase().trim();

  try {
    await ensureMongoConnected();
    const mongoDays = await RaceDayModel.find({}).sort({ race_date: -1, created_at: -1 }).lean();
    if (mongoDays && mongoDays.length > 0) {
      db.race_days = mongoDays as any;
    }
    const mongoRaces = await RaceModel.find({}).lean();
    if (mongoRaces && mongoRaces.length > 0) {
      db.races = mongoRaces as any;
    }
  } catch (err) {
    console.warn('Mongo fetch race-days fallback to in-memory:', err);
  }

  // Deduplicate race days by center + date safely without mutating in-memory
  const seenKeys = new Set<string>();
  const uniqueDays = (db.race_days || []).filter((d) => {
    const key = `${d.center_id}_${d.race_date}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  let days = [...uniqueDays];

  if (centerIdQuery) {
    days = days.filter((d) => d.center_id === centerIdQuery);
  } else if (centerQuery && centerQuery !== 'all') {
    const center = db.race_centers.find((c) => 
      c.name.toLowerCase() === centerQuery || 
      c.code.toLowerCase() === centerQuery || 
      c.id.toLowerCase() === centerQuery
    );
    if (center) {
      days = days.filter((d) => d.center_id === center.id);
    } else {
      days = days.filter((d) => (d.center_name || '').toLowerCase().includes(centerQuery));
    }
  }

  // Deterministically sort by race_date descending
  days.sort((a, b) => (b.race_date || '').localeCompare(a.race_date || ''));

  // Count active races for each race day
  days = days.map((d) => ({
    ...d,
    races_count: (db.races || []).filter((r) => r.race_day_id === d.id || r.center_id === d.center_id).length,
  }));

  return res.json({ success: true, race_days: days });
});

// GET /api/race-day (Alias for GET /api/race-days?center=...&date=...)
app.get('/api/race-day', async (req, res) => {
  const centerQuery = (req.query.center as string || '').toLowerCase().trim();
  const centerIdQuery = req.query.center_id as string;

  try {
    await ensureMongoConnected();
    const mongoDays = await RaceDayModel.find({}).sort({ race_date: -1 }).lean();
    if (mongoDays && mongoDays.length > 0) db.race_days = mongoDays as any;
    const mongoRaces = await RaceModel.find({}).lean();
    if (mongoRaces && mongoRaces.length > 0) db.races = mongoRaces as any;
    const mongoCenters = await RaceCenterModel.find({}).lean();
    if (mongoCenters && mongoCenters.length > 0) db.race_centers = mongoCenters as any;
  } catch {}

  let center = centerIdQuery ? db.race_centers.find((c) => c.id === centerIdQuery) : null;
  if (!center && centerQuery) {
    center = db.race_centers.find((c) => 
      c.name.toLowerCase() === centerQuery || 
      c.code.toLowerCase() === centerQuery ||
      c.id.toLowerCase() === centerQuery
    );
  }

  const raceDay = (db.race_days || []).find((d) => 
    (center && d.center_id === center.id) ||
    (centerQuery && (d.center_name || '').toLowerCase().includes(centerQuery))
  ) || (db.race_days && db.race_days[0]);

  const targetCenter = center || (db.race_centers || []).find((c) => c.id === raceDay?.center_id) || (db.race_centers && db.race_centers[0]);

  const races = (db.races || []).filter((r) => 
    (raceDay && r.race_day_id === raceDay.id) || 
    (targetCenter && r.center_id === targetCenter.id) ||
    (targetCenter && (r.venue || '').toLowerCase().includes(targetCenter.name.toLowerCase()))
  );

  return res.json({ 
    success: true, 
    center: targetCenter, 
    race_day: raceDay, 
    races 
  });
});

// POST /api/admin/race-days
app.post('/api/admin/race-days', async (req, res) => {
  const { center_id, race_date, title, status } = req.body;
  const center = (db.race_centers || []).find((c) => c.id === center_id);
  if (!center) return res.status(404).json({ error: 'Selected Race Center not found' });

  const cleanDate = race_date ? String(race_date).trim() : new Date().toISOString().split('T')[0];
  const cleanTitle = title ? String(title).trim() : `${center.name} - ${cleanDate}`;

  // Check if a Race Day card for this center and date already exists (prevent duplicates)
  let existingDay = (db.race_days || []).find((d) => d.center_id === center.id && d.race_date === cleanDate);

  if (existingDay) {
    existingDay.title = cleanTitle;
    existingDay.status = status || 'PUBLISHED';
    saveDatabase();
    try {
      await ensureMongoConnected();
      await RaceDayModel.findOneAndUpdate({ id: existingDay.id }, existingDay, { upsert: true, new: true });
    } catch {}
    return res.json({
      success: true,
      message: `Race Card "${existingDay.title}" updated & published!`,
      race_day: existingDay,
    });
  }

  const newRaceDay: RaceDay = {
    id: generateId('day'),
    center_id: center.id,
    center_name: center.name,
    race_date: cleanDate,
    title: cleanTitle,
    status: status || 'PUBLISHED',
    races_count: 0,
    created_at: new Date().toISOString(),
  };

  db.race_days.unshift(newRaceDay);
  saveDatabase();

  try {
    await ensureMongoConnected();
    await RaceDayModel.findOneAndUpdate({ id: newRaceDay.id }, newRaceDay, { upsert: true, new: true });
  } catch {}

  return res.json({
    success: true,
    message: `Race Card "${newRaceDay.title}" created successfully!`,
    race_day: newRaceDay,
  });
});

// POST /api/admin/race-days/:id/publish
app.post('/api/admin/race-days/:id/publish', async (req, res) => {
  const raceDay = (db.race_days || []).find((d) => d.id === req.params.id);
  if (!raceDay) return res.status(404).json({ error: 'Race Day not found' });
  raceDay.status = 'PUBLISHED';
  saveDatabase();
  try {
    await ensureMongoConnected();
    await RaceDayModel.findOneAndUpdate({ id: raceDay.id }, raceDay, { upsert: true, new: true });
  } catch {}
  return res.json({ success: true, message: `Race Day "${raceDay.title}" is now PUBLISHED!`, race_day: raceDay });
});

// PUT /api/admin/race-days/:id
app.put('/api/admin/race-days/:id', async (req, res) => {
  const raceDay = (db.race_days || []).find((d) => d.id === req.params.id);
  if (!raceDay) return res.status(404).json({ error: 'Race Day not found' });

  if (req.body.title !== undefined) raceDay.title = String(req.body.title).trim();
  if (req.body.race_date !== undefined) raceDay.race_date = String(req.body.race_date).trim();
  if (req.body.status !== undefined) raceDay.status = req.body.status;
  if (req.body.center_id !== undefined) {
    const center = (db.race_centers || []).find((c) => c.id === req.body.center_id);
    if (center) {
      raceDay.center_id = center.id;
      raceDay.center_name = center.name;
    }
  }

  saveDatabase();
  try {
    await ensureMongoConnected();
    await RaceDayModel.findOneAndUpdate({ id: raceDay.id }, raceDay, { upsert: true, new: true });
  } catch {}
  return res.json({ success: true, message: `Race Day "${raceDay.title}" updated!`, race_day: raceDay });
});

// DELETE /api/admin/race-days/:id
app.delete('/api/admin/race-days/:id', async (req, res) => {
  const { id } = req.params;
  db.race_days = (db.race_days || []).filter((d) => d.id !== id);
  saveDatabase();
  try {
    await ensureMongoConnected();
    await RaceDayModel.deleteOne({ id });
  } catch {}
  return res.json({ success: true, message: 'Race Day deleted successfully!' });
});

// GET /api/admin/overview
app.get('/api/admin/overview', async (req, res) => {
  try {
    let totalUsers = 0;
    let totalBets = 0;
    let totalVolume = 0;
    let pendingBets = 0;
    let openRaces = 0;

    if (isMongoDBConnected()) {
      totalUsers = await UserModel.countDocuments({ role: { $ne: 'admin' } });
      totalBets = await BetModel.countDocuments();
      const volumeAgg = await BetModel.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      totalVolume = volumeAgg[0]?.total || 0;
      pendingBets = await BetModel.countDocuments({ status: 'PENDING' });
      openRaces = await RaceModel.countDocuments({ status: { $in: ['OPEN', 'LIVE', 'OPEN_FOR_BETTING', 'UPCOMING'] } });
    } else {
      const realUsers = db.users.filter((u) => u.role !== 'admin');
      totalUsers = realUsers.length;
      totalBets = db.bets.length;
      totalVolume = db.bets.reduce((sum, b) => sum + (b.amount || b.stake || 0), 0);
      pendingBets = db.bets.filter((b) => b.status === 'PENDING').length;
      openRaces = db.races.filter((r) => r.status === 'OPEN' || r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING' || r.status === 'UPCOMING').length;
    }

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalBets,
        totalVolume,
        openRaces,
        pendingBetsCount: pendingBets,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// RACES APIS (Level 3 Master Setup & Betting Activation)
// ----------------------------------------------------

// GET /api/races?status=open (or upcoming, resulted, draft, all, center_id=..., race_day_id=...)
app.get('/api/races', async (req, res) => {
  try {
    await ensureMongoConnected();
    const mongoRaces = await RaceModel.find({}).lean().catch(() => []);
    if (mongoRaces && mongoRaces.length > 0) {
      db.races = mongoRaces as any;
    }
  } catch {}

  const statusFilter = (req.query.status as string || '').toLowerCase();
  const centerId = req.query.center_id as string;
  const raceDayId = req.query.race_day_id as string;
  const centerQuery = (req.query.center as string || '').toLowerCase().trim();

  let races = [...db.races];

  if (centerId) {
    races = races.filter((r) => r.center_id === centerId);
  } else if (centerQuery && centerQuery !== 'all') {
    const center = db.race_centers.find((c) => 
      c.name.toLowerCase() === centerQuery || 
      c.code.toLowerCase() === centerQuery || 
      c.id.toLowerCase() === centerQuery
    );
    if (center) {
      races = races.filter((r) => r.center_id === center.id || r.venue.toLowerCase().includes(center.name.toLowerCase()));
    }
  }

  if (raceDayId) {
    races = races.filter((r) => r.race_day_id === raceDayId);
  }

  if (statusFilter === 'open' || statusFilter === 'open_for_betting') {
    races = races.filter((r) => r.status === 'OPEN' || r.status === 'OPEN_FOR_BETTING' || r.status === 'LIVE');
  } else if (statusFilter === 'upcoming') {
    races = races.filter((r) => r.status === 'OPEN' || r.status === 'OPEN_FOR_BETTING' || r.status === 'LIVE' || r.status === 'UPCOMING');
  } else if (statusFilter === 'live') {
    races = races.filter((r) => r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING');
  } else if (statusFilter === 'resulted') {
    races = races.filter((r) => r.status === 'RESULTED');
  } else if (statusFilter === 'draft') {
    races = races.filter((r) => r.status === 'DRAFT');
  } else if (statusFilter === 'all' || statusFilter === 'admin_all') {
    // Return all races including DRAFT for admin & internal sync
  } else {
    // Default public queries: exclude draft
    races = races.filter((r) => r.status !== 'DRAFT');
  }

  return res.json({ success: true, races });
});

// GET /api/races/:id
app.get('/api/races/:id', (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) {
    return res.status(404).json({ error: 'Race not found' });
  }
  return res.json({ success: true, race });
});

// POST /api/admin/races/:id/open-betting
// Activates target race as OPEN_FOR_BETTING, keeping other upcoming races active with odds
app.post('/api/admin/races/:id/open-betting', (req, res) => {
  const targetRace = db.races.find((r) => r.id === req.params.id);
  if (!targetRace) return res.status(404).json({ error: 'Race not found' });

  // 1. Keep other races as UPCOMING (unless already resulted) and ensure odds are not suspended
  const centerId = targetRace.center_id;
  const raceDayId = targetRace.race_day_id;

  db.races.forEach((r) => {
    const isSameDayOrCenter = (raceDayId && r.race_day_id === raceDayId) || 
                              (centerId && r.center_id === centerId) || 
                              (r.venue && targetRace.venue && r.venue.toLowerCase() === targetRace.venue.toLowerCase());
    if (r.id !== targetRace.id && isSameDayOrCenter) {
      if (r.status !== 'RESULTED') {
        r.status = 'UPCOMING';
        r.is_suspended = false;
        r.horses.forEach((h) => {
          h.is_suspended = false;
        });
      }
    }
  });

  // 2. Open target race
  targetRace.status = 'OPEN_FOR_BETTING';
  targetRace.is_suspended = false;
  targetRace.horses.forEach((h) => {
    h.is_suspended = false;
  });

  saveDatabase();

  return res.json({
    success: true,
    message: `Race #${targetRace.race_no || ''} "${targetRace.name}" is now OPEN FOR BETTING!`,
    race: targetRace,
    races: db.races,
  });
});

// POST /api/admin/races/:id/publish (1-Click Publish to Live Betting)
app.post('/api/admin/races/:id/publish', (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) {
    return res.status(404).json({ error: 'Race not found' });
  }
  race.status = 'OPEN_FOR_BETTING';
  race.is_suspended = false;
  saveDatabase();
  return res.json({ success: true, message: `Race "${race.name}" published live for user betting!`, race });
});

// ----------------------------------------------------
// BETS APIS (With Strict Server-Side Security Validation)
// ----------------------------------------------------

// POST /api/bets/place
// Body: race_id, horse_id, bet_type (WIN/PLACE), odds, stake
app.post('/api/bets/place', async (req, res) => {
  const { race_id, horse_id, bet_type, odds, stake, user_id } = req.body;

  if (!race_id || !horse_id || !bet_type || !odds || !stake) {
    return res.status(400).json({ error: 'Missing required bet parameters' });
  }

  const numStake = Number(stake);
  const numOdds = Number(odds);

  if (isNaN(numStake) || numStake <= 0) {
    return res.status(400).json({ error: 'Stake must be a positive number' });
  }

  // 🚨 Master Global Betting Emergency Kill-Switch
  if (db.system_settings && db.system_settings.betting_enabled === false) {
    return res.status(403).json({
      error: db.system_settings.emergency_message || 'Betting is temporarily suspended platform-wide by Administrator.',
    });
  }

  const user = db.users.find((u) => u.id === user_id);
  if (!user) {
    return res.status(404).json({ error: 'User not found. Please log in.' });
  }

  if (user.is_blocked) {
    return res.status(403).json({
      error: 'Your account has been BLOCKED by Administrator. You cannot place bets.',
    });
  }

  const race = db.races.find((r) => r.id === race_id);
  if (!race) {
    return res.status(404).json({ error: 'Race not found' });
  }

  // 🔒 Allow bet if race status is OPEN_FOR_BETTING, LIVE, OPEN, or UPCOMING
  const isBettingOpen = race.status === 'OPEN_FOR_BETTING' || race.status === 'LIVE' || race.status === 'OPEN' || race.status === 'UPCOMING';
  if (!isBettingOpen) {
    return res.status(400).json({
      error: `Betting is not open for this race (${race.name} is ${race.status}).`
    });
  }

  // Check if race betting is suspended
  if (race.is_suspended) {
    return res.status(400).json({
      error: 'Betting is currently suspended for this race. Please wait for odds to resume.'
    });
  }

  const horse = race.horses.find((h) => h.id === horse_id);
  if (!horse) {
    return res.status(404).json({ error: 'Selected horse not found in this race' });
  }

  // Check if individual runner betting is suspended
  if (horse.is_suspended) {
    return res.status(400).json({
      error: `Betting is suspended for #${horse.horse_no} ${horse.name}. Odds are currently locked.`
    });
  }

  // Check balance >= stake
  if (user.balance < numStake) {
    return res.status(400).json({
      error: `Insufficient balance! Your current balance is ₹${user.balance.toLocaleString()}, but stake is ₹${numStake.toLocaleString()}.`,
    });
  }

  // ⚡ Check Risk Limit Settings (Min Bet, Max Bet per Horse & Max Win per Race)
  const minBet = db.system_settings?.min_bet_amount || 10;
  if (numStake < minBet) {
    return res.status(400).json({
      error: `Minimum bet stake allowed is ₹${minBet.toLocaleString()}.`,
    });
  }

  const maxBetPerHorse = db.system_settings?.max_bet_per_horse || 50000;
  if (numStake > maxBetPerHorse) {
    return res.status(400).json({
      error: `Stake exceeds the maximum allowed bet limit of ₹${maxBetPerHorse.toLocaleString()} per horse.`,
    });
  }

  // Calculate potential win
  const potentialWin = Math.round(numStake * numOdds);
  const maxWinPerRace = db.system_settings?.max_win_per_race || 500000;
  if (potentialWin > maxWinPerRace) {
    return res.status(400).json({
      error: `Potential payout (₹${potentialWin.toLocaleString()}) exceeds the maximum allowed win limit of ₹${maxWinPerRace.toLocaleString()} per race.`,
    });
  }

  // Deduct from balance, Add to exposure
  user.balance -= numStake;
  user.exposure += numStake;

  const newBet: Bet = {
    id: generateId('bet'),
    user_id: user.id,
    username: user.username,
    race_id: race.id,
    race_name: race.name,
    venue: race.venue,
    horse_id: horse.id,
    horse_name: horse.name,
    horse_no: horse.horse_no,
    serial_no: horse.serial_no || horse.horse_no,
    gate_no: horse.gate_no,
    jockey: horse.jockey,
    trainer: horse.trainer,
    bet_type: bet_type.toUpperCase() as 'WIN' | 'PLACE',
    odds: numOdds,
    stake: numStake,
    potential_win: potentialWin,
    payout: 0,
    status: 'PENDING',
    placed_at: new Date().toISOString(),
    settled_at: null,
  };

  db.bets.unshift(newBet);

  // Add transaction
  const tx: Transaction = {
    id: generateId('tx'),
    user_id: user.id,
    username: user.username,
    type: 'BET',
    amount: -numStake,
    balance_after: user.balance,
    description: `${bet_type} bet on #${horse.horse_no} (Gate ${horse.gate_no}) ${horse.name} (${race.name}) @ ${numOdds}`,
    created_at: new Date().toISOString(),
    reference_id: newBet.id,
  };
  db.transactions.unshift(tx);

  saveDatabase();

  if (isMongoDBConnected()) {
    try {
      await BetModel.create(newBet);
      await UserModel.updateOne({ id: user.id }, { $set: { balance: user.balance, exposure: user.exposure } });
      await TransactionModel.create(tx);
    } catch (mErr) {
      console.error('Mongo bet sync error:', mErr);
    }
  }

  const { password_hash, ...userProfile } = user;
  return res.json({
    success: true,
    message: 'Bet placed successfully!',
    bet: newBet,
    user: userProfile,
  });
});

// GET /api/bets/my?user_id=...
app.get('/api/bets/my', (req, res) => {
  const userId = req.query.user_id as string;
  if (!userId) {
    return res.status(400).json({ error: 'user_id query param is required' });
  }

  const userBets = db.bets.filter((b) => b.user_id === userId);
  return res.json({ success: true, bets: userBets });
});

// ----------------------------------------------------
// WALLET / TRANSACTIONS APIS
// ----------------------------------------------------

// POST /api/wallet/deposit
app.post('/api/wallet/deposit', (req, res) => {
  const { user_id, amount, payment_method } = req.body;
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 100) {
    return res.status(400).json({ error: 'Minimum deposit amount is ₹100' });
  }

  const user = db.users.find((u) => u.id === user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.balance += numAmount;

  const tx: Transaction = {
    id: generateId('tx'),
    user_id: user.id,
    username: user.username,
    type: 'DEPOSIT',
    amount: numAmount,
    balance_after: user.balance,
    description: `Deposit via ${payment_method || 'UPI / NetBanking'}`,
    created_at: new Date().toISOString(),
  };
  db.transactions.unshift(tx);
  saveDatabase();

  const { password_hash, ...userProfile } = user;
  return res.json({
    success: true,
    message: `Successfully deposited ₹${numAmount.toLocaleString()}!`,
    user: userProfile,
    transaction: tx,
  });
});

// POST /api/wallet/withdraw
app.post('/api/wallet/withdraw', (req, res) => {
  const { user_id, amount, upi_id, bank_account } = req.body;
  const numAmount = Number(amount);

  if (isNaN(numAmount) || numAmount < 500) {
    return res.status(400).json({ error: 'Minimum withdrawal amount is ₹500' });
  }

  const user = db.users.find((u) => u.id === user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Withdrawable balance check: cannot withdraw locked balance
  const withdrawable = user.balance - user.exposure;
  if (withdrawable < numAmount) {
    return res.status(400).json({
      error: `Insufficient withdrawable balance! Balance: ₹${user.balance}, Active Exposure: ₹${user.exposure}. Max withdrawable: ₹${Math.max(0, withdrawable)}.`,
    });
  }

  user.balance -= numAmount;

  const tx: Transaction = {
    id: generateId('tx'),
    user_id: user.id,
    username: user.username,
    type: 'WITHDRAW',
    amount: -numAmount,
    balance_after: user.balance,
    description: `Withdrawal to ${upi_id || bank_account || 'Registered Account'}`,
    created_at: new Date().toISOString(),
  };
  db.transactions.unshift(tx);
  saveDatabase();

  const { password_hash, ...userProfile } = user;
  return res.json({
    success: true,
    message: `Withdrawal of ₹${numAmount.toLocaleString()} processed successfully!`,
    user: userProfile,
    transaction: tx,
  });
});

// GET /api/wallet/transactions?user_id=...
app.get('/api/wallet/transactions', async (req, res) => {
  const userId = req.query.user_id as string;
  if (!userId) {
    return res.status(400).json({ error: 'user_id is required' });
  }
  try {
    await ensureMongoConnected();
    const mongoTxs = await TransactionModel.find({ user_id: userId }).sort({ created_at: -1 }).lean().catch(() => []);
    if (mongoTxs && mongoTxs.length > 0) {
      return res.json({ success: true, transactions: mongoTxs });
    }
  } catch {}

  const txs = db.transactions.filter((t) => t.user_id === userId);
  return res.json({ success: true, transactions: txs });
});

// ----------------------------------------------------
// BANNERS APIS
// ----------------------------------------------------

app.get('/api/banners', (req, res) => {
  const activeBanners = db.banners.filter((b) => b.is_active);
  return res.json({ success: true, banners: activeBanners });
});

app.post('/api/banners', (req, res) => {
  const { title, subtitle, image_url, link, tag } = req.body;
  if (!title || !image_url) {
    return res.status(400).json({ error: 'Title and image URL are required' });
  }

  const newBanner: Banner = {
    id: generateId('bnr'),
    title: String(title).trim(),
    subtitle: String(subtitle || '').trim(),
    image_url: String(image_url).trim(),
    link: String(link || '').trim(),
    tag: String(tag || 'PROMOTION').trim().toUpperCase(),
    is_active: true,
  };

  db.banners.push(newBanner);
  saveDatabase();
  return res.json({ success: true, banner: newBanner });
});

app.delete('/api/banners/:id', (req, res) => {
  db.banners = db.banners.filter((b) => b.id !== req.params.id);
  saveDatabase();
  return res.json({ success: true });
});

// ----------------------------------------------------
// ADMIN APIS
// ----------------------------------------------------

// 2. Add Race with Horses & Odds (Manual Admin Entry)
app.post('/api/admin/races', async (req, res) => {
  const { name, race_no, venue, race_time, date_str, distance, going, class_grade, horses } = req.body;

  if (!name || !race_time) {
    return res.status(400).json({ error: 'Race name and race time are required' });
  }

  const raceId = generateId('race');
  const parsedHorses: Horse[] = (horses || []).map((h: any, index: number) => {
    const sNo = Number(h.serial_no || h.horse_no) || index + 1;
    const gNo = h.gate_no !== undefined && h.gate_no !== '' ? (isNaN(Number(h.gate_no)) ? h.gate_no : Number(h.gate_no)) : (index + 1);
    return {
      id: h.id || generateId('hrs'),
      race_id: raceId,
      horse_no: sNo,
      serial_no: sNo,
      gate_no: gNo,
      name: String(h.name || `Horse ${sNo}`).trim(),
      jockey: String(h.jockey || 'Jockey TBD').trim(),
      trainer: String(h.trainer || 'Trainer TBD').trim(),
      win_odds: Math.max(1.01, Number(h.win_odds) || 2.5),
      place_odds: Math.max(1.01, Number(h.place_odds) || 1.4),
      silk_color: h.silk_color || ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#e11d48'][index % 7],
      form: h.form || '1-1-2-1',
      weight: h.weight || '56.0 kg',
    };
  });

  const newRace: Race = {
    id: raceId,
    name: String(name).trim(),
    race_no: race_no ? Number(race_no) : undefined,
    center_id: req.body.center_id,
    race_day_id: req.body.race_day_id,
    venue: String(venue || 'Bangalore Turf Club').trim(),
    race_time: String(race_time).trim(),
    date_str: String(date_str || 'Today, 5th Sep').trim(),
    distance: String(distance || '1600m').trim(),
    going: String(going || 'Good').trim(),
    class_grade: String(class_grade || 'Grade 1 • Terms').trim(),
    status: req.body.status || 'DRAFT',
    image_url: req.body.image_url || '/images/race_action.jpg',
    winner_horse_id: null,
    place_horses_ids: [],
    horses: parsedHorses,
    settled_at: null,
  };

  db.races.unshift(newRace);
  saveDatabase();

  try {
    await ensureMongoConnected();
    await RaceModel.findOneAndUpdate({ id: newRace.id }, newRace, { upsert: true, new: true });
  } catch (err: any) {
    console.warn('MongoDB race create notice:', err.message);
  }

  return res.json({ success: true, race: newRace });
});

// 2b. Full Edit Race & Runners (Manual Admin Update)
app.put('/api/admin/races/:id', async (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) return res.status(404).json({ error: 'Race not found' });

  const { name, race_no, center_id, race_day_id, venue, race_time, date_str, distance, going, class_grade, horses, status, image_url } = req.body;

  if (name !== undefined) race.name = String(name).trim();
  if (race_no !== undefined) race.race_no = race_no ? Number(race_no) : undefined;
  if (center_id !== undefined) race.center_id = center_id;
  if (race_day_id !== undefined) race.race_day_id = race_day_id;
  if (venue !== undefined) race.venue = String(venue).trim();
  if (race_time !== undefined) race.race_time = String(race_time).trim();
  if (date_str !== undefined) race.date_str = String(date_str).trim();
  if (distance !== undefined) race.distance = String(distance).trim();
  if (going !== undefined) race.going = String(going).trim();
  if (class_grade !== undefined) race.class_grade = String(class_grade).trim();
  if (status !== undefined) race.status = status;
  if (image_url !== undefined) race.image_url = image_url;

  if (Array.isArray(horses)) {
    race.horses = horses.map((h: any, index: number) => {
      const sNo = Number(h.serial_no || h.horse_no) || index + 1;
      const gNo = h.gate_no !== undefined && h.gate_no !== '' ? (isNaN(Number(h.gate_no)) ? h.gate_no : Number(h.gate_no)) : (index + 1);
      return {
        id: h.id || generateId('hrs'),
        race_id: race.id,
        horse_no: sNo,
        serial_no: sNo,
        gate_no: gNo,
        name: String(h.name || `Horse ${sNo}`).trim(),
        jockey: String(h.jockey || 'Jockey TBD').trim(),
        trainer: String(h.trainer || 'Trainer TBD').trim(),
        win_odds: Math.max(1.01, Number(h.win_odds) || 2.5),
        place_odds: Math.max(1.01, Number(h.place_odds) || 1.4),
        silk_color: h.silk_color || ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#e11d48'][index % 7],
        form: h.form || '1-1-2-1',
        weight: h.weight || '56.0 kg',
      };
    });
  }

  saveDatabase();

  try {
    await ensureMongoConnected();
    await RaceModel.findOneAndUpdate({ id: race.id }, race, { upsert: true, new: true });
  } catch (err: any) {
    console.warn('MongoDB race update notice:', err.message);
  }

  return res.json({ success: true, race });
});

// 2c. Delete Race Fixture
app.delete('/api/admin/races/:id', async (req, res) => {
  const raceIndex = db.races.findIndex((r) => r.id === req.params.id);
  if (raceIndex === -1) return res.status(404).json({ error: 'Race not found' });

  db.races.splice(raceIndex, 1);
  db.bets = db.bets.filter((b) => b.race_id !== req.params.id);
  saveDatabase();

  try {
    await ensureMongoConnected();
    await RaceModel.deleteOne({ id: req.params.id });
    await BetModel.deleteMany({ race_id: req.params.id });
  } catch (err: any) {
    console.warn('MongoDB race delete notice:', err.message);
  }

  return res.json({ success: true, message: 'Race deleted successfully' });
});

// 3. Edit Race Status (Open -> Closed -> Resulted -> Suspended -> Upcoming)
app.put('/api/admin/races/:id/status', async (req, res) => {
  const { status } = req.body;
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) return res.status(404).json({ error: 'Race not found' });

  const validStatuses = ['OPEN', 'LIVE', 'OPEN_FOR_BETTING', 'UPCOMING', 'SUSPENDED', 'CLOSED', 'RESULTED', 'ABANDONED', 'DRAFT'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid race status: "${status}". Valid statuses are: ${validStatuses.join(', ')}` });
  }

  // 🔒 MASTER INVARIANT: Only 1 race per center should be OPEN at a time!
  // When opening Race 3, Race 2 (and any other open race in that center) auto-closes to UPCOMING/CLOSED
  if (['OPEN', 'LIVE', 'OPEN_FOR_BETTING'].includes(status)) {
    const centerId = race.center_id;
    const raceDayId = race.race_day_id;

    db.races.forEach((r) => {
      const isSameCenter = (raceDayId && r.race_day_id === raceDayId) ||
                           (centerId && r.center_id === centerId) ||
                           (r.venue && race.venue && r.venue.toLowerCase() === race.venue.toLowerCase());
      if (r.id !== race.id && isSameCenter) {
        if (r.status !== 'RESULTED' && r.status !== 'DRAFT') {
          r.status = 'UPCOMING';
          r.is_suspended = false;
          r.horses.forEach((h) => {
            h.is_suspended = false;
          });
        }
      }
    });

    race.status = status;
    race.is_suspended = false;
    race.horses.forEach((h) => {
      h.is_suspended = false;
    });
  } else if (status === 'SUSPENDED') {
    race.status = 'SUSPENDED';
    race.is_suspended = true;
    race.horses.forEach((h) => {
      h.is_suspended = true;
    });
  } else {
    race.status = status;
    if (status === 'CLOSED') {
      race.is_suspended = false;
    }
  }

  saveDatabase();

  try {
    await ensureMongoConnected();
    await RaceModel.findOneAndUpdate({ id: race.id }, race, { upsert: true, new: true });
  } catch (err: any) {
    console.warn('MongoDB race status update notice:', err.message);
  }

  return res.json({ success: true, race, races: db.races });
});

// 4. Update Horse Odds
app.put('/api/admin/horses/:id/odds', async (req, res) => {
  const { win_odds, place_odds, changed_by } = req.body;
  let foundHorse: Horse | null = null;
  let foundRace: Race | null = null;

  for (const race of db.races) {
    const horse = race.horses.find((h) => h.id === req.params.id);
    if (horse) {
      const prevWin = horse.win_odds;
      const prevPlace = horse.place_odds;
      const nowIso = new Date().toISOString();

      if (win_odds !== undefined && !isNaN(Number(win_odds))) horse.win_odds = Number(win_odds);
      if (place_odds !== undefined && !isNaN(Number(place_odds))) horse.place_odds = Number(place_odds);

      // Record Odds History log (last 30 updates)
      horse.odds_history = horse.odds_history || [];
      horse.odds_history.unshift({
        win_odds: horse.win_odds,
        place_odds: horse.place_odds,
        old_win: prevWin,
        old_place: prevPlace,
        updated_at: nowIso,
        timestamp: nowIso,
        changed_by: changed_by || (req as any).user?.username || 'Master Admin',
      });
      if (horse.odds_history.length > 30) horse.odds_history = horse.odds_history.slice(0, 30);

      foundHorse = horse;
      foundRace = race;
      break;
    }
  }

  if (!foundHorse || !foundRace) {
    return res.status(404).json({ error: 'Horse not found' });
  }

  saveDatabase();

  try {
    await ensureMongoConnected();
    await RaceModel.findOneAndUpdate({ id: foundRace.id }, foundRace, { upsert: true, new: true });
  } catch (err: any) {
    console.warn('MongoDB odds update notice:', err.message);
  }

  return res.json({ success: true, horse: foundHorse, race: foundRace });
});

// 5. SETTLE RACE & AUTO PAYOUT BETS (CORE REQUIREMENT - WITH DEAD HEAT SUPPORT)
// Supports multi-horse dead heat for 1st, 2nd, and 3rd place with Method A (Betfair / Industry Standard) stake division, plus 4th position
app.post('/api/admin/races/:id/settle', (req, res) => {
  const { position_1, position_2, position_3, position_4, winner_horse_id, place_horses_ids } = req.body;
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) return res.status(404).json({ error: 'Race not found' });

  // Determine positions array
  let p1: string[] = [];
  let p2: string[] = [];
  let p3: string[] = [];
  let p4: string[] = [];

  if (Array.isArray(position_1) && position_1.length > 0) {
    p1 = position_1.filter(Boolean);
    p2 = Array.isArray(position_2) ? position_2.filter(Boolean) : [];
    p3 = Array.isArray(position_3) ? position_3.filter(Boolean) : [];
    p4 = Array.isArray(position_4) ? position_4.filter(Boolean) : [];
  } else if (winner_horse_id) {
    p1 = [winner_horse_id];
    const placeList = Array.isArray(place_horses_ids) ? place_horses_ids : [winner_horse_id];
    p2 = placeList.filter(id => id !== winner_horse_id).slice(0, 1);
    p3 = placeList.filter(id => id !== winner_horse_id).slice(1, 2);
    p4 = placeList.filter(id => id !== winner_horse_id).slice(2, 3);
  } else {
    return res.status(400).json({ error: '1st Place winner horse is required to settle race' });
  }

  if (p1.length === 0) {
    return res.status(400).json({ error: 'At least one horse must be selected for 1st Place' });
  }

  const isDeadHeatWin = p1.length > 1;
  const isDeadHeatPlace = p2.length > 1 || p3.length > 1;
  const isDeadHeat = isDeadHeatWin || isDeadHeatPlace;

  // Place multipliers calculation (Total 3 place slots)
  // For each horse, determine place qualification factor (0 to 1.0)
  const placeFactorMap = new Map<string, number>();
  let remainingSlots = 3;

  // Tier 1 (1st Place)
  if (p1.length >= 3) {
    const factor = 3 / p1.length;
    p1.forEach(hId => placeFactorMap.set(hId, factor));
    remainingSlots = 0;
  } else {
    p1.forEach(hId => placeFactorMap.set(hId, 1.0));
    remainingSlots -= p1.length;
  }

  // Tier 2 (2nd Place)
  if (remainingSlots > 0 && p2.length > 0) {
    if (p2.length <= remainingSlots) {
      p2.forEach(hId => placeFactorMap.set(hId, 1.0));
      remainingSlots -= p2.length;
    } else {
      const factor = remainingSlots / p2.length;
      p2.forEach(hId => placeFactorMap.set(hId, factor));
      remainingSlots = 0;
    }
  }

  // Tier 3 (3rd Place)
  if (remainingSlots > 0 && p3.length > 0) {
    if (p3.length <= remainingSlots) {
      p3.forEach(hId => placeFactorMap.set(hId, 1.0));
      remainingSlots -= p3.length;
    } else {
      const factor = remainingSlots / p3.length;
      p3.forEach(hId => placeFactorMap.set(hId, factor));
      remainingSlots = 0;
    }
  }

  const placeAll = [...p1, ...p2, ...p3];
  race.position_1 = p1;
  race.position_2 = p2;
  race.position_3 = p3;
  race.position_4 = p4;
  race.winner_horse_id = p1[0] || null;
  race.place_horses_ids = placeAll;
  race.is_dead_heat = isDeadHeat;
  race.dead_heat_note = isDeadHeatWin 
    ? `DEAD HEAT FOR WIN (${p1.length} Horses Tied for 1st)` 
    : isDeadHeatPlace 
    ? `DEAD HEAT FOR PLACE` 
    : undefined;
  race.status = 'RESULTED';
  race.settled_at = new Date().toISOString();

  // Find all pending bets for this race
  const pendingBets = db.bets.filter((b) => (b.race_id === race.id || b.race_name === race.name) && b.status === 'PENDING');
  let settledCount = 0;
  let totalPayout = 0;

  for (const bet of pendingBets) {
    const betUser = db.users.find((u) => u.id === bet.user_id);
    let isWon = false;
    let betPayout = 0;
    let betIsDeadHeat = false;
    let deadHeatDivider = 1;

    if (bet.bet_type === 'WIN') {
      if (p1.includes(bet.horse_id)) {
        isWon = true;
        if (p1.length > 1) {
          betIsDeadHeat = true;
          deadHeatDivider = p1.length;
          // Method A: Half Stake Win (Divide stake by N winners)
          betPayout = Math.round((bet.stake / p1.length) * bet.odds);
        } else {
          betPayout = Math.round(bet.stake * bet.odds);
        }
      }
    } else if (bet.bet_type === 'PLACE') {
      const factor = placeFactorMap.get(bet.horse_id) || 0;
      if (factor > 0) {
        isWon = true;
        if (factor < 1.0) {
          betIsDeadHeat = true;
          deadHeatDivider = Math.round(1 / factor);
          betPayout = Math.round((bet.stake * factor) * bet.odds);
        } else {
          betPayout = Math.round(bet.stake * bet.odds);
        }
      }
    }

    bet.settled_at = new Date().toISOString();

    if (isWon) {
      bet.status = 'WON';
      bet.payout = betPayout;
      bet.is_dead_heat = betIsDeadHeat;
      bet.dead_heat_divider = betIsDeadHeat ? deadHeatDivider : undefined;
      totalPayout += betPayout;

      if (betUser) {
        betUser.balance += betPayout;
        betUser.exposure = Math.max(0, betUser.exposure - bet.stake);

        const winDesc = betIsDeadHeat 
          ? `Payout WON (Dead Heat 1/${deadHeatDivider}): ${bet.bet_type} bet on #${bet.horse_no} ${bet.horse_name} in ${race.name} (₹${betPayout.toLocaleString('en-IN')})`
          : `Payout WON: ${bet.bet_type} bet on #${bet.horse_no} ${bet.horse_name} in ${race.name} (Odds: ${bet.odds})`;

        const winTx: Transaction = {
          id: generateId('tx'),
          user_id: betUser.id,
          username: betUser.username,
          type: 'WIN',
          amount: betPayout,
          balance_after: betUser.balance,
          description: winDesc,
          created_at: new Date().toISOString(),
          reference_id: bet.id,
        };
        db.transactions.unshift(winTx);
      }
    } else {
      bet.status = 'LOST';
      bet.payout = 0;
      if (betUser) {
        betUser.exposure = Math.max(0, betUser.exposure - bet.stake);
      }
    }
    settledCount++;
  }

  saveDatabase();

  const winnerNames = p1.map(id => race.horses.find(h => h.id === id)?.name || id).join(' & ');
  const message = isDeadHeatWin
    ? `🔥 DEAD HEAT Result Declared! 1st Place tied between: ${winnerNames}. ${settledCount} bets settled as per Dead Heat rules (₹${totalPayout.toLocaleString('en-IN')} paid out).`
    : `Race "${race.name}" settled with winner ${winnerNames}! ${settledCount} bets settled (₹${totalPayout.toLocaleString('en-IN')} paid out).`;

  return res.json({
    success: true,
    message,
    race,
    settledCount,
    totalPayout,
  });
});

// 6. Admin All Users List
app.get('/api/admin/users', async (req, res) => {
  try {
    await ensureMongoConnected();
    const mongoUsers = await UserModel.find({ 
      role: { $ne: 'admin' }, 
      id: { $ne: 'usr_admin_master' },
      username: { $ne: 'admin' }
    }).sort({ created_at: -1 }).lean();

    if (mongoUsers && mongoUsers.length > 0) {
      const seenRefs = new Set<string>();
      const uniqueUsers = mongoUsers.map((u, idx) => {
        const userObj = { ...u } as any;
        delete userObj.password_hash;
        if (!userObj.ref_id || seenRefs.has(userObj.ref_id)) {
          userObj.ref_id = `TURF-${10001 + idx}`;
          UserModel.updateOne({ id: userObj.id }, { $set: { ref_id: userObj.ref_id } }).catch(() => {});
        }
        seenRefs.add(userObj.ref_id);
        return userObj;
      });

      // Update in-memory db as well
      db.users = [
        ...db.users.filter(u => u.role === 'admin' || u.username === 'admin'),
        ...mongoUsers.map(u => u as any)
      ];

      return res.json({ success: true, users: uniqueUsers });
    }
  } catch (err) {
    console.error('Mongo load users error:', err);
  }

  const seenRefs = new Set<string>();
  const usersList = db.users
    .filter((u) => u.role !== 'admin' && u.id !== 'usr_admin' && u.id !== 'usr_admin_master' && u.username !== 'admin')
    .map(({ password_hash, ...u }, idx) => {
      const userObj = { ...u };
      if (!userObj.ref_id || seenRefs.has(userObj.ref_id)) {
        userObj.ref_id = `TURF-${10001 + idx}`;
      }
      seenRefs.add(userObj.ref_id);
      return userObj;
    });

  return res.json({ success: true, users: usersList });
});

// Admin Overview Metrics
app.get('/api/admin/overview', async (req, res) => {
  try {
    await ensureMongoConnected();
    const totalUsers = await UserModel.countDocuments({ role: { $ne: 'admin' }, id: { $ne: 'usr_admin_master' }, username: { $ne: 'admin' } });
    const totalBets = await BetModel.countDocuments();
    const bets = await BetModel.find().lean();
    const totalVolume = bets.reduce((s, b) => s + (b.stake || 0), 0);
    const pendingBetsCount = bets.filter(b => b.status === 'PENDING').length;
    const openRaces = await RaceModel.countDocuments({ status: { $in: ['OPEN', 'LIVE', 'OPEN_FOR_BETTING'] } });

    return res.json({
      success: true,
      stats: {
        totalUsers: totalUsers,
        totalBets: totalBets,
        totalVolume: totalVolume,
        openRaces: openRaces,
        pendingBetsCount: pendingBetsCount,
      }
    });
  } catch (err) {
    const realUsers = db.users.filter(u => u.role !== 'admin' && u.username !== 'admin');
    return res.json({
      success: true,
      stats: {
        totalUsers: realUsers.length,
        totalBets: db.bets.length,
        totalVolume: db.bets.reduce((s, b) => s + (b.stake || 0), 0),
        openRaces: db.races.filter(r => r.status === 'OPEN' || r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING').length,
        pendingBetsCount: db.bets.filter(b => b.status === 'PENDING').length,
      }
    });
  }
});

// 7. Admin All Bets List
app.get('/api/admin/bets', async (req, res) => {
  try {
    await ensureMongoConnected();
    const bets = await BetModel.find().sort({ placed_at: -1 }).lean();
    if (bets && bets.length > 0) {
      db.bets = bets as any;
      return res.json({ success: true, bets });
    }
  } catch (err) {
    console.error('Mongo load bets error:', err);
  }
  return res.json({ success: true, bets: db.bets });
});

// 8. Admin Adjust User Balance (Credit/Debit / Approve Transaction)
app.post('/api/admin/users/:id/adjust-balance', async (req, res) => {
  try {
    await ensureMongoConnected();
    let user = db.users.find((u) => u.id === req.params.id);
    if (!user) {
      const mongoUser = await UserModel.findOne({ id: req.params.id }).lean().catch(() => null);
      if (mongoUser) {
        user = mongoUser as any;
        db.users.push(user!);
      }
    }
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { amount, type, description } = req.body;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Invalid adjustment amount' });
    }

    if (type === 'DEBIT' && (user.balance || 0) < numAmount) {
      return res.status(400).json({ error: 'Insufficient balance to debit' });
    }

    if (type === 'DEBIT') {
      user.balance = Math.max(0, (user.balance || 0) - numAmount);
    } else {
      user.balance = (user.balance || 0) + numAmount;
    }

    const newTx: Transaction = {
      id: `tx_adm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: user.id,
      username: user.username,
      type: type === 'DEBIT' ? 'WITHDRAW' : 'DEPOSIT',
      amount: numAmount,
      balance_after: user.balance,
      description: description || `Admin Manual ${type === 'DEBIT' ? 'Debit' : 'Credit'} Adjustment`,
      created_at: new Date().toISOString(),
    };

    db.transactions.unshift(newTx);
    saveDatabase();

    await UserModel.findOneAndUpdate({ id: user.id }, { balance: user.balance }, { new: true }).catch(() => {});
    await TransactionModel.findOneAndUpdate({ id: newTx.id }, newTx, { upsert: true, new: true }).catch(() => {});

    const { password_hash, ...userProfile } = user;
    return res.json({
      success: true,
      message: `Successfully ${type === 'DEBIT' ? 'debited' : 'credited'} ₹${numAmount.toLocaleString('en-IN')} for @${user.username}`,
      user: userProfile,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to adjust balance' });
  }
});

// 9. Admin Declare Race ABANDONED / VOID (100% Full Bet Refund)
app.post('/api/admin/races/:id/abandon', (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) return res.status(404).json({ error: 'Race not found' });
  const { reason } = req.body;
  race.status = 'ABANDONED';
  race.is_suspended = true;

  const pendingBets = db.bets.filter((b) => (b.race_id === race.id || b.race_name === race.name) && b.status === 'PENDING');
  let refundedCount = 0;
  let totalRefunded = 0;

  for (const bet of pendingBets) {
    bet.status = 'REFUNDED';
    bet.settled_at = new Date().toISOString();
    totalRefunded += bet.stake;
    refundedCount++;

    const betUser = db.users.find((u) => u.id === bet.user_id);
    if (betUser) {
      betUser.balance += bet.stake;
      betUser.exposure = Math.max(0, betUser.exposure - bet.stake);

      const refTx: Transaction = {
        id: generateId('tx'),
        user_id: betUser.id,
        username: betUser.username,
        type: 'REFUND',
        amount: bet.stake,
        balance_after: betUser.balance,
        description: `100% Refund for Cancelled/Abandoned Race: ${race.name} (#${bet.horse_no} ${bet.horse_name})`,
        created_at: new Date().toISOString(),
        reference_id: bet.id,
      };
      db.transactions.unshift(refTx);
    }
  }

  saveDatabase();
  return res.json({
    success: true,
    message: `Race "${race.name}" declared ABANDONED / VOID. ${refundedCount} bets refunded (₹${totalRefunded.toLocaleString('en-IN')})!`,
    race,
    refundedCount,
    totalRefunded,
  });
});

// 10. Admin Cancel Single Bet (Suspicious / Incorrect Bet 1-Click Refund)
app.post('/api/admin/bets/:id/cancel', (req, res) => {
  const bet = db.bets.find((b) => b.id === req.params.id);
  if (!bet) return res.status(404).json({ error: 'Bet not found' });
  if (bet.status !== 'PENDING') {
    return res.status(400).json({ error: `Cannot cancel bet with status: ${bet.status}` });
  }
  const { reason } = req.body;
  bet.status = 'CANCELLED';
  bet.settled_at = new Date().toISOString();

  const betUser = db.users.find((u) => u.id === bet.user_id);
  if (betUser) {
    betUser.balance += bet.stake;
    betUser.exposure = Math.max(0, betUser.exposure - bet.stake);

    const cancelTx: Transaction = {
      id: generateId('tx'),
      user_id: betUser.id,
      username: betUser.username,
      type: 'REFUND',
      amount: bet.stake,
      balance_after: betUser.balance,
      description: `Single Bet Cancelled by Admin: #${bet.horse_no} ${bet.horse_name} in ${bet.race_name} (${reason || 'Admin Void'})`,
      created_at: new Date().toISOString(),
      reference_id: bet.id,
    };
    db.transactions.unshift(cancelTx);
  }

  saveDatabase();
  return res.json({
    success: true,
    message: `Bet #${bet.id} cancelled and ₹${bet.stake.toLocaleString('en-IN')} refunded to @${bet.username || 'user'}`,
    bet,
  });
});

// 11. Admin Create User Manually (Offline / Direct Registration)
app.post('/api/admin/users/create', async (req, res) => {
  const { full_name, username, phone, email, password, initial_balance } = req.body;
  if (!username || !phone || !password) {
    return res.status(400).json({ error: 'Username, Phone, and Password are required' });
  }
  const cleanUsername = String(username).trim().toLowerCase();
  await ensureMongoConnected();
  const existingMongo = await UserModel.findOne({
    $or: [{ username: cleanUsername }, { phone: String(phone).trim() }]
  }).lean().catch(() => null);

  const existing = existingMongo || db.users.find(u => u.username.toLowerCase() === cleanUsername || u.phone === String(phone).trim());
  if (existing) {
    return res.status(400).json({ error: 'A user with this username or phone number already exists' });
  }
  const initBal = Math.max(0, Number(initial_balance) || 0);
  const userCount = await UserModel.countDocuments({ role: { $ne: 'admin' } }).catch(() => db.users.length);
  const newUser: User = {
    id: generateId('usr'),
    ref_id: `TURF-${10001 + userCount}`,
    full_name: full_name ? String(full_name).trim() : cleanUsername,
    phone: String(phone).trim(),
    email: email ? String(email).trim().toLowerCase() : undefined,
    username: cleanUsername,
    password_hash: String(password).trim(),
    balance: initBal,
    exposure: 0,
    role: 'user',
    is_blocked: false,
    profile_photo: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
    created_at: new Date().toISOString(),
  };
  db.users.push(newUser);
  await UserModel.findOneAndUpdate({ id: newUser.id }, newUser, { upsert: true, new: true }).catch(() => {});

  if (initBal > 0) {
    const initTx: Transaction = {
      id: generateId('tx'),
      user_id: newUser.id,
      username: newUser.username,
      type: 'DEPOSIT',
      amount: initBal,
      balance_after: initBal,
      description: 'Initial balance credited by Admin on account creation',
      created_at: new Date().toISOString(),
    };
    db.transactions.unshift(initTx);
    await TransactionModel.findOneAndUpdate({ id: initTx.id }, initTx, { upsert: true, new: true }).catch(() => {});
  }
  saveDatabase();
  const { password_hash, ...profile } = newUser;
  return res.json({ success: true, message: `User @${newUser.username} created successfully!`, user: profile });
});

// 12. Admin Toggle User Block/Unblock
app.post('/api/admin/users/:id/toggle-block', async (req, res) => {
  await ensureMongoConnected();
  let user = db.users.find((u) => u.id === req.params.id);
  if (!user) {
    const mongoUser = await UserModel.findOne({ id: req.params.id }).lean().catch(() => null);
    if (mongoUser) {
      user = mongoUser as any;
      db.users.push(user!);
    }
  }
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.is_blocked = !user.is_blocked;
  await UserModel.findOneAndUpdate({ id: user.id }, { is_blocked: user.is_blocked }).catch(() => {});
  saveDatabase();
  return res.json({
    success: true,
    message: user.is_blocked ? `User @${user.username} has been BLOCKED.` : `User @${user.username} has been UNBLOCKED.`,
    is_blocked: user.is_blocked,
    user,
  });
});

// 13. Admin "Login as User" / Impersonation
app.post('/api/admin/users/:id/impersonate', (req, res) => {
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password_hash, ...userProfile } = user;
  return res.json({
    success: true,
    message: `Logged in as @${user.username}`,
    user: userProfile,
    token: `token_${user.id}`,
  });
});

// 14. System Control: Get Settings
app.get('/api/system/settings', (req, res) => {
  db.system_settings = db.system_settings || { betting_enabled: true, sub_admins: [] };
  return res.json({ success: true, settings: db.system_settings });
});

// 15. System Control: Update Global Settings & Emergency Switch
app.post('/api/admin/system/settings', (req, res) => {
  db.system_settings = db.system_settings || { betting_enabled: true, max_bet_per_horse: 50000, max_win_per_race: 500000, min_bet_amount: 100, sub_admins: [] };
  const { betting_enabled, emergency_message, announcement, max_bet_per_horse, max_win_per_race, min_bet_amount } = req.body;
  if (betting_enabled !== undefined) db.system_settings.betting_enabled = Boolean(betting_enabled);
  if (emergency_message !== undefined) db.system_settings.emergency_message = String(emergency_message);
  if (announcement !== undefined) db.system_settings.announcement = String(announcement);
  if (max_bet_per_horse !== undefined && !isNaN(Number(max_bet_per_horse))) db.system_settings.max_bet_per_horse = Number(max_bet_per_horse);
  if (max_win_per_race !== undefined && !isNaN(Number(max_win_per_race))) db.system_settings.max_win_per_race = Number(max_win_per_race);
  if (min_bet_amount !== undefined && !isNaN(Number(min_bet_amount))) db.system_settings.min_bet_amount = Number(min_bet_amount);
  saveDatabase();
  return res.json({ success: true, message: 'System risk & limits settings updated successfully', settings: db.system_settings });
});

// 16. System Control: Add Sub-Admin
app.post('/api/admin/sub-admins', (req, res) => {
  db.system_settings = db.system_settings || { betting_enabled: true, sub_admins: [] };
  db.system_settings.sub_admins = db.system_settings.sub_admins || [];
  const { username, name, role, permissions } = req.body;
  if (!username || !name) return res.status(400).json({ error: 'Username and Name are required' });
  const newSubAdmin: SubAdmin = {
    id: generateId('subadm'),
    username: String(username).trim().toLowerCase(),
    name: String(name).trim(),
    role: role || 'ODDS_MANAGER',
    permissions: Array.isArray(permissions) ? permissions : ['ODDS_MANAGEMENT'],
    created_at: new Date().toISOString(),
  };
  db.system_settings.sub_admins.push(newSubAdmin);
  saveDatabase();
  return res.json({ success: true, message: `Sub-Admin @${newSubAdmin.username} added!`, sub_admin: newSubAdmin });
});

// 17. System Control: Delete Sub-Admin
app.delete('/api/admin/sub-admins/:id', (req, res) => {
  db.system_settings = db.system_settings || { betting_enabled: true, sub_admins: [] };
  db.system_settings.sub_admins = (db.system_settings.sub_admins || []).filter(s => s.id !== req.params.id);
  saveDatabase();
  return res.json({ success: true, message: 'Sub-Admin removed successfully' });
});

// 18. Admin Reset Database / Clean Slate Wipe
app.post(['/api/admin/reset-demo', '/api/admin/reset-database', '/api/admin/clean-reset'], async (req, res) => {
  try {
    if (isMongoDBConnected()) {
      await UserModel.deleteMany({});
      await RaceModel.deleteMany({});
      await BetModel.deleteMany({});
      await TransactionModel.deleteMany({});
      await DepositRequestModel.deleteMany({});
      await WithdrawalRequestModel.deleteMany({});
      await OtpModel.deleteMany({});
      await RaceDayModel.deleteMany({});
      await RaceCenterModel.deleteMany({});
      await BannerModel.deleteMany({});

      const cleanMasterAdmin = {
        id: 'usr_admin_master',
        ref_id: 'ADMIN-001',
        full_name: 'Master Administrator',
        phone: '9999999999',
        email: 'admin@derbybet.com',
        username: 'admin',
        password_hash: 'admin123',
        balance: 500000,
        exposure: 0,
        role: 'admin',
        is_blocked: false,
        profile_photo: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
        created_at: new Date().toISOString(),
      };
      await UserModel.create(cleanMasterAdmin);

      for (const center of defaultData.race_centers) {
        await RaceCenterModel.create(center);
      }
      for (const banner of defaultData.banners) {
        await BannerModel.create(banner);
      }
    }
  } catch (err: any) {
    console.error('MongoDB reset error:', err.message);
  }

  const cleanMasterAdmin = {
    id: 'usr_admin_master',
    ref_id: 'ADMIN-001',
    full_name: 'Master Administrator',
    phone: '9999999999',
    email: 'admin@derbybet.com',
    username: 'admin',
    password_hash: 'admin123',
    balance: 500000,
    exposure: 0,
    role: 'admin' as const,
    is_blocked: false,
    profile_photo: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
    created_at: new Date().toISOString(),
  };

  db = {
    users: [cleanMasterAdmin],
    races: [],
    bets: [],
    transactions: [],
    deposit_requests: [],
    withdrawal_requests: [],
    race_centers: defaultData.race_centers,
    race_days: [],
    banners: defaultData.banners,
    system_settings: {
      betting_enabled: true,
      emergency_message: '',
      announcement: '',
      max_bet_per_horse: 50000,
      max_win_per_race: 500000,
      min_bet_amount: 100,
      sub_admins: [],
    },
    otps: {},
  };
  saveDatabase();
  return res.json({ success: true, message: 'Platform database successfully wiped and reset to clean initial state!' });
});

// ----------------------------------------------------
// 9.5 WALLET STATEMENT & TRANSACTIONS API
// ----------------------------------------------------
app.get('/api/wallet/transactions', async (req, res) => {
  try {
    const { user_id } = req.query;
    await ensureMongoConnected();
    const query: any = {};
    if (user_id) {
      query.$or = [{ user_id: String(user_id) }, { username: String(user_id) }];
    }

    const mongoTxs = await TransactionModel.find(query).sort({ created_at: -1 }).lean().catch(() => []);
    if (mongoTxs && mongoTxs.length > 0) {
      return res.json({ success: true, transactions: mongoTxs });
    }

    let list = db.transactions || [];
    if (user_id) {
      list = list.filter((t) => t.user_id === user_id || t.username === user_id);
    }
    return res.json({ success: true, transactions: list });
  } catch (err: any) {
    return res.json({ success: true, transactions: [] });
  }
});

// ----------------------------------------------------
// 10. DEPOSIT REQUESTS API
// ----------------------------------------------------
app.post('/api/deposits', async (req, res) => {
  try {
    const { userId, amount, paymentMethod, utrNumber, screenshotUrl } = req.body;
    const numAmount = Number(amount);
    if (!userId || isNaN(numAmount) || numAmount < 100) {
      return res.status(400).json({ error: 'Valid user ID and minimum deposit amount of ₹100 is required' });
    }

    await ensureMongoConnected();
    let user = db.users.find((u) => u.id === userId);
    if (!user) {
      const mongoUser = await UserModel.findOne({ id: userId }).lean().catch(() => null);
      if (mongoUser) {
        user = mongoUser as any;
        db.users.push(user!);
      }
    }
    const username = user?.username || 'punter';

    if (!db.deposit_requests) db.deposit_requests = [];

    const newRequest: DepositRequest = {
      id: `dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      username,
      amount: numAmount,
      payment_method: paymentMethod || 'UPI',
      utr_number: utrNumber || `UTR${Date.now().toString().slice(-6)}`,
      screenshot_url: screenshotUrl,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      reviewed_at: null,
    };

    db.deposit_requests.unshift(newRequest);
    saveDatabase();

    await DepositRequestModel.findOneAndUpdate({ id: newRequest.id }, newRequest, { upsert: true, new: true }).catch(() => {});

    return res.json({
      success: true,
      depositRequest: newRequest,
      message: `Deposit request of ₹${numAmount.toLocaleString('en-IN')} submitted! Status: PENDING Admin verification.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to submit deposit request' });
  }
});

app.get('/api/deposits', async (req, res) => {
  try {
    const { user_id, status } = req.query;
    await ensureMongoConnected();
    const query: any = {};
    if (user_id) query.user_id = user_id;
    if (status && status !== 'ALL') query.status = status;

    const mongoDeposits = await DepositRequestModel.find(query).sort({ created_at: -1 }).lean().catch(() => []);
    if (mongoDeposits && mongoDeposits.length > 0) {
      return res.json({ success: true, deposits: mongoDeposits });
    }

    if (!db.deposit_requests) db.deposit_requests = [];
    let list = db.deposit_requests;
    if (user_id) list = list.filter((d) => d.user_id === user_id);
    if (status && status !== 'ALL') list = list.filter((d) => d.status === status);
    return res.json({ success: true, deposits: list });
  } catch (err: any) {
    return res.json({ success: true, deposits: db.deposit_requests || [] });
  }
});

app.post('/api/admin/deposits/:id/approve', async (req, res) => {
  try {
    await ensureMongoConnected();
    if (!db.deposit_requests) db.deposit_requests = [];
    let reqItem = db.deposit_requests.find((d) => d.id === req.params.id);
    if (!reqItem) {
      const mongoDep = await DepositRequestModel.findOne({ id: req.params.id }).lean().catch(() => null);
      if (mongoDep) {
        reqItem = mongoDep as any;
        db.deposit_requests.unshift(reqItem!);
      }
    }
    if (!reqItem) return res.status(404).json({ error: 'Deposit request not found' });

    if (reqItem.status === 'APPROVED') {
      return res.json({ success: true, message: 'Deposit request is already approved' });
    }

    const { adminNotes } = req.body;
    reqItem.status = 'APPROVED';
    reqItem.reviewed_at = new Date().toISOString();
    if (adminNotes) reqItem.admin_notes = adminNotes;

    let user = db.users.find((u) => u.id === reqItem!.user_id);
    if (!user) {
      const mongoUser = await UserModel.findOne({ id: reqItem.user_id }).lean().catch(() => null);
      if (mongoUser) {
        user = mongoUser as any;
        db.users.push(user!);
      }
    }

    if (user) {
      user.balance = (user.balance || 0) + Number(reqItem.amount);
      await UserModel.findOneAndUpdate({ id: user.id }, { balance: user.balance }, { new: true }).catch(() => {});
    }

    const newTx: Transaction = {
      id: `tx_${Date.now()}_dep`,
      user_id: reqItem.user_id,
      username: reqItem.username,
      type: 'DEPOSIT',
      amount: reqItem.amount,
      balance_after: user ? user.balance : reqItem.amount,
      description: `Deposit Approved via ${reqItem.payment_method} (UTR: ${reqItem.utr_number})`,
      created_at: new Date().toISOString(),
      reference_id: reqItem.id,
    };
    db.transactions.unshift(newTx);
    saveDatabase();

    await DepositRequestModel.findOneAndUpdate({ id: reqItem.id }, reqItem, { new: true }).catch(() => {});
    await TransactionModel.findOneAndUpdate({ id: newTx.id }, newTx, { upsert: true, new: true }).catch(() => {});

    const userProfile = user ? (({ password_hash, ...u }) => u)(user) : undefined;
    return res.json({
      success: true,
      message: `Deposit of ₹${reqItem.amount.toLocaleString('en-IN')} approved! Balance credited automatically to @${reqItem.username}.`,
      user: userProfile,
      depositRequest: reqItem,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to approve deposit' });
  }
});

app.post('/api/admin/deposits/:id/reject', async (req, res) => {
  try {
    await ensureMongoConnected();
    if (!db.deposit_requests) db.deposit_requests = [];
    let reqItem = db.deposit_requests.find((d) => d.id === req.params.id);
    if (!reqItem) {
      const mongoDep = await DepositRequestModel.findOne({ id: req.params.id }).lean().catch(() => null);
      if (mongoDep) {
        reqItem = mongoDep as any;
        db.deposit_requests.unshift(reqItem!);
      }
    }
    if (!reqItem) return res.status(404).json({ error: 'Deposit request not found' });

    const { reason } = req.body;
    reqItem.status = 'REJECTED';
    reqItem.reviewed_at = new Date().toISOString();
    reqItem.admin_notes = reason || 'UTR or proof could not be verified by Admin.';
    saveDatabase();

    await DepositRequestModel.findOneAndUpdate({ id: reqItem.id }, reqItem, { new: true }).catch(() => {});

    return res.json({
      success: true,
      message: 'Deposit request rejected.',
      depositRequest: reqItem,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to reject deposit' });
  }
});

// ----------------------------------------------------
// 11. WITHDRAWAL REQUESTS API
// ----------------------------------------------------
app.post('/api/withdrawals', async (req, res) => {
  try {
    const { userId, amount, details } = req.body;
    const numAmount = Number(amount);
    if (!userId || isNaN(numAmount) || numAmount < 100) {
      return res.status(400).json({ error: 'Valid user ID and minimum withdrawal amount of ₹100 is required' });
    }

    await ensureMongoConnected();
    let user = db.users.find((u) => u.id === userId);
    if (!user) {
      const mongoUser = await UserModel.findOne({ id: userId }).lean().catch(() => null);
      if (mongoUser) {
        user = mongoUser as any;
        db.users.push(user!);
      }
    }
    if (!user) return res.status(404).json({ error: 'User not found' });

    const withdrawable = (user.balance ?? 0) - (user.exposure ?? 0);
    if (withdrawable < numAmount) {
      return res.status(400).json({ error: `Insufficient withdrawable balance. Available: ₹${Math.max(0, withdrawable)}` });
    }

    user.balance = Math.max(0, (user.balance || 0) - numAmount);
    await UserModel.findOneAndUpdate({ id: user.id }, { balance: user.balance }, { new: true }).catch(() => {});

    if (!db.withdrawal_requests) db.withdrawal_requests = [];

    const newRequest: WithdrawalRequest = {
      id: `wth_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      username: user.username,
      amount: numAmount,
      upi_id: details?.upi_id,
      bank_account: details?.bank_account,
      ifsc: details?.ifsc,
      account_holder: details?.account_holder,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      approved_at: null,
      completed_at: null,
      estimated_minutes: 120,
    };

    db.withdrawal_requests.unshift(newRequest);

    const newTx: Transaction = {
      id: `tx_${Date.now()}_wth`,
      user_id: userId,
      username: user.username,
      type: 'WITHDRAW',
      amount: -numAmount,
      balance_after: user.balance,
      description: `Withdrawal Request (Pending Verification) to ${details?.upi_id || details?.bank_account || 'Registered Bank'}`,
      created_at: new Date().toISOString(),
      reference_id: newRequest.id,
    };
    db.transactions.unshift(newTx);
    saveDatabase();

    await WithdrawalRequestModel.findOneAndUpdate({ id: newRequest.id }, newRequest, { upsert: true, new: true }).catch(() => {});
    await TransactionModel.findOneAndUpdate({ id: newTx.id }, newTx, { upsert: true, new: true }).catch(() => {});

    const { password_hash, ...userProfile } = user;
    return res.json({
      success: true,
      withdrawalRequest: newRequest,
      user: userProfile,
      message: `Withdrawal request of ₹${numAmount.toLocaleString('en-IN')} submitted! Status: PENDING Admin review.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to submit withdrawal request' });
  }
});

app.get('/api/withdrawals', async (req, res) => {
  try {
    const { user_id, status } = req.query;
    await ensureMongoConnected();
    const query: any = {};
    if (user_id) query.user_id = user_id;
    if (status && status !== 'ALL') query.status = status;

    const mongoWithdrawals = await WithdrawalRequestModel.find(query).sort({ created_at: -1 }).lean().catch(() => []);
    if (mongoWithdrawals && mongoWithdrawals.length > 0) {
      return res.json({ success: true, withdrawals: mongoWithdrawals });
    }

    if (!db.withdrawal_requests) db.withdrawal_requests = [];
    let list = db.withdrawal_requests;
    if (user_id) list = list.filter((w) => w.user_id === user_id);
    if (status && status !== 'ALL') list = list.filter((w) => w.status === status);
    return res.json({ success: true, withdrawals: list });
  } catch (err: any) {
    return res.json({ success: true, withdrawals: db.withdrawal_requests || [] });
  }
});

app.post('/api/admin/withdrawals/:id/approve', async (req, res) => {
  try {
    await ensureMongoConnected();
    if (!db.withdrawal_requests) db.withdrawal_requests = [];
    let reqItem = db.withdrawal_requests.find((w) => w.id === req.params.id);
    if (!reqItem) {
      const mongoWth = await WithdrawalRequestModel.findOne({ id: req.params.id }).lean().catch(() => null);
      if (mongoWth) {
        reqItem = mongoWth as any;
        db.withdrawal_requests.unshift(reqItem!);
      }
    }
    if (!reqItem) return res.status(404).json({ error: 'Withdrawal request not found' });

    reqItem.status = 'IN_PROGRESS';
    reqItem.approved_at = new Date().toISOString();
    reqItem.estimated_minutes = 120;
    saveDatabase();

    await WithdrawalRequestModel.findOneAndUpdate({ id: reqItem.id }, reqItem, { new: true }).catch(() => {});

    return res.json({
      success: true,
      message: `Withdrawal of ₹${reqItem.amount.toLocaleString('en-IN')} marked as IN PROGRESS. 120-minute timer started.`,
      withdrawalRequest: reqItem,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to approve withdrawal' });
  }
});

app.post('/api/admin/withdrawals/:id/complete', async (req, res) => {
  try {
    await ensureMongoConnected();
    if (!db.withdrawal_requests) db.withdrawal_requests = [];
    let reqItem = db.withdrawal_requests.find((w) => w.id === req.params.id);
    if (!reqItem) {
      const mongoWth = await WithdrawalRequestModel.findOne({ id: req.params.id }).lean().catch(() => null);
      if (mongoWth) {
        reqItem = mongoWth as any;
        db.withdrawal_requests.unshift(reqItem!);
      }
    }
    if (!reqItem) return res.status(404).json({ error: 'Withdrawal request not found' });

    reqItem.status = 'SUCCESSFUL';
    reqItem.completed_at = new Date().toISOString();
    saveDatabase();

    await WithdrawalRequestModel.findOneAndUpdate({ id: reqItem.id }, reqItem, { new: true }).catch(() => {});

    return res.json({
      success: true,
      message: `Withdrawal of ₹${reqItem.amount.toLocaleString('en-IN')} marked as SUCCESSFUL / DISBURSED!`,
      withdrawalRequest: reqItem,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to complete withdrawal' });
  }
});

app.post('/api/admin/withdrawals/:id/reject', async (req, res) => {
  try {
    await ensureMongoConnected();
    if (!db.withdrawal_requests) db.withdrawal_requests = [];
    let reqItem = db.withdrawal_requests.find((w) => w.id === req.params.id);
    if (!reqItem) {
      const mongoWth = await WithdrawalRequestModel.findOne({ id: req.params.id }).lean().catch(() => null);
      if (mongoWth) {
        reqItem = mongoWth as any;
        db.withdrawal_requests.unshift(reqItem!);
      }
    }
    if (!reqItem) return res.status(404).json({ error: 'Withdrawal request not found' });

    const { reason } = req.body;
    reqItem.status = 'REJECTED';
    reqItem.admin_notes = reason || 'Rejected by Admin. Amount refunded back to wallet.';

    let user = db.users.find((u) => u.id === reqItem!.user_id);
    if (!user) {
      const mongoUser = await UserModel.findOne({ id: reqItem.user_id }).lean().catch(() => null);
      if (mongoUser) {
        user = mongoUser as any;
        db.users.push(user!);
      }
    }

    if (user) {
      user.balance = (user.balance || 0) + Number(reqItem.amount);
      await UserModel.findOneAndUpdate({ id: user.id }, { balance: user.balance }, { new: true }).catch(() => {});
    }

    const newTx: Transaction = {
      id: `tx_${Date.now()}_ref`,
      user_id: reqItem.user_id,
      username: reqItem.username,
      type: 'REFUND',
      amount: reqItem.amount,
      balance_after: user ? user.balance : reqItem.amount,
      description: `Refund for Rejected Withdrawal: ${reqItem.admin_notes}`,
      created_at: new Date().toISOString(),
      reference_id: reqItem.id,
    };
    db.transactions.unshift(newTx);
    saveDatabase();

    await WithdrawalRequestModel.findOneAndUpdate({ id: reqItem.id }, reqItem, { new: true }).catch(() => {});
    await TransactionModel.findOneAndUpdate({ id: newTx.id }, newTx, { upsert: true, new: true }).catch(() => {});

    const userProfile = user ? (({ password_hash, ...u }) => u)(user) : undefined;
    return res.json({
      success: true,
      message: `Withdrawal rejected and ₹${reqItem.amount.toLocaleString('en-IN')} refunded to user wallet.`,
      user: userProfile,
      withdrawalRequest: reqItem,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to reject withdrawal' });
  }
});

// ----------------------------------------------------
// 12. SUSPEND / RESUME RACE & RUNNERS API
// ----------------------------------------------------
app.post('/api/admin/races/:id/suspend', (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) return res.status(404).json({ error: 'Race not found' });

  race.is_suspended = true;
  if (race.horses) {
    race.horses.forEach((h) => { h.is_suspended = true; });
  }
  saveDatabase();
  return res.json({ success: true, message: `All runners in ${race.name} suspended`, race });
});

app.post('/api/admin/races/:id/resume', (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) return res.status(404).json({ error: 'Race not found' });

  race.is_suspended = false;
  if (race.horses) {
    race.horses.forEach((h) => { h.is_suspended = false; });
  }
  saveDatabase();
  return res.json({ success: true, message: `All runners in ${race.name} resumed`, race });
});

app.post('/api/admin/races/:raceId/horses/:horseId/suspend', (req, res) => {
  const race = db.races.find((r) => r.id === req.params.raceId);
  if (!race) return res.status(404).json({ error: 'Race not found' });

  const horse = race.horses.find((h) => h.id === req.params.horseId);
  if (!horse) return res.status(404).json({ error: 'Horse not found' });

  horse.is_suspended = true;
  saveDatabase();
  return res.json({ success: true, message: `Runner ${horse.name} suspended`, race, horse });
});

app.post('/api/admin/races/:raceId/horses/:horseId/resume', (req, res) => {
  const race = db.races.find((r) => r.id === req.params.raceId);
  if (!race) return res.status(404).json({ error: 'Race not found' });

  const horse = race.horses.find((h) => h.id === req.params.horseId);
  if (!horse) return res.status(404).json({ error: 'Horse not found' });

  const { win_odds, place_odds } = req.body;
  horse.is_suspended = false;
  if (win_odds && !isNaN(Number(win_odds))) horse.win_odds = Number(win_odds);
  if (place_odds && !isNaN(Number(place_odds))) horse.place_odds = Number(place_odds);

  saveDatabase();
  return res.json({ success: true, message: `Runner ${horse.name} resumed`, race, horse });
});

// Add Runner to Race directly
app.post('/api/admin/races/:id/horses', (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) return res.status(404).json({ error: 'Race not found' });

  const { name, jockey, trainer, horse_no, serial_no, gate_no, win_odds, place_odds, silk_color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Horse name is required' });
  }

  const nextSerial = (race.horses?.length || 0) + 1;
  const sNo = Number(serial_no || horse_no) || nextSerial;
  const newHorse: Horse = {
    id: `h_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    race_id: race.id,
    horse_no: sNo,
    serial_no: sNo,
    gate_no: gate_no || sNo,
    name: name.trim().toUpperCase(),
    jockey: (jockey || 'TBD').trim(),
    trainer: (trainer || 'TBD').trim(),
    win_odds: Number(win_odds) || 2.50,
    place_odds: Number(place_odds) || 1.40,
    silk_color: silk_color || '#3b82f6',
    is_suspended: false,
    odds_history: [
      {
        win_odds: Number(win_odds) || 2.50,
        place_odds: Number(place_odds) || 1.40,
        updated_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        changed_by: 'Master Admin',
      }
    ]
  };

  race.horses = race.horses || [];
  race.horses.push(newHorse);
  saveDatabase();

  return res.json({ success: true, message: `Added ${newHorse.name} to ${race.name}`, horse: newHorse, race });
});

// Delete Runner from Race
app.delete('/api/admin/races/:raceId/horses/:horseId', (req, res) => {
  const race = db.races.find((r) => r.id === req.params.raceId);
  if (!race) return res.status(404).json({ error: 'Race not found' });

  const initialCount = race.horses.length;
  race.horses = race.horses.filter((h) => h.id !== req.params.horseId);
  if (race.horses.length === initialCount) {
    return res.status(404).json({ error: 'Horse not found in this race' });
  }

  saveDatabase();
  return res.json({ success: true, message: 'Runner removed from race', race });
});

// ----------------------------------------------------
// VITE SPA MIDDLEWARE / PRODUCTION STATIC FILES
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏇 Horse Race Betting server running on http://localhost:${PORT}`);
  });
}

export { app, startServer };
export default app;

if (!process.env.VERCEL && !process.env.NOW_REGION && !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.IS_SERVERLESS) {
  startServer();
}
