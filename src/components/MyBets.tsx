import React, { useState, useMemo } from 'react';
import { Bet, BetStatus } from '../types';
import { OddsFormat, formatOdds } from '../utils/odds';
import { soundManager } from '../utils/audio';
import { 
  Trophy, 
  AlertCircle, 
  CheckCircle2, 
  Coins, 
  Calendar, 
  Clock, 
  ChevronRight,
  ArrowRight,
  Flame,
  Zap,
  Layers,
  Sparkles
} from 'lucide-react';

interface MyBetsProps {
  bets: Bet[];
  onSelectRace?: (raceId: string) => void;
  isLoading: boolean;
  oddsFormat?: OddsFormat;
  onGoToLobby?: () => void;
}

export type MyBetsFilter = 'ALL' | 'IN_PLAY' | 'COMPLETED';

interface RaceBetGroup {
  race_id: string;
  race_name: string;
  venue: string;
  bets: Bet[];
  totalStake: number;
  totalPotentialWin: number;
  totalPayout: number;
  netPnL: number;
  wonCount: number;
  lostCount: number;
  pendingCount: number;
  hasPending: boolean;
  hasWon: boolean;
  hasLost: boolean;
  isCompleted: boolean;
}

export const MyBets: React.FC<MyBetsProps> = ({ 
  bets, 
  onSelectRace, 
  isLoading,
  oddsFormat = 'DECIMAL',
  onGoToLobby
}) => {
  const [filter, setFilter] = useState<MyBetsFilter>('ALL');

  // Group bets by Race / Contest (sorted strictly with date descending)
  const allGroupedContests: RaceBetGroup[] = useMemo(() => {
    const map = new Map<string, RaceBetGroup>();
    const sortedBets = [...bets].sort((a, b) => new Date(b.placed_at || b.created_at || 0).getTime() - new Date(a.placed_at || a.created_at || 0).getTime());
    for (const bet of sortedBets) {
      const key = bet.race_id || bet.race_name || 'general_contest';
      if (!map.has(key)) {
        map.set(key, {
          race_id: bet.race_id,
          race_name: bet.race_name,
          venue: bet.venue,
          bets: [],
          totalStake: 0,
          totalPotentialWin: 0,
          totalPayout: 0,
          netPnL: 0,
          wonCount: 0,
          lostCount: 0,
          pendingCount: 0,
          hasPending: false,
          hasWon: false,
          hasLost: false,
          isCompleted: false,
        });
      }
      const group = map.get(key)!;
      group.bets.push(bet);
      group.totalStake += bet.stake || bet.amount || 0;
      group.totalPotentialWin += (bet.potential_win || Math.round((bet.stake || 0) * (bet.odds || 1)));
      if (bet.status === 'PENDING') {
        group.hasPending = true;
        group.pendingCount++;
      } else if (bet.status === 'WON') {
        group.hasWon = true;
        group.wonCount++;
        group.totalPayout += (bet.payout || 0);
      } else if (bet.status === 'LOST') {
        group.hasLost = true;
        group.lostCount++;
      }
    }

    const list = Array.from(map.values());
    list.forEach((g) => {
      g.bets.sort((a, b) => new Date(b.placed_at || b.created_at || 0).getTime() - new Date(a.placed_at || a.created_at || 0).getTime());
      g.isCompleted = g.pendingCount === 0 && (g.hasWon || g.hasLost);
      g.netPnL = g.totalPayout - g.totalStake;
    });
    return list;
  }, [bets]);

  // Filter grouped contests based on tab
  const groupedContests = useMemo(() => {
    if (filter === 'IN_PLAY') {
      return allGroupedContests.filter((g) => g.hasPending);
    }
    if (filter === 'COMPLETED') {
      return allGroupedContests.filter((g) => g.isCompleted || (!g.hasPending && (g.hasWon || g.hasLost)));
    }
    return allGroupedContests;
  }, [allGroupedContests, filter]);

  // Track which contests are expanded
  const [expandedContests, setExpandedContests] = useState<Record<string, boolean>>({});

  const isContestExpanded = (contestKey: string, idx: number) => {
    if (expandedContests[contestKey] !== undefined) {
      return expandedContests[contestKey];
    }
    return true; // All expanded by default for full visibility
  };

  const toggleContest = (contestKey: string, idx: number) => {
    soundManager.playClick();
    const current = isContestExpanded(contestKey, idx);
    setExpandedContests((prev) => ({
      ...prev,
      [contestKey]: !current,
    }));
  };

  const totalInPlayCount = bets.filter((b) => b.status === 'PENDING').length;
  const completedRacesCount = allGroupedContests.filter((g) => g.isCompleted || (!g.hasPending && (g.hasWon || g.hasLost))).length;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header with Title & Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-emerald-900/40">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#e5b869]" />
            <span>My Race Selections</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            View your in-play contest wagers and completed race outcomes with won & lost slips
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#091510] p-1.5 rounded-2xl border border-emerald-900/50 text-xs font-semibold self-start sm:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => { soundManager.playClick(); setFilter('ALL'); }}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer font-bold ${
              filter === 'ALL'
                ? 'bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black shadow-[0_0_10px_rgba(229,184,105,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            ALL SELECTIONS ({bets.length})
          </button>

          <button
            type="button"
            onClick={() => { soundManager.playClick(); setFilter('IN_PLAY'); }}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer font-bold flex items-center gap-1.5 ${
              filter === 'IN_PLAY'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                : 'text-slate-400 hover:text-amber-300 hover:bg-amber-950/30'
            }`}
          >
            <span>LIVE / IN-PLAY</span>
            {totalInPlayCount > 0 && (
              <span className="px-1.5 py-0.2 bg-black/40 text-black font-black rounded-full text-[10px]">
                {totalInPlayCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { soundManager.playClick(); setFilter('COMPLETED'); }}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer font-bold flex items-center gap-1.5 ${
              filter === 'COMPLETED'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/30'
            }`}
          >
            <span>COMPLETED RACES</span>
            {completedRacesCount > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-950/60 text-emerald-300 font-mono font-bold rounded-full text-[10px] border border-emerald-700/50">
                {completedRacesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Bets List */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-[#e5b869] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold">Loading your race selections...</p>
        </div>
      ) : groupedContests.length === 0 ? (
        <div className="py-16 text-center bg-[#07100b] rounded-3xl border border-emerald-900/50 p-8 shadow-inner space-y-3">
          <Coins className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">No race selections found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {filter === 'ALL'
              ? 'You have not placed bets in any race yet. Choose a race from the Race Lobby to make your selections.'
              : `You do not have any ${filter === 'PENDING' ? 'in-play' : filter.toLowerCase()} selections.`}
          </p>
          {onGoToLobby && (
            <button
              onClick={onGoToLobby}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black font-black text-xs shadow-lg shadow-[#e5b869]/20 transition cursor-pointer"
            >
              <span>Explore Race Lobby</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedContests.map((contestGroup, idx) => {
            const contestKey = contestGroup.race_id || contestGroup.race_name || `contest_${idx}`;
            const isOpen = isContestExpanded(contestKey, idx);

            return (
              <div
                key={contestKey}
                id={`contest-card-${contestGroup.race_id}`}
                className={`relative rounded-3xl bg-[#091510] border-2 transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? 'border-[#e5b869] shadow-[0_0_24px_rgba(229,184,105,0.35)] ring-1 ring-[#e5b869]/60'
                    : 'border-emerald-900/70 hover:border-[#e5b869]/60 shadow-lg hover:shadow-[0_0_15px_rgba(229,184,105,0.2)]'
                }`}
              >
                {/* Lightning Glow Strip on Top Border */}
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#e5b869] to-transparent" />

                {/* ---------------- 1. CLICKABLE CONTEST MASTER HEADER ---------------- */}
                <div 
                  onClick={() => toggleContest(contestKey, idx)}
                  className="p-4 sm:p-5 bg-[#050e0a]/95 cursor-pointer hover:bg-[#081510] transition flex flex-col md:flex-row md:items-center justify-between gap-3 select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition shrink-0 ${
                      contestGroup.isCompleted
                        ? contestGroup.wonCount > 0
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                          : 'bg-rose-950/80 border-rose-600 text-rose-400'
                        : isOpen
                        ? 'bg-[#18160c] border-[#e5b869] text-[#e5b869] shadow-[0_0_12px_rgba(229,184,105,0.4)]'
                        : 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                    }`}>
                      {contestGroup.isCompleted ? (
                        <Trophy className={`w-5 h-5 ${contestGroup.wonCount > 0 ? 'text-[#e5b869]' : 'text-slate-400'}`} />
                      ) : (
                        <Zap className={`w-5 h-5 fill-current ${isOpen ? 'text-[#e5b869]' : 'text-emerald-400'}`} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                          {contestGroup.race_name}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-[#18160c] text-[#e5b869] font-mono font-bold text-[10px] sm:text-[11px] border border-[#e5b869]/40">
                          {contestGroup.venue}
                        </span>
                        {contestGroup.isCompleted ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                            <CheckCircle2 className="w-3 h-3" />
                            COMPLETED RACE
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] border border-amber-500/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            LIVE IN-PLAY
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-semibold text-slate-200">
                          {contestGroup.bets.length} {contestGroup.bets.length === 1 ? 'Selection' : 'Selections'} Placed
                        </span>
                        {contestGroup.isCompleted && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 font-bold text-[10px] border border-emerald-800">
                              {contestGroup.wonCount} WON
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 font-bold text-[10px] border border-rose-800">
                              {contestGroup.lostCount} LOST
                            </span>
                          </>
                        )}
                        <span className="text-slate-600">•</span>
                        <span className="text-[#e5b869] font-bold">
                          {isOpen ? 'Click to collapse ▲' : 'Click to view odds & slips ▼'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Aggregate Summary & Toggle Button */}
                  <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
                    <div className="flex items-center gap-2 bg-[#040805] px-3 py-1.5 rounded-xl border border-emerald-900/60 text-xs font-mono">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">Total Stake</span>
                        <span className="font-bold text-white">₹{contestGroup.totalStake.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="h-5 w-px bg-emerald-900/60 mx-1" />
                      {contestGroup.isCompleted ? (
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-emerald-400 block font-sans">Total Payout</span>
                          <span className={`font-black ${contestGroup.totalPayout > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            ₹{contestGroup.totalPayout.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-emerald-400 block font-sans">Max Potential</span>
                          <span className="font-black text-[#e5b869]">₹{contestGroup.totalPotentialWin.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                    </div>

                    {/* Expand/Collapse Interactive Indicator Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleContest(contestKey, idx);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer ${
                        isOpen
                          ? 'bg-[#18160c] text-[#e5b869] border border-[#e5b869]/70 shadow-[0_0_10px_rgba(229,184,105,0.3)]'
                          : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800 hover:text-white'
                      }`}
                    >
                      <span>{isOpen ? 'Hide Odds' : `View Slips (${contestGroup.bets.length})`}</span>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
                    </button>

                    {onSelectRace && contestGroup.race_id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundManager.playClick();
                          onSelectRace(contestGroup.race_id);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
                        title="Open full race card"
                      >
                        <span className="hidden sm:inline">Race Card</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ---------------- 2. EXPANDABLE CONTENT: MULTIPLE ODDS & SELECTIONS ---------------- */}
                {isOpen && (
                  <div className="p-3 sm:p-5 space-y-2.5 bg-[#07100b]/80 border-t border-emerald-900/60 animate-in slide-in-from-top-2 duration-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[#e5b869]">
                        <Sparkles className="w-3.5 h-3.5 text-[#e5b869]" />
                        <span>Race Selections & Outcome Slips</span>
                      </span>
                      <span className="text-emerald-400 font-mono text-[9px] bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                        {contestGroup.bets.length} {contestGroup.bets.length === 1 ? 'Selection' : 'Selections'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {contestGroup.bets.map((bet) => {
                        const isWon = bet.status === 'WON';
                        const isLost = bet.status === 'LOST';
                        const isPending = bet.status === 'PENDING';

                        return (
                          <div
                            key={bet.id}
                            id={`bet-row-${bet.id}`}
                            className={`rounded-2xl border p-3 sm:p-4 transition-all duration-200 shadow-md space-y-3 relative overflow-hidden group/bet ${
                              isWon
                                ? 'bg-[#05130b] border-emerald-500/70 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
                                : isLost
                                ? 'bg-[#120708] border-rose-900/60 hover:border-rose-700/60'
                                : 'bg-[#050d09] hover:bg-[#0c1c14] border-emerald-900/60'
                            }`}
                          >
                            {/* Top Row: Horse info & Status Badge */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border font-black text-xs sm:text-sm flex items-center justify-center font-mono shadow-inner shrink-0 ${
                                  isWon
                                    ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                                    : isLost
                                    ? 'bg-rose-950 border-rose-800 text-rose-400'
                                    : 'bg-[#040805] border-emerald-900/80 text-[#e5b869]'
                                }`}>
                                  #{bet.horse_no}
                                </span>
                                <div>
                                  <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                                    <span>{bet.horse_name}</span>
                                    {isWon && (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-black font-black text-[9px] uppercase tracking-wider">
                                        WINNER
                                      </span>
                                    )}
                                  </h4>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                    <span>Jockey: <strong className="text-slate-200 font-semibold">{bet.jockey || 'Contender'}</strong></span>
                                    <span>•</span>
                                    <span>Trainer: <strong className="text-slate-300 font-semibold">{bet.trainer || 'Stable'}</strong></span>
                                  </div>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                                {isPending && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/40 text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-sm">
                                    <Clock className="w-3 h-3" />
                                    In Play / Contesting
                                  </span>
                                )}
                                {isWon && (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider shadow-md ${
                                    bet.is_dead_heat
                                      ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                                      : 'bg-emerald-500/25 text-emerald-300 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                  }`}>
                                    <Trophy className="w-3.5 h-3.5 text-[#e5b869]" />
                                    {bet.is_dead_heat ? `WON (Dead Heat) +₹${bet.payout?.toLocaleString('en-IN')}` : `WON +₹${bet.payout?.toLocaleString('en-IN')}`}
                                  </span>
                                )}
                                {isLost && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/40 text-[11px] font-bold uppercase tracking-wider">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    LOST (-₹{bet.stake?.toLocaleString('en-IN')})
                                  </span>
                                )}
                              </div>
                            </div>

                            {bet.is_dead_heat && isWon && (
                              <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300 font-semibold flex items-center justify-between gap-2">
                                <span>⚡ Settled as per Dead Heat Rule: 1/{bet.dead_heat_divider || 2} Stake Split across tied winners</span>
                                <span className="font-mono text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-200 font-black">Payout: ₹{bet.payout?.toLocaleString('en-IN')}</span>
                              </div>
                            )}

                            {/* Bottom Metrics Details Grid */}
                            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl text-[11px] sm:text-xs font-mono border ${
                              isWon 
                                ? 'bg-[#030c07] border-emerald-900/80' 
                                : isLost
                                ? 'bg-[#0c0405] border-rose-950/80'
                                : 'bg-[#020503] border-emerald-950/80'
                            }`}>
                              <div>
                                <span className="text-slate-500 font-sans block text-[10px]">Bet Type</span>
                                <span className={`font-bold ${bet.bet_type === 'WIN' ? 'text-emerald-400' : 'text-[#e5b869]'}`}>
                                  {bet.bet_type} (Market)
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-sans block text-[10px]">Locked Odds</span>
                                <span className="font-bold text-[#e5b869] text-xs sm:text-sm">
                                  {formatOdds(bet.odds, oddsFormat)}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-sans block text-[10px]">Stake</span>
                                <span className="font-bold text-white">₹{bet.stake.toLocaleString('en-IN')}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-sans block text-[10px]">
                                  {isWon ? 'Payout Received' : isLost ? 'Return' : 'Potential Win'}
                                </span>
                                <span className={`font-black ${isWon ? 'text-emerald-300 text-xs sm:text-sm' : isLost ? 'text-rose-400' : 'text-emerald-400'}`}>
                                  {isWon 
                                    ? `+₹${(bet.payout || 0).toLocaleString('en-IN')}` 
                                    : isLost 
                                    ? '₹0' 
                                    : `₹${bet.potential_win.toLocaleString('en-IN')}`}
                                </span>
                              </div>
                            </div>

                            {/* Timestamp Footnote */}
                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 px-0.5">
                              <span className="flex items-center gap-1 font-mono">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                Placed: {new Date(bet.placed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                              <span className="text-[9px] text-emerald-600 font-mono">ID: {bet.id}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


