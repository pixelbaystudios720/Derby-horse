import { 
  Banner, 
  Bet, 
  BetType, 
  Horse,
  Race, 
  RaceCenter,
  RaceDay,
  RaceStatus, 
  Transaction, 
  User,
  DepositRequest,
  DepositStatus,
  WithdrawalRequest,
  WithdrawalStatus,
  UserNotification,
  NotificationType
} from '../types';
import { DUMMY_BANNERS, DUMMY_BETS, DUMMY_RACES, DUMMY_USER } from '../data/dummyMatches';

const API_BASE = '/api';

export const DEFAULT_RACE_CENTERS: RaceCenter[] = [
  { id: 'cntr_mysore', name: 'MYSORE', code: 'MYS', city: 'Mysore', is_active: true, order: 1 },
  { id: 'cntr_bangalore', name: 'BANGALORE', code: 'BTC', city: 'Bangalore', is_active: true, order: 2 },
  { id: 'cntr_ooty', name: 'OOTY', code: 'OOT', city: 'Ooty', is_active: true, order: 3 },
  { id: 'cntr_madras', name: 'MADRAS', code: 'MRC', city: 'Chennai', is_active: true, order: 4 },
  { id: 'cntr_kolkata', name: 'KOLKATA', code: 'CAL', city: 'Kolkata', is_active: true, order: 5 },
  { id: 'cntr_delhi', name: 'DELHI', code: 'DEL', city: 'Delhi', is_active: true, order: 6 },
  { id: 'cntr_hyderabad', name: 'HYDERABAD', code: 'HYD', city: 'Hyderabad', is_active: true, order: 7 },
  { id: 'cntr_pune', name: 'PUNE', code: 'PUN', city: 'Pune', is_active: true, order: 8 },
  { id: 'cntr_mumbai', name: 'MUMBAI', code: 'MUM', city: 'Mumbai', is_active: true, order: 9 },
];

// ----------------------------------------------------------------------
// REALTIME ODDS SYNC SERVICE (WebSocket / BroadcastChannel / EventTarget)
// ----------------------------------------------------------------------
export interface OddsStatusUpdatePayload {
  event: 'odds_status_update' | 'ODDS_UPDATED' | 'SUSPEND_HORSE' | 'RESUME_HORSE' | 'SUSPEND_ALL' | 'RESUME_ALL' | 'RACE_STATUS_CHANGED';
  race_id: string;
  race_day_id?: string;
  center_id?: string;
  open_race_id?: string;
  horse_id?: string;
  is_suspended?: boolean;
  win_odds?: number;
  place_odds?: number;
  race?: Race;
  timestamp: number;
}

class RealtimeOddsService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(payload: OddsStatusUpdatePayload) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('derby_realtime_odds');
        this.channel.onmessage = (event) => {
          if (event.data) {
            this.notifyListeners(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel initialization notice:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('derby_odds_event', ((e: CustomEvent) => {
        if (e.detail) {
          this.notifyListeners(e.detail);
        }
      }) as EventListener);

      window.addEventListener('storage', (e) => {
        if (e.key === 'derby_last_odds_event' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            this.notifyListeners(data);
          } catch {}
        }
      });
    }
  }

  broadcast(payload: OddsStatusUpdatePayload) {
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch {}
    }
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('derby_odds_event', { detail: payload }));
        localStorage.setItem('derby_last_odds_event', JSON.stringify(payload));
      } catch {}
    }
    this.notifyListeners(payload);
  }

  subscribe(callback: (payload: OddsStatusUpdatePayload) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(payload: OddsStatusUpdatePayload) {
    this.listeners.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error('Error in odds listener callback:', err);
      }
    });
  }
}

export const realtimeOdds = new RealtimeOddsService();

class FinancialBroadcastService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('derby_financial_sync');
        this.channel.onmessage = () => {
          this.notify();
        };
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('derby_financial_event', () => {
        this.notify();
      });

      window.addEventListener('storage', (e) => {
        if (
          e.key === 'derby_last_financial_event' ||
          e.key === 'derby_deposit_requests' ||
          e.key === 'derby_withdrawal_requests' ||
          e.key === 'derby_user' ||
          e.key === 'derby_custom_txs'
        ) {
          this.notify();
        }
      });
    }
  }

  broadcast() {
    if (this.channel) {
      try {
        this.channel.postMessage({ timestamp: Date.now() });
      } catch {}
    }
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('derby_financial_event'));
        localStorage.setItem('derby_last_financial_event', String(Date.now()));
      } catch {}
    }
    this.notify();
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }
}

async function safeParseJson<T = any>(res: Response, fallbackError: string): Promise<T> {
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(fallbackError);
    }
    data = {};
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || fallbackError);
  }
  return data;
}

export const financialSync = new FinancialBroadcastService();

export const api = {
  // Auth
  async sendOtp(params: { email?: string; phone?: string; username?: string } | string): Promise<{ success: boolean; message: string; otp_token?: string; simulated_otp?: string }> {
    const payload = typeof params === 'string' 
      ? (params.includes('@') ? { email: params } : { phone: params })
      : params;
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await safeParseJson(res, 'Failed to send OTP. Please try again.');
    } catch (err: any) {
      const target = payload.email || payload.phone || 'your address';
      return { 
        success: true, 
        message: err.message || `OTP sent to ${target}`, 
        simulated_otp: '123456' 
      };
    }
  },

  async verifyOtp(params: { email?: string; phone?: string; otp: string; otp_token?: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await safeParseJson(res, 'Invalid or expired OTP verification code.');
  },

  async signup(params: { email?: string; phone?: string; otp: string; otp_token?: string; username: string; password: string; full_name?: string }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await safeParseJson(res, 'Sign up failed. Please check inputs and try again.');
    localStorage.setItem('derby_token', data.token);
    localStorage.setItem('derby_user', JSON.stringify(data.user));
    return data;
  },

  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await safeParseJson(res, 'Invalid username or password.');
      localStorage.setItem('derby_token', data.token);
      localStorage.setItem('derby_user', JSON.stringify(data.user));
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Server connection timed out. Please try logging in again.');
      }
      throw err;
    }
  },

  async forgotPasswordSendOtp(email: string): Promise<{ success: boolean; message: string; otp_token?: string; simulated_otp?: string }> {
    const res = await fetch(`${API_BASE}/auth/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return await safeParseJson(res, 'Failed to send reset code to Gmail.');
  },

  async forgotPasswordReset(params: { email: string; otp: string; otp_token?: string; new_password: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/forgot-password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await safeParseJson(res, 'Failed to reset password.');
  },

  async getMe(userId?: string): Promise<User | null> {
    try {
      const token = localStorage.getItem('derby_token') || '';
      const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
      const res = await fetch(`${API_BASE}/auth/me${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          try { localStorage.setItem('derby_user', JSON.stringify(data.user)); } catch {}
          return data.user;
        }
      }
    } catch (e) {
      console.warn('API getMe failed', e);
    }
    const saved = localStorage.getItem('derby_user');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return null;
  },

  async getUsers(): Promise<User[]> {
    try {
      const res = await fetch(`${API_BASE}/admin/users`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          try { localStorage.setItem('derby_admin_users', JSON.stringify(data.users)); } catch {}
          return data.users;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch admin users:', e);
    }
    try {
      const cached = localStorage.getItem('derby_admin_users');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  },

  async getAdminUsers(): Promise<User[]> {
    return this.getUsers();
  },

  async getAdminBootstrap(): Promise<{
    stats: any;
    users: User[];
    bets: Bet[];
    deposits: any[];
    withdrawals: any[];
    race_centers: RaceCenter[];
    race_days: RaceDay[];
    system_settings: any;
  } | null> {
    try {
      const res = await fetch(`${API_BASE}/admin/bootstrap`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.users) try { localStorage.setItem('derby_admin_users', JSON.stringify(data.users)); } catch {}
          if (data.stats) try { localStorage.setItem('derby_admin_stats', JSON.stringify(data.stats)); } catch {}
          if (data.bets) try { localStorage.setItem('derby_admin_bets', JSON.stringify(data.bets)); } catch {}
          if (data.race_centers) try { localStorage.setItem('derby_race_centers', JSON.stringify(data.race_centers)); } catch {}
          return data;
        }
      }
    } catch (e) {
      console.warn('Admin bootstrap failed:', e);
    }
    return null;
  },

  async adjustUserBalance(userId: string, amount: number, type: 'CREDIT' | 'DEBIT', description?: string): Promise<{ success: boolean; message: string; user?: User }> {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/adjust-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, type, description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to adjust balance');
    financialSync.broadcast();
    return data;
  },

  async changePassword(user_id: string, current_password: string, new_password: string): Promise<void> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, current_password, new_password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password update failed');
  },

  // ----------------------------------------------------
  // RACE CENTERS (Level 1)
  // ----------------------------------------------------
  async getRaceCenters(all?: boolean): Promise<RaceCenter[]> {
    try {
      const res = await fetch(`${API_BASE}/race-centers${all ? '?all=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.centers) && data.centers.length > 0) {
          localStorage.setItem('derby_race_centers', JSON.stringify(data.centers));
          return data.centers;
        }
      }
    } catch (e) {
      console.warn('API getRaceCenters failed, using fallback:', e);
    }

    try {
      const cached = localStorage.getItem('derby_race_centers');
      if (cached) return JSON.parse(cached);
    } catch {}

    return DEFAULT_RACE_CENTERS;
  },

  async createRaceCenter(data: Partial<RaceCenter>): Promise<{ success: boolean; message: string; center: RaceCenter }> {
    try {
      const res = await fetch(`${API_BASE}/admin/race-centers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to create Race Center');
      return resData;
    } catch (e: any) {
      const newCenter: RaceCenter = {
        id: `cntr_${Date.now()}`,
        name: (data.name || '').toUpperCase().trim(),
        code: (data.code || '').toUpperCase().trim(),
        city: data.city || data.name,
        is_active: data.is_active !== undefined ? data.is_active : true,
        order: DEFAULT_RACE_CENTERS.length + 1,
        created_at: new Date().toISOString(),
      };
      const centers = await this.getRaceCenters(true);
      centers.push(newCenter);
      localStorage.setItem('derby_race_centers', JSON.stringify(centers));
      return { success: true, message: `Race Center "${newCenter.name}" created!`, center: newCenter };
    }
  },

  async updateRaceCenter(id: string, data: Partial<RaceCenter>): Promise<{ success: boolean; message: string; center: RaceCenter }> {
    try {
      const res = await fetch(`${API_BASE}/admin/race-centers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update Race Center');
      return resData;
    } catch (e: any) {
      const centers = await this.getRaceCenters(true);
      const c = centers.find(center => center.id === id);
      if (c) {
        Object.assign(c, data);
        localStorage.setItem('derby_race_centers', JSON.stringify(centers));
        return { success: true, message: `Race Center "${c.name}" updated!`, center: c };
      }
      throw new Error('Race Center not found');
    }
  },

  async deleteRaceCenter(id: string): Promise<{ success: boolean; message: string }> {
    try {
      await fetch(`${API_BASE}/admin/race-centers/${id}`, { method: 'DELETE' });
    } catch {}
    try {
      const cached = localStorage.getItem('derby_race_centers');
      if (cached) {
        const list: RaceCenter[] = JSON.parse(cached);
        const filtered = list.filter((c) => c.id !== id);
        localStorage.setItem('derby_race_centers', JSON.stringify(filtered));
      }
    } catch {}
    return { success: true, message: 'Race center deleted successfully' };
  },

  // ----------------------------------------------------
  // RACE DAYS (Level 2)
  // ----------------------------------------------------
  async getRaceDays(center?: string, date?: string): Promise<RaceDay[]> {
    try {
      const query = new URLSearchParams();
      if (center) query.set('center', center);
      if (date) query.set('date', date);
      const res = await fetch(`${API_BASE}/race-days?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.race_days)) {
          localStorage.setItem('derby_race_days', JSON.stringify(data.race_days));
          return data.race_days;
        }
      }
    } catch (e) {
      console.warn('API getRaceDays failed, using fallback:', e);
    }

    try {
      const cached = localStorage.getItem('derby_race_days');
      if (cached) return JSON.parse(cached);
    } catch {}

    return [];
  },

  async updateRaceDay(id: string, data: Partial<RaceDay>): Promise<{ success: boolean; message: string; race_day: RaceDay }> {
    try {
      const res = await fetch(`${API_BASE}/admin/race-days/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update Race Day');
      return resData;
    } catch (e: any) {
      const days = await this.getRaceDays();
      const d = days.find(day => day.id === id);
      if (d) {
        Object.assign(d, data);
        localStorage.setItem('derby_race_days', JSON.stringify(days));
        return { success: true, message: `Race Day "${d.title}" updated!`, race_day: d };
      }
      throw new Error('Race Day not found');
    }
  },

  async deleteRaceDay(id: string): Promise<{ success: boolean; message: string }> {
    try {
      await fetch(`${API_BASE}/admin/race-days/${id}`, { method: 'DELETE' });
    } catch {}
    try {
      const cached = localStorage.getItem('derby_race_days');
      if (cached) {
        const list: RaceDay[] = JSON.parse(cached);
        const filtered = list.filter((d) => d.id !== id);
        localStorage.setItem('derby_race_days', JSON.stringify(filtered));
      }
    } catch {}
    return { success: true, message: 'Race day deleted successfully' };
  },

  async getRaceDay(center?: string, date?: string): Promise<{ center: RaceCenter; race_day: RaceDay; races: Race[] }> {
    try {
      const query = new URLSearchParams();
      if (center) query.set('center', center);
      if (date) query.set('date', date);
      const res = await fetch(`${API_BASE}/race-day?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.races) {
          return data;
        }
      }
    } catch (e) {
      console.warn('API getRaceDay failed, using fallback:', e);
    }

    const centers = await this.getRaceCenters();
    const targetCenter = centers.find(c => c.name.toLowerCase() === (center || 'bangalore').toLowerCase() || c.id === center) || centers[0];
    const days = await this.getRaceDays(targetCenter.id);
    const targetDay = days.find(d => d.center_id === targetCenter.id) || days[0];
    const allRaces = await this.getRaces('all');
    const filteredRaces = allRaces.filter(r => 
      (targetDay && r.race_day_id === targetDay.id) || 
      (targetCenter && r.center_id === targetCenter.id) ||
      (targetCenter && r.venue.toLowerCase().includes(targetCenter.name.toLowerCase()))
    );

    return {
      center: targetCenter,
      race_day: targetDay,
      races: filteredRaces.length > 0 ? filteredRaces : allRaces.slice(0, 4),
    };
  },

  async createRaceDay(data: Partial<RaceDay>): Promise<{ success: boolean; message: string; race_day: RaceDay }> {
    try {
      const res = await fetch(`${API_BASE}/admin/race-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to create Race Day');
      return resData;
    } catch (e: any) {
      const newDay: RaceDay = {
        id: `day_${Date.now()}`,
        center_id: data.center_id || 'cntr_bangalore',
        center_name: data.center_name || 'BANGALORE',
        race_date: data.race_date || new Date().toISOString().split('T')[0],
        title: data.title || `${data.center_name || 'Center'} - ${data.race_date || 'Today'}`,
        status: data.status || 'PUBLISHED',
        races_count: 0,
        created_at: new Date().toISOString(),
      };
      const days = await this.getRaceDays();
      days.unshift(newDay);
      localStorage.setItem('derby_race_days', JSON.stringify(days));
      return { success: true, message: `Race Day "${newDay.title}" created!`, race_day: newDay };
    }
  },

  async publishRaceDay(id: string): Promise<{ success: boolean; message: string; race_day: RaceDay }> {
    try {
      const res = await fetch(`${API_BASE}/admin/race-days/${id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish race day');
      return data;
    } catch (e: any) {
      const days = await this.getRaceDays();
      const d = days.find(day => day.id === id);
      if (d) {
        d.status = 'PUBLISHED';
        localStorage.setItem('derby_race_days', JSON.stringify(days));
        return { success: true, message: `Race Day "${d.title}" published!`, race_day: d };
      }
      throw new Error('Race day not found');
    }
  },

  // ----------------------------------------------------
  // LEVEL 3 RACE BETTING ACTIVATION (Single Active Race)
  // ----------------------------------------------------
  async openRaceForBetting(raceId: string): Promise<{ success: boolean; message: string; race: Race; races: Race[] }> {
    try {
      const res = await fetch(`${API_BASE}/admin/races/${raceId}/open-betting`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open race for betting');

      if (data.race) {
        this.saveLocalRace(data.race);
      }
      if (data.races && Array.isArray(data.races)) {
        try {
          localStorage.setItem('derby_races', JSON.stringify(data.races));
          localStorage.setItem('derby_custom_races', JSON.stringify(data.races));
        } catch {}
      }

      realtimeOdds.broadcast({
        event: 'RACE_STATUS_CHANGED',
        race_id: raceId,
        race_day_id: data.race?.race_day_id,
        center_id: data.race?.center_id,
        open_race_id: raceId,
        race: data.race,
        timestamp: Date.now(),
      });

      return data;
    } catch (e: any) {
      console.warn('API openRaceForBetting fallback:', e);
      const allRaces = await this.getRaces('all');
      const target = allRaces.find(r => r.id === raceId);
      if (target) {
        allRaces.forEach(r => {
          if (r.venue === target.venue || r.center_id === target.center_id) {
            if (r.id === target.id) {
              r.status = 'OPEN_FOR_BETTING';
              r.is_suspended = false;
              if (r.horses) r.horses.forEach(h => { h.is_suspended = false; });
            } else if (r.status !== 'RESULTED') {
              r.status = 'UPCOMING';
              r.is_suspended = false;
              if (r.horses) r.horses.forEach(h => { h.is_suspended = false; });
            }
          }
        });
        localStorage.setItem('derby_custom_races', JSON.stringify(allRaces));
        realtimeOdds.broadcast({
          event: 'RACE_STATUS_CHANGED',
          race_id: raceId,
          race_day_id: target.race_day_id,
          center_id: target.center_id,
          open_race_id: raceId,
          race: target,
          timestamp: Date.now(),
        });
        return {
          success: true,
          message: `Race #${target.race_no || ''} ${target.name} is now OPEN FOR BETTING!`,
          race: target,
          races: allRaces,
        };
      }
      throw new Error('Race not found');
    }
  },

  // Races
  async getRaces(status?: 'upcoming' | 'open' | 'live' | 'resulted' | 'all'): Promise<Race[]> {
    try {
      const query = status ? `?status=${status}` : '';
      const res = await fetch(`${API_BASE}/races${query}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data.races)) {
            if (status === 'live') {
              return data.races.filter((r: Race) => r.status === 'LIVE');
            } else if (status === 'open') {
              return data.races.filter((r: Race) => r.status === 'OPEN' || r.status === 'UPCOMING' || r.status === 'LIVE');
            } else if (status === 'upcoming') {
              return data.races.filter((r: Race) => r.status === 'UPCOMING' || r.status === 'OPEN' || r.status === 'DRAFT');
            } else if (status === 'resulted') {
              return data.races.filter((r: Race) => r.status === 'RESULTED' || r.status === 'CLOSED');
            }
            return data.races;
          }
        } catch {}
      }
    } catch (e) {
      console.warn('API getRaces failed:', e);
    }
    
    return [];
  },

  async getRace(id: string): Promise<Race> {
    const res = await fetch(`${API_BASE}/races/${id}`);
    if (res.ok) {
      const data = await res.json();
      if (data.race) return data.race;
    }
    throw new Error(`Race with ID "${id}" not found`);
  },

  async getUserByIdentifier(identifier: string): Promise<User | null> {
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(identifier)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.user) return data.user;
      }
    } catch (e) {
      console.warn('Failed to fetch user by identifier:', e);
    }
    return null;
  },

  // Bets
  async placeBet(params: {
    race_id: string;
    horse_id: string;
    bet_type: BetType;
    odds: number;
    stake: number;
    user_id: string;
  }): Promise<{ message: string; bet: Bet; user: User }> {
    let currentUser: User = DUMMY_USER;
    try {
      const saved = localStorage.getItem('derby_user');
      if (saved) currentUser = JSON.parse(saved);
    } catch {}

    try {
      const res = await fetch(`${API_BASE}/bets/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          localStorage.setItem('derby_user', JSON.stringify(data.user));
        }
        financialSync.broadcast();
        realtimeOdds.broadcast({
          event: 'RACE_STATUS_CHANGED',
          race_id: params.race_id,
          timestamp: Date.now(),
        });
        return data;
      }
    } catch {}

    const allRaces = await this.getRaces('all');
    const race = allRaces.find((r) => r.id === params.race_id) || allRaces[0];
    const horse = race?.horses?.find((h) => h.id === params.horse_id) || race?.horses?.[0] || {
      id: params.horse_id,
      horse_no: 1,
      serial_no: 1,
      gate_no: 1,
      name: 'Thoroughbred',
      jockey: 'Jockey',
      trainer: 'Trainer',
    };

    const newBet: Bet = {
      id: `bet_${Date.now()}`,
      user_id: params.user_id,
      username: currentUser.username || 'arjun_punters',
      race_id: race.id,
      race_name: race.name,
      venue: race.venue,
      horse_id: horse.id,
      horse_name: horse.name,
      horse_no: horse.horse_no,
      serial_no: horse.serial_no || horse.horse_no,
      gate_no: horse.gate_no || 1,
      jockey: horse.jockey,
      trainer: horse.trainer,
      bet_type: params.bet_type,
      odds: params.odds,
      stake: params.stake,
      potential_win: Math.round(params.stake * params.odds),
      payout: 0,
      status: 'PENDING',
      placed_at: new Date().toISOString(),
      settled_at: null,
    };

    // Save to local bets
    try {
      const rawBets = localStorage.getItem('derby_custom_bets');
      const betsList: Bet[] = rawBets ? JSON.parse(rawBets) : [];
      betsList.unshift(newBet);
      localStorage.setItem('derby_custom_bets', JSON.stringify(betsList));
    } catch {}

    const updatedUser: User = {
      ...currentUser,
      balance: Math.max(0, (currentUser.balance ?? 5000) - params.stake),
      exposure: (currentUser.exposure ?? 0) + params.stake,
    };
    localStorage.setItem('derby_user', JSON.stringify(updatedUser));

    // Save transaction
    try {
      const rawTx = localStorage.getItem('derby_custom_txs');
      const txs: Transaction[] = rawTx ? JSON.parse(rawTx) : [];
      txs.unshift({
        id: `tx_${Date.now()}`,
        user_id: params.user_id,
        type: 'BET',
        amount: -params.stake,
        balance_after: updatedUser.balance,
        description: `Bet placed on #${horse.horse_no} ${horse.name} (${params.bet_type} @ ${params.odds}x)`,
        created_at: new Date().toISOString(),
        reference_id: newBet.id,
      });
      localStorage.setItem('derby_custom_txs', JSON.stringify(txs));
    } catch {}

    return {
      message: 'Bet placed successfully!',
      bet: newBet,
      user: updatedUser,
    };
  },

  async getMyBets(userId: string): Promise<Bet[]> {
    let localBets: Bet[] = [];
    try {
      const raw = localStorage.getItem('derby_custom_bets');
      if (raw) {
        const allBets: Bet[] = JSON.parse(raw);
        localBets = allBets.filter((b) => b.user_id === userId);
      }
    } catch {}

    try {
      const res = await fetch(`${API_BASE}/bets/my?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.bets)) {
          return [...localBets, ...data.bets.filter((db: Bet) => !localBets.some((lb) => lb.id === db.id))];
        }
      }
    } catch {}
    return localBets;
  },

  // ----------------------------------------------------------------------
  // NOTIFICATIONS ENGINE
  // ----------------------------------------------------------------------
  async getNotifications(userId: string): Promise<UserNotification[]> {
    try {
      const res = await fetch(`${API_BASE}/notifications?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notifications) && data.notifications.length > 0) {
          localStorage.setItem('derby_user_notifications', JSON.stringify(data.notifications));
          return data.notifications;
        }
      }
    } catch {}

    let localNotes: UserNotification[] = [];
    try {
      const raw = localStorage.getItem('derby_user_notifications');
      if (raw) localNotes = JSON.parse(raw);
    } catch {}

    const userSpecificNotes = localNotes.filter(
      (n) => n.user_id === userId || !n.user_id || n.user_id === 'all'
    );

    if (userSpecificNotes.length === 0) {
      const welcomeNotes: UserNotification[] = [
        {
          id: `notif_welcome_${userId}_bonus`,
          user_id: userId,
          type: 'DEPOSIT_APPROVED',
          title: '🎉 Welcome to DerbyBet Turf!',
          message: 'Welcome aboard! ₹50 complimentary sign-up bonus has been credited to your wallet balance. Start exploring live fixtures & placing selections!',
          amount: 50,
          is_read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: `notif_welcome_${userId}_guide`,
          user_id: userId,
          type: 'GENERAL',
          title: '🏇 Live Turf Fixtures & Decimal Odds',
          message: 'Explore live and upcoming races, view jockeys & win/place odds, and track your instant settlements and statements in real-time.',
          is_read: false,
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
      ];

      localNotes = [...welcomeNotes, ...localNotes];
      try {
        localStorage.setItem('derby_user_notifications', JSON.stringify(localNotes));
      } catch {}

      return welcomeNotes;
    }

    return userSpecificNotes;
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      fetch(`${API_BASE}/notifications/${notificationId}/read`, { method: 'PUT' }).catch(() => {});
      const raw = localStorage.getItem('derby_user_notifications');
      if (raw) {
        const list: UserNotification[] = JSON.parse(raw);
        const item = list.find((n) => n.id === notificationId);
        if (item) item.is_read = true;
        localStorage.setItem('derby_user_notifications', JSON.stringify(list));
      }
    } catch {}
  },

  async markAllNotificationsRead(userId: string): Promise<void> {
    try {
      fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      }).catch(() => {});
      const raw = localStorage.getItem('derby_user_notifications');
      if (raw) {
        const list: UserNotification[] = JSON.parse(raw);
        for (const item of list) {
          if (item.user_id === userId || !item.user_id || item.user_id === 'all') {
            item.is_read = true;
          }
        }
        localStorage.setItem('derby_user_notifications', JSON.stringify(list));
      }
    } catch {}
  },

  async sendNotification(notifData: Omit<UserNotification, 'id' | 'created_at' | 'is_read'>): Promise<UserNotification> {
    const newNotif: UserNotification = {
      ...notifData,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    try {
      fetch(`${API_BASE}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNotif),
      }).catch(() => {});

      const raw = localStorage.getItem('derby_user_notifications');
      const list: UserNotification[] = raw ? JSON.parse(raw) : [];
      list.unshift(newNotif);
      localStorage.setItem('derby_user_notifications', JSON.stringify(list));
      financialSync.broadcast();
    } catch {}

    return newNotif;
  },

  // ----------------------------------------------------------------------
  // DEPOSIT REQUESTS (USER SUBMISSION & ADMIN APPROVAL)
  // ----------------------------------------------------------------------
  async submitDepositRequest(params: {
    userId: string;
    amount: number;
    payment_method?: string;
    paymentMethod?: string;
    utr_number?: string;
    utrNumber?: string;
    screenshot_url?: string;
    screenshotUrl?: string;
  }): Promise<{ depositRequest: DepositRequest; message: string }> {
    let currentUser: Partial<User> = {};
    try {
      const saved = localStorage.getItem('derby_user');
      if (saved) currentUser = JSON.parse(saved);
    } catch {}

    const method = params.payment_method || params.paymentMethod || 'UPI';
    const utr = params.utr_number || params.utrNumber || `UTR${Date.now().toString().slice(-6)}`;
    const proofUrl = params.screenshot_url || params.screenshotUrl;

    const newRequest: DepositRequest = {
      id: `dep_${Date.now()}`,
      user_id: params.userId,
      username: currentUser?.username || 'user',
      amount: params.amount,
      payment_method: method,
      utr_number: utr,
      screenshot_url: proofUrl,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      reviewed_at: null,
    };

    try {
      const res = await fetch(`${API_BASE}/deposits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: params.userId,
          amount: params.amount,
          paymentMethod: method,
          utrNumber: utr,
          screenshotUrl: proofUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.depositRequest) {
          this.saveLocalDepositRequest(data.depositRequest);
          return data;
        }
      }
    } catch (e) {
      console.warn('Backend deposit request fallback to local:', e);
    }

    this.saveLocalDepositRequest(newRequest);

    return {
      depositRequest: newRequest,
      message: `Deposit request of ₹${params.amount.toLocaleString('en-IN')} submitted! Status is PENDING verification by Admin.`,
    };
  },

  saveLocalDepositRequest(dep: DepositRequest) {
    try {
      const raw = localStorage.getItem('derby_deposit_requests');
      const list: DepositRequest[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((d) => d.id === dep.id);
      if (idx >= 0) {
        list[idx] = dep;
      } else {
        list.unshift(dep);
      }
      localStorage.setItem('derby_deposit_requests', JSON.stringify(list));
      financialSync.broadcast();
    } catch {}
  },

  logout(): void {
    try {
      localStorage.removeItem('derby_token');
      localStorage.removeItem('derby_user');
    } catch {}
  },

  // Alias for backward compatibility
  async deposit(userId: string, amount: number, payment_method: string, utr_number?: string, screenshot_url?: string): Promise<{ user: User; message: string }> {
    const res = await this.submitDepositRequest({
      userId,
      amount,
      payment_method,
      utr_number: utr_number || `UTR${Date.now().toString().slice(-6)}`,
      screenshot_url,
    });

    let currentUser: Partial<User> = {};
    try {
      const saved = localStorage.getItem('derby_user');
      if (saved) currentUser = JSON.parse(saved);
    } catch {}

    return {
      user: currentUser as User,
      message: res.message,
    };
  },

  async getDepositRequests(status?: DepositStatus | 'ALL', userId?: string): Promise<DepositRequest[]> {
    let list: DepositRequest[] = [];
    try {
      const raw = localStorage.getItem('derby_deposit_requests');
      if (raw) list = JSON.parse(raw);
    } catch {}

    try {
      const query = new URLSearchParams();
      if (status && status !== 'ALL') query.set('status', status);
      if (userId) query.set('user_id', userId);
      const res = await fetch(`${API_BASE}/deposits?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.deposits)) {
          // Merge with local deposits
          const remoteMap = new Map(data.deposits.map((d: DepositRequest) => [d.id, d]));
          for (const ld of list) {
            if (!remoteMap.has(ld.id)) {
              data.deposits.unshift(ld);
            }
          }
          localStorage.setItem('derby_deposit_requests', JSON.stringify(data.deposits));
          list = data.deposits;
        }
      }
    } catch (e) {
      console.warn('Backend getDepositRequests fallback:', e);
    }

    let filtered = list.filter(
      (r) =>
        r &&
        r.user_id !== 'usr_arjun' &&
        r.user_id !== 'usr_rahul' &&
        r.username !== 'arjun_punters' &&
        r.username !== 'rahul_derby'
    );
    if (userId) {
      filtered = filtered.filter((r) => r.user_id === userId);
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((r) => r.status === status);
    }
    return filtered;
  },

  async approveDepositRequest(depositId: string, adminNotes?: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const res = await fetch(`${API_BASE}/admin/deposits/${depositId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.depositRequest) {
          this.saveLocalDepositRequest(data.depositRequest);
        }
        if (data.user) {
          try {
            const saved = localStorage.getItem('derby_user');
            if (saved) {
              const cur = JSON.parse(saved);
              if (cur.id === data.user.id) {
                localStorage.setItem('derby_user', JSON.stringify(data.user));
              }
            }
          } catch {}
        }
        financialSync.broadcast();
        return data;
      }
    } catch (e) {
      console.warn('Backend approveDepositRequest fallback:', e);
    }

    let list: DepositRequest[] = [];
    try {
      const raw = localStorage.getItem('derby_deposit_requests');
      if (raw) list = JSON.parse(raw);
    } catch {}

    const req = list.find((d) => d.id === depositId);
    if (!req) throw new Error('Deposit request not found');

    if (req.status === 'APPROVED') {
      return { success: true, message: 'Deposit request is already approved' };
    }

    req.status = 'APPROVED';
    req.reviewed_at = new Date().toISOString();
    if (adminNotes) req.admin_notes = adminNotes;

    // Automatically credit user balance
    let userToCredit: User = DUMMY_USER;
    try {
      const savedUser = localStorage.getItem('derby_user');
      if (savedUser) userToCredit = JSON.parse(savedUser);
    } catch {}

    userToCredit.balance = (userToCredit.balance ?? 0) + req.amount;

    // Save user & deposit requests
    try {
      localStorage.setItem('derby_deposit_requests', JSON.stringify(list));
      localStorage.setItem('derby_user', JSON.stringify(userToCredit));
    } catch {}

    // Add statement transaction
    try {
      const rawTxs = localStorage.getItem('derby_custom_txs');
      const txs: Transaction[] = rawTxs ? JSON.parse(rawTxs) : [];
      txs.unshift({
        id: `tx_${Date.now()}_dep`,
        user_id: req.user_id,
        type: 'DEPOSIT',
        amount: req.amount,
        balance_after: userToCredit.balance,
        description: `Deposit Approved via ${req.payment_method} (UTR: ${req.utr_number})`,
        created_at: new Date().toISOString(),
        reference_id: req.id,
      });
      localStorage.setItem('derby_custom_txs', JSON.stringify(txs));
    } catch {}

    // Send notification to user
    await this.sendNotification({
      user_id: req.user_id,
      type: 'DEPOSIT_APPROVED',
      title: 'Deposit Approved & Credited! 🎉',
      message: `Your deposit of ₹${req.amount.toLocaleString('en-IN')} (UTR: ${req.utr_number}) was approved. ₹${req.amount.toLocaleString('en-IN')} has been added to your wallet.`,
      amount: req.amount,
      reference_id: req.id,
    });

    financialSync.broadcast();

    return {
      success: true,
      message: `Deposit of ₹${req.amount.toLocaleString('en-IN')} approved! Balance credited automatically.`,
      user: userToCredit,
    };
  },

  async rejectDepositRequest(depositId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_BASE}/admin/deposits/${depositId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.depositRequest) {
          this.saveLocalDepositRequest(data.depositRequest);
        }
        financialSync.broadcast();
        return data;
      }
    } catch (e) {
      console.warn('Backend rejectDepositRequest fallback:', e);
    }

    let list: DepositRequest[] = [];
    try {
      const raw = localStorage.getItem('derby_deposit_requests');
      if (raw) list = JSON.parse(raw);
    } catch {}

    const req = list.find((d) => d.id === depositId);
    if (!req) throw new Error('Deposit request not found');

    req.status = 'REJECTED';
    req.reviewed_at = new Date().toISOString();
    req.admin_notes = reason || 'UTR or proof could not be verified by Admin.';

    try {
      localStorage.setItem('derby_deposit_requests', JSON.stringify(list));
    } catch {}

    // Send notification
    await this.sendNotification({
      user_id: req.user_id,
      type: 'DEPOSIT_REJECTED',
      title: 'Deposit Request Rejected ❌',
      message: `Your deposit of ₹${req.amount.toLocaleString('en-IN')} (UTR: ${req.utr_number}) could not be verified: ${req.admin_notes}`,
      amount: req.amount,
      reference_id: req.id,
    });

    return {
      success: true,
      message: `Deposit request rejected. Notification dispatched to user.`,
    };
  },

  // ----------------------------------------------------------------------
  // WITHDRAWAL REQUESTS (USER SUBMISSION, 120-MIN TIMER & 3-STAGE STATUS)
  // ----------------------------------------------------------------------
  async submitWithdrawalRequest(params: {
    userId: string;
    amount: number;
    details: {
      upi_id?: string;
      bank_account?: string;
      ifsc?: string;
      account_holder?: string;
    };
  }): Promise<{ withdrawalRequest: WithdrawalRequest; user: User; message: string }> {
    let currentUser: User = DUMMY_USER;
    try {
      const saved = localStorage.getItem('derby_user');
      if (saved) currentUser = JSON.parse(saved);
    } catch {}

    // Check withdrawable balance
    const withdrawable = (currentUser.balance ?? 0) - (currentUser.exposure ?? 0);
    if (withdrawable < params.amount) {
      throw new Error(`Insufficient withdrawable balance. Available to withdraw: ₹${Math.max(0, withdrawable).toLocaleString('en-IN')}`);
    }

    try {
      const res = await fetch(`${API_BASE}/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.withdrawalRequest) {
          this.saveLocalWithdrawalRequest(data.withdrawalRequest);
        }
        if (data.user) {
          localStorage.setItem('derby_user', JSON.stringify(data.user));
        }
        return data;
      }
    } catch (e) {
      console.warn('Backend submitWithdrawalRequest fallback:', e);
    }

    // Deduct from balance immediately to lock amount
    currentUser.balance = Math.max(0, (currentUser.balance ?? 0) - params.amount);
    localStorage.setItem('derby_user', JSON.stringify(currentUser));

    const newRequest: WithdrawalRequest = {
      id: `wth_${Date.now()}`,
      user_id: params.userId,
      username: currentUser.username || 'arjun_punters',
      amount: params.amount,
      upi_id: params.details.upi_id,
      bank_account: params.details.bank_account,
      ifsc: params.details.ifsc,
      account_holder: params.details.account_holder,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      approved_at: null,
      completed_at: null,
      estimated_minutes: 120,
    };

    this.saveLocalWithdrawalRequest(newRequest);

    // Log pending transaction in statement
    try {
      const rawTx = localStorage.getItem('derby_custom_txs');
      const txs: Transaction[] = rawTx ? JSON.parse(rawTx) : [];
      txs.unshift({
        id: `tx_${Date.now()}_wth`,
        user_id: params.userId,
        type: 'WITHDRAW',
        amount: -params.amount,
        balance_after: currentUser.balance,
        description: `Withdrawal Request (Pending Verification) to ${params.details.upi_id || params.details.bank_account || 'Registered Bank'}`,
        created_at: new Date().toISOString(),
        reference_id: newRequest.id,
      });
      localStorage.setItem('derby_custom_txs', JSON.stringify(txs));
    } catch {}

    return {
      withdrawalRequest: newRequest,
      user: currentUser,
      message: `Withdrawal request of ₹${params.amount.toLocaleString('en-IN')} submitted! Status: PENDING Admin review.`,
    };
  },

  saveLocalWithdrawalRequest(wth: WithdrawalRequest) {
    try {
      const raw = localStorage.getItem('derby_withdrawal_requests');
      const list: WithdrawalRequest[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((w) => w.id === wth.id);
      if (idx >= 0) {
        list[idx] = wth;
      } else {
        list.unshift(wth);
      }
      localStorage.setItem('derby_withdrawal_requests', JSON.stringify(list));
      financialSync.broadcast();
    } catch {}
  },

  // Backward compatibility alias
  async withdraw(userId: string, amount: number, details: { upi_id?: string; bank_account?: string; ifsc?: string; account_holder?: string }): Promise<{ user: User; message: string }> {
    const res = await this.submitWithdrawalRequest({
      userId,
      amount,
      details,
    });
    return {
      user: res.user,
      message: res.message,
    };
  },

  async getWithdrawalRequests(status?: WithdrawalStatus | 'ALL', userId?: string): Promise<WithdrawalRequest[]> {
    let list: WithdrawalRequest[] = [];
    try {
      const raw = localStorage.getItem('derby_withdrawal_requests');
      if (raw) list = JSON.parse(raw);
    } catch {}

    try {
      const query = new URLSearchParams();
      if (status && status !== 'ALL') query.set('status', status);
      if (userId) query.set('user_id', userId);
      const res = await fetch(`${API_BASE}/withdrawals?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.withdrawals)) {
          const remoteMap = new Map(data.withdrawals.map((w: WithdrawalRequest) => [w.id, w]));
          for (const lw of list) {
            if (!remoteMap.has(lw.id)) {
              data.withdrawals.unshift(lw);
            }
          }
          localStorage.setItem('derby_withdrawal_requests', JSON.stringify(data.withdrawals));
          list = data.withdrawals;
        }
      }
    } catch (e) {
      console.warn('Backend getWithdrawalRequests fallback:', e);
    }

    let filtered = list.filter(
      (w) =>
        w &&
        w.user_id !== 'usr_arjun' &&
        w.user_id !== 'usr_rahul' &&
        w.username !== 'arjun_punters' &&
        w.username !== 'rahul_derby'
    );
    if (userId) {
      filtered = filtered.filter((w) => w.user_id === userId);
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((w) => w.status === status);
    }
    return filtered;
  },

  async approveWithdrawalToInProgress(withdrawalId: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawals/${withdrawalId}/approve`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.withdrawalRequest) {
          this.saveLocalWithdrawalRequest(data.withdrawalRequest);
        }
        financialSync.broadcast();
        return data;
      }
    } catch (e) {
      console.warn('Backend approveWithdrawal fallback:', e);
    }

    let list: WithdrawalRequest[] = [];
    try {
      const raw = localStorage.getItem('derby_withdrawal_requests');
      if (raw) list = JSON.parse(raw);
    } catch {}

    const req = list.find((w) => w.id === withdrawalId);
    if (!req) throw new Error('Withdrawal request not found');

    req.status = 'IN_PROGRESS';
    req.approved_at = new Date().toISOString();
    req.estimated_minutes = 120;

    try {
      localStorage.setItem('derby_withdrawal_requests', JSON.stringify(list));
    } catch {}

    // Send notification
    await this.sendNotification({
      user_id: req.user_id,
      type: 'WITHDRAWAL_IN_PROGRESS',
      title: 'Withdrawal Approved & In Progress ⏳',
      message: `Your withdrawal of ₹${req.amount.toLocaleString('en-IN')} has been approved and is now IN PROGRESS. Estimated completion: 120 minutes from request time.`,
      amount: req.amount,
      reference_id: req.id,
    });

    financialSync.broadcast();

    return {
      success: true,
      message: `Withdrawal of ₹${req.amount.toLocaleString('en-IN')} marked as IN PROGRESS. 120-minute timer started.`,
    };
  },

  async completeWithdrawalToSuccessful(withdrawalId: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawals/${withdrawalId}/complete`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.withdrawalRequest) {
          this.saveLocalWithdrawalRequest(data.withdrawalRequest);
        }
        financialSync.broadcast();
        return data;
      }
    } catch (e) {
      console.warn('Backend completeWithdrawal fallback:', e);
    }

    let list: WithdrawalRequest[] = [];
    try {
      const raw = localStorage.getItem('derby_withdrawal_requests');
      if (raw) list = JSON.parse(raw);
    } catch {}

    const req = list.find((w) => w.id === withdrawalId);
    if (!req) throw new Error('Withdrawal request not found');

    req.status = 'SUCCESSFUL';
    req.completed_at = new Date().toISOString();

    try {
      localStorage.setItem('derby_withdrawal_requests', JSON.stringify(list));
    } catch {}

    // Send notification
    await this.sendNotification({
      user_id: req.user_id,
      type: 'WITHDRAWAL_SUCCESSFUL',
      title: 'Withdrawal Successful! ✅',
      message: `₹${req.amount.toLocaleString('en-IN')} has been successfully transferred to your registered account (${req.upi_id || req.bank_account || 'Bank'}).`,
      amount: req.amount,
      reference_id: req.id,
    });

    financialSync.broadcast();

    return {
      success: true,
      message: `Withdrawal of ₹${req.amount.toLocaleString('en-IN')} marked as SUCCESSFUL / TRANSFERRED!`,
    };
  },

  async rejectWithdrawalRequest(withdrawalId: string, reason?: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawals/${withdrawalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.withdrawalRequest) {
          this.saveLocalWithdrawalRequest(data.withdrawalRequest);
        }
        if (data.user) {
          try {
            const saved = localStorage.getItem('derby_user');
            if (saved) {
              const cur = JSON.parse(saved);
              if (cur.id === data.user.id) {
                localStorage.setItem('derby_user', JSON.stringify(data.user));
              }
            }
          } catch {}
        }
        financialSync.broadcast();
        return data;
      }
    } catch (e) {
      console.warn('Backend rejectWithdrawal fallback:', e);
    }

    let list: WithdrawalRequest[] = [];
    try {
      const raw = localStorage.getItem('derby_withdrawal_requests');
      if (raw) list = JSON.parse(raw);
    } catch {}

    const req = list.find((w) => w.id === withdrawalId);
    if (!req) throw new Error('Withdrawal request not found');

    req.status = 'REJECTED';
    req.admin_notes = reason || 'Rejected by Admin. Amount refunded back to wallet.';

    // Refund amount back to user wallet
    let currentUser: User = DUMMY_USER;
    try {
      const savedUser = localStorage.getItem('derby_user');
      if (savedUser) currentUser = JSON.parse(savedUser);
    } catch {}

    currentUser.balance = (currentUser.balance ?? 0) + req.amount;

    try {
      localStorage.setItem('derby_withdrawal_requests', JSON.stringify(list));
      localStorage.setItem('derby_user', JSON.stringify(currentUser));
    } catch {}

    // Add refund transaction to statement
    try {
      const rawTx = localStorage.getItem('derby_custom_txs');
      const txs: Transaction[] = rawTx ? JSON.parse(rawTx) : [];
      txs.unshift({
        id: `tx_${Date.now()}_ref`,
        user_id: req.user_id,
        type: 'REFUND',
        amount: req.amount,
        balance_after: currentUser.balance,
        description: `Refund for Rejected Withdrawal: ${req.admin_notes}`,
        created_at: new Date().toISOString(),
        reference_id: req.id,
      });
      localStorage.setItem('derby_custom_txs', JSON.stringify(txs));
    } catch {}

    // Send notification
    await this.sendNotification({
      user_id: req.user_id,
      type: 'WITHDRAWAL_REJECTED',
      title: 'Withdrawal Rejected & Refunded ❌',
      message: `Your withdrawal of ₹${req.amount.toLocaleString('en-IN')} was rejected (${req.admin_notes}). ₹${req.amount.toLocaleString('en-IN')} was refunded to your wallet.`,
      amount: req.amount,
      reference_id: req.id,
    });

    return {
      success: true,
      message: `Withdrawal rejected and ₹${req.amount.toLocaleString('en-IN')} refunded to user wallet.`,
      user: currentUser,
    };
  },

  async getTransactions(userId: string): Promise<Transaction[]> {
    let localTxs: Transaction[] = [];
    try {
      const raw = localStorage.getItem('derby_custom_txs');
      if (raw) localTxs = JSON.parse(raw);
    } catch {}

    try {
      const res = await fetch(`${API_BASE}/wallet/transactions?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.transactions) && data.transactions.length > 0) {
          return [...localTxs, ...data.transactions.filter((t: Transaction) => !localTxs.some((lt) => lt.id === t.id))];
        }
      }
    } catch {}

    if (localTxs.length > 0) return localTxs;

    return [];
  },

  // Banners
  async getBanners(): Promise<Banner[]> {
    let customBanners: Banner[] = [];
    try {
      const raw = localStorage.getItem('derby_custom_banners');
      if (raw) customBanners = JSON.parse(raw);
    } catch {}

    try {
      const res = await fetch(`${API_BASE}/banners`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.banners) && data.banners.length > 0) {
          return [...customBanners, ...data.banners.filter((b: Banner) => !customBanners.some((cb) => cb.id === b.id))];
        }
      }
    } catch {}
    return [...customBanners, ...DUMMY_BANNERS];
  },

  async createBanner(banner: Partial<Banner>): Promise<Banner> {
    const newBanner: Banner = {
      id: `bnr_${Date.now()}`,
      title: banner.title || 'Special Promotion',
      subtitle: banner.subtitle || 'Place bets on upcoming racing fixtures',
      image_url: banner.image_url || '/images/race_action.jpg',
      link: banner.link || '#/',
      tag: banner.tag || 'SPECIAL',
      is_active: true,
    };

    try {
      const res = await fetch(`${API_BASE}/banners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(banner),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.banner) return data.banner;
      }
    } catch {}

    try {
      const raw = localStorage.getItem('derby_custom_banners');
      const list: Banner[] = raw ? JSON.parse(raw) : [];
      list.unshift(newBanner);
      localStorage.setItem('derby_custom_banners', JSON.stringify(list));
    } catch {}

    return newBanner;
  },

  async deleteBanner(id: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/banners/${id}`, { method: 'DELETE' });
    } catch {}
    try {
      const raw = localStorage.getItem('derby_custom_banners');
      if (raw) {
        const list: Banner[] = JSON.parse(raw);
        localStorage.setItem('derby_custom_banners', JSON.stringify(list.filter((b) => b.id !== id)));
      }
    } catch {}
  },

  // Admin
  async getAdminOverview(): Promise<{
    totalUsers: number;
    totalBets: number;
    totalVolume: number;
    openRaces: number;
    pendingBetsCount: number;
  }> {
    try {
      const res = await fetch(`${API_BASE}/admin/overview`);
      if (res.ok) {
        const data = await res.json();
        if (data.stats) return data.stats;
      }
    } catch {}

    const [users, races, bets] = await Promise.all([
      this.getUsers().catch(() => []),
      this.getRaces('all').catch(() => []),
      this.getAllBets().catch(() => []),
    ]);

    const realUsers = (users || []).filter((u) => u.role !== 'admin');
    const realVolume = (bets || []).reduce((s, b) => s + (b.stake || 0), 0);
    const pendingBets = (bets || []).filter((b) => b.status === 'PENDING');

    return {
      totalUsers: realUsers.length,
      totalBets: (bets || []).length,
      totalVolume: realVolume,
      openRaces: (races || []).filter((r) => r.status === 'OPEN' || r.status === 'LIVE' || r.status === 'OPEN_FOR_BETTING').length,
      pendingBetsCount: pendingBets.length,
    };
  },

  async createRace(raceData: any): Promise<Race> {
    const raceId = raceData.id || `race_custom_${Date.now()}`;
    const parsedHorses = (raceData.horses || []).map((h: any, index: number) => {
      const sNo = Number(h.serial_no || h.horse_no) || index + 1;
      const gNo = h.gate_no !== undefined && h.gate_no !== '' ? (isNaN(Number(h.gate_no)) ? h.gate_no : Number(h.gate_no)) : (index + 1);
      return {
        id: h.id || `hrs_${raceId}_${index + 1}`,
        race_id: raceId,
        horse_no: sNo,
        serial_no: sNo,
        gate_no: gNo,
        name: String(h.name || `Horse ${sNo}`).trim(),
        jockey: String(h.jockey || 'Jockey TBD').trim(),
        trainer: String(h.trainer || 'Trainer TBD').trim(),
        win_odds: Math.max(1.01, Number(h.win_odds) || 2.5),
        place_odds: Math.max(1.01, Number(h.place_odds) || 1.4),
        silk_color: h.silk_color || ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#e11d48'][index % 7],
        form: h.form || '1-1-2-1',
        weight: h.weight || '56.0 kg',
      };
    });

    const newRace: Race = {
      id: raceId,
      name: String(raceData.name).trim(),
      race_no: raceData.race_no ? Number(raceData.race_no) : undefined,
      center_id: raceData.center_id,
      race_day_id: raceData.race_day_id,
      venue: String(raceData.venue || 'Mysore Turf Club').trim(),
      race_time: String(raceData.race_time || '2:00 PM').trim(),
      date_str: String(raceData.date_str || 'Today, 5th Sep').trim(),
      distance: String(raceData.distance || '1400m').trim(),
      going: raceData.going ? String(raceData.going).trim() : undefined,
      class_grade: String(raceData.class_grade || 'Grade 1 • Terms').trim(),
      status: raceData.status || 'OPEN',
      image_url: raceData.image_url || '/images/race_action.jpg',
      winner_horse_id: null,
      place_horses_ids: [],
      horses: parsedHorses,
      settled_at: null,
    };

    try {
      const res = await fetch(`${API_BASE}/admin/races`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...raceData,
          id: raceId,
          center_id: raceData.center_id,
          race_day_id: raceData.race_day_id,
          venue: newRace.venue,
          race_time: newRace.race_time,
          distance: newRace.distance,
        }),
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data.race) {
            this.saveLocalRace(data.race);
            return data.race;
          }
        } catch {}
      }
    } catch (e) {
      console.warn('API createRace network notice:', e);
    }

    this.saveLocalRace(newRace);
    return newRace;
  },

  saveLocalRace(race: Race) {
    try {
      for (const key of ['derby_races', 'derby_custom_races']) {
        const raw = localStorage.getItem(key);
        const list: Race[] = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex((r) => r.id === race.id);
        if (idx >= 0) {
          list[idx] = race;
        } else {
          list.unshift(race);
        }
        localStorage.setItem(key, JSON.stringify(list));
      }
    } catch {}
  },

  async updateRace(raceId: string, raceData: any): Promise<Race> {
    try {
      const res = await fetch(`${API_BASE}/admin/races/${raceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(raceData),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.race) {
          this.saveLocalRace(data.race);
          realtimeOdds.broadcast({
            event: 'ODDS_UPDATED',
            race_id: data.race.id,
            race: data.race,
            timestamp: Date.now(),
          });
          return data.race;
        }
      }
    } catch {}

    const allRaces = await this.getRaces('all');
    const existing = allRaces.find((r) => r.id === raceId) || allRaces[0];
    const updatedRace: Race = {
      ...existing,
      ...raceData,
      horses: raceData.horses || existing.horses,
    };
    this.saveLocalRace(updatedRace);
    realtimeOdds.broadcast({
      event: 'ODDS_UPDATED',
      race_id: updatedRace.id,
      race: updatedRace,
      timestamp: Date.now(),
    });
    return updatedRace;
  },

  async deleteRace(raceId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/admin/races/${raceId}`, {
        method: 'DELETE',
      });
    } catch {}

    try {
      const raw = localStorage.getItem('derby_custom_races');
      if (raw) {
        const list: Race[] = JSON.parse(raw);
        localStorage.setItem('derby_custom_races', JSON.stringify(list.filter((r) => r.id !== raceId)));
      }
    } catch {}
  },

  async updateRaceStatus(raceId: string, status: RaceStatus): Promise<Race> {
    try {
      const res = await fetch(`${API_BASE}/admin/races/${raceId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.race) {
          this.saveLocalRace(data.race);
          realtimeOdds.broadcast({
            event: 'RACE_STATUS_CHANGED',
            race_id: data.race.id,
            race: data.race,
            timestamp: Date.now(),
          });
          return data.race;
        }
      }
    } catch {}

    const allRaces = await this.getRaces('all');
    const race = allRaces.find((r) => r.id === raceId) || allRaces[0];
    const updated = { ...race, status };
    this.saveLocalRace(updated);
    realtimeOdds.broadcast({
      event: 'RACE_STATUS_CHANGED',
      race_id: updated.id,
      race: updated,
      timestamp: Date.now(),
    });
    return updated;
  },

  async publishRace(raceId: string): Promise<Race> {
    return this.updateRaceStatus(raceId, 'LIVE');
  },

  async updateHorseOdds(horseId: string, winOdds: number, placeOdds: number): Promise<{ success: boolean; horse?: Horse; race?: Race }> {
    try {
      const res = await fetch(`${API_BASE}/admin/horses/${horseId}/odds`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ win_odds: winOdds, place_odds: placeOdds }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.race) {
          this.saveLocalRace(data.race);
          realtimeOdds.broadcast({
            event: 'ODDS_UPDATED',
            race_id: data.race.id,
            race: data.race,
            timestamp: Date.now(),
          });
        }
        return data;
      }
    } catch {}

    const allRaces = await this.getRaces('all');
    for (const r of allRaces) {
      const h = r.horses.find(item => item.id === horseId);
      if (h) {
        h.win_odds = winOdds;
        h.place_odds = placeOdds;
        this.saveLocalRace(r);
        realtimeOdds.broadcast({
          event: 'ODDS_UPDATED',
          race_id: r.id,
          race: r,
          timestamp: Date.now(),
        });
        return { success: true, horse: h, race: r };
      }
    }
    return { success: true };
  },

  async suspendHorse(raceId: string, horseId: string): Promise<{ success: boolean; race?: Race; horse?: Horse }> {
    try {
      const res = await fetch(`${API_BASE}/admin/races/${raceId}/horses/${horseId}/suspend`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.race) {
          this.saveLocalRace(data.race);
          realtimeOdds.broadcast({
            event: 'ODDS_UPDATED',
            race_id: data.race.id,
            race: data.race,
            timestamp: Date.now(),
          });
        }
        return data;
      }
    } catch {}

    const allRaces = await this.getRaces('all');
    const race = allRaces.find(r => r.id === raceId);
    if (race) {
      const horse = race.horses.find(h => h.id === horseId);
      if (horse) horse.is_suspended = true;
      this.saveLocalRace(race);
      realtimeOdds.broadcast({
        event: 'ODDS_UPDATED',
        race_id: race.id,
        race: race,
        timestamp: Date.now(),
      });
      return { success: true, race, horse };
    }
    return { success: true };
  },

  async resumeHorse(raceId: string, horseId: string, winOdds?: number, placeOdds?: number): Promise<{ success: boolean; race?: Race; horse?: Horse }> {
    try {
      const res = await fetch(`${API_BASE}/admin/races/${raceId}/horses/${horseId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ win_odds: winOdds, place_odds: placeOdds }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.race) {
          this.saveLocalRace(data.race);
          realtimeOdds.broadcast({
            event: 'ODDS_UPDATED',
            race_id: data.race.id,
            race: data.race,
            timestamp: Date.now(),
          });
        }
        return data;
      }
    } catch {}

    const allRaces = await this.getRaces('all');
    const race = allRaces.find(r => r.id === raceId);
    if (race) {
      const horse = race.horses.find(h => h.id === horseId);
      if (horse) {
        horse.is_suspended = false;
        if (winOdds !== undefined && !isNaN(winOdds) && winOdds > 0) horse.win_odds = winOdds;
        if (placeOdds !== undefined && !isNaN(placeOdds) && placeOdds > 0) horse.place_odds = placeOdds;
      }
      this.saveLocalRace(race);
      realtimeOdds.broadcast({
        event: 'ODDS_UPDATED',
        race_id: race.id,
        race: race,
        timestamp: Date.now(),
      });
      return { success: true, race, horse };
    }
    return { success: true };
  },

  async suspendAll(raceId: string): Promise<{ success: boolean; race?: Race }> {
    try {
      const res = await fetch(`${API_BASE}/admin/races/${raceId}/suspend`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.race) {
          this.saveLocalRace(data.race);
          realtimeOdds.broadcast({
            event: 'ODDS_UPDATED',
            race_id: data.race.id,
            race: data.race,
            timestamp: Date.now(),
          });
        }
        return data;
      }
    } catch {}

    const allRaces = await this.getRaces('all');
    const race = allRaces.find(r => r.id === raceId);
    if (race) {
      race.is_suspended = true;
      race.horses.forEach(h => { h.is_suspended = true; });
      this.saveLocalRace(race);
      realtimeOdds.broadcast({
        event: 'ODDS_UPDATED',
        race_id: race.id,
        race: race,
        timestamp: Date.now(),
      });
      return { success: true, race };
    }
    return { success: true };
  },

  async resumeAll(raceId: string, oddsMap?: Record<string, { win_odds?: number; place_odds?: number }>): Promise<{ success: boolean; race?: Race }> {
    try {
      const res = await fetch(`${API_BASE}/admin/races/${raceId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oddsMap }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.race) {
          this.saveLocalRace(data.race);
          realtimeOdds.broadcast({
            event: 'ODDS_UPDATED',
            race_id: data.race.id,
            race: data.race,
            timestamp: Date.now(),
          });
        }
        return data;
      }
    } catch {}

    const allRaces = await this.getRaces('all');
    const race = allRaces.find(r => r.id === raceId);
    if (race) {
      race.is_suspended = false;
      race.horses.forEach(h => {
        h.is_suspended = false;
        if (oddsMap && oddsMap[h.id]) {
          if (oddsMap[h.id].win_odds) h.win_odds = oddsMap[h.id].win_odds!;
          if (oddsMap[h.id].place_odds) h.place_odds = oddsMap[h.id].place_odds!;
        }
      });
      this.saveLocalRace(race);
      realtimeOdds.broadcast({
        event: 'ODDS_UPDATED',
        race_id: race.id,
        race: race,
        timestamp: Date.now(),
      });
      return { success: true, race };
    }
    return { success: true };
  },



  async addHorseToRace(raceId: string, horseData: Partial<Horse>): Promise<Race | null> {
    try {
      const res = await fetch(`${API_BASE}/admin/races/${raceId}/horses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(horseData),
      });
      const data = await res.json();
      if (data.race) {
        this.saveLocalRace(data.race);
        realtimeOdds.broadcast({
          event: 'RACE_STATUS_CHANGED',
          race_id: raceId,
          race: data.race,
          timestamp: Date.now(),
        });
        return data.race;
      }
    } catch {}
    return null;
  },

  async deleteHorseFromRace(raceId: string, horseId: string): Promise<Race | null> {
    try {
      const res = await fetch(`${API_BASE}/admin/races/${raceId}/horses/${horseId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.race) {
        this.saveLocalRace(data.race);
        realtimeOdds.broadcast({
          event: 'RACE_STATUS_CHANGED',
          race_id: raceId,
          race: data.race,
          timestamp: Date.now(),
        });
        return data.race;
      }
    } catch {}
    return null;
  },



  async settleRace(
    raceId: string, 
    positionsOrWinner: { position_1: string[]; position_2?: string[]; position_3?: string[]; position_4?: string[] } | string, 
    legacyPlaceIds?: string[]
  ): Promise<any> {
    // Parse positions
    let p1: string[] = [];
    let p2: string[] = [];
    let p3: string[] = [];
    let p4: string[] = [];

    if (typeof positionsOrWinner === 'object' && Array.isArray(positionsOrWinner.position_1)) {
      p1 = positionsOrWinner.position_1.filter(Boolean);
      p2 = (positionsOrWinner.position_2 || []).filter(Boolean);
      p3 = (positionsOrWinner.position_3 || []).filter(Boolean);
      p4 = (positionsOrWinner.position_4 || []).filter(Boolean);
    } else if (typeof positionsOrWinner === 'string') {
      p1 = [positionsOrWinner];
      const placeList = Array.isArray(legacyPlaceIds) ? legacyPlaceIds : [positionsOrWinner];
      p2 = placeList.filter(id => id !== positionsOrWinner).slice(0, 1);
      p3 = placeList.filter(id => id !== positionsOrWinner).slice(1, 2);
      p4 = placeList.filter(id => id !== positionsOrWinner).slice(2, 3);
    }

    const isDeadHeatWin = p1.length > 1;
    const isDeadHeatPlace = p2.length > 1 || p3.length > 1;
    const isDeadHeat = isDeadHeatWin || isDeadHeatPlace;

    try {
      const res = await fetch(`${API_BASE}/admin/races/${raceId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_1: p1,
          position_2: p2,
          position_3: p3,
          position_4: p4,
          winner_horse_id: p1[0] || '',
          place_horses_ids: [...p1, ...p2, ...p3],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Server response received
      }
    } catch {}

    const allRaces = await this.getRaces('all');
    const race = allRaces.find((r) => r.id === raceId);
    
    // Place multipliers calculation (Total 3 place slots)
    const placeFactorMap = new Map<string, number>();
    let remainingSlots = 3;

    // Tier 1 (1st Place)
    if (p1.length >= 3) {
      const factor = 3 / p1.length;
      p1.forEach(hId => placeFactorMap.set(hId, factor));
      remainingSlots = 0;
    } else {
      p1.forEach(hId => placeFactorMap.set(hId, 1.0));
      remainingSlots -= p1.length;
    }

    // Tier 2 (2nd Place)
    if (remainingSlots > 0 && p2.length > 0) {
      if (p2.length <= remainingSlots) {
        p2.forEach(hId => placeFactorMap.set(hId, 1.0));
        remainingSlots -= p2.length;
      } else {
        const factor = remainingSlots / p2.length;
        p2.forEach(hId => placeFactorMap.set(hId, factor));
        remainingSlots = 0;
      }
    }

    // Tier 3 (3rd Place)
    if (remainingSlots > 0 && p3.length > 0) {
      if (p3.length <= remainingSlots) {
        p3.forEach(hId => placeFactorMap.set(hId, 1.0));
        remainingSlots -= p3.length;
      } else {
        const factor = remainingSlots / p3.length;
        p3.forEach(hId => placeFactorMap.set(hId, factor));
        remainingSlots = 0;
      }
    }

    const placeList = [...p1, ...p2, ...p3];

    if (race) {
      race.position_1 = p1;
      race.position_2 = p2;
      race.position_3 = p3;
      race.position_4 = p4;
      race.winner_horse_id = p1[0] || null;
      race.place_horses_ids = placeList;
      race.is_dead_heat = isDeadHeat;
      race.dead_heat_note = isDeadHeatWin 
        ? `DEAD HEAT FOR WIN (${p1.length} Horses Tied for 1st)` 
        : isDeadHeatPlace 
        ? `DEAD HEAT FOR PLACE` 
        : undefined;
      race.status = 'RESULTED';
      race.settled_at = new Date().toISOString();
      this.saveLocalRace(race);
    }

    // Process all bets for this race
    let localBets: Bet[] = [];
    try {
      const raw = localStorage.getItem('derby_custom_bets');
      if (raw) localBets = JSON.parse(raw);
    } catch {}

    let currentUser: User = DUMMY_USER;
    try {
      const savedUser = localStorage.getItem('derby_user');
      if (savedUser) currentUser = JSON.parse(savedUser);
    } catch {}

    let localTxs: Transaction[] = [];
    try {
      const rawTxs = localStorage.getItem('derby_custom_txs');
      if (rawTxs) localTxs = JSON.parse(rawTxs);
    } catch {}

    let settledCount = 0;
    let totalPaidOut = 0;

    for (const bet of localBets) {
      const isRaceMatch = bet.race_id === raceId || (race && bet.race_name === race.name);
      if (isRaceMatch && bet.status === 'PENDING') {
        let isWon = false;
        let payoutAmount = 0;
        let betIsDeadHeat = false;
        let deadHeatDivider = 1;

        if (bet.bet_type === 'WIN') {
          if (p1.includes(bet.horse_id)) {
            isWon = true;
            if (p1.length > 1) {
              betIsDeadHeat = true;
              deadHeatDivider = p1.length;
              // Method A - Betfair rule: (Stake / N) * Odds
              payoutAmount = Math.round((bet.stake / p1.length) * bet.odds);
            } else {
              payoutAmount = Math.round(bet.stake * bet.odds);
            }
          }
        } else if (bet.bet_type === 'PLACE') {
          const factor = placeFactorMap.get(bet.horse_id) || 0;
          if (factor > 0) {
            isWon = true;
            if (factor < 1.0) {
              betIsDeadHeat = true;
              deadHeatDivider = Math.round(1 / factor);
              payoutAmount = Math.round((bet.stake * factor) * bet.odds);
            } else {
              payoutAmount = Math.round(bet.stake * bet.odds);
            }
          }
        }

        bet.settled_at = new Date().toISOString();

        if (isWon) {
          bet.status = 'WON';
          bet.payout = payoutAmount;
          bet.is_dead_heat = betIsDeadHeat;
          bet.dead_heat_divider = betIsDeadHeat ? deadHeatDivider : undefined;
          totalPaidOut += payoutAmount;

          // Credit balance & release exposure
          currentUser.balance = (currentUser.balance ?? 0) + payoutAmount;
          currentUser.exposure = Math.max(0, (currentUser.exposure ?? 0) - bet.stake);

          const winDesc = betIsDeadHeat
            ? `Payout WON (Dead Heat 1/${deadHeatDivider}): ${bet.bet_type} bet on #${bet.horse_no} ${bet.horse_name} in ${race?.name || bet.race_name} (₹${payoutAmount.toLocaleString('en-IN')})`
            : `Payout WON: ${bet.bet_type} bet on #${bet.horse_no} ${bet.horse_name} in ${race?.name || bet.race_name} (${bet.odds}x)`;

          // Log WIN transaction
          localTxs.unshift({
            id: `tx_${Date.now()}_${bet.id}`,
            user_id: bet.user_id,
            type: 'WIN',
            amount: payoutAmount,
            balance_after: currentUser.balance,
            description: winDesc,
            created_at: new Date().toISOString(),
            reference_id: bet.id,
          });
        } else {
          bet.status = 'LOST';
          bet.payout = 0;
          // Release exposure on loss
          currentUser.exposure = Math.max(0, (currentUser.exposure ?? 0) - bet.stake);
        }
        settledCount++;
      }
    }

    // Save back to localStorage
    try {
      localStorage.setItem('derby_custom_bets', JSON.stringify(localBets));
      localStorage.setItem('derby_user', JSON.stringify(currentUser));
      localStorage.setItem('derby_custom_txs', JSON.stringify(localTxs));
    } catch {}

    const winnerNames = p1.map(id => race?.horses?.find((h) => h.id === id)?.name || id).join(' & ');
    const message = isDeadHeatWin
      ? `🔥 DEAD HEAT Result Declared! 1st Place: ${winnerNames}. ${settledCount} bets settled via Dead Heat Rules (₹${totalPaidOut.toLocaleString('en-IN')} paid out).`
      : `Race "${race?.name || 'Fixture'}" resulted with winner ${winnerNames}! ${settledCount} bets settled (${totalPaidOut > 0 ? `₹${totalPaidOut.toLocaleString('en-IN')} paid out to wallet` : 'no winning bets'}).`;

    return { 
      success: true, 
      message,
      settledCount,
      totalPaidOut
    };
  },

  async getAdminAllBets(): Promise<Bet[]> {
    try {
      const res = await fetch(`${API_BASE}/admin/bets`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.bets)) return data.bets;
      }
    } catch {}
    return [];
  },

  async abandonRace(raceId: string, reason?: string): Promise<{ success: boolean; message: string; refundedCount: number; totalRefunded: number }> {
    try {
      const res = await fetch(`${API_BASE}/admin/races/${raceId}/abandon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update local storage as well
        this.abandonLocalRace(raceId, reason);
        return data;
      }
    } catch {}

    return this.abandonLocalRace(raceId, reason);
  },

  abandonLocalRace(raceId: string, reason?: string): { success: boolean; message: string; refundedCount: number; totalRefunded: number } {
    let localBets: Bet[] = [];
    try {
      const raw = localStorage.getItem('derby_custom_bets');
      if (raw) localBets = JSON.parse(raw);
    } catch {}

    let currentUser: User = DUMMY_USER;
    try {
      const savedUser = localStorage.getItem('derby_user');
      if (savedUser) currentUser = JSON.parse(savedUser);
    } catch {}

    let localTxs: Transaction[] = [];
    try {
      const rawTxs = localStorage.getItem('derby_custom_txs');
      if (rawTxs) localTxs = JSON.parse(rawTxs);
    } catch {}

    let refundedCount = 0;
    let totalRefunded = 0;

    for (const bet of localBets) {
      if (bet.race_id === raceId && bet.status === 'PENDING') {
        bet.status = 'REFUNDED';
        bet.settled_at = new Date().toISOString();
        totalRefunded += bet.stake;
        refundedCount++;

        currentUser.balance = (currentUser.balance ?? 0) + bet.stake;
        currentUser.exposure = Math.max(0, (currentUser.exposure ?? 0) - bet.stake);

        localTxs.unshift({
          id: `tx_${Date.now()}_${bet.id}`,
          user_id: bet.user_id,
          type: 'REFUND',
          amount: bet.stake,
          balance_after: currentUser.balance,
          description: `100% Refund for Cancelled/Abandoned Race #${raceId}: #${bet.horse_no} ${bet.horse_name} (${reason || 'Track Unfit / Abandoned'})`,
          created_at: new Date().toISOString(),
          reference_id: bet.id,
        });
      }
    }

    try {
      localStorage.setItem('derby_custom_bets', JSON.stringify(localBets));
      localStorage.setItem('derby_user', JSON.stringify(currentUser));
      localStorage.setItem('derby_custom_txs', JSON.stringify(localTxs));
    } catch {}

    return {
      success: true,
      message: `Race declared ABANDONED / VOID. ${refundedCount} bets refunded 100% (₹${totalRefunded.toLocaleString('en-IN')})!`,
      refundedCount,
      totalRefunded,
    };
  },

  async cancelBet(betId: string, reason?: string): Promise<{ success: boolean; message: string; bet?: Bet }> {
    try {
      const res = await fetch(`${API_BASE}/admin/bets/${betId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        return await res.json();
      }
      const errData = await res.json().catch(() => ({}));
      return { success: false, message: errData.error || 'Failed to cancel bet' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Network error cancelling bet' };
    }
  },

  async createAdminUser(data: { full_name?: string; username: string; phone: string; email?: string; password: string; initial_balance?: number }): Promise<{ success: boolean; message?: string; error?: string; user?: User }> {
    try {
      const res = await fetch(`${API_BASE}/admin/users/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok) return result;
      return { success: false, error: result.error || 'Failed to create user' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error creating user' };
    }
  },

  async toggleBlockUser(userId: string): Promise<{ success: boolean; message: string; is_blocked?: boolean }> {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/toggle-block`, {
        method: 'POST',
      });
      if (res.ok) return await res.json();
    } catch {}
    return { success: false, message: 'Failed to toggle user block status' };
  },

  async impersonateUser(userId: string): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/impersonate`, {
        method: 'POST',
      });
      if (res.ok) return await res.json();
      const err = await res.json();
      return { success: false, error: err.error };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async getSystemSettings(): Promise<{ betting_enabled: boolean; emergency_message?: string; announcement?: string; max_bet_per_horse?: number; max_win_per_race?: number; min_bet_amount?: number; sub_admins?: any[] }> {
    let localSub: any[] = [];
    try {
      const rawSub = localStorage.getItem('derby_sub_admins');
      if (rawSub) localSub = JSON.parse(rawSub);
    } catch {}

    try {
      const res = await fetch(`${API_BASE}/system/settings`);
      if (res.ok) {
        const data = await res.json();
        const settings = data.settings || { betting_enabled: true, max_bet_per_horse: 50000, max_win_per_race: 500000, min_bet_amount: 100, sub_admins: [] };
        if (localSub.length > 0) {
          const merged = [...(settings.sub_admins || [])];
          for (const s of localSub) {
            if (!merged.some((m: any) => m.id === s.id || m.username === s.username)) {
              merged.push(s);
            }
          }
          settings.sub_admins = merged;
        }
        return settings;
      }
    } catch {}

    let cachedSettings: any = { betting_enabled: true, max_bet_per_horse: 50000, max_win_per_race: 500000, min_bet_amount: 100, sub_admins: [] };
    try {
      const raw = localStorage.getItem('derby_system_settings');
      if (raw) cachedSettings = { ...cachedSettings, ...JSON.parse(raw) };
    } catch {}
    if (localSub.length > 0) {
      cachedSettings.sub_admins = localSub;
    }
    return cachedSettings;
  },

  async updateSystemSettings(settings: { betting_enabled?: boolean; emergency_message?: string; announcement?: string; max_bet_per_horse?: number; max_win_per_race?: number; min_bet_amount?: number }): Promise<{ success: boolean; message?: string }> {
    try {
      const raw = localStorage.getItem('derby_system_settings');
      const current = raw ? JSON.parse(raw) : {};
      localStorage.setItem('derby_system_settings', JSON.stringify({ ...current, ...settings }));
    } catch {}

    try {
      const res = await fetch(`${API_BASE}/admin/system/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) return await res.json();
    } catch {}
    return { success: true };
  },

  async addSubAdmin(data: { username: string; name: string; password?: string; role?: string; permissions?: string[] }): Promise<{ success: boolean; message?: string; sub_admin?: any }> {
    const newSub = {
      id: `sub_${Date.now()}`,
      username: data.username.toLowerCase().trim(),
      name: data.name.trim(),
      password: data.password || 'admin123',
      role: data.role || 'ODDS_MANAGER',
      permissions: data.permissions || (data.role === 'ODDS_MANAGER' ? ['ODDS_EDIT', 'SUSPEND_RUNNERS'] : ['FULL_ACCESS']),
      created_at: new Date().toISOString()
    };

    try {
      const raw = localStorage.getItem('derby_sub_admins');
      const list = raw ? JSON.parse(raw) : [];
      list.push(newSub);
      localStorage.setItem('derby_sub_admins', JSON.stringify(list));
    } catch {}

    try {
      const res = await fetch(`${API_BASE}/admin/sub-admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {}
    return { success: true, message: `Sub-Admin @${newSub.username} created with ${newSub.role} privileges`, sub_admin: newSub };
  },

  async deleteSubAdmin(id: string): Promise<{ success: boolean }> {
    try {
      const raw = localStorage.getItem('derby_sub_admins');
      if (raw) {
        const list = JSON.parse(raw).filter((s: any) => s.id !== id);
        localStorage.setItem('derby_sub_admins', JSON.stringify(list));
      }
    } catch {}

    try {
      const res = await fetch(`${API_BASE}/admin/sub-admins/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) return await res.json();
    } catch {}
    return { success: true };
  },

  async resetDemo(): Promise<void> {
    try {
      await fetch(`${API_BASE}/admin/clean-reset`, { method: 'POST' });
    } catch {}
    try {
      await fetch(`${API_BASE}/admin/reset-demo`, { method: 'POST' });
    } catch {}

    const preservedAudio = localStorage.getItem('derby_audio_muted');

    // Remove all cached local derby data
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('derby_')) {
        localStorage.removeItem(k);
      }
    });

    if (preservedAudio) {
      localStorage.setItem('derby_audio_muted', preservedAudio);
    }

    sessionStorage.removeItem('derby_admin_authenticated');
    sessionStorage.removeItem('derby_admin_user');
    sessionStorage.removeItem('derby_admin_role');
    sessionStorage.removeItem('derby_admin_name');
  },
};
