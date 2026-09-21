import React, { useState, useMemo, useEffect } from 'react';
import { Banner, Horse, Race, RaceStatus } from '../types';
import { SilkIcon } from './SilkIcon';
import { BannerSlider } from './BannerSlider';
import { OddsFormat, formatOdds } from '../utils/odds';
import { soundManager } from '../utils/audio';
import { 
  Heart, 
  MapPin, 
  Clock, 
  ArrowRight, 
  Star, 
  Search, 
  Flame, 
  Trophy, 
  CheckCircle2, 
  AlertCircle,
  Sliders,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Zap,
  Layers,
  Calendar, 
  ShieldCheck,
  ImageIcon
} from 'lucide-react';

interface RaceListProps {
  races: Race[];
  banners?: Banner[];
  onSelectRace: (raceId: string) => void;
  onOpenDeposit?: () => void;
  filterStatus: 'all' | 'upcoming' | 'live' | 'resulted';
  onChangeFilter: (status: 'all' | 'upcoming' | 'live' | 'resulted') => void;
  isLoading: boolean;
  oddsFormat?: OddsFormat;
  onOpenSearch?: () => void;
}

export const RaceList: React.FC<RaceListProps> = ({
  races,
  banners = [],
  onSelectRace,
  onOpenDeposit,
  filterStatus,
  onChangeFilter,
  isLoading,
  oddsFormat = 'DECIMAL',
}) => {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCenter, setSelectedCenter] = useState<string>('all');
  const [showAllNewRacing, setShowAllNewRacing] = useState(false);

  // User App Race List strictly displays published races (excluding drafts)
  const publicRaces = useMemo(() => {
    return races.filter((r) => r.status && r.status !== 'DRAFT');
  }, [races]);

  // Dynamically extract active centers strictly from today's published races
  const activeCentersWithRaces = useMemo(() => {
    const centerMap = new Map<string, { id: string; name: string; count: number; hasLive: boolean }>();
    
    publicRaces.forEach((r) => {
      const venueName = r.venue ? r.venue.trim().toUpperCase() : 'MAIN TURF';
      const centerKey = (r.center_id || venueName).toLowerCase();
      
      if (!centerMap.has(centerKey)) {
        centerMap.set(centerKey, {
          id: r.center_id || centerKey,
          name: venueName,
          count: 0,
          hasLive: false,
        });
      }
      const entry = centerMap.get(centerKey)!;
      entry.count += 1;
      if (r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING') {
        entry.hasLive = true;
      }
    });

    return Array.from(centerMap.values());
  }, [publicRaces]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager.playClick();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredRaces = useMemo(() => {
    return publicRaces.filter((race) => {
      const matchesSearch =
        !searchQuery ||
        race.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        race.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        race.horses.some((h) => h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.jockey.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (selectedCenter !== 'all') {
        const centerNameKey = selectedCenter.replace('cntr_', '').toLowerCase();
        const matchesCenter = 
          race.center_id === selectedCenter || 
          (race.venue && race.venue.toLowerCase().includes(centerNameKey));
        if (!matchesCenter) return false;
      }

      if (filterStatus === 'upcoming') {
        return (race.status === 'UPCOMING' || race.status === 'OPEN' || !race.status);
      }
      if (filterStatus === 'live') {
        return race.status === 'LIVE' || race.status === 'OPEN_FOR_BETTING';
      }
      if (filterStatus === 'resulted') {
        return race.status === 'RESULTED' || race.status === 'CLOSED';
      }
      return true;
    });
  }, [publicRaces, searchQuery, selectedCenter, filterStatus]);

  // 1st: Live In-Play Races (Open for live betting)
  const liveRaces = filteredRaces.filter(
    (r) => r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING'
  );

  // 2nd: Upcoming Races (Scheduled for today, published for user view with odds closed)
  const upcomingRaces = filteredRaces.filter(
    (r) =>
      (r.status === 'UPCOMING' || r.status === 'OPEN' || !r.status) &&
      r.status !== 'RESULTED' &&
      r.status !== 'CLOSED' &&
      r.status !== 'LIVE' &&
      r.status !== 'OPEN_FOR_BETTING'
  );

  // 3rd: Recent Results & Settled Races (Completed, resulted, payouts distributed)
  const recentResultsRaces = filteredRaces.filter(
    (r) => r.status === 'RESULTED' || r.status === 'CLOSED'
  );

  // Market Movers only from strictly LIVE in-play races
  const liveMarketMovers = useMemo(() => {
    const liveOrOpenRaces = publicRaces.filter((r) => r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING');
    return liveOrOpenRaces
      .flatMap((r) => (r.horses || []).map((h) => ({ horse: h, race: r })))
      .filter(({ horse }) => !horse.is_suspended && !horse.is_scratched && (horse.win_odds || 0) > 0)
      .slice(0, 4);
  }, [publicRaces]);

  // Featured Live Race for Turf Insights
  const featuredLiveRace = useMemo(() => {
    return publicRaces.find((r) => r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING') || (publicRaces.length > 0 ? publicRaces[0] : null);
  }, [publicRaces]);

  const getStatusBadge = (status: RaceStatus) => {
    switch (status) {
      case 'LIVE':
      case 'OPEN_FOR_BETTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 text-xs font-black uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            🟢 LIVE / OPEN FOR BETTING
          </span>
        );
      case 'OPEN':
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700 text-xs font-bold uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            ⏱ Upcoming
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/50 text-xs font-bold uppercase tracking-wider">
            📝 Draft
          </span>
        );
      case 'CLOSED':
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5" />
            Betting Closed
          </span>
        );
      case 'RESULTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            Resulted
          </span>
        );
    }
  };

  const raceImages = [
    '/images/race_action.jpg',
    '/images/jockey_hero.jpg',
    '/images/horse_runner.jpg',
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ---------------- 1. TOP PROMOTIONAL BANNER SLIDER (Admin Uploaded) ---------------- */}
      {banners && banners.length > 0 && (
        <div className="w-full">
          <BannerSlider
            banners={banners}
            onSelectRace={onSelectRace}
            onOpenDeposit={onOpenDeposit}
          />
        </div>
      )}
      
      {/* ---------------- ACTIVE CENTER / TODAY'S RACE CARD BANNER ---------------- */}
      {publicRaces.length > 0 && (
        activeCentersWithRaces.length > 1 ? (
          // Multi-center day (Rare occasion: 2+ centers hosting races today)
          <div className="space-y-2 bg-[#06100b] p-3 rounded-2xl border border-emerald-900/60 shadow-lg">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="flex items-center gap-1.5 text-emerald-400 font-black">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Today's Active Race Centers ({activeCentersWithRaces.length} Venues):</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <button
                id="center-tab-all"
                onClick={() => {
                  soundManager.playClick();
                  setSelectedCenter('all');
                }}
                className={`px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 border ${
                  selectedCenter === 'all'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-[1.02]'
                    : 'bg-[#091510] text-slate-300 border-emerald-950 hover:text-white'
                }`}
              >
                <span>ALL VENUES</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950/40 text-slate-300">
                  {publicRaces.length}
                </span>
              </button>
              {activeCentersWithRaces.map((cntr) => {
                const isSelected = selectedCenter === cntr.id;
                return (
                  <button
                    key={cntr.id}
                    id={`center-tab-${cntr.id}`}
                    onClick={() => {
                      soundManager.playClick();
                      setSelectedCenter(cntr.id);
                    }}
                    className={`px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 border ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-[1.02]'
                        : cntr.hasLive
                        ? 'bg-[#0b1c14] text-emerald-300 border-emerald-500/50 hover:bg-[#10291d]'
                        : 'bg-[#091510] text-slate-300 border-emerald-950 hover:text-white'
                    }`}
                  >
                    {cntr.hasLive && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                    <span>{cntr.name}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-slate-950/40 text-slate-950 font-black' : 'bg-slate-900 text-slate-400'
                    }`}>
                      {cntr.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          // Standard single center race day banner (Bangalore / Mysore / etc.)
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#06140e] via-[#091b13] to-[#040c08] border border-emerald-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 font-black shadow-md shrink-0">
                <MapPin className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5">
                    <span>{activeCentersWithRaces[0]?.name || (publicRaces[0]?.venue ? publicRaces[0].venue.toUpperCase() : 'TURF CLUB')}</span>
                    <span className="text-emerald-400">•</span>
                    <span className="text-[#e5b869]">TODAY'S RACE CARD</span>
                  </h2>
                  {activeCentersWithRaces[0]?.hasLive && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 text-[9px] font-black uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Live Betting In-Play
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {activeCentersWithRaces[0]?.count || publicRaces.length} Fixtures Scheduled for today • Live Decimal Odds & Pre-Post Betting Open
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 font-mono font-bold text-xs">
                {publicRaces.length} Races Today
              </span>
            </div>
          </div>
        )
      )}

      {/* ---------------- TOP BANNER / SEARCH BAR ---------------- */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-emerald-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search runners, jockeys, venues (e.g. Bangalore, 1200m)..."
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-[#091510] border border-emerald-900/50 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[#091510] p-1.5 rounded-2xl border border-emerald-900/50 text-xs font-bold overflow-x-auto scrollbar-none shadow-inner">
          <button
            id="tab-filter-upcoming"
            onClick={() => {
              soundManager.playClick();
              onChangeFilter('upcoming');
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'upcoming'
                ? 'bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black font-black shadow-[0_0_12px_rgba(229,184,105,0.4)]'
                : 'text-slate-300 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Upcoming ({publicRaces.filter((r) => r.status === 'UPCOMING' || r.status === 'OPEN' || !r.status).length})</span>
          </button>

          <button
            id="tab-filter-live"
            onClick={() => {
              soundManager.playClick();
              onChangeFilter('live');
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'live'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                : 'text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>🔴 Live & Open ({publicRaces.filter((r) => r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING').length})</span>
          </button>

          <button
            id="tab-filter-resulted"
            onClick={() => {
              soundManager.playClick();
              onChangeFilter('resulted');
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'resulted'
                ? 'bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black font-black shadow-[0_0_12px_rgba(229,184,105,0.4)]'
                : 'text-slate-300 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Completed ({publicRaces.filter((r) => r.status === 'RESULTED' || r.status === 'CLOSED').length})</span>
          </button>

          <button
            id="tab-filter-all"
            onClick={() => {
              soundManager.playClick();
              onChangeFilter('all');
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
              filterStatus === 'all'
                ? 'bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black font-black shadow-[0_0_12px_rgba(229,184,105,0.4)]'
                : 'text-slate-300 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            <span>All Races ({publicRaces.length})</span>
          </button>
        </div>
      </div>

      {/* ---------------- PC & LAPTOP DUAL COLUMN LAYOUT ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: 3-Tier Races Hierarchy (8 cols on PC) */}
        <div className="lg:col-span-8 space-y-6">
          
          {isLoading ? (
            <div className="py-16 text-center text-slate-500">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-semibold">Loading race fixtures...</p>
            </div>
          ) : filteredRaces.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 rounded-3xl border-2 border-emerald-900/40">
              <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-300">No races found for this selection</p>
              <p className="text-xs text-slate-500 mt-1">Try switching venue or filter tabs.</p>
            </div>
          ) : (
            <>
              {/* ======================================================== */}
              {/* 1ST: 🔴 LIVE RACES (Open For Betting)                    */}
              {/* ======================================================== */}
              {(filterStatus === 'all' || filterStatus === 'live') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b border-emerald-500/40">
                    <div className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-rose-500" />
                      <h2 className="text-base sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                        <span>Featured Racing Fixtures</span>
                        <span className="text-xs font-bold text-rose-300 bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-500/40">
                          LIVE IN-PLAY
                        </span>
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChangeFilter('all')}
                      className="text-xs font-bold text-slate-400 hover:text-emerald-300 transition"
                    >
                      See All →
                    </button>
                  </div>

                  {liveRaces.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#040e08]/90 border-2 border-emerald-900/60 text-slate-400 text-xs flex items-center justify-between shadow-inner">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>No race is currently running in-play. Check upcoming race fixtures below.</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold hidden sm:inline">
                        Next Race Ready
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {liveRaces.map((race) => (
                        <div
                          key={`live-${race.id}`}
                          id={`race-card-${race.id}`}
                          onClick={() => {
                            soundManager.playClick();
                            onSelectRace(race.id);
                          }}
                          className="group relative overflow-hidden rounded-2xl sm:rounded-3xl min-h-[205px] sm:min-h-[250px] md:min-h-[275px] flex flex-col justify-between p-3.5 sm:p-5 shadow-2xl cursor-pointer border-2 border-emerald-500/40 transition-all duration-300 hover:border-emerald-300 hover:scale-[1.008] hover:shadow-[0_0_30px_rgba(16,185,129,0.35)]"
                        >
                          {/* Full-Bleed Cinematic Background Image */}
                          <img
                            src={race.image_url || '/images/race_action.jpg'}
                            alt={race.name}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/race_action.jpg';
                            }}
                            className="absolute inset-0 w-full h-full object-cover brightness-[0.68] group-hover:scale-105 group-hover:brightness-[0.76] transition-all duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#020905] via-[#020905]/45 to-black/30 pointer-events-none" />

                          {/* Top Row: Live Pill Badge + Favorite Heart Button */}
                          <div className="relative z-10 flex items-center justify-between gap-2">
                            {race.is_suspended || race.horses.every((h) => h.is_suspended) ? (
                              <span className="px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-amber-500 text-black font-black text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg backdrop-blur-md border border-amber-300">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>🚫 ODDS CHANGING / SUSPENDED</span>
                              </span>
                            ) : (
                              <span className="px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-rose-600/90 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg backdrop-blur-md border border-rose-400/50">
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white" />
                                <span>LIVE IN-PLAY</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => toggleFavorite(race.id, e)}
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition backdrop-blur-md border ${
                                favorites[race.id]
                                  ? 'bg-rose-500 text-white border-rose-400 shadow-lg'
                                  : 'bg-black/40 text-slate-300 border-white/20 hover:bg-black/60 hover:text-white'
                              }`}
                            >
                              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${favorites[race.id] ? 'fill-current' : ''}`} />
                            </button>
                          </div>

                          {/* Bottom Overlay Content */}
                          <div className="relative z-10 space-y-1.5 sm:space-y-2 pt-8 sm:pt-12">
                            {/* Race Title */}
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-base sm:text-xl md:text-2xl font-black text-white group-hover:text-emerald-300 transition tracking-tight drop-shadow-md leading-snug">
                                {race.name}
                              </h3>
                              {race.race_no && (
                                <span className="px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-lg font-mono font-black text-[10px] sm:text-xs bg-emerald-500 text-slate-950 border border-emerald-300 shadow shrink-0">
                                  #{race.race_no}
                                </span>
                              )}
                            </div>

                            {/* Middle Line: Location & Distance */}
                            <div className="flex items-center justify-between text-[11px] sm:text-sm font-semibold pt-0.5">
                              <span className="flex items-center gap-1.5 text-rose-300 font-bold truncate max-w-[200px] sm:max-w-none">
                                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
                                <span>{race.venue}</span>
                              </span>
                              {race.distance && (
                                <span className="font-mono font-black text-[#e5b869] text-xs sm:text-sm uppercase shrink-0">
                                  {race.distance}
                                </span>
                              )}
                            </div>

                            {/* Bottom Line: Post Time & Runners Count */}
                            <div className="flex items-center justify-between text-[11px] sm:text-sm font-medium pt-0.5 text-slate-300 border-t border-white/10">
                              <span className="flex items-center gap-1.5 font-mono text-slate-300">
                                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                                <span>{race.race_time} - {race.date_str || 'Today, 5th Sep'}</span>
                              </span>
                              <span className="font-bold text-rose-400 group-hover:text-rose-300 transition flex items-center gap-1 font-mono shrink-0">
                                <span>{race.horses.length} Runners</span>
                                <span>→</span>
                              </span>
                            </div>

                            {/* Quick Runners & Live Odds Strip */}
                            {race.horses.length > 0 && (
                              <div className="pt-2 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-0.5 text-xs scrollbar-none">
                                <span className="text-[9px] sm:text-[10px] uppercase font-black text-emerald-400 whitespace-nowrap">
                                  Live Odds:
                                </span>
                                {race.horses.slice(0, 5).map((h) => {
                                  const isHorseSusp = !!(h.is_suspended || race.is_suspended);
                                  return (
                                    <div
                                      key={h.id}
                                      className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-xl border backdrop-blur-md whitespace-nowrap shadow-inner ${
                                        isHorseSusp
                                          ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                                          : 'border-white/15 bg-black/60 text-slate-200'
                                      }`}
                                    >
                                      <SilkIcon
                                        color={h.silk_color}
                                        number={h.horse_no || h.serial_no}
                                        size="sm"
                                      />
                                      <span className="font-bold truncate max-w-[85px] sm:max-w-[110px] text-[11px] sm:text-xs">
                                        {h.name}
                                      </span>
                                      {isHorseSusp ? (
                                        <span className="px-1.5 py-0.5 rounded-md font-black font-mono text-[9px] sm:text-[10px] bg-amber-500/30 text-amber-300 border border-amber-500/40">
                                          SUSP
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded-md font-black font-mono text-[10px] sm:text-[11px] bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                                          {formatOdds(h.win_odds, oddsFormat)}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                                {race.horses.length > 5 && (
                                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 whitespace-nowrap pl-1">
                                    +{race.horses.length - 5} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ======================================================== */}
              {/* 2ND: ⏱ UPCOMING RACES (Scheduled for Today)              */}
              {/* ======================================================== */}
              {(filterStatus === 'all' || filterStatus === 'upcoming') && (
                <div className="space-y-4 pt-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-emerald-900/60">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-300" />
                      <h2 className="text-base sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                        <span>⏱ Upcoming Racing Fixtures</span>
                        <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                          SCHEDULED
                        </span>
                      </h2>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Opened sequentially by admin after previous race finishes
                    </p>
                  </div>

                  {upcomingRaces.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-900/40 border-2 border-emerald-900/40 text-slate-400 text-xs text-center">
                      No upcoming scheduled races remaining for today.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {upcomingRaces.map((race) => (
                        <div
                          key={`upcoming-${race.id}`}
                          id={`race-card-${race.id}`}
                          onClick={() => {
                            soundManager.playClick();
                            onSelectRace(race.id);
                          }}
                          className="group relative overflow-hidden rounded-2xl sm:rounded-3xl min-h-[205px] sm:min-h-[250px] md:min-h-[275px] flex flex-col justify-between p-3.5 sm:p-5 shadow-xl cursor-pointer border-2 border-emerald-700/60 transition-all duration-300 hover:border-emerald-400 hover:scale-[1.008] hover:shadow-[0_0_25px_rgba(16,185,129,0.25)]"
                        >
                          {/* Full-Bleed Background Image */}
                          <img
                            src={race.image_url || '/images/jockey_hero.jpg'}
                            alt={race.name}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/race_action.jpg';
                            }}
                            className="absolute inset-0 w-full h-full object-cover brightness-[0.62] group-hover:scale-105 group-hover:brightness-[0.72] transition-all duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#020905] via-[#020905]/45 to-black/30 pointer-events-none" />

                            {/* Top Row: Upcoming Badge + Favorite Button */}
                          <div className="relative z-10 flex items-center justify-between gap-2">
                            <span className="px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-slate-900/90 text-slate-300 font-bold text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md backdrop-blur-md border border-slate-700">
                              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#e5b869]" />
                              <span>⏱ RACE CARD • POST: {race.race_time}</span>
                            </span>

                            <button
                              type="button"
                              onClick={(e) => toggleFavorite(race.id, e)}
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition backdrop-blur-md border ${
                                favorites[race.id]
                                  ? 'bg-rose-500 text-white border-rose-400 shadow-lg'
                                  : 'bg-black/40 text-slate-300 border-white/20 hover:bg-black/60 hover:text-white'
                              }`}
                            >
                              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${favorites[race.id] ? 'fill-current' : ''}`} />
                            </button>
                          </div>

                          {/* Bottom Overlay Content */}
                          <div className="relative z-10 space-y-1.5 sm:space-y-2 pt-8 sm:pt-12">
                            {/* Race Title */}
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-base sm:text-xl md:text-2xl font-black text-white group-hover:text-emerald-300 transition tracking-tight drop-shadow-md leading-snug">
                                {race.name}
                              </h3>
                              {race.race_no && (
                                <span className="px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-lg font-mono font-bold text-[10px] sm:text-xs bg-slate-900/90 text-slate-200 border border-slate-700 shadow shrink-0">
                                  RACE #{race.race_no}
                                </span>
                              )}
                            </div>

                            {/* Middle Line: Location & Distance */}
                            <div className="flex items-center justify-between text-[11px] sm:text-sm font-semibold pt-0.5">
                              <span className="flex items-center gap-1.5 text-[#e5b869] font-bold truncate max-w-[200px] sm:max-w-none">
                                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e5b869] shrink-0" />
                                <span>{race.venue}</span>
                              </span>
                              {race.distance && (
                                <span className="font-mono font-black text-[#e5b869] text-xs sm:text-sm uppercase shrink-0">
                                  {race.distance}
                                </span>
                              )}
                            </div>

                            {/* Flash message: "Betting to start 30 minutes prior to the race" */}
                            <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-xl bg-gradient-to-r from-amber-500/25 via-yellow-500/15 to-amber-500/25 border border-amber-500/50 text-amber-200 text-[11px] sm:text-xs font-black uppercase tracking-wide animate-pulse shadow-md">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="truncate">⚡ Betting to start 30 minutes prior to the race</span>
                            </div>

                            {/* Bottom Line: Post Time & Runners Count */}
                            <div className="flex items-center justify-between text-[11px] sm:text-sm font-medium pt-0.5 text-slate-300 border-t border-white/10">
                              <span className="flex items-center gap-1.5 font-mono text-slate-300">
                                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                                <span>{race.race_time} - {race.date_str || 'Today'}</span>
                              </span>
                              <span className="font-bold text-[#e5b869] group-hover:text-amber-300 transition flex items-center gap-1 font-mono shrink-0">
                                <span>{race.horses.length} Runners</span>
                                <span>→</span>
                              </span>
                            </div>

                            {/* Runner Preview Strip */}
                            {race.horses.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-0.5 text-xs scrollbar-none">
                                <span className="text-[9px] sm:text-[10px] uppercase font-black text-slate-400 whitespace-nowrap">
                                  Runners:
                                </span>
                                {race.horses.slice(0, 4).map((h) => (
                                  <div
                                    key={h.id}
                                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-xl border border-white/10 bg-black/60 backdrop-blur-md whitespace-nowrap"
                                  >
                                    <SilkIcon
                                      color={h.silk_color}
                                      number={h.horse_no || h.serial_no}
                                      size="sm"
                                    />
                                    <span className="font-bold text-slate-200 truncate max-w-[85px] sm:max-w-[100px] text-[11px] sm:text-xs">
                                      {h.name}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded-md font-bold font-mono text-[9px] sm:text-[10px] bg-slate-900/90 text-slate-400 border border-slate-700/60" title={`Draw/Gate: ${h.gate_no || h.horse_no || h.serial_no}`}>
                                      D{h.gate_no !== undefined ? h.gate_no : (h.horse_no || h.serial_no)}
                                    </span>
                                  </div>
                                ))}
                                {race.horses.length > 4 && (
                                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 whitespace-nowrap pl-1">
                                    +{race.horses.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ======================================================== */}
              {/* 3RD: 🏆 RECENT RESULTS & SETTLED RACES                   */}
              {/* ======================================================== */}
              {(filterStatus === 'all' || filterStatus === 'resulted') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between pb-1 border-b border-amber-500/40">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-[#e5b869]" />
                      <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                        <span>3RD • 🏆 RECENT RESULTS</span>
                        <span className="text-xs font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/40">
                          SETTLED & PAID
                        </span>
                      </h2>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {recentResultsRaces.length} Completed
                    </span>
                  </div>

                  {recentResultsRaces.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#0e110a]/90 border-2 border-amber-950/60 text-slate-400 text-xs text-center">
                      No resulted races yet. Once a race is declared official by stewards, results appear here.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {recentResultsRaces.map((race) => {
                        const winnerHorse = race.winner_horse_id
                          ? race.horses.find((h) => h.id === race.winner_horse_id)
                          : null;

                        return (
                          <div
                            key={`result-${race.id}`}
                            id={`race-card-${race.id}`}
                            onClick={() => {
                              soundManager.playClick();
                              onSelectRace(race.id);
                            }}
                            className="group rounded-3xl p-4 sm:p-5 transition-all duration-200 shadow-md cursor-pointer border-2 border-amber-500/50 bg-[#0a140d] hover:border-amber-400 hover:scale-[1.005]"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  {race.race_no && (
                                    <span className="px-2.5 py-0.5 rounded-lg font-mono font-bold text-[11px] bg-slate-900 text-slate-300 border border-slate-700">
                                      RACE #{race.race_no}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1 text-[#e5b869] font-black bg-[#1a170b] px-2.5 py-0.5 rounded-lg border border-[#e5b869]/30">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {race.venue}
                                  </span>
                                  <span className="text-emerald-900">•</span>
                                  <span className="text-slate-300 font-mono font-semibold">
                                    {race.race_time}
                                  </span>
                                </div>

                                <h3 className="text-base sm:text-lg font-black text-slate-200 group-hover:text-white transition">
                                  {race.name}
                                </h3>

                                {winnerHorse && (
                                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-300 font-bold">
                                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>Winner: <strong>#{winnerHorse.horse_no || winnerHorse.serial_no} {winnerHorse.name}</strong></span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-950/40">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs font-bold uppercase tracking-wider">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                                  Official Result
                                </span>

                                <button
                                  id={`race-result-btn-${race.id}`}
                                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 shrink-0"
                                >
                                  <span>View Payouts</span>
                                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>

        {/* RIGHT COLUMN (PC & Laptop Sidebar - 4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Market Movers Card */}
          <div className="rounded-3xl bg-slate-900 border-2 border-emerald-900/60 p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-rose-500" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Live Market Movers
              </h3>
            </div>
            {liveMarketMovers.length > 0 ? (
              <div className="space-y-2.5 text-xs">
                {liveMarketMovers.map(({ horse, race }) => (
                  <div key={`${race.id}_${horse.id}`} className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{horse.name}</p>
                      <p className="text-[11px] text-slate-400">{race.venue} • #{horse.horse_no || horse.serial_no}</p>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                      {formatOdds(horse.win_odds, oddsFormat)} (Active)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-400 text-xs text-center space-y-1.5">
                <p className="font-semibold text-slate-300">No Live Market Movers</p>
                <p className="text-[11px] text-slate-500">Live price steamers and in-play market movers will appear here once races go live.</p>
              </div>
            )}
          </div>

          {/* Turf Expert Punter Insights Card */}
          <div className="rounded-3xl bg-gradient-to-br from-[#1a0c10] via-slate-900 to-slate-900 border-2 border-red-500/40 p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-400" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Turf Exchange Insights
              </h3>
            </div>
            {featuredLiveRace && featuredLiveRace.horses && featuredLiveRace.horses.length > 0 ? (
              <>
                <p className="text-xs text-slate-300">
                  Top featured runner for {featuredLiveRace.name}:
                </p>
                <div className="p-3 rounded-2xl bg-slate-950/90 border border-red-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white">{featuredLiveRace.name}</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">Odds {formatOdds(featuredLiveRace.horses[0].win_odds, oddsFormat)}</span>
                  </div>
                  <p className="text-xs font-bold text-amber-300">#{featuredLiveRace.horses[0].horse_no || 1} {featuredLiveRace.horses[0].name} (J: {featuredLiveRace.horses[0].jockey || 'TBD'})</p>
                  <p className="text-[11px] text-slate-400">{featuredLiveRace.venue} • {featuredLiveRace.distance || 'Official Distance'}</p>
                </div>
              </>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-red-500/30 space-y-1.5 text-xs text-slate-300 text-center">
                <p className="font-bold text-white">No Live Exchange Insights</p>
                <p className="text-[11px] text-slate-400">Real-time Win & Place payout calculations and expert insights will appear here when fixtures are live.</p>
              </div>
            )}
          </div>

          {/* Quick Racing Rules & Integrity */}
          <div className="rounded-3xl bg-slate-900 border-2 border-emerald-900/60 p-5 shadow-xl space-y-2.5 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-white font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Official Exchange Rules</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-[11px]">
              <li>WIN bets settle when horse finishes 1st.</li>
              <li>PLACE bets settle for Top 3 placings.</li>
              <li>Instant wallet credits upon official result declaration.</li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
};
