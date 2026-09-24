import React, { useState, useEffect } from 'react';
import { api, realtimeOdds, financialSync } from './services/api';
import { Banner, Bet, BetSlipState, BetType, Horse, Race, Transaction, User, UserNotification, DepositRequest, WithdrawalRequest } from './types';
import { Header } from './components/Header';
import { BannerSlider } from './components/BannerSlider';
import { RaceList } from './components/RaceList';
import { RaceDetail } from './components/RaceDetail';
import { BetSlipModal } from './components/BetSlipModal';
import { MyBets } from './components/MyBets';
import { DepositModal } from './components/DepositModal';
import { WithdrawModal } from './components/WithdrawModal';
import { AccountStatementModal } from './components/AccountStatementModal';
import { RecentResultsModal } from './components/RecentResultsModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { HelpModal } from './components/HelpModal';
import { HowToPlayRules } from './components/HowToPlayRules';
import { PersonalDetails } from './components/PersonalDetails';
import { NotificationModal } from './components/NotificationModal';
import { AuthModal } from './components/AuthModal';
import { AdminPortal } from './components/AdminPortal';
import { SubAdminPortal } from './components/SubAdminPortal';
import { BottomNav } from './components/BottomNav';
import { OddsFormat } from './utils/odds';
import { soundManager } from './utils/audio';
import { triggerConfetti } from './utils/confetti';
import { 
  Trophy, 
  CheckCircle2, 
  AlertCircle, 
  Flame, 
  Clock, 
  Sparkles,
  Shield,
  Search,
  X
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [races, setRaces] = useState<Race[]>(() => {
    try {
      const raw = localStorage.getItem('derby_races');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [banners, setBanners] = useState<Banner[]>(() => {
    try {
      const raw = localStorage.getItem('derby_banners');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  // Navigation & View state - Default home is Home (Race Lobby)
  const [activeTab, setActiveTab] = useState<'races' | 'rules' | 'mybets' | 'personal_details' | 'admin' | 'subadmin'>('races');
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [raceFilter, setRaceFilter] = useState<'all' | 'upcoming' | 'live' | 'resulted'>('upcoming');
  const [isLoadingRaces, setIsLoadingRaces] = useState(false);
  const [isLoadingBets, setIsLoadingBets] = useState(false);
  const [isLoadingTxs, setIsLoadingTxs] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Odds format preference
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>(() => {
    try {
      return (localStorage.getItem('derby_odds_format') as OddsFormat) || 'DECIMAL';
    } catch {
      return 'DECIMAL';
    }
  });

  const handleOddsFormatChange = (fmt: OddsFormat) => {
    setOddsFormat(fmt);
    try {
      localStorage.setItem('derby_odds_format', fmt);
    } catch {}
  };

  // Modals state
  const [betSlipData, setBetSlipData] = useState<BetSlipState | null>(null);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot_password'>('login');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    if (type === 'success') {
      soundManager.playChip();
    }
    setTimeout(() => setToast(null), 4000);
  };

  // Initial user check & URL Hash Routing for Admin Portal
  useEffect(() => {
    soundManager.init();
    const savedUser = localStorage.getItem('derby_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        api.getMe(parsed.id)
          .then((fresh) => {
            if (fresh) {
              setUser(fresh);
            } else {
              setUser(null);
            }
          })
          .catch(() => {
            setUser(null);
          });
      } catch (e) {
        console.error(e);
        setUser(null);
      }
    } else {
      setUser(null);
    }

    // Check hash on page load and on back/forward button clicks
    const checkHashRoute = () => {
      const rawHash = window.location.hash || '';
      const hash = rawHash.toLowerCase();

      if (hash === '#/admin' || hash === '#admin') {
        setSelectedRaceId(null);
        setActiveTab('admin');
      } else if (hash === '#/staff' || hash === '#staff' || hash === '#/subadmin' || hash === '#subadmin' || hash === '#/operator' || hash === '#operator') {
        setSelectedRaceId(null);
        setActiveTab('subadmin');
      } else if (hash.startsWith('#/race/') || hash.startsWith('#race/')) {
        const rId = rawHash.replace(/^#\/?race\//i, '');
        setSelectedRaceId(rId);
        setActiveTab('races');
      } else if (hash === '#/lobby' || hash === '#lobby' || hash === '#/' || hash === '#' || hash === '') {
        setSelectedRaceId(null);
        setActiveTab('races');
      } else if (hash === '#/mybets' || hash === '#mybets') {
        setSelectedRaceId(null);
        setActiveTab('mybets');
      } else if (hash === '#/personal_details' || hash === '#personal_details' || hash === '#/profile' || hash === '#profile') {
        setSelectedRaceId(null);
        setActiveTab('personal_details');
      } else if (hash === '#/rules' || hash === '#rules') {
        setSelectedRaceId(null);
        setActiveTab('rules');
      } else {
        setSelectedRaceId(null);
        setActiveTab('races');
      }
    };

    checkHashRoute();
    window.addEventListener('hashchange', checkHashRoute);
    window.addEventListener('popstate', checkHashRoute);

    // Administrative Keyboard Shortcut (Ctrl + Shift + A or Cmd + Shift + A)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        window.location.hash = '#/admin';
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('hashchange', checkHashRoute);
      window.removeEventListener('popstate', checkHashRoute);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch races & banners (100% flicker-free with deep equality check)
  const loadRacesAndBanners = async (isBackground = false) => {
    // Don't waste CPU/invocations if the browser tab is hidden in background
    if (isBackground && typeof document !== 'undefined' && document.hidden) {
      return;
    }

    try {
      if (!isBackground && races.length === 0) {
        setIsLoadingRaces(true);
      }

      const [racesData, bannersData] = await Promise.all([
        api.getRaces('all'),
        api.getBanners(),
      ]);
      if (racesData && Array.isArray(racesData)) {
        setRaces((prev) => (JSON.stringify(prev) === JSON.stringify(racesData) ? prev : racesData));
        try { localStorage.setItem('derby_races', JSON.stringify(racesData)); } catch {}
      }
      if (bannersData && Array.isArray(bannersData)) {
        setBanners((prev) => (JSON.stringify(prev) === JSON.stringify(bannersData) ? prev : bannersData));
        try { localStorage.setItem('derby_banners', JSON.stringify(bannersData)); } catch {}
      }
    } catch (err: any) {
      console.error('Error fetching races:', err);
    } finally {
      if (!isBackground) {
        setIsLoadingRaces(false);
      }
    }
  };

  useEffect(() => {
    loadRacesAndBanners(false);

    // Smart Polling: Polls every 3s when tab is actively visible (pauses automatically when tab is in background)
    const autoPoll = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadRacesAndBanners(true);
      }
    }, 3000);

    // Instantly refresh when user switches back to this tab
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadRacesAndBanners(true);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Subscribe to realtime odds changes and suspension updates
    const unsubscribe = realtimeOdds.subscribe((payload) => {
      if (payload.race) {
        setRaces((prev) => {
          const index = prev.findIndex((r) => r.id === payload.race.id);
          if (index !== -1) {
            const next = [...prev];
            next[index] = payload.race;
            return next;
          }
          return [payload.race, ...prev];
        });
      } else if (payload.race_id) {
        setRaces((prev) =>
          prev.map((r) => {
            if (r.id === payload.race_id) {
              if (payload.event === 'SUSPEND_ALL') {
                return {
                  ...r,
                  is_suspended: true,
                  horses: r.horses.map((h) => ({ ...h, is_suspended: true })),
                };
              }
              if (payload.event === 'RESUME_ALL') {
                return {
                  ...r,
                  is_suspended: false,
                  horses: payload.race?.horses || r.horses.map((h) => ({ ...h, is_suspended: false })),
                };
              }
              if (payload.horse_id) {
                return {
                  ...r,
                  horses: r.horses.map((h) =>
                    h.id === payload.horse_id
                      ? {
                          ...h,
                          is_suspended: payload.is_suspended !== undefined ? payload.is_suspended : h.is_suspended,
                          win_odds: payload.win_odds !== undefined ? payload.win_odds : h.win_odds,
                          place_odds: payload.place_odds !== undefined ? payload.place_odds : h.place_odds,
                        }
                      : h
                  ),
                };
              }
            }
            return r;
          })
        );
      }
    });

    return () => {
      clearInterval(autoPoll);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      unsubscribe();
    };
  }, []);

  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);

  // Fetch user notifications
  const loadNotifications = async () => {
    if (!user?.id) return;
    try {
      const data = await api.getNotifications(user.id);
      setNotifications((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
    } catch {}
  };

  // Fetch user bets, statement, deposits and withdrawals (flicker-free with equality check)
  const loadUserFinancials = async (isBackground = false) => {
    if (!user) {
      setMyBets([]);
      setTransactions([]);
      setNotifications([]);
      setDepositRequests([]);
      setWithdrawalRequests([]);
      return;
    }

    // Don't waste CPU/invocations if the browser tab is hidden in background
    if (isBackground && typeof document !== 'undefined' && document.hidden) {
      return;
    }

    try {
      if (!isBackground) {
        setIsLoadingBets(true);
        setIsLoadingTxs(true);
      }
      const [betsData, txsData, freshUser, notifsData, depData, wthData] = await Promise.all([
        api.getMyBets(user.id),
        api.getTransactions(user.id),
        api.getMe(user.id),
        api.getNotifications(user.id),
        api.getDepositRequests('ALL', user.id),
        api.getWithdrawalRequests('ALL', user.id),
      ]);
      setMyBets((prev) => (JSON.stringify(prev) === JSON.stringify(betsData) ? prev : betsData));
      setTransactions((prev) => (JSON.stringify(prev) === JSON.stringify(txsData) ? prev : txsData));
      if (freshUser) {
        if (user && freshUser.balance > user.balance) {
          const addedAmount = freshUser.balance - user.balance;
          soundManager.playWinPayout();
          showToast(`🎉 ₹${addedAmount.toLocaleString('en-IN')} added to your wallet! New Balance: ₹${freshUser.balance.toLocaleString('en-IN')}`, 'success');
        }
        setUser((prev) => (JSON.stringify(prev) === JSON.stringify(freshUser) ? prev : freshUser));
      }
      setNotifications((prev) => (JSON.stringify(prev) === JSON.stringify(notifsData) ? prev : notifsData));
      setDepositRequests((prev) => (JSON.stringify(prev) === JSON.stringify(depData) ? prev : depData));
      setWithdrawalRequests((prev) => (JSON.stringify(prev) === JSON.stringify(wthData) ? prev : wthData));
    } catch (err: any) {
      console.error('Error loading financials:', err);
    } finally {
      if (!isBackground) {
        setIsLoadingBets(false);
        setIsLoadingTxs(false);
      }
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadUserFinancials(false);

      // Realtime cross-tab & storage event subscription for instant sync
      const unsubscribe = financialSync.subscribe(() => {
        loadUserFinancials(true);
      });

      // Fast background polling every 3s when active tab is open for instant wallet credit & bet sync
      const pollInterval = setInterval(() => {
        loadUserFinancials(true);
      }, 3000);

      // Instantly refresh financials when user returns to tab
      const handleVisibilityOrFocus = () => {
        if (typeof document !== 'undefined' && !document.hidden) {
          loadUserFinancials(true);
        }
      };

      window.addEventListener('focus', handleVisibilityOrFocus);
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);

      return () => {
        unsubscribe();
        clearInterval(pollInterval);
        window.removeEventListener('focus', handleVisibilityOrFocus);
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      };
    }
  }, [user?.id]);

  const handleMarkNotificationRead = async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!user?.id) return;
    await api.markAllNotificationsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  // Handle Bet Click on Odds button
  const handleOpenBetSlip = (horse: Horse, betType: BetType, odds: number) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    const currentRace = races.find((r) => r.id === (selectedRaceId || horse.race_id));
    if (!currentRace) return;

    setBetSlipData({
      race: currentRace,
      horse,
      bet_type: betType,
      odds,
      stake: 500,
    });
  };

  // Submit bet (0ms instant optimistic deduction)
  const handleSubmitBet = async (params: {
    race_id: string;
    horse_id: string;
    bet_type: 'WIN' | 'PLACE';
    odds: number;
    stake: number;
  }) => {
    if (!user) throw new Error('Please login to place bets');

    // 0ms instant optimistic balance deduction
    const previousUser = user;
    const optimisticUser = {
      ...user,
      balance: Math.max(0, user.balance - params.stake),
      exposure: (user.exposure || 0) + params.stake,
    };
    setUser(optimisticUser);
    localStorage.setItem('derby_user', JSON.stringify(optimisticUser));
    soundManager.playChip();

    try {
      const res = await api.placeBet({
        ...params,
        user_id: user.id,
      });

      setUser(res.user);
      localStorage.setItem('derby_user', JSON.stringify(res.user));
      setMyBets((prev) => [res.bet, ...prev]);
      showToast(`Bet placed on #${res.bet.horse_no} ${res.bet.horse_name}! Stake: ₹${params.stake.toLocaleString('en-IN')}`);
      loadUserFinancials(true);
    } catch (err: any) {
      setUser(previousUser);
      localStorage.setItem('derby_user', JSON.stringify(previousUser));
      throw err;
    }
  };

  // Handle Deposit (Submits pending deposit with UTR and screenshot proof)
  const handleDeposit = async (amount: number, method: string, utr_number?: string, screenshot_url?: string) => {
    if (!user) throw new Error('User required');
    const res = await api.submitDepositRequest({
      userId: user.id,
      amount,
      paymentMethod: method,
      utrNumber: utr_number || `UTR${Date.now()}`,
      screenshotUrl: screenshot_url,
    });
    soundManager.playChip();
    showToast(res.message);
    loadUserFinancials();
    loadNotifications();
  };

  // Handle Withdraw (Submits pending withdrawal for Admin 120m SLA queue)
  const handleWithdraw = async (amount: number, details: { upi_id?: string; bank_account?: string; ifsc?: string; account_holder?: string }) => {
    if (!user) throw new Error('User required');
    const res = await api.submitWithdrawalRequest({
      userId: user.id,
      amount,
      details,
    });
    setUser(res.user);
    showToast(res.message);
    loadUserFinancials();
    loadNotifications();
  };

  const handleOpenDeposit = () => {
    if (!user) {
      setIsAuthOpen(true);
      showToast('Please sign in to deposit funds into your wallet', 'info');
      return;
    }
    setIsDepositOpen(true);
  };

  const handleOpenWithdraw = () => {
    if (!user) {
      setIsAuthOpen(true);
      showToast('Please sign in to request withdrawals', 'info');
      return;
    }
    setIsWithdrawOpen(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('derby_is_impersonating');
    api.logout();
    setUser(null);
    setMyBets([]);
    setTransactions([]);
    setDepositRequests([]);
    setWithdrawalRequests([]);
    window.location.hash = '#/rules';
    showToast('Signed out successfully', 'info');
  };

  const currentSelectedRace = selectedRaceId
    ? races.find((r) => r.id === selectedRaceId) || null
    : null;

  const pendingBetsCount = myBets.filter((b) => b.status === 'PENDING').length;

  // ---------------- DEDICATED STANDALONE ADMIN PORTAL (No Customer Nav/Header/Footer) ----------------
  if (activeTab === 'admin') {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-red-500 selection:text-white relative">
        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-6">
          <AdminPortal
            onBack={() => {
              window.location.hash = '#/lobby';
            }}
            races={races}
            banners={banners}
            onRefreshData={async () => {
              await loadRacesAndBanners();
              await loadUserFinancials();
            }}
            onImpersonateUser={(targetUser) => {
              setUser(targetUser);
              sessionStorage.setItem('derby_is_impersonating', 'true');
              localStorage.setItem('derby_user', JSON.stringify(targetUser));
              window.location.hash = '#/lobby';
              showToast(`Logged in as @${targetUser.username}`, 'success');
            }}
          />
        </main>
      </div>
    );
  }

  // ---------------- DEDICATED STANDALONE SUB-ADMIN / STAFF PORTAL (Different Page) ----------------
  if (activeTab === 'subadmin') {
    return (
      <div className="min-h-screen bg-[#06070d] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative">
        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-6">
          <SubAdminPortal
            onBack={() => {
              window.location.hash = '#/lobby';
            }}
            races={races}
            banners={banners}
            onRefreshData={async () => {
              await loadRacesAndBanners();
              await loadUserFinancials();
            }}
            onImpersonateUser={(targetUser) => {
              setUser(targetUser);
              sessionStorage.setItem('derby_is_impersonating', 'true');
              localStorage.setItem('derby_user', JSON.stringify(targetUser));
              window.location.hash = '#/lobby';
              showToast(`Logged in as @${targetUser.username}`, 'success');
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070c09] text-slate-100 flex flex-col font-sans selection:bg-[#e5b869] selection:text-black relative">
      
      {/* Admin Impersonation Active Banner */}
      {typeof window !== 'undefined' && sessionStorage.getItem('derby_is_impersonating') === 'true' && user && (
        <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-b-2 border-red-500/60 py-2 px-3 sm:px-6 flex items-center justify-between text-xs z-50 sticky top-0 shadow-2xl">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="text-slate-200 truncate">
              👁️ <strong className="text-red-400">Admin Impersonation Mode:</strong> Viewing as <strong className="text-white">@{user.username}</strong> ({user.full_name || 'Bettor'}) — Wallet: <strong className="text-emerald-400 font-mono">₹{user.balance.toLocaleString('en-IN')}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                sessionStorage.removeItem('derby_is_impersonating');
                window.location.hash = '#/admin';
              }}
              className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-md active:scale-95"
            >
              <span>Back to Admin Console</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------- 1. HEADER (Top bar layout common on all public pages) ---------------- */}
      <Header
        user={user}
        onOpenDeposit={handleOpenDeposit}
        onOpenWithdraw={handleOpenWithdraw}
        onOpenStatement={() => {
          loadUserFinancials();
          setIsStatementOpen(true);
        }}
        onOpenResults={() => setIsResultsOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenAuth={(mode = 'login') => {
          setAuthMode(mode);
          setIsAuthOpen(true);
        }}
        onLogout={handleLogout}
        onOpenAdmin={() => {
          window.location.hash = '#/admin';
        }}
        onGoHome={() => {
          window.location.hash = '#/lobby';
        }}
        onOpenMyBets={() => {
          window.location.hash = '#/mybets';
        }}
        onOpenRules={() => {
          window.location.hash = '#/rules';
        }}
        onOpenPersonalDetails={() => {
          loadUserFinancials();
          window.location.hash = '#/personal_details';
        }}
        onOpenNotifications={() => {
          loadNotifications();
          setIsNotificationsOpen(true);
        }}
        activeTab={activeTab}
        pendingBetsCount={pendingBetsCount}
        unreadNotificationsCount={notifications.filter(n => !n.is_read).length}
      />

      {/* ---------------- TOAST NOTIFICATION ---------------- */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-5 h-5 text-[#e5b869] shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ---------------- MAIN CONTAINER (PC / LAPTOP / TABLET / MOBILE) ---------------- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 md:pb-7">
        {activeTab === 'personal_details' ? (
          /* FULL PERSONAL DETAILS TAB (Full User Details, Balance vs Exposure, Statement, Security) */
          <PersonalDetails
            user={user}
            bets={myBets}
            transactions={transactions}
            depositRequests={depositRequests}
            withdrawalRequests={withdrawalRequests}
            onOpenDeposit={handleOpenDeposit}
            onOpenWithdraw={handleOpenWithdraw}
            onOpenChangePassword={() => setIsChangePasswordOpen(true)}
            onOpenAuth={() => setIsAuthOpen(true)}
            onLogout={handleLogout}
            onGoToLobby={() => {
              window.location.hash = '#/lobby';
            }}
          />
        ) : activeTab === 'mybets' ? (
          /* MY BETS / CONTEST SELECTIONS TAB ONLY */
          <MyBets
            bets={myBets}
            isLoading={isLoadingBets}
            oddsFormat={oddsFormat}
            onSelectRace={(raceId) => {
              window.location.hash = `#/race/${raceId}`;
            }}
            onGoToLobby={() => {
              window.location.hash = '#/lobby';
            }}
          />
        ) : currentSelectedRace ? (
          /* RACE DETAIL VIEW */
          <RaceDetail
            race={currentSelectedRace}
            onBack={() => {
              if (window.location.hash.startsWith('#/race/')) {
                window.location.hash = '#/lobby';
              } else {
                setSelectedRaceId(null);
              }
            }}
            onSelectBet={handleOpenBetSlip}
            userBetsForRace={myBets.filter((b) => b.race_id === currentSelectedRace.id)}
            onOpenMyBets={() => {
              window.location.hash = '#/mybets';
            }}
            onOpenAuth={() => setIsAuthOpen(true)}
            isLoggedIn={!!user}
            oddsFormat={oddsFormat}
          />
        ) : activeTab === 'rules' ? (
          /* HOW TO PLAY & RULES VIEW: Banner at top + Rules below banner */
          <div className="space-y-6">
            <BannerSlider
              banners={banners}
              onSelectRace={(raceId) => {
                window.location.hash = `#/race/${raceId}`;
              }}
              onOpenDeposit={handleOpenDeposit}
            />
            <HowToPlayRules
              onGoToLobby={() => {
                soundManager.playClick();
                window.location.hash = '#/lobby';
              }}
              onOpenDeposit={handleOpenDeposit}
            />
          </div>
        ) : (
          /* RACE LOBBY: Direct race fixtures and live betting with promotional banner */
          <RaceList
            races={races}
            banners={banners}
            onSelectRace={(raceId) => {
              window.location.hash = `#/race/${raceId}`;
            }}
            onOpenDeposit={handleOpenDeposit}
            filterStatus={raceFilter}
            onChangeFilter={setRaceFilter}
            isLoading={isLoadingRaces}
            oddsFormat={oddsFormat}
            onOpenSearch={() => setSearchModalOpen(true)}
          />
        )}
      </main>

      {/* ---------------- FOOTER (PC / Laptop Full Width) ---------------- */}
      <footer className="mt-auto border-t border-slate-800 bg-[#070a0e] py-8 text-xs text-slate-500 pb-28 md:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 border border-rose-500/30 flex items-center justify-center font-bold">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-300">Horse Racing Betting Exchange</p>
              <p className="text-[11px] text-slate-500">Live Odds, WIN / PLACE Markets & Instant Settlement Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-5 text-slate-400">
            <button onClick={() => setIsHelpOpen(true)} className="hover:text-rose-400 transition cursor-pointer">
              Betting Rules
            </button>
            <button onClick={() => setIsResultsOpen(true)} className="hover:text-rose-400 transition cursor-pointer">
              Official Results
            </button>
          </div>
        </div>
      </footer>

      {/* ---------------- MODALS ---------------- */}

      {/* Search Overlay Modal */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-rose-500" />
                Global Race Search
              </h3>
              <button
                onClick={() => setSearchModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search by race name, track venue, horse, or jockey..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {races
                .filter((r) =>
                  r.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
                  r.venue.toLowerCase().includes(globalSearch.toLowerCase()) ||
                  r.horses.some((h) => h.name.toLowerCase().includes(globalSearch.toLowerCase()))
                )
                .slice(0, 6)
                .map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedRaceId(r.id);
                      setActiveTab('races');
                      setSearchModalOpen(false);
                    }}
                    className="p-3 rounded-2xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 flex items-center justify-between cursor-pointer transition"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.venue} • {r.race_time}</p>
                    </div>
                    <span className="text-xs text-rose-400 font-black">Open Market →</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Bet Slip Modal (SRS Spec) */}
      <BetSlipModal
        betSlip={betSlipData}
        user={user}
        onClose={() => setBetSlipData(null)}
        onSubmitBet={handleSubmitBet}
        onOpenDeposit={() => {
          setBetSlipData(null);
          setIsDepositOpen(true);
        }}
        oddsFormat={oddsFormat}
      />

      {/* Deposit Modal */}
      <DepositModal
        user={user}
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        onDeposit={handleDeposit}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        user={user}
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        onWithdraw={handleWithdraw}
      />

      {/* Account Statement Modal */}
      <AccountStatementModal
        transactions={transactions}
        depositRequests={depositRequests}
        withdrawalRequests={withdrawalRequests}
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        isLoading={isLoadingTxs}
      />

      {/* Recent Results Modal */}
      <RecentResultsModal
        races={races}
        isOpen={isResultsOpen}
        onClose={() => setIsResultsOpen(false)}
        onSelectRace={(raceId) => {
          setSelectedRaceId(raceId);
          setActiveTab('races');
        }}
      />

      {/* Change Password Modal */}
      {user && (
        <ChangePasswordModal
          userId={user.id}
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      )}

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Activity Notifications Modal */}
      <NotificationModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationRead}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
      />

      {/* Auth Modal (Sign Up with OTP + Login with Username/Password) */}
      <AuthModal
        key={authMode + (isAuthOpen ? '1' : '0')}
        isOpen={isAuthOpen}
        defaultMode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(newUser) => {
          setUser(newUser);
          showToast(`🎉 Welcome @${newUser.username}! ₹50 welcome bonus credited to your wallet.`, 'success');
          loadUserFinancials();
        }}
      />

      {/* ---------------- MOBILE BOTTOM NAVIGATION BAR (Screens < md) ---------------- */}
      <BottomNav
        activeTab={activeTab}
        pendingBetsCount={pendingBetsCount}
        onGoHome={() => {
          window.location.hash = '#/lobby';
        }}
        onOpenMyBets={() => {
          window.location.hash = '#/mybets';
        }}
        onOpenDeposit={handleOpenDeposit}
        onOpenResults={() => setIsResultsOpen(true)}
        onOpenProfile={() => {
          if (user) {
            loadUserFinancials();
            window.location.hash = '#/personal_details';
          } else {
            setAuthMode('login');
            setIsAuthOpen(true);
          }
        }}
        onOpenAdmin={() => {
          window.location.hash = '#/admin';
        }}
        isAdmin={user?.role === 'ADMIN' || sessionStorage.getItem('derby_admin_authenticated') === 'true'}
        isLoggedIn={!!user}
      />
    </div>
  );
}
