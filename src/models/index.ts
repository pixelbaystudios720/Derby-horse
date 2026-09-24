import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// 1. USER SCHEMA & MODEL
// ==========================================
export interface IUser extends Document {
  id: string;
  phone: string;
  username: string;
  password_hash: string;
  balance: number;
  exposure: number;
  role: 'user' | 'admin';
  full_name?: string;
  email?: string;
  ref_id?: string;
  profile_photo?: string;
  created_at: string;
}

const UserSchema = new Schema<IUser>(
  {
    id: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    password_hash: { type: String, required: true },
    balance: { type: Number, default: 0, min: 0 },
    exposure: { type: Number, default: 0, min: 0 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    full_name: { type: String, default: '' },
    email: { type: String, default: '' },
    ref_id: { type: String, default: '' },
    profile_photo: { type: String, default: '' },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true }
);

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema, 'users');

// ==========================================
// 3. HORSE SCHEMA & MODEL
// ==========================================
export interface IHorse extends Document {
  id: string;
  race_id: string;
  horse_no: number;
  serial_no: number;
  gate_no: number | string;
  name: string;
  jockey: string;
  trainer: string;
  win_odds: number;
  place_odds: number;
  silk_color: string;
  form?: string;
  weight?: string;
  is_suspended: boolean;
}

export const HorseSchema = new Schema<IHorse>(
  {
    id: { type: String, required: true, index: true },
    race_id: { type: String, required: true, index: true },
    horse_no: { type: Number, required: true },
    serial_no: { type: Number, required: true },
    gate_no: { type: Schema.Types.Mixed, default: 1 },
    name: { type: String, required: true },
    jockey: { type: String, default: 'TBD' },
    trainer: { type: String, default: 'TBD' },
    win_odds: { type: Number, required: true, default: 2.5 },
    place_odds: { type: Number, required: true, default: 1.5 },
    silk_color: { type: String, default: '#3b82f6' },
    form: { type: String, default: '' },
    weight: { type: String, default: '55kg' },
    is_suspended: { type: Boolean, default: false },
  },
  { _id: false }
);

export const HorseModel: Model<IHorse> =
  mongoose.models.Horse || mongoose.model<IHorse>('Horse', HorseSchema, 'horses');

// ==========================================
// 2. RACE SCHEMA & MODEL
// ==========================================
export interface IRace extends Document {
  id: string;
  race_day_id?: string;
  center_id?: string;
  name: string;
  race_no?: number | string;
  venue: string;
  race_time: string;
  date_str: string;
  distance: string;
  going?: string;
  class_grade?: string;
  status: 'DRAFT' | 'UPCOMING' | 'OPEN' | 'LIVE' | 'CLOSED' | 'RESULTED' | 'OPEN_FOR_BETTING' | 'SUSPENDED' | 'ABANDONED';
  is_suspended?: boolean;
  image_url?: string;
  winner_horse_id: string | null;
  place_horses_ids: string[];
  position_1: string[];
  position_2: string[];
  position_3: string[];
  position_4?: string[];
  is_dead_heat?: boolean;
  dead_heat_note?: string;
  horses: IHorse[];
  settled_at: string | null;
}

const RaceSchema = new Schema<IRace>(
  {
    id: { type: String, required: true, unique: true, index: true },
    race_day_id: { type: String, default: '', index: true },
    center_id: { type: String, default: '', index: true },
    name: { type: String, required: true },
    race_no: { type: Schema.Types.Mixed, default: 1 },
    venue: { type: String, required: true },
    race_time: { type: String, required: true },
    date_str: { type: String, default: 'Today' },
    distance: { type: String, default: '1400m' },
    going: { type: String, default: 'Good' },
    class_grade: { type: String, default: 'Class 1' },
    status: {
      type: String,
      enum: ['DRAFT', 'UPCOMING', 'OPEN', 'LIVE', 'CLOSED', 'RESULTED', 'OPEN_FOR_BETTING', 'SUSPENDED', 'ABANDONED'],
      default: 'UPCOMING',
      index: true,
    },
    is_suspended: { type: Boolean, default: false },
    image_url: { type: String, default: '/images/race_action.jpg' },
    winner_horse_id: { type: String, default: null },
    place_horses_ids: { type: [String], default: [] },
    position_1: { type: [String], default: [] },
    position_2: { type: [String], default: [] },
    position_3: { type: [String], default: [] },
    position_4: { type: [String], default: [] },
    is_dead_heat: { type: Boolean, default: false },
    dead_heat_note: { type: String, default: '' },
    horses: { type: [HorseSchema], default: [] },
    settled_at: { type: String, default: null },
  },
  { timestamps: true }
);

export const RaceModel: Model<IRace> =
  mongoose.models.Race || mongoose.model<IRace>('Race', RaceSchema, 'races');

// ==========================================
// 4. BET SCHEMA & MODEL
// ==========================================
export interface IBet extends Document {
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
  amount?: number;
  potential_win: number;
  payout?: number;
  status: 'PENDING' | 'WON' | 'LOST' | 'CANCELLED' | 'REFUNDED';
  is_dead_heat?: boolean;
  dead_heat_divider?: number;
  placed_at: string;
  settled_at: string | null;
}

const BetSchema = new Schema<IBet>(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    username: { type: String, required: true },
    race_id: { type: String, required: true, index: true },
    race_name: { type: String, required: true },
    venue: { type: String, required: true },
    horse_id: { type: String, required: true, index: true },
    horse_name: { type: String, required: true },
    horse_no: { type: Number, required: true },
    serial_no: { type: Number },
    gate_no: { type: Schema.Types.Mixed },
    jockey: { type: String, default: 'TBD' },
    trainer: { type: String, default: 'TBD' },
    bet_type: { type: String, enum: ['WIN', 'PLACE'], required: true, index: true },
    odds: { type: Number, required: true },
    stake: { type: Number, required: true },
    amount: { type: Number },
    potential_win: { type: Number, required: true },
    payout: { type: Number, default: 0 },
    status: { type: String, enum: ['PENDING', 'WON', 'LOST', 'CANCELLED', 'REFUNDED'], default: 'PENDING', index: true },
    is_dead_heat: { type: Boolean, default: false },
    dead_heat_divider: { type: Number, default: 1 },
    placed_at: { type: String, default: () => new Date().toISOString() },
    settled_at: { type: String, default: null },
  },
  { timestamps: true }
);

export const BetModel: Model<IBet> =
  mongoose.models.Bet || mongoose.model<IBet>('Bet', BetSchema, 'bets');

// ==========================================
// 5. TRANSACTION SCHEMA & MODEL
// ==========================================
export interface ITransaction extends Document {
  id: string;
  user_id: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'BET' | 'WIN' | 'REFUND';
  amount: number;
  balance_after: number;
  description: string;
  reference_id?: string;
  created_at: string;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    type: { type: String, enum: ['DEPOSIT', 'WITHDRAW', 'BET', 'WIN', 'REFUND'], required: true, index: true },
    amount: { type: Number, required: true },
    balance_after: { type: Number, required: true },
    description: { type: String, default: '' },
    reference_id: { type: String, default: '' },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true }
);

export const TransactionModel: Model<ITransaction> =
  mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema, 'transactions');

// ==========================================
// 6. BANNER SCHEMA & MODEL
// ==========================================
export interface IBanner extends Document {
  id: string;
  image_url: string;
  is_active: boolean;
  title?: string;
  order?: number;
  link_url?: string;
  created_at: string;
}

const BannerSchema = new Schema<IBanner>(
  {
    id: { type: String, required: true, unique: true, index: true },
    image_url: { type: String, required: true },
    is_active: { type: Boolean, default: true, index: true },
    title: { type: String, default: '' },
    order: { type: Number, default: 0 },
    link_url: { type: String, default: '' },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true }
);

export const BannerModel: Model<IBanner> =
  mongoose.models.Banner || mongoose.model<IBanner>('Banner', BannerSchema, 'banners');

// ==========================================
// 7. RACE CENTERS & DAYS (ADDITIONAL MASTERS)
// ==========================================
export interface IRaceCenter extends Document {
  id: string;
  name: string;
  code: string;
  city?: string;
  is_active: boolean;
  order?: number;
  created_at?: string;
}

const RaceCenterSchema = new Schema<IRaceCenter>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    city: { type: String, default: '' },
    is_active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true }
);

export const RaceCenterModel: Model<IRaceCenter> =
  mongoose.models.RaceCenter || mongoose.model<IRaceCenter>('RaceCenter', RaceCenterSchema, 'race_centers');

export interface IRaceDay extends Document {
  id: string;
  center_id: string;
  center_name: string;
  race_date: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED';
  races_count?: number;
  created_at?: string;
}

const RaceDaySchema = new Schema<IRaceDay>(
  {
    id: { type: String, required: true, unique: true, index: true },
    center_id: { type: String, required: true, index: true },
    center_name: { type: String, required: true },
    race_date: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'PUBLISHED' },
    races_count: { type: Number, default: 0 },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true }
);

export const RaceDayModel: Model<IRaceDay> =
  mongoose.models.RaceDay || mongoose.model<IRaceDay>('RaceDay', RaceDaySchema, 'race_days');

// ==========================================
// 8. FINANCIAL REQUESTS (DEPOSITS & WITHDRAWALS)
// ==========================================
export interface IDepositRequest extends Document {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  utr_number: string;
  payment_method: string;
  screenshot_url?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  admin_notes?: string;
  created_at: string;
  reviewed_at?: string;
}

const DepositRequestSchema = new Schema<IDepositRequest>(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    username: { type: String, required: true },
    amount: { type: Number, required: true },
    utr_number: { type: String, required: true, index: true },
    payment_method: { type: String, default: 'UPI' },
    screenshot_url: { type: String, default: '' },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    admin_notes: { type: String, default: '' },
    created_at: { type: String, default: () => new Date().toISOString() },
    reviewed_at: { type: String },
  },
  { timestamps: true }
);

export const DepositRequestModel: Model<IDepositRequest> =
  mongoose.models.DepositRequest || mongoose.model<IDepositRequest>('DepositRequest', DepositRequestSchema, 'deposit_requests');

export interface IWithdrawalRequest extends Document {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  payment_method: 'UPI' | 'BANK_TRANSFER';
  upi_id?: string;
  account_holder?: string;
  account_number?: string;
  ifsc_code?: string;
  bank_name?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  admin_notes?: string;
  payout_utr?: string;
  created_at: string;
  processed_at?: string;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    username: { type: String, required: true },
    amount: { type: Number, required: true },
    payment_method: { type: String, enum: ['UPI', 'BANK_TRANSFER'], required: true },
    upi_id: { type: String, default: '' },
    account_holder: { type: String, default: '' },
    account_number: { type: String, default: '' },
    ifsc_code: { type: String, default: '' },
    bank_name: { type: String, default: '' },
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'], default: 'PENDING', index: true },
    admin_notes: { type: String, default: '' },
    payout_utr: { type: String, default: '' },
    created_at: { type: String, default: () => new Date().toISOString() },
    processed_at: { type: String },
  },
  { timestamps: true }
);

export const WithdrawalRequestModel: Model<IWithdrawalRequest> =
  mongoose.models.WithdrawalRequest || mongoose.model<IWithdrawalRequest>('WithdrawalRequest', WithdrawalRequestSchema, 'withdrawal_requests');

// ==========================================
// 12. OTP TABLE SCHEMA & MODEL (Dedicated OTP Generation Table)
// ==========================================
export interface IOtp extends Document {
  id: string;
  target: string;
  email?: string;
  phone?: string;
  code: string;
  purpose: 'SIGNUP' | 'PASSWORD_RESET' | 'LOGIN';
  is_verified: boolean;
  expires_at: number;
  created_at: string;
  updated_at: string;
}

export const OtpSchema = new Schema<IOtp>(
  {
    id: { type: String, default: () => `otp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` },
    target: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: '', index: true },
    phone: { type: String, default: '', index: true },
    code: { type: String, required: true },
    purpose: { type: String, enum: ['SIGNUP', 'PASSWORD_RESET', 'LOGIN'], default: 'SIGNUP' },
    is_verified: { type: Boolean, default: false },
    expires_at: { type: Number, required: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true }
);

// TTL index to automatically expire records after 30 minutes
OtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 });

export const OtpModel: Model<IOtp> =
  mongoose.models.Otp || mongoose.model<IOtp>('Otp', OtpSchema, 'otps');

// ==========================================
// 13. USER NOTIFICATION SCHEMA & MODEL
// ==========================================
export interface INotification extends Document {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  amount?: number;
  reference_id?: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationSchema = new Schema<INotification>(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    type: { type: String, default: 'SYSTEM' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    amount: { type: Number },
    reference_id: { type: String },
    is_read: { type: Boolean, default: false, index: true },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true }
);

export const NotificationModel: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema, 'notifications');



