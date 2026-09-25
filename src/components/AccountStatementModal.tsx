import React, { useState } from 'react';
import { Transaction, DepositRequest, WithdrawalRequest } from '../types';
import { 
  X, 
  FileText, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Trophy, 
  Coins, 
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface AccountStatementModalProps {
  transactions: Transaction[];
  depositRequests?: DepositRequest[];
  withdrawalRequests?: WithdrawalRequest[];
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
}

export const AccountStatementModal: React.FC<AccountStatementModalProps> = ({
  transactions,
  depositRequests = [],
  withdrawalRequests = [],
  isOpen,
  onClose,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Strict deduplication & date descending sort of transactions
  const uniqueTransactions = React.useMemo(() => {
    const seen = new Set<string>();
    const result: Transaction[] = [];
    (transactions || []).forEach((tx) => {
      if (!tx) return;
      const dedupeKey = tx.reference_id && (tx.type === 'WIN' || tx.type === 'BET' || tx.type === 'REFUND')
        ? `${tx.type}_${tx.reference_id}`
        : tx.id || `${tx.type}_${tx.amount}_${tx.description}_${tx.created_at}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        result.push(tx);
      }
    });
    return result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [transactions]);

  const sortedDepositRequests = React.useMemo(() => {
    return [...depositRequests].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [depositRequests]);

  const sortedWithdrawalRequests = React.useMemo(() => {
    return [...withdrawalRequests].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [withdrawalRequests]);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    soundManager.playClick();
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#091510] border-2 border-emerald-900/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#040805] border-b border-emerald-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#18160c] border border-[#e5b869]/50 text-[#e5b869] flex items-center justify-center shadow">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base">Account Statement & Payment Status</h3>
              <p className="text-[11px] text-emerald-400">Live ledger of deposits, withdrawals & bets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1.5 p-2 bg-[#020503] border-b border-emerald-950 shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setActiveTab('all');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white border border-slate-700 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Transactions</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-300">
              {uniqueTransactions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setActiveTab('deposits');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'deposits'
                ? 'bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black shadow font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Deposit Requests</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              activeTab === 'deposits' ? 'bg-black/30 text-black' : 'bg-emerald-950 text-emerald-300'
            }`}>
              {depositRequests.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setActiveTab('withdrawals');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'withdrawals'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Withdrawals</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              activeTab === 'withdrawals' ? 'bg-black/30 text-slate-950' : 'bg-slate-900 text-slate-300'
            }`}>
              {withdrawalRequests.length}
            </span>
          </button>
        </div>

        {/* Content List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 scrollbar-thin">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-[#e5b869] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Loading ledger & payment statuses...</p>
            </div>
          ) : activeTab === 'deposits' ? (
            sortedDepositRequests.length === 0 ? (
              <div className="text-center py-16 bg-[#040805] rounded-2xl p-6 border border-emerald-950">
                <ArrowDownLeft className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">No deposit requests recorded</p>
              </div>
            ) : (
              sortedDepositRequests.map((dep) => {
                const isApproved = dep.status === 'APPROVED';
                const isPending = dep.status === 'PENDING';
                const isRejected = dep.status === 'REJECTED';

                return (
                  <div
                    key={dep.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isApproved
                        ? 'bg-[#041009] border-emerald-500/40'
                        : isPending
                        ? 'bg-[#120e04] border-amber-500/50'
                        : 'bg-[#140607] border-rose-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            isApproved
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : isPending
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          <ArrowDownLeft className="w-4 h-4" />
                        </div>

                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white uppercase text-xs tracking-wider">
                              Deposit via {dep.payment_method}
                            </span>
                            {isApproved && (
                              <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                <span>APPROVED</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-amber-400" />
                                <span>PENDING ADMIN APPROVAL</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black uppercase flex items-center gap-1">
                                <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                                <span>REJECTED</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="font-mono text-slate-300">
                              UTR: <strong className="text-[#e5b869]">{dep.utr_number}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              {new Date(dep.created_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-black text-sm sm:text-base text-emerald-400">
                          +₹{dep.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : activeTab === 'withdrawals' ? (
            sortedWithdrawalRequests.length === 0 ? (
              <div className="text-center py-16 bg-[#040805] rounded-2xl p-6 border border-emerald-950">
                <ArrowUpRight className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">No withdrawal requests recorded</p>
              </div>
            ) : (
              sortedWithdrawalRequests.map((wth) => {
                const isSuccess = wth.status === 'SUCCESSFUL';
                const isInProgress = wth.status === 'IN_PROGRESS';
                const isPending = wth.status === 'PENDING';
                const isRejected = wth.status === 'REJECTED';

                return (
                  <div
                    key={wth.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isSuccess
                        ? 'bg-[#041009] border-emerald-500/40'
                        : isInProgress
                        ? 'bg-[#061218] border-cyan-500/50'
                        : isPending
                        ? 'bg-[#120e04] border-amber-500/50'
                        : 'bg-[#140607] border-rose-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            isSuccess
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : isInProgress
                              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                              : isPending
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </div>

                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white uppercase text-xs tracking-wider">
                              Withdrawal
                            </span>
                            {isSuccess && (
                              <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                <span>SUCCESSFUL</span>
                              </span>
                            )}
                            {isInProgress && (
                              <span className="px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-black uppercase flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-cyan-400" />
                                <span>IN PROGRESS (120m)</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-amber-400" />
                                <span>PENDING</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black uppercase flex items-center gap-1">
                                <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                                <span>REJECTED</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="font-mono text-slate-300">
                              {wth.upi_id ? `UPI: ${wth.upi_id}` : `Bank: ${wth.bank_account}`}
                            </span>
                            <span>•</span>
                            <span>
                              {new Date(wth.created_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-black text-sm sm:text-base text-rose-400">
                          -₹{wth.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : uniqueTransactions.length === 0 ? (
            <div className="text-center py-16 bg-[#040805] rounded-2xl p-6 border border-emerald-950">
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-400">No transactions recorded yet</p>
            </div>
          ) : (
            uniqueTransactions.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="bg-[#040805] rounded-2xl p-3.5 sm:p-4 border border-emerald-950 flex items-center justify-between gap-3 text-xs sm:text-sm hover:border-emerald-800 transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === 'DEPOSIT'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : tx.type === 'WIN'
                          ? 'bg-[#e5b869]/20 text-[#e5b869]'
                          : tx.type === 'WITHDRAW'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {tx.type === 'DEPOSIT' && <ArrowDownLeft className="w-4 h-4" />}
                      {tx.type === 'WITHDRAW' && <ArrowUpRight className="w-4 h-4" />}
                      {tx.type === 'WIN' && <Trophy className="w-4 h-4" />}
                      {tx.type === 'BET' && <Coins className="w-4 h-4" />}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white uppercase text-xs tracking-wider">
                          {tx.type}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                          {new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-1">{tx.description}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono font-bold text-sm sm:text-base ${
                        isPositive ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {isPositive ? '+' : ''}₹{Math.abs(tx.amount).toLocaleString()}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      Bal: ₹{tx.balance_after.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
