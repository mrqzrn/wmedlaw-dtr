'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  HeartPulse,
  History,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  User,
  PayFrequency,
  UserRole,
  DEPARTMENTS,
  DEFAULT_HOURLY_WAGE,
  DEFAULT_DEPARTMENT,
} from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils-dtr';

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

const PAYOUT_TAG = /\s*\[PAYOUT:.*?\]/g;

const cleanEmergencyContact = (val?: string) => (val ? val.replace(PAYOUT_TAG, '').trim() : '');

/** Re-attach any hidden [PAYOUT:…] tags so editing the visible text never drops them. */
const withPayoutTags = (original: string | undefined, next: string) => {
  const tags = (original?.match(PAYOUT_TAG) ?? []).map((t) => t.trim()).join(' ');
  return [next.trim(), tags].filter(Boolean).join(' ');
};

const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const genEmployeeNo = () => `EMP-${Math.floor(10000 + Math.random() * 90000)}`;
const PLACEHOLDER_POSITIONS = ['Pending Assignment', 'Pending Approval'];
const DEPARTMENT_LIST = DEPARTMENTS as readonly string[];

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  semi_monthly: 'Semi-monthly',
  weekly: 'Weekly',
};

const SUGGESTED_POSITIONS = [
  'Website Support Specialist',
  'SEO Specialist',
  'Support Specialist',
  'Legal Assistant',
  'Law Office Administrator',
  'Payroll & Operations Lead',
  'Customer Support Lead',
  'Technical Content Specialist',
  'Operations & Payroll Administrator',
  'HR Compliance Manager',
  'Principal Infrastructure Officer',
];

const inputBase =
  'w-full min-h-[38px] px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20';

type Tone = 'success' | 'error' | 'info';
type Filter = 'active' | 'pending' | 'inactive';

/* ──────────────────────────────────────────────────────────────────────────
 * Small presentational pieces
 * ────────────────────────────────────────────────────────────────────────── */

const AVATAR_TONES = [
  'bg-blue-100 text-blue-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-violet-100 text-violet-800',
  'bg-rose-100 text-rose-800',
  'bg-cyan-100 text-cyan-800',
];

function Avatar({ user, size = 'md' }: { user: User; size?: 'md' | 'lg' }) {
  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || '?';
  const hash = [...String(user.id)].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];
  const dims = size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-xs';
  return (
    <span className={`${dims} ${tone} shrink-0 rounded-full inline-flex items-center justify-center font-bold`}>
      {initials}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const meta =
    role === 'system_admin'
      ? { label: 'System Admin', cls: 'bg-violet-50 text-violet-700 border-violet-200' }
      : role === 'admin'
        ? { label: 'Admin', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
        : { label: 'Employee', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'pending_approval'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';
  const dot =
    status === 'active' ? 'bg-emerald-500' : status === 'pending_approval' ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status.replace('_', ' ')}
    </span>
  );
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 py-4 space-y-3 border-t border-slate-100">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <span className="text-slate-400">{icon}</span>
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="block mb-1 text-[11px] font-medium text-slate-600">
      {children}
      {required && <span className="text-rose-500"> *</span>}
    </span>
  );
}

/** Text/number input that keeps its own draft and saves on blur or Enter. Escape reverts. */
function InlineField({
  label,
  value,
  onCommit,
  placeholder,
  icon,
  mono,
  list,
  type = 'text',
  step,
  allowEmpty = true,
  hint,
}: {
  label: string;
  value?: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  mono?: boolean;
  list?: string;
  type?: 'text' | 'number';
  step?: string;
  allowEmpty?: boolean;
  hint?: string;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(value ?? ''), [value]);

  const dirty = draft.trim() !== (value ?? '').trim();

  const commit = () => {
    if (!dirty) return;
    const next = draft.trim();
    if (!allowEmpty && !next) {
      setDraft(value ?? '');
      return;
    }
    onCommit(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2 mb-1 text-[11px] font-medium text-slate-600">
        <span>{label}</span>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="w-3 h-3" /> Saved
          </span>
        ) : dirty ? (
          <span className="text-amber-600">Unsaved</span>
        ) : null}
      </span>
      <span className="relative block">
        {icon && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        )}
        <input
          type={type}
          step={step}
          value={draft}
          list={list}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur(); // blur commits
            } else if (e.key === 'Escape') {
              setDraft(value ?? '');
            }
          }}
          className={`${inputBase} ${icon ? 'pl-8' : ''} ${mono ? 'font-mono' : ''} ${
            dirty ? 'border-amber-400 bg-amber-50/30' : ''
          }`}
        />
      </span>
      {hint && <span className="block mt-1 text-[10px] text-slate-500">{hint}</span>}
    </label>
  );
}

function Sheet({
  open,
  onClose,
  title,
  subtitle,
  icon,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs animate-in fade-in" onClick={onClose} />
      <div
        className={`relative w-full ${wide ? 'sm:max-w-lg' : 'sm:max-w-md'} max-h-[92dvh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150`}
      >
        <div className="sm:hidden flex justify-center pt-2">
          <span className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 bg-white/95 backdrop-blur border-b border-slate-100">
          <div className="flex items-start gap-2.5 min-w-0">
            {icon && (
              <span className="w-8 h-8 shrink-0 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-500 break-all">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -m-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 pb-safe">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-slate-100 text-slate-400 inline-flex items-center justify-center">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Main screen
 * ────────────────────────────────────────────────────────────────────────── */

export function AdminUsers() {
  const {
    currentUser,
    visibleUsers,
    createUser,
    updateUser,
    setHourlyWage,
    setUserStatus,
    wageHistory,
    approvePendingUser,
    rejectPendingUser,
    resetPasswordForEmail,
    refreshRemoteProfiles,
  } = useApp();

  /* ── UI state ─────────────────────────────────────────────────────────── */
  const [statusFilter, setStatusFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: Tone } | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWageModal, setShowWageModal] = useState(false);
  const [showWageHistoryModal, setShowWageHistoryModal] = useState(false);
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<User | null>(null);

  const [resetStatus, setResetStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const notify = (msg: string, tone: Tone = 'success') => {
    setToast({ msg, tone });
    window.setTimeout(() => setToast(null), 3500);
  };

  /* ── Data ─────────────────────────────────────────────────────────────── */
  const groups = useMemo(
    () => ({
      active: visibleUsers.filter((u) => u.status === 'active'),
      pending: visibleUsers.filter((u) => u.status === 'pending_approval'),
      inactive: visibleUsers.filter((u) => u.status === 'inactive' || u.status === 'locked'),
    }),
    [visibleUsers]
  );

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups[statusFilter];
    return groups[statusFilter].filter((u) =>
      [u.first_name, u.last_name, `${u.first_name} ${u.last_name}`, u.email, u.position, u.department, u.employee_no].some(
        (v) => v?.toLowerCase().includes(q)
      )
    );
  }, [groups, statusFilter, query]);

  const existingPositions = useMemo(() => {
    const set = new Set<string>(SUGGESTED_POSITIONS);
    visibleUsers.forEach((u) => {
      if (u.position && !PLACEHOLDER_POSITIONS.includes(u.position)) set.add(u.position.trim());
    });
    return Array.from(set).sort();
  }, [visibleUsers]);

  const userWageHistory = selectedUser ? wageHistory.filter((w) => w.user_id === selectedUser.id) : [];

  // Keep the open profile in sync with fresh data from the context.
  useEffect(() => {
    if (!selectedUser) return;
    const fresh = visibleUsers.find((u) => u.id === selectedUser.id);
    if (fresh && fresh !== selectedUser) setSelectedUser(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleUsers]);

  // Clear per-user transient state when switching profiles.
  useEffect(() => setResetStatus(null), [selectedUser?.id]);

  /* ── Permissions ──────────────────────────────────────────────────────── */
  // Conflict-of-interest rule: admins cannot see or change admin wages (including their own).
  const canManageWage = (target: User) => {
    if (currentUser.role === 'system_admin') return true;
    return target.role !== 'admin' && target.role !== 'system_admin';
  };

  /* ── Actions ──────────────────────────────────────────────────────────── */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshRemoteProfiles();
    } finally {
      window.setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const changeFilter = (f: Filter) => {
    setStatusFilter(f);
    if (f === 'pending') handleRefresh();
  };

  const commitUser = (patch: Partial<User>) => {
    if (!selectedUser) return;
    const updated = { ...selectedUser, ...patch };
    setSelectedUser(updated);
    updateUser(updated);
  };

  const parseHours = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const confirmToggleStatus = () => {
    const target = statusConfirmTarget;
    if (!target) return;
    const next = target.status === 'active' ? 'inactive' : 'active';
    setUserStatus(target.id, next);
    setStatusConfirmTarget(null);
    notify(`${target.first_name} is now ${next}.`, next === 'active' ? 'success' : 'info');
  };

  const handleResetPassword = async () => {
    if (!selectedUser?.email) return;
    setResetLoading(true);
    setResetStatus(null);
    const res = await resetPasswordForEmail(selectedUser.email, { forAdminLink: true });
    setResetLoading(false);
    if (!res.success) {
      setResetStatus({ msg: `Error: ${res.error}`, ok: false });
      return;
    }
    if (res.action_link) {
      try {
        await navigator.clipboard.writeText(res.action_link);
        setResetStatus({ msg: 'Reset link copied to clipboard.', ok: true });
      } catch {
        setResetStatus({ msg: 'Reset link generated.', ok: true });
      }
    } else {
      setResetStatus({ msg: `Reset link sent to ${selectedUser.email}.`, ok: true });
    }
    window.setTimeout(() => setResetStatus(null), 6000);
  };

  /* ── Wage form ────────────────────────────────────────────────────────── */
  const [wageRate, setWageRate] = useState(DEFAULT_HOURLY_WAGE.toFixed(2));
  const [wageEffectiveDate, setWageEffectiveDate] = useState(todayISO());
  const [wageNote, setWageNote] = useState('');

  const openWageModal = () => {
    if (!selectedUser) return;
    setWageRate(selectedUser.hourly_rate.toString());
    setWageEffectiveDate(todayISO());
    setWageNote('');
    setShowWageModal(true);
  };

  const parsedWage = parseFloat(wageRate);
  const wageDelta =
    selectedUser && Number.isFinite(parsedWage) && selectedUser.hourly_rate > 0
      ? ((parsedWage - selectedUser.hourly_rate) / selectedUser.hourly_rate) * 100
      : null;

  const handleSaveWage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!Number.isFinite(parsedWage) || parsedWage <= 0) {
      notify('Enter a valid positive hourly wage.', 'error');
      return;
    }
    setHourlyWage(selectedUser.id, parsedWage, wageEffectiveDate, wageNote);
    // Only reflect the new rate right away if it is already in effect.
    if (wageEffectiveDate <= todayISO()) setSelectedUser({ ...selectedUser, hourly_rate: parsedWage });
    setShowWageModal(false);
    notify(
      wageEffectiveDate <= todayISO()
        ? `Wage updated to ${formatCurrency(parsedWage)}/hr.`
        : `New wage scheduled for ${formatDate(wageEffectiveDate)}.`
    );
  };

  /* ── Create form ──────────────────────────────────────────────────────── */
  const emptyCreate = {
    username: '',
    email: '',
    first: '',
    last: '',
    employeeNo: '',
    position: '',
    department: DEFAULT_DEPARTMENT as string,
    role: 'employee' as 'employee' | 'admin',
    wage: DEFAULT_HOURLY_WAGE.toFixed(2),
    frequency: 'monthly' as PayFrequency,
  };
  const [createForm, setCreateForm] = useState(emptyCreate);
  const setCreate = <K extends keyof typeof emptyCreate>(k: K, v: (typeof emptyCreate)[K]) =>
    setCreateForm((f) => ({ ...f, [k]: v }));

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const f = createForm;
    const created = createUser({
      username: f.username,
      email: f.email,
      first_name: f.first,
      last_name: f.last,
      employee_no: f.employeeNo || genEmployeeNo(),
      position: f.position,
      department: f.department,
      role: f.role,
      status: 'active',
      is_hidden: false,
      clocks_in: f.role === 'employee',
      contact_no: '',
      hire_date: todayISO(),
      hourly_rate: parseFloat(f.wage) || DEFAULT_HOURLY_WAGE,
      pay_frequency: f.frequency,
      max_hours_day: 8.0,
      max_hours_week: 40.0,
    });
    setShowCreateModal(false);
    setCreateForm(emptyCreate);
    setStatusFilter('active');
    setSelectedUser(created);
    notify(`Account created for ${created.first_name} ${created.last_name}.`);
  };

  /* ── Approval form ────────────────────────────────────────────────────── */
  const [selectedPendingUser, setSelectedPendingUser] = useState<User | null>(null);
  const [approvalRole, setApprovalRole] = useState<UserRole>('employee');
  const [approvalPosition, setApprovalPosition] = useState('');
  const [approvalDepartment, setApprovalDepartment] = useState<string>(DEFAULT_DEPARTMENT);
  const [approvalWage, setApprovalWage] = useState(DEFAULT_HOURLY_WAGE.toFixed(2));
  const [approvalFrequency, setApprovalFrequency] = useState<PayFrequency>('monthly');
  const [approvalEmployeeNo, setApprovalEmployeeNo] = useState('');
  const [approvalClocksIn, setApprovalClocksIn] = useState(true);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [approvalBusy, setApprovalBusy] = useState(false);

  const openApprovalModal = (user: User) => {
    setSelectedPendingUser(user);
    setApprovalRole('employee');
    setApprovalPosition(
      user.position && !PLACEHOLDER_POSITIONS.includes(user.position) ? user.position : 'Customer Support Specialist'
    );
    setApprovalDepartment(user.department && user.department !== 'General' ? user.department : DEFAULT_DEPARTMENT);
    setApprovalWage(user.hourly_rate ? user.hourly_rate.toString() : DEFAULT_HOURLY_WAGE.toFixed(2));
    setApprovalFrequency(user.pay_frequency || 'monthly');
    setApprovalEmployeeNo(user.employee_no || genEmployeeNo());
    setApprovalClocksIn(true);
    setDeclining(false);
    setDeclineReason('Registration requirements not met');
  };

  const closeApproval = () => {
    setSelectedPendingUser(null);
    setDeclining(false);
  };

  const handleConfirmApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPendingUser) return;
    setApprovalBusy(true);
    const res = await approvePendingUser(selectedPendingUser.id, {
      role: approvalRole,
      position: approvalPosition,
      department: approvalDepartment,
      hourly_rate: parseFloat(approvalWage) || DEFAULT_HOURLY_WAGE,
      pay_frequency: approvalFrequency,
      employee_no: approvalEmployeeNo,
      clocks_in: approvalClocksIn,
    });
    setApprovalBusy(false);
    notify(res.message, res.success ? 'success' : 'error');
    if (res.success) closeApproval();
  };

  const handleDecline = async () => {
    if (!selectedPendingUser) return;
    setApprovalBusy(true);
    const res = await rejectPendingUser(
      selectedPendingUser.id,
      declineReason.trim() || 'Registration requirements not met'
    );
    setApprovalBusy(false);
    notify(res.message, 'info');
    closeApproval();
  };

  const roleOptions: { value: UserRole; label: string; desc: string }[] = [
    { value: 'employee', label: 'Employee', desc: 'Punch clock, DTR, overtime, pay status' },
    { value: 'admin', label: 'Administrator', desc: 'DTR approvals, payroll, user directory' },
    ...(currentUser.role === 'system_admin'
      ? [{ value: 'system_admin' as UserRole, label: 'System Admin', desc: 'Full infrastructure access' }]
      : []),
  ];

  /* ── Render ───────────────────────────────────────────────────────────── */
  const tabs: { key: Filter; label: string; count: number; icon: React.ReactNode; active: string; idle: string }[] = [
    {
      key: 'active',
      label: 'Active',
      count: groups.active.length,
      icon: <Users className="w-4 h-4" />,
      active: 'border-blue-600 ring-2 ring-blue-500/15 bg-blue-50/40',
      idle: 'text-blue-600',
    },
    {
      key: 'pending',
      label: 'Pending approval',
      count: groups.pending.length,
      icon: <UserCheck className="w-4 h-4" />,
      active: 'border-amber-500 ring-2 ring-amber-500/15 bg-amber-50/40',
      idle: 'text-amber-600',
    },
    {
      key: 'inactive',
      label: 'Suspended',
      count: groups.inactive.length,
      icon: <UserX className="w-4 h-4" />,
      active: 'border-rose-500 ring-2 ring-rose-500/15 bg-rose-50/40',
      idle: 'text-rose-600',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Page header ── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">People & Wages</h1>
          <p className="text-xs text-slate-600">
            Manage staff profiles, hourly rates and pay cycles, and review new registrations.
          </p>
        </div>
        <button
          id="btn-add-employee"
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-4 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Add employee
        </button>
      </header>

      {/* ── Status tiles (double as filter tabs) ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tabs.map((t) => {
          const isActive = statusFilter === t.key;
          const attention = t.key === 'pending' && t.count > 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => changeFilter(t.key)}
              className={`relative text-left rounded-xl border bg-white p-3 sm:p-4 shadow-xs transition-all cursor-pointer ${
                isActive ? t.active : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${t.idle}`}>
                {t.icon}
                <span className="hidden xs:inline text-slate-600">{t.label}</span>
              </span>
              <span className="block mt-1 text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">{t.count}</span>
              <span className="xs:hidden block text-[10px] text-slate-500">{t.label}</span>
              {attention && (
                <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 sm:gap-5 items-start">
        {/* ── Directory ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-slate-100">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, position, ID…"
                className={`${inputBase} pl-8 bg-slate-50`}
              />
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Check server for new registrations and profile changes"
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Syncing…' : 'Sync'}</span>
            </button>
          </div>

          {statusFilter === 'pending' ? (
            listed.length === 0 ? (
              <EmptyState
                icon={<UserCheck className="w-5 h-5" />}
                title={query ? 'No matching registrations' : 'No pending registrations'}
                body="New sign-ups via email or Google appear here for role assignment and approval."
                action={
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Checking…' : 'Check for new registrations'}
                  </button>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {listed.map((u) => (
                  <li key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar user={u} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {u.first_name} {u.last_name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {u.auth_provider === 'google' ? 'Google' : 'Email'}
                      </span>
                      <button
                        type="button"
                        onClick={() => openApprovalModal(u)}
                        className="ml-auto sm:ml-0 inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Review
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : listed.length === 0 ? (
            <EmptyState
              icon={<Users className="w-5 h-5" />}
              title={query ? 'No matches' : `No ${statusFilter === 'active' ? 'active' : 'suspended'} accounts`}
              body={query ? `Nothing matches “${query}”.` : 'Accounts will appear here once added.'}
            />
          ) : (
            <>
              <div className="hidden md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1rem] gap-3 px-4 py-2 bg-slate-50/80 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <span>Employee</span>
                <span>Role</span>
                <span>Hourly wage</span>
                <span>Pay cycle</span>
                <span />
              </div>
              <ul className="divide-y divide-slate-100">
                {listed.map((u) => {
                  const isSelected = selectedUser?.id === u.id;
                  const canSeeWage = canManageWage(u);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedUser(u)}
                        className={`relative w-full text-left grid grid-cols-[minmax(0,1fr)_1rem] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1rem] items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        {isSelected && <span className="absolute left-0 inset-y-0 w-0.5 bg-blue-600" />}
                        <span className="flex items-center gap-3 min-w-0">
                          <Avatar user={u} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900 truncate">
                                {u.first_name} {u.last_name}
                              </span>
                              {u.status === 'locked' && <StatusPill status="locked" />}
                            </span>
                            <span className="block text-[11px] text-slate-500 truncate">
                              {u.position || 'No position'} · {u.department}
                            </span>
                            {/* Mobile meta line */}
                            <span className="md:hidden mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                              <RoleBadge role={u.role} />
                              {canSeeWage ? (
                                <span className="font-mono font-semibold text-emerald-700">
                                  {formatCurrency(u.hourly_rate)}/hr
                                </span>
                              ) : (
                                <span className="italic text-slate-400">Wage restricted</span>
                              )}
                              <span className="text-slate-500">{FREQUENCY_LABEL[u.pay_frequency] ?? u.pay_frequency}</span>
                            </span>
                          </span>
                        </span>
                        <span className="hidden md:block">
                          <RoleBadge role={u.role} />
                        </span>
                        <span className="hidden md:block text-xs font-mono font-semibold">
                          {canSeeWage ? (
                            <span className="text-emerald-700">{formatCurrency(u.hourly_rate)}/hr</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-sans font-normal italic text-slate-400">
                              <Shield className="w-3 h-3" /> Restricted
                            </span>
                          )}
                        </span>
                        <span className="hidden md:block text-xs text-slate-600">
                          {FREQUENCY_LABEL[u.pay_frequency] ?? u.pay_frequency}
                        </span>
                        <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* ── Profile panel: sticky column on desktop, bottom sheet on mobile ── */}
        <aside
          className={`${
            selectedUser ? 'fixed inset-0 z-40 flex items-end bg-slate-900/40 backdrop-blur-xs' : 'hidden'
          } lg:static lg:z-auto lg:block lg:bg-transparent lg:backdrop-blur-none lg:sticky lg:top-4`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedUser(null);
          }}
        >
          <div className="w-full max-h-[92dvh] lg:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-t-2xl lg:rounded-xl border border-slate-200 shadow-2xl lg:shadow-xs animate-in fade-in slide-in-from-bottom-4 lg:slide-in-from-bottom-0 duration-200">
            {selectedUser ? (
              <>
                <div className="lg:hidden flex justify-center pt-2">
                  <span className="w-10 h-1 rounded-full bg-slate-300" />
                </div>

                {/* Identity */}
                <div className="px-5 pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <Avatar user={selectedUser} size="lg" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 text-base leading-tight">
                        {selectedUser.first_name} {selectedUser.last_name}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        {selectedUser.position || 'No position assigned'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <RoleBadge role={selectedUser.role} />
                        <StatusPill status={selectedUser.status} />
                        {selectedUser.employee_no && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200">
                            {selectedUser.employee_no}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="p-1.5 -m-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                      aria-label="Close profile"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-1.5 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="font-mono truncate">{selectedUser.email}</span>
                    </div>
                    {/* {selectedUser.hire_date && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>Hired {formatDate(selectedUser.hire_date)}</span>
                      </div>
                    )} */}
                  </dl>
                </div>

                {/* Compensation */}
                <Section
                  title="Compensation"
                  icon={<Wallet className="w-3.5 h-3.5" />}
                  action={
                    canManageWage(selectedUser) && (
                      <button
                        id="btn-open-wage-modal"
                        type="button"
                        onClick={openWageModal}
                        className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                      >
                        Update rate
                      </button>
                    )
                  }
                >
                  {canManageWage(selectedUser) ? (
                    <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-3.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
                          {formatCurrency(selectedUser.hourly_rate)}
                        </span>
                        <span className="text-xs text-emerald-700/70">/ hr</span>
                      </div>
                      {/* <p className="mt-1 text-[11px] text-slate-500">
                        Basis for pay (hours × wage). Never shown to the employee.
                      </p> */}
                      {userWageHistory.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowWageHistoryModal(true)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
                        >
                          <History className="w-3 h-3" /> Wage history ({userWageHistory.length})
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2.5 rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600">
                      <Shield className="w-4 h-4 shrink-0 text-slate-400" />
                      <p>
                        Conflict-of-interest rule: administrators can’t view or change admin wages. 
                      </p>
                    </div>
                  )}
                </Section>

                {/* Employment */}
                <Section title="Employment" icon={<Briefcase className="w-3.5 h-3.5" />}>
                  <InlineField
                    key={`${selectedUser.id}-position`}
                    label="Position / job title"
                    value={selectedUser.position}
                    list="staff-directory-positions"
                    placeholder="e.g. Website Support Specialist"
                    allowEmpty={false}
                    onCommit={(v) => commitUser({ position: v })}
                    // hint="Updates rosters, filings and exports immediately."
                  />
                  <datalist id="staff-directory-positions">
                    {existingPositions.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>

                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                    <label className="block">
                      <FieldLabel>Department</FieldLabel>
                      <select
                        value={selectedUser.department}
                        onChange={(e) => commitUser({ department: e.target.value })}
                        className={inputBase}
                      >
                        {DEPARTMENT_LIST.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                        {!DEPARTMENT_LIST.includes(selectedUser.department) && (
                          <option value={selectedUser.department}>{selectedUser.department}</option>
                        )}
                      </select>
                    </label>
                    <label className="block">
                      <FieldLabel>Pay cycle</FieldLabel>
                      <select
                        value={selectedUser.pay_frequency}
                        onChange={(e) => commitUser({ pay_frequency: e.target.value as PayFrequency })}
                        className={inputBase}
                      >
                        <option value="monthly">Monthly (1st – last day)</option>
                        <option value="semi_monthly">Semi-monthly (1–15, 16–end)</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </label>
                  </div>
                  <p className="-mt-1 text-[10px] text-slate-500">
                    Pay cycle changes take effect the day after the current period ends.
                  </p>

                  <div className="grid grid-cols-2 gap-2.5">
                    <InlineField
                      key={`${selectedUser.id}-maxday`}
                      label="Daily hour limit"
                      type="number"
                      step="0.5"
                      mono
                      placeholder="8.0"
                      value={selectedUser.max_hours_day?.toString()}
                      onCommit={(v) => commitUser({ max_hours_day: parseHours(v) })}
                    />
                    <InlineField
                      key={`${selectedUser.id}-maxweek`}
                      label="Weekly hour limit"
                      type="number"
                      step="1"
                      mono
                      placeholder="40.0"
                      value={selectedUser.max_hours_week?.toString()}
                      onCommit={(v) => commitUser({ max_hours_week: parseHours(v) })}
                    />
                  </div>
                </Section>

                {/* Contact */}
                <Section
                  title="Contact"
                  icon={<Phone className="w-3.5 h-3.5" />}
                  action={
                    selectedUser.contact_no && (
                      <a
                        href={`tel:${selectedUser.contact_no}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                      >
                        <Phone className="w-3 h-3" /> Call
                      </a>
                    )
                  }
                >
                  <InlineField
                    key={`${selectedUser.id}-phone`}
                    label="Phone number"
                    icon={<Phone className="w-3.5 h-3.5" />}
                    placeholder="+63 917 123 4567"
                    value={selectedUser.contact_no}
                    onCommit={(v) => commitUser({ contact_no: v })}
                  />
                  <InlineField
                    key={`${selectedUser.id}-address`}
                    label="Residential address"
                    icon={<MapPin className="w-3.5 h-3.5" />}
                    placeholder="Street, City, Postal Code"
                    value={selectedUser.address}
                    onCommit={(v) => commitUser({ address: v })}
                  />
                  <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-2.5">
                    <InlineField
                      key={`${selectedUser.id}-emergency`}
                      label="Emergency contact"
                      icon={<HeartPulse className="w-3.5 h-3.5 text-rose-500" />}
                      placeholder="Jane Doe – Spouse – +63 918 000 0000"
                      value={cleanEmergencyContact(selectedUser.emergency_contact)}
                      onCommit={(v) =>
                        commitUser({ emergency_contact: withPayoutTags(selectedUser.emergency_contact, v) })
                      }
                      // hint="Name, relationship and phone for medical or workplace emergencies."
                    />
                  </div>
                </Section>

                {/* Payout */}
                <Section title="Payout account" icon={<Wallet className="w-3.5 h-3.5" />}>
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                    <InlineField
                      key={`${selectedUser.id}-bank`}
                      label="Bank / eWallet"
                      placeholder="BDO, GCash, Maya"
                      value={selectedUser.bank_name}
                      onCommit={(v) => commitUser({ bank_name: v })}
                    />
                    <InlineField
                      key={`${selectedUser.id}-acct`}
                      label="Account / mobile no."
                      mono
                      placeholder="0012-3456-7890"
                      value={selectedUser.account_no}
                      onCommit={(v) => commitUser({ account_no: v })}
                    />
                  </div>
                </Section>

                {/* Access */}
                <Section title="Account access" icon={<KeyRound className="w-3.5 h-3.5" />}>
                  <div className="flex flex-col xs:flex-row gap-2">
                    <button
                      type="button"
                      disabled={resetLoading}
                      onClick={handleResetPassword}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 min-h-[38px] rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      {resetLoading ? 'Sending…' : 'Send password reset'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusConfirmTarget(selectedUser)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 min-h-[38px] rounded-lg border text-xs font-semibold cursor-pointer ${
                        selectedUser.status === 'active'
                          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {selectedUser.status === 'active' ? (
                        <>
                          <UserX className="w-3.5 h-3.5" /> Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" /> Reactivate
                        </>
                      )}
                    </button>
                  </div>
                  {resetStatus && (
                    <p
                      className={`text-[11px] font-medium break-words ${
                        resetStatus.ok ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {resetStatus.msg}
                    </p>
                  )}
                </Section>
                <div className="h-2 pb-safe" />
              </>
            ) : (
              <EmptyState
                icon={<Users className="w-5 h-5" />}
                title="No one selected"
                body="Pick someone from the directory to manage their wage, pay cycle, limits and contact details."
              />
            )}
          </div>
        </aside>
      </div>

      {/* ── Wage update ── */}
      <Sheet
        open={showWageModal && !!selectedUser}
        onClose={() => setShowWageModal(false)}
        title="Set hourly wage"
        subtitle={selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : undefined}
        icon={<Wallet className="w-4 h-4" />}
      >
        {selectedUser && (
          <form onSubmit={handleSaveWage} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div>
                <span className="block text-[11px] text-slate-500">Current</span>
                <span className="font-mono font-semibold text-slate-800">{formatCurrency(selectedUser.hourly_rate)}/hr</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">Change</span>
                <span
                  className={`font-mono font-semibold ${
                    wageDelta === null || wageDelta === 0
                      ? 'text-slate-500'
                      : wageDelta > 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                  }`}
                >
                  {wageDelta === null ? '—' : `${wageDelta > 0 ? '+' : ''}${wageDelta.toFixed(1)}%`}
                </span>
              </div>
            </div>

            <label className="block">
              <FieldLabel required>New hourly rate (₱)</FieldLabel>
              <input
                type="number"
                step="0.25"
                min="0"
                required
                autoFocus
                value={wageRate}
                onChange={(e) => setWageRate(e.target.value)}
                className={`${inputBase} font-mono text-sm`}
              />
            </label>

            <label className="block">
              <FieldLabel required>Effective date</FieldLabel>
              <input
                type="date"
                required
                value={wageEffectiveDate}
                onChange={(e) => setWageEffectiveDate(e.target.value)}
                className={inputBase}
              />
              <span className="block mt-1 text-[10px] text-slate-500">
                Hours before this date keep the old wage; hours on or after it use the new one.
              </span>
            </label>

            <label className="block">
              <FieldLabel>Adjustment note</FieldLabel>
              <input
                type="text"
                value={wageNote}
                onChange={(e) => setWageNote(e.target.value)}
                placeholder="e.g. Annual cost-of-living adjustment"
                className={inputBase}
              />
            </label>

            <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWageModal(false)}
                className="px-4 min-h-[40px] rounded-lg font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 min-h-[40px] rounded-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer"
              >
                Save wage record
              </button>
            </div>
          </form>
        )}
      </Sheet>

      {/* ── Wage history ── */}
      <Sheet
        open={showWageHistoryModal && !!selectedUser}
        onClose={() => setShowWageHistoryModal(false)}
        title="Wage history"
        subtitle={selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : undefined}
        icon={<History className="w-4 h-4" />}
      >
        <ol className="relative space-y-4 border-l border-slate-200 ml-1.5">
          {userWageHistory.map((w, i) => (
            <li key={w.id} className="pl-4 relative">
              <span
                className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                  !w.effective_to ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <span className="font-mono font-bold text-sm text-slate-900">{formatCurrency(w.hourly_rate)}/hr</span>
                <span className="text-[11px] font-mono text-slate-500">
                  {formatDate(w.effective_from)} → {w.effective_to ? formatDate(w.effective_to) : 'Present'}
                </span>
              </div>
              {w.note && <p className="mt-0.5 text-xs text-slate-700 break-words">{w.note}</p>}
              <p className="mt-0.5 text-[10px] text-slate-400">
                Set by {w.set_by_name}
                {i === 0 && !w.effective_to ? ' · current' : ''}
              </p>
            </li>
          ))}
        </ol>
      </Sheet>

      {/* ── Create account ── */}
      <Sheet
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add staff account"
        icon={<UserPlus className="w-4 h-4" />}
        wide
      >
        <form onSubmit={handleCreateUser} className="space-y-5 text-xs">
          <fieldset className="space-y-3">
            <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Identity</legend>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              <label>
                <FieldLabel required>First name</FieldLabel>
                <input required value={createForm.first} onChange={(e) => setCreate('first', e.target.value)} className={inputBase} />
              </label>
              <label>
                <FieldLabel required>Last name</FieldLabel>
                <input required value={createForm.last} onChange={(e) => setCreate('last', e.target.value)} className={inputBase} />
              </label>
              <label>
                <FieldLabel required>Username</FieldLabel>
                <input required value={createForm.username} onChange={(e) => setCreate('username', e.target.value)} className={inputBase} />
              </label>
              <label>
                <FieldLabel required>Work email</FieldLabel>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreate('email', e.target.value)}
                  className={inputBase}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Role & placement</legend>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              <label>
                <FieldLabel required>Position / job title</FieldLabel>
                <input
                  required
                  list="staff-directory-positions-create"
                  value={createForm.position}
                  onChange={(e) => setCreate('position', e.target.value)}
                  className={inputBase}
                />
                <datalist id="staff-directory-positions-create">
                  {existingPositions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
              <label>
                <FieldLabel>Department</FieldLabel>
                <select value={createForm.department} onChange={(e) => setCreate('department', e.target.value)} className={inputBase}>
                  {DEPARTMENT_LIST.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <FieldLabel>Role</FieldLabel>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreate('role', e.target.value as 'employee' | 'admin')}
                  className={inputBase}
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label>
                <FieldLabel>Employee ID</FieldLabel>
                <input
                  value={createForm.employeeNo}
                  onChange={(e) => setCreate('employeeNo', e.target.value)}
                  placeholder="Auto-generated if blank"
                  className={`${inputBase} font-mono`}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Pay</legend>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              <label>
                <FieldLabel required>Hourly wage (₱)</FieldLabel>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  required
                  value={createForm.wage}
                  onChange={(e) => setCreate('wage', e.target.value)}
                  className={`${inputBase} font-mono`}
                />
              </label>
              <label>
                <FieldLabel>Pay cycle</FieldLabel>
                <select
                  value={createForm.frequency}
                  onChange={(e) => setCreate('frequency', e.target.value as PayFrequency)}
                  className={inputBase}
                >
                  <option value="monthly">Monthly</option>
                  <option value="semi_monthly">Semi-monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
            </div>
          </fieldset>

          <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 min-h-[40px] rounded-lg font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 min-h-[40px] rounded-lg font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-xs cursor-pointer"
            >
              Create account
            </button>
          </div>
        </form>
      </Sheet>

      {/* ── Approve / decline registration ── */}
      <Sheet
        open={!!selectedPendingUser}
        onClose={closeApproval}
        title={declining ? 'Decline registration' : 'Approve registration'}
        subtitle={selectedPendingUser?.email}
        icon={<UserCheck className="w-4 h-4 text-amber-700" />}
        wide
      >
        {selectedPendingUser && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
              <Avatar user={selectedPendingUser} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {selectedPendingUser.first_name} {selectedPendingUser.last_name}
                </p>
                <p className="text-[11px] text-slate-500">
                  Signed up with {selectedPendingUser.auth_provider === 'google' ? 'Google' : 'email & password'}
                </p>
              </div>
            </div>

            {declining ? (
              <div className="space-y-3">
                <label className="block">
                  <FieldLabel required>Reason for declining</FieldLabel>
                  <textarea
                    autoFocus
                    rows={3}
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    className={`${inputBase} resize-none`}
                  />
                </label>
                <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDeclining(false)}
                    className="px-4 min-h-[40px] rounded-lg font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={approvalBusy}
                    onClick={handleDecline}
                    className="px-4 min-h-[40px] rounded-lg font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    {approvalBusy ? 'Declining…' : 'Decline registration'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmApproval} className="space-y-4">
                <fieldset>
                  <legend className="mb-1.5 text-[11px] font-medium text-slate-600">
                    System role <span className="text-rose-500">*</span>
                  </legend>
                  <div className={`grid gap-2 ${roleOptions.length === 3 ? 'sm:grid-cols-3' : 'xs:grid-cols-2'}`}>
                    {roleOptions.map((opt) => {
                      const checked = approvalRole === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`relative flex flex-col gap-0.5 rounded-lg border p-2.5 cursor-pointer transition-all ${
                            checked ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/15' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="approval-role"
                            value={opt.value}
                            checked={checked}
                            onChange={() => {
                              setApprovalRole(opt.value);
                              setApprovalClocksIn(opt.value === 'employee');
                            }}
                            className="sr-only"
                          />
                          <span className="font-semibold text-slate-900">{opt.label}</span>
                          <span className="text-[10px] text-slate-500 leading-snug">{opt.desc}</span>
                          {checked && <CheckCircle2 className="absolute top-2 right-2 w-3.5 h-3.5 text-blue-600" />}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                  <label>
                    <FieldLabel required>Position / job title</FieldLabel>
                    <input
                      required
                      list="staff-directory-positions-approval"
                      value={approvalPosition}
                      onChange={(e) => setApprovalPosition(e.target.value)}
                      className={inputBase}
                    />
                    <datalist id="staff-directory-positions-approval">
                      {existingPositions.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    <FieldLabel>Department</FieldLabel>
                    <select
                      value={approvalDepartment}
                      onChange={(e) => setApprovalDepartment(e.target.value)}
                      className={inputBase}
                    >
                      {DEPARTMENT_LIST.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                      {!DEPARTMENT_LIST.includes(approvalDepartment) && (
                        <option value={approvalDepartment}>{approvalDepartment}</option>
                      )}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label>
                    <FieldLabel required>Hourly wage (₱)</FieldLabel>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      required
                      value={approvalWage}
                      onChange={(e) => setApprovalWage(e.target.value)}
                      className={`${inputBase} font-mono`}
                    />
                  </label>
                  <label>
                    <FieldLabel>Pay cycle</FieldLabel>
                    <select
                      value={approvalFrequency}
                      onChange={(e) => setApprovalFrequency(e.target.value as PayFrequency)}
                      className={inputBase}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="semi_monthly">Semi-monthly</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </label>
                  <label>
                    <FieldLabel required>Employee ID</FieldLabel>
                    <input
                      required
                      value={approvalEmployeeNo}
                      onChange={(e) => setApprovalEmployeeNo(e.target.value)}
                      className={`${inputBase} font-mono`}
                    />
                  </label>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer">
                  <span>
                    <span className="block font-semibold text-slate-800">Punch station / clock-in</span>
                    <span className="block text-[10px] text-slate-500">Lets this account record time in the DTR.</span>
                  </span>
                  <span className="relative inline-flex shrink-0">
                    <input
                      type="checkbox"
                      checked={approvalClocksIn}
                      onChange={(e) => setApprovalClocksIn(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="w-9 h-5 rounded-full bg-slate-300 peer-checked:bg-emerald-600 transition-colors" />
                    <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                  </span>
                </label>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDeclining(true)}
                    className="px-3 min-h-[40px] rounded-lg font-medium text-rose-700 border border-rose-200 hover:bg-rose-50 cursor-pointer"
                  >
                    Decline…
                  </button>
                  <div className="flex flex-col-reverse xs:flex-row gap-2">
                    <button
                      type="button"
                      onClick={closeApproval}
                      className="px-3 min-h-[40px] rounded-lg font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={approvalBusy}
                      className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[40px] rounded-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      {approvalBusy ? 'Approving…' : 'Approve & activate'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </Sheet>

      {/* ── Status change confirmation ── */}
      <Sheet
        open={!!statusConfirmTarget}
        onClose={() => setStatusConfirmTarget(null)}
        title={statusConfirmTarget?.status === 'active' ? 'Deactivate account?' : 'Reactivate account?'}
        icon={<AlertCircle className="w-4 h-4" />}
      >
        {statusConfirmTarget && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-700">
              {statusConfirmTarget.status === 'active' ? (
                <>
                  <strong>
                    {statusConfirmTarget.first_name} {statusConfirmTarget.last_name}
                  </strong>{' '}
                  will lose access and won’t be able to clock in until reactivated. Their records and wage history are
                  kept.
                </>
              ) : (
                <>
                  <strong>
                    {statusConfirmTarget.first_name} {statusConfirmTarget.last_name}
                  </strong>{' '}
                  will regain access with their existing role and settings.
                </>
              )}
            </p>
            <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStatusConfirmTarget(null)}
                className="px-4 min-h-[40px] rounded-lg font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmToggleStatus}
                className={`px-4 min-h-[40px] rounded-lg font-semibold text-white shadow-xs cursor-pointer ${
                  statusConfirmTarget.status === 'active'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusConfirmTarget.status === 'active' ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm animate-in fade-in slide-in-from-bottom-2">
          <div
            role="status"
            className={`flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-xs font-medium shadow-lg border ${
              toast.tone === 'error'
                ? 'bg-rose-600 text-white border-rose-700'
                : toast.tone === 'info'
                  ? 'bg-slate-900 text-white border-slate-800'
                  : 'bg-emerald-600 text-white border-emerald-700'
            }`}
          >
            {toast.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{toast.msg}</span>
            <button type="button" onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}