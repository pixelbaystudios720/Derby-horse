import React, { useState, useEffect } from 'react';
import { Bet, BetType, Horse, Race } from '../types';
import { SilkIcon } from './SilkIcon';
import { OddsFormat, formatOdds } from '../utils/odds';
import { soundManager } from '../utils/audio';
import { realtimeOdds } from '../services/api';
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Trophy, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Info,
  Lock
} from 'lucide-react';

interface RaceDetailProps {
  race: Race;
  onBack: () => void;
  onSelectBet: (horse: Horse, betType: BetType, odds: number) => void;
  userBetsForRace: Bet[];
  onOpenMyBets: () => void;
  onOpenAuth: () => void;
  isLoggedIn: boolean;
  oddsFormat?: OddsFormat;
}

export const RaceDetail: React.FC<RaceDetailProps> = ({
  race: initialRace,
  onBack,
  onSelectBet,
  userBetsForRace,
  onOpenAuth,
  isLoggedIn,
  oddsFormat = 'DECIMAL',
}) => {
  const [activeTab, setActiveTab] = useState<'runners' | 'insights' | 'mybets'>('runners');
  const [currentRace, setCurrentRace] = useState<Race>(initialRace);

  // Sync with prop updates
  useEffect(() => {
    setCurrentRace(initialRace);
  }, [initialRace]);

  // Realtime odds listener for instant cross-tab / admin-to-user live updates
  useEffect(() => {
    const unsubscribe = realtimeOdds.subscribe((payload) => {
      if (payload.race && payload.race.id === currentRace.id) {
        setCurrentRace(payload.race);
      } else if (payload.race_id === currentRace.id) {
        if (payload.event === 'SUSPEND_ALL') {
          setCurrentRace((prev) => ({
            ...prev,
            is_suspended: true,
            horses: prev.horses.map((h) => ({ ...h, is_suspended: true })),
          }));
        } else if (payload.event === 'RESUME_ALL') {
          setCurrentRace((prev) => ({
            ...prev,
            is_suspended: false,
            horses: payload.race?.horses || prev.horses.map((h) => ({ ...h, is_suspended: false })),
          }));
        } else if (payload.horse_id) {
          setCurrentRace((prev) => ({
            ...prev,
            horses: prev.horses.map((h) =>
              h.id === payload.horse_id
                ? {
                    ...h,
                    is_suspended: payload.is_suspended !== undefined ? payload.is_suspended : h.is_suspended,
                    win_odds: payload.win_odds !== undefined ? payload.win_odds : h.win_odds,
                    place_odds: payload.place_odds !== undefined ? payload.place_odds : h.place_odds,
                  }
                : h
            ),
          }));
        }
      }
    });
    return () => unsubscribe();
  }, [currentRace.id]);

  const race = currentRace;

  const isDeadHeat = !!(
    race.is_dead_heat ||
    (race.position_1 && race.position_1.length > 1) ||
    (race.position_2 && race.position_2.length > 1) ||
    (race.position_3 && race.position_3.length > 1)
  );

  const p1Horses = race.position_1 && race.position_1.length > 0
    ? (race.position_1.map((id) => race.horses.find((h) => h.id === id)).filter(Boolean) as Horse[])
    : race.winner_horse_id
    ? ([race.horses.find((h) => h.id === race.winner_horse_id)].filter(Boolean) as Horse[])
    : [];

  const p2Horses = race.position_2 && race.position_2.length > 0
    ? (race.position_2.map((id) => race.horses.find((h) => h.id === id)).filter(Boolean) as Horse[])
    : race.place_horses_ids?.[1]
    ? ([race.horses.find((h) => h.id === race.place_horses_ids[1])].filter(Boolean) as Horse[])
    : [];

  const p3Horses = race.position_3 && race.position_3.length > 0
    ? (race.position_3.map((id) => race.horses.find((h) => h.id === id)).filter(Boolean) as Horse[])
    : race.place_horses_ids?.[2]
    ? ([race.horses.find((h) => h.id === race.place_horses_ids[2])].filter(Boolean) as Horse[])
    : [];

  const isBettingOpen = 
    (race.status === 'OPEN_FOR_BETTING' || race.status === 'LIVE') && 
    !race.is_suspended && 
    race.status !== 'CLOSED' && 
    race.status !== 'RESULTED';
  const isUpcomingFixture = 
    race.status === 'UPCOMING' || 
    race.status === 'DRAFT' || 
    race.status === 'OPEN' || 
    !race.status;
  const isOpen = isBettingOpen;

  const handleOddsClick = (horse: Horse, betType: BetType, odds: number) => {
    if (!isBettingOpen) return;
    soundManager.playChip();
    if (!isLoggedIn) {
      onOpenAuth();
      return;
    }
    onSelectBet(horse, betType, odds);
  };

  return (
    <div className="space-y-3 sm:space-y-4 pb-16">
      
      {/* ---------------- TOP BAR NAVIGATION (Compact & High-Density) ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <button
          id="back-to-races-btn"
          onClick={() => {
            soundManager.playClick();
            onBack();
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-emerald-900/40 text-[11px] font-bold transition shadow cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back to Races</span>
        </button>

        {/* Live Status Badge */}
        <div className="flex items-center gap-1">
          {(race.status === 'LIVE' || race.status === 'OPEN_FOR_BETTING') && !race.is_suspended && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              🟢 OPEN FOR BETTING
            </span>
          )}
          {(race.status === 'OPEN' || race.status === 'UPCOMING') && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              <Clock className="w-2.5 h-2.5 text-slate-400" />
              ⏱ Upcoming Fixture
            </span>
          )}
          {(race.status === 'CLOSED' || race.status === 'SUSPENDED' || race.is_suspended) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              <AlertCircle className="w-2.5 h-2.5" />
              Betting Closed / Suspended
            </span>
          )}
          {race.status === 'RESULTED' && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${
              isDeadHeat 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
            }`}>
              <CheckCircle2 className="w-2.5 h-2.5 text-amber-400" />
              {isDeadHeat ? '🏁 Dead Heat Result' : 'Resulted'}
            </span>
          )}
        </div>
      </div>

      {/* ---------------- RACE HEADER BANNER (Ultra-Compact) ---------------- */}
      <div className="rounded-xl bg-[#091510]/95 border border-emerald-900/60 p-2 sm:p-3 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-1 text-[9px] sm:text-[10px]">
              {race.race_no && (
                <span className="px-1 py-0.2 rounded bg-[#1a170b] text-[#e5b869] border border-[#e5b869]/30 font-black font-mono">
                  R#{race.race_no}
                </span>
              )}
              <span className="flex items-center gap-0.5 text-[#e5b869] font-bold bg-[#1a170b] px-1.5 py-0.2 rounded border border-[#e5b869]/20 truncate">
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                {race.venue}
              </span>
              <span className="text-emerald-900">•</span>
              <span className="text-slate-300 font-mono flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                {race.race_time}
              </span>
              {race.distance && (
                <>
                  <span className="text-emerald-900">•</span>
                  <span className="text-emerald-400 font-mono font-semibold">{race.distance}</span>
                </>
              )}
            </div>

            <h1 className="text-xs sm:text-base font-black text-white tracking-tight truncate">
              {race.name}
            </h1>
          </div>

          {/* Quick Runner Counter */}
          <div className="flex items-center gap-1.5 bg-[#050e0a] px-2 py-1 rounded-lg border border-emerald-900/50 shrink-0 text-[10px] font-mono">
            <span className="text-slate-400 uppercase font-bold text-[8px]">Runners:</span>
            <span className="font-black text-[#e5b869]">{race.horses.length}</span>
          </div>
        </div>
      </div>

      {/* ---------------- TABS: RUNNERS & ODDS / AI INSIGHTS / MY BETS ---------------- */}
      <div className="flex items-center justify-between border-b border-emerald-900/40 pb-1 gap-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            id="tab-runners-btn"
            onClick={() => {
              soundManager.playClick();
              setActiveTab('runners');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
              activeTab === 'runners'
                ? 'bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black font-black shadow-[0_0_8px_rgba(229,184,105,0.35)]'
                : 'bg-[#091510] text-slate-300 hover:text-white border border-emerald-900/40'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Odds Table ({race.horses.length})</span>
          </button>

          <button
            id="tab-insights-btn"
            onClick={() => {
              soundManager.playClick();
              setActiveTab('insights');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
              activeTab === 'insights'
                ? 'bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black font-black shadow-[0_0_8px_rgba(229,184,105,0.35)]'
                : 'bg-[#091510] text-slate-300 hover:text-white border border-emerald-900/40'
            }`}
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Form Insights</span>
          </button>

          <button
            id="tab-mybets-race-btn"
            onClick={() => {
              soundManager.playClick();
              setActiveTab('mybets');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
              activeTab === 'mybets'
                ? 'bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black font-black shadow-[0_0_8px_rgba(229,184,105,0.35)]'
                : 'bg-[#091510] text-slate-300 hover:text-white border border-emerald-900/40'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>My Bets ({userBetsForRace.length})</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-400">
          <Info className="w-3 h-3 text-amber-400" />
          <span>Click Odds to place Bet</span>
        </div>
      </div>

      {/* ---------------- TAB 1: 4-COLUMN ODDS TABLE (ULTRA COMPACT - FITS 15-20 RUNNERS) ---------------- */}
      {activeTab === 'runners' && (
        <div className="space-y-2">
          {race.status === 'RESULTED' && (
            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-lg ${
              isDeadHeat
                ? 'bg-gradient-to-r from-[#1c1404] via-[#241a05] to-[#120e03] border-amber-500/60 text-amber-200'
                : 'bg-[#091510] border-blue-500/40 text-blue-200'
            }`}>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm">
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="break-words">
                    {isDeadHeat
                      ? `Result: DEAD HEAT - 1st Place: ${p1Horses.map((h) => `No. ${h.horse_no || h.serial_no} ${h.name}`).join(' & ')}`
                      : `Official Winner: No. ${p1Horses[0]?.horse_no || p1Horses[0]?.serial_no} ${p1Horses[0]?.name || ''}`}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-amber-300/80 font-medium">
                  {isDeadHeat
                    ? '⚡ Settled as per Dead Heat Rule (Stake divided proportionally across tied runners)'
                    : 'Race resulted. Official payouts credited to winning tickets.'}
                </p>
              </div>
              {isDeadHeat && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider self-start sm:self-auto shrink-0 shadow">
                  Dead Heat Settlement
                </span>
              )}
            </div>
          )}

          {isUpcomingFixture && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/25 via-yellow-500/15 to-amber-500/25 border border-amber-500/50 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-lg animate-pulse">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="font-black text-amber-300 text-xs sm:text-sm uppercase tracking-wide">⚡ Betting to start 30 minutes prior to the race</p>
                  <p className="text-[11px] text-slate-300">Official Race Card • Post Time: {race.race_time}</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-black self-start sm:self-auto shrink-0 flex items-center gap-1 shadow">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>ODDS CLOSED</span>
              </span>
            </div>
          )}

          {!isOpen && !isUpcomingFixture && race.status !== 'RESULTED' && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {race.status === 'CLOSED'
                  ? 'Betting is closed. Runners are in-play.'
                  : 'Betting is currently closed for this race.'}
              </span>
            </div>
          )}

          {/* Exchange Odds Table Container */}
          <div className="overflow-hidden rounded-2xl border border-emerald-900/50 bg-[#07100b] shadow-xl">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-[#040805] border-b border-emerald-900/60 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-2 px-1 sm:px-2 w-[10%] sm:w-12 text-center text-slate-300">
                    No
                  </th>
                  <th className="py-2 px-1.5 sm:px-3 w-[54%] sm:w-auto text-slate-300">
                    Horse & Jockey / Trainer
                  </th>
                  <th className="py-2 px-1 sm:px-2 w-[18%] sm:w-28 text-center">
                    <div className="flex flex-col items-center leading-tight">
                      <span className="text-white font-black text-[10px] sm:text-xs">WIN Odds</span>
                      <span className="text-[8px] text-emerald-400 font-medium hidden sm:inline">1st place</span>
                    </div>
                  </th>
                  <th className="py-2 px-1 sm:px-2 w-[18%] sm:w-28 text-center">
                    <div className="flex flex-col items-center leading-tight">
                      <span className="text-white font-black text-[10px] sm:text-xs">PLACE Odds</span>
                      <span className="text-[8px] text-[#e5b869] font-medium hidden sm:inline">Top 3 place</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-950/70">
                {race.horses.map((horse) => {
                  const isP1 = p1Horses.some((h) => h.id === horse.id);
                  const isP2 = p2Horses.some((h) => h.id === horse.id);
                  const isP3 = p3Horses.some((h) => h.id === horse.id);
                  const isWinner = isP1;
                  const isSuspended = !!(horse.is_suspended || race.is_suspended || race.status === 'SUSPENDED');

                  return (
                    <tr
                      key={horse.id}
                      id={`horse-row-${horse.id}`}
                      className={`hover:bg-[#0c1c14] transition-colors ${
                        isWinner ? 'bg-amber-500/10' : isSuspended ? 'bg-rose-950/15 opacity-75' : ''
                      }`}
                    >
                      {/* Column 1: Serial No & Draw Gate */}
                      <td className="py-2 px-1 sm:px-2 text-center align-middle">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1">
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#040805] border border-emerald-500/30 text-[#e5b869] font-black text-[10px] sm:text-[11px] flex items-center justify-center font-mono shadow-inner">
                            {horse.horse_no || horse.serial_no}
                          </span>
                          {horse.gate_no !== undefined && (
                            <span className="text-[8px] sm:text-[9px] font-mono text-slate-400">
                              D{horse.gate_no}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 2: Horse Info, Silk, Jockey, Trainer, Form (Fully Visible Names) */}
                      <td className="py-2 px-1.5 sm:px-3 align-middle">
                        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                          <SilkIcon
                            color={horse.silk_color}
                            number={horse.horse_no || horse.serial_no}
                            size="sm"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap leading-tight">
                              <span className="font-bold text-white text-xs sm:text-sm tracking-tight break-words">
                                {horse.name}
                              </span>
                              {isSuspended && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[8px] sm:text-[9px] font-black uppercase">
                                  SUSPENDED
                                </span>
                              )}
                              {isP1 && (
                                <span className={`inline-flex items-center px-1.5 py-0.2 rounded font-black text-[8px] sm:text-[9px] uppercase shadow ${
                                  p1Horses.length > 1
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950'
                                    : 'bg-amber-500 text-slate-950'
                                }`}>
                                  🏆 1st {p1Horses.length > 1 ? '(DH)' : ''}
                                </span>
                              )}
                              {isP2 && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-slate-300 text-slate-950 font-black text-[8px] sm:text-[9px] uppercase shadow">
                                  🥈 2nd {p2Horses.length > 1 ? '(DH)' : ''}
                                </span>
                              )}
                              {isP3 && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-800 text-amber-200 font-black text-[8px] sm:text-[9px] uppercase shadow">
                                  🥉 3rd {p3Horses.length > 1 ? '(DH)' : ''}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] sm:text-[10px] text-slate-300 mt-0.5 leading-snug">
                              <span className="whitespace-normal">
                                J: <strong className="text-white font-semibold">{horse.jockey}</strong>
                              </span>
                              <span className="text-emerald-800">•</span>
                              <span className="whitespace-normal">
                                T: <strong className="text-slate-300 font-semibold">{horse.trainer}</strong>
                              </span>
                              {horse.form && (
                                <>
                                  <span className="text-emerald-800 hidden sm:inline">•</span>
                                  <span className="text-[#e5b869] font-mono font-bold text-[8px] sm:text-[9px] bg-[#1a170b] px-1 rounded border border-[#e5b869]/20 hidden sm:inline">
                                    {horse.form}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 3: WIN Odds Button */}
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center align-middle">
                        {isUpcomingFixture ? (
                          <div 
                            id={`win-odds-btn-${horse.id}`}
                            className="w-full py-1.5 sm:py-2 px-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 font-mono text-center flex flex-col items-center justify-center select-none shadow-inner"
                            title={`Betting opens ~30-45 mins before post time (${race.race_time}).`}
                          >
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 flex items-center justify-center gap-1 leading-tight font-mono">
                              <Lock className="w-2.5 h-2.5 text-slate-500" />
                              --
                            </span>
                            <span className="text-[7px] sm:text-[8px] text-slate-500 uppercase tracking-wider mt-0.5 font-bold">
                              Not Open
                            </span>
                          </div>
                        ) : isSuspended ? (
                          <div 
                            id={`win-odds-btn-${horse.id}`}
                            className="w-full py-1.5 sm:py-2 px-1 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-300 font-mono text-center flex flex-col items-center justify-center cursor-not-allowed select-none shadow-inner"
                            title="Odds are currently changing. Betting is temporarily suspended."
                          >
                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-rose-300 flex items-center gap-1 leading-tight">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Suspended
                            </span>
                            <span className="text-[7px] sm:text-[8px] text-rose-400/80 font-bold uppercase tracking-wider mt-0.5">
                              Paused
                            </span>
                          </div>
                        ) : race.status === 'RESULTED' ? (
                          <div 
                            id={`win-odds-btn-${horse.id}`}
                            className={`w-full py-1 sm:py-1.5 px-1 rounded-lg font-mono text-center flex flex-col items-center justify-center leading-none border ${
                              isWinner 
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-black' 
                                : 'bg-slate-900/60 border-slate-800 text-slate-400 font-bold'
                            }`}
                          >
                            <span className="text-xs sm:text-sm font-mono font-black">
                              {formatOdds(horse.win_odds, oddsFormat)}
                            </span>
                            <span className="text-[7px] sm:text-[8px] uppercase tracking-wider block font-bold opacity-75 mt-0.5">
                              {isWinner ? 'Winner' : 'Settled'}
                            </span>
                          </div>
                        ) : (
                          <button
                            id={`win-odds-btn-${horse.id}`}
                            onClick={() => handleOddsClick(horse, 'WIN', horse.win_odds)}
                            className="w-full py-1 sm:py-1.5 px-1 rounded-lg font-mono font-black text-xs sm:text-sm transition shadow active:scale-95 flex flex-col items-center justify-center leading-none bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-emerald-950/40 hover:scale-[1.02] cursor-pointer"
                          >
                            <span className="text-xs sm:text-sm font-mono font-black">
                              {formatOdds(horse.win_odds, oddsFormat)}
                            </span>
                            <span className="text-[7px] sm:text-[8px] uppercase tracking-wider block font-bold opacity-85 mt-0.5">
                              WIN
                            </span>
                          </button>
                        )}
                      </td>

                      {/* Column 4: PLACE Odds Button */}
                      <td className="py-1.5 sm:py-2 px-1 sm:px-2 text-center align-middle">
                        {isUpcomingFixture ? (
                          <div 
                            id={`place-odds-btn-${horse.id}`}
                            className="w-full py-1.5 sm:py-2 px-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 font-mono text-center flex flex-col items-center justify-center select-none shadow-inner"
                            title={`Betting opens ~30-45 mins before post time (${race.race_time}).`}
                          >
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 flex items-center justify-center gap-1 leading-tight font-mono">
                              <Lock className="w-2.5 h-2.5 text-slate-500" />
                              --
                            </span>
                            <span className="text-[7px] sm:text-[8px] text-slate-500 uppercase tracking-wider mt-0.5 font-bold">
                              Not Open
                            </span>
                          </div>
                        ) : isSuspended ? (
                          <div 
                            id={`place-odds-btn-${horse.id}`}
                            className="w-full py-1.5 sm:py-2 px-1 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-300 font-mono text-center flex flex-col items-center justify-center cursor-not-allowed select-none shadow-inner"
                            title="Odds are currently changing. Betting is temporarily suspended."
                          >
                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-rose-300 flex items-center gap-1 leading-tight">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Suspended
                            </span>
                            <span className="text-[7px] sm:text-[8px] text-rose-400/80 font-bold uppercase tracking-wider mt-0.5">
                              Paused
                            </span>
                          </div>
                        ) : race.status === 'RESULTED' ? (
                          <div 
                            id={`place-odds-btn-${horse.id}`}
                            className={`w-full py-1 sm:py-1.5 px-1 rounded-lg font-mono text-center flex flex-col items-center justify-center leading-none border ${
                              isP1 || isP2 || isP3 
                                ? 'bg-[#e5b869]/20 border-[#e5b869]/50 text-[#e5b869] font-black' 
                                : 'bg-slate-900/60 border-slate-800 text-slate-400 font-bold'
                            }`}
                          >
                            <span className="text-xs sm:text-sm font-mono font-black">
                              {formatOdds(horse.place_odds, oddsFormat)}
                            </span>
                            <span className="text-[7px] sm:text-[8px] uppercase tracking-wider block font-bold opacity-75 mt-0.5">
                              {isP1 || isP2 || isP3 ? 'Placed' : 'Settled'}
                            </span>
                          </div>
                        ) : (
                          <button
                            id={`place-odds-btn-${horse.id}`}
                            onClick={() => handleOddsClick(horse, 'PLACE', horse.place_odds)}
                            className="w-full py-1 sm:py-1.5 px-1 rounded-lg font-mono font-black text-xs sm:text-sm transition shadow active:scale-95 flex flex-col items-center justify-center leading-none bg-[#091510] hover:bg-[#15251d] text-[#e5b869] hover:text-[#f8dc9c] border border-[#e5b869]/60 shadow-[0_0_8px_rgba(229,184,105,0.2)] hover:scale-[1.02] cursor-pointer"
                          >
                            <span className="text-xs sm:text-sm font-mono font-black">
                              {formatOdds(horse.place_odds, oddsFormat)}
                            </span>
                            <span className="text-[7px] sm:text-[8px] uppercase tracking-wider block font-bold opacity-85 mt-0.5">
                              PLACE
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- TAB 2: EXPERT FORM INSIGHTS ---------------- */}
      {activeTab === 'insights' && (
        <div className="p-4 rounded-2xl bg-[#091510] border border-emerald-900/50 space-y-3 shadow-xl">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-white">Official Turf Form Analysis</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#040906] border border-amber-500/30 space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-400">🔥 Favorite Pick</span>
              <h4 className="text-xs font-bold text-white">#{race.horses[0]?.horse_no} {race.horses[0]?.name}</h4>
              <p className="text-slate-400 text-[11px]">Jockey: {race.horses[0]?.jockey} • Trainer: {race.horses[0]?.trainer}</p>
              <p className="text-slate-300 bg-[#091510] p-2 rounded-lg border border-emerald-950 text-[10px] mt-1">
                Fastest closing split in trial gallops. High strike rate jockey aboard.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#040906] border border-emerald-500/30 space-y-1">
              <span className="text-[10px] font-black uppercase text-emerald-400">⚡ Value Proposition</span>
              <h4 className="text-xs font-bold text-white">#{race.horses[1]?.horse_no} {race.horses[1]?.name}</h4>
              <p className="text-slate-400 text-[11px]">Jockey: {race.horses[1]?.jockey} • Odds: {formatOdds(race.horses[1]?.place_odds || 2.0, oddsFormat)}</p>
              <p className="text-slate-300 bg-[#091510] p-2 rounded-lg border border-emerald-950 text-[10px] mt-1">
                High consistency rating in top-3 placings across standard distances.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 3: MY BETS FOR THIS RACE ---------------- */}
      {activeTab === 'mybets' && (
        <div className="space-y-3">
          {userBetsForRace.length === 0 ? (
            <div className="text-center py-10 bg-[#091510]/80 rounded-2xl border border-emerald-900/40 p-5">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-200">No bets placed on this race yet</h3>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                Click any Win or Place odds from the table above to open the Bet Slip.
              </p>
              <button
                onClick={() => {
                  soundManager.playClick();
                  setActiveTab('runners');
                }}
                className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black font-black text-xs transition cursor-pointer"
              >
                View 4-Column Odds Table
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {userBetsForRace.map((bet) => (
                <div
                  key={bet.id}
                  className="bg-[#091510] border border-emerald-900/50 rounded-2xl p-3 space-y-2 shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-black border border-emerald-900/60 text-amber-400 font-black text-[11px] flex items-center justify-center font-mono">
                        #{bet.horse_no}
                      </span>
                      <h4 className="font-bold text-white text-xs sm:text-sm">{bet.horse_name}</h4>
                    </div>

                    {bet.status === 'PENDING' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black">
                        PENDING
                      </span>
                    )}
                    {bet.status === 'WON' && (
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${
                        bet.is_dead_heat
                          ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {bet.is_dead_heat ? `WON (Dead Heat 1/${bet.dead_heat_divider || 2}) (+₹${bet.payout?.toLocaleString('en-IN')})` : `WON (+₹${bet.payout?.toLocaleString('en-IN')})`}
                      </span>
                    )}
                    {bet.status === 'LOST' && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black">
                        LOST
                      </span>
                    )}
                  </div>

                  {bet.is_dead_heat && bet.status === 'WON' && (
                    <div className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                      <span>⚡ Settled as per Dead Heat Rule: Stake divided across {bet.dead_heat_divider || 2} tied winners.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1.5 bg-[#040805] p-2 rounded-xl text-[10px] font-mono">
                    <div>
                      <p className="text-slate-500 text-[9px]">Type</p>
                      <p className="font-bold text-slate-200">{bet.bet_type}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px]">Odds</p>
                      <p className="font-bold text-amber-400">{formatOdds(bet.odds, oddsFormat)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px]">Stake</p>
                      <p className="font-bold text-white">₹{bet.stake.toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-950">
                    <span className="text-slate-400">Potential Return:</span>
                    <span className="font-black text-emerald-400 font-mono text-xs">₹{bet.potential_win.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
