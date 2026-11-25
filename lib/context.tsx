'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import {
  User,
  DtrEntry,
  DtrRevision,
  CorrectionRequest,
  PayPeriod,
  PaymentRecord,
  PaymentLine,
  PaymentLineType,
  AuditLog,
  SystemSettings,
  WageHistory,
  UserRole,
  PaymentStatus,
  PayFrequency,
  AccountStatus,
  MonthlySelfApproval,
  DtrFinalizeReminderResponse,
  AppNotification,
  ReimbursementRequest,
  DEPARTMENTS,
  DEFAULT_HOURLY_WAGE,
  DEFAULT_DEPARTMENT,
} from './types';
import {
  INITIAL_USERS,
  INITIAL_DTR_ENTRIES,
  INITIAL_PAY_PERIODS,
  INITIAL_PAYMENTS,
  INITIAL_CORRECTIONS,
  INITIAL_REIMBURSEMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SETTINGS,
  INITIAL_WAGE_HISTORY,
} from './mock-data';
import {
  computeMinutesWorked,
  minutesToDecimalHours,
  checkIntervalOverlap,
  createMonthlyPayPeriod,
  formatDate,
  formatTime,
  formatMonthYear,
  generateMonthlyDtrRefTag,
  buildAutoClosedEntry,
  isSessionOverMaxDuration,
  MAX_SESSION_HOURS,
} from './utils-dtr';
import { supabase } from './supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { secureFetch } from './crypto';

export const STORAGE_KEY_REMEMBER_ME = 'timekeeping_remember_me';
export const STORAGE_KEY_REMEMBER_EMAIL = 'timekeeping_remember_email';
export const STORAGE_KEY_CACHED_USER_PREFIX = 'wmedlaw_cached_user_';
export const STORAGE_KEY_LAST_ACTIVE_USER = 'wmedlaw_last_active_user';

export const getCachedUser = (userId?: string): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    if (userId) {
      const cached = localStorage.getItem(`${STORAGE_KEY_CACHED_USER_PREFIX}${userId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id === userId) return parsed;
      }
    }
    const lastUser = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE_USER);
    if (lastUser) {
      const parsed = JSON.parse(lastUser);
      if (parsed && (!userId || parsed.id === userId)) return parsed;
    }
  } catch {
    // ignore
  }
  return null;
};

export const createProvisionalUser = (authUser: SupabaseUser): User => {
  const email = (authUser.email || '').toLowerCase().trim();
  const isDefaultSysAdmin = email === 'marquez.ronrons@gmail.com';
  const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';
  const firstName =
    authUser.user_metadata?.first_name ||
    (fullName ? fullName.split(' ')[0] : '') ||
    (isDefaultSysAdmin ? 'Ron' : 'User');
  const lastName =
    authUser.user_metadata?.last_name ||
    (fullName ? fullName.split(' ').slice(1).join(' ') : '') ||
    (isDefaultSysAdmin ? 'Marquez' : '');

  const userRole: UserRole = isDefaultSysAdmin
    ? 'system_admin'
    : (authUser.user_metadata?.role as UserRole) || 'employee';

  const userStatus: AccountStatus = isDefaultSysAdmin
    ? 'active'
    : (authUser.user_metadata?.status as AccountStatus) || 'active';

  let bankNameVal = authUser.user_metadata?.bank_name || '';
  let accountNoVal = authUser.user_metadata?.account_no || '';
  let contactNoVal = authUser.user_metadata?.contact_no || '';
  let addressVal = authUser.user_metadata?.address || '';
  let emergencyContactVal = authUser.user_metadata?.emergency_contact || '';

  if (typeof window !== 'undefined') {
    try {
      const s = localStorage.getItem(`wmedlaw_profile_details_${authUser.id}`);
      if (s) {
        const parsed = JSON.parse(s);
        if (!contactNoVal && parsed.contact_no) contactNoVal = parsed.contact_no;
        if (!addressVal && parsed.address) addressVal = parsed.address;
        if (!emergencyContactVal && parsed.emergency_contact) emergencyContactVal = parsed.emergency_contact;
        if (!bankNameVal && parsed.bank_name) bankNameVal = parsed.bank_name;
        if (!accountNoVal && parsed.account_no) accountNoVal = parsed.account_no;
      }
    } catch {}

    if (!bankNameVal || !accountNoVal) {
      try {
        const s = localStorage.getItem(`wmedlaw_bank_details_${authUser.id}`);
        if (s) {
          const parsed = JSON.parse(s);
          if (!bankNameVal && parsed.bank_name) bankNameVal = parsed.bank_name;
          if (!accountNoVal && parsed.account_no) accountNoVal = parsed.account_no;
        }
      } catch {}
    }
  }

  return {
    id: authUser.id,
    username: authUser.user_metadata?.username || email.split('@')[0] || 'user',
    email: authUser.email || '',
    role: userRole,
    status: userStatus,
    is_hidden: isDefaultSysAdmin,
    clocks_in: authUser.user_metadata?.clocks_in ?? (userRole === 'employee'),
    failed_login_count: 0,
    employee_no: authUser.user_metadata?.employee_no || (isDefaultSysAdmin ? 'SYS-001' : `EMP-${authUser.id.slice(0, 5).toUpperCase()}`),
    first_name: firstName,
    last_name: lastName,
    position: isDefaultSysAdmin ? 'System Administrator' : (authUser.user_metadata?.position || 'Staff'),
    department: authUser.user_metadata?.department || DEFAULT_DEPARTMENT,
    contact_no: contactNoVal,
    address: addressVal,
    emergency_contact: emergencyContactVal,
    bank_name: bankNameVal,
    account_no: accountNoVal,
    hire_date: authUser.user_metadata?.hire_date || new Date().toISOString().slice(0, 10),
    hourly_rate: Number(authUser.user_metadata?.hourly_rate) || DEFAULT_HOURLY_WAGE,
    pay_frequency: 'monthly',
    max_hours_day: 8.0,
    max_hours_week: 40.0,
    max_hours_month: 160.0,
    auth_provider: (authUser.app_metadata?.provider as 'google' | 'email') || 'email',
    created_at: authUser.created_at,
  };
};

export const getStoredSupabaseSession = (): { session: Session; user: SupabaseUser } | null => {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const user = parsed.user || parsed.currentSession?.user;
          const token = parsed.access_token || parsed.currentSession?.access_token;
          if (user?.id && token) {
            return {
              session: (parsed.currentSession || parsed) as Session,
              user: user as SupabaseUser,
            };
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
};

export const ANONYMOUS_USER: User = {
  id: '',
  username: 'guest',
  email: '',
  role: 'employee',
  status: 'inactive',
  is_hidden: false,
  clocks_in: false,
  failed_login_count: 0,
  employee_no: '',
  first_name: '',
  last_name: '',
  position: 'Guest',
  department: DEFAULT_DEPARTMENT,
  contact_no: '',
  hire_date: '',
  hourly_rate: 0,
  pay_frequency: 'monthly',
};

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  switchUserById: (userId: string) => void;
  users: User[];
  visibleUsers: User[]; // Screened for is_hidden based on role
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  dtrEntries: DtrEntry[];
  corrections: CorrectionRequest[];
  payPeriods: PayPeriod[];
  payments: PaymentRecord[];
  auditLogs: AuditLog[];
  visibleAuditLogs: AuditLog[];
  wageHistory: WageHistory[];
  
  // DTR Operations
  fileDtrEntry: (params: {
    work_date: string;
    time_in: string;
    time_out: string;
    remarks: string;
  }) => { success: boolean; message: string; entry?: DtrEntry };
  currentOpenSession: DtrEntry | null;
  timeIn: () => { success: boolean; message: string };
  timeOut: (remarks: string) => { success: boolean; message: string };
  cancelClockIn: (reason?: string) => { success: boolean; message: string };
  updateRemarks: (entryId: string, newRemarks: string) => { success: boolean; message: string };
  fileCorrection: (params: {
    dtr_entry_id: string | null;
    work_date: string;
    requested_time_in: string;
    requested_time_out: string;
    reason: string;
  }) => { success: boolean; message: string };
  approveDtrEntry: (entryId: string) => Promise<{ success: boolean; message: string }>;
  rejectDtrEntry: (entryId: string, reason: string) => { success: boolean; message: string };
  approveExtraHours: (
    entryId: string,
    mode: 'all' | 'regular_only' | 'reject',
    declineReason?: string
  ) => { success: boolean; message: string };
  adjustDtrTime: (
    entryId: string,
    newIn: string,
    newOut: string,
    reason: string
  ) => { success: boolean; message: string };
  timeOutOnBehalf: (
    entryId: string,
    timeOutStr: string,
    reason: string
  ) => { success: boolean; message: string };
  bulkApproveEligible: () => Promise<{ success: boolean; count: number; message?: string }>;
  approveCorrection: (id: string, note?: string) => { success: boolean; message: string };
  rejectCorrection: (id: string, note: string) => { success: boolean; message: string };

  // User & Wage Management
  updateUser: (user: User) => Promise<void> | void;
  createUser: (user: Omit<User, 'id' | 'failed_login_count'>) => User;
  setHourlyWage: (userId: string, rate: number, effectiveFrom: string, note: string) => void;
  toggleAdminClockIn: (adminId: string, clocksIn: boolean) => void;
  setUserStatus: (userId: string, status: 'active' | 'inactive' | 'locked' | 'pending_approval') => void;

  // Supabase Auth & Session
  session: Session | null;
  supabaseUser: SupabaseUser | null;
  isAuthLoading: boolean;
  signInWithEmail: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    metadata: { firstName: string; lastName: string }
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshCurrentUserProfile: () => Promise<void>;
  refreshRemoteProfiles: () => Promise<void>;
  resetPasswordForEmail: (
    email: string,
    options?: { forAdminLink?: boolean }
  ) => Promise<{
    success: boolean;
    error?: string;
    message?: string;
    action_link?: string;
    auto_verified?: boolean;
    email_otp?: string;
    rateLimited?: boolean;
    retryAfter?: number;
  }>;
  changePassword: (
    newPassword: string
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (isRecovery: boolean) => void;

  // Pending User Approval
  pendingUsers: User[];
  approvePendingUser: (
    userId: string,
    data: {
      role: UserRole;
      position: string;
      department: string;
      hourly_rate: number;
      pay_frequency: PayFrequency;
      employee_no?: string;
      clocks_in?: boolean;
    }
  ) => Promise<{ success: boolean; message: string }>;
  rejectPendingUser: (userId: string, reason?: string) => Promise<{ success: boolean; message: string }>;

  // Payments & Periods
  closePayPeriod: (periodId: string) => { success: boolean; message: string };
  lockPayPeriod: (periodId: string) => { success: boolean; message: string };
  reopenPayPeriod: (periodId: string, reason: string) => { success: boolean; message: string };
  updatePayPeriodPayDate: (periodId: string, newPayDate: string) => { success: boolean; message: string };
  generatePaymentsForPeriod: (periodId: string) => { count: number; totalGross: number };
  updatePaymentStatus: (
    paymentId: string,
    status: PaymentStatus,
    data?: { method?: string; reference_no?: string; reason?: string; paid_at?: string }
  ) => { success: boolean; message: string };
  sendPaymentReceiptEmail: (params: {
    payment_id?: string;
    user_id?: string;
    email?: string;
    employee_name?: string;
    employee_no?: string;
    department?: string;
    hourly_rate?: number;
    gross_amount?: number;
    total_hours?: number;
    method?: string;
    reference_no?: string;
    paid_at?: string;
    bank_name?: string;
    account_no?: string;
    pay_period_label?: string;
    lines?: any[];
  }) => Promise<{ success: boolean; sent?: boolean; simulated?: boolean; message?: string; error?: string }>;
  reversePayment: (paymentId: string, reason: string) => { success: boolean; message: string };
  purgePeriodRetention: (periodId: string) => { success: boolean; message: string };
  generateMonthlyPayments: (month: string) => { count: number; totalGross: number };
  updateMonthlyPaymentStatus: (
    userId: string,
    month: string,
    status: PaymentStatus,
    data?: { method?: string; reference_no?: string; paid_at?: string; reason?: string }
  ) => { success: boolean; message: string };
  addAdditionalPayment: (params: {
    payPeriodId: string;
    target: 'all' | 'individual';
    userId?: string;
    category: string;
    amount: number;
    description?: string;
  }) => Promise<{ success: boolean; count: number; message: string }>;
  removeAdditionalPaymentLine: (params: {
    paymentId: string;
    lineId: string;
  }) => Promise<{ success: boolean; message: string }>;

  // Monthly Self-Approval Workflow & Notifications
  monthlySelfApprovals: MonthlySelfApproval[];
  submitMonthlySelfApproval: (params: {
    month: string;
    employee_note?: string;
  }) => Promise<{
    success: boolean;
    message: string;
    approval?: MonthlySelfApproval;
    reference_no?: string;
    email_sent?: boolean;
    email_simulated?: boolean;
    admin_recipients?: string[];
  }>;
  notifyAdminsOnMonthlyDtrFinalized: (params: {
    month: string;
    reference_no?: string;
    total_hours: number;
    regular_hours?: number;
    extra_hours?: number;
    approved_hours?: number;
    entries_count: number;
    submitted_at?: string;
    employee_note?: string;
    employee_id?: string;
    employee_name?: string;
    employee_no?: string;
    employee_email?: string;
    department?: string;
  }) => Promise<{
    success: boolean;
    sent?: boolean;
    simulated?: boolean;
    message?: string;
    recipients?: string[];
  }>;
  sendDtrFinalizeReminders: (params: {
    month: string;
    user_ids?: string[];
  }) => Promise<DtrFinalizeReminderResponse>;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  
  // Simulated Clock Helpers
  serverCurrentTime: string; // HH:mm
  serverCurrentDate: string; // YYYY-MM-DD
  serverCurrentSeconds: number; // 0-59
  serverCurrentTimeWithSeconds: string; // HH:mm:ss
  setSimulatedClock: (date: string, time: string) => void;
  resetToRealClock: () => void;
  resetAllDataToDefaults: () => void;
  isSimulated: boolean;
  refreshRemoteDtrEntries: (token?: string) => Promise<void>;
  refreshRemotePayments: (token?: string) => Promise<void>;
  refreshRemotePayPeriods: (token?: string) => Promise<void>;
  refreshRemoteReimbursements: (token?: string) => Promise<void>;
  refreshAllRemoteData: (token?: string) => Promise<void>;

  // Reimbursement Filing & Approvals
  reimbursements: ReimbursementRequest[];
  fileReimbursement: (params: {
    title: string;
    amount: number;
    category?: string;
    expense_date: string;
    description?: string;
    receipt_url?: string;
    pay_period_id?: string;
  }) => Promise<{
    success: boolean;
    message: string;
    reimbursement?: ReimbursementRequest;
  }>;
  approveReimbursement: (
    id: string,
    options?: {
      payPeriodId?: string;
      note?: string;
    }
  ) => Promise<{ success: boolean; message: string }>;
  rejectReimbursement: (id: string, note?: string) => Promise<{ success: boolean; message: string }>;
  deleteReimbursement: (id: string) => Promise<{ success: boolean; message: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const mapProfileToUser = (p: any): User => {
  const isDefaultSysAdmin = (p.email || '').toLowerCase().trim() === 'marquez.ronrons@gmail.com';
  let bankName = p.bank_name || p.user_metadata?.bank_name || '';
  let accountNo = p.account_no || p.user_metadata?.account_no || '';
  let contactNo = p.contact_no || p.user_metadata?.contact_no || '';
  let address = p.address || p.user_metadata?.address || '';
  let emergencyContact = p.emergency_contact || p.user_metadata?.emergency_contact || '';

  // Extract resilient payout metadata from emergency_contact if present
  if (emergencyContact.includes('[PAYOUT:')) {
    const match = emergencyContact.match(/\[PAYOUT:(.*?)\|(.*?)\]/);
    if (match) {
      if (!bankName && match[1]) bankName = match[1].trim();
      if (!accountNo && match[2]) accountNo = match[2].trim();
      emergencyContact = emergencyContact.replace(/\s*\[PAYOUT:.*?\]/g, '').trim();
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const s = localStorage.getItem(`wmedlaw_profile_details_${p.id}`);
      if (s) {
        const parsed = JSON.parse(s);
        if (!contactNo && parsed.contact_no) contactNo = parsed.contact_no;
        if (!address && parsed.address) address = parsed.address;
        if (!emergencyContact && parsed.emergency_contact) emergencyContact = parsed.emergency_contact;
        if (!bankName && parsed.bank_name) bankName = parsed.bank_name;
        if (!accountNo && parsed.account_no) accountNo = parsed.account_no;
      }
    } catch {}

    if ((!bankName || !accountNo)) {
      try {
        const s = localStorage.getItem(`wmedlaw_bank_details_${p.id}`);
        if (s) {
          const parsed = JSON.parse(s);
          if (!bankName && parsed.bank_name) bankName = parsed.bank_name;
          if (!accountNo && parsed.account_no) accountNo = parsed.account_no;
        }
      } catch {}
    }
  }

  return {
    id: p.id,
    username: p.username || p.email?.split('@')[0] || 'user',
    email: p.email,
    role: isDefaultSysAdmin ? 'system_admin' : (p.role as UserRole) || 'employee',
    status: isDefaultSysAdmin ? 'active' : (p.status as AccountStatus) || 'pending_approval',
    is_hidden: isDefaultSysAdmin,
    clocks_in: p.clocks_in ?? (p.role === 'employee'),
    failed_login_count: 0,
    employee_no: p.employee_no || `EMP-${Math.floor(10000 + Math.random() * 90000)}`,
    first_name: p.first_name || (isDefaultSysAdmin ? 'Ron' : 'User'),
    last_name: p.last_name || (isDefaultSysAdmin ? 'Marquez' : ''),
    position: p.position || (isDefaultSysAdmin ? 'System Administrator' : 'Pending Assignment'),
    department: p.department || DEFAULT_DEPARTMENT,
    contact_no: contactNo,
    address: address,
    emergency_contact: emergencyContact,
    bank_name: bankName,
    account_no: accountNo,
    hire_date: p.hire_date || new Date().toISOString().slice(0, 10),
    hourly_rate: Number(p.hourly_rate) || DEFAULT_HOURLY_WAGE,
    pay_frequency: 'monthly',
    max_hours_day: Number(p.max_hours_day) || 8.0,
    max_hours_week: Number(p.max_hours_week) || 40.0,
    max_hours_month: Number(p.max_hours_month) || 160.0,
    auth_provider: p.auth_provider || 'email',
    created_at: p.created_at,
  };
};

export function AppProvider({ children }: { children: ReactNode }) {

  // State - Real Supabase Data (Clean State)
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [dtrEntries, setDtrEntries] = useState<DtrEntry[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [reimbursements, setReimbursements] = useState<ReimbursementRequest[]>(INITIAL_REIMBURSEMENTS);
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>(INITIAL_PAY_PERIODS);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  const [wageHistory, setWageHistory] = useState<WageHistory[]>([]);
  const [monthlySelfApprovals, setMonthlySelfApprovals] = useState<MonthlySelfApproval[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isStorageLoaded, setIsStorageLoaded] = useState<boolean>(false);

  // Supabase Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  // Simulated server clock (defaults to real current time, allows override for testing DTR timestamps)
  const [simulatedClock, setSimulatedClockState] = useState<{ date: string; time: string } | null>(null);

  // Real-time minute ticker: only updates state when the minute changes or simulated clock changes,
  // preventing 60 full-app re-renders every minute that cause scrolling flicker.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      const current = new Date();
      setNow((prev) => {
        if (
          prev.getMinutes() !== current.getMinutes() ||
          prev.getHours() !== current.getHours() ||
          prev.getDate() !== current.getDate()
        ) {
          return current;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const serverCurrentTime = useMemo(() => {
    if (simulatedClock) return simulatedClock.time;
    return now.toTimeString().slice(0, 5); // "HH:mm"
  }, [simulatedClock, now]);

  const serverCurrentDate = useMemo(() => {
    if (simulatedClock) return simulatedClock.date;
    // Local calendar date, matching serverCurrentTime (which is also local).
    // Using toISOString() here returned the UTC date, which is the previous day before 8AM in Manila.
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; // "YYYY-MM-DD"
  }, [simulatedClock, now]);

  const serverCurrentSeconds = useMemo(() => {
    return now.getSeconds();
  }, [now]);

  const serverCurrentTimeWithSeconds = useMemo(() => {
    const secStr = String(now.getSeconds()).padStart(2, '0');
    if (simulatedClock) return `${simulatedClock.time}:${secStr}`;
    return now.toTimeString().slice(0, 8); // "HH:mm:ss"
  }, [simulatedClock, now]);

  const sessionRef = React.useRef<Session | null>(null);
  sessionRef.current = session;

  const payPeriodsRef = React.useRef<PayPeriod[]>(payPeriods);
  payPeriodsRef.current = payPeriods;

  const usersRef = React.useRef<User[]>(users);
  usersRef.current = users;

  const paymentsRef = React.useRef<PaymentRecord[]>(payments);
  paymentsRef.current = payments;

  const dtrEntriesRef = React.useRef<DtrEntry[]>(dtrEntries);
  dtrEntriesRef.current = dtrEntries;

  const reimbursementsRef = React.useRef<ReimbursementRequest[]>(reimbursements);
  reimbursementsRef.current = reimbursements;

  const isSyncingUserRef = React.useRef<boolean>(false);
  const isRefreshingProfilesRef = React.useRef<boolean>(false);
  const isRefreshingDtrRef = React.useRef<boolean>(false);
  const isRefreshingAllRef = React.useRef<boolean>(false);

  // Sync Supabase Auth User with profile (guarded against concurrent loops)
  const syncUserFromSupabase = useCallback(async (authUser: SupabaseUser, token?: string) => {
    if (!authUser?.id) return;
    if (isSyncingUserRef.current) return;
    isSyncingUserRef.current = true;

    try {
      const email = (authUser.email || '').toLowerCase().trim();
      const isDefaultSysAdmin = email === 'marquez.ronrons@gmail.com';

      // 1. Look up any existing user record in memory
      let existingUser: User | undefined;
      setUsers((prev) => {
        existingUser = prev.find(
          (u) => u.id === authUser.id || u.email.toLowerCase() === email
        );
        return prev;
      });

      let profileData: any = null;
      const activeToken = token || sessionRef.current?.access_token;

      // Encrypted API fetch (only if active session token is present)
      if (activeToken) {
        try {
          const res = await secureFetch('/api/users', { accessToken: activeToken });
          if (res.ok && res.data?.success && Array.isArray(res.data.users)) {
            const found = res.data.users.find(
              (p: any) => p.id === authUser.id || (p.email || '').toLowerCase().trim() === email
            );
            if (found) {
              profileData = found;
            }
          }
        } catch {
          // fallback
        }
      }

      // Direct Supabase fallback only if encrypted API returned nothing and user is authenticated
      if (!profileData && authUser.id) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          if (!error && data) {
            profileData = data;
          }
        } catch {
          // profiles table might not exist yet or offline
        }
      }

      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';
      const firstName =
        authUser.user_metadata?.first_name ||
        (fullName ? fullName.split(' ')[0] : '') ||
        existingUser?.first_name ||
        (isDefaultSysAdmin ? 'Ron' : 'User');
      const lastName =
        authUser.user_metadata?.last_name ||
        (fullName ? fullName.split(' ').slice(1).join(' ') : '') ||
        existingUser?.last_name ||
        (isDefaultSysAdmin ? 'Marquez' : '');

      const userRole: UserRole = isDefaultSysAdmin
        ? 'system_admin'
        : (profileData?.role as UserRole) || existingUser?.role || 'employee';

      // Status resolution: if already approved/active, never downgrade to pending_approval on transient sync
      let userStatus: AccountStatus;
      if (isDefaultSysAdmin) {
        userStatus = 'active';
      } else if (profileData?.status) {
        userStatus = profileData.status as AccountStatus;
      } else if (existingUser?.status && existingUser.status !== 'pending_approval') {
        userStatus = existingUser.status;
      } else {
        userStatus = 'pending_approval';
      }

      // Resilient contact, emergency contact, and payout metadata resolution
      let emergencyContactVal = profileData?.emergency_contact || authUser.user_metadata?.emergency_contact || '';
      let bankNameVal = profileData?.bank_name || authUser.user_metadata?.bank_name || '';
      let accountNoVal = profileData?.account_no || authUser.user_metadata?.account_no || '';
      let contactNoVal = profileData?.contact_no || authUser.user_metadata?.contact_no || '';
      let addressVal = profileData?.address || authUser.user_metadata?.address || '';

      if (emergencyContactVal.includes('[PAYOUT:')) {
        const match = emergencyContactVal.match(/\[PAYOUT:(.*?)\|(.*?)\]/);
        if (match) {
          if (!bankNameVal && match[1]) bankNameVal = match[1].trim();
          if (!accountNoVal && match[2]) accountNoVal = match[2].trim();
          emergencyContactVal = emergencyContactVal.replace(/\s*\[PAYOUT:.*?\]/g, '').trim();
        }
      }

      if (typeof window !== 'undefined') {
        try {
          const s = localStorage.getItem(`wmedlaw_profile_details_${authUser.id}`);
          if (s) {
            const parsed = JSON.parse(s);
            if (!contactNoVal && parsed.contact_no) contactNoVal = parsed.contact_no;
            if (!addressVal && parsed.address) addressVal = parsed.address;
            if (!emergencyContactVal && parsed.emergency_contact) emergencyContactVal = parsed.emergency_contact;
            if (!bankNameVal && parsed.bank_name) bankNameVal = parsed.bank_name;
            if (!accountNoVal && parsed.account_no) accountNoVal = parsed.account_no;
          }
        } catch {}

        if (!bankNameVal || !accountNoVal) {
          try {
            const s = localStorage.getItem(`wmedlaw_bank_details_${authUser.id}`);
            if (s) {
              const parsed = JSON.parse(s);
              if (!bankNameVal && parsed.bank_name) bankNameVal = parsed.bank_name;
              if (!accountNoVal && parsed.account_no) accountNoVal = parsed.account_no;
            }
          } catch {}
        }
      }

      const mappedUser: User = {
        id: authUser.id,
        username: profileData?.username || existingUser?.username || authUser.email?.split('@')[0] || 'user',
        email: authUser.email || '',
        role: userRole,
        status: userStatus,
        is_hidden: isDefaultSysAdmin,
        clocks_in: profileData?.clocks_in ?? existingUser?.clocks_in ?? (userRole === 'employee'),
        failed_login_count: 0,
        employee_no:
          profileData?.employee_no ||
          existingUser?.employee_no ||
          (isDefaultSysAdmin ? 'SYS-001' : `EMP-${Math.floor(10000 + Math.random() * 90000)}`),
        first_name: profileData?.first_name || firstName,
        last_name: profileData?.last_name || lastName,
        position:
          profileData?.position || existingUser?.position || (isDefaultSysAdmin ? 'System Administrator' : 'Pending Approval'),
        department: profileData?.department || existingUser?.department || (isDefaultSysAdmin ? 'System Architecture' : DEFAULT_DEPARTMENT),
        contact_no: contactNoVal || existingUser?.contact_no || '',
        address: addressVal || existingUser?.address || '',
        emergency_contact: emergencyContactVal || existingUser?.emergency_contact || '',
        bank_name: bankNameVal || existingUser?.bank_name || '',
        account_no: accountNoVal || existingUser?.account_no || '',
        hire_date: profileData?.hire_date || existingUser?.hire_date || new Date().toISOString().slice(0, 10),
        hourly_rate: Number(profileData?.hourly_rate) || existingUser?.hourly_rate || DEFAULT_HOURLY_WAGE,
        pay_frequency: 'monthly',
        max_hours_day: Number(profileData?.max_hours_day) || existingUser?.max_hours_day || 8.0,
        max_hours_week: Number(profileData?.max_hours_week) || existingUser?.max_hours_week || 40.0,
        max_hours_month: Number(profileData?.max_hours_month) || existingUser?.max_hours_month || 160.0,
        auth_provider: (authUser.app_metadata?.provider as 'google' | 'email') || existingUser?.auth_provider || 'email',
        created_at: profileData?.created_at || existingUser?.created_at || authUser.created_at,
      };

      // If profile was missing from database and user is entirely new, attempt to provision
      if (!profileData && !existingUser) {
        try {
          await supabase.from('profiles').upsert({
            id: mappedUser.id,
            email: mappedUser.email,
            first_name: mappedUser.first_name,
            last_name: mappedUser.last_name,
            username: mappedUser.username,
            role: mappedUser.role,
            status: mappedUser.status,
            clocks_in: mappedUser.clocks_in,
            employee_no: mappedUser.employee_no,
            position: mappedUser.position,
            department: mappedUser.department,
            hourly_rate: mappedUser.hourly_rate,
            pay_frequency: mappedUser.pay_frequency,
            auth_provider: mappedUser.auth_provider,
            contact_no: mappedUser.contact_no,
            address: mappedUser.address,
            emergency_contact: mappedUser.emergency_contact,
            bank_name: mappedUser.bank_name,
            account_no: mappedUser.account_no,
          });
        } catch {
          // ignore
        }
      }

      setUsers((prev) => {
        const idx = prev.findIndex(
          (u) => u.id === mappedUser.id || u.email.toLowerCase() === mappedUser.email.toLowerCase()
        );
        if (idx >= 0) {
          const finalStatus =
            prev[idx].status === 'active' && mappedUser.status === 'pending_approval' && !profileData?.status
              ? 'active'
              : mappedUser.status;

          // Prevent unnecessary state update if already identical
          const existing = prev[idx];
          if (
            existing.id === mappedUser.id &&
            existing.status === finalStatus &&
            existing.role === mappedUser.role &&
            existing.first_name === mappedUser.first_name &&
            existing.last_name === mappedUser.last_name &&
            existing.email === mappedUser.email &&
            existing.emergency_contact === mappedUser.emergency_contact &&
            existing.contact_no === mappedUser.contact_no &&
            existing.address === mappedUser.address &&
            existing.bank_name === mappedUser.bank_name &&
            existing.account_no === mappedUser.account_no
          ) {
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(`${STORAGE_KEY_CACHED_USER_PREFIX}${mappedUser.id}`, JSON.stringify(existing));
                localStorage.setItem(STORAGE_KEY_LAST_ACTIVE_USER, JSON.stringify(existing));
              } catch {}
            }
            return prev;
          }

          const updated = [...prev];
          const resolvedUser = { ...prev[idx], ...mappedUser, status: finalStatus, id: authUser.id };
          updated[idx] = resolvedUser;
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`${STORAGE_KEY_CACHED_USER_PREFIX}${resolvedUser.id}`, JSON.stringify(resolvedUser));
              localStorage.setItem(STORAGE_KEY_LAST_ACTIVE_USER, JSON.stringify(resolvedUser));
            } catch {}
          }
          return updated;
        }

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`${STORAGE_KEY_CACHED_USER_PREFIX}${mappedUser.id}`, JSON.stringify(mappedUser));
            localStorage.setItem(STORAGE_KEY_LAST_ACTIVE_USER, JSON.stringify(mappedUser));
          } catch {}
        }
        return [mappedUser, ...prev];
      });

      setCurrentUserId((prev) => (prev === authUser.id ? prev : authUser.id));
    } finally {
      isSyncingUserRef.current = false;
    }
  }, []);

  const syncUserFromSupabaseRef = React.useRef(syncUserFromSupabase);
  syncUserFromSupabaseRef.current = syncUserFromSupabase;

  // Proactively purge any legacy employee, timekeeping, or pay period records from browser localStorage
  useEffect(() => {
    const LEGACY_BUSINESS_KEYS = [
      'timekeeping_users_v2',
      'timekeeping_dtr_v2',
      'timekeeping_corrections_v2',
      'timekeeping_periods_v2',
      'timekeeping_payments_v2',
      'timekeeping_audit_v2',
      'timekeeping_settings_v2',
      'timekeeping_wages_v2',
      'timekeeping_active_user_id',
      'timekeeping_monthly_approvals_v2',
      'timekeeping_notifications_v2',
      'timekeeping_users',
      'timekeeping_dtr',
      'timekeeping_corrections',
      'timekeeping_periods',
      'timekeeping_payments',
      'timekeeping_audit',
      'timekeeping_settings',
      'timekeeping_wages',
      'timekeeping_active_user',
      'timekeeping_monthly_approvals',
      'timekeeping_notifications',
    ];
    try {
      LEGACY_BUSINESS_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {}
    setIsStorageLoaded(true);
  }, []);

  // Load registered profiles from server API via encrypted secureFetch
  const refreshRemoteProfiles = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) {
      // Guard: Never query profiles when unauthenticated (e.g. on login screen)
      return;
    }
    if (isRefreshingProfilesRef.current) return;
    isRefreshingProfilesRef.current = true;

    try {
      const res = await secureFetch('/api/users', { accessToken: activeToken });
      if (res.ok && res.data?.success && Array.isArray(res.data.users)) {
        setUsers((prev) => {
          const map = new Map<string, User>();
          prev.forEach((u) => map.set(u.id, u));
          res.data.users.forEach((p: any) => {
            const mapped = mapProfileToUser(p);
            const prevUser = map.get(mapped.id);
            if (prevUser && prevUser.status === 'active' && mapped.status === 'pending_approval' && !p.status) {
              mapped.status = 'active';
            }
            map.set(p.id, mapped);
          });
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.warn('Encrypted /api/users fetch failed:', err);
    } finally {
      isRefreshingProfilesRef.current = false;
    }
  }, []);

  // Helper to upsert single DTR entry via encrypted API route
  const syncDtrToSupabase = useCallback(async (entry: DtrEntry): Promise<{ success: boolean; error?: string }> => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return { success: false, error: 'No active session token' };

    try {
      const res = await secureFetch('/api/dtr', {
        method: 'POST',
        accessToken: activeToken,
        body: { entry },
      });
      return { success: res.ok, error: res.error };
    } catch (err: any) {
      console.warn('Encrypted /api/dtr sync warning:', err);
      return { success: false, error: err?.message || 'Failed to sync DTR entry' };
    }
  }, []);

  // Helper to upsert batch DTR entries via encrypted API route
  const syncBulkDtrToSupabase = useCallback(async (entries: DtrEntry[]): Promise<{ success: boolean; error?: string }> => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return { success: false, error: 'No active session token' };

    try {
      const res = await secureFetch('/api/dtr', {
        method: 'POST',
        accessToken: activeToken,
        body: { entries },
      });
      return { success: res.ok, error: res.error };
    } catch (err: any) {
      console.warn('Encrypted /api/dtr bulk sync warning:', err);
      return { success: false, error: err?.message || 'Failed to bulk sync DTR entries' };
    }
  }, []);

  // Helper to delete DTR entry via encrypted API route
  const deleteDtrFromSupabase = useCallback(async (entryId: string) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;

    try {
      await secureFetch('/api/dtr', {
        method: 'DELETE',
        accessToken: activeToken,
        body: { id: entryId },
      });
    } catch (err) {
      console.warn('Encrypted /api/dtr delete warning:', err);
    }
  }, []);

  // Fetch remote DTR entries via encrypted API route
  const refreshRemoteDtrEntries = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) {
      // Guard: Never query DTR entries when unauthenticated (e.g. on login screen)
      return;
    }
    if (isRefreshingDtrRef.current) return;
    isRefreshingDtrRef.current = true;

    try {
      const res = await secureFetch('/api/dtr', { accessToken: activeToken });
      if (res.ok && res.data?.success && Array.isArray(res.data.entries)) {
        setDtrEntries((prev) => {
          const map = new Map<string, DtrEntry>();
          res.data.entries.forEach((p: any) => {
            map.set(p.id, {
              id: p.id,
              user_id: p.user_id,
              work_date: p.work_date,
              time_in: p.time_in,
              time_out: p.time_out || null,
              remarks: p.remarks || '',
              minutes_worked: Number(p.minutes_worked) || 0,
              hours: Number(p.hours) || 0,
              regular_hours: Number(p.regular_hours) || 0,
              extra_hours: Number(p.extra_hours) || 0,
              extra_hours_status: p.extra_hours_status || 'none',
              extra_hours_limit: p.extra_hours_limit || null,
              extra_hours_note: p.extra_hours_note || null,
              payable_hours: Number(p.payable_hours) || 0,
              hourly_rate_snapshot: Number(p.hourly_rate_snapshot) || 0,
              status: p.status || 'open',
              source: p.source || 'self',
              ip_in: p.ip_in,
              ip_out: p.ip_out,
              device_info: p.device_info,
              pay_period_id: p.pay_period_id,
              reviewed_by_name: p.reviewed_by_name,
              reviewed_at: p.reviewed_at,
              revisions: Array.isArray(p.revisions) ? p.revisions : [],
              self_approved: Boolean(p.self_approved),
              self_approved_at: p.self_approved_at || null,
              self_approved_ref: p.self_approved_ref || p.reference_no || null,
              reference_no: p.reference_no || p.self_approved_ref || null,
              created_at: p.created_at,
              updated_at: p.updated_at,
            });
          });
          // Retain any local entries that might not be on remote yet
          prev.forEach((local) => {
            if (!map.has(local.id)) {
              map.set(local.id, local);
            }
          });
          const merged = Array.from(map.values());
          return merged;
        });
      }
    } catch {
      // ignore
    } finally {
      isRefreshingDtrRef.current = false;
    }
  }, []);

  // Helper to upsert Pay Period via encrypted API route
  const syncPayPeriodToSupabase = useCallback(async (period: PayPeriod) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/pay-periods', {
        method: 'POST',
        accessToken: activeToken,
        body: { payPeriod: period },
      });
    } catch (err) {
      console.warn('Encrypted /api/pay-periods sync warning:', err);
    }
  }, []);

  // Helper to upsert batch pay periods
  const syncPayPeriodsBatchToSupabase = useCallback(async (periods: PayPeriod[]) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken || periods.length === 0) return;
    try {
      await secureFetch('/api/pay-periods', {
        method: 'POST',
        accessToken: activeToken,
        body: { payPeriods: periods },
      });
    } catch (err) {
      console.warn('Encrypted /api/pay-periods batch sync warning:', err);
    }
  }, []);

  // Helper to delete Pay Period from Supabase
  const deletePayPeriodFromSupabase = useCallback(async (id: string) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/pay-periods', {
        method: 'DELETE',
        accessToken: activeToken,
        body: { id },
      });
    } catch (err) {
      console.warn('Encrypted /api/pay-periods delete warning:', err);
    }
  }, []);

  // Helper to upsert Payments via encrypted API route
  const syncPaymentsToSupabase = useCallback(async (records: PaymentRecord[]) => {
    let activeToken = sessionRef.current?.access_token;
    if (!activeToken) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          activeToken = sessionData.session.access_token;
          sessionRef.current = sessionData.session;
          setSession(sessionData.session);
        }
      } catch {}
    }
    if (!activeToken || records.length === 0) return { success: false, error: 'No active session or records empty' };
    try {
      const res = await secureFetch('/api/payments', {
        method: 'POST',
        accessToken: activeToken,
        body: { payments: records },
      });
      if (!res.ok) {
        console.warn('Encrypted /api/payments sync error:', res.data?.error);
        return { success: false, error: res.data?.error || 'Failed to save payments' };
      }
      return { success: true, data: res.data };
    } catch (err: any) {
      console.warn('Encrypted /api/payments sync warning:', err);
      return { success: false, error: err?.message };
    }
  }, []);

  // Helper to delete Payments for a Period from Supabase
  const deletePaymentsForPeriodFromSupabase = useCallback(async (periodId: string) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/payments', {
        method: 'DELETE',
        accessToken: activeToken,
        body: { pay_period_id: periodId },
      });
    } catch (err) {
      console.warn('Encrypted /api/payments delete warning:', err);
    }
  }, []);

  // Helper to delete single Payment by ID from Supabase
  const deletePaymentByIdFromSupabase = useCallback(async (paymentId: string) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken || !paymentId) return;
    try {
      await secureFetch('/api/payments', {
        method: 'DELETE',
        accessToken: activeToken,
        body: { id: paymentId },
      });
    } catch (err) {
      console.warn('Encrypted /api/payments delete warning:', err);
    }
  }, []);

  // Helper to upsert Correction via encrypted API route
  const syncCorrectionToSupabase = useCallback(async (corr: CorrectionRequest) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/corrections', {
        method: 'POST',
        accessToken: activeToken,
        body: { correction: corr },
      });
    } catch (err) {
      console.warn('Encrypted /api/corrections sync warning:', err);
    }
  }, []);

  // Helper to upsert Reimbursement via encrypted API route
  const syncReimbursementToSupabase = useCallback(async (reimb: ReimbursementRequest) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/reimbursements', {
        method: 'POST',
        accessToken: activeToken,
        body: { reimbursement: reimb },
      });
    } catch (err) {
      console.warn('Encrypted /api/reimbursements sync warning:', err);
    }
  }, []);

  // Helper to delete Reimbursement from Supabase
  const deleteReimbursementFromSupabase = useCallback(async (id: string) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/reimbursements', {
        method: 'DELETE',
        accessToken: activeToken,
        body: { id },
      });
    } catch (err) {
      console.warn('Encrypted /api/reimbursements delete warning:', err);
    }
  }, []);

  // Helper to update Settings via encrypted API route
  const syncSettingsToSupabase = useCallback(async (newSettings: SystemSettings) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/settings', {
        method: 'POST',
        accessToken: activeToken,
        body: { settings: newSettings },
      });
    } catch (err) {
      console.warn('Encrypted /api/settings sync warning:', err);
    }
  }, []);

  // Helper to record Audit Log via encrypted API route
  const syncAuditLogToSupabase = useCallback(async (log: AuditLog) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/audit', {
        method: 'POST',
        accessToken: activeToken,
        body: { log },
      });
    } catch (err) {
      console.warn('Encrypted /api/audit sync warning:', err);
    }
  }, []);

  // Helper to upsert Monthly Self-Approval via encrypted API route
  const syncApprovalToSupabase = useCallback(async (approval: MonthlySelfApproval) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/approvals', {
        method: 'POST',
        accessToken: activeToken,
        body: { approval },
      });
    } catch (err) {
      console.warn('Encrypted /api/approvals sync warning:', err);
    }
  }, []);

  // Helper to upsert Wage History via encrypted API route
  const syncWageHistoryToSupabase = useCallback(async (wage: WageHistory) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/wage-history', {
        method: 'POST',
        accessToken: activeToken,
        body: { wage },
      });
    } catch (err) {
      console.warn('Encrypted /api/wage-history sync warning:', err);
    }
  }, []);

  // Helper to sync Notification via encrypted API route
  const syncNotificationToSupabase = useCallback(async (notif: AppNotification) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/notifications', {
        method: 'POST',
        accessToken: activeToken,
        body: { notification: notif },
      });
    } catch (err) {
      console.warn('Encrypted /api/notifications sync warning:', err);
    }
  }, []);

  // Helper to delete/clear Notifications from Supabase
  const deleteNotificationFromSupabase = useCallback(async (id?: string, clearAll?: boolean) => {
    const activeToken = sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      await secureFetch('/api/notifications', {
        method: 'DELETE',
        accessToken: activeToken,
        body: { id, clearAll },
      });
    } catch (err) {
      console.warn('Encrypted /api/notifications delete warning:', err);
    }
  }, []);

  // Fetch remote Pay Periods via encrypted API route
  const refreshRemotePayPeriods = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      const res = await secureFetch('/api/pay-periods', { accessToken: activeToken });
      if (res.ok && res.data?.success && Array.isArray(res.data.payPeriods) && res.data.payPeriods.length > 0) {
        setPayPeriods((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(res.data.payPeriods)) {
            return prev;
          }
          return res.data.payPeriods;
        });
      }
    } catch (err) {
      console.warn('Encrypted /api/pay-periods fetch failed:', err);
    }
  }, []);

  // Fetch remote Payments via encrypted API route
  const refreshRemotePayments = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      const res = await secureFetch('/api/payments', { accessToken: activeToken });
      if (res.ok && res.data?.success && Array.isArray(res.data.payments)) {
        const rawPayments: PaymentRecord[] = res.data.payments;
        const deduplicatedMap = new Map<string, PaymentRecord>();
        const duplicateIdsToDelete: string[] = [];

        rawPayments.forEach((p) => {
          // Identify matching period if any
          const matchingPp = (payPeriodsRef.current || []).find(
            (pp) =>
              pp.id === p.pay_period_id ||
              (p.month && pp.start_date.startsWith(p.month)) ||
              p.pay_period_id === `month-${pp.start_date.slice(0, 7)}`
          );
          const normalizedPeriodId = matchingPp ? matchingPp.id : p.pay_period_id;
          const normalizedMonth = p.month || (matchingPp ? matchingPp.start_date.slice(0, 7) : undefined);

          const matchedUser = (usersRef.current || []).find(
            (u) =>
              u.id === p.user_id ||
              (u.email && u.email.toLowerCase() === p.user_id?.toLowerCase()) ||
              (u.employee_no && u.employee_no === p.user_id)
          );
          const canonicalUserId = matchedUser ? matchedUser.id : p.user_id;
          const key = `${canonicalUserId}_${normalizedPeriodId}`;

          const existing = deduplicatedMap.get(key);
          if (!existing) {
            deduplicatedMap.set(key, {
              ...p,
              user_id: canonicalUserId,
              pay_period_id: normalizedPeriodId,
              month: normalizedMonth,
            });
          } else {
            // Determine winner: prefer paid over pending, prefer valid reference_no
            const isPBetter =
              (p.status === 'paid' && existing.status !== 'paid') ||
              (Boolean(p.reference_no) && !existing.reference_no) ||
              (!p.pay_period_id.startsWith('month-') && existing.pay_period_id.startsWith('month-'));

            const winner = isPBetter ? p : existing;
            const loser = isPBetter ? existing : p;

            if (loser.id && loser.id !== winner.id) {
              duplicateIdsToDelete.push(loser.id);
            }

            // Merge lines from both winner and loser so non-hours additions (bonuses/allowances) are never lost
            const winnerLines = Array.isArray(winner.lines) ? winner.lines : [];
            const loserLines = Array.isArray(loser.lines) ? loser.lines : [];
            const mergedLinesMap = new Map<string, PaymentLine>();

            winnerLines.forEach((l) => {
              const lKey = l.id || `${l.line_type}_${l.category || ''}_${l.amount}`;
              mergedLinesMap.set(lKey, l);
            });
            loserLines.forEach((l) => {
              if (l.line_type !== 'hours') {
                const lKey = l.id || `${l.line_type}_${l.category || ''}_${l.amount}`;
                if (!mergedLinesMap.has(lKey)) {
                  mergedLinesMap.set(lKey, l);
                }
              }
            });

            const mergedLines = Array.from(mergedLinesMap.values());
            const recalculatedGross = mergedLines.length > 0
              ? Math.round(mergedLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
              : winner.gross_amount;

            deduplicatedMap.set(key, {
              ...winner,
              user_id: canonicalUserId,
              pay_period_id: normalizedPeriodId,
              month: normalizedMonth || winner.month,
              status: winner.status === 'paid' || loser.status === 'paid' ? 'paid' : winner.status,
              method: winner.method || loser.method,
              reference_no: winner.reference_no || loser.reference_no,
              paid_at: winner.paid_at || loser.paid_at,
              lines: mergedLines,
              gross_amount: recalculatedGross,
            });
          }
        });

        const cleanedPayments = Array.from(deduplicatedMap.values());
        setPayments((prev) => {
          if (prev.length === cleanedPayments.length && JSON.stringify(prev) === JSON.stringify(cleanedPayments)) {
            return prev;
          }
          return cleanedPayments;
        });

        if (duplicateIdsToDelete.length > 0) {
          duplicateIdsToDelete.forEach((dupId) => {
            deletePaymentByIdFromSupabase(dupId);
          });
        }
      }
    } catch (err) {
      console.warn('Encrypted /api/payments fetch failed:', err);
    }
  }, [deletePaymentByIdFromSupabase]);

  // Fetch remote Corrections via encrypted API route
  const refreshRemoteCorrections = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      const res = await secureFetch('/api/corrections', { accessToken: activeToken });
      if (res.ok && res.data?.success && Array.isArray(res.data.corrections)) {
        setCorrections((prev) => {
          if (prev.length === res.data.corrections.length && JSON.stringify(prev) === JSON.stringify(res.data.corrections)) {
            return prev;
          }
          return res.data.corrections;
        });
      }
    } catch (err) {
      console.warn('Encrypted /api/corrections fetch failed:', err);
    }
  }, []);

  // Fetch remote Reimbursements via encrypted API route
  const refreshRemoteReimbursements = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      const res = await secureFetch('/api/reimbursements', { accessToken: activeToken });
      if (res.ok && res.data?.success && Array.isArray(res.data.reimbursements)) {
        setReimbursements((prev) => {
          if (prev.length === res.data.reimbursements.length && JSON.stringify(prev) === JSON.stringify(res.data.reimbursements)) {
            return prev;
          }
          return res.data.reimbursements;
        });
      }
    } catch (err) {
      console.warn('Encrypted /api/reimbursements fetch failed:', err);
    }
  }, []);

  // Fetch remote System Settings via encrypted API route
  const refreshRemoteSettings = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      const res = await secureFetch('/api/settings', { accessToken: activeToken });
      if (res.ok && res.data?.success && res.data.settings) {
        setSettings((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(res.data.settings)) {
            return prev;
          }
          return res.data.settings;
        });
      }
    } catch (err) {
      console.warn('Encrypted /api/settings fetch failed:', err);
    }
  }, []);

  // Fetch remote Audit Logs via encrypted API route
  const refreshRemoteAuditLogs = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      const res = await secureFetch('/api/audit', { accessToken: activeToken });
      if (res.ok && res.data?.success && Array.isArray(res.data.logs)) {
        setAuditLogs((prev) => {
          if (prev.length === res.data.logs.length && JSON.stringify(prev) === JSON.stringify(res.data.logs)) {
            return prev;
          }
          return res.data.logs;
        });
      }
    } catch (err) {
      console.warn('Encrypted /api/audit fetch failed:', err);
    }
  }, []);

  // Fetch remote Monthly Self-Approvals via encrypted API route
  const refreshRemoteApprovals = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      const res = await secureFetch('/api/approvals', { accessToken: activeToken });
      if (res.ok && res.data?.success && Array.isArray(res.data.approvals)) {
        const mapped = res.data.approvals.map((a: any) => {
          const refMatch = a.employee_note?.match(/\[REF:(.*?)\]/);
          const ref = a.reference_no || (refMatch ? refMatch[1] : `REF-DTR-${(a.month || '').replace(/[^0-9]/g, '')}-${(a.user_id || '').slice(0, 8).toUpperCase()}`);
          return {
            ...a,
            reference_no: ref,
          };
        });
        setMonthlySelfApprovals((prev) => {
          if (prev.length === mapped.length && JSON.stringify(prev) === JSON.stringify(mapped)) {
            return prev;
          }
          return mapped;
        });
      }
    } catch (err) {
      console.warn('Encrypted /api/approvals fetch failed:', err);
    }
  }, []);

  // Fetch remote Wage History via encrypted API route
  const refreshRemoteWageHistory = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      const res = await secureFetch('/api/wage-history', { accessToken: activeToken });
      if (res.ok && res.data?.success && Array.isArray(res.data.wageHistory)) {
        setWageHistory((prev) => {
          if (prev.length === res.data.wageHistory.length && JSON.stringify(prev) === JSON.stringify(res.data.wageHistory)) {
            return prev;
          }
          return res.data.wageHistory;
        });
      }
    } catch (err) {
      console.warn('Encrypted /api/wage-history fetch failed:', err);
    }
  }, []);

  // Fetch remote Notifications via encrypted API route
  const refreshRemoteNotifications = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) return;
    try {
      const res = await secureFetch('/api/notifications', { accessToken: activeToken });
      if (res.ok && res.data?.success && Array.isArray(res.data.notifications)) {
        setNotifications((prev) => {
          if (prev.length === res.data.notifications.length && JSON.stringify(prev) === JSON.stringify(res.data.notifications)) {
            return prev;
          }
          return res.data.notifications;
        });
      }
    } catch (err) {
      console.warn('Encrypted /api/notifications fetch failed:', err);
    }
  }, []);

  // Master refresh function to synchronize all Supabase business collections
  const refreshAllRemoteData = useCallback(async (token?: string) => {
    const activeToken = token || sessionRef.current?.access_token;
    if (!activeToken) return;
    if (isRefreshingAllRef.current) return;
    isRefreshingAllRef.current = true;
    try {
      await Promise.allSettled([
        refreshRemoteProfiles(activeToken),
        refreshRemoteDtrEntries(activeToken),
        refreshRemotePayPeriods(activeToken),
        refreshRemotePayments(activeToken),
        refreshRemoteCorrections(activeToken),
        refreshRemoteReimbursements(activeToken),
        refreshRemoteSettings(activeToken),
        refreshRemoteAuditLogs(activeToken),
        refreshRemoteApprovals(activeToken),
        refreshRemoteWageHistory(activeToken),
        refreshRemoteNotifications(activeToken),
      ]);
    } finally {
      isRefreshingAllRef.current = false;
    }
  }, [
    refreshRemoteProfiles,
    refreshRemoteDtrEntries,
    refreshRemotePayPeriods,
    refreshRemotePayments,
    refreshRemoteCorrections,
    refreshRemoteReimbursements,
    refreshRemoteSettings,
    refreshRemoteAuditLogs,
    refreshRemoteApprovals,
    refreshRemoteWageHistory,
    refreshRemoteNotifications,
  ]);

  const refreshAllRemoteDataRef = React.useRef(refreshAllRemoteData);
  refreshAllRemoteDataRef.current = refreshAllRemoteData;

  // Periodic sync: ONLY runs when actively authenticated with a valid session (every 30 seconds)
  useEffect(() => {
    if (!session?.user?.id) return;

    const interval = setInterval(() => {
      const activeToken = sessionRef.current?.access_token;
      if (activeToken) {
        refreshAllRemoteDataRef.current(activeToken);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [session?.user?.id]);

  // Listen to Supabase Auth state: mounts ONCE to prevent infinite re-subscription loops
  useEffect(() => {
    let isMounted = true;

    // Check if user landed from a password recovery link
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      if (
        hash.includes('type=recovery') ||
        search.includes('type=recovery')
      ) {
        setIsPasswordRecovery(true);
      }

      // Check for in-app recovery link query parameters
      const searchParams = new URLSearchParams(search);
      const recEmail = searchParams.get('recovery_email');
      const recToken = searchParams.get('recovery_token');
      if (recEmail && recToken) {
        supabase.auth.verifyOtp({
          email: recEmail,
          token: recToken,
          type: 'recovery',
        }).then(({ error }) => {
          if (!error) {
            setIsPasswordRecovery(true);
            try {
              window.history.replaceState({}, document.title, window.location.pathname);
            } catch {
              // ignore
            }
          }
        });
      }
    }

    // 1. Immediately inspect localStorage on mount for existing Supabase session and cached user profile
    if (typeof window !== 'undefined') {
      const stored = getStoredSupabaseSession();
      if (stored?.user && stored?.session) {
        setSession(stored.session);
        setSupabaseUser(stored.user);
        const cached = getCachedUser(stored.user.id) || createProvisionalUser(stored.user);
        setUsers((prev) => {
          if (prev.some((u) => u.id === stored.user.id)) return prev;
          return [cached, ...prev];
        });
        setCurrentUserId(stored.user.id);
        setIsAuthLoading(false);
      }
    }

    supabase.auth.getSession().then(async ({ data: { session: initSession } }) => {
      if (!isMounted) return;
      if (initSession?.user && initSession?.access_token) {
        setSession(initSession);
        setSupabaseUser(initSession.user);
        const cached = getCachedUser(initSession.user.id) || createProvisionalUser(initSession.user);
        setUsers((prev) => {
          if (prev.some((u) => u.id === initSession.user.id)) return prev;
          return [cached, ...prev];
        });
        setCurrentUserId((prev) => prev || initSession.user.id);
        setIsAuthLoading(false);

        await syncUserFromSupabaseRef.current(initSession.user, initSession.access_token);
        refreshAllRemoteDataRef.current(initSession.access_token);
      } else if (!initSession) {
        setIsAuthLoading(false);
      }
    }).catch(() => {
      if (isMounted) setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setSession(newSession);
      setSupabaseUser(newSession?.user ?? null);

      if (newSession?.user) {
        const cached = getCachedUser(newSession.user.id) || createProvisionalUser(newSession.user);
        setUsers((prev) => {
          if (prev.some((u) => u.id === newSession.user.id)) return prev;
          return [cached, ...prev];
        });
        setCurrentUserId((prev) => prev || newSession.user.id);
        setIsAuthLoading(false);

        if (newSession.access_token) {
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
            await syncUserFromSupabaseRef.current(newSession.user, newSession.access_token);
            refreshAllRemoteDataRef.current(newSession.access_token);
          }
        }
      } else if (event === 'SIGNED_OUT' || !newSession) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(STORAGE_KEY_LAST_ACTIVE_USER);
          } catch {}
        }
        setCurrentUserId(null);
        setUsers([]);
        setDtrEntries([]);
        setPayPeriods(INITIAL_PAY_PERIODS);
        setPayments([]);
        setCorrections([]);
        setAuditLogs([]);
        setMonthlySelfApprovals([]);
        setNotifications([]);
        setWageHistory([]);
        setIsAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const currentUser = useMemo(() => {
    if (supabaseUser) {
      const match = users.find(
        (u) => u.id === supabaseUser.id || u.email.toLowerCase() === supabaseUser.email?.toLowerCase()
      );
      if (match) return match;

      // Check synchronous localStorage cache
      const cached = getCachedUser(supabaseUser.id);
      if (cached && (cached.id === supabaseUser.id || cached.email.toLowerCase() === supabaseUser.email?.toLowerCase())) {
        return cached;
      }

      // Build provisional user immediately so currentUser is never anonymous while authenticated
      return createProvisionalUser(supabaseUser);
    }
    if (currentUserId) {
      const match = users.find((u) => u.id === currentUserId);
      if (match) return match;
    }
    return ANONYMOUS_USER;
  }, [users, currentUserId, supabaseUser]);

  const switchUserById = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (target) {
      setCurrentUserId(target.id);
    }
  };

  const setSimulatedClock = (date: string, time: string) => {
    setSimulatedClockState({ date, time });
    setNow(new Date());
  };

  const resetToRealClock = () => {
    setSimulatedClockState(null);
    setNow(new Date());
  };

  const resetAllDataToDefaults = () => {
    setUsers([]);
    setDtrEntries([]);
    setCorrections([]);
    setPayPeriods(INITIAL_PAY_PERIODS);
    setPayments([]);
    setAuditLogs([]);
    setSettings(INITIAL_SETTINGS);
    setWageHistory([]);
    setCurrentUserId(null);
    setSimulatedClockState(null);
  };

  // SECURITY & PRIVACY RULE:
  // Visible users:
  // - System Admin can see ALL users.
  // - Admin and Employee NEVER see `is_hidden = true` users (System Admin).
  const visibleUsers = useMemo(() => {
    if (currentUser.role === 'system_admin') {
      return users;
    }
    return users.filter((u) => !u.is_hidden);
  }, [users, currentUser.role]);

  // Visible Audit Logs:
  // System scope logs are only visible to System Admin.
  const visibleAuditLogs = useMemo(() => {
    if (currentUser.role === 'system_admin') {
      return auditLogs;
    }
    return auditLogs.filter((log) => !log.is_system_scope);
  }, [auditLogs, currentUser.role]);

  // Current open session for current user
  const currentOpenSession = useMemo(() => {
    if (!currentUser || !currentUser.id) return null;
    return (
      dtrEntries.find(
        (entry) =>
          (entry.user_id === currentUser.id ||
            (currentUser.email && entry.user_id?.toLowerCase() === currentUser.email.toLowerCase())) &&
          entry.time_out === null &&
          entry.status === 'open'
      ) || null
    );
  }, [dtrEntries, currentUser]);

  // Helper to append audit log
  const logAction = (params: {
    action: string;
    entity_type: string;
    entity_id: string;
    details: string;
    is_system_scope?: boolean;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }) => {
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actor_id: currentUser.id,
      actor_name: `${currentUser.first_name} ${currentUser.last_name}`,
      actor_role: currentUser.role,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      details: params.details,
      before: params.before || null,
      after: params.after || null,
      is_system_scope: !!params.is_system_scope,
      created_at: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    syncAuditLogToSupabase(newLog);
  };

  // Helper: Find current pay period for user on a workDate
  const findPayPeriodForUser = (user: User, workDate: string): PayPeriod => {
    const targetFreq = user.pay_frequency || 'monthly';
    const matching = payPeriods.find(
      (p) =>
        p.frequency === targetFreq &&
        p.start_date <= workDate &&
        p.end_date >= workDate &&
        p.status !== 'purged'
    );
    if (matching) return matching;

    // Dynamically auto-create monthly period if on monthly frequency
    if (targetFreq === 'monthly' && workDate && workDate.length >= 7) {
      const [yStr, mStr] = workDate.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(y) && !isNaN(m)) {
        const newPeriod = createMonthlyPayPeriod(
          y,
          m,
          settings.pay_date_rule_monthly || '1st',
          settings.weekend_pay_date_handling || 'next_business_day',
          'open'
        );
        setPayPeriods((prev) => {
          if (prev.some((p) => p.id === newPeriod.id)) return prev;
          return [newPeriod, ...prev];
        });
        syncPayPeriodToSupabase(newPeriod);
        return newPeriod;
      }
    }

    // Fallback: return any open period or first period
    const openPeriod = payPeriods.find((p) => p.frequency === targetFreq && p.status === 'open');
    return openPeriod || payPeriods[0];
  };

  // DTR: Employee Files DTR Entry (Date, Start Time, End Time, Remarks)
  const fileDtrEntry = (params: {
    work_date: string;
    time_in: string;
    time_out: string;
    remarks: string;
  }) => {
    if (!currentUser.clocks_in && currentUser.role !== 'employee') {
      return { success: false, message: 'Filing DTR is disabled for this administrative account.' };
    }
    if (!currentUser.hourly_rate || currentUser.hourly_rate <= 0) {
      return { success: false, message: 'Cannot file DTR: No hourly wage has been configured by management.' };
    }
    if (!params.work_date) {
      return { success: false, message: 'Work date is required.' };
    }

    // Strict Finalization Enforcement: Cannot add time entry if month is finalized and confirmed
    const targetMonth = params.work_date.slice(0, 7);
    const isTargetMonthFinalized = monthlySelfApprovals.some(
      (a) => a.user_id === currentUser.id && a.month === targetMonth
    );
    if (isTargetMonthFinalized) {
      return {
        success: false,
        message: `Cannot file DTR: DTR records for ${formatMonthYear(targetMonth)} have already been finalized and certified. New time entries cannot be added to a finalized month.`,
      };
    }
    if (!params.time_in || !params.time_out) {
      return { success: false, message: 'Both start time and end time are required.' };
    }

    const minutesWorked = computeMinutesWorked(params.time_in, params.time_out);
    if (minutesWorked <= 0) {
      return { success: false, message: 'End time must be later than start time.' };
    }

    const decimalHours = minutesToDecimalHours(minutesWorked);
    if (decimalHours > 24) {
      return { success: false, message: 'Single shift duration cannot exceed 24 hours.' };
    }

    // Check remarks minimum length
    const minRemarks = settings.remarks_min_length || 10;
    if (!params.remarks || params.remarks.trim().length < minRemarks) {
      return {
        success: false,
        message: `Accomplishment remarks required with at least ${minRemarks} characters.`,
      };
    }

    // Overlap check with user's non-rejected entries on the same date
    const overlaps = dtrEntries.some(
      (e) =>
        e.user_id === currentUser.id &&
        e.work_date === params.work_date &&
        e.status !== 'rejected' &&
        e.time_out &&
        checkIntervalOverlap(params.time_in, params.time_out, e.time_in, e.time_out)
    );
    if (overlaps) {
      return {
        success: false,
        message: 'The specified time interval overlaps with an existing filed DTR entry on that date.',
      };
    }

    // Find assigned pay period
    const assignedPeriod = findPayPeriodForUser(currentUser, params.work_date);
    if (assignedPeriod.status === 'locked' || assignedPeriod.status === 'closed') {
      return {
        success: false,
        message: `The pay period covering ${params.work_date} is ${assignedPeriod.status.toUpperCase()}. New filings cannot be added to closed or locked periods.`,
      };
    }

    // Calculate max-hour limits for the day and month
    const dayLimit = currentUser.max_hours_day ?? settings.company_max_hours.day ?? 8.0;
    const monthLimit = currentUser.max_hours_month ?? settings.company_max_hours.month ?? 160.0;

    // Sum prior approved/submitted hours on that work_date
    const priorDayHours = dtrEntries
      .filter(
        (e) =>
          e.user_id === currentUser.id &&
          e.work_date === params.work_date &&
          e.status !== 'rejected'
      )
      .reduce((sum, e) => sum + (e.hours || 0), 0);

    // Sum prior approved/submitted hours in the monthly period
    const monthPrefix = params.work_date.slice(0, 7);
    const priorMonthHours = dtrEntries
      .filter(
        (e) =>
          e.user_id === currentUser.id &&
          (e.pay_period_id === assignedPeriod.id || e.work_date.startsWith(monthPrefix)) &&
          e.status !== 'rejected'
      )
      .reduce((sum, e) => sum + (e.hours || 0), 0);

    let regular = decimalHours;
    let extra = 0;
    let extraStatus: DtrEntry['extra_hours_status'] = 'none';
    let extraLimitType: 'day' | 'week' | 'month' | null = null;
    let extraNote = '';

    // Check daily threshold
    if (dayLimit && priorDayHours + decimalHours > dayLimit) {
      const allowedToday = Math.max(0, dayLimit - priorDayHours);
      regular = Math.min(decimalHours, allowedToday);
      extra = Math.round((decimalHours - regular) * 100) / 100;
      if (extra > 0) {
        extraStatus = 'pending';
        extraLimitType = 'day';
        extraNote = `Crossed daily limit of ${dayLimit.toFixed(2)}h by ${extra.toFixed(2)}h`;
      }
    }

    // Check monthly threshold for monthly basis timekeeping
    if (monthLimit && priorMonthHours + regular > monthLimit) {
      const allowedThisMonth = Math.max(0, monthLimit - priorMonthHours);
      if (allowedThisMonth < regular) {
        const monthExtra = Math.round((regular - allowedThisMonth) * 100) / 100;
        regular = allowedThisMonth;
        extra = Math.round((decimalHours - regular) * 100) / 100;
        extraStatus = 'pending';
        if (!extraLimitType) {
          extraLimitType = 'month';
          extraNote = `Crossed monthly limit of ${monthLimit.toFixed(2)}h by ${extra.toFixed(2)}h`;
        } else {
          extraNote += `; also crossed monthly limit of ${monthLimit.toFixed(2)}h by ${monthExtra.toFixed(2)}h`;
        }
      }
    }

    const isAutoApproved = extra === 0;
    const newStatus: DtrEntry['status'] = extra > 0 ? 'extra_hours_pending' : 'approved';

    const newEntry: DtrEntry = {
      id: `dtr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: currentUser.id,
      work_date: params.work_date,
      time_in: params.time_in,
      time_out: params.time_out,
      remarks: params.remarks.trim(),
      minutes_worked: minutesWorked,
      hours: decimalHours,
      regular_hours: regular,
      extra_hours: extra,
      extra_hours_status: extraStatus,
      extra_hours_limit: extraLimitType,
      extra_hours_note: extraNote,
      payable_hours: regular,
      hourly_rate_snapshot: currentUser.hourly_rate,
      status: newStatus,
      reviewed_by_name: isAutoApproved ? 'System Auto-Approved' : undefined,
      reviewed_at: isAutoApproved ? new Date().toISOString() : undefined,
      source: 'self',
      pay_period_id: assignedPeriod.id,
      revisions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setDtrEntries((prev) => [newEntry, ...prev.filter((e) => e.id !== newEntry.id)]);
    syncDtrToSupabase(newEntry);
    logAction({
      action: 'DTR_FILED',
      entity_type: 'dtr_entry',
      entity_id: newEntry.id,
      details: `${currentUser.first_name} filed DTR for ${formatDate(params.work_date)} (${formatTime(params.time_in)} – ${formatTime(params.time_out)}, ${decimalHours.toFixed(2)}h)${isAutoApproved ? ' [Auto-Approved]' : ' [Extra Hours Pending]'}. Accomplishments: "${params.remarks.trim().slice(0, 50)}..."`,
    });

    return {
      success: true,
      message: `DTR entry filed successfully (${decimalHours.toFixed(2)} hours logged).${
        extra > 0
          ? ` Note: ${extra.toFixed(2)} extra hours awaiting administrator approval.`
          : ' Entry automatically approved.'
      }`,
      entry: newEntry,
    };
  };

  // DTR: Auto-close a forgotten punch-out once the session reaches MAX_SESSION_HOURS.
  // The server applies the same rule on every DTR load; this closes it immediately in the open app.
  const autoClosedSessionIdsRef = React.useRef<Set<string>>(new Set());
  const autoCloseOpenSession = (session: DtrEntry): DtrEntry => {
    const dayLimit = currentUser.max_hours_day ?? settings.company_max_hours.day ?? 8.0;
    const monthLimit = currentUser.max_hours_month ?? settings.company_max_hours.month ?? 160.0;
    const others = dtrEntries.filter(
      (e) => e.user_id === session.user_id && e.id !== session.id && e.status !== 'rejected'
    );
    const closed = buildAutoClosedEntry(session, {
      dayLimit,
      monthLimit,
      priorDayHours: others.filter((e) => e.work_date === session.work_date).reduce((sum, e) => sum + (e.hours || 0), 0),
      priorMonthHours: others
        .filter((e) => e.work_date.startsWith(session.work_date.slice(0, 7)))
        .reduce((sum, e) => sum + (e.hours || 0), 0),
    });

    autoClosedSessionIdsRef.current.add(session.id);
    setDtrEntries((prev) => prev.map((e) => (e.id === closed.id ? closed : e)));
    syncDtrToSupabase(closed);
    logAction({
      action: 'DTR_AUTO_CLOSED',
      entity_type: 'dtr_entry',
      entity_id: closed.id,
      details: `Session from ${formatDate(session.work_date)} ${formatTime(session.time_in)} had no punch-out and was automatically closed at ${formatTime(closed.time_out || '')} after the ${MAX_SESSION_HOURS}-hour maximum. Flagged for admin review.`,
    });
    return closed;
  };

  useEffect(() => {
    if (!currentOpenSession || autoClosedSessionIdsRef.current.has(currentOpenSession.id)) return;
    if (!isSessionOverMaxDuration(currentOpenSession, serverCurrentDate, serverCurrentTime)) return;
    const staleSession = currentOpenSession;
    const timer = setTimeout(() => {
      if (!autoClosedSessionIdsRef.current.has(staleSession.id)) autoCloseOpenSession(staleSession);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOpenSession, serverCurrentDate, serverCurrentTime]);

  // DTR: Time In
  const timeIn = () => {
    if (!currentUser.clocks_in) {
      return { success: false, message: 'Clocking in is disabled for this account.' };
    }
    if (currentOpenSession && isSessionOverMaxDuration(currentOpenSession, serverCurrentDate, serverCurrentTime)) {
      const closed = autoCloseOpenSession(currentOpenSession);
      return {
        success: false,
        message: `Your previous session from ${formatDate(closed.work_date)} had no punch-out and was automatically closed at ${formatTime(closed.time_out || '')} (${MAX_SESSION_HOURS}-hour maximum). Please clock in again.`,
      };
    }
    if (currentOpenSession) {
      return { success: false, message: 'You already have an active open session. Please clock out first.' };
    }
    if (!currentUser.hourly_rate || currentUser.hourly_rate <= 0) {
      return { success: false, message: 'Cannot clock in: No hourly wage has been configured by management.' };
    }

    // Strict Finalization Enforcement: Cannot punch in if the current month is finalized and confirmed
    const currentMonthPrefix = serverCurrentDate.slice(0, 7);
    const isCurrentMonthFinalized = monthlySelfApprovals.some(
      (a) => a.user_id === currentUser.id && a.month === currentMonthPrefix
    );
    if (isCurrentMonthFinalized) {
      return {
        success: false,
        message: `Cannot clock in: DTR records for ${formatMonthYear(currentMonthPrefix)} have already been finalized and certified. New time entries cannot be added to a finalized month.`,
      };
    }

    const assignedPeriod = findPayPeriodForUser(currentUser, serverCurrentDate);
    if (assignedPeriod.status === 'locked' || assignedPeriod.status === 'closed') {
      return {
        success: false,
        message: `The pay period covering ${serverCurrentDate} is ${assignedPeriod.status.toUpperCase()}. Clocking in is disabled for closed or locked periods.`,
      };
    }

    // Overlap check with user's non-rejected entries on the same date
    const overlaps = dtrEntries.some(
      (e) =>
        e.user_id === currentUser.id &&
        e.work_date === serverCurrentDate &&
        e.status !== 'rejected' &&
        e.time_out &&
        checkIntervalOverlap(serverCurrentTime, null, e.time_in, e.time_out)
    );
    if (overlaps) {
      return {
        success: false,
        message: `Cannot clock in: Current server time ${formatTime(serverCurrentTime)} overlaps with an existing filed DTR entry on ${formatDate(serverCurrentDate)}.`,
      };
    }

    const newEntry: DtrEntry = {
      id: `dtr-${Date.now()}`,
      user_id: currentUser.id,
      work_date: serverCurrentDate,
      time_in: serverCurrentTime,
      time_out: null,
      remarks: '',
      minutes_worked: 0,
      hours: 0,
      regular_hours: 0,
      extra_hours: 0,
      extra_hours_status: 'none',
      payable_hours: 0,
      hourly_rate_snapshot: currentUser.hourly_rate,
      status: 'open',
      source: 'self',
      pay_period_id: assignedPeriod.id,
      revisions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setDtrEntries((prev) => [newEntry, ...prev.filter((e) => e.id !== newEntry.id)]);
    syncDtrToSupabase(newEntry);
    logAction({
      action: 'DTR_TIME_IN',
      entity_type: 'dtr_entry',
      entity_id: newEntry.id,
      details: `${currentUser.first_name} clocked in at ${formatTime(serverCurrentTime)} on ${formatDate(serverCurrentDate)}`,
    });

    return { success: true, message: `Clocked in successfully at ${formatTime(serverCurrentTime)}` };
  };

  // DTR: Cancel accidental clock-in
  const cancelClockIn = (reason?: string) => {
    if (!currentOpenSession) {
      return { success: false, message: 'No active open session to cancel.' };
    }
    const sessionId = currentOpenSession.id;
    setDtrEntries((prev) => prev.filter((e) => e.id !== sessionId));
    deleteDtrFromSupabase(sessionId);
    logAction({
      action: 'DTR_PUNCH_CANCELLED',
      entity_type: 'dtr_entry',
      entity_id: sessionId,
      details: `${currentUser.first_name} cancelled open session clocked in at ${formatTime(currentOpenSession.time_in)}${
        reason ? ` (Reason: ${reason})` : ''
      }`,
    });
    return { success: true, message: 'Active punch session cancelled and discarded.' };
  };

  // DTR: Time Out
  const timeOut = (remarks: string) => {
    if (!currentOpenSession) {
      return { success: false, message: 'No open session found to clock out from.' };
    }
    if (isSessionOverMaxDuration(currentOpenSession, serverCurrentDate, serverCurrentTime)) {
      const closed = autoCloseOpenSession(currentOpenSession);
      return {
        success: false,
        message: `This session passed the ${MAX_SESSION_HOURS}-hour maximum and was automatically closed at ${formatTime(closed.time_out || '')}. It has been sent for admin review. File a correction if your actual time-out was different.`,
      };
    }
    if (!remarks || remarks.trim().length < settings.remarks_min_length) {
      return {
        success: false,
        message: `Remarks required with at least ${settings.remarks_min_length} characters describing accomplishments.`,
      };
    }

    let minutesWorked = computeMinutesWorked(
      currentOpenSession.time_in,
      serverCurrentTime,
      currentOpenSession.work_date,
      serverCurrentDate
    );
    if (minutesWorked <= 0) {
      minutesWorked = 1; // Minimum 1 minute if punched in and out within the same minute
    }
    const decimalHours = minutesToDecimalHours(minutesWorked);

    // Calculate max-hour limits for the day and month
    const dayLimit = currentUser.max_hours_day ?? settings.company_max_hours.day ?? 8.0;
    const monthLimit = currentUser.max_hours_month ?? settings.company_max_hours.month ?? 160.0;
    
    // Sum hours worked today prior to this session
    const priorTodayHours = dtrEntries
      .filter(
        (e) =>
          e.user_id === currentUser.id &&
          e.work_date === currentOpenSession.work_date &&
          e.id !== currentOpenSession.id &&
          e.status !== 'rejected'
      )
      .reduce((sum, e) => sum + (e.hours || 0), 0);

    // Sum prior hours in the monthly period
    const monthPrefix = currentOpenSession.work_date.slice(0, 7);
    const priorMonthHours = dtrEntries
      .filter(
        (e) =>
          e.user_id === currentUser.id &&
          e.id !== currentOpenSession.id &&
          (e.pay_period_id === currentOpenSession.pay_period_id || e.work_date.startsWith(monthPrefix)) &&
          e.status !== 'rejected'
      )
      .reduce((sum, e) => sum + (e.hours || 0), 0);

    let regular = decimalHours;
    let extra = 0;
    let extraStatus: DtrEntry['extra_hours_status'] = 'none';
    let extraLimitType: 'day' | 'week' | 'month' | null = null;
    let extraNote = '';

    // Check daily threshold
    if (dayLimit && priorTodayHours + decimalHours > dayLimit) {
      const allowedToday = Math.max(0, dayLimit - priorTodayHours);
      regular = Math.min(decimalHours, allowedToday);
      extra = Math.round((decimalHours - regular) * 100) / 100;
      if (extra > 0) {
        extraStatus = 'pending';
        extraLimitType = 'day';
        extraNote = `Crossed daily limit of ${dayLimit.toFixed(2)}h by ${extra.toFixed(2)}h`;
      }
    }

    // Check monthly threshold for monthly basis timekeeping
    if (monthLimit && priorMonthHours + regular > monthLimit) {
      const allowedThisMonth = Math.max(0, monthLimit - priorMonthHours);
      if (allowedThisMonth < regular) {
        const monthExtra = Math.round((regular - allowedThisMonth) * 100) / 100;
        regular = allowedThisMonth;
        extra = Math.round((decimalHours - regular) * 100) / 100;
        extraStatus = 'pending';
        if (!extraLimitType) {
          extraLimitType = 'month';
          extraNote = `Crossed monthly limit of ${monthLimit.toFixed(2)}h by ${extra.toFixed(2)}h`;
        } else {
          extraNote += `; also crossed monthly limit of ${monthLimit.toFixed(2)}h by ${monthExtra.toFixed(2)}h`;
        }
      }
    }

    const isAutoApproved = extra === 0;
    const newStatus: DtrEntry['status'] = extra > 0 ? 'extra_hours_pending' : 'approved';

    const updatedEntry: DtrEntry = {
      ...currentOpenSession,
      time_out: serverCurrentTime,
      remarks: remarks.trim(),
      minutes_worked: minutesWorked,
      hours: decimalHours,
      regular_hours: regular,
      extra_hours: extra,
      extra_hours_status: extraStatus,
      extra_hours_limit: extraLimitType,
      extra_hours_note: extraNote,
      payable_hours: regular,
      status: newStatus,
      reviewed_by_name: isAutoApproved ? 'System Auto-Approved' : undefined,
      reviewed_at: isAutoApproved ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    };

    setDtrEntries((prev) => prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e)));
    syncDtrToSupabase(updatedEntry);
    logAction({
      action: 'DTR_TIME_OUT',
      entity_type: 'dtr_entry',
      entity_id: updatedEntry.id,
      details: `${currentUser.first_name} timed out at ${serverCurrentTime} (${decimalHours}h recorded)${isAutoApproved ? ' [Auto-Approved]' : ' [Extra Hours Pending]'}. Remarks: "${remarks.slice(0, 40)}..."`,
    });

    return {
      success: true,
      message: `Clocked out successfully (${decimalHours.toFixed(2)} hours logged).${
        extra > 0
          ? ` Note: ${extra.toFixed(2)} extra hours awaiting admin approval.`
          : ' Timelog automatically approved.'
      }`,
    };
  };

  // Update remarks on an entry before finalization
  const updateRemarks = (entryId: string, newRemarks: string) => {
    const entry = dtrEntries.find((e) => e.id === entryId);
    if (!entry) return { success: false, message: 'Entry not found' };
    if (entry.user_id !== currentUser.id && currentUser.role === 'employee') {
      return { success: false, message: 'Unauthorized' };
    }
    if (entry.status === 'locked') {
      return { success: false, message: 'Cannot edit remarks on locked records.' };
    }
    if (entry.status === 'rejected') {
      return { success: false, message: 'Cannot edit remarks on rejected records.' };
    }
    const targetMonth = entry.work_date.slice(0, 7);
    const isTargetMonthFinalized = monthlySelfApprovals.some(
      (a) => a.user_id === currentUser.id && a.month === targetMonth
    );
    if (isTargetMonthFinalized || entry.self_approved) {
      return { success: false, message: 'Cannot edit remarks: This DTR record belongs to a month that has been finalized and certified.' };
    }
    if (!newRemarks || newRemarks.trim().length < settings.remarks_min_length) {
      return {
        success: false,
        message: `Remarks must be at least ${settings.remarks_min_length} characters.`,
      };
    }

    const updatedEntry: DtrEntry = {
      ...entry,
      remarks: newRemarks.trim(),
      updated_at: new Date().toISOString(),
    };

    setDtrEntries((prev) =>
      prev.map((e) => (e.id === entryId ? updatedEntry : e))
    );
    syncDtrToSupabase(updatedEntry);

    return { success: true, message: 'Remarks updated successfully.' };
  };

  // File correction request
  const fileCorrection = (params: {
    dtr_entry_id: string | null;
    work_date: string;
    requested_time_in: string;
    requested_time_out: string;
    reason: string;
  }) => {
    if (!params.reason || params.reason.trim().length < 5) {
      return { success: false, message: 'A detailed reason is required for correction requests.' };
    }

    // Strict Finalization Enforcement:
    const targetMonth = params.work_date.slice(0, 7);
    const isTargetMonthFinalized = monthlySelfApprovals.some(
      (a) => a.user_id === currentUser.id && a.month === targetMonth
    );
    if (isTargetMonthFinalized) {
      return {
        success: false,
        message: `Cannot submit correction: DTR records for ${formatMonthYear(targetMonth)} have already been finalized and certified.`,
      };
    }

    // Overlap check with existing sessions on same date
    const overlaps = dtrEntries.some(
      (e) =>
        e.user_id === currentUser.id &&
        e.work_date === params.work_date &&
        e.id !== params.dtr_entry_id &&
        e.status !== 'rejected' &&
        checkIntervalOverlap(params.requested_time_in, params.requested_time_out, e.time_in, e.time_out)
    );

    if (overlaps) {
      return {
        success: false,
        message: 'The requested time overlaps with an existing time entry on that date.',
      };
    }

    const newCorr: CorrectionRequest = {
      id: `corr-${Date.now()}`,
      user_id: currentUser.id,
      dtr_entry_id: params.dtr_entry_id,
      work_date: params.work_date,
      requested_time_in: params.requested_time_in,
      requested_time_out: params.requested_time_out,
      reason: params.reason.trim(),
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    setCorrections((prev) => [newCorr, ...prev]);
    syncCorrectionToSupabase(newCorr);
    logAction({
      action: 'CORRECTION_REQUESTED',
      entity_type: 'correction_request',
      entity_id: newCorr.id,
      details: `Correction requested by ${currentUser.first_name} for ${params.work_date} (${params.requested_time_in} - ${params.requested_time_out})`,
    });

    return { success: true, message: 'Correction request submitted for administrator review.' };
  };

  // Admin Approve Entry
  const approveDtrEntry = async (entryId: string): Promise<{ success: boolean; message: string }> => {
    if (currentUser.role === 'employee') return { success: false, message: 'Unauthorized' };
    const entry = dtrEntries.find((e) => e.id === entryId);
    if (!entry) return { success: false, message: 'Entry not found' };

    // Self-approval conflict check
    if (entry.user_id === currentUser.id && currentUser.role !== 'system_admin') {
      return { success: false, message: 'Conflict of interest: Administrators cannot approve their own DTR entries.' };
    }

    const reviewerName = `${currentUser.first_name || 'Admin'} ${currentUser.last_name || 'Reviewer'}`.trim();
    const updated: DtrEntry = {
      ...entry,
      status: 'approved',
      payable_hours: entry.regular_hours + (entry.extra_hours_status === 'approved' ? entry.extra_hours : 0),
      reviewed_by_name: reviewerName,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setDtrEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
    const syncRes = await syncDtrToSupabase(updated);
    if (!syncRes.success) {
      console.warn('Supabase sync warning on approveDtrEntry:', syncRes.error);
      return { success: false, message: syncRes.error || 'Failed to save approval to database.' };
    }

    logAction({
      action: 'DTR_APPROVED',
      entity_type: 'dtr_entry',
      entity_id: entryId,
      details: `Approved DTR entry for ${entry.hours}h`,
    });

    return { success: true, message: 'DTR entry approved successfully.' };
  };

  // Admin Reject Entry
  const rejectDtrEntry = (entryId: string, reason: string) => {
    if (currentUser.role === 'employee') return { success: false, message: 'Unauthorized' };
    if (!reason || reason.trim().length < 5) {
      return { success: false, message: 'A rejection reason is required (at least 5 characters).' };
    }

    const entry = dtrEntries.find((e) => e.id === entryId);
    if (!entry) return { success: false, message: 'Entry not found' };

    if (entry.user_id === currentUser.id && currentUser.role !== 'system_admin') {
      return { success: false, message: 'Cannot reject your own DTR entry.' };
    }

    const revision: DtrRevision = {
      id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      dtr_entry_id: entryId,
      changed_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
      display_actor: `${currentUser.first_name} ${currentUser.last_name}`,
      field: 'status',
      old_value: entry.status,
      new_value: 'rejected',
      reason: reason.trim(),
      changed_at: new Date().toISOString(),
    };

    const updated: DtrEntry = {
      ...entry,
      status: 'rejected',
      extra_hours_status: entry.extra_hours_status === 'pending' ? 'declined' : entry.extra_hours_status,
      extra_hours_note: reason.trim(),
      payable_hours: 0,
      reviewed_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revisions: [revision, ...(entry.revisions || [])],
    };

    setDtrEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
    syncDtrToSupabase(updated);

    logAction({
      action: 'DTR_REJECTED',
      entity_type: 'dtr_entry',
      entity_id: entryId,
      details: `Rejected DTR entry with reason: ${reason}`,
    });

    return { success: true, message: 'Entry rejected successfully.' };
  };

  // Extra Hours Decision: 'all' vs 'regular_only' vs 'reject'
  const approveExtraHours = (
    entryId: string,
    mode: 'all' | 'regular_only' | 'reject',
    declineReason?: string
  ) => {
    if (currentUser.role === 'employee') return { success: false, message: 'Unauthorized' };
    const entry = dtrEntries.find((e) => e.id === entryId);
    if (!entry) return { success: false, message: 'Entry not found' };

    if (entry.user_id === currentUser.id && currentUser.role !== 'system_admin') {
      return { success: false, message: 'Cannot decide on your own extra hours.' };
    }

    if (mode === 'reject') {
      return rejectDtrEntry(entryId, declineReason || '');
    }

    if (mode === 'regular_only' && (!declineReason || declineReason.trim().length < 5)) {
      return { success: false, message: 'A justification note is required to decline extra hours.' };
    }

    const updated: DtrEntry = {
      ...entry,
      status: 'approved',
      extra_hours_status: mode === 'all' ? 'approved' : 'declined',
      extra_hours_note: mode === 'regular_only' ? declineReason?.trim() : entry.extra_hours_note,
      payable_hours: mode === 'all' ? entry.hours : entry.regular_hours,
      reviewed_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setDtrEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
    syncDtrToSupabase(updated);

    logAction({
      action: mode === 'all' ? 'EXTRA_HOURS_APPROVED' : 'EXTRA_HOURS_DECLINED',
      entity_type: 'dtr_entry',
      entity_id: entryId,
      details:
        mode === 'all'
          ? `Approved all ${entry.hours}h (regular + extra) for session on ${entry.work_date}`
          : `Approved regular hours only (${entry.regular_hours}h); declined ${entry.extra_hours}h extra hours. Reason: ${declineReason}`,
    });

    return {
      success: true,
      message:
        mode === 'all'
          ? 'Approved all hours (regular and extra) successfully.'
          : 'Approved regular hours only; extra hours declined.',
    };
  };

  // Adjust times with required reason and revision history
  const adjustDtrTime = (
    entryId: string,
    newIn: string,
    newOut: string,
    reason: string
  ) => {
    if (currentUser.role === 'employee') return { success: false, message: 'Unauthorized' };
    if (!reason || reason.trim().length < 5) {
      return { success: false, message: 'A detailed adjustment reason is strictly required.' };
    }

    const entry = dtrEntries.find((e) => e.id === entryId);
    if (!entry) return { success: false, message: 'Entry not found' };

    // Locked period check
    const period = payPeriods.find((p) => p.id === entry.pay_period_id);
    if (period?.status === 'locked') {
      return { success: false, message: 'Pay period is locked. Only a system administrator can modify entries in locked periods.' };
    }

    // Overlap check
    const hasOverlap = dtrEntries.some(
      (e) =>
        e.user_id === entry.user_id &&
        e.work_date === entry.work_date &&
        e.id !== entryId &&
        e.status !== 'rejected' &&
        checkIntervalOverlap(newIn, newOut, e.time_in, e.time_out)
    );

    if (hasOverlap) {
      return { success: false, message: 'Adjusted times overlap with another recorded session on this date.' };
    }

    const minutesWorked = computeMinutesWorked(newIn, newOut);
    const decimalHours = minutesToDecimalHours(minutesWorked);

    const revision: DtrEntry['revisions'][0] = {
      id: `rev-${Date.now()}`,
      dtr_entry_id: entryId,
      changed_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
      display_actor: currentUser.role === 'system_admin' ? 'System Administrator' : `${currentUser.first_name} ${currentUser.last_name}`,
      field: 'time_in / time_out',
      old_value: `${entry.time_in} - ${entry.time_out || 'open'} (${entry.hours}h)`,
      new_value: `${newIn} - ${newOut} (${decimalHours}h)`,
      reason: reason.trim(),
      changed_at: new Date().toISOString(),
    };

    const updatedEntry: DtrEntry = {
      ...entry,
      time_in: newIn,
      time_out: newOut,
      minutes_worked: minutesWorked,
      hours: decimalHours,
      regular_hours: decimalHours,
      payable_hours: decimalHours,
      status: 'adjusted',
      revisions: [revision, ...entry.revisions],
      updated_at: new Date().toISOString(),
    };

    setDtrEntries((prev) =>
      prev.map((e) => (e.id === entryId ? updatedEntry : e))
    );
    syncDtrToSupabase(updatedEntry);

    logAction({
      action: 'DTR_ADJUSTED',
      entity_type: 'dtr_entry',
      entity_id: entryId,
      details: `Adjusted time from ${entry.time_in}-${entry.time_out} to ${newIn}-${newOut}. Reason: ${reason}`,
      before: { time_in: entry.time_in, time_out: entry.time_out, hours: entry.hours },
      after: { time_in: newIn, time_out: newOut, hours: decimalHours },
    });

    return { success: true, message: 'Entry adjusted and revision history updated.' };
  };

  // Time out on behalf of employee
  const timeOutOnBehalf = (
    entryId: string,
    timeOutStr: string,
    reason: string
  ) => {
    if (currentUser.role === 'employee') return { success: false, message: 'Unauthorized' };
    if (!reason || reason.trim().length < 5) {
      return { success: false, message: 'A mandatory justification reason is required to time out on employee behalf.' };
    }

    const entry = dtrEntries.find((e) => e.id === entryId);
    if (!entry) return { success: false, message: 'Entry not found' };

    const minutesWorked = computeMinutesWorked(entry.time_in, timeOutStr);
    const decimalHours = minutesToDecimalHours(minutesWorked);

    const revision: DtrEntry['revisions'][0] = {
      id: `rev-${Date.now()}`,
      dtr_entry_id: entryId,
      changed_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
      display_actor: currentUser.role === 'system_admin' ? 'System Administrator' : `${currentUser.first_name} ${currentUser.last_name}`,
      field: 'time_out',
      old_value: 'Open session (None)',
      new_value: `${timeOutStr} (${decimalHours}h)`,
      reason: `Timed out on behalf: ${reason.trim()}`,
      changed_at: new Date().toISOString(),
    };

    const updatedEntry: DtrEntry = {
      ...entry,
      time_out: timeOutStr,
      minutes_worked: minutesWorked,
      hours: decimalHours,
      regular_hours: decimalHours,
      payable_hours: decimalHours,
      status: 'adjusted',
      remarks: entry.remarks || '(Session closed by Administrator)',
      revisions: [revision, ...entry.revisions],
      updated_at: new Date().toISOString(),
    };

    setDtrEntries((prev) =>
      prev.map((e) => (e.id === entryId ? updatedEntry : e))
    );
    syncDtrToSupabase(updatedEntry);

    logAction({
      action: 'DTR_TIMEOUT_ON_BEHALF',
      entity_type: 'dtr_entry',
      entity_id: entryId,
      details: `Administrator timed out open session at ${timeOutStr}. Reason: ${reason}`,
    });

    return { success: true, message: 'Open session closed on behalf of employee.' };
  };

  // Bulk approve submitted entries with NO extra hours pending
  const bulkApproveEligible = async (): Promise<{ success: boolean; count: number; message?: string }> => {
    if (currentUser.role === 'employee') {
      return { success: false, count: 0, message: 'Unauthorized: Employees cannot approve timesheets.' };
    }

    const nowIso = new Date().toISOString();
    const reviewerName = `${currentUser.first_name || 'Admin'} ${currentUser.last_name || 'Reviewer'}`.trim();

    // Identify eligible entries to approve from current state directly
    const eligibleEntries = dtrEntries.filter((e) => {
      // Conflict of interest: regular admin cannot approve their own DTR entries
      if (e.user_id === currentUser.id && currentUser.role !== 'system_admin') {
        return false;
      }
      return (
        ['submitted', 'adjusted'].includes(e.status) &&
        e.extra_hours === 0 &&
        e.extra_hours_status === 'none'
      );
    });

    if (eligibleEntries.length === 0) {
      return { success: true, count: 0, message: 'No eligible entries to approve.' };
    }

    const approvedList: DtrEntry[] = eligibleEntries.map((e) => ({
      ...e,
      status: 'approved',
      payable_hours: e.hours,
      reviewed_by_name: reviewerName,
      reviewed_at: nowIso,
      updated_at: nowIso,
    }));

    // Optimistically update React state immediately
    const approvedMap = new Map(approvedList.map((e) => [e.id, e]));
    setDtrEntries((prev) => prev.map((e) => approvedMap.get(e.id) || e));

    // Await bulk sync directly to Supabase via encrypted /api/dtr batch
    const syncRes = await syncBulkDtrToSupabase(approvedList);

    if (!syncRes.success) {
      console.warn('Failed to sync bulk approvals to Supabase:', syncRes.error);
      return {
        success: false,
        count: approvedList.length,
        message: syncRes.error || 'Failed to save bulk approvals to the database.',
      };
    }

    logAction({
      action: 'DTR_BULK_APPROVED',
      entity_type: 'dtr_entry',
      entity_id: 'bulk',
      details: `Bulk approved and synced ${approvedList.length} standard entries without extra hours`,
    });

    return { success: true, count: approvedList.length };
  };

  // Approve Correction Request
  const approveCorrection = (id: string, note?: string) => {
    if (currentUser.role === 'employee') return { success: false, message: 'Unauthorized' };
    const corr = corrections.find((c) => c.id === id);
    if (!corr) return { success: false, message: 'Correction request not found' };

    // Update the DTR entry if one existed, or create new manual session
    const minutesWorked = computeMinutesWorked(corr.requested_time_in, corr.requested_time_out);
    const decimalHours = minutesToDecimalHours(minutesWorked);

    let updatedDtr: DtrEntry | null = null;
    if (corr.dtr_entry_id) {
      // Update existing entry
      setDtrEntries((prev) =>
        prev.map((e) => {
          if (e.id === corr.dtr_entry_id) {
            const rev: DtrEntry['revisions'][0] = {
              id: `rev-${Date.now()}`,
              dtr_entry_id: e.id,
              changed_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
              display_actor: currentUser.role === 'system_admin' ? 'System Administrator' : `${currentUser.first_name} ${currentUser.last_name}`,
              field: 'correction_approved',
              old_value: `${e.time_in} - ${e.time_out}`,
              new_value: `${corr.requested_time_in} - ${corr.requested_time_out}`,
              reason: `Employee correction approved: ${corr.reason}`,
              changed_at: new Date().toISOString(),
            };
            updatedDtr = {
              ...e,
              time_in: corr.requested_time_in,
              time_out: corr.requested_time_out,
              minutes_worked: minutesWorked,
              hours: decimalHours,
              regular_hours: decimalHours,
              payable_hours: decimalHours,
              status: 'adjusted',
              revisions: [rev, ...e.revisions],
              updated_at: new Date().toISOString(),
            };
            return updatedDtr;
          }
          return e;
        })
      );
      if (updatedDtr) {
        syncDtrToSupabase(updatedDtr);
      }
    } else {
      // Create new session from correction
      const targetUser = users.find((u) => u.id === corr.user_id);
      const period = targetUser ? findPayPeriodForUser(targetUser, corr.work_date) : payPeriods[0];
      const newEntry: DtrEntry = {
        id: `dtr-${Date.now()}`,
        user_id: corr.user_id,
        work_date: corr.work_date,
        time_in: corr.requested_time_in,
        time_out: corr.requested_time_out,
        remarks: `[Correction Request Approved] ${corr.reason}`,
        minutes_worked: minutesWorked,
        hours: decimalHours,
        regular_hours: decimalHours,
        extra_hours: 0,
        extra_hours_status: 'none',
        payable_hours: decimalHours,
        hourly_rate_snapshot: targetUser?.hourly_rate || DEFAULT_HOURLY_WAGE,
        status: 'approved',
        source: 'correction',
        pay_period_id: period.id,
        revisions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setDtrEntries((prev) => [newEntry, ...prev]);
      syncDtrToSupabase(newEntry);
    }

    const updatedCorr: CorrectionRequest = {
      ...corr,
      status: 'approved',
      reviewed_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
      review_note: note,
      reviewed_at: new Date().toISOString(),
    };

    setCorrections((prev) =>
      prev.map((c) => (c.id === id ? updatedCorr : c))
    );
    syncCorrectionToSupabase(updatedCorr);

    logAction({
      action: 'CORRECTION_APPROVED',
      entity_type: 'correction_request',
      entity_id: id,
      details: `Approved correction for ${corr.work_date} (${corr.requested_time_in}-${corr.requested_time_out})`,
    });

    return { success: true, message: 'Correction request approved.' };
  };

  // Reject Correction Request
  const rejectCorrection = (id: string, note: string) => {
    if (currentUser.role === 'employee') return { success: false, message: 'Unauthorized' };
    if (!note || note.trim().length < 3) {
      return { success: false, message: 'A rejection note explaining the reason is required.' };
    }

    const corr = corrections.find((c) => c.id === id);
    if (!corr) return { success: false, message: 'Correction request not found' };

    const updatedCorr: CorrectionRequest = {
      ...corr,
      status: 'rejected',
      reviewed_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
      review_note: note.trim(),
      reviewed_at: new Date().toISOString(),
    };

    setCorrections((prev) =>
      prev.map((c) => (c.id === id ? updatedCorr : c))
    );
    syncCorrectionToSupabase(updatedCorr);

    logAction({
      action: 'CORRECTION_REJECTED',
      entity_type: 'correction_request',
      entity_id: id,
      details: `Rejected correction request: ${note}`,
    });

    return { success: true, message: 'Correction request rejected.' };
  };

  // User Management
  const updateUser = async (updated: User) => {
    // 1. Immediately update in-memory state
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));

    const rawEmergency = updated.emergency_contact
      ? updated.emergency_contact.replace(/\s*\[PAYOUT:.*?\]/g, '').trim()
      : '';
    const syncedEmergency =
      updated.bank_name || updated.account_no
        ? `${rawEmergency} [PAYOUT:${updated.bank_name || ''}|${updated.account_no || ''}]`.trim()
        : rawEmergency;

    // 2. Persist to localStorage backup for instant reliability on reload
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${STORAGE_KEY_CACHED_USER_PREFIX}${updated.id}`, JSON.stringify(updated));
        localStorage.setItem(STORAGE_KEY_LAST_ACTIVE_USER, JSON.stringify(updated));
        localStorage.setItem(
          `wmedlaw_profile_details_${updated.id}`,
          JSON.stringify({
            contact_no: updated.contact_no || '',
            address: updated.address || '',
            emergency_contact: rawEmergency,
            bank_name: updated.bank_name || '',
            account_no: updated.account_no || '',
          })
        );
        localStorage.setItem(
          `wmedlaw_bank_details_${updated.id}`,
          JSON.stringify({
            bank_name: updated.bank_name || '',
            account_no: updated.account_no || '',
          })
        );
      }
    } catch {}

    // 3. Update via server API route (PATCH /api/users) with encrypted payload
    const activeToken = sessionRef.current?.access_token;
    if (activeToken) {
      try {
        const patchRes = await secureFetch('/api/users', {
          method: 'PATCH',
          accessToken: activeToken,
          body: {
            id: updated.id,
            first_name: updated.first_name,
            last_name: updated.last_name,
            contact_no: updated.contact_no,
            address: updated.address,
            emergency_contact: syncedEmergency,
            bank_name: updated.bank_name,
            account_no: updated.account_no,
            position: updated.position,
            department: updated.department,
            clocks_in: updated.clocks_in,
            hourly_rate: updated.hourly_rate,
            pay_frequency: updated.pay_frequency,
            max_hours_day: updated.max_hours_day,
            max_hours_week: updated.max_hours_week,
            max_hours_month: updated.max_hours_month,
          },
        });
        if (patchRes.ok && patchRes.data?.user) {
          const u = patchRes.data.user;
          setUsers((prev) =>
            prev.map((usr) =>
              usr.id === updated.id
                ? {
                    ...usr,
                    contact_no: u.contact_no ?? usr.contact_no,
                    address: u.address ?? usr.address,
                    emergency_contact: rawEmergency,
                    bank_name: u.bank_name ?? usr.bank_name,
                    account_no: u.account_no ?? usr.account_no,
                    position: u.position ?? updated.position ?? usr.position,
                    department: u.department ?? updated.department ?? usr.department,
                  }
                : usr
            )
          );
        }
      } catch (err) {
        console.warn('API /api/users sync warning:', err);
      }
    }

    // 4. Update Supabase Auth user_metadata if editing current user
    try {
      if (supabaseUser && (supabaseUser.id === updated.id || supabaseUser.email?.toLowerCase() === updated.email?.toLowerCase())) {
        await supabase.auth.updateUser({
          data: {
            first_name: updated.first_name || '',
            last_name: updated.last_name || '',
            contact_no: updated.contact_no || '',
            address: updated.address || '',
            emergency_contact: rawEmergency,
            bank_name: updated.bank_name || '',
            account_no: updated.account_no || '',
            position: updated.position || '',
            department: updated.department || '',
          },
        });
      }
    } catch (err) {
      console.warn('Supabase auth updateUser metadata warning:', err);
    }

    // 5. Also direct Supabase profiles table upsert
    try {
      await supabase.from('profiles').upsert({
        id: updated.id,
        email: updated.email,
        first_name: updated.first_name,
        last_name: updated.last_name,
        position: updated.position,
        department: updated.department,
        contact_no: updated.contact_no,
        address: updated.address,
        emergency_contact: syncedEmergency,
        bank_name: updated.bank_name,
        account_no: updated.account_no,
        clocks_in: updated.clocks_in,
        hourly_rate: updated.hourly_rate,
        pay_frequency: updated.pay_frequency,
        max_hours_day: updated.max_hours_day,
        max_hours_week: updated.max_hours_week,
        max_hours_month: updated.max_hours_month,
        status: updated.status,
        role: updated.role,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch {}

    logAction({
      action: 'USER_UPDATED',
      entity_type: 'user',
      entity_id: updated.id,
      details: `Updated user profile for ${updated.first_name} ${updated.last_name}`,
    });
  };

  const createUser = (data: Omit<User, 'id' | 'failed_login_count'>): User => {
    const newUser: User = {
      ...data,
      pay_frequency: data.pay_frequency || 'monthly',
      max_hours_month: data.max_hours_month || 160.0,
      id: `usr-${Date.now()}`,
      failed_login_count: 0,
    };
    setUsers((prev) => [...prev, newUser]);
    
    // Add initial wage history if hourly rate provided
    if (newUser.hourly_rate > 0) {
      const initialWage: WageHistory = {
        id: `wage-${Date.now()}`,
        user_id: newUser.id,
        hourly_rate: newUser.hourly_rate,
        effective_from: newUser.hire_date || serverCurrentDate,
        effective_to: null,
        note: 'Starting wage on account creation',
        set_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
        created_at: new Date().toISOString(),
      };
      setWageHistory((prev) => [initialWage, ...prev]);
    }

    logAction({
      action: 'USER_CREATED',
      entity_type: 'user',
      entity_id: newUser.id,
      details: `Created account for ${newUser.first_name} ${newUser.last_name} (${newUser.role})`,
    });

    return newUser;
  };

  const setHourlyWage = (userId: string, rate: number, effectiveFrom: string, note: string) => {
    // Conflict check: admin cannot change own wage or other admins' wages unless system admin
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    if (currentUser.role !== 'system_admin') {
      if (target.role === 'admin' || target.role === 'system_admin') {
        alert('Unauthorized: Only the system administrator can set or adjust administrator wages.');
        return;
      }
    }

    // Close previous open wage history
    setWageHistory((prev) =>
      prev.map((w) => {
        if (w.user_id === userId && w.effective_to === null) {
          return { ...w, effective_to: effectiveFrom };
        }
        return w;
      })
    );

    // Insert new wage record
    const newRecord: WageHistory = {
      id: `wage-${Date.now()}`,
      user_id: userId,
      hourly_rate: rate,
      effective_from: effectiveFrom,
      effective_to: null,
      note: note.trim() || 'Wage adjustment',
      set_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
      created_at: new Date().toISOString(),
    };

    setWageHistory((prev) => [newRecord, ...prev]);
    syncWageHistoryToSupabase(newRecord);

    // Update active user's rate
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, hourly_rate: rate } : u))
    );
    try {
      supabase.from('profiles').update({ hourly_rate: rate, updated_at: new Date().toISOString() }).eq('id', userId).then();
    } catch {}

    logAction({
      action: 'WAGE_UPDATED',
      entity_type: 'hourly_rate',
      entity_id: userId,
      details: `Set wage for ${target.first_name} ${target.last_name} to ${settings.currency_symbol || '₱'}${rate.toFixed(2)}/hr effective ${effectiveFrom}`,
    });
  };

  const toggleAdminClockIn = (adminId: string, clocksIn: boolean) => {
    if (currentUser.role !== 'system_admin') {
      alert('Only the System Administrator can enable or disable admin clock-in privileges.');
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === adminId ? { ...u, clocks_in: clocksIn } : u))
    );
    try {
      supabase.from('profiles').update({ clocks_in: clocksIn, updated_at: new Date().toISOString() }).eq('id', adminId).then();
    } catch {}
    logAction({
      action: 'ADMIN_CLOCKIN_TOGGLED',
      entity_type: 'user',
      entity_id: adminId,
      details: `Switched clocking in to ${clocksIn ? 'ENABLED' : 'DISABLED'} for admin`,
      is_system_scope: true,
    });
  };

  const setUserStatus = (userId: string, status: 'active' | 'inactive' | 'locked' | 'pending_approval') => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    // Prevent deactivating last system admin
    if (target.role === 'system_admin' && status === 'inactive') {
      const activeSysCount = users.filter((u) => u.role === 'system_admin' && u.status === 'active').length;
      if (activeSysCount <= 1) {
        alert('Operation blocked: The last active System Administrator account cannot be deactivated.');
        return;
      }
    }

    try {
      supabase.from('profiles').update({ status, updated_at: new Date().toISOString() }).eq('id', userId);
    } catch {
      // ignore
    }

    if (session?.access_token) {
      secureFetch('/api/users', {
        method: 'PATCH',
        accessToken: session.access_token,
        body: { id: userId, status },
      }).catch((err) => console.warn('Encrypted status update warning:', err));
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status } : u))
    );

    logAction({
      action: `USER_STATUS_${status.toUpperCase()}`,
      entity_type: 'user',
      entity_id: userId,
      details: `Set status of ${target.first_name} to ${status}`,
    });
  };

  const refreshCurrentUserProfile = async () => {
    if (supabaseUser && session?.access_token) {
      await syncUserFromSupabase(supabaseUser, session.access_token);
    }
  };

  const signInWithEmail = async (email: string, password: string, rememberMe?: boolean) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      if (rememberMe !== undefined) {
        try {
          if (rememberMe) {
            localStorage.setItem(STORAGE_KEY_REMEMBER_ME, 'true');
            localStorage.setItem(STORAGE_KEY_REMEMBER_EMAIL, email.trim());
          } else {
            localStorage.removeItem(STORAGE_KEY_REMEMBER_ME);
            localStorage.removeItem(STORAGE_KEY_REMEMBER_EMAIL);
          }
        } catch {
          // ignore localStorage failure in private modes
        }
      }
      if (data.user && data.session?.access_token) {
        await syncUserFromSupabase(data.user, data.session.access_token);
        await refreshAllRemoteData(data.session.access_token);
      }
      return { success: true, message: 'Monthly payment status updated.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Login failed' };
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    metadata: { firstName: string; lastName: string }
  ) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const isDefaultSysAdmin = cleanEmail === 'marquez.ronrons@gmail.com';

      // 1. Attempt server-side admin registration first via encrypted API.
      // This bypasses Supabase's built-in email rate limit by auto-confirming the user.
      try {
        const res = await secureFetch('/api/auth/register', {
          method: 'POST',
          body: {
            email: cleanEmail,
            password,
            firstName: metadata.firstName,
            lastName: metadata.lastName,
          },
        });

        const resData = res.data;

        if (res.ok && resData?.success) {
          // User created; sign them in to initiate their authenticated session
          const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          if (!signError && signData?.user && signData?.session?.access_token) {
            await syncUserFromSupabase(signData.user, signData.session.access_token);
            await refreshAllRemoteData(signData.session.access_token);
          }

          return {
            success: true,
            message:
              resData.message ||
              (isDefaultSysAdmin
                ? 'System Admin registered and active!'
                : 'Registration successful! Your account is pending administrator approval before you can access the system.'),
          };
        } else if (resData?.error) {
          const errMsg = (resData.error || '').toLowerCase();
          if (
            errMsg.includes('already registered') ||
            errMsg.includes('already exists') ||
            errMsg.includes('password')
          ) {
            return { success: false, error: resData.error };
          }
        }
      } catch (apiErr) {
        console.warn('Encrypted registration route failed or offline, falling back to direct auth:', apiErr);
      }

      // 2. Direct Supabase signUp fallback
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            first_name: metadata.firstName.trim(),
            last_name: metadata.lastName.trim(),
            full_name: `${metadata.firstName.trim()} ${metadata.lastName.trim()}`.trim(),
          },
        },
      });

      if (error) {
        const msg = error.message || '';
        if (
          msg.toLowerCase().includes('rate limit') ||
          msg.toLowerCase().includes('over_email_send_rate_limit')
        ) {
          return {
            success: false,
            error:
              'Email rate limit exceeded (Supabase built-in mailer allows only 3-4 emails/hr). Please turn off "Confirm email" in Supabase Dashboard (Authentication > Providers > Email) or set up custom SMTP.',
          };
        }
        return { success: false, error: msg };
      }

      if (data.user) {
        await syncUserFromSupabase(data.user);
      }

      return {
        success: true,
        message: isDefaultSysAdmin
          ? 'System Admin registered and active!'
          : 'Registration successful! Your account is pending administrator approval before you can access the system.',
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Registration failed' };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, message: 'Monthly payment status updated.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Google login failed' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_LAST_ACTIVE_USER);
        if (currentUserId) {
          localStorage.removeItem(`${STORAGE_KEY_CACHED_USER_PREFIX}${currentUserId}`);
        }
      } catch {}
    }
    setIsPasswordRecovery(false);
    setSession(null);
    setSupabaseUser(null);
    setCurrentUserId(null);
    setUsers([]);
  };

  const resetPasswordForEmail = async (email: string, options?: { forAdminLink?: boolean }) => {
    try {
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}` : 'https://timekeeping-dtr.vercel.app';

      // If an administrator is generating a link to copy from the Admin Users management panel
      if (options?.forAdminLink) {
        try {
          const apiRes = await secureFetch('/api/auth/reset-password', {
            method: 'POST',
            body: {
              email: cleanEmail,
              redirectTo,
            },
          });
          if (apiRes.ok && apiRes.data?.action_link) {
            return {
              success: true,
              action_link: apiRes.data.action_link,
              message: 'Password reset link generated successfully.',
            };
          }
        } catch (err) {
          console.warn('Admin link generation failed:', err);
        }
      }

      // 1. Try server-side email dispatch (via Resend or Nodemailer SMTP if configured)
      try {
        const apiRes = await secureFetch('/api/auth/reset-password', {
          method: 'POST',
          body: {
            email: cleanEmail,
            redirectTo,
          },
        });

        if (apiRes.ok && apiRes.data?.success && apiRes.data?.email_sent) {
          logAction({
            action: 'PASSWORD_RESET_REQUESTED',
            entity_type: 'user',
            entity_id: cleanEmail,
            details: `Password reset email dispatched to ${cleanEmail}`,
          });

          return {
            success: true,
            message: 'Password reset link sent! Check your inbox for instructions to set a new password.',
          };
        } else if (apiRes.data?.error && apiRes.data?.error !== 'NO_SERVER_MAILER') {
          // Specific user error (e.g. user with this email not found)
          return {
            success: false,
            error: apiRes.data.error,
          };
        }
      } catch (err) {
        console.warn('Server recovery email dispatch failed, falling back to Supabase client:', err);
      }

      // 2. Fallback to Supabase client-side mailer (uses Supabase custom SMTP or built-in mailer)
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (error) {
        const msg = error.message || '';
        const errorCode = (error as any)?.code || '';
        const status = (error as any)?.status;

        const isRateLimit =
          errorCode === 'over_email_send_rate_limit' ||
          msg.toLowerCase().includes('rate limit') ||
          msg.toLowerCase().includes('over_email_send_rate_limit') ||
          msg.includes('For security purposes, you can only request this after') ||
          status === 429;

        if (isRateLimit) {
          const match = msg.match(/after (\d+) seconds?/i);
          const waitSec = match ? parseInt(match[1], 10) : 60;
          return {
            success: false,
            rateLimited: true,
            retryAfter: waitSec,
            error: `For security purposes, you can only request this after ${waitSec} seconds.`,
          };
        }

        if (
          msg.toLowerCase().includes('error sending recovery email') ||
          status === 500
        ) {
          return {
            success: false,
            error:
              'Unable to send recovery email. The Supabase email rate limit was exceeded or Custom SMTP is not yet configured in your Supabase Dashboard.',
          };
        }

        return { success: false, error: msg };
      }

      logAction({
        action: 'PASSWORD_RESET_REQUESTED',
        entity_type: 'user',
        entity_id: cleanEmail,
        details: `Password reset link requested for ${cleanEmail}`,
      });

      return {
        success: true,
        message: 'Password reset link sent! Please check your email inbox to reset your password.',
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send password reset email' };
    }
  };

  const changePassword = async (newPassword: string) => {
    try {
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      setIsPasswordRecovery(false);
      if (data.user) {
        await syncUserFromSupabase(data.user);
      }
      logAction({
        action: 'PASSWORD_CHANGED',
        entity_type: 'user',
        entity_id: currentUser.id || data.user?.id || 'unknown',
        details: `Password updated successfully for ${currentUser.email || data.user?.email || 'account'}`,
      });
      return { success: true, message: 'Password has been updated successfully!' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update password' };
    }
  };

  const pendingUsers = useMemo(() => {
    return users.filter((u) => u.status === 'pending_approval');
  }, [users]);

  const approvePendingUser = async (
    userId: string,
    data: {
      role: UserRole;
      position: string;
      department: string;
      hourly_rate: number;
      pay_frequency: PayFrequency;
      employee_no?: string;
      clocks_in?: boolean;
    }
  ) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'User not found' };

    const updatedUser: User = {
      ...target,
      role: data.role,
      position: data.position || 'Employee',
      department: data.department || DEFAULT_DEPARTMENT,
      hourly_rate: data.hourly_rate,
      pay_frequency: data.pay_frequency || 'monthly',
      max_hours_month: 160.0,
      employee_no: data.employee_no || target.employee_no,
      clocks_in: data.clocks_in ?? (data.role === 'employee'),
      status: 'active',
    };

    try {
      const res = await secureFetch('/api/users', {
        method: 'PATCH',
        accessToken: session?.access_token,
        body: {
          id: userId,
          role: updatedUser.role,
          position: updatedUser.position,
          department: updatedUser.department,
          hourly_rate: updatedUser.hourly_rate,
          pay_frequency: updatedUser.pay_frequency,
          employee_no: updatedUser.employee_no,
          clocks_in: updatedUser.clocks_in,
          status: 'active',
        },
      });

      if (!res.ok) {
        await supabase.from('profiles').update({
          role: updatedUser.role,
          position: updatedUser.position,
          department: updatedUser.department,
          hourly_rate: updatedUser.hourly_rate,
          pay_frequency: updatedUser.pay_frequency,
          employee_no: updatedUser.employee_no,
          clocks_in: updatedUser.clocks_in,
          status: 'active',
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
      }
    } catch (err) {
      console.warn('Failed to update profile via encrypted API, tried fallback:', err);
    }

    setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));

    if (data.hourly_rate > 0) {
      setHourlyWage(userId, data.hourly_rate, new Date().toISOString().slice(0, 10), 'Initial wage rate set upon registration approval');
    }

    logAction({
      action: 'USER_APPROVED',
      entity_type: 'user',
      entity_id: userId,
      details: `Approved registration for ${target.first_name} ${target.last_name} (${target.email}) with role ${data.role} and rate ${settings.currency_symbol || '₱'}${data.hourly_rate}/hr.`,
      is_system_scope: data.role === 'system_admin',
    });

    return { success: true, message: `Account for ${target.first_name} ${target.last_name} has been approved and activated.` };
  };

  const rejectPendingUser = async (userId: string, reason?: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'User not found' };

    try {
      const res = await secureFetch('/api/users', {
        method: 'PATCH',
        accessToken: session?.access_token,
        body: {
          id: userId,
          status: 'inactive',
        },
      });

      if (!res.ok) {
        await supabase.from('profiles').update({
          status: 'inactive',
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
      }
    } catch (err) {
      console.warn('Failed to update profile via encrypted API, tried fallback:', err);
    }

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: 'inactive' } : u)));

    logAction({
      action: 'USER_REJECTED',
      entity_type: 'user',
      entity_id: userId,
      details: `Rejected registration for ${target.first_name} ${target.last_name} (${target.email}). Reason: ${reason || 'Declined by administrator'}.`,
      is_system_scope: false,
    });

    return { success: true, message: `Registration for ${target.first_name} ${target.last_name} was declined.` };
  };

  // Payment Operations
  const generatePaymentsForPeriod = (periodId: string) => {
    const period = payPeriods.find((p) => p.id === periodId);
    if (!period) return { count: 0, totalGross: 0 };
    const periodMonth = period.start_date.slice(0, 7);

    // People on this frequency or with approved logs in this window or with existing payment records
    const eligibleUsers = users.filter(
      (u) =>
        (u.pay_frequency === period.frequency && u.clocks_in) ||
        dtrEntries.some(
          (e) =>
            (e.user_id === u.id || (u.email && e.user_id?.toLowerCase() === u.email.toLowerCase())) &&
            (e.pay_period_id === period.id || (e.work_date >= period.start_date && e.work_date <= period.end_date)) &&
            (e.status === 'approved' || e.status === 'locked')
        ) ||
        payments.some(
          (p) =>
            (p.user_id === u.id || (u.email && p.user_id?.toLowerCase() === u.email.toLowerCase())) &&
            (p.pay_period_id === period.id || (p.month && p.month === periodMonth))
        )
    );

    let createdCount = 0;
    let totalGross = 0;

    const newPaymentRecords: PaymentRecord[] = [];
    const duplicateIdsToDelete: string[] = [];

    eligibleUsers.forEach((u) => {
      // Find all approved entries for this user in this period
      const userApprovedEntries = dtrEntries.filter(
        (e) =>
          (e.user_id === u.id || (u.email && e.user_id?.toLowerCase() === u.email.toLowerCase())) &&
          (e.pay_period_id === period.id || (e.work_date >= period.start_date && e.work_date <= period.end_date)) &&
          (e.status === 'approved' || e.status === 'locked')
      );

      const totalApprovedHours = userApprovedEntries.reduce(
        (sum, e) => sum + (e.payable_hours ?? e.hours ?? 0),
        0
      );

      // Existing record or new? Look for exact period match, month match, or legacy month-YYYY-MM
      const existing = payments.find(
        (p) =>
          (p.user_id === u.id ||
            (u.email && p.user_id?.toLowerCase() === u.email.toLowerCase()) ||
            (u.employee_no && p.user_id === u.employee_no)) &&
          (p.pay_period_id === period.id ||
            p.pay_period_id === `month-${periodMonth}` ||
            (p.month && p.month === periodMonth))
      );

      // Extract existing additional payment lines (bonuses, allowances, adjustments)
      const existingAdditionalLines = (existing?.lines || []).filter(
        (l) => l.line_type !== 'hours'
      );
      const additionalGross = existingAdditionalLines.reduce(
        (sum, l) => sum + (Number(l.amount) || 0),
        0
      );

      if (totalApprovedHours > 0 || userApprovedEntries.length > 0 || existingAdditionalLines.length > 0) {
        const rate = u.hourly_rate || DEFAULT_HOURLY_WAGE;
        const hoursGross = Math.round(totalApprovedHours * rate * 100) / 100;
        const totalEmployeeGross = Math.round((hoursGross + additionalGross) * 100) / 100;
        totalGross += totalEmployeeGross;
        createdCount++;

        // Find any duplicate records that should be purged
        const duplicates = payments.filter(
          (p) =>
            (p.user_id === u.id ||
              (u.email && p.user_id?.toLowerCase() === u.email.toLowerCase()) ||
              (u.employee_no && p.user_id === u.employee_no)) &&
            (p.pay_period_id === period.id ||
              p.pay_period_id === `month-${periodMonth}` ||
              (p.month && p.month === periodMonth)) &&
            p.id !== (existing ? existing.id : '')
        );
        duplicates.forEach((d) => {
          if (d.id) duplicateIdsToDelete.push(d.id);
        });

        // Retain Paid status and disbursement details if already marked as paid
        const isPaid = existing?.status === 'paid';

        const hoursLine: PaymentLine = {
          id: existing?.lines?.find((l) => l.line_type === 'hours')?.id || `line-${Date.now()}-${u.id}`,
          line_type: 'hours',
          hourly_rate: rate,
          hours: totalApprovedHours,
          amount: hoursGross,
          description: `Approved work sessions for ${period.start_date} to ${period.end_date}`,
        };

        const mergedLines: PaymentLine[] = [hoursLine, ...existingAdditionalLines];

        const rec: PaymentRecord = {
          id: existing ? existing.id : `pay-${period.id}-${u.id}`,
          pay_period_id: period.id,
          user_id: u.id,
          month: periodMonth,
          total_hours: isPaid && existing.total_hours ? existing.total_hours : totalApprovedHours,
          sessions_count: isPaid && existing.sessions_count ? existing.sessions_count : userApprovedEntries.length,
          gross_amount: isPaid && existing.gross_amount ? existing.gross_amount : totalEmployeeGross,
          status: isPaid ? 'paid' : (existing ? existing.status : 'pending'),
          method: existing?.method,
          reference_no: existing?.reference_no,
          paid_at: existing?.paid_at,
          status_reason: existing?.status_reason,
          generated_at: existing?.generated_at || new Date().toISOString(),
          updated_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
          lines: isPaid && existing?.lines && existing.lines.length > 0 ? existing.lines : mergedLines,
        };
        newPaymentRecords.push(rec);
      }
    });

    // Retain any existing paid payments for this period that might not have new logs in memory
    const existingPaidToKeep = payments.filter(
      (p) =>
        (p.pay_period_id === period.id || (p.month && p.month === periodMonth)) &&
        p.status === 'paid' &&
        !newPaymentRecords.some((nr) => nr.user_id === p.user_id)
    );
    const combinedNewRecords = [...newPaymentRecords, ...existingPaidToKeep];

    // Replace or merge into payments
    setPayments((prev) => {
      const otherPayments = prev.filter(
        (p) =>
          p.pay_period_id !== period.id &&
          p.pay_period_id !== `month-${periodMonth}` &&
          !(p.month === periodMonth && combinedNewRecords.some((nr) => nr.user_id === p.user_id)) &&
          !duplicateIdsToDelete.includes(p.id)
      );
      return [...otherPayments, ...combinedNewRecords];
    });
    if (combinedNewRecords.length > 0) {
      syncPaymentsToSupabase(combinedNewRecords);
    }
    if (duplicateIdsToDelete.length > 0) {
      duplicateIdsToDelete.forEach((dupId) => {
        deletePaymentByIdFromSupabase(dupId);
      });
    }

    logAction({
      action: 'PAYMENTS_GENERATED',
      entity_type: 'payment',
      entity_id: periodId,
      details: `Generated ${createdCount} payment records for period ${period.start_date} to ${period.end_date} (Total: ${settings.currency_symbol || '₱'}${totalGross.toFixed(2)})`,
    });

    return { count: createdCount, totalGross };
  };

  const closePayPeriod = (periodId: string) => {
    if (currentUser.role === 'employee') return { success: false, message: 'Unauthorized' };
    const period = payPeriods.find((p) => p.id === periodId);
    if (period) {
      const updatedPeriod: PayPeriod = {
        ...period,
        status: 'closed',
        closed_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
      };
      setPayPeriods((prev) =>
        prev.map((p) => (p.id === periodId ? updatedPeriod : p))
      );
      syncPayPeriodToSupabase(updatedPeriod);
    }
    logAction({
      action: 'PERIOD_CLOSED',
      entity_type: 'pay_period',
      entity_id: periodId,
      details: `Closed pay period ${periodId}`,
    });
    return { success: true, message: 'Pay period marked as closed.' };
  };

  const lockPayPeriod = (periodId: string) => {
    if (currentUser.role === 'employee') return { success: false, message: 'Unauthorized' };
    const period = payPeriods.find((p) => p.id === periodId);
    if (period) {
      const updatedPeriod: PayPeriod = {
        ...period,
        status: 'locked',
        locked_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
      };
      setPayPeriods((prev) =>
        prev.map((p) => (p.id === periodId ? updatedPeriod : p))
      );
      syncPayPeriodToSupabase(updatedPeriod);
    }
    logAction({
      action: 'PERIOD_LOCKED',
      entity_type: 'pay_period',
      entity_id: periodId,
      details: `Locked pay period ${periodId}. Records are now immutable.`,
    });
    return { success: true, message: 'Pay period locked.' };
  };

  const reopenPayPeriod = (periodId: string, reason: string) => {
    if (currentUser.role !== 'system_admin') {
      return { success: false, message: 'Only System Administrators can reopen locked periods.' };
    }
    if (!reason || reason.trim().length < 5) {
      return { success: false, message: 'A formal reason is required to reopen a locked pay period.' };
    }

    const period = payPeriods.find((p) => p.id === periodId);
    if (period) {
      const updatedPeriod: PayPeriod = {
        ...period,
        status: 'open',
      };
      setPayPeriods((prev) =>
        prev.map((p) => (p.id === periodId ? updatedPeriod : p))
      );
      syncPayPeriodToSupabase(updatedPeriod);
    }

    logAction({
      action: 'PERIOD_REOPENED',
      entity_type: 'pay_period',
      entity_id: periodId,
      details: `Reopened locked pay period. Reason: ${reason}`,
      is_system_scope: true,
    });

    return { success: true, message: 'Pay period reopened.' };
  };

  const updatePayPeriodPayDate = (periodId: string, newPayDate: string) => {
    if (currentUser.role === 'employee') return { success: false, message: 'Unauthorized' };
    const period = payPeriods.find((p) => p.id === periodId);
    if (!period) return { success: false, message: 'Pay period not found' };

    const oldDate = period.pay_date;
    const updatedPeriod: PayPeriod = {
      ...period,
      pay_date: newPayDate,
    };
    setPayPeriods((prev) =>
      prev.map((p) => (p.id === periodId ? updatedPeriod : p))
    );
    syncPayPeriodToSupabase(updatedPeriod);

    logAction({
      action: 'PERIOD_PAY_DATE_ADJUSTED',
      entity_type: 'pay_period',
      entity_id: periodId,
      details: `Adjusted scheduled payout date from ${oldDate} to ${newPayDate} for period ${period.start_date} to ${period.end_date}`,
      is_system_scope: true,
    });

    return { success: true, message: `Scheduled payout date updated to ${newPayDate}.` };
  };

  const addAdditionalPayment = async (params: {
    payPeriodId: string;
    target: 'all' | 'individual';
    userId?: string;
    category: string;
    amount: number;
    description?: string;
  }): Promise<{ success: boolean; count: number; message: string }> => {
    if (currentUser.role === 'employee') {
      return { success: false, count: 0, message: 'Unauthorized: Administrator access required.' };
    }

    const numAmount = Number(params.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, count: 0, message: 'Additional payment amount must be a positive number.' };
    }

    const trimmedCategory = (params.category || '').trim();
    if (!trimmedCategory) {
      return { success: false, count: 0, message: 'Please specify an additional payment category (e.g. Performance Bonus, Transpo Allowance).' };
    }

    const period = payPeriods.find((p) => p.id === params.payPeriodId);
    if (!period) {
      return { success: false, count: 0, message: 'Selected pay period could not be found.' };
    }

    const periodMonth = period.start_date.slice(0, 7);
    const lineType: PaymentLineType = trimmedCategory.toLowerCase().includes('bonus')
      ? 'bonus'
      : trimmedCategory.toLowerCase().includes('allowance')
      ? 'allowance'
      : 'adjustment';

    const actorName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Admin';

    if (params.target === 'individual') {
      if (!params.userId) {
        return { success: false, count: 0, message: 'Please select an employee.' };
      }

      const targetUser = users.find(
        (u) =>
          u.id === params.userId ||
          (u.email && u.email.toLowerCase() === params.userId?.toLowerCase()) ||
          (u.employee_no && u.employee_no === params.userId)
      );

      if (!targetUser) {
        return { success: false, count: 0, message: 'Selected employee not found.' };
      }

      const newLine: PaymentLine = {
        id: `line-add-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        line_type: lineType,
        category: trimmedCategory,
        hourly_rate: 0,
        hours: 0,
        amount: Math.round(numAmount * 100) / 100,
        description: (params.description || trimmedCategory).trim(),
        added_by_name: actorName,
        created_at: new Date().toISOString(),
      };

      const isTargetUserMatch = (pUserId?: string) => {
        if (!pUserId) return false;
        return (
          pUserId === targetUser.id ||
          (targetUser.email && pUserId.toLowerCase() === targetUser.email.toLowerCase()) ||
          (targetUser.employee_no && pUserId === targetUser.employee_no)
        );
      };

      const isPeriodMatch = (p: PaymentRecord) => {
        return (
          p.pay_period_id === period.id ||
          p.pay_period_id === `month-${periodMonth}` ||
          (p.month && p.month === periodMonth)
        );
      };

      // Search existing in current payments
      const currentPayments = paymentsRef.current || payments;
      const existing = currentPayments.find((p) => isTargetUserMatch(p.user_id) && isPeriodMatch(p));

      let recordToSave: PaymentRecord;

      if (existing) {
        const updatedLines = [...(existing.lines || []), newLine];
        const newGross = Math.round(
          updatedLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100
        ) / 100;
        recordToSave = {
          ...existing,
          user_id: targetUser.id,
          pay_period_id: period.id,
          month: periodMonth,
          lines: updatedLines,
          gross_amount: newGross,
          updated_by_name: actorName,
        };
      } else {
        const currentDtr = dtrEntriesRef.current || dtrEntries;
        const userApprovedEntries = currentDtr.filter(
          (e) =>
            isTargetUserMatch(e.user_id) &&
            (e.pay_period_id === period.id || (e.work_date >= period.start_date && e.work_date <= period.end_date)) &&
            (e.status === 'approved' || e.status === 'locked')
        );
        const totalApprovedHours = userApprovedEntries.reduce(
          (sum, e) => sum + (e.payable_hours ?? e.hours ?? 0),
          0
        );
        const rate = targetUser.hourly_rate || DEFAULT_HOURLY_WAGE;
        const hoursGross = Math.round(totalApprovedHours * rate * 100) / 100;

        const lines: PaymentLine[] = [];
        if (totalApprovedHours > 0 || userApprovedEntries.length > 0) {
          lines.push({
            id: `line-${Date.now()}-${targetUser.id}`,
            line_type: 'hours',
            hourly_rate: rate,
            hours: totalApprovedHours,
            amount: hoursGross,
            description: `Approved work sessions for ${period.start_date} to ${period.end_date}`,
          });
        }
        lines.push(newLine);

        const totalGross = Math.round(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100;

        recordToSave = {
          id: `pay-${period.id}-${targetUser.id}`,
          pay_period_id: period.id,
          user_id: targetUser.id,
          month: periodMonth,
          total_hours: totalApprovedHours,
          sessions_count: userApprovedEntries.length,
          gross_amount: totalGross,
          status: 'pending',
          generated_at: new Date().toISOString(),
          updated_by_name: actorName,
          lines,
        };
      }

      setPayments((prev) => {
        const idx = prev.findIndex((p) => (existing && p.id === existing.id) || (isTargetUserMatch(p.user_id) && isPeriodMatch(p)));
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = recordToSave;
          return next;
        }
        return [...prev, recordToSave];
      });

      // Synchronize to Supabase via POST /api/payments
      const syncResult = await syncPaymentsToSupabase([recordToSave]);
      if (syncResult && !syncResult.success) {
        console.warn('Failed to persist payment to database:', syncResult.error);
      }

      await refreshRemotePayments();

      logAction({
        action: 'ADDITIONAL_PAYMENT_ADDED',
        entity_type: 'payment',
        entity_id: params.payPeriodId,
        details: `Added ${trimmedCategory} of ${settings.currency_symbol || '₱'}${numAmount.toFixed(2)} for ${targetUser.first_name} ${targetUser.last_name} (${targetUser.employee_no || targetUser.department}). Note: ${params.description || trimmedCategory}`,
        is_system_scope: false,
      });

      return {
        success: true,
        count: 1,
        message: `Successfully added ${trimmedCategory} (${settings.currency_symbol || '₱'}${numAmount.toFixed(2)}) for ${targetUser.first_name} ${targetUser.last_name}.`,
      };
    } else {
      // Target === 'all'
      const targetUsers = users.filter(
        (u) =>
          u.status === 'active' &&
          (u.role === 'employee' || u.clocks_in)
      );

      if (targetUsers.length === 0) {
        return { success: false, count: 0, message: 'No eligible active employees found to receive additional payment.' };
      }

      const recordsToSave: PaymentRecord[] = [];
      const currentPayments = paymentsRef.current || payments;
      const currentDtr = dtrEntriesRef.current || dtrEntries;

      targetUsers.forEach((targetUser) => {
        const newLine: PaymentLine = {
          id: `line-add-${Date.now()}-${targetUser.id.slice(0, 5)}-${Math.random().toString(36).substring(2, 6)}`,
          line_type: lineType,
          category: trimmedCategory,
          hourly_rate: 0,
          hours: 0,
          amount: Math.round(numAmount * 100) / 100,
          description: (params.description || trimmedCategory).trim(),
          added_by_name: actorName,
          created_at: new Date().toISOString(),
        };

        const isUserMatch = (pUserId?: string) => {
          if (!pUserId) return false;
          return (
            pUserId === targetUser.id ||
            (targetUser.email && pUserId.toLowerCase() === targetUser.email.toLowerCase()) ||
            (targetUser.employee_no && pUserId === targetUser.employee_no)
          );
        };

        const isPeriodMatch = (p: PaymentRecord) => {
          return (
            p.pay_period_id === period.id ||
            p.pay_period_id === `month-${periodMonth}` ||
            (p.month && p.month === periodMonth)
          );
        };

        const existing = currentPayments.find((p) => isUserMatch(p.user_id) && isPeriodMatch(p));

        if (existing) {
          const updatedLines = [...(existing.lines || []), newLine];
          const newGross = Math.round(
            updatedLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100
          ) / 100;
          recordsToSave.push({
            ...existing,
            user_id: targetUser.id,
            pay_period_id: period.id,
            month: periodMonth,
            lines: updatedLines,
            gross_amount: newGross,
            updated_by_name: actorName,
          });
        } else {
          const userApprovedEntries = currentDtr.filter(
            (e) =>
              isUserMatch(e.user_id) &&
              (e.pay_period_id === period.id || (e.work_date >= period.start_date && e.work_date <= period.end_date)) &&
              (e.status === 'approved' || e.status === 'locked')
          );
          const totalApprovedHours = userApprovedEntries.reduce(
            (sum, e) => sum + (e.payable_hours ?? e.hours ?? 0),
            0
          );
          const rate = targetUser.hourly_rate || DEFAULT_HOURLY_WAGE;
          const hoursGross = Math.round(totalApprovedHours * rate * 100) / 100;

          const lines: PaymentLine[] = [];
          if (totalApprovedHours > 0 || userApprovedEntries.length > 0) {
            lines.push({
              id: `line-${Date.now()}-${targetUser.id}`,
              line_type: 'hours',
              hourly_rate: rate,
              hours: totalApprovedHours,
              amount: hoursGross,
              description: `Approved work sessions for ${period.start_date} to ${period.end_date}`,
            });
          }
          lines.push(newLine);

          const totalGross = Math.round(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100;

          recordsToSave.push({
            id: `pay-${period.id}-${targetUser.id}`,
            pay_period_id: period.id,
            user_id: targetUser.id,
            month: periodMonth,
            total_hours: totalApprovedHours,
            sessions_count: userApprovedEntries.length,
            gross_amount: totalGross,
            status: 'pending',
            generated_at: new Date().toISOString(),
            updated_by_name: actorName,
            lines,
          });
        }
      });

      setPayments((prev) => {
        const idsToUpdate = new Set(recordsToSave.map((r) => r.id));
        const kept = prev.filter((p) => !idsToUpdate.has(p.id));
        return [...kept, ...recordsToSave];
      });

      if (recordsToSave.length > 0) {
        await syncPaymentsToSupabase(recordsToSave);
      }

      await refreshRemotePayments();

      logAction({
        action: 'ADDITIONAL_PAYMENT_MASS_ADDED',
        entity_type: 'payment',
        entity_id: params.payPeriodId,
        details: `Added ${trimmedCategory} of ${settings.currency_symbol || '₱'}${numAmount.toFixed(2)} to all eligible employees (${recordsToSave.length} employees) for period ${period.start_date} to ${period.end_date}. Note: ${params.description || trimmedCategory}`,
        is_system_scope: true,
      });

      return {
        success: true,
        count: recordsToSave.length,
        message: `Successfully added ${trimmedCategory} (${settings.currency_symbol || '₱'}${numAmount.toFixed(2)}) to all ${recordsToSave.length} eligible employees.`,
      };
    }
  };

  const removeAdditionalPaymentLine = async (params: {
    paymentId: string;
    lineId: string;
  }): Promise<{ success: boolean; message: string }> => {
    if (currentUser.role === 'employee') {
      return { success: false, message: 'Unauthorized: Administrator access required.' };
    }

    const currentPayments = paymentsRef.current || payments;
    const record = currentPayments.find((p) => p.id === params.paymentId);
    if (!record) {
      return { success: false, message: 'Payment record not found.' };
    }

    const targetLine = (record.lines || []).find((l) => l.id === params.lineId);
    if (!targetLine) {
      return { success: false, message: 'Payment line not found.' };
    }

    const removedLineDesc = targetLine.category || targetLine.description || 'Additional Payment';
    const remainingLines = (record.lines || []).filter((l) => l.id !== params.lineId);
    const newGross = Math.round(
      remainingLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100
    ) / 100;

    const updatedRecord: PaymentRecord = {
      ...record,
      lines: remainingLines,
      gross_amount: newGross,
      updated_by_name: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Admin',
    };

    setPayments((prev) => prev.map((p) => (p.id === params.paymentId ? updatedRecord : p)));

    await syncPaymentsToSupabase([updatedRecord]);
    await refreshRemotePayments();

    logAction({
      action: 'ADDITIONAL_PAYMENT_REMOVED',
      entity_type: 'payment',
      entity_id: params.paymentId,
      details: `Removed line item "${removedLineDesc}" from payment record ${params.paymentId}`,
      is_system_scope: false,
    });

    return { success: true, message: `Removed "${removedLineDesc}".` };
  };

  // Reimbursement Actions
  const fileReimbursement = async (params: {
    title: string;
    amount: number;
    category?: string;
    expense_date: string;
    description?: string;
    receipt_url?: string;
    pay_period_id?: string;
  }): Promise<{
    success: boolean;
    message: string;
    reimbursement?: ReimbursementRequest;
  }> => {
    if (!currentUser || !currentUser.id) {
      return { success: false, message: 'Authentication required to file reimbursement.' };
    }

    const trimmedTitle = (params.title || '').trim();
    if (!trimmedTitle) {
      return { success: false, message: 'Please provide a name or title for the reimbursement.' };
    }

    const numAmount = Number(params.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, message: 'Reimbursement amount must be a positive number greater than 0.' };
    }

    const expDate = params.expense_date || serverCurrentDate;

    const newReimb: ReimbursementRequest = {
      id: `reimb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: currentUser.id,
      title: trimmedTitle,
      amount: Math.round(numAmount * 100) / 100,
      category: (params.category || 'General').trim(),
      expense_date: expDate,
      description: (params.description || '').trim(),
      receipt_url: params.receipt_url?.trim() || undefined,
      status: 'pending',
      pay_period_id: params.pay_period_id,
      created_at: new Date().toISOString(),
    };

    setReimbursements((prev) => [newReimb, ...prev]);
    syncReimbursementToSupabase(newReimb);

    // Notify administrators
    const adminNotif: AppNotification = {
      id: `notif-reimb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      recipient_role: 'admin',
      type: 'reimbursement_request',
      title: 'New Reimbursement Filed',
      message: `${currentUser.first_name || 'Employee'} filed an expense claim: "${trimmedTitle}" for ${settings.currency_symbol || '₱'}${numAmount.toFixed(2)}.`,
      user_id: currentUser.id,
      user_name: `${currentUser.first_name} ${currentUser.last_name}`,
      link_tab: 'admin_reimbursements',
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setNotifications((prev) => [adminNotif, ...prev]);
    syncNotificationToSupabase(adminNotif);

    logAction({
      action: 'REIMBURSEMENT_FILED',
      entity_type: 'reimbursement_request',
      entity_id: newReimb.id,
      details: `${currentUser.first_name} ${currentUser.last_name} filed reimbursement "${trimmedTitle}" (${settings.currency_symbol || '₱'}${numAmount.toFixed(2)}) for expense date ${expDate}`,
      is_system_scope: false,
    });

    return {
      success: true,
      message: 'Reimbursement request submitted successfully for administrator approval.',
      reimbursement: newReimb,
    };
  };

  const approveReimbursement = async (
    id: string,
    options?: {
      payPeriodId?: string;
      note?: string;
    }
  ): Promise<{ success: boolean; message: string }> => {
    if (currentUser.role === 'employee') {
      return { success: false, message: 'Unauthorized: Administrator access required.' };
    }

    const currentReimbursements = reimbursementsRef.current || reimbursements;
    const reimb = currentReimbursements.find((r) => r.id === id);
    if (!reimb) {
      return { success: false, message: 'Reimbursement request not found.' };
    }

    if (reimb.status === 'approved') {
      return { success: false, message: 'This reimbursement has already been approved.' };
    }

    // Target employee
    const targetUser = users.find(
      (u) =>
        u.id === reimb.user_id ||
        (u.email && u.email.toLowerCase() === reimb.user_id.toLowerCase()) ||
        (u.employee_no && u.employee_no === reimb.user_id)
    );

    if (!targetUser) {
      return { success: false, message: 'Target employee profile could not be found.' };
    }

    // Target pay period resolution
    let targetPeriod = options?.payPeriodId
      ? payPeriods.find((p) => p.id === options.payPeriodId)
      : null;

    if (!targetPeriod && reimb.pay_period_id) {
      targetPeriod = payPeriods.find((p) => p.id === reimb.pay_period_id) || null;
    }

    if (!targetPeriod) {
      targetPeriod =
        payPeriods.find(
          (p) =>
            p.status === 'open' &&
            p.start_date <= reimb.expense_date &&
            p.end_date >= reimb.expense_date
        ) || null;
    }

    if (!targetPeriod) {
      targetPeriod =
        payPeriods.find(
          (p) => p.frequency === (targetUser.pay_frequency || 'monthly') && p.status === 'open'
        ) || null;
    }

    if (!targetPeriod) {
      targetPeriod = payPeriods.find((p) => p.status === 'open') || payPeriods[0];
    }

    if (!targetPeriod) {
      return { success: false, message: 'No valid pay period found to credit reimbursement to.' };
    }

    const actorName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Admin';
    const periodMonth = targetPeriod.start_date.slice(0, 7);
    const reimbAmount = Math.round(Number(reimb.amount) * 100) / 100;
    const newLineId = `line-reimb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newLine: PaymentLine = {
      id: newLineId,
      line_type: 'reimbursement',
      category: 'Reimbursement',
      hourly_rate: 0,
      hours: 0,
      amount: reimbAmount,
      description: `Reimbursement: ${reimb.title}${reimb.description ? ` (${reimb.description})` : ''}`,
      added_by_name: actorName,
      created_at: new Date().toISOString(),
      source_entry_id: reimb.id,
    };

    const isTargetUserMatch = (pUserId?: string) => {
      if (!pUserId) return false;
      return (
        pUserId === targetUser.id ||
        (targetUser.email && pUserId.toLowerCase() === targetUser.email.toLowerCase()) ||
        (targetUser.employee_no && pUserId === targetUser.employee_no)
      );
    };

    const isPeriodMatch = (p: PaymentRecord) => {
      return (
        p.pay_period_id === targetPeriod.id ||
        p.pay_period_id === `month-${periodMonth}` ||
        (p.month && p.month === periodMonth)
      );
    };

    const currentPayments = paymentsRef.current || payments;
    const existingPayment = currentPayments.find(
      (p) => isTargetUserMatch(p.user_id) && isPeriodMatch(p)
    );

    let paymentRecordToSave: PaymentRecord;

    if (existingPayment) {
      const updatedLines = [...(existingPayment.lines || []), newLine];
      const newGross = Math.round(
        updatedLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100
      ) / 100;
      paymentRecordToSave = {
        ...existingPayment,
        user_id: targetUser.id,
        pay_period_id: targetPeriod.id,
        month: periodMonth,
        lines: updatedLines,
        gross_amount: newGross,
        updated_by_name: actorName,
      };
    } else {
      const currentDtr = dtrEntriesRef.current || dtrEntries;
      const userApprovedEntries = currentDtr.filter(
        (e) =>
          isTargetUserMatch(e.user_id) &&
          (e.pay_period_id === targetPeriod.id ||
            (e.work_date >= targetPeriod.start_date && e.work_date <= targetPeriod.end_date)) &&
          (e.status === 'approved' || e.status === 'locked')
      );
      const totalApprovedHours = userApprovedEntries.reduce(
        (sum, e) => sum + (e.payable_hours ?? e.hours ?? 0),
        0
      );
      const rate = targetUser.hourly_rate || DEFAULT_HOURLY_WAGE;
      const hoursGross = Math.round(totalApprovedHours * rate * 100) / 100;

      const lines: PaymentLine[] = [];
      if (totalApprovedHours > 0 || userApprovedEntries.length > 0) {
        lines.push({
          id: `line-${Date.now()}-${targetUser.id}`,
          line_type: 'hours',
          hourly_rate: rate,
          hours: totalApprovedHours,
          amount: hoursGross,
          description: `Approved work sessions for ${targetPeriod.start_date} to ${targetPeriod.end_date}`,
        });
      }
      lines.push(newLine);

      const totalGross = Math.round(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100;

      paymentRecordToSave = {
        id: `pay-${targetPeriod.id}-${targetUser.id}`,
        pay_period_id: targetPeriod.id,
        user_id: targetUser.id,
        month: periodMonth,
        total_hours: totalApprovedHours,
        sessions_count: userApprovedEntries.length,
        gross_amount: totalGross,
        status: 'pending',
        generated_at: new Date().toISOString(),
        updated_by_name: actorName,
        lines,
      };
    }

    // Persist Payment
    setPayments((prev) => {
      const idx = prev.findIndex(
        (p) =>
          (existingPayment && p.id === existingPayment.id) ||
          (isTargetUserMatch(p.user_id) && isPeriodMatch(p))
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = paymentRecordToSave;
        return next;
      }
      return [...prev, paymentRecordToSave];
    });

    await syncPaymentsToSupabase([paymentRecordToSave]);
    await refreshRemotePayments();

    // Update Reimbursement record
    const updatedReimb: ReimbursementRequest = {
      ...reimb,
      status: 'approved',
      pay_period_id: targetPeriod.id,
      payment_id: paymentRecordToSave.id,
      payment_line_id: newLine.id,
      reviewed_by_name: actorName,
      review_note: (options?.note || '').trim() || 'Approved by Administrator',
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setReimbursements((prev) => prev.map((r) => (r.id === id ? updatedReimb : r)));
    await syncReimbursementToSupabase(updatedReimb);

    // Send notification to employee
    const empNotif: AppNotification = {
      id: `notif-reimb-appr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      recipient_role: 'employee',
      recipient_id: targetUser.id,
      type: 'reimbursement_adjudicated',
      title: 'Reimbursement Approved & Added to Payroll',
      message: `Your reimbursement for "${reimb.title}" (${settings.currency_symbol || '₱'}${reimbAmount.toFixed(2)}) has been approved and added as an additional payment to your payroll for ${targetPeriod.start_date} to ${targetPeriod.end_date}.`,
      user_id: targetUser.id,
      user_name: `${targetUser.first_name} ${targetUser.last_name}`,
      link_tab: 'payment_status',
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setNotifications((prev) => [empNotif, ...prev]);
    syncNotificationToSupabase(empNotif);

    logAction({
      action: 'REIMBURSEMENT_APPROVED',
      entity_type: 'reimbursement_request',
      entity_id: reimb.id,
      details: `Approved reimbursement "${reimb.title}" (${settings.currency_symbol || '₱'}${reimbAmount.toFixed(2)}) for ${targetUser.first_name} ${targetUser.last_name}. Added to payroll for ${targetPeriod.start_date} to ${targetPeriod.end_date}.`,
      is_system_scope: false,
    });

    return {
      success: true,
      message: `Reimbursement approved and added to ${targetUser.first_name} ${targetUser.last_name}'s payroll for ${targetPeriod.start_date} to ${targetPeriod.end_date}.`,
    };
  };

  const rejectReimbursement = async (
    id: string,
    note?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (currentUser.role === 'employee') {
      return { success: false, message: 'Unauthorized: Administrator access required.' };
    }

    const currentReimbursements = reimbursementsRef.current || reimbursements;
    const reimb = currentReimbursements.find((r) => r.id === id);
    if (!reimb) {
      return { success: false, message: 'Reimbursement request not found.' };
    }

    const actorName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Admin';
    const rejectReason = (note || '').trim() || 'Declined by Administrator';

    const updatedReimb: ReimbursementRequest = {
      ...reimb,
      status: 'rejected',
      reviewed_by_name: actorName,
      review_note: rejectReason,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setReimbursements((prev) => prev.map((r) => (r.id === id ? updatedReimb : r)));
    await syncReimbursementToSupabase(updatedReimb);

    // Notify employee
    const targetUser = users.find((u) => u.id === reimb.user_id);
    const empNotif: AppNotification = {
      id: `notif-reimb-rej-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      recipient_role: 'employee',
      recipient_id: reimb.user_id,
      type: 'reimbursement_adjudicated',
      title: 'Reimbursement Request Declined',
      message: `Your reimbursement for "${reimb.title}" was declined: ${rejectReason}`,
      user_id: reimb.user_id,
      user_name: targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : undefined,
      link_tab: 'reimbursements',
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setNotifications((prev) => [empNotif, ...prev]);
    syncNotificationToSupabase(empNotif);

    logAction({
      action: 'REIMBURSEMENT_REJECTED',
      entity_type: 'reimbursement_request',
      entity_id: reimb.id,
      details: `Declined reimbursement "${reimb.title}". Reason: ${rejectReason}`,
      is_system_scope: false,
    });

    return { success: true, message: 'Reimbursement request declined.' };
  };

  const deleteReimbursement = async (id: string): Promise<{ success: boolean; message: string }> => {
    const reimb = reimbursements.find((r) => r.id === id);
    if (!reimb) return { success: false, message: 'Reimbursement not found.' };

    if (currentUser.role === 'employee' && reimb.user_id !== currentUser.id) {
      return { success: false, message: 'Forbidden: You cannot delete another user\'s reimbursement.' };
    }

    if (reimb.status !== 'pending' && currentUser.role === 'employee') {
      return { success: false, message: 'Cannot cancel an adjudicated reimbursement request.' };
    }

    setReimbursements((prev) => prev.filter((r) => r.id !== id));
    await deleteReimbursementFromSupabase(id);

    logAction({
      action: 'REIMBURSEMENT_DELETED',
      entity_type: 'reimbursement_request',
      entity_id: id,
      details: `Cancelled reimbursement claim: ${reimb.title}`,
      is_system_scope: false,
    });

    return { success: true, message: 'Reimbursement request cancelled.' };
  };

  const updatePaymentStatus = (
    paymentId: string,
    status: PaymentStatus,
    data?: { method?: string; reference_no?: string; reason?: string; paid_at?: string }
  ) => {
    if (currentUser.role === 'employee') return { success: false, message: 'Unauthorized' };
    
    if (status === 'paid') {
      if (!data?.reference_no || !data?.method) {
        return { success: false, message: 'Payment method and reference number are required to mark as Paid.' };
      }
    }
    if (status === 'on_hold' || status === 'cancelled') {
      if (!data?.reason) {
        return { success: false, message: 'A reason is required to place payment on hold or cancel.' };
      }
    }

    const targetPayment = payments.find((p) => p.id === paymentId);
    if (targetPayment) {
      const matchingPeriod = payPeriods.find((pp) => pp.id === targetPayment.pay_period_id);
      const computedMonth = targetPayment.month || (matchingPeriod ? matchingPeriod.start_date.slice(0, 7) : undefined);

      const updated: PaymentRecord = {
        ...targetPayment,
        month: computedMonth,
        status,
        method: data?.method || targetPayment.method,
        reference_no: data?.reference_no || targetPayment.reference_no,
        paid_at:
          status === 'paid'
            ? data?.paid_at || new Date().toISOString()
            : status === 'pending' || status === 'cancelled'
            ? undefined
            : targetPayment.paid_at,
        status_reason: data?.reason,
        updated_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
      };

      const duplicateIdsToDelete: string[] = [];
      payments.forEach((p) => {
        if (
          p.id !== paymentId &&
          p.user_id === targetPayment.user_id &&
          computedMonth &&
          (p.month === computedMonth ||
            p.pay_period_id === `month-${computedMonth}` ||
            (matchingPeriod && p.pay_period_id === matchingPeriod.id))
        ) {
          duplicateIdsToDelete.push(p.id);
        }
      });

      setPayments((prev) =>
        prev
          .filter((p) => !duplicateIdsToDelete.includes(p.id))
          .map((p) => (p.id === paymentId ? updated : p))
      );
      syncPaymentsToSupabase([updated]);

      if (duplicateIdsToDelete.length > 0) {
        duplicateIdsToDelete.forEach((dupId) => {
          deletePaymentByIdFromSupabase(dupId);
        });
      }

      // Notify the employee via in-app notification when their individual payment is tagged as paid
      if (status === 'paid') {
        const empUser = users.find(
          (u) =>
            u.id === targetPayment.user_id ||
            (u.email && targetPayment.user_id && u.email.toLowerCase() === targetPayment.user_id.toLowerCase()) ||
            (u.employee_no && u.employee_no === targetPayment.user_id)
        );
        const recipientId = empUser?.id || targetPayment.user_id;
        const formattedGross = targetPayment.gross_amount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const empNotif: AppNotification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          recipient_role: 'employee',
          recipient_id: recipientId,
          type: 'payment_disbursed',
          title: 'Payment Disbursed & Tagged as Paid',
          message: `Your disbursement of ₱${formattedGross} has been processed and tagged as PAID via ${data?.method?.replace(/_/g, ' ') || 'disbursement'}.${data?.reference_no ? ` Ref: ${data.reference_no}.` : ''}`,
          user_id: recipientId,
          month: computedMonth || targetPayment.month || undefined,
          link_tab: 'payments',
          is_read: false,
          created_at: new Date().toISOString(),
        };
        setNotifications((prev) => [empNotif, ...prev]);
        syncNotificationToSupabase(empNotif);
      }
    }

    logAction({
      action: `PAYMENT_${status.toUpperCase()}`,
      entity_type: 'payment',
      entity_id: paymentId,
      details: `Updated payment status to ${status}.${data?.reference_no ? ` Ref: ${data.reference_no}` : ''}${data?.reason ? ` Reason: ${data.reason}` : ''}`,
    });

    return { success: true, message: `Payment record updated to ${status}.` };
  };

  const sendPaymentReceiptEmail = useCallback(async (params: {
    payment_id?: string;
    user_id?: string;
    email?: string;
    employee_name?: string;
    employee_no?: string;
    department?: string;
    hourly_rate?: number;
    gross_amount?: number;
    total_hours?: number;
    method?: string;
    reference_no?: string;
    paid_at?: string;
    bank_name?: string;
    account_no?: string;
    pay_period_label?: string;
    lines?: any[];
  }) => {
    let activeToken = sessionRef.current?.access_token;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        activeToken = sessionData.session.access_token;
        sessionRef.current = sessionData.session;
        setSession(sessionData.session);
      }
    } catch (sessionErr) {
      console.warn('Could not refresh session token for payment receipt:', sessionErr);
    }

    try {
      const res = await secureFetch('/api/payments/send-receipt', {
        method: 'POST',
        accessToken: activeToken,
        body: params,
      });
      if (res.ok && res.data?.success) {
        return {
          success: true,
          sent: Boolean(res.data.sent),
          simulated: Boolean(res.data.simulated),
          message: res.data.message,
        };
      }
      return {
        success: false,
        sent: false,
        error: res.data?.error || res.data?.message || 'Failed to dispatch payment receipt email',
      };
    } catch (err: any) {
      console.warn('sendPaymentReceiptEmail failed:', err);
      return {
        success: false,
        sent: false,
        error: err?.message || 'Error connecting to email service',
      };
    }
  }, []);

  // Email employees who have not finalized their monthly DTR (all pending, or specific user_ids)
  const sendDtrFinalizeReminders = useCallback(async (params: { month: string; user_ids?: string[] }) => {
    let activeToken = sessionRef.current?.access_token;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        activeToken = sessionData.session.access_token;
        sessionRef.current = sessionData.session;
        setSession(sessionData.session);
      }
    } catch (sessionErr) {
      console.warn('Could not refresh session token for DTR reminders:', sessionErr);
    }

    try {
      const res = await secureFetch('/api/approvals/remind-employees', {
        method: 'POST',
        accessToken: activeToken,
        body: { month: params.month, user_ids: params.user_ids, today: serverCurrentDate },
      });
      if (res.ok && res.data?.success) {
        return res.data as DtrFinalizeReminderResponse;
      }
      return {
        success: false,
        sent: 0,
        failed: 0,
        results: [],
        error: res.data?.error || res.data?.message || 'Failed to send DTR reminders',
      } as DtrFinalizeReminderResponse;
    } catch (err: any) {
      console.warn('sendDtrFinalizeReminders failed:', err);
      return {
        success: false,
        sent: 0,
        failed: 0,
        results: [],
        error: err?.message || 'Error connecting to email service',
      } as DtrFinalizeReminderResponse;
    }
  }, [serverCurrentDate]);

  const reversePayment = (paymentId: string, reason: string) => {
    if (currentUser.role !== 'system_admin') {
      return { success: false, message: 'Only System Administrators can reverse paid payment records.' };
    }
    if (!reason || reason.trim().length < 5) {
      return { success: false, message: 'A formal reason is required for payment reversal.' };
    }

    const targetPayment = payments.find((p) => p.id === paymentId);
    if (targetPayment) {
      const updated: PaymentRecord = {
        ...targetPayment,
        status: 'pending',
        paid_at: undefined,
        status_reason: `Reversed by System Admin: ${reason}`,
      };
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? updated : p))
      );
      syncPaymentsToSupabase([updated]);
    }

    logAction({
      action: 'PAYMENT_REVERSED',
      entity_type: 'payment',
      entity_id: paymentId,
      details: `Reversed paid record. Reason: ${reason}`,
      is_system_scope: true,
    });

    return { success: true, message: 'Payment record reversed to Pending state.' };
  };

  const purgePeriodRetention = (periodId: string) => {
    if (currentUser.role !== 'system_admin') {
      return { success: false, message: 'Only System Administrators can purge retention archives.' };
    }

    // Mark period as purged
    const period = payPeriods.find((p) => p.id === periodId);
    if (period) {
      const updatedPeriod: PayPeriod = {
        ...period,
        status: 'purged',
        purged_at: new Date().toISOString(),
      };
      setPayPeriods((prev) =>
        prev.map((p) => (p.id === periodId ? updatedPeriod : p))
      );
      syncPayPeriodToSupabase(updatedPeriod);
    }

    // Delete associated entries and payments
    setDtrEntries((prev) => prev.filter((e) => e.pay_period_id !== periodId));
    setPayments((prev) => prev.filter((p) => p.pay_period_id !== periodId));
    deletePaymentsForPeriodFromSupabase(periodId);

    // Delete associated entries and payments
    setDtrEntries((prev) => prev.filter((e) => e.pay_period_id !== periodId));
    setPayments((prev) => prev.filter((p) => p.pay_period_id !== periodId));

    logAction({
      action: 'DATA_RETENTION_PURGE',
      entity_type: 'pay_period',
      entity_id: periodId,
      details: `Purged archived DTR and payment records for period ${periodId} per data retention policy`,
      is_system_scope: true,
    });

    return { success: true, message: 'Period records archived and purged successfully.' };
  };

  // Helper to notify administrators via email when an employee finalizes their monthly DTR
  const notifyAdminsOnMonthlyDtrFinalized = useCallback(
    async (params: {
      month: string;
      reference_no?: string;
      total_hours: number;
      regular_hours?: number;
      extra_hours?: number;
      approved_hours?: number;
      entries_count: number;
      submitted_at?: string;
      employee_note?: string;
      employee_id?: string;
      employee_name?: string;
      employee_no?: string;
      employee_email?: string;
      department?: string;
    }) => {
      const activeToken = sessionRef.current?.access_token;
      // Gather active administrators from memory as hint / fallback
      const adminList = usersRef.current
        .filter(
          (u) =>
            (u.role === 'admin' || u.role === 'system_admin') &&
            u.status === 'active' &&
            u.email
        )
        .map((u) => ({
          email: u.email,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Administrator',
        }));

      const payload = {
        ...params,
        admin_emails: adminList,
      };

      try {
        const res = await secureFetch('/api/approvals/notify-admins', {
          method: 'POST',
          accessToken: activeToken,
          body: payload,
        });

        if (res.ok && res.data?.success) {
          return {
            success: true,
            sent: Boolean(res.data.sent),
            simulated: Boolean(res.data.simulated),
            recipients: res.data.recipients || [],
            message: res.data.message || 'Administrators notified via email.',
          };
        }
        return {
          success: false,
          sent: false,
          message: res.data?.error || 'Failed to dispatch admin notification email',
        };
      } catch (err: any) {
        console.warn('notifyAdminsOnMonthlyDtrFinalized failed:', err);
        return {
          success: false,
          sent: false,
          message: err?.message || 'Error connecting to email service',
        };
      }
    },
    []
  );

  // Monthly Self-Approval Workflow
  const submitMonthlySelfApproval = async (params: {
    month: string;
    employee_note?: string;
  }) => {
    const { month, employee_note } = params;

    if (currentOpenSession && currentOpenSession.work_date.startsWith(month)) {
      return {
        success: false,
        message: 'Active shift in progress! Please punch out before finalizing your monthly DTR.',
      };
    }

    const userMonthEntries = dtrEntries.filter(
      (e) => e.user_id === currentUser.id && e.work_date.startsWith(month) && e.status !== 'rejected'
    );

    if (userMonthEntries.length === 0) {
      return {
        success: false,
        message: `No DTR entries found for ${month} to finalize.`,
      };
    }

    const hasUnclosed = userMonthEntries.some((e) => !e.time_out);
    if (hasUnclosed) {
      return {
        success: false,
        message: 'There are unclosed sessions in this month. Please ensure all sessions have punch-out times.',
      };
    }

    const total_hours = userMonthEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
    const regular_hours = userMonthEntries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
    const extra_hours = userMonthEntries.reduce((sum, e) => sum + (e.extra_hours || 0), 0);
    const approved_hours = userMonthEntries.reduce(
      (sum, e) => sum + (e.status === 'approved' || e.status === 'locked' ? (e.payable_hours || 0) : 0),
      0
    );

    const nowIso = new Date().toISOString();
    const refTag = generateMonthlyDtrRefTag(month, currentUser.employee_no, currentUser.id);

    // Mark entries as self-approved with reference tag
    const updatedEntries = dtrEntries.map((e) => {
      if (e.user_id === currentUser.id && e.work_date.startsWith(month) && e.status !== 'rejected') {
        const updated: DtrEntry = {
          ...e,
          self_approved: true,
          self_approved_at: nowIso,
          self_approved_ref: refTag,
          reference_no: refTag,
          updated_at: nowIso,
        };
        syncDtrToSupabase(updated);
        return updated;
      }
      return e;
    });

    setDtrEntries(updatedEntries);

    const [yearStr, monthStr] = month.split('-');
    const monthDate = new Date(Number(yearStr), Number(monthStr) - 1, 1);
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const finalNote = employee_note?.trim()
      ? `[REF:${refTag}] ${employee_note.trim()}`
      : `[REF:${refTag}]`;

    const approvalRecord: MonthlySelfApproval = {
      id: `msa-${currentUser.id}-${month}`,
      user_id: currentUser.id,
      month,
      reference_no: refTag,
      total_hours: Math.round(total_hours * 100) / 100,
      regular_hours: Math.round(regular_hours * 100) / 100,
      extra_hours: Math.round(extra_hours * 100) / 100,
      approved_hours: Math.round(approved_hours * 100) / 100,
      entries_count: userMonthEntries.length,
      submitted_at: nowIso,
      employee_note: finalNote,
      attested: true,
      status: 'submitted',
    };

    setMonthlySelfApprovals((prev) => {
      const filtered = prev.filter((a) => !(a.user_id === currentUser.id && a.month === month));
      return [approvalRecord, ...filtered];
    });
    syncApprovalToSupabase(approvalRecord);

    const newNotification: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipient_role: 'admin',
      type: 'monthly_self_approval',
      title: 'Monthly DTR Self-Approved',
      message: `${currentUser.first_name} ${currentUser.last_name} (${currentUser.employee_no || 'Employee'}) finalized and self-approved DTR logs for ${monthLabel} (${total_hours.toFixed(2)} hrs across ${userMonthEntries.length} shifts). Tag Reference: ${refTag}.`,
      user_id: currentUser.id,
      user_name: `${currentUser.first_name} ${currentUser.last_name}`,
      month,
      link_tab: 'admin_filings',
      is_read: false,
      created_at: nowIso,
    };

    setNotifications((prev) => [newNotification, ...prev]);
    syncNotificationToSupabase(newNotification);

    // Asynchronously dispatch email notification to administrators
    let emailSent = false;
    let emailSimulated = false;
    let recipientList: string[] = [];

    try {
      const emailRes = await notifyAdminsOnMonthlyDtrFinalized({
        month,
        reference_no: refTag,
        total_hours: Math.round(total_hours * 100) / 100,
        regular_hours: Math.round(regular_hours * 100) / 100,
        extra_hours: Math.round(extra_hours * 100) / 100,
        approved_hours: Math.round(approved_hours * 100) / 100,
        entries_count: userMonthEntries.length,
        submitted_at: nowIso,
        employee_note: finalNote,
        employee_id: currentUser.id,
        employee_name: `${currentUser.first_name} ${currentUser.last_name}`,
        employee_no: currentUser.employee_no,
        employee_email: currentUser.email,
        department: currentUser.department,
      });

      emailSent = Boolean(emailRes.sent);
      emailSimulated = Boolean(emailRes.simulated);
      recipientList = emailRes.recipients || [];
    } catch (emailErr) {
      console.warn('Admin email notification dispatch error on DTR finalize:', emailErr);
    }

    logAction({
      action: 'DTR_MONTH_SELF_APPROVED',
      entity_type: 'monthly_approval',
      entity_id: approvalRecord.id,
      details: `${currentUser.first_name} ${currentUser.last_name} finalized and self-approved DTR logs for ${monthLabel} (${total_hours.toFixed(2)}h across ${userMonthEntries.length} shifts). Ref Tag: ${refTag}. Attestation confirmed. Email notification dispatched to ${recipientList.length > 0 ? recipientList.join(', ') : 'administrators'}. Note: "${employee_note?.trim() || 'None'}"`,
    });

    const emailNotice = recipientList.length > 0
      ? ` Administrators (${recipientList.join(', ')}) have been notified via email.`
      : ' Administration has been notified via email.';

    return {
      success: true,
      message: `DTR records for ${monthLabel} have been finalized and self-approved with reference tag ${refTag}.${emailNotice}`,
      approval: approvalRecord,
      reference_no: refTag,
      email_sent: emailSent,
      email_simulated: emailSimulated,
      admin_recipients: recipientList,
    };
  };

  // Notification Operations
  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const updated = { ...n, is_read: true };
          syncNotificationToSupabase(updated);
          return updated;
        }
        return n;
      })
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => {
        const updated = { ...n, is_read: true };
        syncNotificationToSupabase(updated);
        return updated;
      })
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
    deleteNotificationFromSupabase(undefined, true);
  };

  const unreadNotificationsCount = useMemo(() => {
    if (currentUser.role === 'admin' || currentUser.role === 'system_admin') {
      return notifications.filter((n) => !n.is_read).length;
    }
    return notifications.filter((n) => !n.is_read && n.recipient_id === currentUser.id).length;
  }, [notifications, currentUser.role, currentUser.id]);

  // Monthly Payroll Generation & Status
  const generateMonthlyPayments = (month: string) => {
    const [yearStr, monthStr] = month.split('-');
    const monthDate = new Date(Number(yearStr), Number(monthStr) - 1, 1);
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Look for matching monthly pay period from payPeriods
    const matchingPeriod = payPeriods.find(
      (p) =>
        (p.frequency === 'monthly' || !p.frequency) &&
        (p.start_date.startsWith(month) || p.end_date.startsWith(month)) &&
        p.status !== 'purged'
    );
    const effectivePeriodId = matchingPeriod ? matchingPeriod.id : `month-${month}`;

    const eligibleUsers = visibleUsers.filter((u) => u.clocks_in);
    let createdCount = 0;
    let totalGross = 0;
    const newPaymentRecords: PaymentRecord[] = [];
    const duplicateIdsToDelete: string[] = [];

    eligibleUsers.forEach((u) => {
      const userMonthEntries = dtrEntries.filter(
        (e) =>
          (e.user_id === u.id || (u.email && e.user_id?.toLowerCase() === u.email.toLowerCase())) &&
          e.work_date.startsWith(month) &&
          e.status !== 'rejected'
      );
      if (userMonthEntries.length === 0) return;

      const approvedHours = userMonthEntries.reduce(
        (sum, e) => sum + (e.status === 'approved' || e.status === 'locked' ? (e.payable_hours || 0) : 0),
        0
      );
      const totalHours = userMonthEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
      const effectiveHours = approvedHours > 0 ? approvedHours : totalHours;
      const rate = u.hourly_rate || 0;
      const gross = Math.round(effectiveHours * rate * 100) / 100;

      totalGross += gross;
      createdCount++;

      // Find existing payment for this user and month / period
      const existing = payments.find(
        (p) =>
          (p.user_id === u.id || (u.email && p.user_id?.toLowerCase() === u.email.toLowerCase())) &&
          (p.month === month ||
            p.pay_period_id === `month-${month}` ||
            (matchingPeriod && p.pay_period_id === matchingPeriod.id))
      );

      // Collect any duplicate payment records that need cleanup
      const duplicates = payments.filter(
        (p) =>
          (p.user_id === u.id || (u.email && p.user_id?.toLowerCase() === u.email.toLowerCase())) &&
          (p.month === month ||
            p.pay_period_id === `month-${month}` ||
            (matchingPeriod && p.pay_period_id === matchingPeriod.id)) &&
          p.id !== (existing ? existing.id : '')
      );
      duplicates.forEach((d) => {
        if (d.id) duplicateIdsToDelete.push(d.id);
      });

      const isPaid = existing?.status === 'paid';
      const recordId = existing
        ? existing.id
        : (matchingPeriod ? `pay-${matchingPeriod.id}-${u.id}` : `pay-${month}-${u.id}`);

      const rec: PaymentRecord = {
        id: recordId,
        pay_period_id: effectivePeriodId,
        user_id: u.id,
        month,
        total_hours: isPaid && existing?.total_hours ? existing.total_hours : effectiveHours,
        sessions_count: isPaid && existing?.sessions_count ? existing.sessions_count : userMonthEntries.length,
        gross_amount: isPaid && existing?.gross_amount ? existing.gross_amount : gross,
        status: isPaid ? 'paid' : (existing ? existing.status : 'pending'),
        method: existing?.method,
        reference_no: existing?.reference_no,
        paid_at: existing?.paid_at,
        status_reason: existing?.status_reason,
        generated_at: existing?.generated_at || new Date().toISOString(),
        updated_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
        lines: existing?.lines && existing.lines.length > 0 ? existing.lines : [
          {
            id: `line-${Date.now()}-${u.id}`,
            line_type: 'hours',
            hourly_rate: rate,
            hours: effectiveHours,
            amount: gross,
            description: `Monthly payroll hours for ${monthLabel}`,
          },
        ],
      };
      newPaymentRecords.push(rec);
    });

    setPayments((prev) => {
      const otherPayments = prev.filter(
        (p) =>
          !(
            p.month === month ||
            p.pay_period_id === `month-${month}` ||
            (matchingPeriod && p.pay_period_id === matchingPeriod.id)
          ) &&
          !duplicateIdsToDelete.includes(p.id)
      );
      return [...otherPayments, ...newPaymentRecords];
    });
    if (newPaymentRecords.length > 0) {
      syncPaymentsToSupabase(newPaymentRecords);
    }
    if (duplicateIdsToDelete.length > 0) {
      duplicateIdsToDelete.forEach((dupId) => {
        deletePaymentByIdFromSupabase(dupId);
      });
    }

    logAction({
      action: 'MONTHLY_PAYMENTS_GENERATED',
      entity_type: 'payment',
      entity_id: effectivePeriodId,
      details: `Generated monthly payroll for ${monthLabel}: ${createdCount} employee records totaling ${settings.currency_symbol || '₱'}${totalGross.toFixed(2)}`,
    });

    return { count: createdCount, totalGross };
  };

  const updateMonthlyPaymentStatus = (
    userId: string,
    month: string,
    status: PaymentStatus,
    data?: { method?: string; reference_no?: string; paid_at?: string; reason?: string }
  ) => {
    const targetUser = users.find((u) => u.id === userId);
    const userMonthEntries = dtrEntries.filter(
      (e) =>
        (e.user_id === userId || (targetUser?.email && e.user_id?.toLowerCase() === targetUser.email.toLowerCase())) &&
        e.work_date.startsWith(month) &&
        e.status !== 'rejected'
    );
    const approvedHours = userMonthEntries.reduce(
      (sum, e) => sum + (e.status === 'approved' || e.status === 'locked' ? (e.payable_hours || 0) : (e.hours || 0)),
      0
    );
    const rate = targetUser?.hourly_rate || 0;
    const gross = Math.round(approvedHours * rate * 100) / 100;

    const matchingPeriod = payPeriods.find(
      (p) =>
        (p.frequency === 'monthly' || !p.frequency) &&
        (p.start_date.startsWith(month) || p.end_date.startsWith(month)) &&
        p.status !== 'purged'
    );
    const effectivePeriodId = matchingPeriod ? matchingPeriod.id : `month-${month}`;

    let updatedPaymentToSync: PaymentRecord | null = null;
    const duplicateIdsToDelete: string[] = [];

    setPayments((prev) => {
      const existingIndex = prev.findIndex(
        (p) =>
          (p.user_id === userId || (targetUser?.email && p.user_id?.toLowerCase() === targetUser.email.toLowerCase())) &&
          (p.month === month ||
            p.pay_period_id === `month-${month}` ||
            (matchingPeriod && p.pay_period_id === matchingPeriod.id))
      );

      // Collect any duplicate records to remove
      prev.forEach((p, idx) => {
        if (
          idx !== existingIndex &&
          (p.user_id === userId || (targetUser?.email && p.user_id?.toLowerCase() === targetUser.email.toLowerCase())) &&
          (p.month === month ||
            p.pay_period_id === `month-${month}` ||
            (matchingPeriod && p.pay_period_id === matchingPeriod.id))
        ) {
          if (p.id) duplicateIdsToDelete.push(p.id);
        }
      });

      let updated: PaymentRecord[];
      if (existingIndex >= 0) {
        updated = [...prev];
        const existing = updated[existingIndex];
        const updatedRec: PaymentRecord = {
          ...existing,
          pay_period_id: matchingPeriod ? matchingPeriod.id : existing.pay_period_id,
          month,
          status,
          method: data?.method !== undefined ? data.method : existing.method,
          reference_no: data?.reference_no !== undefined ? data.reference_no : existing.reference_no,
          paid_at: status === 'paid' ? (data?.paid_at || existing.paid_at || serverCurrentDate) : (data?.paid_at ?? existing.paid_at),
          status_reason: data?.reason !== undefined ? data.reason : existing.status_reason,
          updated_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
        };
        updated[existingIndex] = updatedRec;
        updatedPaymentToSync = updatedRec;
        updated = updated.filter((p, idx) => idx === existingIndex || !duplicateIdsToDelete.includes(p.id));
      } else {
        const recordId = matchingPeriod ? `pay-${matchingPeriod.id}-${userId}` : `pay-${month}-${userId}`;
        const newRec: PaymentRecord = {
          id: recordId,
          pay_period_id: effectivePeriodId,
          user_id: userId,
          month,
          total_hours: approvedHours,
          sessions_count: userMonthEntries.length,
          gross_amount: gross,
          status,
          method: data?.method,
          reference_no: data?.reference_no,
          paid_at: status === 'paid' ? (data?.paid_at || serverCurrentDate) : undefined,
          status_reason: data?.reason,
          generated_at: new Date().toISOString(),
          updated_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
          lines: [
            {
              id: `line-${Date.now()}-${userId}`,
              line_type: 'hours',
              hourly_rate: rate,
              hours: approvedHours,
              amount: gross,
              description: `Monthly hours for ${month}`,
            },
          ],
        };
        updated = [newRec, ...prev.filter((p) => !duplicateIdsToDelete.includes(p.id))];
        updatedPaymentToSync = newRec;
      }
      return updated;
    });

    if (updatedPaymentToSync) {
      syncPaymentsToSupabase([updatedPaymentToSync]);
    }
    if (duplicateIdsToDelete.length > 0) {
      duplicateIdsToDelete.forEach((dupId) => {
        deletePaymentByIdFromSupabase(dupId);
      });
    }

    if (status === 'paid' && targetUser) {
      const formattedGross = gross.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const empNotif: AppNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        recipient_role: 'employee',
        recipient_id: targetUser.id,
        type: 'payment_disbursed',
        title: 'Payment Disbursed & Tagged as Paid',
        message: `Your disbursement of ₱${formattedGross} for ${month} has been marked as PAID via ${data?.method?.replace(/_/g, ' ') || 'disbursement'}.${data?.reference_no ? ` Ref: ${data.reference_no}.` : ''}`,
        user_id: targetUser.id,
        month,
        link_tab: 'payments',
        is_read: false,
        created_at: new Date().toISOString(),
      };
      setNotifications((prev) => [empNotif, ...prev]);
      syncNotificationToSupabase(empNotif);
    }

    logAction({
      action: `MONTHLY_PAYMENT_${status.toUpperCase()}`,
      entity_type: 'payment',
      entity_id: `${month}-${userId}`,
      details: `Updated monthly payment status to ${status} for user ${targetUser?.first_name} ${targetUser?.last_name} (${month})`,
    });

    return { success: true, message: 'Monthly payment status updated.' };
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    syncSettingsToSupabase(merged);
    logAction({
      action: 'SETTINGS_UPDATED',
      entity_type: 'settings',
      entity_id: 'global',
      details: `System settings adjusted by ${currentUser.first_name}`,
      is_system_scope: true,
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser: (u) => setCurrentUserId(u.id),
        switchUserById,
        users,
        visibleUsers,
        settings,
        updateSettings,
        dtrEntries,
        corrections,
        payPeriods,
        payments,
        auditLogs,
        visibleAuditLogs,
        wageHistory,
        fileDtrEntry,
        currentOpenSession,
        timeIn,
        timeOut,
        cancelClockIn,
        updateRemarks,
        fileCorrection,
        approveDtrEntry,
        rejectDtrEntry,
        approveExtraHours,
        adjustDtrTime,
        timeOutOnBehalf,
        bulkApproveEligible,
        approveCorrection,
        rejectCorrection,
        updateUser,
        createUser,
        setHourlyWage,
        toggleAdminClockIn,
        setUserStatus,
        session,
        supabaseUser,
        isAuthLoading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        refreshCurrentUserProfile,
        refreshRemoteProfiles,
        resetPasswordForEmail,
        changePassword,
        isPasswordRecovery,
        setIsPasswordRecovery,
        pendingUsers,
        approvePendingUser,
        rejectPendingUser,
        closePayPeriod,
        lockPayPeriod,
        reopenPayPeriod,
        updatePayPeriodPayDate,
        generatePaymentsForPeriod,
        updatePaymentStatus,
        sendPaymentReceiptEmail,
        reversePayment,
        purgePeriodRetention,
        generateMonthlyPayments,
        updateMonthlyPaymentStatus,
        addAdditionalPayment,
        removeAdditionalPaymentLine,
        monthlySelfApprovals,
        submitMonthlySelfApproval,
        notifyAdminsOnMonthlyDtrFinalized,
        sendDtrFinalizeReminders,
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotifications,
        serverCurrentTime,
        serverCurrentDate,
        serverCurrentSeconds,
        serverCurrentTimeWithSeconds,
        setSimulatedClock,
        resetToRealClock,
        resetAllDataToDefaults,
        isSimulated: !!simulatedClock,
        refreshRemoteDtrEntries,
        refreshRemotePayments,
        refreshRemotePayPeriods,
        refreshRemoteReimbursements,
        refreshAllRemoteData,
        reimbursements,
        fileReimbursement,
        approveReimbursement,
        rejectReimbursement,
        deleteReimbursement,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
