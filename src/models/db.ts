import mongoose from 'mongoose';
import {
  UserModel,
  RaceModel,
  BetModel,
  TransactionModel,
  BannerModel,
  RaceCenterModel,
  RaceDayModel,
  DepositRequestModel,
  WithdrawalRequestModel,
  OtpModel,
} from './index';

let isConnected = false;
let cached = (global as any).mongoose;
if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export let lastMongoError: string | null = null;

export async function connectMongoDB(uri?: string): Promise<boolean> {
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL || !!process.env.NOW_REGION;
  
  const devFallback = Buffer.from('bW9uZ29kYitzcnY6Ly90dXJmdGFjdGljczIwMjZfZGJfdXNlcjpUdXJmdGFjdGljczIwMjZAY2x1c3RlcmhvcnNlLm14d2dvemUubW9uZ29kYi5uZXQvZGVyYnliZXRfZGV2P3JldHJ5V3JpdGVzPXRydWUmdz1tYWpvcml0eSZhcHBOYW1lPUNsdXN0ZXJIb3JzZQ==', 'base64').toString('utf-8');
  const prodFallback = Buffer.from('bW9uZ29kYitzcnY6Ly90dXJmdGFjdGljczIwMjZfZGJfdXNlcjpUdXJmdGFjdGljczIwMjZAY2x1c3RlcmhvcnNlLm14d2dvemUubW9uZ29kYi5uZXQvZGVyYnliZXQ/cmV0cnlXcml0ZXM9dHJ1ZSZ3PW1ham9yaXR5JmFwcE5hbWU9Q2x1c3RlckhvcnNl', 'base64').toString('utf-8');

  let mongoUri = uri;
  if (!mongoUri) {
    if (isProd) {
      mongoUri = process.env.MONGODB_PROD_URI || process.env.MONGODB_URI || prodFallback;
    } else {
      mongoUri = process.env.MONGODB_DEV_URI || process.env.MONGODB_URI || devFallback;
    }
  }

  if (mongoose.connection.readyState === 1 || cached.conn) {
    isConnected = true;
    return true;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
    };
    cached.promise = mongoose.connect(mongoUri, opts).then((instance) => {
      isConnected = true;
      cached.conn = instance;
      lastMongoError = null;
      const dbName = instance.connection.name || (isProd ? 'derbybet_prod' : 'derbybet_dev');
      console.log(`🍃 Connected to MongoDB [${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}]: ${dbName}`);
      return instance;
    }).catch((err) => {
      lastMongoError = err.message;
      cached.promise = null;
      throw err;
    });
  }

  try {
    await cached.promise;
    return true;
  } catch (err: any) {
    console.warn('⚠️ MongoDB connection warning:', err.message);
    return false;
  }
}

// Background eager connection
connectMongoDB().catch(() => {});

export function isMongoDBConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function ensureMongoConnected(): Promise<boolean> {
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  return connectMongoDB();
}

// Helpers for Dedicated OTP Generation Table in Database
export async function savePersistentOtp(
  targetOrParams: string | { target: string; email?: string; phone?: string; code: string; expires_at: number; purpose?: 'SIGNUP' | 'PASSWORD_RESET' | 'LOGIN' },
  fallbackCode?: string,
  fallbackExpiresAt?: number
) {
  try {
    await ensureMongoConnected();
    let target = '';
    let email = '';
    let phone = '';
    let code = '';
    let expires_at = Date.now() + 10 * 60 * 1000;
    let purpose = 'SIGNUP';

    if (typeof targetOrParams === 'object') {
      target = targetOrParams.target;
      email = targetOrParams.email || (target.includes('@') ? target : '');
      phone = targetOrParams.phone || (!target.includes('@') ? target : '');
      code = targetOrParams.code;
      expires_at = targetOrParams.expires_at;
      purpose = targetOrParams.purpose || 'SIGNUP';
    } else {
      target = targetOrParams;
      email = target.includes('@') ? target : '';
      phone = !target.includes('@') ? target : '';
      code = fallbackCode || '';
      expires_at = fallbackExpiresAt || expires_at;
    }

    const cleanTarget = String(target).trim().toLowerCase();
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanPhone = phone ? String(phone).trim() : '';

    const updateDoc = {
      id: `otp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      target: cleanTarget,
      email: cleanEmail,
      phone: cleanPhone,
      code: String(code).trim(),
      purpose,
      is_verified: false,
      expires_at,
      updated_at: new Date().toISOString(),
    };

    const record = await OtpModel.findOneAndUpdate(
      { target: cleanTarget },
      { $set: updateDoc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return record;
  } catch (err: any) {
    console.error('⚠️ Error saving OTP to database table:', err.message);
    return null;
  }
}

export async function getPersistentOtp(target: string) {
  try {
    await ensureMongoConnected();
    const cleanTarget = String(target).trim().toLowerCase();
    const record = await OtpModel.findOne({
      $or: [{ target: cleanTarget }, { email: cleanTarget }, { phone: cleanTarget }],
    }).lean();
    return record;
  } catch (err: any) {
    console.error('⚠️ Error fetching OTP from database table:', err.message);
    return null;
  }
}

export async function markOtpVerified(target: string) {
  try {
    await ensureMongoConnected();
    const cleanTarget = String(target).trim().toLowerCase();
    await OtpModel.updateOne(
      { $or: [{ target: cleanTarget }, { email: cleanTarget }, { phone: cleanTarget }] },
      { $set: { is_verified: true, updated_at: new Date().toISOString() } }
    );
  } catch (err: any) {
    console.error('⚠️ Error marking OTP verified in database table:', err.message);
  }
}

export async function deletePersistentOtp(target: string) {
  try {
    await ensureMongoConnected();
    const cleanTarget = String(target).trim().toLowerCase();
    await OtpModel.deleteMany({
      $or: [{ target: cleanTarget }, { email: cleanTarget }, { phone: cleanTarget }],
    });
  } catch (err: any) {
    console.error('⚠️ Error deleting OTP from database table:', err.message);
  }
}

export async function listAllOtps() {
  try {
    await ensureMongoConnected();
    return await OtpModel.find({}).sort({ updatedAt: -1 }).limit(50).lean();
  } catch (err: any) {
    return [];
  }
}

// Helpers to sync memory DB to MongoDB
export async function syncMemoryToMongoDB(db: {
  users?: any[];
  races?: any[];
  bets?: any[];
  transactions?: any[];
  banners?: any[];
  race_centers?: any[];
  race_days?: any[];
  deposit_requests?: any[];
  withdrawal_requests?: any[];
}) {
  if (!isMongoDBConnected()) return;

  try {
    if (db.users?.length) {
      for (const u of db.users) {
        await UserModel.findOneAndUpdate({ id: u.id }, u, { upsert: true, new: true });
      }
    }
    if (db.races?.length) {
      for (const r of db.races) {
        await RaceModel.findOneAndUpdate({ id: r.id }, r, { upsert: true, new: true });
      }
    }
    if (db.bets?.length) {
      for (const b of db.bets) {
        await BetModel.findOneAndUpdate({ id: b.id }, b, { upsert: true, new: true });
      }
    }
    if (db.transactions?.length) {
      for (const t of db.transactions) {
        await TransactionModel.findOneAndUpdate({ id: t.id }, t, { upsert: true, new: true });
      }
    }
    if (db.banners?.length) {
      for (const bn of db.banners) {
        await BannerModel.findOneAndUpdate({ id: bn.id }, bn, { upsert: true, new: true });
      }
    }
    if (db.race_centers?.length) {
      for (const rc of db.race_centers) {
        await RaceCenterModel.findOneAndUpdate({ id: rc.id }, rc, { upsert: true, new: true });
      }
    }
    if (db.race_days?.length) {
      for (const rd of db.race_days) {
        await RaceDayModel.findOneAndUpdate({ id: rd.id }, rd, { upsert: true, new: true });
      }
    }
    if (db.deposit_requests?.length) {
      for (const d of db.deposit_requests) {
        await DepositRequestModel.findOneAndUpdate({ id: d.id }, d, { upsert: true, new: true });
      }
    }
    if (db.withdrawal_requests?.length) {
      for (const w of db.withdrawal_requests) {
        await WithdrawalRequestModel.findOneAndUpdate({ id: w.id }, w, { upsert: true, new: true });
      }
    }
  } catch (err: any) {
    console.error('⚠️ Error syncing memory to MongoDB:', err.message);
  }
}

// Helpers to load data from MongoDB
export async function loadDataFromMongoDB() {
  if (!isMongoDBConnected()) return null;

  try {
    const users = await UserModel.find({}).lean();
    const races = await RaceModel.find({}).lean();
    const bets = await BetModel.find({}).lean();
    const transactions = await TransactionModel.find({}).lean();
    const banners = await BannerModel.find({}).lean();
    const race_centers = await RaceCenterModel.find({}).lean();
    const race_days = await RaceDayModel.find({}).lean();
    const deposit_requests = await DepositRequestModel.find({}).lean();
    const withdrawal_requests = await WithdrawalRequestModel.find({}).lean();

    if (users.length > 0 || races.length > 0) {
      return {
        users,
        races,
        bets,
        transactions,
        banners,
        race_centers,
        race_days,
        deposit_requests,
        withdrawal_requests,
      };
    }
    return null;
  } catch (err: any) {
    console.error('⚠️ Error loading from MongoDB:', err.message);
    return null;
  }
}

