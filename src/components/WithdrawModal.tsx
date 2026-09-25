import React, { useState, useEffect } from 'react';
import { User, WithdrawalRequest } from '../types';
import { api } from '../services/api';
import { 
  X, 
  ArrowUpRight, 
  AlertCircle, 
  Building2, 
  Smartphone,
  Lock,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  Timer
} from 'lucide-react';

interface WithdrawModalProps {
  user: User | null;
  myBets?: Bet[];
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (amount: number, details: { upi_id?: string; bank_account?: string; ifsc?: string; account_holder?: string }) => Promise<void>;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  user,
  myBets = [],
  isOpen,
  onClose,
  onWithdraw,
}) => {
  if (!isOpen) return null;

  const userBalance = user?.balance ?? 0;
  const userExposure = user?.exposure ?? 0;

  const [activeTab, setActiveTab] = useState<'REQUEST' | 'TRACK'>('REQUEST');
  const [method, setMethod] = useState<'UPI' | 'BANK'>('UPI');
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolder, setAccountHolder] = useState(user?.full_name || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [userWithdrawals, setUserWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  const loadWithdrawalHistory = async () => {
    try {
      const all = await api.getWithdrawalRequests('ALL');
      const filtered = all.filter((w) => w.user_id === user?.id || w.username === user?.username);
      setUserWithdrawals(filtered);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      loadWithdrawalHistory();
    }
  }, [isOpen, user]);

  // 🏆 WINNINGS ONLY CALCULATION: Only settled race winnings can be withdrawn!
  const totalWinningsEarned = React.useMemo(() => {
    return (myBets || []).filter((b) => b.status === 'WON').reduce((sum, b) => sum + (b.payout || b.payout_amount || 0), 0);
  }, [myBets]);

  const totalWithdrawnSoFar = React.useMemo(() => {
    return (userWithdrawals || [])
      .filter((w) => w.status === 'SUCCESSFUL' || w.status === 'IN_PROGRESS' || w.status === 'PENDING')
      .reduce((sum, w) => sum + (w.amount || 0), 0);
  }, [userWithdrawals]);

  const availableWinnings = Math.max(0, totalWinningsEarned - totalWithdrawnSoFar);
  // Cap at wallet balance minus exposure
  const withdrawableAmount = Math.max(0, Math.min(userBalance - userExposure, availableWinnings));
  const playOnlyDepositBalance = Math.max(0, userBalance - withdrawableAmount);

  const [amount, setAmount] = useState<number>(() => {
    if (withdrawableAmount >= 500) return Math.min(2000, withdrawableAmount);
    return withdrawableAmount;
  });

  // Periodically refresh countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawableAmount <= 0) {
      setError('You do not have any withdrawable race winnings yet. Place winning bets to withdraw funds.');
      return;
    }
    if (!amount || amount < 100) {
      setError('Minimum withdrawal amount is ₹100');
      return;
    }
    if (amount > withdrawableAmount) {
      setError(`Cannot withdraw more than your available race winnings (₹${withdrawableAmount.toLocaleString('en-IN')})`);
      return;
    }
    if (method === 'UPI' && !upiId.includes('@')) {
      setError('Please enter a valid UPI ID (e.g. user@okhdfcbank)');
      return;
    }
    if (method === 'BANK' && (!bankAccount || !ifsc)) {
      setError('Please enter both Bank Account Number and IFSC Code');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onWithdraw(amount, {
        upi_id: method === 'UPI' ? upiId : undefined,
        bank_account: method === 'BANK' ? bankAccount : undefined,
        ifsc: method === 'BANK' ? ifsc : undefined,
        account_holder: method === 'BANK' ? accountHolder : undefined,
      });
      setSuccessMsg(`Withdrawal request of ₹${amount.toLocaleString('en-IN')} submitted successfully! Status: PENDING Admin review.`);
      await loadWithdrawalHistory();
      setActiveTab('TRACK');
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRemainingMinutes = (req: WithdrawalRequest) => {
    const startTime = new Date(req.approved_at || req.created_at).getTime();
    const elapsedMinutes = Math.floor((currentTime - startTime) / (60 * 1000));
    const totalMinutes = req.estimated_minutes || 120;
    return Math.max(0, totalMinutes - elapsedMinutes);
  };

  const formatRemainingTimer = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m remaining`;
    }
    return `${mins}m remaining`;
  };

  const pendingOrActiveCount = userWithdrawals.filter(w => w.status === 'PENDING' || w.status === 'IN_PROGRESS').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Withdraw Funds</h3>
              <p className="text-[11px] text-slate-400">Direct transfer to Bank or UPI Fast Rail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/60 border-b border-slate-800 text-xs shrink-0">
          <button
            onClick={() => setActiveTab('REQUEST')}
            className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'REQUEST'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>New Request</span>
          </button>
          <button
            onClick={() => setActiveTab('TRACK')}
            className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer relative ${
              activeTab === 'TRACK'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Track Requests</span>
            {pendingOrActiveCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'TRACK' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500 text-slate-950'
              }`}>
                {pendingOrActiveCount}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'REQUEST' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* 3-Tier Balance Breakdown Card (Winnings Only Rule) */}
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 text-xs">
                {/* Available Winnings Hero Row */}
                <div className="flex items-center justify-between bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/40">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Withdrawable Winnings</span>
                    </div>
                    <p className="text-[11px] text-emerald-400/80">Earned from won race selections</p>
                  </div>
                  <span className="font-mono font-black text-emerald-400 text-lg sm:text-xl">
                    ₹{withdrawableAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Secondary breakdown */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Play-Only Deposit</span>
                    <span className="font-mono font-bold text-amber-400 text-xs">
                      ₹{playOnlyDepositBalance.toLocaleString('en-IN')}
                    </span>
                    <span className="block text-[9px] text-slate-500">Reserved for betting</span>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Wallet</span>
                    <span className="font-mono font-bold text-white text-xs">
                      ₹{userBalance.toLocaleString('en-IN')}
                    </span>
                    <span className="block text-[9px] text-slate-500">Includes active balance</span>
                  </div>
                </div>

                {/* Fairplay Policy Notice */}
                <div className="p-2.5 bg-[#12161f] rounded-xl border border-blue-500/20 flex items-start gap-2 text-[11px] text-slate-300">
                  <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-blue-300">Winnings-Only Policy:</strong> Only profits won from settled race bets can be withdrawn. Deposited funds remain active for live race wagering.
                  </p>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider">
                    Withdrawal Amount (₹)
                  </label>
                  {withdrawableAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(withdrawableAmount)}
                      className="text-amber-400 hover:underline cursor-pointer font-medium"
                    >
                      Withdraw Full Winnings (₹{withdrawableAmount.toLocaleString('en-IN')})
                    </button>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg">₹</span>
                  <input
                    id="withdraw-amount-input"
                    type="number"
                    min="100"
                    max={withdrawableAmount}
                    disabled={withdrawableAmount <= 0}
                    value={amount || ''}
                    onChange={(e) => {
                      setAmount(Number(e.target.value));
                      setError(null);
                    }}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-lg focus:outline-none focus:border-amber-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    placeholder={withdrawableAmount > 0 ? "500" : "0 (No winnings)"}
                  />
                </div>
                <p className="text-[11px] text-slate-500">Min: ₹100 | Max Winnings Available: ₹{withdrawableAmount.toLocaleString('en-IN')}</p>
              </div>

              {/* Method tabs */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Payout Destination
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="withdraw-method-upi"
                    onClick={() => setMethod('UPI')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      method === 'UPI'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    UPI ID (Fast Rail)
                  </button>

                  <button
                    type="button"
                    id="withdraw-method-bank"
                    onClick={() => setMethod('BANK')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      method === 'BANK'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Bank Transfer (IMPS)
                  </button>
                </div>
              </div>

              {/* Destination Fields */}
              {method === 'UPI' ? (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">UPI Address (VPA)</label>
                  <input
                    id="withdraw-upi-input"
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. user@okhdfcbank or 9876543210@paytm"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Account Holder Name</label>
                    <input
                      id="withdraw-name-input"
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="Account holder name as in bank passbook"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Account Number</label>
                    <input
                      id="withdraw-account-input"
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="e.g. 5010023456789"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">IFSC Code</label>
                    <input
                      id="withdraw-ifsc-input"
                      type="text"
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs uppercase focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Progress workflow note */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Withdrawal Timeline & Flow:</span>
                </div>
                <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5">
                  <li>Status starts as <strong className="text-amber-400">PENDING</strong> awaiting Admin queue review.</li>
                  <li>Once approved, status moves to <strong className="text-blue-400">IN PROGRESS</strong> with a 120-minute completion timer.</li>
                  <li>Upon payout transfer, status changes to <strong className="text-emerald-400">SUCCESSFUL</strong> and you receive an alert notification.</li>
                </ul>
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                id="confirm-withdraw-btn"
                disabled={isSubmitting || withdrawableAmount < 500 || !amount || amount < 500 || amount > withdrawableAmount}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <span>Request Withdrawal (₹{amount ? amount.toLocaleString('en-IN') : '0'})</span>
                )}
              </button>
            </form>
          ) : (
            /* Track Requests View */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Your Withdrawal History ({userWithdrawals.length})</span>
                <button
                  onClick={loadWithdrawalHistory}
                  className="text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <History className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              {userWithdrawals.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <History className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No Withdrawal Requests Found</p>
                  <p className="text-xs text-slate-500">When you submit a withdrawal, it will appear here with live status updates.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {userWithdrawals.map((req) => {
                    const remainingMins = getRemainingMinutes(req);
                    return (
                      <div
                        key={req.id}
                        className="bg-slate-950 rounded-xl p-3.5 border border-slate-800/80 space-y-2 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">
                              ₹{req.amount.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {req.upi_id ? 'UPI' : 'Bank Transfer'}
                            </span>
                          </div>

                          {/* Status Badge */}
                          {req.status === 'PENDING' && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>PENDING APPROVAL</span>
                            </span>
                          )}
                          {req.status === 'IN_PROGRESS' && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                              <Timer className="w-3 h-3" />
                              <span>IN PROGRESS</span>
                            </span>
                          )}
                          {req.status === 'SUCCESSFUL' && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>SUCCESSFUL</span>
                            </span>
                          )}
                          {req.status === 'REJECTED' && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              <span>REJECTED</span>
                            </span>
                          )}
                        </div>

                        {/* Destination detail */}
                        <p className="text-xs text-slate-400 truncate">
                          Target: <span className="text-slate-200">{req.upi_id || `${req.bank_account} (${req.ifsc})`}</span>
                        </p>

                        {/* Timer / Progress Bar for IN_PROGRESS */}
                        {req.status === 'IN_PROGRESS' && (
                          <div className="bg-blue-950/40 border border-blue-500/20 rounded-lg p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-blue-300 font-medium flex items-center gap-1">
                                <Timer className="w-3 h-3 animate-spin" />
                                Processing window (120m SLA):
                              </span>
                              <span className="text-blue-200 font-bold">
                                {formatRemainingTimer(remainingMins)}
                              </span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(5, ((120 - remainingMins) / 120) * 100))}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-blue-300/80">
                              Approved by Admin. Amount will be credited to your account shortly.
                            </p>
                          </div>
                        )}

                        {req.status === 'PENDING' && (
                          <p className="text-[11px] text-amber-300/80 bg-amber-950/20 p-2 rounded-lg border border-amber-500/10">
                            Your withdrawal request is in queue. Admin will approve and start the 120-minute transfer cycle shortly.
                          </p>
                        )}

                        {req.status === 'SUCCESSFUL' && (
                          <p className="text-[11px] text-emerald-300/80 bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/10 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Amount has been transferred to your payout account.</span>
                          </p>
                        )}

                        {req.status === 'REJECTED' && req.admin_notes && (
                          <p className="text-[11px] text-rose-300/80 bg-rose-950/20 p-2 rounded-lg border border-rose-500/10">
                            Reason: {req.admin_notes} (Funds refunded back to your balance)
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                          <span>Req ID: {req.id}</span>
                          <span>{new Date(req.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
