import React, { useState, useEffect } from 'react';
import { api, financialSync, DEFAULT_RACE_CENTERS } from '../services/api';
import { soundManager } from '../utils/audio';
import { getRaceBettingCloseStatus, formatAutoCloseTime } from '../utils/raceTiming';
import { Banner, Bet, Horse, Race, RaceCenter, RaceDay, RaceStatus, User, DepositRequest, WithdrawalRequest, DepositStatus, WithdrawalStatus, Transaction } from '../types';
import {
  Shield,
  Trophy,
  Plus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Edit3,
  Trash2,
  Upload,
  Users,
  Search,
  Coins,
  ArrowLeft,
  RefreshCw,
  Sliders,
  Sparkles,
  Mail,
  Phone,
  TrendingUp,
  Image as ImageIcon,
  X,
  FileText,
  MapPin,
  Clock,
  RotateCcw,
  Flame,
  Play,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  CheckCheck,
  Eye,
  Smartphone,
  Building2,
  Timer,
  CreditCard,
  Banknote,
  Layers,
  Globe,
  CalendarCheck,
  Flag,
  Lock,
  KeyRound,
  EyeOff,
  ShieldCheck,
  Minus,
  Bookmark
} from 'lucide-react';

interface AdminPanelProps {
  onBack: () => void;
  races: Race[];
  banners: Banner[];
  onRefreshData: () => Promise<void>;
  onImpersonateUser?: (user: User) => void;
}

// Preset matching the user's handwritten race sheet
const HORSE_IMAGE_PRESETS = [
  { id: 'action', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80', label: 'Galloping Action (Golden Hour)' },
  { id: 'jockey', url: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=600&q=80', label: 'Jockey Silk Hero' },
  { id: 'runner', url: 'https://images.unsplash.com/photo-1566251037378-5e04e3bec343?auto=format&fit=crop&w=600&q=80', label: 'Dark Turf Thoroughbred' },
];

const HANDWRITTEN_SHEET_PRESET = {
  name: 'The Star Future Cup',
  race_no: 7,
  venue: 'Bangalore Turf Club',
  race_time: '1:45 PM',
  distance: '1600m',
  going: 'Good',
  class_grade: 'Grade 2 • 3yo Terms',
  horses: [
    { serial_no: 1, gate_no: 5, name: 'Speed Princess', jockey: 'Kumar', trainer: 'Srikant', win_odds: 2.50, place_odds: 1.40, silk_color: '#dc2626' },
    { serial_no: 2, gate_no: 2, name: 'Royal Commander', jockey: 'Suraj Narredu', trainer: 'S. Padmanabhan', win_odds: 3.75, place_odds: 1.90, silk_color: '#2563eb' },
    { serial_no: 3, gate_no: 4, name: 'Golden Arrow', jockey: 'A. Sandesh', trainer: 'Prasanna Kumar', win_odds: 10.0, place_odds: 2.50, silk_color: '#16a34a' },
    { serial_no: 4, gate_no: 1, name: 'Thunder Bolt', jockey: 'P. Trevor', trainer: 'P. Shroff', win_odds: 8.0, place_odds: 1.75, silk_color: '#d97706' },
    { serial_no: 5, gate_no: 3, name: 'Mystic Star', jockey: 'C. S. Jodha', trainer: 'Dallas Todywalla', win_odds: 6.0, place_odds: 1.25, silk_color: '#7c3aed' },
    { serial_no: 6, gate_no: 6, name: 'Silver Lining', jockey: 'Neeraj Rawal', trainer: 'Imtiaz Sait', win_odds: 25.0, place_odds: 4.0, silk_color: '#0891b2' },
    { serial_no: 7, gate_no: 7, name: 'Fire Blade', jockey: 'Imran Chisty', trainer: 'Narendra Lagad', win_odds: 5.0, place_odds: 2.0, silk_color: '#e11d48' },
  ],
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onBack,
  races: initialRaces,
  banners,
  onRefreshData,
  onImpersonateUser,
}) => {
  const [races, setRaces] = useState<Race[]>(initialRaces || []);

  useEffect(() => {
    if (initialRaces && Array.isArray(initialRaces)) {
      setRaces((prev) => (JSON.stringify(prev) === JSON.stringify(initialRaces) ? prev : initialRaces));
    }
  }, [initialRaces]);

  const currentAdminRole = (typeof window !== 'undefined' ? sessionStorage.getItem('derby_admin_role') : null) || 'SUPER_ADMIN';
  const isOddsOnlyStaff = currentAdminRole === 'ODDS_MANAGER';

  const [activeTab, setActiveTab] = useState<'live' | 'saved' | 'upcoming' | 'finished' | 'lifecycle' | 'odds' | 'masters' | 'add_race' | 'banners' | 'users' | 'bets' | 'financials' | 'system' | 'races'>('live');

  useEffect(() => {
    if (isOddsOnlyStaff && (activeTab === 'users' || activeTab === 'financials' || activeTab === 'system' || activeTab === 'bets' || activeTab === 'banners' || activeTab === 'masters')) {
      setActiveTab('live');
    }
  }, [isOddsOnlyStaff, activeTab]);

  const [adminRaceFilter, setAdminRaceFilter] = useState<'all' | 'upcoming' | 'live' | 'resulted'>('all');
  const [selectedCenterFilter, setSelectedCenterFilter] = useState<string>('all');
  const [auditRace, setAuditRace] = useState<Race | null>(null);
  const [auditBetSearch, setAuditBetSearch] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  // New Checklist State additions
  const [systemSettings, setSystemSettings] = useState<{ betting_enabled: boolean; emergency_message?: string; announcement?: string; max_bet_per_horse?: number; max_win_per_race?: number; min_bet_amount?: number; sub_admins?: any[] }>({ betting_enabled: true, max_bet_per_horse: 50000, max_win_per_race: 500000, min_bet_amount: 100, sub_admins: [] });
  const [selectedRiskRaceId, setSelectedRiskRaceId] = useState<string>('');
  const [limitMaxBet, setLimitMaxBet] = useState<string>('50000');
  const [limitMaxWin, setLimitMaxWin] = useState<string>('500000');
  const [limitMinBet, setLimitMinBet] = useState<string>('100');
  const [announcementText, setAnnouncementText] = useState<string>('');
  const [addUserModalOpen, setAddUserModalOpen] = useState<boolean>(false);
  const [newUserData, setNewUserData] = useState({ full_name: '', username: '', phone: '', email: '', password: '', initial_balance: '0' });
  const [viewBetsUser, setViewBetsUser] = useState<User | null>(null);
  const [viewLedgerUser, setViewLedgerUser] = useState<User | null>(null);
  const [ledgerTransactions, setLedgerTransactions] = useState<Transaction[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState<boolean>(false);
  const [oddsHistoryModalHorse, setOddsHistoryModalHorse] = useState<{ horse: Horse; race: Race } | null>(null);
  const [quickAddHorseRace, setQuickAddHorseRace] = useState<Race | null>(null);
  const [quickHorseData, setQuickHorseData] = useState({ name: '', jockey: '', trainer: '', gate_no: '', horse_no: '', win_odds: '2.50', place_odds: '1.40' });
  const [subAdminModalOpen, setSubAdminModalOpen] = useState<boolean>(false);
  const [newSubAdminData, setNewSubAdminData] = useState({ username: '', name: '', password: '', role: 'ODDS_MANAGER' });
  const [betsSearchQuery, setBetsSearchQuery] = useState<string>('');

  // Master Admin Security / Password Change States
  const [adminCurrentPassword, setAdminCurrentPassword] = useState<string>('');
  const [adminNewPassword, setAdminNewPassword] = useState<string>('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState<string>('');
  const [showAdminCurrentPass, setShowAdminCurrentPass] = useState<boolean>(false);
  const [showAdminNewPass, setShowAdminNewPass] = useState<boolean>(false);
  const [showAdminConfirmPass, setShowAdminConfirmPass] = useState<boolean>(false);
  const [adminPassSuccess, setAdminPassSuccess] = useState<boolean>(false);
  const [adminPassError, setAdminPassError] = useState<string | null>(null);
  const [adminPassLoading, setAdminPassLoading] = useState<boolean>(false);

  // Helper: 24h (HH:mm) <-> 12h (h:mm A) for native clock picker
  const format24To12 = (time24: string): string => {
    if (!time24) return '';
    const clean = time24.trim();
    if (clean.toUpperCase().includes('AM') || clean.toUpperCase().includes('PM')) {
      return clean;
    }
    const [hStr, mStr] = clean.split(':');
    let hours = parseInt(hStr, 10);
    const minutes = mStr ? mStr.padStart(2, '0') : '00';
    if (isNaN(hours)) return time24;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    return `${hours}:${minutes} ${ampm}`;
  };

  const format12To24 = (time12: string): string => {
    if (!time12) return '';
    const clean = time12.trim();
    if (!clean.toUpperCase().includes('AM') && !clean.toUpperCase().includes('PM')) {
      const parts = clean.split(':');
      if (parts.length === 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
      return clean;
    }
    const parts = clean.split(' ');
    const timePart = parts[0];
    const modifier = parts[1]?.toUpperCase();
    const [hStr, mStr] = timePart.split(':');
    let hours = parseInt(hStr, 10);
    const minutes = mStr ? mStr.padStart(2, '0') : '00';
    if (isNaN(hours)) return '';
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  };

  // Real-time race timer helper
  const getRaceCountdown = (timeStr: string) => {
    try {
      if (!timeStr) return 'Post Time Scheduled';
      const now = new Date();
      const clean = timeStr.trim();
      let hours = 0;
      let minutes = 0;

      if (clean.toUpperCase().includes('PM') || clean.toUpperCase().includes('AM')) {
        const parts = clean.split(' ');
        const timePart = parts[0];
        const modifier = parts[1]?.toUpperCase();
        const [h, m] = timePart.split(':').map(Number);
        hours = h || 0;
        minutes = m || 0;
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
      } else {
        const [h, m] = clean.split(':').map(Number);
        hours = h || 0;
        minutes = m || 0;
      }

      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) return '🏁 Ready for Post Time';
      const diffMins = Math.floor(diff / 60000);
      const diffSecs = Math.floor((diff % 60000) / 1000);
      if (diffMins > 60) {
        const diffHours = Math.floor(diffMins / 60);
        return `⏱ Starts in ${diffHours}h ${diffMins % 60}m`;
      }
      return `⏱ Starts in ${diffMins}m ${diffSecs}s`;
    } catch {
      return `⏱ Post Time: ${timeStr}`;
    }
  };

  const getRaceBets = (raceId: string) => (allBets || []).filter(b => b.race_id === raceId);
  const getRaceTurnover = (raceId: string) => getRaceBets(raceId).reduce((sum, b) => sum + (b.amount || 0), 0);
  const getRacePayouts = (raceId: string) => getRaceBets(raceId).reduce((sum, b) => sum + (b.payout_amount || 0), 0);


  // Masters: Level 1 (Centers) & Level 2 (Race Days) state
  const [raceCenters, setRaceCenters] = useState<RaceCenter[]>(() => {
    try {
      const cached = localStorage.getItem('derby_race_centers');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_RACE_CENTERS;
  });
  const [raceDays, setRaceDays] = useState<RaceDay[]>([]);
  const [selectedManageCenterId, setSelectedManageCenterId] = useState<string>(() => {
    try {
      return localStorage.getItem('derby_admin_selected_center') || 'cntr_mysore';
    } catch {
      return 'cntr_mysore';
    }
  });
  const [showAddCenterForm, setShowAddCenterForm] = useState<boolean>(false);
  const [newCenterName, setNewCenterName] = useState('');
  const [newCenterCode, setNewCenterCode] = useState('');
  const [newCenterCity, setNewCenterCity] = useState('');
  const [newDayCenterId, setNewDayCenterId] = useState<string>(() => {
    try {
      return localStorage.getItem('derby_admin_selected_center') || 'cntr_mysore';
    } catch {
      return 'cntr_mysore';
    }
  });
  const [newDayDate, setNewDayDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDayTitle, setNewDayTitle] = useState('');

  // Center Edit Modal State
  const [editingCenter, setEditingCenter] = useState<RaceCenter | null>(null);
  const [editCenterName, setEditCenterName] = useState('');
  const [editCenterCode, setEditCenterCode] = useState('');
  const [editCenterCity, setEditCenterCity] = useState('');
  const [editCenterActive, setEditCenterActive] = useState(true);

  // Race Day Edit Modal State
  const [editingDay, setEditingDay] = useState<RaceDay | null>(null);
  const [editDayTitle, setEditDayTitle] = useState('');
  const [editDayDate, setEditDayDate] = useState('');
  const [editDayCenterId, setEditDayCenterId] = useState('');
  const [editDayStatus, setEditDayStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED');

  const [users, setUsers] = useState<User[]>(() => {
    try {
      const cached = localStorage.getItem('derby_admin_users');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [allBets, setAllBets] = useState<Bet[]>(() => {
    try {
      const cached = localStorage.getItem('derby_admin_bets');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [stats, setStats] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('derby_admin_stats');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'warning' | 'error' | 'info' } | null>(null);

  const notify = (message: string, type: 'success' | 'warning' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    if (type === 'error' || type === 'warning') {
      soundManager.playClick();
    }
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  };

  const handleImageFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImageCallback: (val: string) => void,
    label = 'Banner'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please select a valid image file (PNG, JPG, JPEG, WEBP, GIF)', 'warning');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      notify('Image size exceeds 15MB limit. Please choose a smaller image.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageCallback(reader.result);
        notify(`✅ ${label} image "${file.name}" loaded successfully!`, 'success');
      }
    };
    reader.onerror = () => {
      notify('Failed to process image file. Please try another image.', 'error');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Section 6: Financial requests & P/L state
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [financialSubTab, setFinancialSubTab] = useState<'OVERVIEW' | 'DEPOSITS' | 'WITHDRAWALS' | 'PNL_REPORT' | 'CREDIT_DEBIT'>('OVERVIEW');
  const [depositStatusFilter, setDepositStatusFilter] = useState<DepositStatus | 'ALL'>('ALL');
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState<WithdrawalStatus | 'ALL'>('ALL');
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [selectedOddsRaceId, setSelectedOddsRaceId] = useState<string>('');
  const [editingHorseId, setEditingHorseId] = useState<string | null>(null);
  const [cockpitViewMode, setCockpitViewMode] = useState<'BOARD' | 'MARKET' | 'SPLIT'>('BOARD');
  const [pnlDateFilter, setPnlDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'LAST7' | 'ALL' | 'CUSTOM'>('TODAY');
  const [pnlCustomDate, setPnlCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [quickAdjustUserId, setQuickAdjustUserId] = useState<string>('');
  const [quickAdjustAmount, setQuickAdjustAmount] = useState<string>('1000');
  const [quickAdjustType, setQuickAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [quickAdjustDesc, setQuickAdjustDesc] = useState<string>('');

  // Settlement dialog state (Dead Heat Enabled, 1st/2nd/3rd/4th Dropdowns)
  const [settlingRace, setSettlingRace] = useState<Race | null>(null);
  const [settlePositions, setSettlePositions] = useState<Record<string, 1 | 2 | 3 | 4 | 0>>({});
  const [settleViewMode, setSettleViewMode] = useState<'DROPDOWN' | 'RUNNERS'>('DROPDOWN');
  const [settleDeadHeatMode, setSettleDeadHeatMode] = useState<boolean>(false);
  const [isSettledSuccess, setIsSettledSuccess] = useState<boolean>(false);

  // Add Race Form state (Clean Blank by Default)
  const [newRaceName, setNewRaceName] = useState('');
  const [newRaceNo, setNewRaceNo] = useState<number | string>('1');
  const [newRaceCenterId, setNewRaceCenterId] = useState<string>(() => {
    try {
      return localStorage.getItem('derby_admin_selected_center') || 'cntr_mysore';
    } catch {
      return 'cntr_mysore';
    }
  });
  const [newRaceDayId, setNewRaceDayId] = useState('');
  const [newVenue, setNewVenue] = useState('Mysore Turf Club');
  const [newTime, setNewTime] = useState('');
  const [newDistance, setNewDistance] = useState('');
  const [newGoing, setNewGoing] = useState('Good');
  const [newClassGrade, setNewClassGrade] = useState('Grade 1 • Terms');
  const [newRaceImage, setNewRaceImage] = useState('/images/race_action.jpg');
  const [newRaceStatus, setNewRaceStatus] = useState<RaceStatus>('DRAFT');
  const [newHorses, setNewHorses] = useState<any[]>([
    { serial_no: 1, gate_no: 1, name: '', jockey: '', trainer: '', win_odds: 2.5, place_odds: 1.5, silk_color: '#dc2626' }
  ]);

  const handleSelectCenter = (centerId: string) => {
    if (!centerId) return;
    try {
      localStorage.setItem('derby_admin_selected_center', centerId);
    } catch {}
    setSelectedManageCenterId(centerId);
    setNewDayCenterId(centerId);
    setNewRaceCenterId(centerId);
    const center = (raceCenters || []).find((c) => c.id === centerId);
    if (center) {
      setNewVenue(`${center.name} Turf Club`);
    }
    const matchingDays = (raceDays || []).filter((d) => d.center_id === centerId);
    if (matchingDays.length > 0) {
      setNewRaceDayId(matchingDays[0].id);
    } else {
      setNewRaceDayId('');
    }
  };

  // Race Creation Success Modal state (Interactive direct buttons)
  const [createdRaceSuccessModal, setCreatedRaceSuccessModal] = useState<{
    isOpen: boolean;
    raceName: string;
    raceNo: number;
    status: RaceStatus;
    runnersCount: number;
  } | null>(null);

  // Custom UI Confirmation Action Modal State (Replaces native browser window.confirm popups)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'primary' | 'success';
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const requestConfirm = (options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'primary' | 'success';
    onConfirm: () => void | Promise<void>;
  }) => {
    soundManager.playClick();
    setConfirmModal({
      isOpen: true,
      title: options.title || 'Confirm Action',
      message: options.message,
      confirmText: options.confirmText || 'Yes, Confirm',
      cancelText: options.cancelText || 'Cancel',
      variant: options.variant || 'danger',
      onConfirm: options.onConfirm,
    });
  };

  // Edit Race Modal state (Manual Edit)
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [editRaceName, setEditRaceName] = useState('');
  const [editRaceNo, setEditRaceNo] = useState<number | string>('');
  const [editRaceCenterId, setEditRaceCenterId] = useState('');
  const [editRaceDayId, setEditRaceDayId] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDistance, setEditDistance] = useState('');
  const [editGoing, setEditGoing] = useState('');
  const [editClassGrade, setEditClassGrade] = useState('');
  const [editRaceImage, setEditRaceImage] = useState('/images/race_action.jpg');
  const [editRaceStatus, setEditRaceStatus] = useState<RaceStatus>('UPCOMING');
  const [editHorses, setEditHorses] = useState<any[]>([]);

  // Bulk Paste Horses State
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkPasteTarget, setBulkPasteTarget] = useState<'new' | 'edit'>('new');
  const [bulkPasteText, setBulkPasteText] = useState('');

  // Universal Bulk Runner Text Parser (supports: No-Gate-Name-Jockey-Trainer, tabs, CSV, pipes, WhatsApp text, odds)
  const parseBulkRunnersText = (rawText: string) => {
    let clean = rawText.trim();
    if (clean.startsWith('(') && clean.endsWith(')')) {
      clean = clean.slice(1, -1).trim();
    }

    const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedRunners: any[] = [];
    const silkColors = [
      '#e11d48', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
      '#ec4899', '#f97316', '#64748b', '#14b8a6', '#a855f7', '#84cc16',
      '#0ea5e9', '#d97706', '#ef4444', '#10b981'
    ];

    lines.forEach((line, index) => {
      const rawLine = line.trim();
      if (!rawLine) return;

      // Extract odds from end of line if present (e.g. "2.50 1.40" or "2.5, 1.4")
      let cleanLine = rawLine;
      let extractedWin: number | null = null;
      let extractedPlace: number | null = null;
      const oddsEndMatch = cleanLine.match(/[\s,\|]+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)$/);
      if (oddsEndMatch) {
        extractedWin = parseFloat(oddsEndMatch[1]);
        extractedPlace = parseFloat(oddsEndMatch[2]);
        cleanLine = cleanLine.slice(0, oddsEndMatch.index).trim();
      }

      // Check parentheses for gate (e.g. "1 (5) CARNATION" or "(5) CARNATION")
      let extractedGate: number | null = null;
      const parenMatch = cleanLine.match(/^\s*(\d+)?\s*\(([0-9]+)\)/);
      if (parenMatch) {
        if (parenMatch[2]) extractedGate = parseInt(parenMatch[2], 10);
        cleanLine = cleanLine.replace(/^\s*(\d+)?\s*\(([0-9]+)\)/, '').trim();
      }

      // Determine delimiter: Tab, Pipe, Semicolon, Comma, ' - ', or single hyphen '-'
      let parts: string[] = [];
      if (cleanLine.includes('\t')) {
        parts = cleanLine.split('\t');
      } else if (cleanLine.includes('|')) {
        parts = cleanLine.split('|');
      } else if (cleanLine.includes(';')) {
        parts = cleanLine.split(';');
      } else if (cleanLine.includes(',')) {
        parts = cleanLine.split(',');
      } else if (cleanLine.includes(' - ')) {
        parts = cleanLine.split(' - ');
      } else if (cleanLine.includes('-') && cleanLine.split('-').length >= 3) {
        // Hyphen delimited e.g. "1-5-CARNATION-Abhishek Mhatre-Neil Darashah"
        parts = cleanLine.split('-');
      } else if (/\s{2,}/.test(cleanLine)) {
        parts = cleanLine.split(/\s{2,}/);
      } else if (cleanLine.includes('-')) {
        parts = cleanLine.split('-');
      } else {
        parts = [cleanLine];
      }

      parts = parts.map((p) => p.trim()).filter(Boolean);

      let horseNo = index + 1;
      let gateNo = extractedGate || (index + 1);
      let name = '';
      let jockey = 'TBD';
      let trainer = 'TBD';

      if (parts.length >= 5) {
        const num1 = parseInt(parts[0], 10);
        const num2 = parseInt(parts[1], 10);
        if (!isNaN(num1) && !isNaN(num2)) {
          // ["1", "5", "CARNATION", "Abhishek Mhatre", "Neil Darashah"]
          horseNo = num1;
          gateNo = num2;
          name = parts[2];
          jockey = parts[3];
          trainer = parts.slice(4).join(' - ');
        } else if (!isNaN(num1)) {
          // ["1", "CARNATION", "Abhishek Mhatre", "Neil Darashah", ...]
          horseNo = num1;
          gateNo = extractedGate || num1;
          name = parts[1];
          jockey = parts[2];
          trainer = parts.slice(3).join(' - ');
        } else {
          name = parts[0];
          jockey = parts[1];
          trainer = parts.slice(2).join(' - ');
        }
      } else if (parts.length === 4) {
        const num1 = parseInt(parts[0], 10);
        const num2 = parseInt(parts[1], 10);
        if (!isNaN(num1) && !isNaN(num2)) {
          // ["1", "5", "CARNATION", "Abhishek Mhatre"]
          horseNo = num1;
          gateNo = num2;
          name = parts[2];
          jockey = parts[3];
        } else if (!isNaN(num1)) {
          // ["1", "CARNATION", "Abhishek Mhatre", "Neil Darashah"]
          horseNo = num1;
          gateNo = extractedGate || num1;
          name = parts[1];
          jockey = parts[2];
          trainer = parts[3];
        } else {
          name = parts[0];
          jockey = parts[1];
          trainer = parts[2];
        }
      } else if (parts.length === 3) {
        const num1 = parseInt(parts[0], 10);
        const num2 = parseInt(parts[1], 10);
        if (!isNaN(num1) && !isNaN(num2)) {
          // ["1", "5", "CARNATION"]
          horseNo = num1;
          gateNo = num2;
          name = parts[2];
        } else if (!isNaN(num1)) {
          // ["1", "CARNATION", "Abhishek Mhatre"]
          horseNo = num1;
          gateNo = extractedGate || num1;
          name = parts[1];
          jockey = parts[2];
        } else {
          name = parts[0];
          jockey = parts[1];
          trainer = parts[2];
        }
      } else if (parts.length === 2) {
        const num1 = parseInt(parts[0], 10);
        if (!isNaN(num1)) {
          horseNo = num1;
          gateNo = extractedGate || num1;
          name = parts[1];
        } else {
          name = parts[0];
          jockey = parts[1];
        }
      } else if (parts.length === 1) {
        const spaceParts = parts[0].split(/\s+/).filter(Boolean);
        if (spaceParts.length >= 3 && !isNaN(parseInt(spaceParts[0], 10)) && !isNaN(parseInt(spaceParts[1], 10))) {
          horseNo = parseInt(spaceParts[0], 10);
          gateNo = parseInt(spaceParts[1], 10);
          name = spaceParts[2];
          jockey = spaceParts[3] || 'TBD';
          trainer = spaceParts.slice(4).join(' ') || 'TBD';
        } else if (spaceParts.length >= 2 && !isNaN(parseInt(spaceParts[0], 10))) {
          horseNo = parseInt(spaceParts[0], 10);
          gateNo = extractedGate || horseNo;
          name = spaceParts[1];
          jockey = spaceParts[2] || 'TBD';
          trainer = spaceParts.slice(3).join(' ') || 'TBD';
        } else {
          name = parts[0];
        }
      }

      // Clean prefix tags like "J:", "Jockey:", "T:", "Trainer:", "Drw:"
      name = (name || '').replace(/^(Horse|H|Name):\s*/i, '').trim();
      jockey = (jockey || '').replace(/^(Jockey|J|Jk):\s*/i, '').trim();
      trainer = (trainer || '').replace(/^(Trainer|T|Tr):\s*/i, '').trim();

      if (name) {
        const initialWin = extractedWin || Number((2.20 + (index * 0.45) + (Math.random() * 0.4)).toFixed(2));
        const initialPlace = extractedPlace || Number(((initialWin * 0.35) + 0.55).toFixed(2));

        parsedRunners.push({
          id: `h_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 4)}`,
          serial_no: horseNo,
          horse_no: horseNo,
          gate_no: gateNo,
          name: name.toUpperCase().trim(),
          jockey: jockey.trim() || 'TBD',
          trainer: trainer.trim() || 'TBD',
          win_odds: initialWin,
          place_odds: initialPlace,
          silk_color: silkColors[index % silkColors.length],
          is_suspended: false,
        });
      }
    });

    return parsedRunners;
  };

  const handleApplyBulkRunners = () => {
    const parsed = parseBulkRunnersText(bulkPasteText);
    if (parsed.length === 0) {
      notify('Please paste valid runner lines in format: Horse number-Gate number-Horse name-Jockey-Trainer', 'warning');
      return;
    }

    if (bulkPasteTarget === 'new') {
      setNewHorses(parsed);
    } else {
      setEditHorses(parsed);
    }

    soundManager.playClick();
    setActionMessage(`✅ Successfully imported ${parsed.length} horses into race card!`);
    setIsBulkPasteOpen(false);
    setBulkPasteText('');
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Add Banner Form state
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerSubtitle, setNewBannerSubtitle] = useState('');
  const [newBannerImg, setNewBannerImg] = useState('https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80');
  const [newBannerLink, setNewBannerLink] = useState('#deposit');
  const [newBannerTag, setNewBannerTag] = useState('WEEKEND SPECIAL');

  // User Balance Adjustment state
  const [balanceModalUser, setBalanceModalUser] = useState<User | null>(null);
  const [balanceModalAmount, setBalanceModalAmount] = useState<string>('1000');
  const [balanceModalType, setBalanceModalType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [balanceModalDesc, setBalanceModalDesc] = useState<string>('');



  // Load Admin Data (Ultra-fast single roundtrip bootstrap with 100% flicker-free reference checking)
  const loadAdminData = async (isBackground = false) => {
    // Don't waste CPU/invocations if the browser tab is hidden in background
    if (isBackground && typeof document !== 'undefined' && document.hidden) {
      return;
    }

    try {
      if (!isBackground && !stats && users.length === 0) setIsLoading(true);

      // 1. Try unified fast bootstrap endpoint first
      const bootstrap = await api.getAdminBootstrap();
      if (bootstrap) {
        if (bootstrap.stats) {
          setStats((prev: any) => (JSON.stringify(prev) === JSON.stringify(bootstrap.stats) ? prev : bootstrap.stats));
        }
        if (Array.isArray(bootstrap.users)) {
          setUsers((prev) => (JSON.stringify(prev) === JSON.stringify(bootstrap.users) ? prev : bootstrap.users));
        }
        if (Array.isArray(bootstrap.bets)) {
          setAllBets((prev) => (JSON.stringify(prev) === JSON.stringify(bootstrap.bets) ? prev : bootstrap.bets));
        }
        if (Array.isArray(bootstrap.deposits)) {
          setDepositRequests((prev) => (JSON.stringify(prev) === JSON.stringify(bootstrap.deposits) ? prev : bootstrap.deposits));
        }
        if (Array.isArray(bootstrap.withdrawals)) {
          setWithdrawalRequests((prev) => (JSON.stringify(prev) === JSON.stringify(bootstrap.withdrawals) ? prev : bootstrap.withdrawals));
        }
        const validCenters = (Array.isArray(bootstrap.race_centers) && bootstrap.race_centers.length > 0)
          ? bootstrap.race_centers
          : DEFAULT_RACE_CENTERS;
        setRaceCenters((prev) => (JSON.stringify(prev) === JSON.stringify(validCenters) ? prev : validCenters));
        if (!isBackground) {
          const savedCenterId = (typeof window !== 'undefined' ? localStorage.getItem('derby_admin_selected_center') : null) || validCenters[0].id;
          const targetCenter = validCenters.find(c => c.id === savedCenterId) || validCenters[0];
          setSelectedManageCenterId((prev) => prev || targetCenter.id);
          setNewDayCenterId((prev) => prev || targetCenter.id);
          setNewRaceCenterId((prev) => prev || targetCenter.id);
          setNewVenue((prev) => (prev && prev !== 'Hyderabad Race Club' ? prev : `${targetCenter.name} Turf Club`));
        }
        if (Array.isArray(bootstrap.race_days)) {
          setRaceDays((prev) => (JSON.stringify(prev) === JSON.stringify(bootstrap.race_days) ? prev : bootstrap.race_days));
        }
        if (bootstrap.system_settings) {
          const sys = bootstrap.system_settings;
          setSystemSettings((prev) => (JSON.stringify(prev) === JSON.stringify(sys) ? prev : sys));
          if (!isBackground) {
            if (sys.max_bet_per_horse !== undefined) setLimitMaxBet(String(sys.max_bet_per_horse));
            if (sys.max_win_per_race !== undefined) setLimitMaxWin(String(sys.max_win_per_race));
            if (sys.min_bet_amount !== undefined) setLimitMinBet(String(sys.min_bet_amount));
          }
        }
        return;
      }

      // 2. Resilient fallback with Promise.allSettled (prevents 1 failure from dropping other data)
      const results = await Promise.allSettled([
        api.getAdminOverview(),
        api.getAdminUsers(),
        api.getAdminAllBets(),
        api.getDepositRequests('ALL'),
        api.getWithdrawalRequests('ALL'),
        api.getRaceCenters(true),
        api.getRaceDays(),
        api.getSystemSettings(),
      ]);

      const [resStats, resUsers, resBets, resDeposits, resWithdrawals, resCenters, resDays, resSys] = results;

      if (resStats.status === 'fulfilled' && resStats.value) {
        setStats((prev: any) => (JSON.stringify(prev) === JSON.stringify(resStats.value) ? prev : resStats.value));
        try { localStorage.setItem('derby_admin_stats', JSON.stringify(resStats.value)); } catch {}
      }
      if (resUsers.status === 'fulfilled' && Array.isArray(resUsers.value)) {
        setUsers((prev) => (JSON.stringify(prev) === JSON.stringify(resUsers.value) ? prev : resUsers.value));
        try { localStorage.setItem('derby_admin_users', JSON.stringify(resUsers.value)); } catch {}
      }
      if (resBets.status === 'fulfilled' && Array.isArray(resBets.value)) {
        setAllBets((prev) => (JSON.stringify(prev) === JSON.stringify(resBets.value) ? prev : resBets.value));
        try { localStorage.setItem('derby_admin_bets', JSON.stringify(resBets.value)); } catch {}
      }
      if (resDeposits.status === 'fulfilled' && Array.isArray(resDeposits.value)) {
        setDepositRequests((prev) => (JSON.stringify(prev) === JSON.stringify(resDeposits.value) ? prev : resDeposits.value));
      }
      if (resWithdrawals.status === 'fulfilled' && Array.isArray(resWithdrawals.value)) {
        setWithdrawalRequests((prev) => (JSON.stringify(prev) === JSON.stringify(resWithdrawals.value) ? prev : resWithdrawals.value));
      }
      const rawCenters = (resCenters.status === 'fulfilled' && Array.isArray(resCenters.value) && resCenters.value.length > 0)
        ? resCenters.value
        : DEFAULT_RACE_CENTERS;
      setRaceCenters((prev) => (JSON.stringify(prev) === JSON.stringify(rawCenters) ? prev : rawCenters));
      if (!isBackground) {
        const savedCenterId = (typeof window !== 'undefined' ? localStorage.getItem('derby_admin_selected_center') : null) || rawCenters[0].id;
        const targetCenter = rawCenters.find(c => c.id === savedCenterId) || rawCenters[0];
        setSelectedManageCenterId((prev) => prev || targetCenter.id);
        setNewDayCenterId((prev) => prev || targetCenter.id);
        setNewRaceCenterId((prev) => prev || targetCenter.id);
        setNewVenue((prev) => (prev && prev !== 'Hyderabad Race Club' ? prev : `${targetCenter.name} Turf Club`));
      }
      if (resDays.status === 'fulfilled' && Array.isArray(resDays.value)) {
        setRaceDays((prev) => (JSON.stringify(prev) === JSON.stringify(resDays.value) ? prev : resDays.value));
      }
      if (resSys.status === 'fulfilled' && resSys.value) {
        const sysSettings = resSys.value;
        setSystemSettings((prev) => (JSON.stringify(prev) === JSON.stringify(sysSettings) ? prev : sysSettings));
        if (!isBackground) {
          if (sysSettings.max_bet_per_horse !== undefined) setLimitMaxBet(String(sysSettings.max_bet_per_horse));
          if (sysSettings.max_win_per_race !== undefined) setLimitMaxWin(String(sysSettings.max_win_per_race));
          if (sysSettings.min_bet_amount !== undefined) setLimitMinBet(String(sysSettings.min_bet_amount));
        }
      }
    } catch (err: any) {
      console.error('Error loading admin data:', err);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData(false);

    const unsubscribe = financialSync.subscribe(() => {
      loadAdminData(true);
    });

    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadAdminData(true);
      }
    }, 3000);

    const handleFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadAdminData(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsubscribe();
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Financial Handlers
  const handleApproveDeposit = async (id: string) => {
    try {
      setIsLoading(true);
      const res = await api.approveDepositRequest(id);
      soundManager.playWinPayout();
      setActionMessage(`💰 ${res.message}`);
      await loadAdminData();
      await onRefreshData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to approve deposit');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectDeposit = async (id: string) => {
    const reason = window.prompt('Enter rejection reason (optional):', 'UTR or payment screenshot could not be verified.');
    if (reason === null) return;
    try {
      setIsLoading(true);
      const res = await api.rejectDepositRequest(id, reason);
      setActionMessage(`❌ ${res.message}`);
      await loadAdminData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to reject deposit');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveWithdrawalToInProgress = async (id: string) => {
    try {
      setIsLoading(true);
      const res = await api.approveWithdrawalToInProgress(id);
      soundManager.playClick();
      setActionMessage(`⏳ ${res.message}`);
      await loadAdminData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to approve withdrawal');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteWithdrawalToSuccessful = async (id: string) => {
    try {
      setIsLoading(true);
      const res = await api.completeWithdrawalToSuccessful(id);
      soundManager.playWinPayout();
      setActionMessage(`✅ ${res.message}`);
      await loadAdminData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to complete withdrawal');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    const reason = window.prompt('Enter rejection reason (Funds will be refunded to user):', 'Payout details invalid or bank rejected transfer.');
    if (reason === null) return;
    try {
      setIsLoading(true);
      const res = await api.rejectWithdrawalRequest(id, reason);
      setActionMessage(`↩️ ${res.message}`);
      await loadAdminData();
      await onRefreshData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to reject withdrawal');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    soundManager.playClick();
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const handleAdjustUserBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModalUser) return;
    const amount = Number(balanceModalAmount);
    if (isNaN(amount) || amount <= 0) {
      setActionMessage('Please enter a valid amount');
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.adjustUserBalance(balanceModalUser.id, amount, balanceModalType, balanceModalDesc);
      setActionMessage(res.message);
      setBalanceModalUser(null);
      setBalanceModalAmount('1000');
      setBalanceModalDesc('');
      await loadAdminData();
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to adjust user balance');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAdjustUserId) {
      setActionMessage('⚠️ Please select a user first');
      setTimeout(() => setActionMessage(null), 3000);
      return;
    }
    const amount = Number(quickAdjustAmount);
    if (isNaN(amount) || amount <= 0) {
      setActionMessage('⚠️ Please enter a valid amount');
      setTimeout(() => setActionMessage(null), 3000);
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.adjustUserBalance(quickAdjustUserId, amount, quickAdjustType, quickAdjustDesc || `Manual Admin ${quickAdjustType}`);
      soundManager.playClick();
      setActionMessage(`💳 ${res.message}`);
      setQuickAdjustAmount('1000');
      setQuickAdjustDesc('');
      await loadAdminData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to adjust user balance');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenUserLedger = async (targetUser: User) => {
    setViewLedgerUser(targetUser);
    setIsLoadingLedger(true);
    soundManager.playClick();
    try {
      const txs = await api.getTransactions(targetUser.id);
      setLedgerTransactions(txs || []);
    } catch {
      setLedgerTransactions([]);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const handleAbandonRace = async (race: Race) => {
    const reason = window.prompt(`Declare "${race.name}" as ABANDONED / VOID?\nAll punter bets will be 100% refunded to user wallets instantly.\n\nEnter reason:`, 'Weather / Track Unfit / False Start');
    if (reason === null) return;
    try {
      setIsLoading(true);
      const res = await api.abandonRace(race.id, reason);
      soundManager.playClick();
      setActionMessage(`↩️ ${res.message}`);
      setSettlingRace(null);
      await onRefreshData();
      await loadAdminData();
      setTimeout(() => setActionMessage(null), 4500);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to abandon race');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSingleBet = async (bet: Bet) => {
    const reason = window.prompt(`Cancel Bet #${bet.id} on #${bet.horse_no} ${bet.horse_name} (Stake: ₹${bet.stake})?\nStake will be 100% refunded to @${bet.username || 'user'}.\n\nEnter reason:`, 'Suspicious Activity / Punter Request');
    if (reason === null) return;
    try {
      setIsLoading(true);
      const res = await api.cancelBet(bet.id, reason);
      soundManager.playClick();
      setActionMessage(`↩️ ${res.message}`);
      await onRefreshData();
      await loadAdminData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to cancel bet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const res = await api.createAdminUser({
        full_name: newUserData.full_name,
        username: newUserData.username,
        phone: newUserData.phone,
        email: newUserData.email,
        password: newUserData.password,
        initial_balance: Number(newUserData.initial_balance) || 0,
      });
      if (res.success) {
        soundManager.playClick();
        setActionMessage(res.message || `User @${newUserData.username} created successfully!`);
        setAddUserModalOpen(false);
        setNewUserData({ full_name: '', username: '', phone: '', email: '', password: '', initial_balance: '0' });
        await loadAdminData();
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        setActionMessage(res.error || 'Failed to create user');
      }
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBlockUser = (user: User) => {
    requestConfirm({
      title: user.is_blocked ? 'Unblock User Account' : 'Block User Account',
      message: `Are you sure you want to ${user.is_blocked ? 'UNBLOCK' : 'BLOCK'} @${user.username}?`,
      confirmText: user.is_blocked ? 'Unblock Account' : 'Block Account',
      variant: user.is_blocked ? 'success' : 'danger',
      onConfirm: async () => {
        try {
          setIsLoading(true);
          const res = await api.toggleBlockUser(user.id);
          soundManager.playClick();
          setActionMessage(res.message);
          await loadAdminData();
          setTimeout(() => setActionMessage(null), 3500);
        } catch (err: any) {
          setActionMessage(err.message || 'Failed to update user block status');
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const handleLoginAsUser = (user: User) => {
    requestConfirm({
      title: 'Impersonate User View',
      message: `Login as @${user.username} to view the platform from their perspective?`,
      confirmText: 'Switch to User View',
      variant: 'primary',
      onConfirm: async () => {
        try {
          setIsLoading(true);
          const res = await api.impersonateUser(user.id);
          if (res.success && res.user) {
            soundManager.playClick();
            if (onImpersonateUser) {
              onImpersonateUser(res.user);
            } else {
              localStorage.setItem('derby_user', JSON.stringify(res.user));
              window.location.hash = '#/lobby';
            }
          } else {
            setActionMessage(res.error || 'Failed to login as user');
          }
        } catch (err: any) {
          setActionMessage(err.message || 'Failed to login as user');
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const handleSaveRiskLimits = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      soundManager.playChip();
      const maxBet = Number(limitMaxBet) || 50000;
      const maxWin = Number(limitMaxWin) || 500000;
      const minBet = Number(limitMinBet) || 100;

      setSystemSettings(prev => ({
        ...prev,
        max_bet_per_horse: maxBet,
        max_win_per_race: maxWin,
        min_bet_amount: minBet
      }));

      notify(`✅ Risk Limits Saved! Max Bet: ₹${maxBet.toLocaleString()}, Max Win: ₹${maxWin.toLocaleString()}`, 'success');

      api.updateSystemSettings({
        max_bet_per_horse: maxBet,
        max_win_per_race: maxWin,
        min_bet_amount: minBet
      }).then(() => {
        loadAdminData(true);
      }).catch((err) => {
        notify(err.message || 'Failed to save risk limits on server', 'error');
      });
    } catch (err: any) {
      notify(err.message || 'Failed to save risk limits', 'error');
    }
  };

  const handleToggleGlobalBetting = () => {
    const nextState = !(systemSettings.betting_enabled ?? true);
    requestConfirm({
      title: nextState ? 'Resume Global Betting' : '🚨 Emergency Freeze Betting',
      message: nextState
        ? 'Resume all live betting platform-wide across all active races?'
        : '🚨 EMERGENCY ACTION: Freeze all live betting across the entire platform immediately?',
      confirmText: nextState ? 'Resume Live Betting' : 'Freeze All Betting',
      variant: nextState ? 'success' : 'danger',
      onConfirm: async () => {
        try {
          setIsLoading(true);
          const res = await api.updateSystemSettings({
            betting_enabled: nextState,
            emergency_message: nextState ? '' : 'Betting is temporarily suspended by Administrator.',
          });
          if (res.success) {
            soundManager.playClick();
            setSystemSettings(prev => ({ ...prev, betting_enabled: nextState }));
            setActionMessage(nextState ? '🟢 Global Betting RESUMED platform-wide.' : '🚨 EMERGENCY: Global Betting FROZEN platform-wide.');
            setTimeout(() => setActionMessage(null), 4000);
          }
        } catch (err: any) {
          setActionMessage('Failed to update emergency switch');
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    try {
      setIsLoading(true);
      const res = await api.updateSystemSettings({ announcement: announcementText.trim() });
      if (res.success) {
        soundManager.playClick();
        setSystemSettings(prev => ({ ...prev, announcement: announcementText.trim() }));
        setActionMessage('📢 Announcement broadcasted to all users!');
        setAnnouncementText('');
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: any) {
      setActionMessage('Failed to post announcement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubAdminData.username.trim() || !newSubAdminData.name.trim()) return;
    try {
      setIsLoading(true);
      const res = await api.addSubAdmin(newSubAdminData);
      if (res.success) {
        soundManager.playClick();
        setActionMessage(res.message || 'Sub-Admin added successfully');
        setSubAdminModalOpen(false);
        setNewSubAdminData({ username: '', name: '', role: 'ODDS_MANAGER' });
        await loadAdminData();
      }
    } catch (err: any) {
      setActionMessage('Failed to add sub-admin');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSubAdmin = (id: string) => {
    requestConfirm({
      title: 'Remove Sub-Admin',
      message: 'Are you sure you want to remove this Sub-Admin account? They will lose staff portal access immediately.',
      confirmText: 'Yes, Remove Sub-Admin',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setIsLoading(true);
          await api.deleteSubAdmin(id);
          soundManager.playClick();
          setActionMessage('Sub-Admin removed successfully');
          await loadAdminData();
        } catch (err: any) {
          setActionMessage('Failed to remove sub-admin');
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPassError(null);
    setAdminPassSuccess(false);

    if (!adminCurrentPassword || !adminNewPassword) {
      setAdminPassError('Please enter both current and new password');
      return;
    }
    if (adminNewPassword !== adminConfirmPassword) {
      setAdminPassError('New password and confirmation do not match');
      return;
    }
    if (adminNewPassword.length < 4) {
      setAdminPassError('New password must be at least 4 characters long');
      return;
    }

    try {
      setAdminPassLoading(true);
      let userId = 'admin_1';
      try {
        const savedUserStr = localStorage.getItem('derby_user');
        if (savedUserStr) {
          const u = JSON.parse(savedUserStr);
          if (u && u.id) userId = u.id;
        }
      } catch { }

      await api.changePassword(userId, adminCurrentPassword, adminNewPassword);
      soundManager.playWinPayout();
      setAdminPassSuccess(true);
      setAdminCurrentPassword('');
      setAdminNewPassword('');
      setAdminConfirmPassword('');
      setActionMessage('🔐 Master Admin password changed successfully!');
      setTimeout(() => {
        setAdminPassSuccess(false);
        setActionMessage(null);
      }, 4000);
    } catch (err: any) {
      setAdminPassError(err.message || 'Failed to update admin password');
    } finally {
      setAdminPassLoading(false);
    }
  };

  const handleOpenSettle = (race: Race) => {
    setSettlingRace(race);
    const initialPositions: Record<string, 1 | 2 | 3 | 4 | 0> = {};
    if (race.position_1 && race.position_1.length > 0) {
      race.horses.forEach((h) => {
        if (race.position_1?.includes(h.id)) initialPositions[h.id] = 1;
        else if (race.position_2?.includes(h.id)) initialPositions[h.id] = 2;
        else if (race.position_3?.includes(h.id)) initialPositions[h.id] = 3;
        else if (race.position_4?.includes(h.id)) initialPositions[h.id] = 4;
        else initialPositions[h.id] = 0;
      });
    } else {
      race.horses.forEach((h, idx) => {
        if (idx === 0) initialPositions[h.id] = 1;
        else if (idx === 1) initialPositions[h.id] = 2;
        else if (idx === 2) initialPositions[h.id] = 3;
        else if (idx === 3) initialPositions[h.id] = 4;
        else initialPositions[h.id] = 0;
      });
    }
    setSettlePositions(initialPositions);
  };

  const handleExecuteSettlement = async () => {
    if (!settlingRace) return;
    const p1 = Object.keys(settlePositions).filter((id) => settlePositions[id] === 1);
    const p2 = Object.keys(settlePositions).filter((id) => settlePositions[id] === 2);
    const p3 = Object.keys(settlePositions).filter((id) => settlePositions[id] === 3);
    const p4 = Object.keys(settlePositions).filter((id) => settlePositions[id] === 4);

    if (p1.length === 0) {
      setActionMessage('⚠️ Please select at least one horse for 1st Place');
      setTimeout(() => setActionMessage(null), 3000);
      return;
    }

    try {
      setIsLoading(true);
      setIsSettledSuccess(false);
      await api.settleRace(settlingRace.id, {
        position_1: p1,
        position_2: p2,
        position_3: p3,
        position_4: p4,
      });
      setIsSettledSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 600));
      setSettlingRace(null);
      setIsSettledSuccess(false);
      await onRefreshData();
      await loadAdminData();
      setActiveTab('finished');
    } catch (err: any) {
      console.error('Failed to settle race:', err);
      setIsSettledSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Level 1: Add Race Center Handler
  const handleCreateCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCenterName.trim() || !newCenterCode.trim()) {
      notify('Please enter center name and code', 'error');
      setActionMessage('Please enter center name and code');
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.createRaceCenter({
        name: newCenterName.trim().toUpperCase(),
        code: newCenterCode.trim().toUpperCase(),
        city: newCenterCity.trim() || newCenterName.trim(),
        is_active: true,
      });
      soundManager.playClick();
      notify(`🏟 ${res.message}`, 'success');
      setActionMessage(`🏟 ${res.message}`);
      setNewCenterName('');
      setNewCenterCode('');
      setNewCenterCity('');
      setShowAddCenterForm(false);
      
      if (res.center && res.center.id) {
        handleSelectCenter(res.center.id);
      }
      await loadAdminData();
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      notify(err.message || 'Failed to create center', 'error');
      setActionMessage(err.message || 'Failed to create center');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreDefaultCenters = async () => {
    try {
      setIsLoading(true);
      const res = await api.seedDefaultRaceCenters();
      soundManager.playClick();
      notify(`✅ ${res.message}`, 'success');
      await loadAdminData();
    } catch (err: any) {
      notify(err.message || 'Failed to restore default centers', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCenter = async (center: RaceCenter) => {
    try {
      setIsLoading(true);
      await api.updateRaceCenter(center.id, { is_active: !center.is_active });
      soundManager.playClick();
      setActionMessage(`⚡ Center ${center.name} is now ${!center.is_active ? 'ACTIVE' : 'INACTIVE'}`);
      await loadAdminData();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to update center');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditCenter = (center: RaceCenter) => {
    setEditingCenter(center);
    setEditCenterName(center.name);
    setEditCenterCode(center.code);
    setEditCenterCity(center.city || center.name);
    setEditCenterActive(center.is_active);
  };

  const handleSaveEditCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCenter) return;
    try {
      setIsLoading(true);
      await api.updateRaceCenter(editingCenter.id, {
        name: editCenterName,
        code: editCenterCode,
        city: editCenterCity,
        is_active: editCenterActive,
      });
      soundManager.playChip();
      notify(`✅ Race Center "${editCenterName}" updated successfully!`, 'success');
      setEditingCenter(null);
      await loadAdminData();
    } catch (err: any) {
      notify(err.message || 'Failed to update race center', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCenter = (centerId: string, centerName: string) => {
    requestConfirm({
      title: 'Delete Race Center',
      message: `Are you sure you want to delete Race Center "${centerName}"? All related race fixtures should be deleted first.`,
      confirmText: 'Yes, Delete Center',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setIsLoading(true);
          await api.deleteRaceCenter(centerId);
          soundManager.playClick();
          notify(`🗑️ Race Center "${centerName}" deleted successfully!`, 'success');
          await loadAdminData();
        } catch (err: any) {
          notify(err.message || 'Failed to delete race center', 'error');
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  // Level 2: Create Race Day Handler
  const handleCreateRaceDay = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCenterId = newDayCenterId || selectedManageCenterId || (raceCenters && raceCenters.length > 0 ? raceCenters[0].id : 'cntr_mysore');
    const center = (raceCenters || []).find((c) => c.id === targetCenterId) || raceCenters[0];
    if (!center) {
      notify('Please create a Race Center first before creating a Race Day card.', 'warning');
      return;
    }
    try {
      const title = newDayTitle.trim() || `${center.name} - ${newDayDate}`;
      soundManager.playClick();

      const res = await api.createRaceDay({
        center_id: center.id,
        center_name: center.name,
        race_date: newDayDate,
        title,
        status: 'PUBLISHED',
      });

      if (res.race_day) {
        setRaceDays((prev) => {
          const filtered = prev.filter((d) => d.id !== res.race_day.id);
          return [res.race_day, ...filtered];
        });
        setNewRaceCenterId(res.race_day.center_id);
        setSelectedManageCenterId(res.race_day.center_id);
        setNewDayCenterId(res.race_day.center_id);
        setNewRaceDayId(res.race_day.id);
        setNewVenue(`${center.name} Turf Club`);
        setNewRaceNo(1);
        try {
          localStorage.setItem('derby_admin_selected_center', res.race_day.center_id);
        } catch {}
        setActiveTab('add_race');
      }

      setNewDayTitle('');
      notify(`✅ Race Day Card "${title}" Created & Published! Directing to Add Race...`, 'success');
      loadAdminData(true);
    } catch (err: any) {
      notify(err.message || 'Failed to create race day', 'error');
    }
  };

  const handleOpenEditDay = (day: RaceDay) => {
    setEditingDay(day);
    setEditDayTitle(day.title);
    setEditDayDate(day.race_date);
    setEditDayCenterId(day.center_id);
    setEditDayStatus(day.status);
  };

  const handleSaveEditDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDay) return;
    try {
      setIsLoading(true);
      await api.updateRaceDay(editingDay.id, {
        title: editDayTitle,
        race_date: editDayDate,
        center_id: editDayCenterId,
        status: editDayStatus,
      });
      soundManager.playChip();
      notify(`✅ Race Day "${editDayTitle}" updated!`, 'success');
      setEditingDay(null);
      await loadAdminData();
    } catch (err: any) {
      notify(err.message || 'Failed to update race day', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRaceDay = (dayId: string) => {
    requestConfirm({
      title: 'Delete Race Day Card',
      message: 'Are you sure you want to delete this race day card? Any linked race fixtures will need to be re-assigned.',
      confirmText: 'Yes, Delete Card',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setIsLoading(true);
          await api.deleteRaceDay(dayId);
          setRaceDays((prev) => prev.filter((d) => d.id !== dayId));
          soundManager.playClick();
          setActionMessage('🗑️ Race day card deleted successfully');
          await loadAdminData(true);
          setTimeout(() => setActionMessage(null), 3000);
        } catch (err: any) {
          setActionMessage(err.message || 'Failed to delete race day');
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const handlePublishRaceDay = async (dayId: string) => {
    try {
      setIsLoading(true);
      const res = await api.publishRaceDay(dayId);
      soundManager.playClick();
      setActionMessage(`🚀 ${res.message}`);
      await loadAdminData();
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to publish race day');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  // ⚡ 1-Click Auto-Schedule Full Day Card (7 Races with 30-min intervals starting 1:00 PM)
  const handleQuickScheduleDay = (day: RaceDay) => {
    const center = (raceCenters || []).find((c) => c.id === day.center_id);
    const centerName = center?.name || 'Turf Club';
    const venueName = `${centerName} Turf Club`;

    const raceSchedule = [
      { no: 1, time: '1:00 PM', distance: '1200m', name: `The ${centerName} Opening Stakes` },
      { no: 2, time: '1:30 PM', distance: '1400m', name: `The Sprinters Championship Plate` },
      { no: 3, time: '2:00 PM', distance: '1400m', name: `The Royal Challenge Trophy` },
      { no: 4, time: '2:30 PM', distance: '1600m', name: `The Governor's Cup` },
      { no: 5, time: '3:00 PM', distance: '1600m', name: `The ${centerName} Gold Cup (Grade 1)` },
      { no: 6, time: '3:30 PM', distance: '1200m', name: `The Turf Classic Plate` },
      { no: 7, time: '4:00 PM', distance: '1400m', name: `The Finale Handicap` },
    ];

    requestConfirm({
      title: '⚡ Auto-Schedule 7 Races',
      message: `Generate full 7-Race Day Card for "${day.title}"?\n\nSchedule:\n• Race 1: 1:00 PM\n• Race 2: 1:30 PM\n• Race 3: 2:00 PM\n• Race 4: 2:30 PM\n• Race 5: 3:00 PM\n• Race 6: 3:30 PM\n• Race 7: 4:00 PM\n\nAll races will be created in UPCOMING state and ready for you to bulk paste runners.`,
      confirmText: 'Generate 7 Races',
      variant: 'primary',
      onConfirm: async () => {
        try {
          setIsLoading(true);
          for (const item of raceSchedule) {
            const defaultRunners = [
              { serial_no: 1, gate_no: 1, name: 'SPEED PRINCESS', jockey: 'Suraj Narredu', trainer: 'S. Padmanabhan', win_odds: 2.50, place_odds: 1.40, silk_color: '#dc2626', is_suspended: false },
              { serial_no: 2, gate_no: 2, name: 'ROYAL COMMANDER', jockey: 'P. Trevor', trainer: 'Prasanna Kumar', win_odds: 3.20, place_odds: 1.60, silk_color: '#2563eb', is_suspended: false },
              { serial_no: 3, gate_no: 3, name: 'GOLDEN ARROW', jockey: 'A. Sandesh', trainer: 'Dallas Todywalla', win_odds: 4.50, place_odds: 1.80, silk_color: '#16a34a', is_suspended: false },
              { serial_no: 4, gate_no: 4, name: 'THUNDER BOLT', jockey: 'Neeraj Rawal', trainer: 'Imtiaz Sait', win_odds: 6.00, place_odds: 2.10, silk_color: '#d97706', is_suspended: false },
              { serial_no: 5, gate_no: 5, name: 'MYSTIC STAR', jockey: 'C. S. Jodha', trainer: 'P. Shroff', win_odds: 8.50, place_odds: 2.60, silk_color: '#7c3aed', is_suspended: false },
              { serial_no: 6, gate_no: 6, name: 'FIRE BLADE', jockey: 'Imran Chisty', trainer: 'Narendra Lagad', win_odds: 12.00, place_odds: 3.50, silk_color: '#e11d48', is_suspended: false },
            ];

            await api.createRace({
              name: item.name,
              race_no: item.no,
              center_id: day.center_id,
              race_day_id: day.id,
              venue: venueName,
              race_time: item.time,
              date_str: day.race_date,
              distance: item.distance,
              class_grade: 'Grade 1 • Terms',
              status: 'UPCOMING',
              image_url: '/images/race_action.jpg',
              horses: defaultRunners as any,
            });
          }

          soundManager.playWinPayout();
          notify(`✅ Generated 7 Races (1:00 PM to 4:00 PM) for ${day.title}!`, 'success');
          await onRefreshData();
          await loadAdminData(true);
        } catch (err: any) {
          notify(err.message || 'Failed to auto-schedule races', 'error');
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  // 1-Click Race Status Master Controller (OPEN / LIVE, SUSPEND, CLOSE, UPCOMING)
  // 🔒 MASTER INVARIANT: Only 1 race per center should be OPEN at a time! When Race 3 opens, Race 2 auto-closes.
  const handleStatusChange = async (raceId: string, newStatus: RaceStatus) => {
    try {
      soundManager.playClick();
      const targetRace = races.find((r) => r.id === raceId);
      if (!targetRace) return;

      // 0ms instant optimistic update
      setRaces((prev) =>
        prev.map((r) => {
          if (r.id === raceId) {
            return {
              ...r,
              status: newStatus,
              is_suspended: newStatus === 'SUSPENDED' ? true : newStatus === 'CLOSED' ? false : r.is_suspended,
            };
          }
          // When opening a race, auto-close any other active race in the same center
          if (['OPEN', 'LIVE', 'OPEN_FOR_BETTING'].includes(newStatus)) {
            const isSameCenter =
              (targetRace.center_id && r.center_id === targetRace.center_id) ||
              (targetRace.race_day_id && r.race_day_id === targetRace.race_day_id) ||
              (r.venue && targetRace.venue && r.venue.toLowerCase() === targetRace.venue.toLowerCase());
            if (isSameCenter && r.status !== 'RESULTED' && r.status !== 'DRAFT') {
              return { ...r, status: 'UPCOMING' as RaceStatus, is_suspended: false };
            }
          }
          return r;
        })
      );

      if (newStatus === 'LIVE' || newStatus === 'OPEN_FOR_BETTING' || newStatus === 'OPEN') {
        setSelectedOddsRaceId(raceId);
        setActiveTab('live');
        setAdminRaceFilter('live');
        notify(`🟢 Race #${targetRace.race_no || ''} "${targetRace.name}" is now OPEN FOR BETTING! (Any previous open race in this center was auto-closed)`, 'success');
      } else if (newStatus === 'SUSPENDED') {
        notify(`⚠️ Race #${targetRace.race_no || ''} "${targetRace.name}" BETTING SUSPENDED!`, 'warning');
      } else if (newStatus === 'CLOSED') {
        notify(`🔒 Race #${targetRace.race_no || ''} "${targetRace.name}" WAGERING CLOSED / LOCKED!`, 'info');
      } else {
        notify(`Race #${targetRace.race_no || ''} status set to ${newStatus}`, 'info');
      }

      await api.updateRaceStatus(raceId, newStatus);
      await onRefreshData();
      await loadAdminData(true);
    } catch (err: any) {
      notify(err.message || 'Failed to update race status', 'error');
    }
  };

  // Level 3: Open Race For Betting (1-click master activator with 1-open-race invariant per center)
  const handleOpenRaceForBetting = async (race: Race) => {
    try {
      soundManager.playRaceBugle();
      // 0ms instant optimistic update: Only this race becomes LIVE, all other races in this center become UPCOMING
      setRaces((prev) =>
        prev.map((r) => {
          if (r.id === race.id) {
            return { ...r, status: 'LIVE', is_suspended: false };
          }
          const isSameCenter =
            (race.center_id && r.center_id === race.center_id) ||
            (race.race_day_id && r.race_day_id === race.race_day_id) ||
            (r.venue && race.venue && r.venue.toLowerCase() === race.venue.toLowerCase());
          if (isSameCenter && r.status !== 'RESULTED' && r.status !== 'DRAFT') {
            return { ...r, status: 'UPCOMING' as RaceStatus, is_suspended: false };
          }
          return r;
        })
      );
      setSelectedOddsRaceId(race.id);
      setActiveTab('live');
      setAdminRaceFilter('live');
      notify(`🟢 Race #${race.race_no || ''} "${race.name}" is now LIVE IN-PLAY! Other races in this center auto-closed.`, 'success');

      // Background sync
      await api.openRaceForBetting(race.id);
      await onRefreshData();
    } catch (err: any) {
      console.error('Failed to open race for betting:', err);
      notify(err.message || 'Failed to open race for betting', 'error');
    }
  };

  // Temporary odds storage for live editing
  const [tempOdds, setTempOdds] = useState<Record<string, { win_odds: number | string; place_odds: number | string }>>({});

  const handleUpdateOdds = async (horseId: string, winOdds: number, placeOdds: number) => {
    try {
      soundManager.playChip();
      const nowIso = new Date().toISOString();
      // 0ms instant local update + record odds history log
      setRaces((prev) =>
        prev.map((r) => ({
          ...r,
          horses: r.horses.map((h) => {
            if (h.id === horseId) {
              const prevWin = h.win_odds;
              const prevPlace = h.place_odds;
              const historyLog = {
                timestamp: nowIso,
                updated_at: nowIso,
                win_odds: winOdds,
                place_odds: placeOdds,
                old_win: prevWin,
                old_place: prevPlace,
                changed_by: 'Master Admin'
              };
              const newHist = [historyLog, ...(h.odds_history || [])].slice(0, 30);
              return {
                ...h,
                win_odds: winOdds,
                place_odds: placeOdds,
                odds_history: newHist,
              };
            }
            return h;
          }),
        }))
      );
      notify(`Odds updated: WIN ${winOdds.toFixed(2)}x / PLACE ${placeOdds.toFixed(2)}x`, 'success');
      api.updateHorseOdds(horseId, winOdds, placeOdds).then(() => {
        onRefreshData();
      }).catch((err) => {
        notify(err.message || 'Failed to update odds', 'error');
      });
    } catch (err: any) {
      notify(err.message || 'Failed to update odds', 'error');
    }
  };

  const handleSuspendHorse = async (raceId: string, horseId: string) => {
    try {
      soundManager.playClick();
      setEditingHorseId(horseId);
      // 0ms instant local update
      setRaces((prev) =>
        prev.map((r) => {
          if (r.id !== raceId) return r;
          return {
            ...r,
            horses: r.horses.map((h) => (h.id === horseId ? { ...h, is_suspended: true } : h)),
          };
        })
      );
      notify('🚫 Runner suspended in real-time. Users see "Odds Changing".', 'info');

      await api.suspendHorse(raceId, horseId);
      await onRefreshData();
    } catch (err: any) {
      console.error('Failed to suspend runner:', err);
      notify(err.message || 'Failed to suspend runner', 'error');
    }
  };

  const handleResumeHorse = async (raceId: string, horseId: string) => {
    try {
      soundManager.playChip();
      const current = tempOdds[horseId];
      const targetRace = races.find((r) => r.id === raceId);
      const targetHorse = targetRace?.horses.find((h) => h.id === horseId);
      const winVal = current?.win_odds !== undefined && current.win_odds !== '' ? parseFloat(String(current.win_odds)) : (targetHorse?.win_odds || 2.5);
      const placeVal = current?.place_odds !== undefined && current.place_odds !== '' ? parseFloat(String(current.place_odds)) : (targetHorse?.place_odds || 1.5);

      // 0ms instant local update
      setRaces((prev) =>
        prev.map((r) => {
          if (r.id !== raceId) return r;
          return {
            ...r,
            horses: r.horses.map((h) =>
              h.id === horseId
                ? { ...h, is_suspended: false, win_odds: winVal, place_odds: placeVal }
                : h
            ),
          };
        })
      );
      setEditingHorseId(null);
      notify(`✅ Runner resumed! Live Odds: WIN ${winVal}x, PLACE ${placeVal}x`, 'success');

      await api.resumeHorse(raceId, horseId, winVal, placeVal);
      await onRefreshData();
    } catch (err: any) {
      console.error('Failed to resume runner:', err);
      notify(err.message || 'Failed to resume runner', 'error');
    }
  };

  const handleCloseBettingForRace = async (race: Race) => {
    try {
      soundManager.playClick();
      setRaces((prev) =>
        prev.map((r) => (r.id === race.id ? { ...r, status: 'CLOSED' as RaceStatus, is_suspended: true } : r))
      );
      notify(`🔒 Betting officially CLOSED for Race #${race.race_no || ''} ${race.name}. Market locked.`, 'warning');
      await api.updateRaceStatus(race.id, 'CLOSED');
      await onRefreshData();
    } catch (err: any) {
      notify(err.message || 'Failed to close betting', 'error');
    }
  };

  const handleSuspendAll = async (raceId: string) => {
    try {
      soundManager.playClick();
      // 0ms instant local update
      setRaces((prev) =>
        prev.map((r) => {
          if (r.id !== raceId) return r;
          return {
            ...r,
            is_suspended: true,
            horses: r.horses.map((h) => ({ ...h, is_suspended: true })),
          };
        })
      );
      notify('🚫 ALL RUNNERS in race SUSPENDED.', 'warning');

      await api.suspendAll(raceId);
      await onRefreshData();
    } catch (err: any) {
      console.error('Failed to suspend all runners:', err);
      notify(err.message || 'Failed to suspend all runners', 'error');
    }
  };

  const handleResumeAll = async (raceId: string) => {
    try {
      soundManager.playChip();
      const targetRace = races.find((r) => r.id === raceId);
      const oddsMap: Record<string, { win_odds?: number; place_odds?: number }> = {};

      // 0ms instant local update
      setRaces((prev) =>
        prev.map((r) => {
          if (r.id !== raceId) return r;
          return {
            ...r,
            is_suspended: false,
            horses: r.horses.map((h) => {
              const current = tempOdds[h.id];
              const wVal = current?.win_odds !== undefined && current.win_odds !== '' ? parseFloat(String(current.win_odds)) : h.win_odds;
              const pVal = current?.place_odds !== undefined && current.place_odds !== '' ? parseFloat(String(current.place_odds)) : h.place_odds;
              oddsMap[h.id] = { win_odds: wVal, place_odds: pVal };
              return { ...h, is_suspended: false, win_odds: wVal, place_odds: pVal };
            }),
          };
        })
      );
      notify('✅ ALL RUNNERS RESUMED! Live odds updated on user screens.', 'success');

      await api.resumeAll(raceId, oddsMap);
      await onRefreshData();
    } catch (err: any) {
      console.error('Failed to resume all runners:', err);
      notify(err.message || 'Failed to resume all runners', 'error');
    }
  };

  const handleToggleHorseSuspend = async (raceId: string, horseId: string) => {
    const race = races.find((r) => r.id === raceId);
    const horse = race?.horses.find((h) => h.id === horseId);
    if (horse?.is_suspended) {
      await handleResumeHorse(raceId, horseId);
    } else {
      await handleSuspendHorse(raceId, horseId);
    }
  };

  const handleToggleRaceSuspendAll = async (raceId: string, forceState?: boolean) => {
    const race = races.find((r) => r.id === raceId);
    const isAll = forceState !== undefined ? forceState : (race?.is_suspended || race?.horses.every((h) => h.is_suspended));
    if (!isAll) {
      await handleSuspendAll(raceId);
    } else {
      await handleResumeAll(raceId);
    }
  };

  const handleQuickAddHorse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddHorseRace || !quickHorseData.name.trim()) return;
    try {
      soundManager.playChip();
      const sNo = parseInt(quickHorseData.horse_no) || (quickAddHorseRace.horses.length + 1);
      const gateNo = quickHorseData.gate_no ? (parseInt(quickHorseData.gate_no) || sNo) : sNo;
      const winOdds = parseFloat(quickHorseData.win_odds) || 2.50;
      const placeOdds = parseFloat(quickHorseData.place_odds) || 1.40;

      const newHorse: Horse = {
        id: `h_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        race_id: quickAddHorseRace.id,
        horse_no: sNo,
        serial_no: sNo,
        gate_no: gateNo,
        name: quickHorseData.name.trim().toUpperCase(),
        jockey: (quickHorseData.jockey || 'TBD').trim(),
        trainer: (quickHorseData.trainer || 'TBD').trim(),
        win_odds: winOdds,
        place_odds: placeOdds,
        silk_color: '#3b82f6',
        is_suspended: false,
        odds_history: [
          {
            win_odds: winOdds,
            place_odds: placeOdds,
            timestamp: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            changed_by: 'Master Admin'
          }
        ]
      };

      // 0ms instant local update
      setRaces((prev) =>
        prev.map((r) =>
          r.id === quickAddHorseRace.id
            ? { ...r, horses: [...r.horses, newHorse] }
            : r
        )
      );
      notify(`✅ Runner "${newHorse.name}" (#${newHorse.horse_no}) added to ${quickAddHorseRace.name}!`, 'success');
      const raceToUpdate = quickAddHorseRace;
      setQuickAddHorseRace(null);
      setQuickHorseData({ name: '', jockey: '', trainer: '', gate_no: '', horse_no: '', win_odds: '2.50', place_odds: '1.40' });

      api.addHorseToRace(raceToUpdate.id, newHorse).then(() => {
        onRefreshData();
      }).catch((err) => {
        notify(err.message || 'Failed to save new horse on server', 'error');
      });
    } catch (err: any) {
      notify(err.message || 'Failed to add horse', 'error');
    }
  };

  const handleDeleteHorseFromRace = (raceId: string, horseId: string, horseName: string) => {
    requestConfirm({
      title: 'Remove Horse Runner',
      message: `Are you sure you want to remove "${horseName}" from this race card?`,
      confirmText: 'Yes, Remove Runner',
      variant: 'danger',
      onConfirm: async () => {
        try {
          soundManager.playClick();
          // 0ms local update
          setRaces((prev) =>
            prev.map((r) =>
              r.id === raceId
                ? { ...r, horses: r.horses.filter((h) => h.id !== horseId) }
                : r
            )
          );
          notify(`🗑️ Runner "${horseName}" removed from race.`, 'info');

          api.deleteHorseFromRace(raceId, horseId).then(() => {
            onRefreshData();
          }).catch((err) => {
            notify(err.message || 'Failed to remove runner on server', 'error');
          });
        } catch (err: any) {
          notify(err.message || 'Failed to remove runner', 'error');
        }
      },
    });
  };

  const handleMakeRaceLive = async (race: Race) => {
    try {
      soundManager.playRaceBugle();
      // 0ms Instant UI update
      setRaces((prev) =>
        prev.map((r) => (r.id === race.id ? { ...r, status: 'LIVE' } : r))
      );
      setSelectedOddsRaceId(race.id);
      setActiveTab('live');
      setAdminRaceFilter('live');
      notify(`⚡ Race "${race.name}" is now LIVE! Visible in Live Races.`, 'success');

      // Background server sync
      api.updateRaceStatus(race.id, 'LIVE').then(() => {
        onRefreshData();
        loadAdminData(true);
      }).catch((err: any) => {
        console.error('Failed to sync live race:', err);
        notify(err.message || 'Failed to update live status on server', 'error');
      });
    } catch (err: any) {
      notify(err.message || 'Failed to make race live', 'error');
    }
  };

  const handleMakeRaceUpcoming = async (race: Race) => {
    try {
      soundManager.playClick();
      // 0ms Instant UI update
      setRaces((prev) =>
        prev.map((r) => (r.id === race.id ? { ...r, status: 'UPCOMING' } : r))
      );
      setSelectedOddsRaceId(race.id);
      setActiveTab('upcoming');
      setAdminRaceFilter('upcoming');
      notify(`⏱ Race "${race.name}" moved to Upcoming Races.`, 'info');

      // Background server sync
      api.updateRaceStatus(race.id, 'UPCOMING').then(() => {
        onRefreshData();
        loadAdminData(true);
      }).catch((err: any) => {
        console.error('Failed to sync upcoming race:', err);
        notify(err.message || 'Failed to update status on server', 'error');
      });
    } catch (err: any) {
      notify(err.message || 'Failed to update status', 'error');
    }
  };

  const handlePublishRace = async (raceId: string) => {
    try {
      soundManager.playBetPlaced();
      // 0ms Instant UI update
      setRaces((prev) =>
        prev.map((r) => (r.id === raceId ? { ...r, status: 'UPCOMING' } : r))
      );
      notify('📢 Race published for User View! (Odds Closed)', 'success');

      // Background server sync
      api.updateRaceStatus(raceId, 'UPCOMING').then(() => {
        onRefreshData();
        loadAdminData(true);
      }).catch((err: any) => {
        notify(err.message || 'Failed to publish race', 'error');
      });
    } catch (err: any) {
      notify(err.message || 'Failed to publish race', 'error');
    }
  };

  const handlePublishAllSavedCards = () => {
    const draftRaces = races.filter((r) => r.status === 'DRAFT');
    if (draftRaces.length === 0) {
      notify('No saved draft race cards to publish.', 'info');
      return;
    }

    requestConfirm({
      title: 'Publish All Saved Race Cards',
      message: `Publish all ${draftRaces.length} saved race cards for user view?\n\nThey will become visible on the user app with "Betting to start 30 minutes prior to race" (Odds Closed).`,
      confirmText: 'Publish All Cards',
      variant: 'success',
      onConfirm: async () => {
        try {
          soundManager.playWinPayout();
          setRaces((prev) => prev.map((r) => r.status === 'DRAFT' ? { ...r, status: 'UPCOMING' } : r));
          setActiveTab('upcoming');
          notify(`📢 Published ${draftRaces.length} Race Cards for User View!`, 'success');

          for (const r of draftRaces) {
            api.updateRaceStatus(r.id, 'UPCOMING').catch(() => {});
          }
          loadAdminData(true);
        } catch (err: any) {
          notify(err.message || 'Failed to publish all saved cards', 'error');
        }
      },
    });
  };

  const handleCreateRace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRaceName.trim()) {
      notify('⚠️ Please provide a Name of the Race (e.g. The Rock of Gibraltar Plate)', 'warning');
      return;
    }
    const finalStatus = newRaceStatus || 'DRAFT';

    // Filter runners and assign standard baseline odds automatically (odds will be refined in Live Odds Editor before post time)
    const validRunners = (newHorses || [])
      .filter((h) => h.name && h.name.trim().length > 0)
      .map((h, i) => ({
        id: h.id || `h_${Date.now()}_${i + 1}_${Math.random().toString(36).substr(2, 4)}`,
        serial_no: Number(h.serial_no) || (i + 1),
        horse_no: Number(h.serial_no) || (i + 1),
        gate_no: h.gate_no !== undefined && h.gate_no !== '' ? h.gate_no : (i + 1),
        name: h.name.trim().toUpperCase(),
        jockey: (h.jockey || 'TBD').trim(),
        trainer: (h.trainer || 'TBD').trim(),
        win_odds: Number(h.win_odds) || Number((2.20 + (i * 0.45)).toFixed(2)),
        place_odds: Number(h.place_odds) || Number((1.40 + (i * 0.20)).toFixed(2)),
        silk_color: h.silk_color || '#3b82f6',
        is_suspended: false,
      }));

    if (validRunners.length === 0) {
      notify('⚠️ Please enter at least 1 runner in the table below (or click "Bulk Paste Horses")', 'warning');
      return;
    }

    const targetCenterId = newRaceCenterId || selectedManageCenterId || (raceCenters && raceCenters.length > 0 ? raceCenters[0].id : 'cntr_mysore');
    const targetCenter = (raceCenters || []).find((c) => c.id === targetCenterId);
    const targetVenue = newVenue || (targetCenter ? `${targetCenter.name} Turf Club` : 'Mysore Turf Club');
    const targetTime = newTime.trim() || '1:45 PM';
    const targetDistance = newDistance.trim() || '1400m';

    const tempRaceId = `race_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const optimisticRace: Race = {
      id: tempRaceId,
      name: newRaceName.trim(),
      race_no: newRaceNo ? Number(newRaceNo) : 1,
      center_id: targetCenterId,
      race_day_id: newRaceDayId || undefined,
      venue: targetVenue,
      race_time: targetTime,
      date_str: 'Today',
      distance: targetDistance,
      going: newGoing || 'Good',
      class_grade: newClassGrade || 'Grade 1 • Terms',
      status: finalStatus,
      image_url: newRaceImage || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
      horses: validRunners,
    };

    // 0ms instant UI update
    setRaces((prev) => [optimisticRace, ...prev]);
    setSelectedOddsRaceId(tempRaceId);
    handleClearForm();

    const createdRaceNo = optimisticRace.race_no || 1;

    setCreatedRaceSuccessModal({
      isOpen: true,
      raceName: optimisticRace.name,
      raceNo: createdRaceNo,
      status: finalStatus,
      runnersCount: validRunners.length,
    });

    if (finalStatus === 'DRAFT') {
      soundManager.playChip();
      notify(`💾 Race Card "${optimisticRace.name}" saved to SAVED RACE CARDS (Odds Closed)!`, 'success');
    } else if (finalStatus === 'LIVE') {
      soundManager.playRaceBugle();
      notify(`⚡ Race "${optimisticRace.name}" published directly to LIVE RACES with ${validRunners.length} runners!`, 'success');
      setAdminRaceFilter('live');
    } else {
      soundManager.playBetPlaced();
      notify(`🚀 Race "${optimisticRace.name}" published for USER VIEW with ${validRunners.length} runners!`, 'success');
      setAdminRaceFilter('upcoming');
    }

    // Background server call
    api.createRace({
      id: tempRaceId,
      name: optimisticRace.name,
      race_no: optimisticRace.race_no,
      center_id: optimisticRace.center_id,
      race_day_id: optimisticRace.race_day_id,
      venue: optimisticRace.venue,
      race_time: optimisticRace.race_time,
      date_str: optimisticRace.date_str,
      distance: optimisticRace.distance,
      going: optimisticRace.going,
      class_grade: optimisticRace.class_grade,
      status: optimisticRace.status,
      image_url: optimisticRace.image_url,
      horses: validRunners,
    }).then(async (created) => {
      if (created && created.id) {
        setRaces((prev) => prev.map((r) => (r.id === tempRaceId ? created : r)));
        setSelectedOddsRaceId((curr) => (curr === tempRaceId ? created.id : curr));
      }
      await onRefreshData();
      await loadAdminData(true);
    }).catch((err: any) => {
      console.error('Failed to create race on server:', err);
      notify(err.message || 'Failed to publish race on server', 'error');
    });
  };

  const handleOpenEdit = (race: Race) => {
    setEditingRace(race);
    setEditRaceName(race.name);
    setEditRaceNo(race.race_no || '');
    setEditRaceCenterId(race.center_id || '');
    setEditRaceDayId(race.race_day_id || '');
    setEditVenue(race.venue);
    setEditTime(race.race_time);
    setEditDistance(race.distance);
    setEditGoing(race.going || 'Good');
    setEditClassGrade(race.class_grade || 'Grade 1 • Terms');
    setEditRaceImage(race.image_url || '/images/race_action.jpg');
    setEditRaceStatus(race.status || 'OPEN');
    setEditHorses(
      race.horses.map((h, i) => ({
        id: h.id,
        serial_no: h.serial_no || h.horse_no || i + 1,
        gate_no: h.gate_no !== undefined ? h.gate_no : (i + 1),
        name: h.name,
        jockey: h.jockey,
        trainer: h.trainer,
        win_odds: h.win_odds,
        place_odds: h.place_odds,
        silk_color: h.silk_color || '#dc2626',
        form: h.form || '1-1-2-1',
        weight: h.weight || '56.0 kg',
      }))
    );
  };

  const handleSaveEditRace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRace) return;
    if (!editRaceName.trim() || !editTime.trim()) {
      setActionMessage('⚠️ Race name and time are required');
      setTimeout(() => setActionMessage(null), 3000);
      return;
    }
    try {
      setIsLoading(true);
      await api.updateRace(editingRace.id, {
        name: editRaceName,
        race_no: editRaceNo ? Number(editRaceNo) : undefined,
        center_id: editRaceCenterId || undefined,
        race_day_id: editRaceDayId || undefined,
        venue: editVenue,
        race_time: editTime,
        date_str: editingRace.date_str || 'Today, 5th Sep',
        distance: editDistance,
        going: editGoing,
        class_grade: editClassGrade,
        image_url: editRaceImage,
        status: editRaceStatus,
        horses: editHorses,
      });
      soundManager.playChip();
      setActionMessage(`✅ Race "${editRaceName}" updated successfully!`);
      setEditingRace(null);
      await onRefreshData();
      await loadAdminData();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to update race');
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  const handleDeleteRace = (raceId: string, raceName: string) => {
    requestConfirm({
      title: 'Delete Race Fixture',
      message: `Are you sure you want to delete the race fixture "${raceName}"? This action cannot be undone.`,
      confirmText: 'Yes, Delete Race',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setIsLoading(true);
          await api.deleteRace(raceId);
          setActionMessage(`🗑️ Race fixture "${raceName}" deleted successfully!`);
          await onRefreshData();
          await loadAdminData();
          setTimeout(() => setActionMessage(null), 3000);
        } catch (err: any) {
          setActionMessage(err.message || 'Failed to delete race');
          setTimeout(() => setActionMessage(null), 3500);
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const handleLoadPreset = () => {
    setNewRaceName(HANDWRITTEN_SHEET_PRESET.name);
    setNewRaceNo(HANDWRITTEN_SHEET_PRESET.race_no);
    setNewVenue(HANDWRITTEN_SHEET_PRESET.venue);
    setNewTime(HANDWRITTEN_SHEET_PRESET.race_time);
    setNewDistance(HANDWRITTEN_SHEET_PRESET.distance);
    setNewGoing(HANDWRITTEN_SHEET_PRESET.going);
    setNewClassGrade(HANDWRITTEN_SHEET_PRESET.class_grade);
    setNewHorses([...HANDWRITTEN_SHEET_PRESET.horses]);
    soundManager.playChip();
    setActionMessage('✨ Loaded 7 runners from handwritten sheet preset!');
    setTimeout(() => setActionMessage(null), 2500);
  };

  const handleClearForm = () => {
    const nextNo = (races || []).length + 1;
    const currentCenterId = selectedManageCenterId || newRaceCenterId || (raceCenters && raceCenters.length > 0 ? raceCenters[0].id : 'cntr_mysore');
    const currentCenter = (raceCenters || []).find((c) => c.id === currentCenterId) || raceCenters[0];
    const venueName = currentCenter ? `${currentCenter.name} Turf Club` : 'Mysore Turf Club';
    setNewRaceName('');
    setNewRaceNo(String(nextNo));
    setNewRaceCenterId(currentCenterId);
    setNewVenue(venueName);
    setNewTime('');
    setNewDistance('');
    setNewGoing('Good');
    setNewHorses([
      { serial_no: 1, gate_no: 1, name: '', jockey: '', trainer: '', win_odds: 2.5, place_odds: 1.5, silk_color: '#dc2626' }
    ]);
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBannerTitle || !newBannerImg) {
      setActionMessage('⚠️ Title and Image URL are required');
      setTimeout(() => setActionMessage(null), 3000);
      return;
    }
    try {
      setIsLoading(true);
      await api.createBanner({
        title: newBannerTitle,
        subtitle: newBannerSubtitle,
        image_url: newBannerImg,
        link: newBannerLink,
        tag: newBannerTag,
      });
      soundManager.playChip();
      setActionMessage('🎉 Promotional Banner added!');
      setNewBannerTitle('');
      setNewBannerSubtitle('');
      await onRefreshData();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to add banner');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      await api.deleteBanner(id);
      setActionMessage('Banner removed');
      await onRefreshData();
      setTimeout(() => setActionMessage(null), 2000);
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to delete banner');
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleResetDemo = () => {
    requestConfirm({
      title: 'Reset Platform Data',
      message: 'Are you sure you want to reset all platform data to initial state? All test fixtures, bets, and transactions will be cleared.',
      confirmText: 'Yes, Reset Everything',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setIsLoading(true);
          await api.resetDemo();
          await onRefreshData();
          await loadAdminData();
          setActionMessage('Platform data reset to factory demo state!');
          setTimeout(() => setActionMessage(null), 3000);
        } catch (err: any) {
          setActionMessage(err.message || 'Failed to reset demo');
          setTimeout(() => setActionMessage(null), 3500);
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const handleResetRacesKeepDeposits = () => {
    requestConfirm({
      title: '⚡ Clean Slate (Wipe Races & Winnings, Keep Deposits)',
      message: 'Are you sure you want to delete all live, completed, and draft matches, and wipe all winnings?\n\nUsers will keep their original approved deposit balance (₹5,000 / ₹10,000) so you can test match creation, opening betting, and live settlements from scratch.',
      confirmText: 'Yes, Reset Matches & Winnings',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setIsLoading(true);
          const res = await api.resetRacesKeepDeposits();
          await onRefreshData();
          await loadAdminData();
          setActionMessage(res.message || 'All matches and winnings wiped. User deposits preserved!');
          setTimeout(() => setActionMessage(null), 4000);
        } catch (err: any) {
          setActionMessage(err.message || 'Failed to reset matches');
          setTimeout(() => setActionMessage(null), 3500);
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Admin Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                DerbyBet Management Suite
              </h1>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase">
                Admin
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Manage races, live odds, declare winners with auto bet settlements & banners
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            id="admin-reset-races-btn"
            type="button"
            onClick={handleResetRacesKeepDeposits}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-white text-xs font-bold border border-amber-500/30 transition cursor-pointer active:scale-95"
            title="Wipe all matches and winnings, preserve user deposited balance"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>⚡ Reset Races (Keep Deposits)</span>
          </button>

          <button
            id="admin-reset-demo-btn"
            onClick={handleResetDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Demo DB</span>
          </button>
        </div>
      </div>

      {/* Floating Action Done / Notification Toast - Replaces annoying browser popups */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] max-w-md w-[calc(100%-2.5rem)] sm:w-auto animate-in slide-in-from-top-3 fade-in duration-300">
          <div
            className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 ${toast.type === 'error'
                ? 'bg-red-950/95 border-red-500/50 text-red-100 shadow-red-950/50'
                : toast.type === 'warning'
                  ? 'bg-amber-950/95 border-amber-500/50 text-amber-100 shadow-amber-950/50'
                  : toast.type === 'info'
                    ? 'bg-sky-950/95 border-sky-500/50 text-sky-100 shadow-sky-950/50'
                    : 'bg-slate-900/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/50'
              }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-400" />}
              {toast.type === 'info' && <Shield className="w-5 h-5 text-sky-400" />}
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            </div>
            <div className="flex-1 pr-2">
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                {toast.type === 'error' ? 'Action Failed' : toast.type === 'warning' ? 'Notice' : 'Action Done'}
              </p>
              <p className="text-sm font-semibold mt-0.5 leading-snug">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {actionMessage && !toast && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* 🚨 MASTER EMERGENCY BETTING KILL-SWITCH BANNER */}
      <div className={`p-3 sm:p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl ${(systemSettings.betting_enabled ?? true)
          ? 'bg-[#08150d] border-emerald-500/40 text-emerald-200'
          : 'bg-[#20080c] border-red-500/60 text-red-200 shadow-red-950/50'
        }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${(systemSettings.betting_enabled ?? true)
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'bg-red-500/30 text-red-400 border border-red-500/60'
            }`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-white text-xs sm:text-sm tracking-wide">
                GLOBAL BETTING ENGINE:
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider border ${(systemSettings.betting_enabled ?? true)
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-red-600 text-white border-red-400'
                }`}>
                {(systemSettings.betting_enabled ?? true) ? '🟢 BETTING ACTIVE (OPEN)' : '🚨 BETTING FROZEN (STOPPED)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {(systemSettings.betting_enabled ?? true)
                ? 'Platform is accepting live bets normally across all published races.'
                : 'Emergency kill-switch is ACTIVE. No bets can be placed across the platform.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleGlobalBetting}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer shadow-lg active:scale-95 border flex items-center gap-1.5 ${(systemSettings.betting_enabled ?? true)
                ? 'bg-red-600 hover:bg-red-500 text-white border-red-400/60 shadow-red-950/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/60 shadow-emerald-950/40'
              }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{(systemSettings.betting_enabled ?? true) ? '🛑 FREEZE ALL BETTING' : '▶️ RESUME BETTING'}</span>
          </button>
        </div>
      </div>

      {isOddsOnlyStaff && (
        <div className="p-3 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Limited Staff Session: Odds & Suspensions Management Only (Financials, Users & Master Controls are restricted)</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] uppercase font-black shrink-0">
            ODDS OPERATOR
          </span>
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-none text-xs font-bold">
        {/* TAB 1: LIVE RACES ONLY */}
        <button
          id="admin-tab-live"
          onClick={() => setActiveTab('live')}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'live' || activeTab === 'lifecycle' || activeTab === 'races'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md font-black'
              : 'text-rose-400 hover:text-white hover:bg-slate-800'
            }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>🔴 Live Races ({races.filter((r) => r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING').length})</span>
          {races.some((r) => r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING') && (
            <span className="w-2 h-2 rounded-full bg-white" />
          )}
        </button>

        {/* TAB 2: SAVED RACE CARDS (DRAFT ODDS CLOSED) */}
        <button
          id="admin-tab-saved"
          onClick={() => setActiveTab('saved')}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'saved'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md font-black'
              : 'text-indigo-400 hover:text-white hover:bg-slate-800'
            }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>📋 Saved Race Cards ({races.filter((r) => r.status === 'DRAFT').length})</span>
          {races.some((r) => r.status === 'DRAFT') && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
              {races.filter((r) => r.status === 'DRAFT').length}
            </span>
          )}
        </button>

        {/* TAB 3: PUBLISHED & UPCOMING RACES */}
        <button
          id="admin-tab-upcoming"
          onClick={() => setActiveTab('upcoming')}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'upcoming'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md font-black'
              : 'text-emerald-400 hover:text-white hover:bg-slate-800'
            }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>⏱️ Published Races ({races.filter((r) => r.status === 'UPCOMING' || r.status === 'OPEN').length})</span>
        </button>

        {/* TAB 3: FINISHED & SETTLED */}
        <button
          id="admin-tab-finished"
          onClick={() => setActiveTab('finished')}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'finished'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md font-black'
              : 'text-amber-400 hover:text-white hover:bg-slate-800'
            }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>🏆 Finished Races & Audit ({races.filter((r) => r.status === 'RESULTED' || r.status === 'CLOSED').length})</span>
        </button>

        {!isOddsOnlyStaff && (
          <button
            id="admin-tab-masters"
            onClick={() => setActiveTab('masters')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'masters'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm font-black'
                : 'text-indigo-400 hover:text-white hover:bg-slate-800'
              }`}
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>Race Centers & Days ({(raceCenters || []).length})</span>
          </button>
        )}

        <button
          id="admin-tab-odds"
          onClick={() => setActiveTab('odds')}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'odds'
              ? 'bg-rose-600 text-white shadow-sm font-bold'
              : 'text-slate-400 hover:text-white'
            }`}
        >
          <Sliders className="w-3.5 h-3.5 text-rose-400" />
          <span>Live Odds Editor ({races.filter((r) => r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING').length})</span>
        </button>

        {!isOddsOnlyStaff && (
          <button
            id="admin-tab-add-race"
            onClick={() => setActiveTab('add_race')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'add_race'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Race
          </button>
        )}

        {!isOddsOnlyStaff && (
          <button
            id="admin-tab-banners"
            onClick={() => setActiveTab('banners')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'banners'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Manage Banners ({banners.length})
          </button>
        )}

        {!isOddsOnlyStaff && (
          <button
            id="admin-tab-users"
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            <Users className="w-3.5 h-3.5" />
            All Users ({users.length})
          </button>
        )}

        {!isOddsOnlyStaff && (
          <button
            id="admin-tab-financials"
            onClick={() => setActiveTab('financials')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'financials'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-amber-400 hover:text-white hover:bg-slate-800/80'
              }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Financials & Reports</span>
            {(depositRequests.filter(d => d.status === 'PENDING').length + withdrawalRequests.filter(w => w.status === 'PENDING' || w.status === 'IN_PROGRESS').length) > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeTab === 'financials' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500 text-slate-950'
                }`}>
                {depositRequests.filter(d => d.status === 'PENDING').length + withdrawalRequests.filter(w => w.status === 'PENDING' || w.status === 'IN_PROGRESS').length}
              </span>
            )}
          </button>
        )}

        {!isOddsOnlyStaff && (
          <button
            id="admin-tab-bets"
            onClick={() => setActiveTab('bets')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'bets'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            <Coins className="w-3.5 h-3.5" />
            Global Bets Book ({allBets.length})
          </button>
        )}

        {!isOddsOnlyStaff && (
          <button
            id="admin-tab-system"
            onClick={() => setActiveTab('system')}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${activeTab === 'system'
                ? 'bg-rose-700 text-white shadow-sm font-black'
                : 'text-rose-400 hover:text-white hover:bg-slate-800'
              }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>System Control & Staff</span>
          </button>
        )}
      </div>

      {/* TAB 1: ONLY SHOW LIVE RACE LIFECYCLE */}
      {(activeTab === 'live' || activeTab === 'lifecycle' || activeTab === 'races') && (
        <div className="space-y-6">
          {/* Metrics Banner - ONLY IN LIVE RACES */}
          {!isOddsOnlyStaff && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium">Registered Users</p>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="text-lg sm:text-2xl font-black text-white font-mono">
                    {users.length > 0 ? users.filter((u) => u.role !== 'admin').length : (stats?.totalUsers || 0)}
                  </p>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">
                    {new Set((allBets || []).map((b) => b.user_id)).size} Active Bettors
                  </span>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium">Platform Bets</p>
                <p className="text-lg sm:text-2xl font-black text-indigo-400 mt-1 font-mono">
                  {allBets.length > 0 ? allBets.length : (stats?.totalBets || 0)}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium">Total Turnover</p>
                <p className="text-lg sm:text-2xl font-black text-emerald-400 mt-1 font-mono truncate">
                  ₹{(allBets.length > 0 ? allBets.reduce((s, b) => s + (b.amount || 0), 0) : (stats?.totalVolume || 0)).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium">Pending Bets In-Play</p>
                <p className="text-lg sm:text-2xl font-black text-amber-400 mt-1 font-mono">
                  {allBets.length > 0 ? allBets.filter((b) => b.status === 'PENDING').length : (stats?.pendingBetsCount || 0)}
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-500" />
                <span>🔴 Live Races Lifecycle & Settle</span>
              </h2>
              <p className="text-xs text-slate-400">
                Manage active in-play races, adjust live odds, suspend runners, and settle winners with 1-click payouts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('upcoming')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-slate-700 transition cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>View Published Races ({races.filter((r) => r.status === 'UPCOMING' || r.status === 'OPEN' || r.status === 'DRAFT').length})</span>
              </button>
              <button
                onClick={() => setActiveTab('add_race')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Race Fixture</span>
              </button>
            </div>
          </div>

          {/* ACTIVE LIVE RACES COCKPITS */}
          {(() => {
            const liveRaces = races.filter((r) => r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING');
            if (liveRaces.length > 0) {
              return (
                <div className="space-y-6">
                  {liveRaces.map((liveRace) => {
                    const liveBets = getRaceBets(liveRace.id);
                    const liveTurnover = getRaceTurnover(liveRace.id);
                    return (
                      <div
                        key={liveRace.id}
                        className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#1a080d] via-slate-900 to-[#0b101d] border-2 border-rose-500/70 shadow-[0_0_35px_rgba(244,63,94,0.25)] space-y-4 animate-in fade-in duration-300"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-rose-500/30">
                          <div className="flex items-center gap-2.5">
                            <span className="relative flex h-3.5 w-3.5">
                              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
                            </span>
                            <div>
                              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/50 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                                🔴 ACTIVE LIVE RACE IN-PLAY
                              </span>
                              <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
                                {liveRace.name}
                              </h3>
                            </div>
                          </div>

                          {/* Cockpit KPI Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                              <span className="text-slate-400 block text-[10px]">In-Play Bets</span>
                              <strong className="text-amber-400 font-mono font-black">{liveBets.length} Bets</strong>
                            </div>
                            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                              <span className="text-slate-400 block text-[10px]">Live Turnover</span>
                              <strong className="text-emerald-400 font-mono font-black">₹{liveTurnover.toLocaleString()}</strong>
                            </div>
                            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                              <span className="text-slate-400 block text-[10px]">Runners Field</span>
                              <strong className="text-white font-mono font-bold">{liveRace.horses.length} Runners</strong>
                            </div>
                          </div>
                        </div>

                        {/* Race Meta info bar */}
                        <div className="flex items-center gap-3 text-xs flex-wrap text-slate-300">
                          {liveRace.race_no && (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-black text-[11px] border border-indigo-500/30">
                              RACE #{liveRace.race_no}
                            </span>
                          )}
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {liveRace.venue}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {liveRace.race_time}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{liveRace.distance}</span>
                        </div>

                        {/* Live Quick Odds Table */}
                        <div className="bg-slate-950/90 rounded-2xl border border-slate-800/90 p-3 overflow-x-auto">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2">
                            <span>Live Runners & Odds Suspension Control</span>
                            <button
                              onClick={() => {
                                setSelectedOddsRaceId(liveRace.id);
                                setActiveTab('odds');
                              }}
                              className="text-xs text-rose-400 hover:text-rose-300 underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Sliders className="w-3 h-3" />
                              <span>Open Full Live Odds Board</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                            {liveRace.horses.map((horse) => (
                              <div
                                key={horse.id}
                                className={`p-2 rounded-xl border flex items-center justify-between text-xs transition ${horse.is_suspended
                                    ? 'bg-rose-950/40 border-rose-500/40 opacity-75'
                                    : 'bg-slate-900 border-slate-800'
                                  }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] bg-slate-800 text-white shrink-0">
                                    {horse.serial_no || horse.horse_no}
                                  </span>
                                  <div className="truncate">
                                    <p className="font-bold text-white truncate">{horse.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">J: {horse.jockey}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  {horse.is_suspended ? (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-black text-[9px] uppercase border border-rose-500/40">
                                      SUSPENDED
                                    </span>
                                  ) : (
                                    <div className="text-right font-mono">
                                      <span className="text-amber-400 font-bold block text-[11px]">W:{horse.win_odds.toFixed(2)}</span>
                                      <span className="text-emerald-400 text-[10px] block">P:{horse.place_odds.toFixed(2)}</span>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleHorseSuspend(liveRace.id, horse.id)}
                                    className={`p-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${horse.is_suspended
                                        ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600'
                                        : 'bg-rose-600/20 text-rose-300 border-rose-500/30 hover:bg-rose-600 hover:text-white'
                                      }`}
                                    title={horse.is_suspended ? 'Resume Runner' : 'Suspend Runner'}
                                  >
                                    {horse.is_suspended ? 'RESUME' : 'SUSP'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      soundManager.playClick();
                                      setOddsHistoryModalHorse({ horse, race: liveRace });
                                    }}
                                    className="p-1 rounded-lg text-[10px] font-bold border border-slate-700 bg-slate-900 text-amber-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                                    title="View Odds History Log"
                                  >
                                    <Clock className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 📊 MASTER RISK & LIABILITY METER FOR THIS LIVE RACE */}
                        <div className="bg-[#050907] rounded-2xl border-2 border-emerald-900/60 p-4 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-amber-400" />
                              <h4 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
                                Live Liability & Bookmaker Risk Meter
                              </h4>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Total Race Pool: <strong className="text-emerald-400 font-black">₹{liveTurnover.toLocaleString('en-IN')}</strong>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {liveRace.horses.map((horse) => {
                              const runnerWinBets = liveBets.filter((b) => b.horse_id === horse.id && b.bet_type === 'WIN');
                              const runnerPlaceBets = liveBets.filter((b) => b.horse_id === horse.id && b.bet_type === 'PLACE');
                              const winStake = runnerWinBets.reduce((s, b) => s + (b.stake || b.amount || 0), 0);
                              const placeStake = runnerPlaceBets.reduce((s, b) => s + (b.stake || b.amount || 0), 0);
                              const totalRunnerStake = winStake + placeStake;

                              const winPayoutLiability = runnerWinBets.reduce((s, b) => s + ((b.stake || b.amount || 0) * b.odds), 0);
                              const netWinExposure = winPayoutLiability - liveTurnover;
                              const isHighRisk = netWinExposure > 0;

                              return (
                                <div
                                  key={horse.id}
                                  className={`p-3 rounded-xl border transition ${isHighRisk && totalRunnerStake > 0
                                      ? 'bg-[#1a080d] border-red-500/50 shadow-sm'
                                      : totalRunnerStake > 0
                                        ? 'bg-[#0a150d] border-emerald-500/40'
                                        : 'bg-slate-900/80 border-slate-800'
                                    }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="w-5 h-5 rounded font-black text-[10px] bg-slate-800 text-white flex items-center justify-center shrink-0">
                                        {horse.serial_no || horse.horse_no}
                                      </span>
                                      <span className="text-xs font-black text-white truncate">{horse.name}</span>
                                    </div>
                                    <span className="font-mono text-[11px] font-bold text-amber-400">
                                      {horse.win_odds.toFixed(2)}x
                                    </span>
                                  </div>

                                  <div className="space-y-1 text-[11px] font-mono">
                                    <div className="flex items-center justify-between text-slate-400">
                                      <span>Total Bet Volume:</span>
                                      <strong className="text-white">₹{totalRunnerStake.toLocaleString('en-IN')}</strong>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-400">
                                      <span>Win Payout Liability:</span>
                                      <strong className={isHighRisk ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                                        ₹{Math.round(winPayoutLiability).toLocaleString('en-IN')}
                                      </strong>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                                      <span className="text-[10px] text-slate-400 font-sans font-bold">Admin Net Exposure:</span>
                                      <span className={`px-2 py-0.2 rounded font-bold text-[10px] ${netWinExposure > 0
                                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        }`}>
                                        {netWinExposure > 0
                                          ? `-₹${Math.round(netWinExposure).toLocaleString('en-IN')} (RISK)`
                                          : `+₹${Math.round(Math.abs(netWinExposure)).toLocaleString('en-IN')} (SAFE)`}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Real-time Match Bets Breakdown */}
                        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-rose-500/30 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              <Coins className="w-4 h-4 text-amber-400" />
                              <span>Punter Bets on this Match ({liveBets.length} Bets • ₹{liveTurnover.toLocaleString()} Pool)</span>
                            </span>
                            <span className="text-[11px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                              {liveBets.length > 0 ? `${new Set(liveBets.map((b) => b.user_id)).size} Bettors Active` : '0 Active Bettors'}
                            </span>
                          </div>

                          {liveBets.length > 0 ? (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {liveBets.map((b) => {
                                const u = users.find((usr) => usr.id === b.user_id);
                                return (
                                  <div
                                    key={b.id}
                                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${b.bet_type === 'WIN' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                                        }`}>
                                        {b.bet_type}
                                      </span>
                                      <span className="text-white font-bold">{b.horse_name || `Horse #${b.horse_no}`}</span>
                                      <span className="text-slate-400 text-[11px]">@{b.odds.toFixed(2)}x</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-400 text-[11px] truncate max-w-[120px]">
                                        {u?.username || u?.name || b.username || 'Bettor'}
                                      </span>
                                      <strong className="text-emerald-400 font-black">₹{b.stake?.toLocaleString() || b.amount?.toLocaleString()}</strong>
                                      {b.status === 'PENDING' && (
                                        <button
                                          type="button"
                                          onClick={() => handleCancelSingleBet(b)}
                                          className="p-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white text-[10px] font-bold border border-red-500/30 transition cursor-pointer"
                                          title="Cancel single bet & refund"
                                        >
                                          Cancel
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 italic py-1 text-center bg-slate-900/50 rounded-xl">
                              No bets placed on this match yet. When users bet, each wager and stake amount updates here automatically.
                            </p>
                          )}
                        </div>

                          {/* Cockpit Actions: Declare Settlement, Abandon & Suspend All */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => handleToggleRaceSuspendAll(liveRace.id)}
                                className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                                  liveRace.horses.every((h) => h.is_suspended)
                                    ? 'bg-emerald-600 text-white border-emerald-400 hover:bg-emerald-500 shadow-md'
                                    : 'bg-rose-600/30 text-rose-300 border-rose-500/40 hover:bg-rose-600 hover:text-white'
                                }`}
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{liveRace.horses.every((h) => h.is_suspended) ? 'RESUME ALL RUNNERS' : 'SUSPEND ALL BETTING'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAbandonRace(liveRace)}
                                className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                                title="Declare Abandoned / Void and refund all bets 100%"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Declare Abandoned</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleStatusChange(liveRace.id, 'CLOSED')}
                                className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Lock Wagering</span>
                              </button>
                            </div>

                            {/* MAIN END LIVE & SETTLE BUTTON */}
                            <button
                              type="button"
                              id={`live-declare-result-btn-${liveRace.id}`}
                              onClick={() => handleOpenSettle(liveRace)}
                              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-xl shadow-amber-950/50 flex items-center justify-center gap-2 ring-2 ring-amber-400/40 active:scale-95"
                            >
                              <Trophy className="w-4 h-4 text-slate-950" />
                              <span>🏆 END LIVE & SETTLE WINNERS</span>
                            </button>
                          </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            return (
              <div className="p-8 sm:p-10 rounded-3xl bg-slate-900/90 border border-dashed border-slate-800 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
                  <Flame className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h4 className="text-base sm:text-lg font-black text-white">No Live Race In-Play Right Now</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    There are currently no races active in the live lifecycle. Switch to the <strong>"Published Races"</strong> tab to select a race and click <strong>"Make Live (Open Betting)"</strong>.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('upcoming')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition cursor-pointer active:scale-95"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Go to Published Races ({races.filter((r) => r.status === 'UPCOMING' || r.status === 'OPEN' || r.status === 'DRAFT').length}) →</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB: SAVED RACE CARDS (DRAFTS - ODDS CLOSED) */}
      {activeTab === 'saved' && (
        <div className="space-y-6">
          {/* Top Banner / Prompt to Publish All */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-blue-950/80 border-2 border-indigo-500/50 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base sm:text-lg font-black text-white">
                  📋 Saved Race Cards ({races.filter((r) => r.status === 'DRAFT').length})
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase tracking-wider">
                  🔒 ODDS CLOSED & PRIVATE
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Races created here are saved securely as drafts with betting odds closed. When all race cards are ready, tap <strong>"PUBLISH ALL SAVED CARDS FOR USER VIEW"</strong> to release them to user apps.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {races.filter((r) => r.status === 'DRAFT').length > 0 && (
                <button
                  id="publish-all-saved-cards-btn"
                  onClick={handlePublishAllSavedCards}
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/50 border border-emerald-400/50 active:scale-95 disabled:opacity-50"
                  title="Publish all saved cards to user app"
                >
                  <CheckCircle2 className="w-4 h-4 fill-current text-slate-950" />
                  <span>📢 PUBLISH ALL FOR USER VIEW ({races.filter((r) => r.status === 'DRAFT').length})</span>
                </button>
              )}
              <button
                onClick={() => setActiveTab('add_race')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Race Card</span>
              </button>
            </div>
          </div>

          {/* Saved Draft Race Cards List */}
          <div className="space-y-4">
            {races
              .filter((r) => r.status === 'DRAFT')
              .map((race) => (
                <div
                  key={race.id}
                  className="bg-slate-900 rounded-3xl border border-indigo-500/30 hover:border-indigo-500/60 p-4 sm:p-5 space-y-4 shadow-lg transition"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      {/* Race Image Thumbnail */}
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-700/80 shrink-0 shadow-md">
                        <img
                          src={race.image_url || '/images/race_action.jpg'}
                          alt={race.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/race_action.jpg';
                          }}
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-center text-[9px] font-bold text-slate-300 py-0.5 backdrop-blur-xs">
                          {race.distance}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          {race.race_no && (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-black text-[11px] border border-indigo-500/30">
                              RACE #{race.race_no}
                            </span>
                          )}
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {race.venue}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {race.race_time}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{race.date_str || 'Today'}</span>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="text-base font-bold text-white">
                            {race.name}
                          </h4>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase tracking-wider">
                            <Lock className="w-3 h-3 text-indigo-400" />
                            <span>SAVED DRAFT (ODDS CLOSED)</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full md:w-auto">
                      {/* Publish for User View */}
                      <button
                        id={`publish-draft-btn-${race.id}`}
                        onClick={() => handlePublishRace(race.id)}
                        disabled={isLoading}
                        className="col-span-2 sm:col-span-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md border border-emerald-400/40 active:scale-95 disabled:opacity-50"
                        title="Publish this race card for users to view (Odds Closed)"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>📢 Publish for User View</span>
                      </button>

                      {/* Direct Set Odds & Open Betting */}
                      <button
                        id={`open-draft-betting-btn-${race.id}`}
                        onClick={() => handleOpenRaceForBetting(race)}
                        disabled={isLoading}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50"
                        title="Set live odds and open betting immediately"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-slate-950" />
                        <span>⚡ Open Betting</span>
                      </button>

                      <button
                        id={`edit-draft-race-btn-${race.id}`}
                        onClick={() => handleOpenEdit(race)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        id={`delete-draft-race-btn-${race.id}`}
                        onClick={() => handleDeleteRace(race.id, race.name)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition cursor-pointer flex items-center justify-center"
                        title="Delete draft race card"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Runners Field Preview */}
                  <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 p-3 overflow-x-auto">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2">
                      <span>Field Runners ({race.horses.length} entries)</span>
                      <span className="text-slate-500 font-mono">S.No | Gate | Horse | Jockey | Trainer | Win / Place Baseline</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {race.horses.map((horse, idx) => (
                        <div
                          key={horse.id || idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] bg-indigo-500/20 text-indigo-300 shrink-0">
                              {horse.serial_no || horse.horse_no}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-amber-400 font-mono font-bold shrink-0">
                              G:{horse.gate_no !== undefined ? horse.gate_no : (horse.serial_no || horse.horse_no)}
                            </span>
                            <div className="truncate">
                              <p className="font-bold text-white truncate">{horse.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                J: {horse.jockey} • T: {horse.trainer}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2 font-mono">
                            <span className="text-amber-400 font-bold block text-[11px]">{horse.win_odds.toFixed(2)}</span>
                            <span className="text-emerald-400 text-[10px] block">{horse.place_odds.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

            {races.filter((r) => r.status === 'DRAFT').length === 0 && (
              <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                <Bookmark className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No Saved Draft Race Cards</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When you create a race card under "Add New Race", save it as a draft to keep it private until you are ready to publish all cards together.
                </p>
                <button
                  onClick={() => setActiveTab('add_race')}
                  className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  + Add New Race Card
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PUBLISHED & UPCOMING RACES LIFECYCLE */}
      {activeTab === 'upcoming' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                <span>⏱️ Published Races & Upcoming Schedule</span>
              </h2>
              <p className="text-xs text-slate-400">
                Published fixtures are visible to users with <strong>"Betting to start 30 minutes prior to race"</strong> (Odds Closed). Click <strong className="text-emerald-400">"Make Live (Open Betting)"</strong> when ready to accept live bets.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('add_race')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Race Fixture</span>
              </button>
            </div>
          </div>

          {/* Sub-Filter: Center Selector Pills (Only shown when active centers exist) */}
          {(() => {
            const activeCentersWithUpcoming = (raceCenters || []).filter((cntr) => {
              const centerCount = (races || []).filter(r =>
                (r.status === 'UPCOMING' || r.status === 'OPEN') &&
                (r.center_id === cntr.id || (r.venue && r.venue.toLowerCase().includes(cntr.name.toLowerCase())))
              ).length;
              return centerCount > 0;
            });

            if (activeCentersWithUpcoming.length === 0) return null;

            return (
              <div className="space-y-2 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Active Centers for Today ({activeCentersWithUpcoming.length}):</span>
                  </span>
                  <span className="text-[10px] text-slate-500">1 active live race per center</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs font-bold pb-0.5">
                  <button
                    onClick={() => setSelectedCenterFilter('all')}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap text-xs ${selectedCenterFilter === 'all'
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                        : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                  >
                    All Active Centers ({races.filter(r => r.status === 'UPCOMING' || r.status === 'OPEN').length})
                  </button>
                  {activeCentersWithUpcoming.map((cntr) => {
                    const centerCount = (races || []).filter(r =>
                      (r.status === 'UPCOMING' || r.status === 'OPEN') &&
                      (r.center_id === cntr.id || (r.venue && r.venue.toLowerCase().includes(cntr.name.toLowerCase())))
                    ).length;
                    return (
                      <button
                        key={cntr.id}
                        onClick={() => setSelectedCenterFilter(cntr.id)}
                        className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap text-xs flex items-center gap-1 ${selectedCenterFilter === cntr.id
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-sm'
                            : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                          }`}
                      >
                        <span>{cntr.name}</span>
                        <span className="text-[10px] opacity-75 font-mono">({centerCount})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Upcoming Races List */}
          <div className="space-y-3">
            {races
              .filter((race) => {
                if (selectedCenterFilter !== 'all') {
                  const matchesCenter = race.center_id === selectedCenterFilter ||
                    (race.venue && race.venue.toLowerCase().includes(selectedCenterFilter.replace('cntr_', '')));
                  if (!matchesCenter) return false;
                }
                return race.status === 'UPCOMING' || race.status === 'OPEN';
              })
              .map((race) => (
                <div
                  key={race.id}
                  className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-slate-700 p-4 sm:p-5 space-y-3 shadow-sm transition"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      {/* Race Image Thumbnail */}
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-700/80 shrink-0 shadow-md">
                        <img
                          src={race.image_url || '/images/race_action.jpg'}
                          alt={race.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/race_action.jpg';
                          }}
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-center text-[9px] font-bold text-slate-300 py-0.5 backdrop-blur-xs">
                          {race.distance}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          {race.race_no && (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-black text-[11px] border border-indigo-500/30">
                              RACE #{race.race_no}
                            </span>
                          )}
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {race.venue}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {race.race_time}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{race.date_str || 'Today'}</span>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="text-base font-bold text-white">
                            {race.name}
                          </h4>
                          {/* Live Countdown Timer Badge */}
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-black uppercase tracking-wider font-mono shadow-sm">
                            <Timer className="w-3 h-3 text-emerald-400" />
                            {getRaceCountdown(race.race_time)}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            👁️ PUBLISHED (ODDS CLOSED)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Action controls */}
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full md:w-auto">
                      {/* PRIMARY 1-CLICK ACTION: MAKE LIVE */}
                      <button
                        id={`make-live-btn-${race.id}`}
                        onClick={() => handleOpenRaceForBetting(race)}
                        disabled={isLoading}
                        className="col-span-2 sm:col-span-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 border border-emerald-400/50 active:scale-95"
                        title="Instantly open this race as LIVE in-play and start accepting user wagers"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-slate-950" />
                        <span>⚡ MAKE LIVE (OPEN BETTING)</span>
                      </button>

                      <button
                        id={`edit-upcoming-race-btn-${race.id}`}
                        onClick={() => handleOpenEdit(race)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        id={`delete-upcoming-race-btn-${race.id}`}
                        onClick={() => handleDeleteRace(race.id, race.name)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition cursor-pointer flex items-center justify-center"
                        title="Delete race fixture"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Runners Preview Grid */}
                  <div className="bg-slate-950/70 rounded-xl border border-slate-800/80 p-3 overflow-x-auto">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2">
                      <span>Field Runners ({race.horses.length} entries)</span>
                      <span className="text-slate-500 font-mono">S.No | Gate | Horse | Jockey | Trainer | Win / Place</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {race.horses.map((horse, idx) => (
                        <div
                          key={horse.id || idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] bg-indigo-500/20 text-indigo-300 shrink-0">
                              {horse.serial_no || horse.horse_no}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-amber-400 font-mono font-bold shrink-0">
                              G:{horse.gate_no !== undefined ? horse.gate_no : (horse.serial_no || horse.horse_no)}
                            </span>
                            <div className="truncate">
                              <p className="font-bold text-white truncate">{horse.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                J: {horse.jockey} • T: {horse.trainer}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2 font-mono">
                            <span className="text-amber-400 font-bold block text-[11px]">{horse.win_odds.toFixed(2)}</span>
                            <span className="text-emerald-400 text-[10px] block">{horse.place_odds.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Published Race Match Bets Summary */}
                    {(() => {
                      const pubBets = getRaceBets(race.id);
                      const pubTurnover = getRaceTurnover(race.id);
                      if (pubBets.length === 0) return null;
                      return (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-xs flex items-center justify-between">
                          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            <span>Pre-Post Bets Placed: <strong className="text-white font-mono">{pubBets.length} Bets</strong></span>
                          </span>
                          <strong className="text-emerald-400 font-mono font-bold">Total ₹{pubTurnover.toLocaleString()}</strong>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}

            {races.filter((r) => r.status === 'UPCOMING' || r.status === 'OPEN').length === 0 && (
              <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                <p className="text-sm font-semibold text-slate-300">No Published Races in Queue</p>
                <p className="text-xs text-slate-500">Go to "Saved Race Cards" to publish drafted fixtures for users, or create a new race fixture.</p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setActiveTab('saved')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    View Saved Cards ({races.filter((r) => r.status === 'DRAFT').length})
                  </button>
                  <button
                    onClick={() => setActiveTab('add_race')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer border border-slate-700"
                  >
                    + Add New Race Card
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FINISHED RACES & BET AUDIT */}
      {activeTab === 'finished' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>Finished Races & Bet Audit</span>
              </h2>
              <p className="text-xs text-slate-400">
                Browse completed races, official podium declarations, and inspect detailed user-by-user betting ledgers and payouts
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                🏆 {races.filter((r) => r.status === 'RESULTED' || r.status === 'CLOSED').length} Settled Races
              </span>
            </div>
          </div>

          {/* Center Selector Filter (Only shown when settled centers exist) */}
          {(() => {
            const activeSettledCenters = (raceCenters || []).filter((cntr) => {
              const count = races.filter(r =>
                (r.status === 'RESULTED' || r.status === 'CLOSED') &&
                (r.center_id === cntr.id || (r.venue && r.venue.toLowerCase().includes(cntr.name.toLowerCase())))
              ).length;
              return count > 0;
            });

            if (activeSettledCenters.length === 0) return null;

            return (
              <div className="flex items-center gap-1.5 bg-slate-900 p-2 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-none text-xs font-bold">
                <button
                  onClick={() => setSelectedCenterFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap text-xs ${selectedCenterFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                >
                  All Settled Centers ({races.filter(r => r.status === 'RESULTED' || r.status === 'CLOSED').length})
                </button>
                {activeSettledCenters.map((cntr) => {
                  const count = races.filter(r =>
                    (r.status === 'RESULTED' || r.status === 'CLOSED') &&
                    (r.center_id === cntr.id || (r.venue && r.venue.toLowerCase().includes(cntr.name.toLowerCase())))
                  ).length;
                  return (
                    <button
                      key={cntr.id}
                      onClick={() => setSelectedCenterFilter(cntr.id)}
                      className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap text-xs flex items-center gap-1 ${selectedCenterFilter === cntr.id
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-sm'
                          : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                        }`}
                    >
                      <span>{cntr.name}</span>
                      <span className="text-[10px] opacity-75 font-mono">({count})</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Finished Races Cards */}
          <div className="space-y-4">
            {races
              .filter((race) => {
                if (selectedCenterFilter !== 'all') {
                  const matchesCenter = race.center_id === selectedCenterFilter ||
                    (race.venue && race.venue.toLowerCase().includes(selectedCenterFilter.replace('cntr_', '')));
                  if (!matchesCenter) return false;
                }
                return race.status === 'RESULTED' || race.status === 'CLOSED';
              })
              .map((race) => {
                const raceBets = getRaceBets(race.id);
                const turnover = getRaceTurnover(race.id);
                const payouts = getRacePayouts(race.id);
                const profit = turnover - payouts;
                const p1Horses = race.horses.filter(h => race.position_1?.includes(h.id));
                const p2Horses = race.horses.filter(h => race.position_2?.includes(h.id));
                const p3Horses = race.horses.filter(h => race.position_3?.includes(h.id));
                const isDeadHeat = (race.position_1?.length || 0) > 1 || (race.position_2?.length || 0) > 1 || (race.position_3?.length || 0) > 1;

                return (
                  <div
                    key={race.id}
                    className="bg-slate-900 rounded-3xl border border-slate-800 hover:border-amber-500/50 p-4 sm:p-5 space-y-4 shadow-md transition"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          {race.race_no && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black text-[11px] border border-amber-500/40">
                              RACE #{race.race_no}
                            </span>
                          )}
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {race.venue}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-300">{race.race_time}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{race.date_str || 'Settled'}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{race.distance}</span>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base sm:text-lg font-black text-white">
                            {race.name}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-black uppercase tracking-wider">
                            🏆 OFFICIAL RESULT DECLARED
                          </span>
                          {isDeadHeat && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black uppercase tracking-wider">
                              ⚖️ DEAD HEAT
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Financial KPI Badges */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 block">Total Bets</span>
                          <strong className="text-white text-xs font-mono font-bold">{raceBets.length}</strong>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 block">Turnover Pool</span>
                          <strong className="text-emerald-400 text-xs font-mono font-bold">₹{turnover.toLocaleString()}</strong>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 block">Total Payouts</span>
                          <strong className="text-amber-400 text-xs font-mono font-bold">₹{payouts.toLocaleString()}</strong>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 block">Bookie Margin</span>
                          <strong className={`text-xs font-mono font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {profit >= 0 ? `+₹${profit.toLocaleString()}` : `-₹${Math.abs(profit).toLocaleString()}`}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Official Podium Results Box */}
                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                        <span className="text-amber-400 font-black text-[11px] block">
                          🥇 1st Place (WIN):
                        </span>
                        <span className="text-white font-bold text-xs truncate block mt-0.5">
                          {p1Horses.length > 0 ? p1Horses.map(h => `#${h.serial_no || h.horse_no} ${h.name}`).join(' & ') : 'Not recorded'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
                        <span className="text-blue-300 font-black text-[11px] block">
                          🥈 2nd Place:
                        </span>
                        <span className="text-white font-bold text-xs truncate block mt-0.5">
                          {p2Horses.length > 0 ? p2Horses.map(h => `#${h.serial_no || h.horse_no} ${h.name}`).join(' & ') : 'None'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                        <span className="text-emerald-300 font-black text-[11px] block">
                          🥉 3rd Place:
                        </span>
                        <span className="text-white font-bold text-xs truncate block mt-0.5">
                          {p3Horses.length > 0 ? p3Horses.map(h => `#${h.serial_no || h.horse_no} ${h.name}`).join(' & ') : 'None'}
                        </span>
                      </div>
                    </div>

                    {/* Action Row: Open Full Bet Audit Ledger */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="text-xs text-slate-400">
                        Click below to inspect each individual user bet, odds locked, and payouts won.
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id={`view-bet-ledger-btn-${race.id}`}
                          onClick={() => {
                            soundManager.playClick();
                            setAuditRace(race);
                            setAuditBetSearch('');
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>📊 View User Bet Ledger ({raceBets.length} Bets)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenSettle(race)}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1"
                        >
                          <Trophy className="w-3.5 h-3.5 text-blue-400" />
                          <span>Re-Settle Result</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            {races.filter((r) => r.status === 'RESULTED' || r.status === 'CLOSED').length === 0 && (
              <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                <Trophy className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No Settled Races Yet</p>
                <p className="text-xs text-slate-500">When you complete a live race and declare the results, it will appear here with full bet auditing.</p>
              </div>
            )}
          </div>
        </div>
      )}


      {/* TAB 2: Live Odds Editor (Handwritten Sheet System) */}
      {activeTab === 'odds' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-400" />
                <span>Live Odds Management System</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider">
                  Handwritten Layout Live
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Directly manage and update Win/Place live odds and suspend runners in real-time
              </p>
            </div>

            {/* Quick race picker for eligible open/live races only */}
            {(() => {
              const oddsEligibleRaces = races.filter(r => r.status !== 'CLOSED' && r.status !== 'RESULTED');
              if (oddsEligibleRaces.length === 0) return null;
              return (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold hidden sm:inline">Select Race:</span>
                  <select
                    value={selectedOddsRaceId && oddsEligibleRaces.some(r => r.id === selectedOddsRaceId) ? selectedOddsRaceId : (oddsEligibleRaces.find(r => r.status === 'LIVE')?.id || oddsEligibleRaces[0]?.id || '')}
                    onChange={(e) => setSelectedOddsRaceId(e.target.value)}
                    className="bg-slate-900 border border-emerald-500/40 text-xs font-bold text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#e5b869]"
                  >
                    {oddsEligibleRaces.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.race_no ? `R#${r.race_no} - ` : ''}{r.name} ({r.venue} • {r.status})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })()}
          </div>

          {(() => {
            const oddsEligibleRaces = races.filter(r => r.status !== 'CLOSED' && r.status !== 'RESULTED');

            if (oddsEligibleRaces.length === 0) {
              return (
                <div className="p-10 text-center bg-slate-900 rounded-3xl border border-slate-800 space-y-3 max-w-xl mx-auto my-6 shadow-xl">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-xl">
                    🏁
                  </div>
                  <h3 className="text-base font-bold text-white">No Live or Open Races</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This race has been closed/settled. The Live Odds Editor only operates on races that are currently in-play (<strong>LIVE</strong>) or scheduled upcoming fixtures.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('lifecycle')}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs transition cursor-pointer shadow mt-2"
                  >
                    Go to Race Lifecycle & Control
                  </button>
                </div>
              );
            }

            const currentRaceId = selectedOddsRaceId && oddsEligibleRaces.some(r => r.id === selectedOddsRaceId)
              ? selectedOddsRaceId
              : (oddsEligibleRaces.find(r => r.status === 'LIVE')?.id || oddsEligibleRaces[0]?.id);
            const activeRace = oddsEligibleRaces.find(r => r.id === currentRaceId) || oddsEligibleRaces[0];

            const isAllSuspended = activeRace.is_suspended || activeRace.horses.every(h => h.is_suspended);

            // Live Market Analysis calculations for the active race
            const raceBets = (allBets || []).filter(b => 
              (b.race_id === activeRace.id || (b.race_name && activeRace.name && b.race_name.trim().toLowerCase() === activeRace.name.trim().toLowerCase())) && 
              b.status !== 'CANCELLED'
            );
            const totalTurnover = raceBets.reduce((sum, b) => sum + (b.stake || b.amount || 0), 0);
            const totalWinTurnover = raceBets.filter(b => b.bet_type === 'WIN').reduce((s, b) => s + (b.stake || b.amount || 0), 0);
            const totalPlaceTurnover = raceBets.filter(b => b.bet_type === 'PLACE').reduce((s, b) => s + (b.stake || b.amount || 0), 0);

            const runnerAnalysis = activeRace.horses.map((h, idx) => {
              const slNo = h.serial_no || h.horse_no || (idx + 1);
              const isMatch = (b: Bet) => 
                b.horse_id === h.id || 
                (b.horse_name && h.name && b.horse_name.trim().toUpperCase() === h.name.trim().toUpperCase()) ||
                (b.horse_no !== undefined && (b.horse_no === h.horse_no || b.horse_no === slNo));

              const runnerWinBets = raceBets.filter(b => isMatch(b) && b.bet_type === 'WIN');
              const runnerPlaceBets = raceBets.filter(b => isMatch(b) && b.bet_type === 'PLACE');
              const winStaked = runnerWinBets.reduce((s, b) => s + (b.stake || b.amount || 0), 0);
              const placeStaked = runnerPlaceBets.reduce((s, b) => s + (b.stake || b.amount || 0), 0);
              const totalStaked = winStaked + placeStaked;
              const betCount = runnerWinBets.length + runnerPlaceBets.length;
              const marketSharePct = totalTurnover > 0 ? (totalStaked / totalTurnover) * 100 : 0;

              const currentWin = tempOdds[h.id]?.win_odds !== undefined && tempOdds[h.id].win_odds !== '' ? Number(tempOdds[h.id].win_odds) : h.win_odds;
              const currentPlace = tempOdds[h.id]?.place_odds !== undefined && tempOdds[h.id].place_odds !== '' ? Number(tempOdds[h.id].place_odds) : h.place_odds;

              const winPayoutLiability = runnerWinBets.reduce((s, b) => s + ((b.stake || b.amount || 0) * (b.odds || currentWin)), 0);
              const placePayoutLiability = runnerPlaceBets.reduce((s, b) => s + ((b.stake || b.amount || 0) * (b.odds || currentPlace)), 0);
              const totalPayoutIfWins = winPayoutLiability + placePayoutLiability;
              const bookmakerPnL = totalTurnover - totalPayoutIfWins;
              const isLoss = bookmakerPnL < 0;

              return {
                horse: h,
                slNo,
                betCount,
                winBetsCount: runnerWinBets.length,
                placeBetsCount: runnerPlaceBets.length,
                winStaked,
                placeStaked,
                totalStaked,
                marketSharePct,
                currentWin,
                currentPlace,
                winPayoutLiability,
                placePayoutLiability,
                totalPayoutIfWins,
                bookmakerPnL,
                isLoss,
              };
            });

            // Find the worst case risk runner for bookmaker
            const worstCase = runnerAnalysis.length > 0
              ? runnerAnalysis.reduce((worst, curr) => curr.bookmakerPnL < worst.bookmakerPnL ? curr : worst, runnerAnalysis[0])
              : null;

            return (
              <div className="space-y-4">
                {/* Race Quick Switcher Pills (Eligible Open/Upcoming Races Only) */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-none text-xs font-bold flex-1">
                    {oddsEligibleRaces.map((r) => {
                      const isSelected = r.id === activeRace.id;
                      const isLive = r.status === 'LIVE';
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            soundManager.playClick();
                            setSelectedOddsRaceId(r.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${isSelected
                              ? 'bg-gradient-to-r from-[#d4af37] to-[#e5b869] text-black font-black shadow-md'
                              : isLive
                                ? 'bg-rose-950/40 text-rose-300 border border-rose-500/30 hover:text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                          {isLive && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                          <span>{r.race_no ? `R#${r.race_no} - ` : ''}{r.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Cockpit View Mode Switcher */}
                  <div className="flex items-center bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs font-bold shrink-0">
                    <button
                      type="button"
                      onClick={() => setCockpitViewMode('BOARD')}
                      className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${cockpitViewMode === 'BOARD' ? 'bg-[#e5b869] text-black font-black shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      <span>📋 Odds Board</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCockpitViewMode('MARKET')}
                      className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${cockpitViewMode === 'MARKET' ? 'bg-[#e5b869] text-black font-black shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      <span>📊 Market Analysis</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCockpitViewMode('SPLIT')}
                      className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${cockpitViewMode === 'SPLIT' ? 'bg-[#e5b869] text-black font-black shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      <span>⚡ Split View</span>
                    </button>
                  </div>
                </div>

                {/* ---------------- REAL-TIME LIVE MARKET SUMMARY KPI TICKER ---------------- */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#06100c] p-3 sm:p-4 rounded-2xl border border-emerald-900/60 shadow-xl font-mono">
                  {/* Total Pool Turnover */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-emerald-800/40">
                    <span className="text-[10px] sm:text-xs text-slate-400 block font-sans">Total Race Turnover</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <strong className="text-base sm:text-lg text-emerald-400 font-black">₹{totalTurnover.toLocaleString('en-IN')}</strong>
                      <span className="text-[10px] text-slate-400">({raceBets.length} Bets)</span>
                    </div>
                  </div>

                  {/* Win Pool Volume */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-800/40">
                    <span className="text-[10px] sm:text-xs text-slate-400 block font-sans">WIN Market Staked</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <strong className="text-base sm:text-lg text-amber-400 font-black">₹{totalWinTurnover.toLocaleString('en-IN')}</strong>
                      <span className="text-[10px] text-slate-400">({raceBets.filter(b => b.bet_type === 'WIN').length} Bets)</span>
                    </div>
                  </div>

                  {/* Place Pool Volume */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-teal-800/40">
                    <span className="text-[10px] sm:text-xs text-slate-400 block font-sans">PLACE Market Staked</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <strong className="text-base sm:text-lg text-teal-300 font-black">₹{totalPlaceTurnover.toLocaleString('en-IN')}</strong>
                      <span className="text-[10px] text-slate-400">({raceBets.filter(b => b.bet_type === 'PLACE').length} Bets)</span>
                    </div>
                  </div>

                  {/* Worst-Case Book Liability & Exposure */}
                  <div className={`p-2.5 rounded-xl border ${worstCase && worstCase.isLoss
                      ? 'bg-rose-950/40 border-rose-500/60 text-rose-300'
                      : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] sm:text-xs font-sans block">Worst-Case Result</span>
                      {worstCase && (
                        <span className="text-[10px] font-bold">#{worstCase.slNo} {worstCase.horse.name.slice(0, 10)}</span>
                      )}
                    </div>
                    <div className="mt-0.5">
                      {worstCase ? (
                        worstCase.isLoss ? (
                          <strong className="text-base sm:text-lg text-rose-400 font-black">
                            -₹{Math.abs(Math.round(worstCase.bookmakerPnL)).toLocaleString('en-IN')} (RISK)
                          </strong>
                        ) : (
                          <strong className="text-base sm:text-lg text-emerald-400 font-black">
                            +₹{Math.round(worstCase.bookmakerPnL).toLocaleString('en-IN')} (PROFIT)
                          </strong>
                        )
                      ) : (
                        <strong className="text-base sm:text-lg text-slate-400 font-black">₹0 (No Bets Yet)</strong>
                      )}
                    </div>
                  </div>
                </div>

                {/* ---------------- EXACT HANDWRITTEN ODDS BOARD CONTAINER ---------------- */}
                {(cockpitViewMode === 'BOARD' || cockpitViewMode === 'SPLIT') && (
                  <div className="bg-[#091510] rounded-2xl border-2 border-emerald-900/80 shadow-2xl overflow-hidden">
                    {(() => {
                      const timingStatus = getRaceBettingCloseStatus(activeRace);
                      const isAllSuspended = !!(activeRace.is_suspended || (activeRace.horses && activeRace.horses.length > 0 && activeRace.horses.every((h) => h.is_suspended)));
                      return (
                        <>
                          {/* Handwritten Header: 01 | XYZ PLATE | 1200M | 1:30 | 1-Min Auto-Close | SUSP ALL */}
                          <div className="bg-[#040805] border-b-2 border-emerald-900/80 p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                              {/* Race No box */}
                              <div className="px-3 py-1.5 rounded-xl bg-[#1a170b] border-2 border-[#e5b869] text-[#e5b869] font-mono font-black text-sm sm:text-base shadow-inner">
                                {String(activeRace.race_no || '01').padStart(2, '0')}
                              </div>

                              {/* Race Name */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-base sm:text-xl font-black text-white uppercase tracking-wider font-mono">
                                    {activeRace.name}
                                  </h3>
                                  {activeRace.status === 'LIVE' || activeRace.status === 'OPEN_FOR_BETTING' ? (
                                    <span className="px-2.5 py-1 rounded-full bg-rose-500/25 text-rose-400 border border-rose-500/50 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                                      <span>🔴 LIVE IN-PLAY</span>
                                    </span>
                                  ) : activeRace.status === 'CLOSED' ? (
                                    <span className="px-2.5 py-1 rounded-full bg-rose-950/60 text-rose-400 border border-rose-600/50 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                      <Lock className="w-3 h-3 text-rose-400" />
                                      <span>🔒 BETTING CLOSED</span>
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold uppercase flex items-center gap-1.5">
                                      <Clock className="w-3 h-3 text-emerald-400" />
                                      <span>⏱️ UPCOMING FIXTURE</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono mt-0.5">
                                  <MapPin className="w-3 h-3 text-[#e5b869]" />
                                  <span>{activeRace.venue}</span>
                                  <span>•</span>
                                  <span className="text-amber-400 font-bold">{activeRace.horses.length} Runners</span>
                                </p>
                              </div>

                              {/* Distance & Time Pills + 1-Min Auto-Close Badge */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-1 rounded-xl bg-slate-900 border border-emerald-700/50 text-emerald-400 font-black font-mono text-xs sm:text-sm">
                                  {activeRace.distance || '1200M'}
                                </span>
                                <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-bold font-mono text-xs sm:text-sm flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Post: {activeRace.race_time || '1:00 PM'}</span>
                                </span>
                                {/* 1-Minute Auto-Close Status Badge */}
                                <span className={`px-3 py-1 rounded-xl font-mono font-bold text-xs flex items-center gap-1.5 border shadow-sm ${timingStatus.badgeColor === 'rose'
                                    ? 'bg-rose-950/60 text-rose-300 border-rose-500/60'
                                    : timingStatus.badgeColor === 'amber'
                                      ? 'bg-amber-950/60 text-amber-300 border-amber-500/60 animate-pulse'
                                      : 'bg-slate-900 text-emerald-300 border-emerald-500/40'
                                  }`}>
                                  <Timer className="w-3.5 h-3.5" />
                                  <span>Closes: {timingStatus.closeTimeStr} (1 min prior)</span>
                                </span>
                              </div>
                            </div>

                            {/* Master "SUSP ALL" / "RESUME ALL" & Live Status Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextSNo = activeRace.horses.length + 1;
                                  setQuickHorseData({
                                    name: '',
                                    jockey: '',
                                    trainer: '',
                                    horse_no: String(nextSNo),
                                    gate_no: String(nextSNo),
                                    win_odds: '2.50',
                                    place_odds: '1.40'
                                  });
                                  setQuickAddHorseRace(activeRace);
                                }}
                                className="px-3 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 border border-indigo-500/40"
                                title="Add a horse inside this race"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Add Horse</span>
                              </button>

                              <button
                                type="button"
                                id={`master-susp-all-btn-${activeRace.id}`}
                                onClick={() => handleToggleRaceSuspendAll(activeRace.id)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-black font-mono transition cursor-pointer shadow-lg active:scale-95 flex items-center gap-1.5 border ${isAllSuspended
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50 shadow-emerald-950/40'
                                    : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400/50 shadow-rose-950/40'
                                  }`}
                              >
                                <AlertCircle className="w-4 h-4" />
                                <span>{isAllSuspended ? '🟢 RESUME ALL' : '🚫 SUSP ALL'}</span>
                              </button>

                              {activeRace.status === 'LIVE' || activeRace.status === 'OPEN_FOR_BETTING' ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleCloseBettingForRace(activeRace)}
                                    className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 border border-rose-500/50"
                                    title="Manually lock and close betting for this race"
                                  >
                                    <Lock className="w-3.5 h-3.5 text-rose-400" />
                                    <span>Close Betting</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSettlingRace(activeRace);
                                      soundManager.playClick();
                                    }}
                                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-1.5 shadow"
                                  >
                                    <Trophy className="w-3.5 h-3.5" />
                                    <span>Settle Winners</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleMakeRaceLive(activeRace)}
                                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 border border-emerald-400/50 active:scale-95"
                                >
                                  <Flame className="w-3.5 h-3.5 text-slate-950" />
                                  <span>⚡ OPEN FOR BETTING (Go Live)</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* ---------------- RUNNERS ODDS TABLE & SUSPEND CONTAINER ---------------- */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[760px]">
                              <thead>
                                <tr className="bg-[#020503] border-b-2 border-emerald-900/80 text-xs font-black uppercase tracking-wider text-slate-300 font-mono">
                                  <th className="py-3 px-3 w-16 text-center border-r border-emerald-900/50">
                                    SL
                                  </th>
                                  <th className="py-3 px-4 border-r border-emerald-900/50">
                                    Horse Details & Live Volume
                                  </th>
                                  <th className="py-3 px-4 w-52 text-center border-r border-emerald-900/50">
                                    <span className="text-amber-400 block text-xs sm:text-sm font-black">WIN Odds</span>
                                    <span className="text-[9px] text-slate-400 font-normal">Live Multiplier</span>
                                  </th>
                                  <th className="py-3 px-4 w-52 text-center border-r border-emerald-900/50">
                                    <span className="text-emerald-400 block text-xs sm:text-sm font-black">PLACE Odds</span>
                                    <span className="text-[9px] text-slate-400 font-normal">Live Multiplier</span>
                                  </th>
                                  <th className="py-3 px-4 w-56 text-center">
                                    <span className="block text-xs font-black">Controls</span>
                                    <span className="text-[9px] text-slate-400 font-normal">[SUSPEND / RESUME / EDIT]</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-emerald-950/80">
                                {runnerAnalysis.map((item) => {
                                  const horse = item.horse;
                                  const isSuspended = horse.is_suspended || activeRace.is_suspended;
                                  const isEditing = editingHorseId === horse.id || isSuspended;
                                  const slNo = item.slNo;
                                  const currentWinVal = tempOdds[horse.id]?.win_odds !== undefined ? tempOdds[horse.id].win_odds : horse.win_odds;
                                  const currentPlaceVal = tempOdds[horse.id]?.place_odds !== undefined ? tempOdds[horse.id].place_odds : horse.place_odds;
                                  const numWin = item.currentWin;
                                  const numPlace = item.currentPlace;

                                  return (
                                    <React.Fragment key={horse.id || slNo}>
                                      <tr
                                        id={`admin-horse-row-${horse.id}`}
                                        className={`transition-colors font-mono ${isSuspended
                                            ? 'bg-rose-950/30'
                                            : item.slNo % 2 === 0
                                              ? 'bg-[#091510]'
                                              : 'bg-[#07100c]'
                                          } hover:bg-[#0f241a]`}
                                      >
                                        {/* SL (Serial Number) */}
                                        <td className="py-3 px-3 text-center font-black text-sm text-slate-200 border-r border-emerald-900/50">
                                          <span className={`inline-flex w-8 h-8 rounded-xl items-center justify-center font-bold text-sm ${isSuspended
                                              ? 'bg-rose-950 border border-rose-500 text-rose-300'
                                              : 'bg-[#040805] border border-emerald-900/80 text-[#e5b869]'
                                            }`}>
                                            {slNo}
                                          </span>
                                        </td>

                                        {/* Horse Name + Live Volume + If Wins Payout & Bookmaker PnL */}
                                        <td className="py-3 px-4 border-r border-emerald-900/50">
                                          <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-sm font-black text-white uppercase tracking-wide">
                                                {horse.name || `RUNNER #${slNo}`}
                                              </span>
                                              {isSuspended ? (
                                                <span className="px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-300 border border-rose-500/50 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                                  <span>🚫 SUSPENDED</span>
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase">
                                                  🟢 Live
                                                </span>
                                              )}
                                            </div>

                                            {/* Jockey / Trainer / Gate */}
                                            <div className="text-[11px] text-slate-400 font-sans flex items-center gap-2 flex-wrap">
                                              <span>J: <strong className="text-slate-200">{horse.jockey || 'Jockey'}</strong></span>
                                              <span>•</span>
                                              <span>T: <strong className="text-slate-300">{horse.trainer || 'Trainer'}</strong></span>
                                              {horse.gate_no !== undefined && (
                                                <>
                                                  <span>•</span>
                                                  <span className="text-amber-400 font-semibold font-mono">Gate {horse.gate_no}</span>
                                                </>
                                              )}
                                            </div>

                                            {/* Live Market Analysis Pill for this Runner */}
                                            <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap bg-[#030906] p-1.5 rounded-lg border border-emerald-950/60">
                                              <span className="text-slate-300 font-semibold">
                                                ₹{item.totalStaked.toLocaleString('en-IN')} Staked ({item.betCount} Bets • {item.marketSharePct.toFixed(0)}% Pool)
                                              </span>
                                              <span className="text-slate-600">|</span>
                                              <span className="text-slate-400">
                                                Payout if Wins: <strong className="text-amber-400">₹{Math.round(item.totalPayoutIfWins).toLocaleString('en-IN')}</strong>
                                              </span>
                                              <span className="text-slate-600">|</span>
                                              <span className={`px-1.5 py-0.5 rounded font-black border ${item.isLoss
                                                  ? 'bg-rose-950/60 text-rose-300 border-rose-500/60'
                                                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/60'
                                                }`}>
                                                Book P&L: {item.isLoss ? `-₹${Math.abs(Math.round(item.bookmakerPnL)).toLocaleString('en-IN')}` : `+₹${Math.round(item.bookmakerPnL).toLocaleString('en-IN')}`}
                                              </span>
                                            </div>
                                          </div>
                                        </td>

                                        {/* WIN Odds: Direct Quick Step + Input */}
                                        <td className="py-2.5 px-3 border-r border-emerald-900/50 text-center">
                                          <div className="flex items-center justify-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const next = Math.max(1.05, Math.round((numWin - 0.1) * 100) / 100);
                                                setTempOdds(prev => ({ ...prev, [horse.id]: { ...prev[horse.id], win_odds: next } }));
                                                if (!isSuspended) {
                                                  handleUpdateOdds(horse.id, next, numPlace);
                                                }
                                              }}
                                              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-black text-xs border border-slate-700 flex items-center justify-center cursor-pointer active:scale-95"
                                              title="-0.10"
                                            >
                                              -
                                            </button>

                                            <input
                                              type="number"
                                              step="0.05"
                                              min="1.05"
                                              value={currentWinVal}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                setTempOdds(prev => ({ ...prev, [horse.id]: { ...prev[horse.id], win_odds: val } }));
                                              }}
                                              onBlur={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if (!isSuspended && val >= 1.05 && val !== horse.win_odds) {
                                                  handleUpdateOdds(horse.id, val, numPlace);
                                                }
                                              }}
                                              className={`w-24 px-2 py-1.5 bg-[#020503] border-2 rounded-lg text-amber-400 font-black font-mono text-center text-xs sm:text-sm focus:outline-none shadow-inner ${isSuspended ? 'border-rose-500/80' : 'border-amber-500/60 focus:border-amber-300'
                                                }`}
                                            />

                                            <button
                                              type="button"
                                              onClick={() => {
                                                const next = Math.round((numWin + 0.1) * 100) / 100;
                                                setTempOdds(prev => ({ ...prev, [horse.id]: { ...prev[horse.id], win_odds: next } }));
                                                if (!isSuspended) {
                                                  handleUpdateOdds(horse.id, next, numPlace);
                                                }
                                              }}
                                              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-black text-xs border border-slate-700 flex items-center justify-center cursor-pointer active:scale-95"
                                              title="+0.10"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </td>

                                        {/* PLACE Odds: Direct Quick Step + Input */}
                                        <td className="py-2.5 px-3 border-r border-emerald-900/50 text-center">
                                          <div className="flex items-center justify-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const next = Math.max(1.02, Math.round((numPlace - 0.05) * 100) / 100);
                                                setTempOdds(prev => ({ ...prev, [horse.id]: { ...prev[horse.id], place_odds: next } }));
                                                if (!isSuspended) {
                                                  handleUpdateOdds(horse.id, numWin, next);
                                                }
                                              }}
                                              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-black text-xs border border-slate-700 flex items-center justify-center cursor-pointer active:scale-95"
                                              title="-0.05"
                                            >
                                              -
                                            </button>

                                            <input
                                              type="number"
                                              step="0.05"
                                              min="1.02"
                                              value={currentPlaceVal}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                setTempOdds(prev => ({ ...prev, [horse.id]: { ...prev[horse.id], place_odds: val } }));
                                              }}
                                              onBlur={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if (!isSuspended && val >= 1.02 && val !== horse.place_odds) {
                                                  handleUpdateOdds(horse.id, numWin, val);
                                                }
                                              }}
                                              className={`w-24 px-2 py-1.5 bg-[#020503] border-2 rounded-lg text-emerald-400 font-black font-mono text-center text-xs sm:text-sm focus:outline-none shadow-inner ${isSuspended ? 'border-rose-500/80' : 'border-emerald-500/60 focus:border-emerald-300'
                                                }`}
                                            />

                                            <button
                                              type="button"
                                              onClick={() => {
                                                const next = Math.round((numPlace + 0.05) * 100) / 100;
                                                setTempOdds(prev => ({ ...prev, [horse.id]: { ...prev[horse.id], place_odds: next } }));
                                                if (!isSuspended) {
                                                  handleUpdateOdds(horse.id, numWin, next);
                                                }
                                              }}
                                              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-black text-xs border border-slate-700 flex items-center justify-center cursor-pointer active:scale-95"
                                              title="+0.05"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </td>

                                        {/* Action: Prominent Suspend / Resume Button per runner */}
                                        <td className="py-2.5 px-3 text-center">
                                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                            {isSuspended ? (
                                              <button
                                                type="button"
                                                id={`action-resume-runner-btn-${horse.id}`}
                                                onClick={() => handleResumeHorse(activeRace.id, horse.id)}
                                                className="py-1.5 px-3.5 rounded-xl font-mono font-black text-xs transition cursor-pointer active:scale-95 border bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/80 shadow-md shadow-emerald-950/60 flex items-center gap-1"
                                                title="Click to publish new odds live and resume betting on this horse"
                                              >
                                                <Check className="w-3.5 h-3.5" />
                                                <span>RESUME</span>
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                id={`action-suspend-runner-btn-${horse.id}`}
                                                onClick={() => handleSuspendHorse(activeRace.id, horse.id)}
                                                className="py-1.5 px-3.5 rounded-xl font-mono font-black text-xs transition cursor-pointer active:scale-95 border bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 hover:text-white border-rose-500/60 flex items-center gap-1 shadow-sm"
                                                title="Click SUSPEND to stop user betting and edit odds"
                                              >
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                <span>SUSPEND</span>
                                              </button>
                                            )}

                                            {/* Odds History Audit Modal Trigger Button */}
                                            <button
                                              type="button"
                                              id={`odds-history-btn-${horse.id}`}
                                              onClick={() => {
                                                soundManager.playClick();
                                                setOddsHistoryModalHorse({ horse, race: activeRace });
                                              }}
                                              className="p-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-slate-700/80 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                              title="View Odds History (audit log)"
                                            >
                                              <Clock className="w-3.5 h-3.5" />
                                              <span className="text-[10px] hidden xl:inline">History</span>
                                            </button>

                                            {/* Delete Runner from Race */}
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteHorseFromRace(activeRace.id, horse.id, horse.name)}
                                              className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-800 transition cursor-pointer"
                                              title="Remove runner from race card"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>

                                      {/* ---------------- EXPANDED INLINE ODDS EDITING CONTAINER (When Suspended / Editing) ---------------- */}
                                      {isEditing && (
                                        <tr className="bg-[#120808] border-y-2 border-rose-500/60">
                                          <td colSpan={5} className="p-3 sm:p-4">
                                            <div className="bg-[#1c0c0c] border border-rose-500/40 rounded-2xl p-3 sm:p-4 space-y-3 shadow-inner">
                                              {/* Container Alert Banner */}
                                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-500/20 pb-2.5">
                                                <div className="flex items-center gap-2">
                                                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                                                  <h4 className="text-xs sm:text-sm font-black text-rose-300 font-mono uppercase tracking-wider">
                                                    🚫 Runner #{slNo} {horse.name} is Suspended — Edit Live Odds
                                                  </h4>
                                                </div>
                                                <span className="text-[11px] text-rose-300/80 font-mono">
                                                  Punters see "SUSPENDED / Odds Changing" in real time
                                                </span>
                                              </div>

                                              {/* Quick Odds Editing Grid (WIN & PLACE side by side) */}
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {/* WIN Odds Box */}
                                                <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/40 space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-amber-400 uppercase font-mono">WIN Odds Multiplier</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">₹1,000 Win = ₹{Math.round(numWin * 1000).toLocaleString()}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <input
                                                      type="number"
                                                      step="0.05"
                                                      min="1.05"
                                                      value={currentWinVal}
                                                      onChange={(e) => {
                                                        const val = e.target.value;
                                                        setTempOdds(prev => ({ ...prev, [horse.id]: { ...prev[horse.id], win_odds: val } }));
                                                      }}
                                                      className="w-full px-3 py-2 bg-[#020503] border-2 border-amber-500 rounded-xl text-amber-400 font-black font-mono text-base focus:outline-none focus:ring-2 focus:ring-amber-300 text-center"
                                                    />
                                                  </div>
                                                  {/* Quick Win step pills */}
                                                  <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono font-bold">
                                                    <span className="text-[10px] text-slate-400 mr-1">Quick:</span>
                                                    {[-0.5, -0.2, -0.1, 0.1, 0.2, 0.5, 1.0].map((step) => (
                                                      <button
                                                        key={`win-step-${step}`}
                                                        type="button"
                                                        onClick={() => {
                                                          const next = Math.max(1.05, Math.round((numWin + step) * 100) / 100);
                                                          setTempOdds(prev => ({ ...prev, [horse.id]: { ...prev[horse.id], win_odds: next } }));
                                                        }}
                                                        className={`px-2 py-1 rounded-lg border text-[11px] transition active:scale-95 cursor-pointer ${step < 0
                                                            ? 'bg-rose-950/40 text-rose-300 border-rose-500/40 hover:bg-rose-900/60'
                                                            : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                                                          }`}
                                                      >
                                                        {step > 0 ? `+${step.toFixed(2)}` : step.toFixed(2)}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>

                                                {/* PLACE Odds Box */}
                                                <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/40 space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-emerald-400 uppercase font-mono">PLACE Odds Multiplier</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">₹1,000 Place = ₹{Math.round(numPlace * 1000).toLocaleString()}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <input
                                                      type="number"
                                                      step="0.05"
                                                      min="1.02"
                                                      value={currentPlaceVal}
                                                      onChange={(e) => {
                                                        const val = e.target.value;
                                                        setTempOdds(prev => ({ ...prev, [horse.id]: { ...prev[horse.id], place_odds: val } }));
                                                      }}
                                                      className="w-full px-3 py-2 bg-[#020503] border-2 border-emerald-500 rounded-xl text-emerald-400 font-black font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-300 text-center"
                                                    />
                                                  </div>
                                                  {/* Quick Place step pills */}
                                                  <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono font-bold">
                                                    <span className="text-[10px] text-slate-400 mr-1">Quick:</span>
                                                    {[-0.2, -0.1, -0.05, 0.05, 0.1, 0.2].map((step) => (
                                                      <button
                                                        key={`place-step-${step}`}
                                                        type="button"
                                                        onClick={() => {
                                                          const next = Math.max(1.02, Math.round((numPlace + step) * 100) / 100);
                                                          setTempOdds(prev => ({ ...prev, [horse.id]: { ...prev[horse.id], place_odds: next } }));
                                                        }}
                                                        className={`px-2 py-1 rounded-lg border text-[11px] transition active:scale-95 cursor-pointer ${step < 0
                                                            ? 'bg-rose-950/40 text-rose-300 border-rose-500/40 hover:bg-rose-900/60'
                                                            : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                                                          }`}
                                                      >
                                                        {step > 0 ? `+${step.toFixed(2)}` : step.toFixed(2)}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Action Control: RESUME & BROADCAST NEW ODDS (Master Save & Broadcast) */}
                                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                                                <div className="text-[11px] text-slate-400 font-mono">
                                                  New Staged Odds: <strong className="text-amber-400">WIN {numWin.toFixed(2)}x</strong> • <strong className="text-emerald-400">PLACE {numPlace.toFixed(2)}x</strong>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleUpdateOdds(horse.id, numWin, numPlace)}
                                                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                                                    title="Save new odds on server without un-suspending runner yet"
                                                  >
                                                    💾 Save Odds (Stay Suspended)
                                                  </button>

                                                  <button
                                                    type="button"
                                                    id={`save-resume-horse-btn-${horse.id}`}
                                                    onClick={() => handleResumeHorse(activeRace.id, horse.id)}
                                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 active:scale-95"
                                                  >
                                                    <CheckCheck className="w-4 h-4 text-slate-950" />
                                                    <span>✅ RESUME & BROADCAST ODDS</span>
                                                  </button>
                                                </div>
                                              </div>

                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Table Bottom Action Bar (matching bottom of handwritten sheet with Susp All at bottom right) */}
                          <div className="bg-[#040805] border-t-2 border-emerald-900/80 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-slate-400 font-mono">
                                Race Card: <strong className="text-white">{activeRace.horses.length} Runners</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextSNo = activeRace.horses.length + 1;
                                  setQuickHorseData({
                                    name: '',
                                    jockey: '',
                                    trainer: '',
                                    horse_no: String(nextSNo),
                                    gate_no: String(nextSNo),
                                    win_odds: '2.50',
                                    place_odds: '1.40'
                                  });
                                  setQuickAddHorseRace(activeRace);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Add Horse to Race</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(activeRace)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Edit Fixture</span>
                              </button>

                              {activeRace.status === 'LIVE' || activeRace.status === 'OPEN_FOR_BETTING' ? (
                                <button
                                  type="button"
                                  onClick={() => handleCloseBettingForRace(activeRace)}
                                  className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-500/50 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                >
                                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Close Betting (1-Min Lock)</span>
                                </button>
                              ) : null}
                            </div>

                            {/* SUSP ALL / RESUME ALL button at Bottom Right as requested */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                id={`bottom-susp-all-btn-${activeRace.id}`}
                                onClick={() => handleToggleRaceSuspendAll(activeRace.id)}
                                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black font-mono transition cursor-pointer shadow-lg active:scale-95 flex items-center gap-2 border ${isAllSuspended
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50 shadow-emerald-950/40'
                                    : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400/50 shadow-rose-950/40'
                                  }`}
                              >
                                <AlertCircle className="w-4 h-4" />
                                <span>{isAllSuspended ? '🟢 RESUME ALL RUNNERS' : '🚫 SUSPEND ALL RUNNERS'}</span>
                              </button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* ---------------- DEDICATED LIVE MARKET ANALYSIS & BOOKMAKER LIABILITY MATRIX ---------------- */}
                {(cockpitViewMode === 'MARKET' || cockpitViewMode === 'SPLIT') && (
                  <div className="bg-[#040a07] rounded-2xl border-2 border-amber-500/40 shadow-2xl overflow-hidden font-mono">
                    {/* Header */}
                    <div className="bg-[#020503] border-b border-amber-500/30 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                          <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                            📊 Live Market Analysis & Bookmaker Liability Matrix
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                          Real-time breakdown: Money wagered on each runner, exact liability payout if that runner wins, and bookmaker net profit/loss.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 text-xs font-bold">
                          Race Pool: ₹{totalTurnover.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Liability Matrix Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[760px]">
                        <thead>
                          <tr className="bg-[#07130d] border-b border-emerald-950 text-xs font-black uppercase tracking-wider text-slate-300">
                            <th className="py-2.5 px-3 w-14 text-center">SL</th>
                            <th className="py-2.5 px-4">Runner</th>
                            <th className="py-2.5 px-3 text-center">Live Multipliers</th>
                            <th className="py-2.5 px-4">Money Backed (Volume)</th>
                            <th className="py-2.5 px-4 text-right">If Horse Wins (Payout)</th>
                            <th className="py-2.5 px-4 text-right">Bookmaker Net P&L</th>
                            <th className="py-2.5 px-4 text-center">Risk Defense</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-950/80">
                          {runnerAnalysis.map((item) => {
                            const horse = item.horse;
                            const isSuspended = horse.is_suspended || activeRace.is_suspended;

                            return (
                              <tr
                                key={`matrix-${horse.id}`}
                                className={`transition-colors ${item.isLoss
                                    ? 'bg-rose-950/20 hover:bg-rose-950/30'
                                    : item.slNo % 2 === 0
                                      ? 'bg-[#040805] hover:bg-[#08150e]'
                                      : 'bg-[#030604] hover:bg-[#08150e]'
                                  }`}
                              >
                                {/* SL */}
                                <td className="py-2.5 px-3 text-center font-bold text-slate-300">
                                  <span className="inline-flex w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 items-center justify-center text-[#e5b869]">
                                    {item.slNo}
                                  </span>
                                </td>

                                {/* Runner Name & Gate */}
                                <td className="py-2.5 px-4">
                                  <div>
                                    <span className="text-xs sm:text-sm font-bold text-white uppercase">
                                      {horse.name || `Runner #${item.slNo}`}
                                    </span>
                                    <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1.5">
                                      <span>J: {horse.jockey || 'Jockey'}</span>
                                      {horse.gate_no && <span>• Draw {horse.gate_no}</span>}
                                    </div>
                                  </div>
                                </td>

                                {/* Live Odds Multiplier */}
                                <td className="py-2.5 px-3 text-center">
                                  <div className="inline-flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
                                    <span className="text-amber-400 font-bold">W: {item.currentWin.toFixed(2)}x</span>
                                    <span className="text-slate-600">/</span>
                                    <span className="text-emerald-400 font-bold">P: {item.currentPlace.toFixed(2)}x</span>
                                  </div>
                                </td>

                                {/* Volume Staked & Market Share Progress Bar */}
                                <td className="py-2.5 px-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-bold text-slate-200">
                                        ₹{item.totalStaked.toLocaleString('en-IN')}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {item.marketSharePct.toFixed(1)}% ({item.betCount} Bets)
                                      </span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${item.marketSharePct > 35
                                            ? 'bg-rose-500'
                                            : item.marketSharePct > 20
                                              ? 'bg-amber-400'
                                              : 'bg-emerald-500'
                                          }`}
                                        style={{ width: `${Math.min(100, item.marketSharePct)}%` }}
                                      />
                                    </div>
                                    <div className="text-[9px] text-slate-500 flex items-center justify-between font-sans">
                                      <span>Win: ₹{item.winStaked.toLocaleString('en-IN')}</span>
                                      <span>Place: ₹{item.placeStaked.toLocaleString('en-IN')}</span>
                                    </div>
                                  </div>
                                </td>

                                {/* If Horse Wins -> Payout Required */}
                                <td className="py-2.5 px-4 text-right">
                                  <strong className="text-xs sm:text-sm font-black text-amber-400 block">
                                    ₹{Math.round(item.totalPayoutIfWins).toLocaleString('en-IN')}
                                  </strong>
                                  <span className="text-[9px] text-slate-500 font-sans block">
                                    (Win ₹{Math.round(item.winPayoutLiability).toLocaleString()} + Pl ₹{Math.round(item.placePayoutLiability).toLocaleString()})
                                  </span>
                                </td>

                                {/* Bookmaker Net P&L (Profit or Loss) */}
                                <td className="py-2.5 px-4 text-right">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-xl font-black text-xs border ${item.isLoss
                                      ? 'bg-rose-950/60 text-rose-300 border-rose-500/60 shadow-inner'
                                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/60 shadow-inner'
                                    }`}>
                                    {item.isLoss ? `-₹${Math.abs(Math.round(item.bookmakerPnL)).toLocaleString('en-IN')}` : `+₹${Math.round(item.bookmakerPnL).toLocaleString('en-IN')}`}
                                  </span>
                                  <span className="block text-[9px] text-slate-500 font-sans mt-0.5">
                                    {item.isLoss ? '🚨 High Exposure Risk' : '🟢 Safe Hold Profit'}
                                  </span>
                                </td>

                                {/* Risk Defense Quick Actions */}
                                <td className="py-2.5 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    {/* 1-Click Drop Odds button to reduce bookmaker exposure */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newWin = Math.max(1.05, Math.round((item.currentWin - 0.2) * 100) / 100);
                                        const newPlace = Math.max(1.02, Math.round((item.currentPlace - 0.1) * 100) / 100);
                                        setTempOdds(prev => ({ ...prev, [horse.id]: { win_odds: newWin, place_odds: newPlace } }));
                                        handleUpdateOdds(horse.id, newWin, newPlace);
                                      }}
                                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold transition active:scale-95 cursor-pointer"
                                      title="Drop odds by 0.20 to protect against over-exposure"
                                    >
                                      ⚡ Drop Odds (-0.20)
                                    </button>

                                    {/* Suspend button */}
                                    <button
                                      type="button"
                                      onClick={() => isSuspended ? handleResumeHorse(activeRace.id, horse.id) : handleSuspendHorse(activeRace.id, horse.id)}
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition active:scale-95 cursor-pointer ${isSuspended
                                          ? 'bg-emerald-600 text-white border-emerald-400'
                                          : 'bg-rose-950/60 text-rose-300 border-rose-500/60 hover:bg-rose-900/80'
                                        }`}
                                    >
                                      {isSuspended ? 'Resume' : 'Suspend'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 2.5: Masters (Level 1 Race Centers & Level 2 Race Days) */}
      {activeTab === 'masters' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 p-4 rounded-2xl border border-emerald-900/40">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                <span>Masters Management: Race Centers & Race Days</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Set up 3-Level hierarchy: <strong>Level 1 (Race Centers)</strong> ➔ <strong>Level 2 (Race Day Cards)</strong> ➔ <strong>Level 3 (Races)</strong>
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs border border-emerald-500/30 self-start sm:self-auto">
              {(raceCenters || []).filter(c => c && c.is_active).length} Active Centers
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEVEL 1: RACE CENTERS (DROPDOWN SELECTOR & CONTROLS) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Flag className="w-4 h-4 text-emerald-400" />
                    <span>Level 1 - Race Center Selector</span>
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleRestoreDefaultCenters}
                      title="Restore Mysore, Bangalore, Hyderabad, Pune, Mumbai, etc."
                      className="text-[11px] font-bold text-slate-400 hover:text-white transition flex items-center gap-1 cursor-pointer bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-lg border border-slate-700"
                    >
                      <RotateCcw className="w-3 h-3 text-cyan-400" />
                      <span className="hidden sm:inline">Reset Standard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddCenterForm(prev => !prev)}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 cursor-pointer bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/60"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{showAddCenterForm ? 'Close Form' : '+ Add New Center'}</span>
                    </button>
                  </div>
                </div>

                {/* Optional Collapsible Add Center Form */}
                {showAddCenterForm && (
                  <form onSubmit={handleCreateCenter} className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/40 space-y-3 text-xs animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Custom Race Center</span>
                      </span>
                      <span className="text-[10px] text-slate-400">Persists to Database</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Center Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. HYDERABAD"
                          value={newCenterName}
                          onChange={(e) => setNewCenterName(e.target.value)}
                          className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-xs uppercase focus:border-emerald-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Code (3-4 chars) *</label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          placeholder="e.g. HYD"
                          value={newCenterCode}
                          onChange={(e) => setNewCenterCode(e.target.value)}
                          className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold text-xs uppercase focus:border-emerald-400 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">City / Region (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Hyderabad, Telangana"
                        value={newCenterCity}
                        onChange={(e) => setNewCenterCity(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:border-emerald-400 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddCenterForm(false)}
                        className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-emerald-950/40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save & Add to Dropdown</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Dropdown Center Selector & Current Details */}
                {(() => {
                  const availableCenters = (raceCenters && raceCenters.length > 0) ? raceCenters : DEFAULT_RACE_CENTERS;
                  const currentCenterId = selectedManageCenterId || newRaceCenterId || availableCenters[0]?.id || 'cntr_mysore';
                  const currentCenter = availableCenters.find(c => c.id === currentCenterId) || availableCenters[0];
                  const centerRaces = currentCenter ? (races || []).filter(r => r.center_id === currentCenter.id || (r.venue && r.venue.toLowerCase().includes(currentCenter.name.toLowerCase()))) : [];

                  return (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-200">
                            <span>Select Center from Dropdown:</span>
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                            {availableCenters.length} Available Venues
                          </span>
                        </label>
                        <select
                          value={currentCenterId}
                          onChange={(e) => handleSelectCenter(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-950 border-2 border-emerald-500/50 rounded-xl text-white font-bold text-sm focus:border-emerald-400 outline-none transition cursor-pointer shadow-inner"
                        >
                          {availableCenters.map((c) => (
                            <option key={c.id} value={c.id} className="bg-slate-950 text-white py-1">
                              {c.name} ({c.code}) — {c.city || c.name} {c.is_active ? '' : '(Inactive)'}
                            </option>
                          ))}
                        </select>
                      </div>

                      {currentCenter && (
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono font-black text-xs border border-emerald-500/40">
                                {currentCenter.code}
                              </span>
                              <div>
                                <h4 className="font-black text-white text-sm">{currentCenter.name}</h4>
                                <p className="text-[11px] text-slate-400">{currentCenter.city} • {centerRaces.length} races linked</p>
                              </div>
                            </div>

                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider border ${currentCenter.is_active
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                              {currentCenter.is_active ? '🟢 ACTIVE' : '⚪ INACTIVE'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-900 text-xs">
                            <button
                              type="button"
                              onClick={() => handleToggleCenter(currentCenter)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer border flex items-center justify-center gap-1 ${currentCenter.is_active
                                  ? 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/60'
                                  : 'bg-emerald-600 text-white border-emerald-400 hover:bg-emerald-500'
                                }`}
                            >
                              {currentCenter.is_active ? 'Set Inactive' : 'Activate Center'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditCenter(currentCenter)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-200 hover:text-indigo-300 border border-slate-700 transition cursor-pointer flex items-center gap-1 font-semibold"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCenter(currentCenter.id, currentCenter.name)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/30 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer flex items-center gap-1 font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* LEVEL 2: RACE DAYS / RACE CARDS (7 COLS) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-[#e5b869]" />
                    <span>Level 2 - Race Day Cards ({(raceDays || []).length})</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">table: race_days</span>
                </div>

                {/* Create Race Day Form */}
                <form onSubmit={handleCreateRaceDay} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2.5 text-xs">
                  <span className="text-[11px] font-bold text-amber-400 block">+ Create New Race Day Card (Fixture Date)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Select Center *</label>
                      <select
                        required
                        value={newDayCenterId || selectedManageCenterId || (raceCenters && raceCenters[0]?.id) || 'cntr_mysore'}
                        onChange={(e) => handleSelectCenter(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-xs"
                      >
                        {((raceCenters && raceCenters.length > 0) ? raceCenters : DEFAULT_RACE_CENTERS).map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.code}) — {c.city || c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Race Date *</label>
                      <input
                        type="date"
                        required
                        value={newDayDate}
                        onChange={(e) => setNewDayDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Card Title (e.g. Mysore - 17th Sep 2026)</label>
                    <input
                      type="text"
                      placeholder="Optional custom title (leave blank for auto)"
                      value={newDayTitle}
                      onChange={(e) => setNewDayTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    id="btn-create-publish-race-day-card"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
                    <span>+ Create & Publish Card ➔ Add New Race</span>
                  </button>
                </form>

                {/* Race Days List */}
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {(raceDays || []).map((day) => {
                    const center = (raceCenters || []).find(c => c.id === day.center_id);
                    const dayRaces = (races || []).filter(r => r.race_day_id === day.id || (day.center_id && r.center_id === day.center_id));

                    return (
                      <div
                        key={day.id}
                        className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-slate-700 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{day.title}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${day.status === 'PUBLISHED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}>
                              {day.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="text-amber-400 font-semibold">{center?.name || 'Center'}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-300">{day.race_date}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-bold">{dayRaces.length} races on card</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {day.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handlePublishRaceDay(day.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                            >
                              Publish
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleQuickScheduleDay(day)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-sm"
                            title="1-Click Auto Generate 7 Races (1:00 PM, 1:30 PM, 2:00 PM, 2:30 PM, 3:00 PM, 3:30 PM, 4:00 PM)"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>⚡ Auto 7 Races (30m gap)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectCenter(day.center_id);
                              setNewRaceDayId(day.id);
                              if (center) setNewVenue(`${center.name} Turf Club`);
                              setActiveTab('add_race');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Race to Card</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditDay(day)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/30 text-slate-300 hover:text-amber-300 border border-slate-700 text-xs transition cursor-pointer"
                            title="Edit Race Day Card"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRaceDay(day.id)}
                            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-xs transition cursor-pointer"
                            title="Delete Race Day Card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Add New Race (Simplified Clean Manual Entry) */}
      {activeTab === 'add_race' && (
        <form onSubmit={handleCreateRace} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-5 max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add New Race Card</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Fill in race details and paste or enter runners. Odds can be adjusted in the Live Odds Editor before the race.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadPreset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition cursor-pointer"
                title="Fill 7 demo horses for quick testing"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Fill Demo (7 Horses)</span>
              </button>

              <button
                type="button"
                onClick={handleClearForm}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Blank</span>
              </button>
            </div>
          </div>

          {/* Race Master Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">
                Race Center / Location <span className="text-rose-400">*</span>
              </label>
              <select
                id="new-race-center-select"
                value={newRaceCenterId || selectedManageCenterId || (raceCenters && raceCenters[0]?.id) || 'cntr_mysore'}
                onChange={(e) => handleSelectCenter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-emerald-500"
              >
                {((raceCenters && raceCenters.length > 0) ? raceCenters : DEFAULT_RACE_CENTERS).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code}) — {c.city || c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">
                Race Day Card (Fixture Date)
              </label>
              <select
                id="new-race-day-select"
                value={newRaceDayId}
                onChange={(e) => setNewRaceDayId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-500"
              >
                <option value="">-- General / Today's Card --</option>
                {(raceDays || [])
                  .filter(d => !newRaceCenterId || d.center_id === newRaceCenterId)
                  .map(d => (
                    <option key={d.id} value={d.id}>{d.title} ({d.race_date})</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">
                Race Number <span className="text-rose-400">*</span>
              </label>
              <input
                id="new-race-no"
                type="number"
                min="1"
                max="20"
                value={newRaceNo}
                onChange={(e) => setNewRaceNo(e.target.value)}
                placeholder="e.g. 1"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Race Time <span className="text-rose-400">*</span></span>
                </span>
                {newTime && (
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                    {format24To12(newTime)}
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  id="new-race-time"
                  type="time"
                  required
                  value={format12To24(newTime)}
                  onChange={(e) => {
                    const val24 = e.target.value;
                    setNewTime(format24To12(val24));
                  }}
                  onClick={(e) => {
                    try {
                      (e.target as any).showPicker?.();
                    } catch { }
                  }}
                  className="w-full px-3 py-2 pl-9 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-mono focus:outline-none focus:border-emerald-500 cursor-pointer [color-scheme:dark]"
                />
                <Clock
                  onClick={() => {
                    const el = document.getElementById('new-race-time') as any;
                    el?.showPicker ? el.showPicker() : el?.focus();
                  }}
                  className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer hover:text-emerald-300"
                />
              </div>
              {/* Quick Preset Time Buttons */}
              <div className="flex items-center gap-1 mt-1.5 overflow-x-auto scrollbar-none text-[10px]">
                {['1:45 PM', '2:15 PM', '2:45 PM', '3:15 PM', '3:45 PM', '4:15 PM', '4:45 PM'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewTime(preset)}
                    className={`px-1.5 py-0.5 rounded transition cursor-pointer whitespace-nowrap font-mono ${format24To12(newTime) === preset
                        ? 'bg-emerald-600 text-slate-950 font-black border border-emerald-400 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800'
                      }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs text-slate-300 font-semibold mb-1">
                Name of the Race <span className="text-rose-400">*</span>
              </label>
              <input
                id="new-race-name"
                type="text"
                required
                value={newRaceName}
                onChange={(e) => setNewRaceName(e.target.value)}
                placeholder="e.g. The Rock of Gibraltar Plate"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">
                Distance <span className="text-rose-400">*</span>
              </label>
              <input
                id="new-race-distance"
                type="text"
                required
                value={newDistance}
                onChange={(e) => setNewDistance(e.target.value)}
                placeholder="e.g. 1400m"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Horse Race Action Image Selector & Custom Uploader */}
          <div className="space-y-3 pt-3 border-t border-slate-800 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <label className="block text-xs font-bold text-white flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                  Race Banner & Fixture Image
                </label>
                <p className="text-[11px] text-slate-400">Upload your own race banner or select from presets</p>
              </div>

              <label className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 border border-indigo-400/30">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageFileChange(e, setNewRaceImage, 'Race fixture')}
                />
              </label>
            </div>

            {/* Custom / Currently Selected Image Live Preview */}
            {newRaceImage && (
              <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500/60 bg-slate-900 group h-36 w-full flex items-center justify-center">
                <img src={newRaceImage} alt="Race Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent flex items-end justify-between p-3">
                  <div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] tracking-wide uppercase shadow">
                      Active Race Banner
                    </span>
                    <p className="text-white text-xs font-bold mt-1 line-clamp-1">
                      {newRaceImage.startsWith('data:') ? 'Custom Uploaded Device Image' : newRaceImage}
                    </p>
                  </div>
                  <label className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow">
                    <Upload className="w-3 h-3 text-indigo-400" />
                    <span>Change</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageFileChange(e, setNewRaceImage, 'Race fixture')}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Ready-made presets */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 mb-1.5">Or choose from ready-made presets:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {HORSE_IMAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setNewRaceImage(preset.url)}
                    className={`relative rounded-xl overflow-hidden border-2 text-left transition cursor-pointer group ${newRaceImage === preset.url
                        ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                        : 'border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                  >
                    <img src={preset.url} alt={preset.label} className="w-full h-16 object-cover" />
                    <div className="p-1.5 bg-slate-950/90 text-xs">
                      <p className="font-bold text-white text-[11px] truncate">{preset.label}</p>
                    </div>
                    {newRaceImage === preset.url && (
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] shadow">
                        Selected
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Runners Manual Entry Table */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  Runners Field List ({newHorses.length} Horses)
                </label>
                <p className="text-[11px] text-slate-400">
                  Enter Horse Number, Gate Number, Horse Name, Jockey Name, and Trainer Name
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="bulk-paste-add-race-btn"
                  onClick={() => {
                    setBulkPasteTarget('new');
                    setIsBulkPasteOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/50 text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
                  title="Paste entire field text"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>📋 Bulk Paste Horses</span>
                </button>

                <button
                  type="button"
                  id="add-runner-row-btn"
                  onClick={() => {
                    const nextSerial = newHorses.length + 1;
                    setNewHorses([
                      ...newHorses,
                      {
                        serial_no: nextSerial,
                        gate_no: nextSerial,
                        name: '',
                        jockey: '',
                        trainer: '',
                        win_odds: 2.5,
                        place_odds: 1.5,
                        silk_color: '#3b82f6',
                      },
                    ]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Row</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {newHorses.map((horse, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 p-2.5 sm:p-3 rounded-xl border border-slate-800/90 grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-2.5 items-center text-xs"
                >
                  {/* Horse Number (S.No) */}
                  <div className="col-span-1 sm:col-span-1">
                    <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">Horse #</label>
                    <input
                      type="number"
                      required
                      value={horse.serial_no}
                      onChange={(e) => {
                        const updated = [...newHorses];
                        updated[idx].serial_no = parseInt(e.target.value) || 0;
                        setNewHorses(updated);
                      }}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold text-center text-xs"
                      placeholder="No"
                    />
                  </div>

                  {/* Gate Number (Draw) */}
                  <div className="col-span-1 sm:col-span-1">
                    <label className="block text-[10px] text-amber-400 font-semibold mb-0.5">Gate</label>
                    <input
                      type="text"
                      required
                      value={horse.gate_no}
                      onChange={(e) => {
                        const updated = [...newHorses];
                        updated[idx].gate_no = e.target.value;
                        setNewHorses(updated);
                      }}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-amber-400 font-mono font-bold text-center text-xs"
                      placeholder="Gate"
                    />
                  </div>

                  {/* Horse Name */}
                  <div className="col-span-2 sm:col-span-4">
                    <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">
                      Name of the Horse <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={horse.name}
                      onChange={(e) => {
                        const updated = [...newHorses];
                        updated[idx].name = e.target.value;
                        setNewHorses(updated);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold text-xs uppercase"
                      placeholder="e.g. SPLENDIDO"
                    />
                  </div>

                  {/* Jockey Name */}
                  <div className="col-span-1 sm:col-span-3">
                    <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">
                      Jockey Name
                    </label>
                    <input
                      type="text"
                      value={horse.jockey}
                      onChange={(e) => {
                        const updated = [...newHorses];
                        updated[idx].jockey = e.target.value;
                        setNewHorses(updated);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs"
                      placeholder="e.g. S Sanjan"
                    />
                  </div>

                  {/* Trainer Name */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">
                      Trainer Name
                    </label>
                    <input
                      type="text"
                      value={horse.trainer}
                      onChange={(e) => {
                        const updated = [...newHorses];
                        updated[idx].trainer = e.target.value;
                        setNewHorses(updated);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs"
                      placeholder="e.g. Saddam Iqbal"
                    />
                  </div>

                  {/* Actions / Delete Row */}
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-end sm:justify-center pt-1 sm:pt-0">
                    <button
                      type="button"
                      disabled={newHorses.length <= 1}
                      onClick={() => {
                        if (newHorses.length <= 1) return;
                        setNewHorses(newHorses.filter((_, i) => i !== idx));
                      }}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-700/60 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                      title="Remove runner"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="sm:hidden text-[10px] text-rose-400 font-semibold">Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Total Runners: <strong className="text-white">{newHorses.filter(h => h.name && h.name.trim()).length} Valid</strong> ({newHorses.length} rows)
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                id="submit-save-draft-btn"
                onClick={() => setNewRaceStatus('DRAFT')}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Bookmark className="w-4 h-4" />
                <span>💾 Save to Saved Race Cards (Odds Closed)</span>
              </button>

              <button
                type="submit"
                id="submit-create-race-btn"
                onClick={() => setNewRaceStatus('UPCOMING')}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>🚀 Save & Publish for User View</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: Manage Banners */}
      {activeTab === 'banners' && (
        <div className="space-y-5">
          <form onSubmit={handleAddBanner} className="bg-slate-900 rounded-2xl border border-slate-800 p-4 sm:p-6 space-y-4 max-w-2xl shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  Create & Upload Promotional Banner
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload custom promotional graphics from your device or paste an image URL
                </p>
              </div>

              <label className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 border border-indigo-400/30">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Banner Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageFileChange(e, setNewBannerImg, 'Promotional banner')}
                />
              </label>
            </div>

            {/* Live Banner Preview Card */}
            {newBannerImg && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Live Banner Preview (How it appears in Slider)
                </label>
                <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-500/40 bg-slate-950 h-44 w-full shadow-lg">
                  <img src={newBannerImg} alt="Banner Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent flex flex-col justify-end p-4">
                    <span className="self-start text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider mb-1.5 shadow">
                      {newBannerTag || 'PROMOTION'}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-white leading-tight drop-shadow-md">
                      {newBannerTitle || 'Your Banner Headline Here'}
                    </h3>
                    <p className="text-xs text-slate-300 line-clamp-1 mt-0.5 drop-shadow">
                      {newBannerSubtitle || 'Your promotion details and subtitle will show here'}
                    </p>
                  </div>
                  <label className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow">
                    <Upload className="w-3 h-3 text-indigo-400" />
                    <span>Change File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageFileChange(e, setNewBannerImg, 'Promotional banner')}
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Banner Headline <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBannerTitle}
                  onChange={(e) => setNewBannerTitle(e.target.value)}
                  placeholder="e.g. Pune Derby Day 2026 - 100% Deposit Bonus"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Subtitle / Promo Pitch</label>
                <input
                  type="text"
                  value={newBannerSubtitle}
                  onChange={(e) => setNewBannerSubtitle(e.target.value)}
                  placeholder="e.g. Place your bets early for highest multiplier odds and instant payouts"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Or Paste Direct Image URL (Unsplash / Web CDN)
                </label>
                <input
                  type="text"
                  value={newBannerImg.startsWith('data:') ? '' : newBannerImg}
                  onChange={(e) => setNewBannerImg(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Badge Tag</label>
                  <input
                    type="text"
                    value={newBannerTag}
                    onChange={(e) => setNewBannerTag(e.target.value)}
                    placeholder="e.g. SPECIAL OFFER"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Action / Link</label>
                  <input
                    type="text"
                    value={newBannerLink}
                    onChange={(e) => setNewBannerLink(e.target.value)}
                    placeholder="e.g. #deposit or /race/race_blr_01"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs transition cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Publish Banner to Carousel Slider</span>
            </button>
          </form>

          {/* Existing Banners */}
          <div className="space-y-3">
            <h3 className="font-bold text-white text-sm">Active Banners</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {banners.map((banner) => (
                <div key={banner.id} className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 group">
                  <img src={banner.image_url} alt={banner.title} className="w-full h-32 object-cover" />
                  <div className="p-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {banner.tag}
                    </span>
                    <h4 className="font-bold text-white text-sm mt-1">{banner.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{banner.subtitle}</p>
                    <p className="text-[11px] text-indigo-400 font-mono mt-1">Link: {banner.link}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteBanner(banner.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/80 text-rose-400 hover:bg-rose-500 hover:text-white transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: All Registered Users & Wallet Operations */}
      {activeTab === 'users' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>Registered Bettors & User Accounts</span>
              </h2>
              <p className="text-xs text-slate-400">
                Live database records of all registered bettors with full name, verified Gmail, phone, wallet balance, exposure, and account control.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setAddUserModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md transition cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Bettor Manually</span>
              </button>
              <button
                onClick={loadAdminData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Users</span>
              </button>
              <span className="px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono">
                {users.length} Total Users
              </span>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">Total Registered</span>
              <strong className="text-base sm:text-lg font-black text-white font-mono">{users.filter((u) => u.role !== 'admin').length} Accounts</strong>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">Active Bettors (Wagered)</span>
              <strong className="text-base sm:text-lg font-black text-amber-400 font-mono">
                {new Set((allBets || []).map((b) => b.user_id)).size} Punters
              </strong>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">Total Outstanding User Balances</span>
              <strong className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                ₹{users.reduce((sum, u) => sum + (u.balance || 0), 0).toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">Blocked Accounts</span>
              <strong className="text-base sm:text-lg font-black text-rose-400 font-mono">
                {users.filter(u => u.is_blocked).length} Blocked
              </strong>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search by Unique ID (TURF-...), username, phone, or Gmail..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            {userSearchQuery && (
              <button
                onClick={() => setUserSearchQuery('')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>

          {/* ---------------- 1. MOBILE RESPONSIVE USER CARDS (No Horizontal Scrolling Needed) ---------------- */}
          <div className="block md:hidden space-y-3">
            {users
              .filter((u) => {
                if (!userSearchQuery) return true;
                const q = userSearchQuery.toLowerCase();
                return (
                  (u.ref_id && u.ref_id.toLowerCase().includes(q)) ||
                  u.id.toLowerCase().includes(q) ||
                  u.username.toLowerCase().includes(q) ||
                  (u.full_name && u.full_name.toLowerCase().includes(q)) ||
                  (u.email && u.email.toLowerCase().includes(q)) ||
                  u.phone.includes(q)
                );
              })
              .map((u) => {
                const displayUniqueId = u.ref_id || u.id;
                const userBetCount = (allBets || []).filter(b => b.user_id === u.id).length;
                const userDeposited = u.total_deposited || (depositRequests || []).filter(d => (d.user_id === u.id || d.username === u.username) && d.status === 'APPROVED').reduce((s, d) => s + (d.amount || 0), 0);
                const userWithdrawn = u.total_withdrawn || (withdrawalRequests || []).filter(w => (w.user_id === u.id || w.username === u.username) && (w.status === 'SUCCESSFUL' || w.status === 'IN_PROGRESS')).reduce((s, w) => s + (w.amount || 0), 0);
                return (
                  <div key={u.id} className="bg-slate-950 border border-slate-800/90 rounded-2xl p-3.5 space-y-3 shadow-md">
                    {/* Header: Avatar, Name, Unique ID, Status */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                          <img
                            src={u.profile_photo || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                            alt={u.username}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-white text-sm truncate">{u.full_name || u.username}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(displayUniqueId);
                                setCopiedUserId(displayUniqueId);
                                setTimeout(() => setCopiedUserId(null), 2000);
                              }}
                              className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-black border border-amber-500/40 hover:bg-amber-500/30 transition flex items-center gap-0.5 cursor-pointer shrink-0"
                              title="Click to copy Unique User ID"
                            >
                              <span>{displayUniqueId}</span>
                              {copiedUserId === displayUniqueId ? (
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 opacity-60" />
                              )}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">@{u.username}</p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {u.is_blocked ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            🛑 BLOCKED
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            u.role === 'admin'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}>
                            {u.role === 'admin' ? 'ADMIN' : 'ACTIVE'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contact details */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/80 p-2 rounded-xl border border-slate-800 font-mono">
                      <div className="truncate flex items-center gap-1 text-slate-300">
                        <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{u.phone}</span>
                      </div>
                      <div className="truncate flex items-center gap-1 text-emerald-300">
                        <Mail className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{u.email || 'No email'}</span>
                      </div>
                    </div>

                    {/* Financial Summary 4-box Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block uppercase font-bold">Liquid Balance</span>
                        <strong className="text-sm font-black text-emerald-400 font-mono">₹{u.balance.toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block uppercase font-bold">Exposure</span>
                        <strong className="text-xs font-black text-rose-400 font-mono">₹{u.exposure.toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block uppercase font-bold">Total Added</span>
                        <span className="text-xs font-bold text-emerald-400 font-mono">+{userDeposited > 0 ? `₹${userDeposited.toLocaleString('en-IN')}` : '₹0'}</span>
                      </div>
                      <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block uppercase font-bold">Withdrawn</span>
                        <span className="text-xs font-bold text-blue-400 font-mono">-{userWithdrawn > 0 ? `₹${userWithdrawn.toLocaleString('en-IN')}` : '₹0'}</span>
                      </div>
                    </div>

                    {/* Action Controls Row */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenUserLedger(u)}
                        className="py-1.5 px-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition flex items-center justify-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Ledger</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewBetsUser(u)}
                        className="py-1.5 px-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold transition flex items-center justify-center gap-1"
                      >
                        <Coins className="w-3 h-3" />
                        <span>{userBetCount} Bets</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoginAsUser(u)}
                        className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold transition flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3 h-3 text-indigo-400" />
                        <span>Login</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleBlockUser(u)}
                        className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition border flex items-center justify-center gap-1 ${
                          u.is_blocked
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        <Lock className="w-3 h-3" />
                        <span>{u.is_blocked ? 'Unblock' : 'Block'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setBalanceModalUser(u);
                          setBalanceModalType('CREDIT');
                          setBalanceModalAmount('1000');
                        }}
                        className="py-1.5 px-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-black font-black text-[10px] transition border border-emerald-500/30 flex items-center justify-center"
                      >
                        + Credit
                      </button>
                      <button
                        onClick={() => {
                          setBalanceModalUser(u);
                          setBalanceModalType('DEBIT');
                          setBalanceModalAmount('500');
                        }}
                        className="py-1.5 px-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-black text-[10px] transition border border-rose-500/30 flex items-center justify-center"
                      >
                        - Debit
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* ---------------- 2. DESKTOP / TABLET USER TABLE (Full Width) ---------------- */}
          <div className="hidden md:block overflow-x-auto scrollbar-none rounded-xl border border-slate-800/80 bg-slate-950">
            <table className="w-full min-w-[850px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[11px]">
                  <th className="py-3 px-3.5">User Profile & Unique ID</th>
                  <th className="py-3 px-3">Contact Details</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Total Added (₹)</th>
                  <th className="py-3 px-3 text-right">Withdrawn (₹)</th>
                  <th className="py-3 px-3 text-right">Current Balance</th>
                  <th className="py-3 px-3 text-right">Exposure</th>
                  <th className="py-3 px-3 text-center">Statement & Bets</th>
                  <th className="py-3 px-3.5 text-right">Admin Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users
                  .filter((u) => {
                    if (!userSearchQuery) return true;
                    const q = userSearchQuery.toLowerCase();
                    return (
                      (u.ref_id && u.ref_id.toLowerCase().includes(q)) ||
                      u.id.toLowerCase().includes(q) ||
                      u.username.toLowerCase().includes(q) ||
                      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
                      (u.email && u.email.toLowerCase().includes(q)) ||
                      u.phone.includes(q)
                    );
                  })
                  .map((u) => {
                    const displayUniqueId = u.ref_id || u.id;
                    const userBetCount = (allBets || []).filter(b => b.user_id === u.id).length;
                    const userDeposited = u.total_deposited || (depositRequests || []).filter(d => (d.user_id === u.id || d.username === u.username) && d.status === 'APPROVED').reduce((s, d) => s + (d.amount || 0), 0);
                    const userWithdrawn = u.total_withdrawn || (withdrawalRequests || []).filter(w => (w.user_id === u.id || w.username === u.username) && (w.status === 'SUCCESSFUL' || w.status === 'IN_PROGRESS')).reduce((s, w) => s + (w.amount || 0), 0);
                    return (
                      <tr key={u.id} className="hover:bg-slate-900/60 transition">
                        {/* Profile & Unique ID */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                              <img
                                src={u.profile_photo || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                                alt={u.username}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                <span>{u.full_name || u.username}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(displayUniqueId);
                                    setCopiedUserId(displayUniqueId);
                                    setTimeout(() => setCopiedUserId(null), 2000);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-black border border-amber-500/40 hover:bg-amber-500/30 transition flex items-center gap-1 cursor-pointer"
                                  title="Click to copy Unique User ID"
                                >
                                  <span>{displayUniqueId}</span>
                                  {copiedUserId === displayUniqueId ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5 opacity-60" />
                                  )}
                                </button>
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono font-semibold">@{u.username}</span>
                            </div>
                          </div>
                        </td>

                        {/* Contact Details */}
                        <td className="py-3 px-3 text-slate-300 font-mono text-[11px] space-y-0.5">
                          {u.email && (
                            <span className="text-emerald-300 flex items-center gap-1 truncate max-w-[150px]">
                              <Mail className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{u.email}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-slate-300">
                            <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{u.phone}</span>
                          </span>
                        </td>

                        {/* Status / Role */}
                        <td className="py-3 px-3 text-center">
                          {u.is_blocked ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              🛑 BLOCKED
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${u.role === 'admin'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}>
                              {u.role === 'admin' ? 'ADMIN' : 'ACTIVE'}
                            </span>
                          )}
                        </td>

                        {/* Total Added (Deposits) */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400 text-xs">
                          {userDeposited > 0 ? `+₹${userDeposited.toLocaleString('en-IN')}` : '₹0'}
                        </td>

                        {/* Total Withdrawn */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-blue-400 text-xs">
                          {userWithdrawn > 0 ? `-₹${userWithdrawn.toLocaleString('en-IN')}` : '₹0'}
                        </td>

                        {/* Balance */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400 text-sm">
                          ₹{u.balance.toLocaleString('en-IN')}
                        </td>

                        {/* Exposure */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-400 text-xs">
                          ₹{u.exposure.toLocaleString('en-IN')}
                        </td>

                        {/* Statement & Bet History Trigger */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenUserLedger(u)}
                              className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold font-mono transition cursor-pointer flex items-center gap-1"
                              title="View full financial ledger & statement from database"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Statement</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewBetsUser(u)}
                              className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold font-mono transition cursor-pointer flex items-center gap-1"
                              title="View all bets placed by this user"
                            >
                              <Coins className="w-3 h-3" />
                              <span>{userBetCount} Bets</span>
                            </button>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Impersonate / Login as User */}
                            <button
                              type="button"
                              onClick={() => handleLoginAsUser(u)}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                              title="Login as this user to view their screen"
                            >
                              <Eye className="w-3 h-3 text-indigo-400" />
                              <span>Login As</span>
                            </button>

                            {/* Block / Unblock Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleBlockUser(u)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border flex items-center gap-1 ${u.is_blocked
                                  ? 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border-rose-500/40'
                                }`}
                              title={u.is_blocked ? 'Unblock user' : 'Block user from betting & login'}
                            >
                              <Lock className="w-3 h-3" />
                              <span>{u.is_blocked ? 'Unblock' : 'Block'}</span>
                            </button>

                            {/* Credit Balance */}
                            <button
                              onClick={() => {
                                setBalanceModalUser(u);
                                setBalanceModalType('CREDIT');
                                setBalanceModalAmount('1000');
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-black font-black text-[11px] transition cursor-pointer border border-emerald-500/30 flex items-center gap-0.5"
                            >
                              <span>+ Cr</span>
                            </button>

                            {/* Debit Balance */}
                            <button
                              onClick={() => {
                                setBalanceModalUser(u);
                                setBalanceModalType('DEBIT');
                                setBalanceModalAmount('500');
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-black text-[11px] transition cursor-pointer border border-rose-500/30 flex items-center gap-0.5"
                            >
                              <span>- Dr</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {addUserModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    <span>Create User / Bettor Account</span>
                  </h3>
                  <button
                    onClick={() => setAddUserModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newUserData.full_name}
                      onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Username <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        required
                        value={newUserData.username}
                        onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                        placeholder="e.g. ramesh77"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Phone Number <span className="text-rose-400">*</span></label>
                      <input
                        type="tel"
                        required
                        value={newUserData.phone}
                        onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                        placeholder="e.g. 9876543210"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Email / Gmail (Optional)</label>
                    <input
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                      placeholder="e.g. ramesh@gmail.com"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Password <span className="text-rose-400">*</span></label>
                      <input
                        type="password"
                        required
                        value={newUserData.password}
                        onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                        placeholder="Min 6 characters"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Initial Balance (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={newUserData.initial_balance}
                        onChange={(e) => setNewUserData({ ...newUserData, initial_balance: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setAddUserModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black shadow-lg"
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* USER BET HISTORY MODAL */}
          {viewBetsUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Bet History: @{viewBetsUser.username} ({viewBetsUser.full_name || 'Bettor'})
                      </h3>
                      <p className="text-xs text-slate-400">
                        Current Balance: <strong className="text-emerald-400 font-mono">₹{viewBetsUser.balance.toLocaleString()}</strong> • Exposure: <strong className="text-rose-400 font-mono">₹{viewBetsUser.exposure.toLocaleString()}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewBetsUser(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 uppercase font-semibold text-[10px]">
                        <th className="p-2.5">Time</th>
                        <th className="p-2.5">Race</th>
                        <th className="p-2.5">Runner</th>
                        <th className="p-2.5">Market</th>
                        <th className="p-2.5">Odds</th>
                        <th className="p-2.5">Stake</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Payout</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {(allBets || [])
                        .filter(b => b.user_id === viewBetsUser.id)
                        .map(b => (
                          <tr key={b.id} className="hover:bg-slate-900/40">
                            <td className="p-2.5 text-slate-400 text-[10px]">
                              {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-2.5 text-slate-200 font-sans">{b.race_name}</td>
                            <td className="p-2.5 text-white font-bold font-sans">#{b.horse_no} {b.horse_name}</td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                                {b.bet_type}
                              </span>
                            </td>
                            <td className="p-2.5 text-amber-400 font-bold">{b.odds.toFixed(2)}x</td>
                            <td className="p-2.5 text-white">₹{b.stake.toLocaleString()}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'WON' ? 'bg-emerald-500/20 text-emerald-400' :
                                  b.status === 'LOST' ? 'bg-rose-500/20 text-rose-400' :
                                    b.status === 'CANCELLED' || b.status === 'REFUNDED' ? 'bg-slate-700 text-slate-300' :
                                      'bg-amber-500/20 text-amber-400'
                                }`}>
                                {b.status}
                              </span>
                            </td>
                            <td className="p-2.5 font-bold text-emerald-400">
                              {b.payout_amount ? `+₹${b.payout_amount.toLocaleString()}` : '-'}
                            </td>
                            <td className="p-2.5 text-right">
                              {b.status === 'PENDING' && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelSingleBet(b)}
                                  className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 text-[10px] font-bold cursor-pointer font-sans"
                                >
                                  Cancel & Refund
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {(allBets || []).filter(b => b.user_id === viewBetsUser.id).length === 0 && (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      No bets placed yet by this user.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* USER FINANCIAL STATEMENT & DATABASE LEDGER MODAL */}
          {viewLedgerUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                        <span>Database Financial Statement:</span>
                        <span className="text-amber-400">@{viewLedgerUser.username}</span>
                        {viewLedgerUser.full_name && <span className="text-slate-400 text-xs font-normal">({viewLedgerUser.full_name})</span>}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">
                        Unique ID: <strong className="text-amber-300 font-bold">{viewLedgerUser.ref_id || viewLedgerUser.id}</strong> • Phone: <strong className="text-white">{viewLedgerUser.phone}</strong> {viewLedgerUser.email ? `• Email: ${viewLedgerUser.email}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewLedgerUser(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Summary KPI Cards */}
                {(() => {
                  const userDeposits = (depositRequests || []).filter(d => (d.user_id === viewLedgerUser.id || d.username === viewLedgerUser.username) && d.status === 'APPROVED');
                  const userWithdrawals = (withdrawalRequests || []).filter(w => (w.user_id === viewLedgerUser.id || w.username === viewLedgerUser.username) && (w.status === 'SUCCESSFUL' || w.status === 'IN_PROGRESS'));
                  const totalDeposited = viewLedgerUser.total_deposited || userDeposits.reduce((s, d) => s + (d.amount || 0), 0);
                  const totalWithdrawn = viewLedgerUser.total_withdrawn || userWithdrawals.reduce((s, w) => s + (w.amount || 0), 0);
                  const userBets = (allBets || []).filter(b => b.user_id === viewLedgerUser.id);
                  const totalWagered = userBets.reduce((s, b) => s + (b.stake || (b as any).amount || 0), 0);
                  const totalWon = userBets.filter(b => b.status === 'WON').reduce((s, b) => s + (b.payout || (b as any).payout_amount || 0), 0);
                  const netCashflow = totalDeposited - totalWithdrawn;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                      <div className="bg-slate-950 p-3 rounded-2xl border border-emerald-500/30">
                        <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Total Money Added (Deposits)</span>
                        <strong className="text-base text-emerald-400 font-black">₹{totalDeposited.toLocaleString('en-IN')}</strong>
                        <span className="text-[10px] text-slate-500 block">{userDeposits.length} approved deposits</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-2xl border border-blue-500/30">
                        <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Total Money Withdrawn</span>
                        <strong className="text-base text-blue-400 font-black">₹{totalWithdrawn.toLocaleString('en-IN')}</strong>
                        <span className="text-[10px] text-slate-500 block">{userWithdrawals.length} withdrawals</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-2xl border border-amber-500/30">
                        <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Current Liquid Balance</span>
                        <strong className="text-base text-amber-300 font-black">₹{viewLedgerUser.balance.toLocaleString('en-IN')}</strong>
                        <span className="text-[10px] text-rose-400 block">Exposure: ₹{viewLedgerUser.exposure.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-2xl border border-purple-500/30">
                        <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Net Platform Cashflow</span>
                        <strong className={`text-base font-black ${netCashflow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {netCashflow >= 0 ? `+₹${netCashflow.toLocaleString('en-IN')}` : `-₹${Math.abs(netCashflow).toLocaleString('en-IN')}`}
                        </strong>
                        <span className="text-[10px] text-slate-400 block">{userBets.length} Bets Placed</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Ledger & Transactions Table from Database */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ledger Transactions History (Database Records)</span>
                    </h4>
                    {isLoadingLedger && <span className="text-xs text-amber-400 animate-pulse">Loading from database...</span>}
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 max-h-[350px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800 sticky top-0">
                          <th className="p-2.5">Date & Time</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Amount (₹)</th>
                          <th className="p-2.5">Balance After</th>
                          <th className="p-2.5">Reference ID</th>
                          <th className="p-2.5">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {(ledgerTransactions || []).map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-900/40">
                            <td className="p-2.5 text-slate-400 text-[10px] whitespace-nowrap">
                              {new Date(tx.created_at).toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                tx.type === 'DEPOSIT' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                                tx.type === 'WITHDRAW' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                                tx.type === 'WIN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                                tx.type === 'REFUND' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                                'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="p-2.5 font-bold">
                              {tx.type === 'DEPOSIT' || tx.type === 'WIN' || tx.type === 'REFUND' ? (
                                <span className="text-emerald-400">+₹{tx.amount.toLocaleString('en-IN')}</span>
                              ) : (
                                <span className="text-rose-400">-₹{tx.amount.toLocaleString('en-IN')}</span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-300 font-semibold">
                              ₹{(tx.balance_after || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 text-slate-500 text-[10px]">
                              {tx.reference_id || tx.id}
                            </td>
                            <td className="p-2.5 text-slate-300 font-sans text-xs">
                              {tx.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(ledgerTransactions || []).length === 0 && !isLoadingLedger && (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        No financial transactions recorded in database for this user yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Balance Adjustment Modal */}
          {balanceModalUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    <span>{balanceModalType === 'CREDIT' ? 'Credit Balance' : 'Debit Balance'}</span>
                  </h3>
                  <button
                    onClick={() => setBalanceModalUser(null)}
                    className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1 text-xs">
                  <p className="text-slate-400">User: <strong className="text-white">@{balanceModalUser.username}</strong></p>
                  <p className="text-slate-400">Current Balance: <strong className="text-emerald-400 font-mono">₹{balanceModalUser.balance.toLocaleString()}</strong></p>
                </div>

                <form onSubmit={handleAdjustUserBalance} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={balanceModalAmount}
                      onChange={(e) => setBalanceModalAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">Reason / Note (Optional)</label>
                    <input
                      type="text"
                      value={balanceModalDesc}
                      onChange={(e) => setBalanceModalDesc(e.target.value)}
                      placeholder="e.g. Approved Deposit / Bonus / Adjustment"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setBalanceModalUser(null)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${balanceModalType === 'CREDIT'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                        }`}
                    >
                      Confirm {balanceModalType === 'CREDIT' ? 'Credit' : 'Debit'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: BETS & RISK MANAGEMENT COCKPIT */}
      {activeTab === 'bets' && (
        <div className="space-y-6">
          {/* Header & Race Selector */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                  <span>Bets & Risk Management Cockpit</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                    Live Risk Meter
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Live bookmaker liability breakdown per runner, real-time bet volumes, single bet cancellations, and risk limit controls.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={loadAdminData}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Risk</span>
                </button>
                <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
                  {allBets.length} Total Bets Recorded
                </span>
              </div>
            </div>

            {/* Quick Race Filter for Risk Meter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span>Select Race for Live Risk Meter:</span>
                </span>
                <select
                  value={selectedRiskRaceId || (races.find(r => r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING')?.id || races[0]?.id || '')}
                  onChange={(e) => setSelectedRiskRaceId(e.target.value)}
                  className="bg-slate-900 border border-amber-500/40 text-xs font-bold text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-400"
                >
                  {races.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.race_no ? `R#${r.race_no} - ` : ''}{r.name} ({r.venue} • {r.status})
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const activeRiskRace = races.find(r => r.id === (selectedRiskRaceId || races.find(r2 => r2.status === 'LIVE' || r2.status === 'OPEN_FOR_BETTING')?.id || races[0]?.id));
                if (!activeRiskRace) return null;
                const raceBets = (allBets || []).filter(b => b.race_id === activeRiskRace.id);
                const racePool = raceBets.reduce((s, b) => s + (b.stake || b.amount || 0), 0);
                return (
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-3">
                    <span>Pool: <strong className="text-emerald-400 font-black">₹{racePool.toLocaleString('en-IN')}</strong></span>
                    <span>•</span>
                    <span>Bets: <strong className="text-white font-bold">{raceBets.length}</strong></span>
                    <span>•</span>
                    <span>Bettors: <strong className="text-amber-400 font-bold">{new Set(raceBets.map(b => b.user_id)).size}</strong></span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 1. LIVE BETS & LIABILITY RISK METER GRID PER HORSE */}
          {(() => {
            const activeRiskRace = races.find(r => r.id === (selectedRiskRaceId || races.find(r2 => r2.status === 'LIVE' || r2.status === 'OPEN_FOR_BETTING')?.id || races[0]?.id));
            if (!activeRiskRace) return null;

            const raceBets = (allBets || []).filter(b => b.race_id === activeRiskRace.id);
            const raceTurnover = raceBets.reduce((s, b) => s + (b.stake || b.amount || 0), 0);

            return (
              <div className="bg-[#050907] rounded-2xl border-2 border-emerald-900/60 p-4 sm:p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-900/40 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
                        Live Bets View & Bookmaker Risk Meter — {activeRiskRace.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Real-time live wager volume on each runner and bookmaker payout liability if that runner wins.
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
                    Total Race Pool: ₹{raceTurnover.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {activeRiskRace.horses.map((horse) => {
                    const runnerWinBets = raceBets.filter((b) => b.horse_id === horse.id && b.bet_type === 'WIN');
                    const runnerPlaceBets = raceBets.filter((b) => b.horse_id === horse.id && b.bet_type === 'PLACE');
                    const winStake = runnerWinBets.reduce((s, b) => s + (b.stake || b.amount || 0), 0);
                    const placeStake = runnerPlaceBets.reduce((s, b) => s + (b.stake || b.amount || 0), 0);
                    const totalRunnerStake = winStake + placeStake;
                    const totalRunnerBetsCount = runnerWinBets.length + runnerPlaceBets.length;

                    // Liability: If this horse wins 1st place, bookmaker must pay WIN odds
                    const winPayoutLiability = runnerWinBets.reduce((s, b) => s + ((b.stake || b.amount || 0) * b.odds), 0);
                    const netWinExposure = winPayoutLiability - raceTurnover;
                    const isHighRisk = netWinExposure > 0;

                    return (
                      <div
                        key={horse.id}
                        className={`p-3.5 rounded-2xl border transition-all ${isHighRisk && totalRunnerStake > 0
                            ? 'bg-[#1a080d] border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                            : totalRunnerStake > 0
                              ? 'bg-[#0a150d] border-emerald-500/40'
                              : 'bg-slate-950 border-slate-800/80'
                          }`}
                      >
                        {/* Header: Horse No, Name & Odds */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded-lg font-black text-xs bg-slate-900 border border-slate-700 text-[#e5b869] flex items-center justify-center shrink-0">
                              {horse.serial_no || horse.horse_no}
                            </span>
                            <div className="truncate">
                              <span className="text-xs font-black text-white truncate block">
                                {horse.name}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate block">
                                Draw {horse.gate_no} • {horse.jockey}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono text-xs font-bold text-amber-400 block">
                              W: {horse.win_odds.toFixed(2)}x
                            </span>
                            <span className="font-mono text-[10px] text-emerald-400 block">
                              P: {horse.place_odds.toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        {/* Live Total Bet Amount on this Horse */}
                        <div className="space-y-1.5 text-xs font-mono bg-black/40 p-2.5 rounded-xl border border-slate-800/80">
                          <div className="flex items-center justify-between text-slate-300">
                            <span className="text-[11px] text-slate-400">Total Bet Volume:</span>
                            <strong className="text-white font-black text-sm">
                              ₹{totalRunnerStake.toLocaleString('en-IN')}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Wagers Placed:</span>
                            <span className="text-slate-200">{totalRunnerBetsCount} Bets ({runnerWinBets.length} Win / {runnerPlaceBets.length} Place)</span>
                          </div>

                          {/* Liability / Risk Meter: If this horse wins */}
                          <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800">
                            <span className="text-[11px] text-slate-400">If Horse Wins (Payout):</span>
                            <strong className={isHighRisk ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                              ₹{Math.round(winPayoutLiability).toLocaleString('en-IN')}
                            </strong>
                          </div>

                          {/* Net Admin Exposure */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                            <span className="text-[10px] text-slate-400 font-sans font-bold">Risk Status:</span>
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${netWinExposure > 0
                                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}>
                              {netWinExposure > 0
                                ? `-₹${Math.round(netWinExposure).toLocaleString('en-IN')} (HIGH RISK)`
                                : `+₹${Math.round(Math.abs(netWinExposure)).toLocaleString('en-IN')} (PROFIT)`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* 2. RISK & LIMIT SETTING CONTROLS */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Platform Risk & Limit Settings
                  </h3>
                  <p className="text-xs text-slate-400">
                    Control maximum bet per horse and maximum allowable win per user per race.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold uppercase">
                Active Policy
              </span>
            </div>

            <form onSubmit={handleSaveRiskLimits} className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Max Bet per Horse */}
              <div className="space-y-1.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <label className="text-xs font-bold text-slate-200 block">
                  Max Bet Per Horse (₹)
                </label>
                <input
                  type="number"
                  min="100"
                  step="500"
                  required
                  value={limitMaxBet}
                  onChange={(e) => setLimitMaxBet(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. 50000"
                />
                <p className="text-[10px] text-slate-500">
                  Caps maximum wager stake a punter can place on a single runner.
                </p>
              </div>

              {/* Max Win per User per Race */}
              <div className="space-y-1.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <label className="text-xs font-bold text-amber-400 block">
                  Max Win Per User Per Race (₹)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="5000"
                  required
                  value={limitMaxWin}
                  onChange={(e) => setLimitMaxWin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-amber-400 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                  placeholder="e.g. 500000"
                />
                <p className="text-[10px] text-slate-500">
                  Caps maximum payout liability a user can win on a single race.
                </p>
              </div>

              {/* Min Bet Amount */}
              <div className="space-y-1.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <label className="text-xs font-bold text-emerald-400 block">
                  Minimum Bet Amount (₹)
                </label>
                <input
                  type="number"
                  min="10"
                  step="10"
                  required
                  value={limitMinBet}
                  onChange={(e) => setLimitMinBet(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. 100"
                />
                <p className="text-[10px] text-slate-500">
                  Minimum stake required to place a bet ticket on any market.
                </p>
              </div>

              <div className="sm:col-span-3 flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Risk & Limit Settings</span>
                </button>
              </div>
            </form>
          </div>

          {/* 3. LIVE BETS STREAM & SINGLE BET CANCELLATION */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span>Live Bets Stream & Cancellation Desk</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Inspect all wagers placed by punters. Cancel and 100% refund single suspicious bets manually.
                </p>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={betsSearchQuery}
                  onChange={(e) => setBetsSearchQuery(e.target.value)}
                  placeholder="Filter by Bettor username, race name, or horse name..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              {betsSearchQuery && (
                <button
                  type="button"
                  onClick={() => setBetsSearchQuery('')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="overflow-x-auto scrollbar-none rounded-xl border border-slate-800/80">
              <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Bettor</th>
                    <th className="py-2.5 px-3">Race</th>
                    <th className="py-2.5 px-3">Runner</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Odds</th>
                    <th className="py-2.5 px-3">Stake</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Payout</th>
                    <th className="py-2.5 px-3 text-right">Emergency Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {allBets
                    .filter((b) => {
                      if (!betsSearchQuery) return true;
                      const q = betsSearchQuery.toLowerCase();
                      return (
                        (b.username && b.username.toLowerCase().includes(q)) ||
                        (b.race_name && b.race_name.toLowerCase().includes(q)) ||
                        (b.horse_name && b.horse_name.toLowerCase().includes(q)) ||
                        (b.user_id && b.user_id.toLowerCase().includes(q))
                      );
                    })
                    .map((b) => (
                      <tr key={b.id} className="hover:bg-slate-850/50">
                        <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                          {new Date(b.placed_at || b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white font-sans">@{b.username || b.user_id}</td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-[120px] truncate font-sans">{b.race_name}</td>
                        <td className="py-2.5 px-3 font-bold text-white font-sans">#{b.horse_no} {b.horse_name}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                            {b.bet_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-amber-400 font-bold">{b.odds.toFixed(2)}x</td>
                        <td className="py-2.5 px-3 font-mono text-white">₹{b.stake.toLocaleString()}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'WON'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : b.status === 'LOST'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : b.status === 'CANCELLED' || b.status === 'REFUNDED'
                                    ? 'bg-slate-700 text-slate-300'
                                    : 'bg-amber-500/20 text-amber-400'
                              }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                          {b.payout_amount ? `+₹${b.payout_amount.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {b.status === 'PENDING' ? (
                            <button
                              type="button"
                              onClick={() => handleCancelSingleBet(b)}
                              className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 text-[10px] font-bold cursor-pointer font-sans"
                              title="Cancel bet & refund user wallet"
                            >
                              Cancel & Refund
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[10px] font-sans">Settled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: SECTION 6 - FINANCE & MASTER P/L OPERATIONS */}
      {activeTab === 'financials' && (() => {
        // Compute Master Financial Totals
        const totalUserBalances = (users || []).reduce((acc, u) => acc + (u.balance || 0), 0);
        const totalUserExposure = (users || []).reduce((acc, u) => acc + (u.exposure || 0), 0);
        const totalPlatformLiability = totalUserBalances + totalUserExposure;
        const usersWithPositiveBalance = (users || []).filter((u) => (u.balance || 0) > 0);

        // Date calculation for Day-wise P/L
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const sevenDaysAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

        // Filter bets for P/L based on selected date
        const pnlFilteredBets = (allBets || []).filter((b) => {
          const bDate = (b.placed_at || b.created_at || todayStr).split('T')[0];
          if (pnlDateFilter === 'TODAY') return bDate === todayStr;
          if (pnlDateFilter === 'YESTERDAY') return bDate === yesterdayStr;
          if (pnlDateFilter === 'LAST7') return bDate >= sevenDaysAgoStr;
          if (pnlDateFilter === 'CUSTOM') return bDate === pnlCustomDate;
          return true; // 'ALL'
        });

        const pnlTurnover = pnlFilteredBets.reduce((acc, b) => acc + (b.stake || (b as any).amount || 0), 0);
        const pnlPayouts = pnlFilteredBets
          .filter((b) => b.status === 'WON')
          .reduce((acc, b) => acc + (b.payout || (b as any).payout_amount || 0), 0);
        const pnlNetProfit = pnlTurnover - pnlPayouts;
        const pnlMarginPct = pnlTurnover > 0 ? ((pnlNetProfit / pnlTurnover) * 100).toFixed(1) : '0.0';

        // Center-wise grouping
        const centerPnLMap: Record<
          string,
          { name: string; code: string; turnover: number; payouts: number; betCount: number; raceCount: number }
        > = {};

        // Seed centers
        (raceCenters || []).forEach((c) => {
          centerPnLMap[c.id] = {
            name: c.name,
            code: c.code,
            turnover: 0,
            payouts: 0,
            betCount: 0,
            raceCount: (races || []).filter((r) => r.center_id === c.id || r.venue?.toLowerCase().includes(c.name.toLowerCase())).length,
          };
        });

        // Group bets into centers
        pnlFilteredBets.forEach((b) => {
          const race = (races || []).find((r) => r.id === b.race_id || r.name === b.race_name);
          let matchedCenterId = race?.center_id;

          if (!matchedCenterId && (race?.venue || b.venue)) {
            const venueStr = (race?.venue || b.venue || '').toLowerCase();
            const foundCenter = (raceCenters || []).find(
              (c) => venueStr.includes(c.name.toLowerCase()) || venueStr.includes((c.city || '').toLowerCase())
            );
            if (foundCenter) matchedCenterId = foundCenter.id;
          }

          const targetKey = matchedCenterId || 'general_center';
          if (!centerPnLMap[targetKey]) {
            centerPnLMap[targetKey] = {
              name: race?.venue || b.venue || 'General Book',
              code: 'GEN',
              turnover: 0,
              payouts: 0,
              betCount: 0,
              raceCount: 1,
            };
          }

          const betStake = b.stake || (b as any).amount || 0;
          const betPayout = b.status === 'WON' ? b.payout || (b as any).payout_amount || 0 : 0;
          centerPnLMap[targetKey].turnover += betStake;
          centerPnLMap[targetKey].payouts += betPayout;
          centerPnLMap[targetKey].betCount += 1;
        });

        const centerPnLRows = Object.values(centerPnLMap).sort((a, b) => b.turnover - a.turnover);

        const pendingDeposits = depositRequests.filter((d) => d.status === 'PENDING');
        const activeWithdrawals = withdrawalRequests.filter((w) => w.status === 'PENDING' || w.status === 'IN_PROGRESS');

        return (
          <div className="space-y-6">
            {/* Header & Sub-Nav */}
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>6. FINANCE & BOOKMAKER OPERATIONS</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
                        Most Sensitive
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Manage deposits & withdrawals, manual credit/debit balances, live day-wise center P/L, and total outstanding liabilities.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => loadAdminData()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition cursor-pointer self-start sm:self-auto shadow"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Financials</span>
                </button>
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
                <button
                  id="fin-subtab-overview"
                  onClick={() => setFinancialSubTab('OVERVIEW')}
                  className={`py-2 px-3 rounded-xl font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${financialSubTab === 'OVERVIEW'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Overview & Outstanding</span>
                </button>

                <button
                  id="fin-subtab-deposits"
                  onClick={() => setFinancialSubTab('DEPOSITS')}
                  className={`py-2 px-3 rounded-xl font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${financialSubTab === 'DEPOSITS'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Deposits</span>
                  {pendingDeposits.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                      {pendingDeposits.length}
                    </span>
                  )}
                </button>

                <button
                  id="fin-subtab-withdrawals"
                  onClick={() => setFinancialSubTab('WITHDRAWALS')}
                  className={`py-2 px-3 rounded-xl font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${financialSubTab === 'WITHDRAWALS'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                  <span>Withdrawals</span>
                  {activeWithdrawals.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-500 text-white">
                      {activeWithdrawals.length}
                    </span>
                  )}
                </button>

                <button
                  id="fin-subtab-pnl"
                  onClick={() => setFinancialSubTab('PNL_REPORT')}
                  className={`py-2 px-3 rounded-xl font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${financialSubTab === 'PNL_REPORT'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Day-Wise Center P/L</span>
                </button>

                <button
                  id="fin-subtab-credit-debit"
                  onClick={() => setFinancialSubTab('CREDIT_DEBIT')}
                  className={`py-2 px-3 rounded-xl font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${financialSubTab === 'CREDIT_DEBIT'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Manual Credit / Debit</span>
                </button>
              </div>
            </div>

            {/* SUB-PANEL 1: MASTER OVERVIEW & TOTAL OUTSTANDING */}
            {financialSubTab === 'OVERVIEW' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Outstanding Liabilities Master Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Outstanding Balances */}
                  <div className="bg-slate-900/90 rounded-3xl p-5 border-2 border-amber-500/40 shadow-xl space-y-2 relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                      <Coins className="w-24 h-24 text-amber-400" />
                    </div>
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                      Total Outstanding Balances
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                      ₹{totalUserBalances.toLocaleString('en-IN')}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Live liquid wallet balances held across {users.length} punters ({usersWithPositiveBalance.length} active wallets)
                    </p>
                  </div>

                  {/* Total Live Exposure */}
                  <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 shadow-xl space-y-2 relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                      <TrendingUp className="w-24 h-24 text-blue-400" />
                    </div>
                    <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">
                      Total Active Bets Exposure
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">
                      ₹{totalUserExposure.toLocaleString('en-IN')}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Locked stake on ongoing/unsettled race bets
                    </p>
                  </div>

                  {/* Total Platform Liability */}
                  <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 shadow-xl space-y-2 relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                      <ShieldCheck className="w-24 h-24 text-purple-400" />
                    </div>
                    <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
                      Total Bookmaker Reserve Liability
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-purple-300 font-mono">
                      ₹{totalPlatformLiability.toLocaleString('en-IN')}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Sum of wallet holdings + active wager exposure
                    </p>
                  </div>

                  {/* Today's Net Bookmaker P/L */}
                  <div className={`rounded-3xl p-5 border shadow-xl space-y-2 relative overflow-hidden ${pnlNetProfit >= 0
                      ? 'bg-emerald-950/40 border-emerald-500/50'
                      : 'bg-rose-950/40 border-rose-500/50'
                    }`}>
                    <span className="text-[11px] font-bold uppercase tracking-wider block text-slate-300">
                      Today's Bookmaker P/L
                    </span>
                    <div className={`text-2xl sm:text-3xl font-black font-mono ${pnlNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                      {pnlNetProfit >= 0 ? `+₹${pnlNetProfit.toLocaleString('en-IN')}` : `-₹${Math.abs(pnlNetProfit).toLocaleString('en-IN')}`}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Turnover: ₹{pnlTurnover.toLocaleString('en-IN')} • Margin: {pnlMarginPct}%
                    </p>
                  </div>
                </div>

                {/* Quick Action Banner & Top Balance Holders */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Quick Action Card */}
                  <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-amber-400" />
                        <h3 className="font-bold text-white text-sm">Quick Financial Operations</h3>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Manually credit offline deposits, debit user withdrawals, or review pending UTR payment proofs.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setFinancialSubTab('CREDIT_DEBIT')}
                        className="w-full py-2.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Manual Credit / Debit Balance</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFinancialSubTab('DEPOSITS')}
                          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{pendingDeposits.length} Deposits</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFinancialSubTab('WITHDRAWALS')}
                          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                          <span>{activeWithdrawals.length} Withdrawals</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Top User Balances Holding Funds */}
                  <div className="lg:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        <h3 className="font-bold text-white text-sm">Top User Balances (Outstanding Holdings)</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('users')}
                        className="text-xs text-amber-400 hover:underline font-bold"
                      >
                        View All {users.length} Users →
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                            <th className="py-2 px-3">User</th>
                            <th className="py-2 px-3 text-right">Balance</th>
                            <th className="py-2 px-3 text-right">Exposure</th>
                            <th className="py-2 px-3 text-center">Status</th>
                            <th className="py-2 px-3 text-right">Quick Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {[...(users || [])]
                            .sort((a, b) => (b.balance || 0) - (a.balance || 0))
                            .slice(0, 6)
                            .map((u) => (
                              <tr key={u.id} className="hover:bg-slate-900/40">
                                <td className="py-2 px-3 font-bold text-white font-sans">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                    <span>@{u.username}</span>
                                    {u.full_name && <span className="text-[10px] text-slate-400">({u.full_name})</span>}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-black text-amber-400">
                                  ₹{(u.balance || 0).toLocaleString('en-IN')}
                                </td>
                                <td className="py-2 px-3 text-right text-blue-400">
                                  ₹{(u.exposure || 0).toLocaleString('en-IN')}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {u.is_blocked ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 font-bold">
                                      BLOCKED
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold">
                                      ACTIVE
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuickAdjustUserId(u.id);
                                      setFinancialSubTab('CREDIT_DEBIT');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-sans font-bold text-[11px] transition cursor-pointer border border-slate-700"
                                  >
                                    Adjust ₹
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-PANEL 2: DEPOSIT REQUESTS (APPROVE / REJECT) */}
            {financialSubTab === 'DEPOSITS' && (
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-4 animate-in fade-in duration-200">
                {/* Filter Tabs */}
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setDepositStatusFilter(st)}
                        className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${depositStatusFilter === st
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        {st} ({st === 'ALL' ? depositRequests.length : depositRequests.filter((d) => d.status === st).length})
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Total: ₹{depositRequests.filter((d) => depositStatusFilter === 'ALL' || d.status === depositStatusFilter).reduce((acc, d) => acc + d.amount, 0).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Deposit List Cards */}
                <div className="space-y-3">
                  {depositRequests
                    .filter((d) => depositStatusFilter === 'ALL' || d.status === depositStatusFilter)
                    .map((dep) => (
                      <div
                        key={dep.id}
                        className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 hover:border-slate-700 transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                              <ArrowDownLeft className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-white font-mono">
                                  ₹{dep.amount.toLocaleString('en-IN')}
                                </span>
                                <span className="text-[11px] text-slate-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                  {dep.payment_method || 'UPI Fast'}
                                </span>
                              </div>
                              {(() => {
                                const matchedUser = (users || []).find((u) => u.id === dep.user_id || u.username === dep.username);
                                return (
                                  <div className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                                    <span>Bettor: <strong className="text-white font-bold">{matchedUser?.full_name ? `${matchedUser.full_name} (@${dep.username})` : `@${dep.username}`}</strong></span>
                                    {matchedUser?.ref_id && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                                        ID: {matchedUser.ref_id}
                                      </span>
                                    )}
                                    {matchedUser?.phone && (
                                      <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                                        📞 {matchedUser.phone}
                                      </span>
                                    )}
                                    {matchedUser?.email && (
                                      <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                                        ✉️ {matchedUser.email}
                                      </span>
                                    )}
                                    {matchedUser !== undefined && (
                                      <span className="text-emerald-400 font-mono font-bold text-[11px]">
                                        Wallet Balance: ₹{matchedUser.balance?.toLocaleString('en-IN')}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            {dep.status === 'PENDING' && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>PENDING APPROVAL</span>
                              </span>
                            )}
                            {dep.status === 'APPROVED' && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>APPROVED & CREDITED</span>
                              </span>
                            )}
                            {dep.status === 'REJECTED' && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>REJECTED</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                          {/* UTR Number */}
                          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                            <span className="text-slate-400 block text-[11px] mb-1">12-Digit UTR Reference:</span>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-bold text-amber-400 text-sm tracking-wider select-all">
                                {dep.utr_number}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyUtr(dep.utr_number)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 text-[10px] font-semibold transition cursor-pointer"
                              >
                                {copiedUtr === dep.utr_number ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Screenshot Proof */}
                          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                            <div>
                              <span className="text-slate-400 block text-[11px]">Payment Proof:</span>
                              <span className="text-[11px] text-slate-300 font-medium">
                                {dep.screenshot_url ? 'Screenshot Attached' : 'No Screenshot Attached'}
                              </span>
                            </div>
                            {dep.screenshot_url ? (
                              <button
                                type="button"
                                onClick={() => setPreviewScreenshot(dep.screenshot_url || null)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 text-xs font-semibold transition cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Proof</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">UTR Only</span>
                            )}
                          </div>

                          {/* Timestamps */}
                          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-0.5 font-mono">
                            <p>Submitted: <span className="text-slate-200">{new Date(dep.created_at).toLocaleString('en-IN')}</span></p>
                            {dep.reviewed_at && (
                              <p>Reviewed: <span className="text-slate-200">{new Date(dep.reviewed_at).toLocaleString('en-IN')}</span></p>
                            )}
                          </div>
                        </div>

                        {/* Action Controls for Pending Deposit */}
                        {dep.status === 'PENDING' && (
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900">
                            <button
                              type="button"
                              onClick={() => handleRejectDeposit(dep.id)}
                              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApproveDeposit(dep.id)}
                              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-lg"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Approve & Credit ₹{dep.amount.toLocaleString('en-IN')}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                  {depositRequests.filter((d) => depositStatusFilter === 'ALL' || d.status === depositStatusFilter).length === 0 && (
                    <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                      No deposit requests found under "{depositStatusFilter}".
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-PANEL 3: WITHDRAWAL REQUESTS (APPROVE / REJECT & 120M SLA) */}
            {financialSubTab === 'WITHDRAWALS' && (
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-4 animate-in fade-in duration-200">
                {/* Filter Tabs */}
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    {(['ALL', 'PENDING', 'IN_PROGRESS', 'SUCCESSFUL', 'REJECTED'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setWithdrawalStatusFilter(st)}
                        className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${withdrawalStatusFilter === st
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        {st} ({st === 'ALL' ? withdrawalRequests.length : withdrawalRequests.filter((w) => w.status === st).length})
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Total: ₹{withdrawalRequests.filter((w) => withdrawalStatusFilter === 'ALL' || w.status === withdrawalStatusFilter).reduce((acc, w) => acc + w.amount, 0).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Withdrawal List Cards */}
                <div className="space-y-3">
                  {withdrawalRequests
                    .filter((w) => withdrawalStatusFilter === 'ALL' || w.status === withdrawalStatusFilter)
                    .map((wth) => {
                      const startTime = new Date(wth.approved_at || wth.created_at).getTime();
                      const elapsedMins = Math.floor((currentTime - startTime) / 60000);
                      const remainingMins = Math.max(0, (wth.estimated_minutes || 120) - elapsedMins);
                      const hrs = Math.floor(remainingMins / 60);
                      const mins = remainingMins % 60;

                      return (
                        <div
                          key={wth.id}
                          className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 hover:border-slate-700 transition"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                                <ArrowUpRight className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-black text-white font-mono">
                                    ₹{wth.amount.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[11px] text-slate-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                    {wth.upi_id ? 'UPI Fast Rail' : 'Bank IMPS'}
                                  </span>
                                </div>
                                {(() => {
                                  const matchedUser = (users || []).find((u) => u.id === wth.user_id || u.username === wth.username);
                                  return (
                                    <div className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                                      <span>Bettor: <strong className="text-white font-bold">{matchedUser?.full_name ? `${matchedUser.full_name} (@${wth.username})` : `@${wth.username}`}</strong></span>
                                      {matchedUser?.ref_id && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                                          ID: {matchedUser.ref_id}
                                        </span>
                                      )}
                                      {matchedUser?.phone && (
                                        <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                                          📞 {matchedUser.phone}
                                        </span>
                                      )}
                                      {matchedUser?.email && (
                                        <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                                          ✉️ {matchedUser.email}
                                        </span>
                                      )}
                                      {matchedUser !== undefined && (
                                        <span className="text-emerald-400 font-mono font-bold text-[11px]">
                                          Wallet Balance: ₹{matchedUser.balance?.toLocaleString('en-IN')}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              {wth.status === 'PENDING' && (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>PENDING APPROVAL</span>
                                </span>
                              )}
                              {wth.status === 'IN_PROGRESS' && (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                                  <Timer className="w-3.5 h-3.5" />
                                  <span>IN PROGRESS (120m SLA)</span>
                                </span>
                              )}
                              {wth.status === 'SUCCESSFUL' && (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>SUCCESSFUL & PAID</span>
                                </span>
                              )}
                              {wth.status === 'REJECTED' && (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>REJECTED (REFUNDED)</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Payout Destination */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block text-[11px] mb-0.5">Payout Destination:</span>
                              {wth.upi_id ? (
                                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="font-mono">{wth.upi_id}</span>
                                </div>
                              ) : (
                                <div className="space-y-0.5 text-slate-200">
                                  <p className="font-bold flex items-center gap-1">
                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{wth.bank_account}</span>
                                  </p>
                                  <p className="text-[11px] text-slate-400">
                                    IFSC: <span className="font-mono text-white">{wth.ifsc}</span> | Holder: <span className="text-white">{wth.account_holder || wth.username}</span>
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* 120-minute SLA Bar */}
                            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">120-Minute Payout SLA:</span>
                                {wth.status === 'IN_PROGRESS' ? (
                                  <span className="font-bold text-blue-300">
                                    {hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">{wth.status}</span>
                                )}
                              </div>
                              {wth.status === 'IN_PROGRESS' && (
                                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.max(5, ((120 - remainingMins) / 120) * 100))}%` }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Timestamps */}
                            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-0.5 font-mono">
                              <p>Requested: <span className="text-slate-200">{new Date(wth.created_at).toLocaleString('en-IN')}</span></p>
                              {wth.approved_at && (
                                <p>Approved: <span className="text-slate-200">{new Date(wth.approved_at).toLocaleString('en-IN')}</span></p>
                              )}
                              {wth.completed_at && (
                                <p>Paid: <span className="text-emerald-400">{new Date(wth.completed_at).toLocaleString('en-IN')}</span></p>
                              )}
                            </div>
                          </div>

                          {/* Action Controls */}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900">
                            {wth.status === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRejectWithdrawal(wth.id)}
                                  className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject & Refund</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleApproveWithdrawalToInProgress(wth.id)}
                                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md"
                                >
                                  <Timer className="w-4 h-4" />
                                  <span>Approve (Start 120m SLA)</span>
                                </button>
                              </>
                            )}

                            {wth.status === 'IN_PROGRESS' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRejectWithdrawal(wth.id)}
                                  className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject & Refund</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCompleteWithdrawalToSuccessful(wth.id)}
                                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-lg"
                                >
                                  <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                                  <span>Mark Successful (Paid Out)</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {withdrawalRequests.filter((w) => withdrawalStatusFilter === 'ALL' || w.status === withdrawalStatusFilter).length === 0 && (
                    <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                      No withdrawal requests found under "{withdrawalStatusFilter}".
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-PANEL 4: DAY-WISE & CENTER-WISE P/L REPORT */}
            {financialSubTab === 'PNL_REPORT' && (
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-5 animate-in fade-in duration-200">
                {/* Date Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>Day-Wise & Center-Wise Profit & Loss (P/L) Report</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      View gross bet turnover, winnings paid out, net bookmaker P/L, and hold margins per race center.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs flex-wrap">
                    {(['TODAY', 'YESTERDAY', 'LAST7', 'ALL', 'CUSTOM'] as const).map((df) => (
                      <button
                        key={df}
                        onClick={() => setPnlDateFilter(df)}
                        className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${pnlDateFilter === df
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        {df === 'TODAY' ? "Today's P/L" : df === 'YESTERDAY' ? 'Yesterday' : df === 'LAST7' ? 'Last 7 Days' : df === 'ALL' ? 'All Time' : 'Pick Date'}
                      </button>
                    ))}
                    {pnlDateFilter === 'CUSTOM' && (
                      <input
                        type="date"
                        value={pnlCustomDate}
                        onChange={(e) => setPnlCustomDate(e.target.value)}
                        className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                      />
                    )}
                  </div>
                </div>

                {/* Performance Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Gross Turnover (Stakes)</span>
                    <div className="text-xl font-black text-white font-mono">
                      ₹{pnlTurnover.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-slate-500">{pnlFilteredBets.length} Bets Placed</span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-amber-400 uppercase">Winnings Paid Out</span>
                    <div className="text-xl font-black text-amber-400 font-mono">
                      ₹{pnlPayouts.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {pnlFilteredBets.filter((b) => b.status === 'WON').length} Winning Bets
                    </span>
                  </div>

                  <div className={`p-4 rounded-2xl border space-y-1 ${pnlNetProfit >= 0
                      ? 'bg-emerald-950/40 border-emerald-500/50'
                      : 'bg-rose-950/40 border-rose-500/50'
                    }`}>
                    <span className="text-[11px] font-bold uppercase text-slate-300">Net Bookmaker P/L</span>
                    <div className={`text-xl font-black font-mono ${pnlNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                      {pnlNetProfit >= 0 ? `+₹${pnlNetProfit.toLocaleString('en-IN')}` : `-₹${Math.abs(pnlNetProfit).toLocaleString('en-IN')}`}
                    </div>
                    <span className={`text-[10px] font-bold ${pnlNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pnlNetProfit >= 0 ? 'Bookmaker Profit' : 'Bookmaker Loss'}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-indigo-400 uppercase">Hold Margin %</span>
                    <div className="text-xl font-black text-indigo-300 font-mono">
                      {pnlMarginPct}%
                    </div>
                    <span className="text-[10px] text-slate-500">Net Retained Stake %</span>
                  </div>
                </div>

                {/* Center-Wise Breakdown Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                        <th className="py-3 px-3.5">Center / Venue</th>
                        <th className="py-3 px-3 text-center">Races</th>
                        <th className="py-3 px-3 text-center">Bets</th>
                        <th className="py-3 px-3 text-right">Turnover Pool</th>
                        <th className="py-3 px-3 text-right">Payouts Paid</th>
                        <th className="py-3 px-3 text-right">Net Bookmaker P/L</th>
                        <th className="py-3 px-3.5 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {centerPnLRows.map((c, i) => {
                        const netPl = c.turnover - c.payouts;
                        const margin = c.turnover > 0 ? ((netPl / c.turnover) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="py-3 px-3.5 font-bold text-white font-sans">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-400 font-mono text-[10px] font-bold">
                                  {c.code}
                                </span>
                                <span>{c.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center text-slate-300">{c.raceCount}</td>
                            <td className="py-3 px-3 text-center text-slate-300 font-bold">{c.betCount}</td>
                            <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                              ₹{c.turnover.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-3 text-right text-amber-400 font-bold">
                              ₹{c.payouts.toLocaleString('en-IN')}
                            </td>
                            <td className={`py-3 px-3 text-right font-black ${netPl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {netPl >= 0 ? `+₹${netPl.toLocaleString('en-IN')}` : `-₹${Math.abs(netPl).toLocaleString('en-IN')}`}
                            </td>
                            <td className={`py-3 px-3.5 text-right font-bold ${netPl >= 0 ? 'text-indigo-300' : 'text-rose-400'}`}>
                              {margin}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {centerPnLRows.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No center betting data recorded for this date selection.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-PANEL 5: MANUAL CREDIT / DEBIT (ADD / DEDUCT BALANCE) */}
            {financialSubTab === 'CREDIT_DEBIT' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
                {/* Form Card */}
                <div className="bg-slate-900 rounded-3xl border-2 border-amber-500/40 p-5 space-y-4 shadow-xl">
                  <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Manual Balance Adjustment</h3>
                      <p className="text-xs text-slate-400">Add or deduct punter funds with instant audit</p>
                    </div>
                  </div>

                  <form onSubmit={handleQuickAdjustBalance} className="space-y-4 text-xs">
                    {/* User Dropdown Selector */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Select Target User <span className="text-rose-400">*</span>
                      </label>
                      <select
                        required
                        value={quickAdjustUserId}
                        onChange={(e) => setQuickAdjustUserId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="">-- Choose User Account --</option>
                        {(users || []).map((u) => (
                          <option key={u.id} value={u.id}>
                            @{u.username} • Balance: ₹{(u.balance || 0).toLocaleString('en-IN')} {u.full_name ? `(${u.full_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Selected User Info Banner */}
                    {quickAdjustUserId && (() => {
                      const selUser = (users || []).find((u) => u.id === quickAdjustUserId);
                      if (!selUser) return null;
                      return (
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs font-mono">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Username:</span>
                            <span className="text-white font-bold">@{selUser.username}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Current Balance:</span>
                            <span className="text-amber-400 font-bold">₹{(selUser.balance || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Current Exposure:</span>
                            <span className="text-blue-400">₹{(selUser.exposure || 0).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Adjustment Type (Credit / Debit) */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Action Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setQuickAdjustType('CREDIT')}
                          className={`py-2 px-3 rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${quickAdjustType === 'CREDIT'
                              ? 'bg-emerald-600 text-white shadow-md'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>CREDIT (Add Funds)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setQuickAdjustType('DEBIT')}
                          className={`py-2 px-3 rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${quickAdjustType === 'DEBIT'
                              ? 'bg-rose-600 text-white shadow-md'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                          <span>DEBIT (Deduct Funds)</span>
                        </button>
                      </div>
                    </div>

                    {/* Amount Input & Preset Chips */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Amount (₹) *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={quickAdjustAmount}
                        onChange={(e) => setQuickAdjustAmount(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-black text-sm focus:outline-none focus:border-amber-500"
                        placeholder="1000"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {['500', '1000', '5000', '10000', '50000'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setQuickAdjustAmount(chip)}
                            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono font-bold transition cursor-pointer border border-slate-700"
                          >
                            ₹{Number(chip).toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reason / Reference */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Reason / Statement Note</label>
                      <input
                        type="text"
                        value={quickAdjustDesc}
                        onChange={(e) => setQuickAdjustDesc(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                        placeholder="e.g. Offline Cash Deposit / Adjustment"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isLoading || !quickAdjustUserId}
                      className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg ${quickAdjustType === 'CREDIT'
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <Coins className="w-4 h-4" />
                      <span>Execute {quickAdjustType === 'CREDIT' ? 'Credit (+)' : 'Debit (-)'} ₹{Number(quickAdjustAmount || 0).toLocaleString('en-IN')}</span>
                    </button>
                  </form>
                </div>

                {/* User List with Quick Adjust Buttons */}
                <div className="lg:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-400" />
                      <h3 className="font-bold text-white text-sm">All User Wallets ({users.length} Users)</h3>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      Total Balances: ₹{totalUserBalances.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 sticky top-0 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Bettor</th>
                          <th className="py-2.5 px-3 text-right">Balance</th>
                          <th className="py-2.5 px-3 text-right">Exposure</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {(users || []).map((u) => (
                          <tr key={u.id} className="hover:bg-slate-900/40">
                            <td className="py-2.5 px-3 font-bold text-white font-sans">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${u.is_blocked ? 'bg-rose-500' : 'bg-emerald-400'}`} />
                                <span>@{u.username}</span>
                                {u.full_name && <span className="text-[10px] text-slate-400">({u.full_name})</span>}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-amber-400">
                              ₹{(u.balance || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-right text-blue-400">
                              ₹{(u.exposure || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1 font-sans">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickAdjustUserId(u.id);
                                    setQuickAdjustType('CREDIT');
                                  }}
                                  className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] transition cursor-pointer border border-emerald-500/30"
                                >
                                  + Credit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickAdjustUserId(u.id);
                                    setQuickAdjustType('DEBIT');
                                  }}
                                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[11px] transition cursor-pointer border border-rose-500/30"
                                >
                                  - Debit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 8: System Control & Staff Management (Master Privileges Item #5) */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Section 1: Emergency Kill-Switch Master Control */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Master Global Emergency Betting Kill-Switch</h2>
                <p className="text-xs text-slate-400">
                  Instantly freeze or unfreeze bet placement across every single race and center with 1 click.
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${(systemSettings.betting_enabled ?? true)
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                : 'bg-red-950/50 border-red-500/50 text-red-200'
              }`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">Status:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${(systemSettings.betting_enabled ?? true)
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-red-600 text-white border border-red-400'
                    }`}>
                    {(systemSettings.betting_enabled ?? true) ? '🟢 Betting Engine ACTIVE' : '🛑 Emergency FREEZE Active'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {(systemSettings.betting_enabled ?? true)
                    ? 'Punters can place bets normally on open races.'
                    : 'All bet submission endpoints are locked. Error banner is shown to users.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleGlobalBetting}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg active:scale-95 ${(systemSettings.betting_enabled ?? true)
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
              >
                {(systemSettings.betting_enabled ?? true) ? '🛑 Activate Emergency Freeze' : '▶️ Resume Platform Betting'}
              </button>
            </div>
          </div>

          {/* Section 2: Platform Announcement Broadcaster */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Platform Live Announcement Banner</h2>
                <p className="text-xs text-slate-400">
                  Broadcast important race delays, track condition changes, or promotions to all active user lobbies in real-time.
                </p>
              </div>
            </div>

            {systemSettings.announcement && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold">📢 Current Live Broadcast:</span>
                  <span className="font-mono text-white">"{systemSettings.announcement}"</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await api.updateSystemSettings({ announcement: '' });
                    setSystemSettings(prev => ({ ...prev, announcement: '' }));
                    notify('Announcement cleared', 'info');
                  }}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
                >
                  Clear Broadcast
                </button>
              </div>
            )}

            <form onSubmit={handlePostAnnouncement} className="space-y-3">
              <textarea
                rows={2}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="e.g. 📢 Mysore Race 4 delayed by 10 minutes due to rain. Track condition changed to Heavy."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading || !announcementText.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black transition cursor-pointer shadow-lg disabled:opacity-40"
                >
                  Broadcast Announcement
                </button>
              </div>
            </form>
          </div>

          {/* Section 3: Sub-Admin & Staff Delegated Management */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Sub-Admin & Operating Staff Access</h2>
                  <p className="text-xs text-slate-400">
                    Grant designated operators specific permissions (e.g., Live Odds Updates, Result Declaration, Deposit Verification).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubAdminModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Sub-Admin</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3.5">Staff Name</th>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">Assigned Role</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {(systemSettings.sub_admins || []).map((sa: any) => (
                    <tr key={sa.id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3.5 font-bold text-white font-sans">{sa.name}</td>
                      <td className="py-2.5 px-3 text-indigo-300">@{sa.username}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold">
                          {sa.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                        {new Date(sa.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteSubAdmin(sa.id)}
                          className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 text-[10px] font-bold cursor-pointer font-sans"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!systemSettings.sub_admins || systemSettings.sub_admins.length === 0) && (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No sub-admins configured. Master administrator has full control.
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Master Admin Security & Password Change */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Master Admin Security & Password Change</h2>
                <p className="text-xs text-slate-400">
                  Update the master administrator login password to keep administrative privileges and financial controls secure.
                </p>
              </div>
            </div>

            {adminPassSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold">Password updated successfully! Your new credentials are now active.</span>
              </div>
            )}

            {adminPassError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{adminPassError}</span>
              </div>
            )}

            <form onSubmit={handleChangeAdminPassword} className="space-y-4 max-w-xl">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-bold text-xs block mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showAdminCurrentPass ? 'text' : 'password'}
                      required
                      value={adminCurrentPassword}
                      onChange={(e) => setAdminCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminCurrentPass(!showAdminCurrentPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showAdminCurrentPass ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-bold text-xs block mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showAdminNewPass ? 'text' : 'password'}
                      required
                      value={adminNewPassword}
                      onChange={(e) => setAdminNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminNewPass(!showAdminNewPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showAdminNewPass ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-bold text-xs block mb-1">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showAdminConfirmPass ? 'text' : 'password'}
                      required
                      value={adminConfirmPassword}
                      onChange={(e) => setAdminConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminConfirmPass(!showAdminConfirmPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showAdminConfirmPass ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={adminPassLoading || !adminCurrentPassword || !adminNewPassword}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black transition cursor-pointer shadow-lg disabled:opacity-40"
                >
                  {adminPassLoading ? 'Updating Password...' : 'Update Admin Password'}
                </button>
              </div>
            </form>
          </div>

          {/* ADD SUB-ADMIN MODAL */}
          {subAdminModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    <span>Add Sub-Admin Staff</span>
                  </h3>
                  <button
                    onClick={() => setSubAdminModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAddSubAdmin} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Staff Member Name</label>
                    <input
                      type="text"
                      required
                      value={newSubAdminData.name}
                      onChange={(e) => setNewSubAdminData({ ...newSubAdminData, name: e.target.value })}
                      placeholder="e.g. Suresh Operator"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={newSubAdminData.username}
                      onChange={(e) => setNewSubAdminData({ ...newSubAdminData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                      placeholder="e.g. suresh_odds"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Staff Password</label>
                    <input
                      type="password"
                      value={newSubAdminData.password}
                      onChange={(e) => setNewSubAdminData({ ...newSubAdminData, password: e.target.value })}
                      placeholder="Initial login password"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Operating Role</label>
                    <select
                      value={newSubAdminData.role}
                      onChange={(e) => setNewSubAdminData({ ...newSubAdminData, role: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="ODDS_MANAGER">ODDS_MANAGER (Live Odds & Suspensions Only)</option>
                      <option value="RESULT_OFFICER">RESULT_OFFICER (Declare Winners & Settle Races)</option>
                      <option value="FINANCIAL_AUDITOR">FINANCIAL_AUDITOR (Verify Deposits & Withdrawals)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSubAdminModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg"
                    >
                      Add Staff Member
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SCREENSHOT LIGHTBOX PREVIEW MODAL */}
      {previewScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setPreviewScreenshot(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>Payment Proof Screenshot Preview</span>
              </h4>
              <button
                onClick={() => setPreviewScreenshot(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-xl bg-black/60 flex items-center justify-center p-2">
              <img
                src={previewScreenshot}
                alt="Deposit Proof"
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* CORE FEATURE: RACE SETTLEMENT & RESULT DECLARATION (WITH 1st/2nd/3rd/4th DROPDOWNS & DEAD HEAT) */}
      {settlingRace && (() => {
        const p1 = settlingRace.horses.filter((h) => settlePositions[h.id] === 1);
        const p2 = settlingRace.horses.filter((h) => settlePositions[h.id] === 2);
        const p3 = settlingRace.horses.filter((h) => settlePositions[h.id] === 3);
        const p4 = settlingRace.horses.filter((h) => settlePositions[h.id] === 4);
        const isDeadHeatWin = p1.length > 1;
        const isDeadHeatPlace = p2.length > 1 || p3.length > 1;
        const isDeadHeat = isDeadHeatWin || isDeadHeatPlace;

        // Pending bets for this race
        const pendingRaceBets = (allBets || []).filter(
          (b) => (b.race_id === settlingRace.id || b.race_name === settlingRace.name) && b.status === 'PENDING'
        );
        const totalPendingStake = pendingRaceBets.reduce((acc, b) => acc + (b.stake || 0), 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
            <div className="w-full max-w-3xl bg-slate-900 border-2 border-emerald-900/80 rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 my-8 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 sticky top-0 bg-slate-900 z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-base sm:text-lg flex items-center gap-2">
                      <span>5. RESULT DECLARATION & SETTLEMENT</span>
                      {isDeadHeat && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                          🔥 Dead Heat Active
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Declare 1st, 2nd, 3rd, 4th finishers or Dead Heat. Auto-settles all bets instantly.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSettlingRace(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Race Meta Bar */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs">
                <div>
                  <span className="text-amber-400 font-bold">{settlingRace.venue}</span>
                  <h4 className="text-sm font-black text-white">{settlingRace.name}</h4>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                    {settlingRace.distance}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                    {settlingRace.race_time}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 font-bold">
                    {settlingRace.horses.length} Runners
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-300 font-bold">
                    {pendingRaceBets.length} Bets Placed (₹{totalPendingStake.toLocaleString('en-IN')})
                  </span>
                </div>
              </div>

              {/* View Mode Selector Tabs */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSettleViewMode('DROPDOWN')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${settleViewMode === 'DROPDOWN'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    <span>Dropdown Selection (1st-4th)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleViewMode('RUNNERS')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${settleViewMode === 'RUNNERS'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    <span>Runner Cards Mode</span>
                  </button>
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      const next: Record<string, 1 | 2 | 3 | 4 | 0> = {};
                      settlingRace.horses.forEach((h, i) => {
                        if (i === 0) next[h.id] = 1;
                        else if (i === 1) next[h.id] = 2;
                        else if (i === 2) next[h.id] = 3;
                        else if (i === 3) next[h.id] = 4;
                        else next[h.id] = 0;
                      });
                      setSettlePositions(next);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition border border-slate-700 cursor-pointer"
                  >
                    Standard (1-2-3-4)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      const next: Record<string, 1 | 2 | 3 | 4 | 0> = {};
                      settlingRace.horses.forEach((h, i) => {
                        if (i === 0 || i === 1) next[h.id] = 1; // 2 horses tied 1st
                        else if (i === 2) next[h.id] = 3; // 3rd place
                        else if (i === 3) next[h.id] = 4; // 4th place
                        else next[h.id] = 0;
                      });
                      setSettlePositions(next);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold transition border border-amber-500/40 cursor-pointer"
                  >
                    🔥 Dead Heat 1st (#1 & #2)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      const next: Record<string, 1 | 2 | 3 | 4 | 0> = {};
                      settlingRace.horses.forEach((h, i) => {
                        if (i === 0) next[h.id] = 1; // 1st
                        else if (i === 1 || i === 2) next[h.id] = 2; // 2 horses tied 2nd
                        else if (i === 3) next[h.id] = 4; // 4th
                        else next[h.id] = 0;
                      });
                      setSettlePositions(next);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[11px] font-bold transition border border-blue-500/40 cursor-pointer"
                  >
                    🔥 Dead Heat 2nd (#2 & #3)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      const next: Record<string, 1 | 2 | 3 | 4 | 0> = {};
                      settlingRace.horses.forEach((h, i) => {
                        if (i === 0) next[h.id] = 1; // 1st
                        else if (i === 1) next[h.id] = 2; // 2nd
                        else if (i === 2 || i === 3) next[h.id] = 3; // 2 horses tied 3rd
                        else next[h.id] = 0;
                      });
                      setSettlePositions(next);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold transition border border-emerald-500/40 cursor-pointer"
                  >
                    🔥 Dead Heat 3rd (#3 & #4)
                  </button>
                </div>
              </div>

              {/* Dead Heat Auto-Detection Alert Banner */}
              {isDeadHeatWin && (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 text-amber-200 text-xs space-y-1 animate-in fade-in">
                  <div className="flex items-center gap-2 font-black text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>🔥 DEAD HEAT FOR 1ST PLACE (WIN) DETECTED ({p1.length} Winners)</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed pl-6">
                    <strong>Settlement Rule (Method A - Betfair / Industry Standard):</strong> Stake is split equally among the {p1.length} winners. For each winner, payout = <code>(Stake / {p1.length}) * Odds</code>. There is no 2nd place runner; the next runner finishes 3rd for place bets.
                  </p>
                </div>
              )}

              {!isDeadHeatWin && isDeadHeatPlace && (
                <div className="p-3.5 rounded-2xl bg-blue-500/15 border-2 border-blue-500/50 text-blue-200 text-xs space-y-1 animate-in fade-in">
                  <div className="flex items-center gap-2 font-black text-blue-300">
                    <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>🔥 DEAD HEAT FOR PLACE DETECTED</span>
                  </div>
                  <p className="text-[11px] text-blue-200/90 leading-relaxed pl-6">
                    {p2.length > 1 && `2nd Place tied with ${p2.length} horses. `}
                    {p3.length > 1 && `3rd Place tied with ${p3.length} horses. `}
                    Place odds will be proportionately divided based on available place slots.
                  </p>
                </div>
              )}

              {/* SECTION A: DROPDOWN SELECTION MODE (1st, 2nd, 3rd, 4th Dropdowns) */}
              {settleViewMode === 'DROPDOWN' && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Select Finishing Order from Dropdowns
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Multi-selection allowed for Dead Heat
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1st Place Dropdown */}
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-black text-amber-400 text-xs flex items-center gap-1.5">
                          <span>🥇 1st Place (WINNER)</span>
                          {p1.length > 1 && <span className="text-[10px] bg-amber-500/30 px-1.5 py-0.5 rounded text-amber-300 font-mono font-bold">DH: {p1.length} Horses</span>}
                        </label>
                      </div>
                      <select
                        value={p1[0] || ''}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          setSettlePositions((prev) => {
                            const next = { ...prev };
                            // Remove previous 1st place
                            Object.keys(next).forEach((k) => {
                              if (next[k] === 1) next[k] = 0;
                            });
                            if (selectedId) next[selectedId] = 1;
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-900 border border-amber-500/60 rounded-xl text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                      >
                        <option value="">-- Select 1st Place Horse --</option>
                        {settlingRace.horses.map((h) => (
                          <option key={h.id} value={h.id}>
                            #{h.serial_no || h.horse_no} {h.name} (J: {h.jockey} | Win: {h.win_odds}x)
                          </option>
                        ))}
                      </select>

                      {/* Dead Heat 1st secondary selector */}
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Tied for 1st (Dead Heat)?</span>
                        <select
                          value={p1[1] || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setSettlePositions((prev) => {
                              const next = { ...prev };
                              // Keep p1[0] as 1, set p1[1] as 1 or remove
                              if (p1[1] && p1[1] !== selectedId) next[p1[1]] = 0;
                              if (selectedId) next[selectedId] = 1;
                              return next;
                            });
                          }}
                          className="px-2 py-1 bg-slate-900 border border-amber-500/30 rounded-lg text-amber-300 font-bold text-[11px] focus:outline-none cursor-pointer max-w-[200px]"
                        >
                          <option value="">+ Add 2nd Horse (Dead Heat)</option>
                          {settlingRace.horses.filter(h => h.id !== p1[0]).map((h) => (
                            <option key={h.id} value={h.id}>
                              #{h.serial_no || h.horse_no} {h.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 2nd Place Dropdown */}
                    <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-black text-blue-300 text-xs flex items-center gap-1.5">
                          <span>🥈 2nd Place (PLACE)</span>
                          {p2.length > 1 && <span className="text-[10px] bg-blue-500/30 px-1.5 py-0.5 rounded text-blue-200 font-mono font-bold">DH: {p2.length} Horses</span>}
                        </label>
                      </div>
                      <select
                        value={p2[0] || ''}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          setSettlePositions((prev) => {
                            const next = { ...prev };
                            Object.keys(next).forEach((k) => {
                              if (next[k] === 2) next[k] = 0;
                            });
                            if (selectedId) next[selectedId] = 2;
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-900 border border-blue-500/60 rounded-xl text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                      >
                        <option value="">-- Select 2nd Place Horse --</option>
                        {settlingRace.horses.map((h) => (
                          <option key={h.id} value={h.id}>
                            #{h.serial_no || h.horse_no} {h.name} (J: {h.jockey} | Place: {h.place_odds}x)
                          </option>
                        ))}
                      </select>

                      {/* Dead Heat 2nd secondary selector */}
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Tied for 2nd (Dead Heat)?</span>
                        <select
                          value={p2[1] || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setSettlePositions((prev) => {
                              const next = { ...prev };
                              if (p2[1] && p2[1] !== selectedId) next[p2[1]] = 0;
                              if (selectedId) next[selectedId] = 2;
                              return next;
                            });
                          }}
                          className="px-2 py-1 bg-slate-900 border border-blue-500/30 rounded-lg text-blue-300 font-bold text-[11px] focus:outline-none cursor-pointer max-w-[200px]"
                        >
                          <option value="">+ Add 2nd Horse (Dead Heat)</option>
                          {settlingRace.horses.filter(h => h.id !== p2[0]).map((h) => (
                            <option key={h.id} value={h.id}>
                              #{h.serial_no || h.horse_no} {h.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 3rd Place Dropdown */}
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-black text-emerald-300 text-xs flex items-center gap-1.5">
                          <span>🥉 3rd Place (PLACE)</span>
                          {p3.length > 1 && <span className="text-[10px] bg-emerald-500/30 px-1.5 py-0.5 rounded text-emerald-200 font-mono font-bold">DH: {p3.length} Horses</span>}
                        </label>
                      </div>
                      <select
                        value={p3[0] || ''}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          setSettlePositions((prev) => {
                            const next = { ...prev };
                            Object.keys(next).forEach((k) => {
                              if (next[k] === 3) next[k] = 0;
                            });
                            if (selectedId) next[selectedId] = 3;
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-900 border border-emerald-500/60 rounded-xl text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                      >
                        <option value="">-- Select 3rd Place Horse --</option>
                        {settlingRace.horses.map((h) => (
                          <option key={h.id} value={h.id}>
                            #{h.serial_no || h.horse_no} {h.name} (J: {h.jockey} | Place: {h.place_odds}x)
                          </option>
                        ))}
                      </select>

                      {/* Dead Heat 3rd secondary selector */}
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Tied for 3rd (Dead Heat)?</span>
                        <select
                          value={p3[1] || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setSettlePositions((prev) => {
                              const next = { ...prev };
                              if (p3[1] && p3[1] !== selectedId) next[p3[1]] = 0;
                              if (selectedId) next[selectedId] = 3;
                              return next;
                            });
                          }}
                          className="px-2 py-1 bg-slate-900 border border-emerald-500/30 rounded-lg text-emerald-300 font-bold text-[11px] focus:outline-none cursor-pointer max-w-[200px]"
                        >
                          <option value="">+ Add 2nd Horse (Dead Heat)</option>
                          {settlingRace.horses.filter(h => h.id !== p3[0]).map((h) => (
                            <option key={h.id} value={h.id}>
                              #{h.serial_no || h.horse_no} {h.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 4th Place Dropdown */}
                    <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-black text-purple-300 text-xs flex items-center gap-1.5">
                          <span>🎖 4th Place (OFFICIAL 4TH)</span>
                        </label>
                      </div>
                      <select
                        value={p4[0] || ''}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          setSettlePositions((prev) => {
                            const next = { ...prev };
                            Object.keys(next).forEach((k) => {
                              if (next[k] === 4) next[k] = 0;
                            });
                            if (selectedId) next[selectedId] = 4;
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-900 border border-purple-500/60 rounded-xl text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
                      >
                        <option value="">-- Select 4th Place Horse --</option>
                        {settlingRace.horses.map((h) => (
                          <option key={h.id} value={h.id}>
                            #{h.serial_no || h.horse_no} {h.name} (J: {h.jockey})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400 pt-1">
                        Records official superfecta / 4th finisher on turf verdict.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION B: RUNNERS FINISHING POSITION ASSIGNMENT LIST */}
              {settleViewMode === 'RUNNERS' && (
                <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                  {settlingRace.horses.map((horse) => {
                    const currentPos = settlePositions[horse.id] || 0;

                    return (
                      <div
                        key={horse.id}
                        className={`p-3 rounded-2xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${currentPos === 1
                            ? 'bg-amber-500/15 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                            : currentPos === 2
                              ? 'bg-blue-500/15 border-blue-500/50'
                              : currentPos === 3
                                ? 'bg-emerald-500/15 border-emerald-500/50'
                                : currentPos === 4
                                  ? 'bg-purple-500/15 border-purple-500/50'
                                  : 'bg-slate-950/80 border-slate-800/80 opacity-70 hover:opacity-100'
                          }`}
                      >
                        {/* Horse Info */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 text-[#e5b869] font-black font-mono flex items-center justify-center shrink-0">
                            {horse.serial_no || horse.horse_no}
                          </span>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-white uppercase text-xs sm:text-sm">
                                {horse.name}
                              </span>
                              {horse.gate_no !== undefined && (
                                <span className="text-[10px] text-amber-400 font-mono">
                                  (Draw {horse.gate_no})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                              <span>J: {horse.jockey}</span>
                              <span>•</span>
                              <span>T: {horse.trainer}</span>
                              <span>•</span>
                              <span className="text-amber-400 font-mono">Win: {horse.win_odds}x</span>
                              <span>•</span>
                              <span className="text-emerald-400 font-mono">Place: {horse.place_odds}x</span>
                            </div>
                          </div>
                        </div>

                        {/* Position Buttons */}
                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playClick();
                              setSettlePositions((prev) => ({ ...prev, [horse.id]: 1 }));
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-black font-mono transition cursor-pointer active:scale-95 flex items-center gap-1 border ${currentPos === 1
                                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md font-black'
                                : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-700'
                              }`}
                            title="Assign 1st Place (Winner)"
                          >
                            <span>🥇 1st</span>
                            {currentPos === 1 && <Check className="w-3 h-3" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playClick();
                              setSettlePositions((prev) => ({ ...prev, [horse.id]: 2 }));
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer active:scale-95 flex items-center gap-1 border ${currentPos === 2
                                ? 'bg-blue-500 text-white border-blue-300 shadow-md font-black'
                                : 'bg-slate-900 hover:bg-slate-800 text-blue-400 border-slate-700'
                              }`}
                            title="Assign 2nd Place"
                          >
                            <span>🥈 2nd</span>
                            {currentPos === 2 && <Check className="w-3 h-3" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playClick();
                              setSettlePositions((prev) => ({ ...prev, [horse.id]: 3 }));
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer active:scale-95 flex items-center gap-1 border ${currentPos === 3
                                ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-md font-black'
                                : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border-slate-700'
                              }`}
                            title="Assign 3rd Place"
                          >
                            <span>🥉 3rd</span>
                            {currentPos === 3 && <Check className="w-3 h-3" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playClick();
                              setSettlePositions((prev) => ({ ...prev, [horse.id]: 4 }));
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer active:scale-95 flex items-center gap-1 border ${currentPos === 4
                                ? 'bg-purple-500 text-white border-purple-300 shadow-md font-black'
                                : 'bg-slate-900 hover:bg-slate-800 text-purple-400 border-slate-700'
                              }`}
                            title="Assign 4th Place"
                          >
                            <span>🎖 4th</span>
                            {currentPos === 4 && <Check className="w-3 h-3" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playClick();
                              setSettlePositions((prev) => ({ ...prev, [horse.id]: 0 }));
                            }}
                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold font-mono transition cursor-pointer border ${currentPos === 0
                                ? 'bg-slate-800 text-slate-400 border-slate-700'
                                : 'bg-slate-950 hover:bg-slate-900 text-slate-500 border-slate-800'
                              }`}
                            title="Unplaced"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Verdict Summary 4-Place Card */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Official Verdict Summary:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <span className="text-amber-400 font-black text-[11px] block">
                      🥇 1st (WIN {isDeadHeatWin ? `• ${p1.length}-WAY DH` : ''}):
                    </span>
                    <span className="text-white font-bold text-xs truncate block">
                      {p1.length > 0 ? p1.map((h) => `#${h.serial_no || h.horse_no} ${h.name}`).join(' & ') : 'None selected'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
                    <span className="text-blue-300 font-black text-[11px] block">
                      🥈 2nd (PLACE {p2.length > 1 ? `• ${p2.length}-WAY DH` : ''}):
                    </span>
                    <span className="text-white font-bold text-xs truncate block">
                      {p2.length > 0 ? p2.map((h) => `#${h.serial_no || h.horse_no} ${h.name}`).join(' & ') : isDeadHeatWin ? '(No 2nd in DH)' : 'None'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <span className="text-emerald-300 font-black text-[11px] block">
                      🥉 3rd (PLACE {p3.length > 1 ? `• ${p3.length}-WAY DH` : ''}):
                    </span>
                    <span className="text-white font-bold text-xs truncate block">
                      {p3.length > 0 ? p3.map((h) => `#${h.serial_no || h.horse_no} ${h.name}`).join(' & ') : 'None'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
                    <span className="text-purple-300 font-black text-[11px] block">
                      🎖 4th (OFFICIAL 4TH):
                    </span>
                    <span className="text-white font-bold text-xs truncate block">
                      {p4.length > 0 ? p4.map((h) => `#${h.serial_no || h.horse_no} ${h.name}`).join(' & ') : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Cancel, Abandon/Void (100% Refund), Execute Settle */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSettlingRace(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>

                {/* 1-Click ABANDONED / VOID DECLARATION WITH 100% REFUND */}
                <button
                  type="button"
                  onClick={() => handleAbandonRace(settlingRace)}
                  title="If race is cancelled, abandon race and refund 100% of bets to punter balances"
                  className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 text-rose-300 border border-rose-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Declare ABANDONED / VOID (100% Refund All Bets)</span>
                </button>

                <button
                  type="button"
                  id="execute-settle-btn"
                  disabled={isLoading || p1.length === 0}
                  onClick={handleExecuteSettlement}
                  className={`flex-1 min-w-[200px] py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${isDeadHeat
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 ring-2 ring-amber-400/50'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                >
                  <Trophy className="w-4 h-4" />
                  <span>{isDeadHeat ? 'Confirm & Settle Dead Heat Result' : 'Confirm & Settle Official Payouts'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CORE FEATURE: EDIT RACE & RUNNERS MODAL */}
      {editingRace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-white text-base">Edit Race & Runners</h3>
                  <p className="text-xs text-slate-400">Update race info or change serial numbers, gate numbers, horse names, jockeys, and trainers</p>
                </div>
              </div>
              <button
                onClick={() => setEditingRace(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRace} className="space-y-4">
              {/* Race Master Hierarchy & Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-emerald-900/40">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">
                    Level 1: Race Center <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={editRaceCenterId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditRaceCenterId(val);
                      const available = (raceCenters && raceCenters.length > 0) ? raceCenters : DEFAULT_RACE_CENTERS;
                      const center = available.find(c => c.id === val);
                      if (center) setEditVenue(`${center.name} Turf Club`);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select Center --</option>
                    {((raceCenters && raceCenters.length > 0) ? raceCenters : DEFAULT_RACE_CENTERS).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code}) — {c.city || c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">
                    Level 2: Race Day / Card
                  </label>
                  <select
                    value={editRaceDayId}
                    onChange={(e) => setEditRaceDayId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select Race Day --</option>
                    {(raceDays || [])
                      .filter(d => !editRaceCenterId || d.center_id === editRaceCenterId)
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.title} ({d.status})</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Race Master Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 font-semibold mb-1">
                    Name of the Race <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editRaceName}
                    onChange={(e) => setEditRaceName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Race Number</label>
                  <input
                    type="number"
                    value={editRaceNo}
                    onChange={(e) => setEditRaceNo(e.target.value)}
                    placeholder="e.g. 7"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Race Time <span className="text-rose-400">*</span></span>
                    </span>
                    {editTime && (
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                        {format24To12(editTime)}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      id="edit-race-time"
                      type="time"
                      required
                      value={format12To24(editTime)}
                      onChange={(e) => {
                        const val24 = e.target.value;
                        setEditTime(format24To12(val24));
                      }}
                      onClick={(e) => {
                        try {
                          (e.target as any).showPicker?.();
                        } catch { }
                      }}
                      className="w-full px-3 py-2 pl-9 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm font-mono focus:outline-none focus:border-indigo-500 cursor-pointer [color-scheme:dark]"
                    />
                    <Clock
                      onClick={() => {
                        const el = document.getElementById('edit-race-time') as any;
                        el?.showPicker ? el.showPicker() : el?.focus();
                      }}
                      className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer hover:text-indigo-300"
                    />
                  </div>
                  {/* Quick Presets */}
                  <div className="flex items-center gap-1 mt-1.5 overflow-x-auto scrollbar-none text-[10px]">
                    {['1:45 PM', '2:15 PM', '2:45 PM', '3:15 PM', '3:45 PM', '4:15 PM', '4:45 PM'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setEditTime(preset)}
                        className={`px-1.5 py-0.5 rounded transition cursor-pointer whitespace-nowrap font-mono ${format24To12(editTime) === preset
                            ? 'bg-indigo-600 text-white font-bold border border-indigo-500'
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800'
                          }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">
                    Distance <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editDistance}
                    onChange={(e) => setEditDistance(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Venue</label>
                  <input
                    type="text"
                    required
                    value={editVenue}
                    onChange={(e) => setEditVenue(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Status (User Visibility)</label>
                  <select
                    value={editRaceStatus}
                    onChange={(e) => setEditRaceStatus(e.target.value as RaceStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="UPCOMING">⏱ UPCOMING (Visible in Upcoming Races)</option>
                    <option value="LIVE">🔴 LIVE IN-PLAY (Active Live Race)</option>
                    <option value="OPEN">🟢 OPEN (Pre-Race Betting)</option>
                    <option value="DRAFT">📝 DRAFT (Hidden from Users)</option>
                    <option value="CLOSED">🔒 CLOSED / RUNNING</option>
                    <option value="RESULTED">🏆 RESULTED & SETTLED</option>
                  </select>
                </div>
              </div>

              {/* Edit Image Selector & Custom Uploader */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <label className="block text-xs font-bold text-white flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                      Race Fixture & Banner Image
                    </label>
                    <p className="text-[11px] text-slate-400">Upload your own fixture picture or pick a preset</p>
                  </div>

                  <label className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 border border-indigo-400/30">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Custom Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageFileChange(e, setEditRaceImage, 'Race fixture')}
                    />
                  </label>
                </div>

                {editRaceImage && (
                  <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500/60 bg-slate-900 h-32 w-full flex items-center justify-center">
                    <img src={editRaceImage} alt="Race Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex items-end justify-between p-2.5">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] tracking-wide uppercase shadow">
                        Current Fixture Image
                      </span>
                      <label className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow">
                        <Upload className="w-3 h-3 text-indigo-400" />
                        <span>Change</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFileChange(e, setEditRaceImage, 'Race fixture')}
                        />
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-bold text-slate-400 mb-1.5">Presets:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {HORSE_IMAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setEditRaceImage(preset.url)}
                        className={`relative rounded-xl overflow-hidden border-2 text-left transition cursor-pointer group ${editRaceImage === preset.url
                            ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                            : 'border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
                          }`}
                      >
                        <img src={preset.url} alt={preset.label} className="w-full h-16 object-cover" />
                        <div className="p-1 bg-slate-950/90 text-[10px] font-bold text-white truncate">
                          {preset.label}
                        </div>
                        {editRaceImage === preset.url && (
                          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[8px] shadow">
                            Selected
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Runners Manual Edit Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">
                    Runners Field ({editHorses.length} Runners)
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="bulk-paste-edit-race-btn"
                      onClick={() => {
                        setBulkPasteTarget('edit');
                        setIsBulkPasteOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/50 text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>📋 Bulk Paste Horses</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const nextSNo = editHorses.length + 1;
                        setEditHorses([
                          ...editHorses,
                          {
                            id: `h_new_${Date.now()}_${nextSNo}`,
                            serial_no: nextSNo,
                            gate_no: nextSNo,
                            name: '',
                            jockey: '',
                            trainer: '',
                            win_odds: 4.0,
                            place_odds: 1.8,
                            silk_color: '#3b82f6',
                          },
                        ]);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Runner</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {editHorses.map((horse, idx) => (
                    <div
                      key={horse.id || idx}
                      className="bg-slate-950 p-2.5 sm:p-3 rounded-xl border border-slate-800/90 grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-2.5 items-center text-xs"
                    >
                      {/* Serial Number */}
                      <div className="col-span-1 sm:col-span-1">
                        <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">Horse #</label>
                        <input
                          type="number"
                          required
                          value={horse.serial_no}
                          onChange={(e) => {
                            const updated = [...editHorses];
                            updated[idx].serial_no = parseInt(e.target.value) || 0;
                            setEditHorses(updated);
                          }}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold text-center text-xs"
                        />
                      </div>

                      {/* Gate Number */}
                      <div className="col-span-1 sm:col-span-1">
                        <label className="block text-[10px] text-amber-400 font-semibold mb-0.5">Gate</label>
                        <input
                          type="text"
                          required
                          value={horse.gate_no}
                          onChange={(e) => {
                            const updated = [...editHorses];
                            updated[idx].gate_no = e.target.value;
                            setEditHorses(updated);
                          }}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-amber-400 font-mono font-bold text-center text-xs"
                        />
                      </div>

                      {/* Name of the Horse */}
                      <div className="col-span-2 sm:col-span-4">
                        <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">
                          Name of the Horse <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={horse.name}
                          onChange={(e) => {
                            const updated = [...editHorses];
                            updated[idx].name = e.target.value;
                            setEditHorses(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold text-xs uppercase"
                        />
                      </div>

                      {/* Name of the Jockey */}
                      <div className="col-span-1 sm:col-span-3">
                        <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">
                          Jockey Name
                        </label>
                        <input
                          type="text"
                          value={horse.jockey}
                          onChange={(e) => {
                            const updated = [...editHorses];
                            updated[idx].jockey = e.target.value;
                            setEditHorses(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs"
                        />
                      </div>

                      {/* Name of the Trainer */}
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">
                          Trainer Name
                        </label>
                        <input
                          type="text"
                          value={horse.trainer}
                          onChange={(e) => {
                            const updated = [...editHorses];
                            updated[idx].trainer = e.target.value;
                            setEditHorses(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs"
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="col-span-2 sm:col-span-1 flex items-center justify-end sm:justify-center pt-1 sm:pt-0">
                        <button
                          type="button"
                          disabled={editHorses.length <= 1}
                          onClick={() => {
                            if (editHorses.length <= 1) return;
                            setEditHorses(editHorses.filter((_, i) => i !== idx));
                          }}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-700/60 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                          title="Remove runner"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="sm:hidden text-[10px] text-rose-400 font-semibold">Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Action Controls */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRace(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CORE FEATURE: COMPREHENSIVE USER BET LEDGER & PAYOUT AUDIT MODAL */}
      {auditRace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-5xl bg-slate-900 border border-amber-500/50 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] p-5 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-white text-base sm:text-lg">
                      Race #{auditRace.race_no || 1} • {auditRace.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                      User Bet & Payout Ledger
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {auditRace.venue} • {auditRace.race_time} • {auditRace.distance} • Status: <strong className="text-white">{auditRace.status}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAuditRace(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary Top KPI Tiles */}
            {(() => {
              const raceBets = getRaceBets(auditRace.id);
              const turnover = getRaceTurnover(auditRace.id);
              const payouts = getRacePayouts(auditRace.id);
              const profit = turnover - payouts;
              const uniqueBettors = new Set(raceBets.map((b) => b.user_id)).size;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-center">
                    <span className="text-xs text-slate-400 block font-medium">Unique Bettors</span>
                    <strong className="text-lg font-black text-white font-mono">{uniqueBettors} Punters</strong>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-center">
                    <span className="text-xs text-slate-400 block font-medium">Total Turnover Pool</span>
                    <strong className="text-lg font-black text-emerald-400 font-mono">₹{turnover.toLocaleString()}</strong>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-center">
                    <span className="text-xs text-slate-400 block font-medium">Total Payouts Won</span>
                    <strong className="text-lg font-black text-amber-400 font-mono">₹{payouts.toLocaleString()}</strong>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-center">
                    <span className="text-xs text-slate-400 block font-medium">Bookmaker Gross Profit</span>
                    <strong className={`text-lg font-black font-mono ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {profit >= 0 ? `+₹${profit.toLocaleString()}` : `-₹${Math.abs(profit).toLocaleString()}`}
                    </strong>
                  </div>
                </div>
              );
            })()}

            {/* Search filter for bets */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Individual Bet Transactions ({getRaceBets(auditRace.id).length} recorded)</span>
              </div>

              <input
                type="text"
                value={auditBetSearch}
                onChange={(e) => setAuditBetSearch(e.target.value)}
                placeholder="Search bettor name, phone, or horse..."
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full sm:w-72"
              />
            </div>

            {/* User Bets Ledger Table */}
            {(() => {
              const allRaceBets = getRaceBets(auditRace.id);
              const filteredBets = allRaceBets.filter((bet) => {
                if (!auditBetSearch.trim()) return true;
                const query = auditBetSearch.toLowerCase();
                const user = users.find((u) => u.id === bet.user_id);
                const userName = (user?.name || '').toLowerCase();
                const userPhone = (user?.phone || '').toLowerCase();
                const horseName = (bet.horse_name || '').toLowerCase();
                const betType = (bet.bet_type || '').toLowerCase();
                return userName.includes(query) || userPhone.includes(query) || horseName.includes(query) || betType.includes(query);
              });

              if (filteredBets.length === 0) {
                return (
                  <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 space-y-1">
                    <p className="text-sm font-bold text-slate-300">No Bets Recorded for This Race</p>
                    <p className="text-xs text-slate-500">
                      {auditBetSearch ? 'No bets match your search filter.' : 'No users placed wagers on this race card before conclusion.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
                  <div className="overflow-x-auto max-h-[50vh]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-3.5">Bettor (User)</th>
                          <th className="py-3 px-3">Selection (Horse)</th>
                          <th className="py-3 px-3 text-center">Market</th>
                          <th className="py-3 px-3 text-right">Stake</th>
                          <th className="py-3 px-3 text-center">Odds</th>
                          <th className="py-3 px-3 text-right">Payout Won</th>
                          <th className="py-3 px-3 text-center">Status</th>
                          <th className="py-3 px-3.5 text-right">Placed At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {filteredBets.map((bet) => {
                          const user = users.find((u) => u.id === bet.user_id);
                          const horse = auditRace.horses.find((h) => h.id === bet.horse_id || h.name === bet.horse_name);
                          const isWinStatus = bet.status === 'WON' || bet.status === 'DEAD_HEAT_SPLIT';

                          return (
                            <tr key={bet.id} className="hover:bg-slate-900/50 transition">
                              {/* Bettor Info */}
                              <td className="py-3 px-3.5">
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{user?.name || `User #${bet.user_id.slice(-6)}`}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  {user?.phone || user?.email || bet.user_id}
                                </span>
                              </td>

                              {/* Horse / Selection */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-700 shadow-xs"
                                    style={{ backgroundColor: horse?.silk_color || '#3b82f6' }}
                                  />
                                  <div>
                                    <span className="font-bold text-white block truncate">{bet.horse_name}</span>
                                    {horse && (
                                      <span className="text-[10px] text-slate-400 block">
                                        #{horse.serial_no || horse.horse_no} • Gate {horse.gate_no !== undefined ? horse.gate_no : (horse.serial_no || horse.horse_no)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Market */}
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${bet.bet_type === 'WIN'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  }`}>
                                  {bet.bet_type}
                                </span>
                              </td>

                              {/* Stake */}
                              <td className="py-3 px-3 text-right font-mono font-bold text-white">
                                ₹{bet.amount.toLocaleString()}
                              </td>

                              {/* Odds */}
                              <td className="py-3 px-3 text-center font-mono font-bold text-amber-400">
                                {bet.odds.toFixed(2)}x
                              </td>

                              {/* Payout */}
                              <td className="py-3 px-3 text-right font-mono font-black">
                                {isWinStatus ? (
                                  <span className="text-emerald-400">+₹{(bet.payout_amount || 0).toLocaleString()}</span>
                                ) : (
                                  <span className="text-slate-500">₹0</span>
                                )}
                              </td>

                              {/* Status Badge */}
                              <td className="py-3 px-3 text-center">
                                {bet.status === 'WON' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black uppercase">
                                    WON
                                  </span>
                                ) : bet.status === 'DEAD_HEAT_SPLIT' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black uppercase">
                                    DH SPLIT ({bet.dead_heat_multiplier || 0.5}x)
                                  </span>
                                ) : bet.status === 'LOST' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-bold uppercase">
                                    LOST
                                  </span>
                                ) : bet.status === 'REFUNDED' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold uppercase">
                                    REFUNDED
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                                    PENDING
                                  </span>
                                )}
                              </td>

                              {/* Placed At */}
                              <td className="py-3 px-3.5 text-right text-slate-400 font-mono text-[10px]">
                                {new Date(bet.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAuditRace(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BULK PASTE RUNNERS / RACE CARD MODAL                                      */}
      {/* ========================================================================= */}
      {isBulkPasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-slate-900 border border-emerald-500/50 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.2)] p-5 sm:p-6 space-y-4 my-8 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-white text-base sm:text-lg">
                      📋 Bulk Paste Horses
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider">
                      {bulkPasteTarget === 'new' ? 'Target: New Race Form' : 'Target: Edit Race Modal'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Paste raw text from race cards, spreadsheets, or official declarations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkPasteOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instruction Callout */}
            <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  Format Supported: <code className="text-emerald-300 bg-slate-900 px-2 py-0.5 rounded font-mono">Horse number-Gate number-Horse name-Jockey-Trainer</code>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBulkPasteText(`1-12-SPLENDIDO-S Sanjan-Saddam Iqbal
2-11-ULTIMATE BLUES-Mohd Talib-K Aditya
3-10-BLUEMED-Vinod Shinde-J Sebastian
4-2-METZINGER-Shamaz Shareef-P Krishna
5-9-RAPIDUS-Jitendra Singh-M M Uthaiah
6-3-BOLD SHOW-S Sachin-R Ramanathan
7-1-SQUARE CUT-Rafique Sk-G T Surender
8-5-NATURAL TORNADO-R Rakesh-Mansoor Khan
9-8-SIR CALCULUS-Abhishek Mhatre-Ranjeet Shinde
10-6-CLOUDY HILLS-Aleemuddin-M Bobby
11-7-SPRINGSTEEN-A Ayaz Khan-H Zulquarnain
12-4-ONE DIAMOND-Faiz-C D Monnappa`);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer"
                >
                  Load Example Card (12 Horses)
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Also accepts Tab-separated, CSV (comma), Pipe (<code className="text-slate-300">|</code>), and bracket-wrapped inputs. Odds will be initialized automatically and can be tweaked live anytime.
              </p>
            </div>

            {/* Textarea Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Paste Runners Text (One line per horse)
              </label>
              <textarea
                rows={8}
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder={`1-12-SPLENDIDO-S Sanjan-Saddam Iqbal\n2-11-ULTIMATE BLUES-Mohd Talib-K Aditya\n3-10-BLUEMED-Vinod Shinde-J Sebastian\n4-2-METZINGER-Shamaz Shareef-P Krishna\n5-9-RAPIDUS-Jitendra Singh-M M Uthaiah`}
                className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 leading-relaxed placeholder-slate-600"
              />
            </div>

            {/* Live Parsing Preview */}
            {(() => {
              const previewRunners = parseBulkRunnersText(bulkPasteText);
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Live Parsed Preview: <strong className="text-emerald-400 font-mono">{previewRunners.length} Runners Detected</strong>
                    </span>
                    {bulkPasteText && (
                      <button
                        type="button"
                        onClick={() => setBulkPasteText('')}
                        className="text-[11px] text-slate-400 hover:text-rose-400 transition"
                      >
                        Clear Text
                      </button>
                    )}
                  </div>

                  {previewRunners.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-900 sticky top-0 z-10 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3 text-center w-12">#</th>
                            <th className="py-2 px-3 text-center w-16">Gate</th>
                            <th className="py-2 px-3">Horse Name</th>
                            <th className="py-2 px-3">Jockey</th>
                            <th className="py-2 px-3">Trainer</th>
                            <th className="py-2 px-3 text-center w-20">Win</th>
                            <th className="py-2 px-3 text-center w-20">Place</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {previewRunners.map((runner, i) => (
                            <tr key={i} className="hover:bg-slate-900/50">
                              <td className="py-1.5 px-3 text-center font-bold text-slate-300">
                                {runner.serial_no}
                              </td>
                              <td className="py-1.5 px-3 text-center text-amber-400 font-bold">
                                {runner.gate_no}
                              </td>
                              <td className="py-1.5 px-3 font-bold text-white font-sans">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                    style={{ backgroundColor: runner.silk_color }}
                                  />
                                  <span>{runner.name}</span>
                                </div>
                              </td>
                              <td className="py-1.5 px-3 text-slate-300 font-sans">{runner.jockey}</td>
                              <td className="py-1.5 px-3 text-slate-400 font-sans">{runner.trainer}</td>
                              <td className="py-1.5 px-3 text-center text-amber-400 font-bold">{runner.win_odds}</td>
                              <td className="py-1.5 px-3 text-center text-emerald-400 font-bold">{runner.place_odds}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                      Type or paste your horses above to preview the parsed race card.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Modal Controls */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkPasteOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="apply-bulk-horses-btn"
                disabled={parseBulkRunnersText(bulkPasteText).length === 0}
                onClick={handleApplyBulkRunners}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply & Populate Race Card ({parseBulkRunnersText(bulkPasteText).length} Horses)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RACE CREATION ACTION CONFIRMATION MODAL                                  */}
      {/* ========================================================================= */}
      {createdRaceSuccessModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-emerald-500/60 rounded-3xl shadow-[0_0_60px_rgba(16,185,129,0.3)] p-6 sm:p-7 space-y-5 text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/50">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider">
                {createdRaceSuccessModal.status === 'DRAFT' ? '💾 SAVED TO SAVED RACE CARDS' : '🚀 PUBLISHED FOR USER VIEW'}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Race #{createdRaceSuccessModal.raceNo} Created Successfully!
              </h3>
              <p className="text-sm font-bold text-amber-400">
                "{createdRaceSuccessModal.raceName}" • {createdRaceSuccessModal.runnersCount} Runners
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {createdRaceSuccessModal.status === 'DRAFT'
                  ? 'Card is securely saved as a draft with odds closed. You can add the next race card now or view all saved cards.'
                  : 'Card is published to Upcoming Races with flash banner active for users.'}
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                id="add-next-race-modal-btn"
                onClick={() => {
                  const nextNo = (createdRaceSuccessModal.raceNo || 1) + 1;
                  handleClearForm();
                  setNewRaceNo(nextNo);
                  setActiveTab('add_race');
                  setCreatedRaceSuccessModal(null);
                  soundManager.playChip();
                }}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>➕ Add Next Race Card (Race #{createdRaceSuccessModal.raceNo + 1})</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="view-saved-cards-modal-btn"
                  onClick={() => {
                    setActiveTab('saved');
                    setCreatedRaceSuccessModal(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Go to Saved Cards</span>
                </button>

                <button
                  type="button"
                  id="view-published-races-modal-btn"
                  onClick={() => {
                    setActiveTab('upcoming');
                    setCreatedRaceSuccessModal(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Go to Published Races</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ODDS CHANGE HISTORY MODAL */}
      {oddsHistoryModalHorse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Odds Audit Log: #{oddsHistoryModalHorse.horse.serial_no || oddsHistoryModalHorse.horse.horse_no} {oddsHistoryModalHorse.horse.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {oddsHistoryModalHorse.race.venue} • Current Win: <strong className="text-amber-400 font-mono">{oddsHistoryModalHorse.horse.win_odds.toFixed(2)}x</strong> • Place: <strong className="text-emerald-400 font-mono">{oddsHistoryModalHorse.horse.place_odds.toFixed(2)}x</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOddsHistoryModalHorse(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="p-2.5">Time</th>
                    <th className="p-2.5">Win Odds Change</th>
                    <th className="p-2.5">Place Odds Change</th>
                    <th className="p-2.5 text-right">Modified By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {(oddsHistoryModalHorse.horse.odds_history || []).map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="p-2.5 text-slate-400 text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="p-2.5">
                        <span className="text-slate-400">{log.old_win?.toFixed(2) || '-'}</span>
                        <span className="mx-1 text-slate-500">→</span>
                        <span className="text-amber-400 font-bold">{log.win_odds.toFixed(2)}x</span>
                      </td>
                      <td className="p-2.5">
                        <span className="text-slate-400">{log.old_place?.toFixed(2) || '-'}</span>
                        <span className="mx-1 text-slate-500">→</span>
                        <span className="text-emerald-400 font-bold">{log.place_odds.toFixed(2)}x</span>
                      </td>
                      <td className="p-2.5 text-right text-slate-300 font-sans text-[11px]">
                        {log.changed_by || 'Admin'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!oddsHistoryModalHorse.horse.odds_history || oddsHistoryModalHorse.horse.odds_history.length === 0) && (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No previous odds updates recorded yet for this runner. Initial odds: {oddsHistoryModalHorse.horse.win_odds.toFixed(2)}x Win / {oddsHistoryModalHorse.horse.place_odds.toFixed(2)}x Place.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setOddsHistoryModalHorse(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD HORSE TO RACE MODAL */}
      {quickAddHorseRace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Add Runner to Race: {quickAddHorseRace.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {quickAddHorseRace.venue} • Currently {quickAddHorseRace.horses.length} runners
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddHorseRace(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddHorse} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Horse # (Serial No)
                  </label>
                  <input
                    type="number"
                    required
                    value={quickHorseData.horse_no}
                    onChange={(e) => setQuickHorseData({ ...quickHorseData, horse_no: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Draw / Gate #
                  </label>
                  <input
                    type="text"
                    required
                    value={quickHorseData.gate_no}
                    onChange={(e) => setQuickHorseData({ ...quickHorseData, gate_no: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-400 text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Horse Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickHorseData.name}
                  onChange={(e) => setQuickHorseData({ ...quickHorseData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold uppercase focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. SPEED PRINCESS"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Jockey Name
                  </label>
                  <input
                    type="text"
                    value={quickHorseData.jockey}
                    onChange={(e) => setQuickHorseData({ ...quickHorseData, jockey: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Suraj Narredu"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Trainer Name
                  </label>
                  <input
                    type="text"
                    value={quickHorseData.trainer}
                    onChange={(e) => setQuickHorseData({ ...quickHorseData, trainer: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. S. Padmanabhan"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-amber-400 mb-1">
                    Initial WIN Odds
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="1.05"
                    required
                    value={quickHorseData.win_odds}
                    onChange={(e) => setQuickHorseData({ ...quickHorseData, win_odds: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-xl text-amber-400 text-xs font-mono font-bold focus:outline-none focus:border-amber-400 text-center"
                    placeholder="2.50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-400 mb-1">
                    Initial PLACE Odds
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="1.02"
                    required
                    value={quickHorseData.place_odds}
                    onChange={(e) => setQuickHorseData({ ...quickHorseData, place_odds: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/50 rounded-xl text-emerald-400 text-xs font-mono font-bold focus:outline-none focus:border-emerald-400 text-center"
                    placeholder="1.40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuickAddHorseRace(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-950/50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Runner to Card</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RACE CENTER MODAL */}
      {editingCenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Edit Race Center: {editingCenter.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCenter(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCenter} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Center Name *</label>
                <input
                  type="text"
                  required
                  value={editCenterName}
                  onChange={(e) => setEditCenterName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold uppercase text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Code *</label>
                  <input
                    type="text"
                    required
                    value={editCenterCode}
                    onChange={(e) => setEditCenterCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold uppercase text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Status</label>
                  <select
                    value={editCenterActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditCenterActive(e.target.value === 'active')}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">City / Region</label>
                <input
                  type="text"
                  value={editCenterCity}
                  onChange={(e) => setEditCenterCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCenter(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Center</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RACE DAY MODAL */}
      {editingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Edit Race Day Card
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingDay(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDay} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Center *</label>
                <select
                  required
                  value={editDayCenterId}
                  onChange={(e) => setEditDayCenterId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-amber-500"
                >
                  {((raceCenters && raceCenters.length > 0) ? raceCenters : DEFAULT_RACE_CENTERS).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code}) — {c.city || c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Race Date *</label>
                  <input
                    type="date"
                    required
                    value={editDayDate}
                    onChange={(e) => setEditDayDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Status</label>
                  <select
                    value={editDayStatus}
                    onChange={(e) => setEditDayStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Card Title</label>
                <input
                  type="text"
                  value={editDayTitle}
                  onChange={(e) => setEditDayTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDay(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 font-black transition cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Race Day</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CUSTOM CONFIRMATION ACTION MODAL (Replaces browser popups) */}
      {/* ======================================================== */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-gradient-to-b from-[#0e1724] via-[#0b121c] to-[#080d14] rounded-3xl border-2 border-slate-700/80 shadow-[0_0_50px_rgba(0,0,0,0.8)] p-6 text-center space-y-4">
            {/* Icon badge */}
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-lg ${
              confirmModal.variant === 'danger'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-rose-500/20'
                : confirmModal.variant === 'success'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-emerald-500/20'
                : confirmModal.variant === 'warning'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-amber-500/20'
                : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-indigo-500/20'
            }`}>
              {confirmModal.variant === 'danger' ? (
                <Trash2 className="w-7 h-7" />
              ) : confirmModal.variant === 'success' ? (
                <CheckCircle2 className="w-7 h-7" />
              ) : (
                <AlertTriangle className="w-7 h-7" />
              )}
            </div>

            {/* Title & Message */}
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white tracking-tight">
                {confirmModal.title}
              </h3>
              <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed px-2">
                {confirmModal.message}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                id="modal-confirm-cancel-btn"
                onClick={() => {
                  soundManager.playClick();
                  setConfirmModal(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition cursor-pointer border border-slate-700"
              >
                {confirmModal.cancelText || 'Cancel'}
              </button>

              <button
                type="button"
                id="modal-confirm-action-btn"
                onClick={async () => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal(null);
                  await action();
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white transition cursor-pointer shadow-lg active:scale-95 ${
                  confirmModal.variant === 'danger'
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-950/50 border border-rose-400/40'
                    : confirmModal.variant === 'success'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-950/50 border border-emerald-400/40'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black'
                }`}
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL RACE SETTLEMENT & RESULT DECLARATION MODAL */}
      {settlingRace && (
        <div
          id="admin-settlement-modal-overlay"
          className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn"
        >
          <div
            id="admin-settlement-modal-card"
            className="relative w-full max-w-3xl bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl shadow-amber-950/40 my-auto overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border-b border-amber-500/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                      Official Result Declaration & Settlement
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/40">
                      LIVE IN-PLAY
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="text-amber-400 font-bold">{settlingRace.venue}</span>
                    <span>•</span>
                    <span className="text-white font-bold">{settlingRace.name}</span>
                    {settlingRace.race_no && (
                      <>
                        <span>•</span>
                        <span className="text-indigo-400 font-bold">Race #{settlingRace.race_no}</span>
                      </>
                    )}
                    <span>•</span>
                    <span className="text-slate-400">{settlingRace.distance}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="close-settle-modal-btn"
                onClick={() => setSettlingRace(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Notice Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 leading-relaxed">
                  <strong className="text-amber-300">Automated Financial Settlement:</strong> Selecting the 1st, 2nd, 3rd, and 4th place winners will immediately credit winning bettor balances in real time, record ledger statements, and advance the fixture to Finished Races.
                </div>
              </div>

              {/* Mode & Tools Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSettleViewMode('DROPDOWN')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      settleViewMode === 'DROPDOWN'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Podium Dropdowns</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleViewMode('RUNNERS')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      settleViewMode === 'RUNNERS'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Runners Grid</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      id="dead-heat-toggle"
                      checked={settleDeadHeatMode}
                      onChange={(e) => setSettleDeadHeatMode(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="font-bold flex items-center gap-1">
                      <span>🔥 Dead Heat Mode</span>
                      <span className="text-[10px] text-amber-400 font-normal">(Tied Placings)</span>
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      const initial: Record<string, 1 | 2 | 3 | 4 | 0> = {};
                      settlingRace.horses.forEach((h, idx) => {
                        if (idx === 0) initial[h.id] = 1;
                        else if (idx === 1) initial[h.id] = 2;
                        else if (idx === 2) initial[h.id] = 3;
                        else if (idx === 3) initial[h.id] = 4;
                        else initial[h.id] = 0;
                      });
                      setSettlePositions(initial);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold border border-slate-800 transition cursor-pointer"
                  >
                    Top 4 Default
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const initial: Record<string, 1 | 2 | 3 | 4 | 0> = {};
                      settlingRace.horses.forEach((h) => {
                        initial[h.id] = 0;
                      });
                      setSettlePositions(initial);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[11px] font-bold border border-slate-800 transition cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* VIEW MODE 1: PODIUM DROPDOWNS */}
              {settleViewMode === 'DROPDOWN' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* 1st Place (WINNER) */}
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Trophy className="w-4 h-4" />
                        <span>🥇 1st Place (Winner)</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        WIN & PLACE
                      </span>
                    </div>

                    {!settleDeadHeatMode ? (
                      <select
                        id="settle-select-p1"
                        value={Object.keys(settlePositions).find((id) => settlePositions[id] === 1) || ''}
                        onChange={(e) => {
                          const horseId = e.target.value;
                          setSettlePositions((prev) => {
                            const next = { ...prev };
                            Object.keys(next).forEach((id) => {
                              if (next[id] === 1) next[id] = 0;
                            });
                            if (horseId) next[horseId] = 1;
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/50 text-white font-bold text-xs focus:ring-2 focus:ring-amber-400 outline-hidden"
                      >
                        <option value="">-- Select 1st Place Winner --</option>
                        {settlingRace.horses.map((h) => (
                          <option key={h.id} value={h.id}>
                            #{h.serial_no || h.horse_no} {h.name} (J: {h.jockey} • W: {h.win_odds.toFixed(2)}x)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {settlingRace.horses.map((h) => {
                          const isP1 = settlePositions[h.id] === 1;
                          return (
                            <label
                              key={h.id}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border transition ${
                                isP1
                                  ? 'bg-amber-500/20 border-amber-400 text-white font-bold'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isP1}
                                  onChange={(e) => {
                                    setSettlePositions((prev) => ({
                                      ...prev,
                                      [h.id]: e.target.checked ? 1 : 0,
                                    }));
                                  }}
                                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                                />
                                <span>#{h.serial_no || h.horse_no} {h.name}</span>
                              </div>
                              <span className="font-mono text-amber-400 text-[11px]">{h.win_odds.toFixed(2)}x</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2nd Place */}
                  <div className="p-3.5 rounded-2xl bg-blue-500/10 border-2 border-blue-500/30 space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-300 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Trophy className="w-4 h-4" />
                        <span>🥈 2nd Place (Runner-Up)</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                        PLACE
                      </span>
                    </div>

                    {!settleDeadHeatMode ? (
                      <select
                        id="settle-select-p2"
                        value={Object.keys(settlePositions).find((id) => settlePositions[id] === 2) || ''}
                        onChange={(e) => {
                          const horseId = e.target.value;
                          setSettlePositions((prev) => {
                            const next = { ...prev };
                            Object.keys(next).forEach((id) => {
                              if (next[id] === 2) next[id] = 0;
                            });
                            if (horseId) next[horseId] = 2;
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-blue-500/40 text-white font-bold text-xs focus:ring-2 focus:ring-blue-400 outline-hidden"
                      >
                        <option value="">-- Select 2nd Place --</option>
                        {settlingRace.horses.map((h) => (
                          <option key={h.id} value={h.id}>
                            #{h.serial_no || h.horse_no} {h.name} (J: {h.jockey} • P: {h.place_odds.toFixed(2)}x)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {settlingRace.horses.map((h) => {
                          const isP2 = settlePositions[h.id] === 2;
                          return (
                            <label
                              key={h.id}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border transition ${
                                isP2
                                  ? 'bg-blue-500/20 border-blue-400 text-white font-bold'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isP2}
                                  onChange={(e) => {
                                    setSettlePositions((prev) => ({
                                      ...prev,
                                      [h.id]: e.target.checked ? 2 : 0,
                                    }));
                                  }}
                                  className="rounded border-slate-700 text-blue-500 focus:ring-blue-500"
                                />
                                <span>#{h.serial_no || h.horse_no} {h.name}</span>
                              </div>
                              <span className="font-mono text-blue-300 text-[11px]">{h.place_odds.toFixed(2)}x</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 3rd Place */}
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Trophy className="w-4 h-4" />
                        <span>🥉 3rd Place</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        PLACE
                      </span>
                    </div>

                    {!settleDeadHeatMode ? (
                      <select
                        id="settle-select-p3"
                        value={Object.keys(settlePositions).find((id) => settlePositions[id] === 3) || ''}
                        onChange={(e) => {
                          const horseId = e.target.value;
                          setSettlePositions((prev) => {
                            const next = { ...prev };
                            Object.keys(next).forEach((id) => {
                              if (next[id] === 3) next[id] = 0;
                            });
                            if (horseId) next[horseId] = 3;
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-bold text-xs focus:ring-2 focus:ring-emerald-400 outline-hidden"
                      >
                        <option value="">-- Select 3rd Place --</option>
                        {settlingRace.horses.map((h) => (
                          <option key={h.id} value={h.id}>
                            #{h.serial_no || h.horse_no} {h.name} (J: {h.jockey} • P: {h.place_odds.toFixed(2)}x)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {settlingRace.horses.map((h) => {
                          const isP3 = settlePositions[h.id] === 3;
                          return (
                            <label
                              key={h.id}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border transition ${
                                isP3
                                  ? 'bg-emerald-500/20 border-emerald-400 text-white font-bold'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isP3}
                                  onChange={(e) => {
                                    setSettlePositions((prev) => ({
                                      ...prev,
                                      [h.id]: e.target.checked ? 3 : 0,
                                    }));
                                  }}
                                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                                />
                                <span>#{h.serial_no || h.horse_no} {h.name}</span>
                              </div>
                              <span className="font-mono text-emerald-400 text-[11px]">{h.place_odds.toFixed(2)}x</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 4th Place */}
                  <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-300 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Flag className="w-4 h-4" />
                        <span>4th Place (Official Result)</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                        OFFICIAL VERDICT
                      </span>
                    </div>

                    <select
                      id="settle-select-p4"
                      value={Object.keys(settlePositions).find((id) => settlePositions[id] === 4) || ''}
                      onChange={(e) => {
                        const horseId = e.target.value;
                        setSettlePositions((prev) => {
                          const next = { ...prev };
                          Object.keys(next).forEach((id) => {
                            if (next[id] === 4) next[id] = 0;
                          });
                          if (horseId) next[horseId] = 4;
                          return next;
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white font-bold text-xs focus:ring-2 focus:ring-purple-400 outline-hidden"
                    >
                      <option value="">-- Select 4th Place (Optional) --</option>
                      {settlingRace.horses.map((h) => (
                        <option key={h.id} value={h.id}>
                          #{h.serial_no || h.horse_no} {h.name} (J: {h.jockey})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* VIEW MODE 2: VISUAL RUNNERS GRID */}
              {settleViewMode === 'RUNNERS' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    {settlingRace.horses.map((horse) => {
                      const pos = settlePositions[horse.id] || 0;
                      return (
                        <div
                          key={horse.id}
                          className={`p-3 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            pos === 1
                              ? 'bg-amber-500/15 border-amber-400 shadow-md ring-1 ring-amber-400/30'
                              : pos === 2
                              ? 'bg-blue-500/15 border-blue-400 shadow-md'
                              : pos === 3
                              ? 'bg-emerald-500/15 border-emerald-400 shadow-md'
                              : pos === 4
                              ? 'bg-purple-500/15 border-purple-400'
                              : 'bg-slate-950/70 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                                pos === 1
                                  ? 'bg-amber-400 text-slate-950'
                                  : pos === 2
                                  ? 'bg-blue-400 text-slate-950'
                                  : pos === 3
                                  ? 'bg-emerald-400 text-slate-950'
                                  : pos === 4
                                  ? 'bg-purple-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {horse.serial_no || horse.horse_no}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <strong className="text-white text-xs">{horse.name}</strong>
                                <span className="text-[10px] text-slate-400">J: {horse.jockey}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                                <span className="text-amber-400">Win: {horse.win_odds.toFixed(2)}x</span>
                                <span>•</span>
                                <span className="text-emerald-400">Place: {horse.place_odds.toFixed(2)}x</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSettlePositions((prev) => {
                                  const next = { ...prev };
                                  if (!settleDeadHeatMode) {
                                    Object.keys(next).forEach((id) => {
                                      if (next[id] === 1) next[id] = 0;
                                    });
                                  }
                                  next[horse.id] = pos === 1 ? 0 : 1;
                                  return next;
                                });
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                pos === 1
                                  ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                                  : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              🥇 1st (Win)
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSettlePositions((prev) => {
                                  const next = { ...prev };
                                  if (!settleDeadHeatMode) {
                                    Object.keys(next).forEach((id) => {
                                      if (next[id] === 2) next[id] = 0;
                                    });
                                  }
                                  next[horse.id] = pos === 2 ? 0 : 2;
                                  return next;
                                });
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                pos === 2
                                  ? 'bg-blue-400 text-slate-950 shadow-md ring-2 ring-blue-300'
                                  : 'bg-slate-900 hover:bg-slate-800 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              🥈 2nd
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSettlePositions((prev) => {
                                  const next = { ...prev };
                                  if (!settleDeadHeatMode) {
                                    Object.keys(next).forEach((id) => {
                                      if (next[id] === 3) next[id] = 0;
                                    });
                                  }
                                  next[horse.id] = pos === 3 ? 0 : 3;
                                  return next;
                                });
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                pos === 3
                                  ? 'bg-emerald-400 text-slate-950 shadow-md ring-2 ring-emerald-300'
                                  : 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              🥉 3rd
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSettlePositions((prev) => {
                                  const next = { ...prev };
                                  if (!settleDeadHeatMode) {
                                    Object.keys(next).forEach((id) => {
                                      if (next[id] === 4) next[id] = 0;
                                    });
                                  }
                                  next[horse.id] = pos === 4 ? 0 : 4;
                                  return next;
                                });
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                pos === 4
                                  ? 'bg-purple-400 text-slate-950 shadow-md ring-2 ring-purple-300'
                                  : 'bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/30'
                              }`}
                            >
                              4th
                            </button>

                            {pos !== 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSettlePositions((prev) => ({
                                    ...prev,
                                    [horse.id]: 0,
                                  }));
                                }}
                                className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-bold"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LIVE BETS ON THIS RACE & FINANCIAL SIMULATION */}
              {(() => {
                const raceBets = (allBets || []).filter(
                  (b) => b.race_id === settlingRace.id || b.race_name?.toLowerCase() === settlingRace.name?.toLowerCase()
                );
                const totalStake = raceBets.reduce((sum, b) => sum + Number(b.stake || b.amount || 0), 0);
                const p1Ids = Object.keys(settlePositions).filter((id) => settlePositions[id] === 1);
                const p2Ids = Object.keys(settlePositions).filter((id) => settlePositions[id] === 2);
                const p3Ids = Object.keys(settlePositions).filter((id) => settlePositions[id] === 3);
                const podiumIds = [...p1Ids, ...p2Ids, ...p3Ids];

                let estimatedPayout = 0;
                let winningBetsCount = 0;

                raceBets.forEach((b) => {
                  const numStake = Number(b.stake || b.amount || 0);
                  const numOdds = Number(b.odds || 1);
                  if (b.bet_type === 'WIN' && p1Ids.includes(b.horse_id)) {
                    estimatedPayout += Math.round(numStake * numOdds);
                    winningBetsCount++;
                  } else if (b.bet_type === 'PLACE' && podiumIds.includes(b.horse_id)) {
                    estimatedPayout += Math.round(numStake * numOdds);
                    winningBetsCount++;
                  }
                });

                const adminProfit = totalStake - estimatedPayout;

                return (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-white">Live Race Wagers & Settlement Impact</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                          {raceBets.length} Bets Placed
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono">
                        <div>
                          <span className="text-slate-400 text-[10px] block">Turnover Pool</span>
                          <strong className="text-emerald-400 font-bold">₹{totalStake.toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">Est. Payout</span>
                          <strong className="text-amber-400 font-bold">₹{estimatedPayout.toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">Admin Net</span>
                          <strong className={`font-bold ${adminProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {adminProfit >= 0 ? `+₹${adminProfit.toLocaleString()}` : `-₹${Math.abs(adminProfit).toLocaleString()}`}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Bettors List */}
                    {raceBets.length > 0 ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {raceBets.map((b) => {
                          const u = users.find((usr) => usr.id === b.user_id);
                          const isWin =
                            (b.bet_type === 'WIN' && p1Ids.includes(b.horse_id)) ||
                            (b.bet_type === 'PLACE' && podiumIds.includes(b.horse_id));

                          return (
                            <div
                              key={b.id}
                              className={`p-2 rounded-xl text-xs flex items-center justify-between border transition ${
                                isWin
                                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                    b.bet_type === 'WIN' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
                                  }`}
                                >
                                  {b.bet_type}
                                </span>
                                <strong className="text-white">#{b.horse_no} {b.horse_name}</strong>
                                <span className="text-slate-400 text-[11px]">@{b.odds.toFixed(2)}x</span>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-400 text-[11px] truncate max-w-[100px]">
                                  {u?.username || u?.name || b.username || 'Bettor'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 font-mono">
                                <span className="text-slate-400">₹{b.stake?.toLocaleString() || b.amount?.toLocaleString()}</span>
                                <span
                                  className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                    isWin
                                      ? 'bg-emerald-500 text-slate-950'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {isWin ? `WON +₹${Math.round((b.stake || b.amount || 0) * (b.odds || 1)).toLocaleString()}` : 'LOST'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic py-1 text-center">
                        No bets placed on this match.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  1st: <strong className="text-amber-400">
                    {settlingRace.horses.filter((h) => settlePositions[h.id] === 1).map((h) => `#${h.serial_no || h.horse_no} ${h.name}`).join(', ') || 'None selected'}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  id="cancel-settle-modal-btn"
                  onClick={() => setSettlingRace(null)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer border border-slate-700"
                >
                  Cancel / Keep In-Play
                </button>

                <button
                  type="button"
                  id="confirm-execute-settle-btn"
                  disabled={isLoading || isSettledSuccess || Object.keys(settlePositions).filter((id) => settlePositions[id] === 1).length === 0}
                  onClick={handleExecuteSettlement}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                    isSettledSuccess
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 ring-2 ring-emerald-300 shadow-emerald-950/50'
                      : Object.keys(settlePositions).filter((id) => settlePositions[id] === 1).length === 0
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 shadow-amber-950/50 ring-2 ring-amber-400/40'
                  }`}
                >
                  {isSettledSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-slate-950" />
                      <span>✓ Settled</span>
                    </>
                  ) : isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Settling Payouts...</span>
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4 text-slate-950" />
                      <span>🏆 Confirm & Settle Race</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

