import React, { useState } from 'react';
import { Bet, Transaction, User, DepositRequest, WithdrawalRequest } from '../types';
import { soundManager } from '../utils/audio';
import { 
  User as UserIcon, 
  Wallet, 
  Shield, 
  Coins, 
  TrendingUp, 
  KeyRound, 
  FileText, 
  Award, 
  CheckCircle2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Calendar, 
  Clock, 
  Phone, 
  Mail,
  Fingerprint,
  Eye,
  EyeOff,
  Lock,
  Zap,
  Plus,
  Trophy,
  Sparkles,
  LogOut,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Layers
} from 'lucide-react';

interface PersonalDetailsProps {
  user: User | null;
  bets: Bet[];
  transactions: Transaction[];
  depositRequests?: DepositRequest[];
  withdrawalRequests?: WithdrawalRequest[];
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenChangePassword: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onGoToLobby: () => void;
}

export const PersonalDetails: React.FC<PersonalDetailsProps> = ({
  user,
  bets,
  transactions,
  depositRequests = [],
  withdrawalRequests = [],
  onOpenDeposit,
  onOpenWithdraw,
  onOpenChangePassword,
  onOpenAuth,
  onLogout,
  onGoToLobby,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [financialTab, setFinancialTab] = useState<'deposits' | 'withdrawals' | 'transactions'>('deposits');
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUtr(id);
    soundManager.playClick();
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const formatSafeDate = (dateVal?: string | Date, options?: Intl.DateTimeFormatOptions) => {
    try {
      if (!dateVal) return 'Recent';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'Recent';
      return d.toLocaleString('en-IN', options || { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recent';
    }
  };

  const formatSafeMemberSince = (dateVal?: string | Date) => {
    try {
      if (!dateVal) return '2026';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '2026';
      return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    } catch {
      return '2026';
    }
  };

  if (!user) {
    return (
      <div className="bg-[#091510] rounded-2xl border border-emerald-900/50 p-6 sm:p-8 text-center space-y-4 max-w-md mx-auto my-6 shadow-2xl">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#e5b869]/15 text-[#e5b869] border border-[#e5b869]/30 flex items-center justify-center mx-auto">
          <UserIcon className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-white">Sign In to View Personal Details</h2>
        <p className="text-xs text-slate-400">
          Access your personal profile, registration credentials, wallet statement, and race stats.
        </p>
        <button
          onClick={onOpenAuth}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5b869] hover:from-[#c5a030] hover:to-[#d4af37] text-black font-black text-xs shadow-lg transition cursor-pointer active:scale-95"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  // Deduplicate transactions: ensure only 1 transaction per bet/reference_id and unique ID
  const uniqueTransactions = React.useMemo(() => {
    const seen = new Set<string>();
    const result: Transaction[] = [];
    (transactions || []).forEach((tx) => {
      if (!tx) return;
      const dedupeKey = tx.reference_id && (tx.type === 'WIN' || tx.type === 'BET' || tx.type === 'REFUND')
        ? `${tx.type}_${tx.reference_id}`
        : tx.id || `${tx.type}_${tx.amount}_${tx.description}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        result.push(tx);
      }
    });
    return result;
  }, [transactions]);

  const totalStake = (bets || []).reduce((acc, b) => acc + (b?.stake || 0), 0);
  const totalPayout = (bets || []).reduce((acc, b) => acc + (b?.payout || 0), 0);
  const wonCount = (bets || []).filter((b) => b?.status === 'WON').length;
  const pendingCount = (bets || []).filter((b) => b?.status === 'PENDING').length;
  const withdrawTxs = uniqueTransactions.filter((t) => t.type === 'WITHDRAW');
  const totalWithdrawals = withdrawTxs.reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

  // User Credentials
  const refId = user.ref_id || user.id || 'N/A';
  const fullName = user.full_name || user.username || 'Punter';
  const phoneNumber = user.phone || 'N/A';
  const emailAddress = user.email || 'N/A';
  const userPassword = user.password || '••••••••';

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-12 overflow-hidden px-1 sm:px-0">
      
      {/* ---------------- 1. USER PROFILE HEADER CARD ---------------- */}
      <div className="bg-[#091510] rounded-2xl border border-emerald-900/60 p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* Avatar with glowing gold border */}
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 border-[#e5b869] shadow-[0_0_15px_rgba(229,184,105,0.3)] shrink-0 bg-[#040805]">
              <img
                src={user.profile_photo || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username || 'punter'}`}
                alt={user.username || 'User'}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                  @{user.username || 'user'}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0">
                  ✓ Verified Punter
                </span>
                {user.role === 'admin' && (
                  <span className="px-2 py-0.5 rounded-full bg-[#1a170b] text-[#e5b869] border border-[#e5b869]/40 text-[9px] sm:text-[10px] font-bold uppercase shrink-0">
                    Admin
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono truncate">
                <Phone className="w-3 h-3 text-[#e5b869] shrink-0" />
                <span>+91 {phoneNumber}</span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="truncate hidden sm:inline">{emailAddress}</span>
              </p>

              <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                User ID: <span className="font-mono text-slate-300 font-semibold">{refId}</span> • Since: {formatSafeMemberSince(user.created_at)}
              </p>
            </div>
          </div>

          {/* Quick Wallet Action Buttons */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-900/40">
            <button
              onClick={() => {
                soundManager.playClick();
                onOpenDeposit();
              }}
              className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5b869] hover:from-[#c5a030] hover:to-[#d4af37] text-black font-black text-xs shadow-md transition cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>+ Add Money</span>
            </button>

            <button
              onClick={() => {
                soundManager.playClick();
                onOpenWithdraw();
              }}
              className="flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-[#040805] hover:bg-[#0e241b] text-slate-200 border border-emerald-900/60 font-semibold text-xs transition cursor-pointer active:scale-95"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              <span>Withdraw</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------- 2. SECTION: PERSONAL DETAILS & REGISTRATION INFO ---------------- */}
      <div className="bg-[#091510] rounded-2xl border border-emerald-900/60 p-4 sm:p-6 shadow-xl space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#e5b869] shadow-[0_0_8px_rgba(229,184,105,0.8)] shrink-0" />
            <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
              Personal Details & Registration Info
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Your official account credentials and platform identity
          </p>
        </div>

        {/* Responsive Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3.5">
          {/* 1. USER / REF ID */}
          <div className="bg-[#040805] rounded-xl border border-emerald-900/40 p-3 sm:p-4 flex items-center gap-3 shadow-sm min-w-0">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                USER / REF ID
              </span>
              <span className="text-sm sm:text-base font-black text-white font-mono mt-0.5 block truncate">
                {refId}
              </span>
            </div>
          </div>

          {/* 2. FULL NAME */}
          <div className="bg-[#040805] rounded-xl border border-emerald-900/40 p-3 sm:p-4 flex items-center gap-3 shadow-sm min-w-0">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                FULL NAME
              </span>
              <span className="text-sm sm:text-base font-black text-white mt-0.5 block truncate">
                {fullName}
              </span>
            </div>
          </div>

          {/* 3. PHONE NUMBER */}
          <div className="bg-[#040805] rounded-xl border border-emerald-900/40 p-3 sm:p-4 flex items-center gap-3 shadow-sm min-w-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                PHONE NUMBER
              </span>
              <span className="text-sm sm:text-base font-black text-white font-mono mt-0.5 block truncate">
                +91 {phoneNumber}
              </span>
            </div>
          </div>

          {/* 4. EMAIL ADDRESS */}
          <div className="bg-[#040805] rounded-xl border border-emerald-900/40 p-3 sm:p-4 flex items-center gap-3 shadow-sm min-w-0">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                EMAIL ADDRESS
              </span>
              <span className="text-sm sm:text-base font-black text-white font-mono mt-0.5 block truncate">
                {emailAddress}
              </span>
            </div>
          </div>

          {/* 5. PASSWORD (Spanning full width on desktop, wrapped safely on mobile) */}
          <div className="md:col-span-2 bg-[#040805] rounded-xl border border-emerald-900/40 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#e5b869]/15 text-[#e5b869] border border-[#e5b869]/30 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="leading-tight min-w-0 flex-1">
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  PASSWORD
                </span>
                <span className="text-sm sm:text-base font-black text-white font-mono mt-0.5 block tracking-wider truncate">
                  {showPassword ? (userPassword || 'pass123') : '••••••••'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setShowPassword(!showPassword);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#091510] hover:bg-[#0e241b] text-slate-300 hover:text-white border border-emerald-900/60 text-xs font-semibold transition cursor-pointer shadow-sm active:scale-95"
              >
                {showPassword ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>Show</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  onOpenChangePassword();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#1a170b] hover:bg-[#252010] text-[#e5b869] border border-[#e5b869]/40 text-xs font-bold transition cursor-pointer text-center active:scale-95"
              >
                Change
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- 3. SECTION: RACES & FINANCIAL ACTIVITY ---------------- */}
      <div className="bg-[#091510] rounded-2xl border border-emerald-900/60 p-4 sm:p-6 shadow-xl space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] shrink-0" />
            <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
              Races & Financial Activity
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Real-time statistics on your predictions and payouts
          </p>
        </div>

        {/* 4 Metric Cards in Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* 1. RACES CONTESTED */}
          <div className="bg-[#040805] rounded-xl border border-emerald-900/40 p-3 sm:p-4 shadow-md space-y-1 relative">
            <div className="flex items-center justify-between">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                RACES CONTESTED
              </p>
              <Trophy className="w-3.5 h-3.5 text-[#e5b869] shrink-0" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-white font-mono">
              {bets.length}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Total selections</p>
          </div>

          {/* 2. RACES WON */}
          <div className="bg-[#040805] rounded-xl border border-emerald-900/40 p-3 sm:p-4 shadow-md space-y-1 relative">
            <div className="flex items-center justify-between">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                RACES WON
              </p>
              <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {wonCount}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Winning entries</p>
          </div>

          {/* 3. TOTAL PAYOUT EARNED */}
          <div className="bg-[#040805] rounded-xl border border-emerald-900/40 p-3 sm:p-4 shadow-md space-y-1 relative">
            <div className="flex items-center justify-between">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                TOTAL PAYOUT
              </p>
              <Sparkles className="w-3.5 h-3.5 text-[#e5b869] shrink-0" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-[#e5b869] font-mono truncate">
              ₹{totalPayout.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Disbursed winnings</p>
          </div>

          {/* 4. TOTAL MONEY WITHDRAWN */}
          <div className="bg-[#040805] rounded-xl border border-emerald-900/40 p-3 sm:p-4 shadow-md space-y-1 relative">
            <div className="flex items-center justify-between">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                WITHDRAWALS
              </p>
              <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-cyan-400 font-mono truncate">
              ₹{totalWithdrawals.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-500 font-medium truncate">
              {withdrawTxs.length} transfers
            </p>
          </div>
        </div>
      </div>

      {/* ---------------- 4. SECTION: WALLET LIQUIDITY, PAYMENT STATUS & STATEMENT ---------------- */}
      <div className="bg-[#091510] rounded-2xl border border-emerald-900/60 p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-900/40 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#e5b869]" />
              <span>Payments & Financial Ledger</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              Live status tracking of deposit requests, withdrawal queues, and transaction statement
            </p>
          </div>

          {/* Liquid Balance pill */}
          <div className="grid grid-cols-2 gap-2 bg-[#040805] p-2 px-3 rounded-xl border border-emerald-900/50 self-stretch sm:self-auto text-center sm:text-left">
            <div>
              <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase">Liquid Balance</p>
              <p className="text-xs sm:text-sm font-black text-emerald-400 font-mono">₹{(user.balance || 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="border-l border-emerald-900/50 pl-2">
              <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase">Exposure</p>
              <p className="text-xs sm:text-sm font-black text-rose-400 font-mono">₹{(user.exposure || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* Tab Controls for Deposits, Withdrawals, Statement */}
        <div className="flex items-center gap-1.5 p-1 bg-[#040805] rounded-xl border border-emerald-900/50 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setFinancialTab('deposits');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
              financialTab === 'deposits'
                ? 'bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Deposit Requests</span>
            {depositRequests.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                financialTab === 'deposits' ? 'bg-black/30 text-black' : 'bg-emerald-900 text-emerald-300'
              }`}>
                {depositRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setFinancialTab('withdrawals');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
              financialTab === 'withdrawals'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Withdrawals</span>
            {withdrawalRequests.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                financialTab === 'withdrawals' ? 'bg-black/30 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}>
                {withdrawalRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setFinancialTab('transactions');
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
              financialTab === 'transactions'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Statement Ledger</span>
            {uniqueTransactions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {uniqueTransactions.length}
              </span>
            )}
          </button>
        </div>

        {/* ---------------- SUB-TAB 1: DEPOSIT REQUESTS & VERIFICATION STATUS ---------------- */}
        {financialTab === 'deposits' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-slate-400">
                Track status of your UPI deposits submitted to the Admin
              </span>
              <button
                type="button"
                onClick={onOpenDeposit}
                className="text-xs text-[#e5b869] hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Deposit</span>
              </button>
            </div>

            {depositRequests.length === 0 ? (
              <div className="bg-[#040805] rounded-xl p-8 text-center border border-emerald-950 text-xs text-slate-500 space-y-2">
                <ArrowDownLeft className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-400">No deposit requests submitted yet.</p>
                <button
                  onClick={onOpenDeposit}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black font-black text-xs transition cursor-pointer mt-2"
                >
                  Deposit Funds Now
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {depositRequests.map((dep) => {
                  const isApproved = dep.status === 'APPROVED';
                  const isPending = dep.status === 'PENDING';
                  const isRejected = dep.status === 'REJECTED';

                  return (
                    <div
                      key={dep.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isApproved
                          ? 'bg-[#041009] border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                          : isPending
                          ? 'bg-[#120e04] border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                          : 'bg-[#140607] border-rose-500/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                              isApproved
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : isPending
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            <ArrowDownLeft className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-white text-base">
                                ₹{(dep.amount || 0).toLocaleString('en-IN')}
                              </span>
                              <span className="text-xs text-slate-400 font-semibold">
                                via {dep.payment_method || 'UPI'}
                              </span>

                              {/* Status Badge */}
                              {isApproved && (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-[10px] font-black uppercase flex items-center gap-1 shadow">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>APPROVED & CREDITED</span>
                                </span>
                              )}
                              {isPending && (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-black uppercase flex items-center gap-1 shadow">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>PENDING ADMIN APPROVAL</span>
                                </span>
                              )}
                              {isRejected && (
                                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[10px] font-black uppercase flex items-center gap-1 shadow">
                                  <AlertCircle className="w-3 h-3 text-rose-400" />
                                  <span>REJECTED</span>
                                </span>
                              )}
                            </div>

                            {/* UTR & Timestamp */}
                            <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                              <span className="font-mono bg-[#030604] px-2 py-0.5 rounded border border-emerald-950 text-slate-300 font-bold flex items-center gap-1">
                                <span>UTR:</span>
                                <span className="text-[#e5b869]">{dep.utr_number || 'N/A'}</span>
                                {dep.utr_number && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(dep.utr_number, dep.id)}
                                    className="ml-1 text-slate-400 hover:text-white cursor-pointer"
                                    title="Copy UTR"
                                  >
                                    {copiedUtr === dep.id ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </span>

                              <span className="text-[11px] text-slate-500">
                                {formatSafeDate(dep.created_at)}
                              </span>
                            </div>

                            {dep.admin_notes && (
                              <p className="text-[11px] text-amber-300/90 pt-0.5">
                                Note: {dep.admin_notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Screenshot proof thumbnail if available */}
                        {dep.screenshot_url && (
                          <div className="sm:text-right shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewImage(dep.screenshot_url || null)}
                              className="px-2.5 py-1 rounded-xl bg-[#030604] border border-emerald-900/60 hover:border-[#e5b869] text-slate-300 hover:text-white text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <Eye className="w-3 h-3 text-[#e5b869]" />
                              <span>View Proof</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---------------- SUB-TAB 2: WITHDRAWAL REQUESTS & 120M SLA ---------------- */}
        {financialTab === 'withdrawals' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-slate-400">
                Track withdrawal status, 120-minute timer, and bank disbursements
              </span>
              <button
                type="button"
                onClick={onOpenWithdraw}
                className="text-xs text-emerald-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Request Withdrawal</span>
              </button>
            </div>

            {withdrawalRequests.length === 0 ? (
              <div className="bg-[#040805] rounded-xl p-8 text-center border border-emerald-950 text-xs text-slate-500 space-y-2">
                <ArrowUpRight className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-400">No withdrawal requests found.</p>
                <button
                  onClick={onOpenWithdraw}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs transition cursor-pointer mt-2"
                >
                  Withdraw Funds
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {withdrawalRequests.map((wth) => {
                  const isSuccess = wth.status === 'SUCCESSFUL';
                  const isInProgress = wth.status === 'IN_PROGRESS';
                  const isPending = wth.status === 'PENDING';
                  const isRejected = wth.status === 'REJECTED';

                  return (
                    <div
                      key={wth.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isSuccess
                          ? 'bg-[#041009] border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                          : isInProgress
                          ? 'bg-[#061218] border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                          : isPending
                          ? 'bg-[#120e04] border-amber-500/50'
                          : 'bg-[#140607] border-rose-500/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                              isSuccess
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : isInProgress
                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                : isPending
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            <ArrowUpRight className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-white text-base">
                                ₹{(wth.amount || 0).toLocaleString('en-IN')}
                              </span>

                              {/* Status Badge */}
                              {isSuccess && (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-[10px] font-black uppercase flex items-center gap-1 shadow">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>DISBURSED / SUCCESSFUL</span>
                                </span>
                              )}
                              {isInProgress && (
                                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 text-[10px] font-black uppercase flex items-center gap-1 shadow">
                                  <Clock className="w-3 h-3 text-cyan-400" />
                                  <span>IN PROGRESS (120m SLA)</span>
                                </span>
                              )}
                              {isPending && (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-black uppercase flex items-center gap-1 shadow">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>PENDING REVIEW</span>
                                </span>
                              )}
                              {isRejected && (
                                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[10px] font-black uppercase flex items-center gap-1 shadow">
                                  <AlertCircle className="w-3 h-3 text-rose-400" />
                                  <span>REJECTED & REFUNDED</span>
                                </span>
                              )}
                            </div>

                            {/* Destination & Timestamp */}
                            <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                              <span className="font-mono bg-[#030604] px-2 py-0.5 rounded border border-emerald-950 text-slate-300 font-semibold">
                                {wth.upi_id ? `UPI: ${wth.upi_id}` : `A/C: ${wth.bank_account || 'Bank'} (${wth.ifsc || 'IFSC'})`}
                              </span>

                              <span className="text-[11px] text-slate-500">
                                {formatSafeDate(wth.created_at)}
                              </span>
                            </div>

                            {wth.admin_notes && (
                              <p className="text-[11px] text-rose-400/90 pt-0.5">
                                Reason: {wth.admin_notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---------------- SUB-TAB 3: WALLET STATEMENT LEDGER ---------------- */}
        {financialTab === 'transactions' && (() => {
          const userTransactions = (uniqueTransactions || []).filter(
            (tx) => tx && (tx.user_id === user.id || tx.username === user.username)
          );

          return (
            <div>
              {userTransactions.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <FileText className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-slate-400 font-semibold">No transactions recorded yet.</p>
                  <p className="text-[10px] text-slate-500">Your deposit approvals, placed bets, and win payouts will appear here in real-time.</p>
                </div>
              ) : (
                <div className="divide-y divide-emerald-950/60 overflow-hidden">
                  {userTransactions.map((tx) => {
                    const txAmt = Number(tx.amount || 0);
                    return (
                      <div key={tx.id} className="py-2.5 sm:py-3 flex items-center justify-between gap-2.5 text-xs min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                            tx.type === 'DEPOSIT' || tx.type === 'WIN'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {tx.type === 'DEPOSIT' || tx.type === 'WIN' ? (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white text-xs sm:text-sm truncate">{tx.description || 'Transaction'}</p>
                            <p className="text-[10px] text-slate-500">
                              {formatSafeDate(tx.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right font-mono shrink-0">
                          <p className={`font-black text-xs sm:text-sm ${
                            txAmt > 0 ? 'text-emerald-400' : 'text-slate-200'
                          }`}>
                            {txAmt > 0 ? `+₹${txAmt.toLocaleString('en-IN')}` : `-₹${Math.abs(txAmt).toLocaleString('en-IN')}`}
                          </p>
                          <p className="text-[9px] text-slate-500">Bal: ₹{(tx.balance_after || 0).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Proof Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-lg w-full bg-slate-900 border border-emerald-500/40 rounded-3xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">Payment Screenshot Proof</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>
            <img
              src={previewImage}
              alt="Payment Proof"
              className="w-full max-h-[70vh] object-contain rounded-2xl border border-emerald-950"
            />
          </div>
        </div>
      )}

      {/* ---------------- 5. SECTION: SECURITY & LOGOUT ---------------- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#091510] rounded-2xl border border-emerald-900/60 p-4 sm:p-5 shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate">Security & Active Sessions</h4>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate">Manage credentials or sign out of your account</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
          <button
            onClick={onOpenChangePassword}
            className="px-3 py-2 rounded-xl bg-[#040805] hover:bg-[#0e241b] text-slate-200 border border-emerald-900/60 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#e5b869]" />
            <span>Password</span>
          </button>

          <button
            onClick={onLogout}
            className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

    </div>
  );
};

