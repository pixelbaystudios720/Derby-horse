export type BetType = 'WIN' | 'PLACE';
export type BetStatus = 'PENDING' | 'WON' | 'LOST' | 'CANCELLED' | 'REFUNDED';
export type RaceStatus = 'DRAFT' | 'UPCOMING' | 'OPEN' | 'LIVE' | 'CLOSED' | 'RESULTED' | 'OPEN_FOR_BETTING' | 'SUSPENDED' | 'ABANDONED';
export type TransactionType = 'DEPOSIT' | 'WITHDRAW' | 'BET' | 'WIN' | 'REFUND';

// Level 1: Race Center Master
export interface RaceCenter {
  id: string;
  name: string; // e.g., 'MYSORE', 'BANGALORE', 'OOTY', 'MADRAS', 'KOLKATA', 'DELHI', 'HYDERABAD', 'PUNE', 'MUMBAI'
  code: string; // e.g., 'MYS', 'BTC', 'OOT', 'MRC', 'CAL', 'DEL', 'HYD', 'PUN', 'MUM'
  city?: string;
  is_active: boolean;
  order?: number;
  created_at?: string;
}

// Level 2: Race Day / Race Card Fixture
export interface RaceDay {
  id: string;
  center_id: string;
  center_name: string;
  race_date: string; // e.g. '2026-09-17' or '17th Sep 2026'
  title: string; // e.g. 'Mysore - 17th Sep 2026'
  status: 'DRAFT' | 'PUBLISHED';
  races_count?: number;
  created_at?: string;
}

export interface User {
  id: string;
  ref_id?: string;
  full_name?: string;
  phone: string;
  email?: string;
  password?: string;
  username: string;
  role: 'user' | 'admin';
  balance: number;
  exposure: number;
  is_blocked?: boolean;
  profile_photo?: string;
  password_hash?: string;
  total_deposited?: number;
  total_withdrawn?: number;
  total_wagered?: number;
  total_won?: number;
  net_pnl?: number;
  created_at: string;
}

export interface OddsLog {
  win_odds: number;
  place_odds: number;
  old_win?: number;
  old_place?: number;
  updated_at?: string;
  timestamp?: string;
  changed_by?: string;
}

export interface Horse {
  id: string;
  race_id: string;
  horse_no: number; // Serial number (S.No)
  serial_no?: number; // Explicit serial number
  gate_no: number | string; // Gate number (Draw / Barrier)
  name: string; // Name of the horse
  jockey: string; // Name of the jockey
  trainer: string; // Name of the trainer
  win_odds: number;
  place_odds: number;
  odds_history?: OddsLog[];
  silk_color?: string;
  form?: string;
  weight?: string;
  is_suspended?: boolean;
}

// Level 3: Race Entity inside a Race Day
export interface Race {
  id: string;
  race_day_id?: string;
  center_id?: string;
  name: string; // Name of the race / cup (e.g. XYZ Plate)
  race_no?: number | string; // Race number (1 to 10)
  race_number?: number | string; // Alias for race_no
  venue: string;
  race_time: string; // Time (e.g. 1:30 PM)
  date_str: string;
  distance: string; // Distance (e.g. 1200M)
  number_of_runners?: number;
  going?: string;
  class_grade?: string;
  status: RaceStatus;
  is_suspended?: boolean;
  image_url?: string;
  winner_horse_id?: string | null;
  place_horses_ids?: string[]; // IDs of horses in 1st, 2nd, 3rd
  position_1?: string[]; // IDs of horses tied for 1st place (Dead Heat)
  position_2?: string[]; // IDs of horses tied for 2nd place
  position_3?: string[]; // IDs of horses tied for 3rd place
  position_4?: string[]; // IDs of horses in 4th place
  is_dead_heat?: boolean;
  dead_heat_note?: string;
  horses: Horse[];
  settled_at?: string | null;
}

export interface Bet {
  id: string;
  user_id: string;
  username?: string;
  race_id: string;
  race_name: string;
  venue: string;
  horse_id: string;
  horse_name: string;
  horse_no: number; // Serial number
  serial_no?: number;
  gate_no?: number | string;
  jockey?: string;
  trainer?: string;
  bet_type: BetType;
  odds: number;
  stake: number;
  amount?: number;
  potential_win: number;
  payout?: number;
  status: BetStatus;
  is_dead_heat?: boolean;
  dead_heat_divider?: number;
  placed_at: string;
  settled_at?: string | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  username?: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  reference_id?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  link: string;
  tag?: string;
  is_active: boolean;
}

export interface BetSlipState {
  race: Race;
  horse: Horse;
  bet_type: BetType;
  odds: number;
  stake: number;
}

export type DepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DepositRequest {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  payment_method: string;
  utr_number: string;
  screenshot_url?: string;
  status: DepositStatus;
  created_at: string;
  reviewed_at?: string | null;
  admin_notes?: string;
}

export type WithdrawalStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCESSFUL' | 'REJECTED';

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  upi_id?: string;
  bank_account?: string;
  ifsc?: string;
  account_holder?: string;
  status: WithdrawalStatus;
  created_at: string;
  approved_at?: string | null;
  completed_at?: string | null;
  estimated_minutes?: number; // 120 minutes default
  admin_notes?: string;
}

export type NotificationType = 
  | 'DEPOSIT_APPROVED' 
  | 'DEPOSIT_REJECTED' 
  | 'WITHDRAWAL_IN_PROGRESS' 
  | 'WITHDRAWAL_SUCCESSFUL' 
  | 'WITHDRAWAL_REJECTED' 
  | 'BET_WON' 
  | 'GENERAL';

export interface UserNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  amount?: number;
  reference_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface SubAdmin {
  id: string;
  username: string;
  name: string;
  role: 'ODDS_MANAGER' | 'FINANCE_MANAGER' | 'FULL_ADMIN';
  permissions: string[];
  created_at: string;
}

export interface SystemSettings {
  betting_enabled: boolean;
  emergency_message?: string;
  announcement?: string;
  sub_admins?: SubAdmin[];
}

