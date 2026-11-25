'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import {
  LayoutDashboard,
  CalendarDays,
  FileEdit,
  Wallet,
  User as UserIcon,
  ClipboardCheck,
  Users,
  Menu,
  X,
  Clock,
  AlertTriangle,
  BarChart3,
  EyeOff,
  FileSearch,
  KeyRound,
  LogOut,
  Shield,
  ChevronRight,
  Receipt,
} from 'lucide-react';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { formatDate, formatTime } from '@/lib/utils-dtr';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function MobileBottomNav({ activeTab, setActiveTab }: MobileBottomNavProps) {
  const {
    currentUser,
    dtrEntries,
    corrections,
    reimbursements,
    pendingUsers,
    serverCurrentDate,
    serverCurrentTime,
    signOut,
  } = useApp();

  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Badge counts
  const myPendingCorrectionsCount = useMemo(
    () => corrections.filter((c) => c.user_id === currentUser.id && c.status === 'pending').length,
    [corrections, currentUser.id]
  );

  const pendingFilingsCount = useMemo(
    () => dtrEntries.filter((e) => e.status === 'submitted' || e.status === 'adjusted').length,
    [dtrEntries]
  );

  const extraHoursCount = useMemo(
    () => dtrEntries.filter((e) => e.status === 'extra_hours_pending').length,
    [dtrEntries]
  );

  const adminCorrectionsCount = useMemo(
    () => corrections.filter((c) => c.status === 'pending').length,
    [corrections]
  );

  const pendingReimbursementsCount = useMemo(
    () => reimbursements.filter((r) => r.status === 'pending').length,
    [reimbursements]
  );

  const pendingUsersCount = pendingUsers.length;

  const adminMoreBadgeCount = extraHoursCount + adminCorrectionsCount + pendingReimbursementsCount;
  const sysAdminMoreBadgeCount = pendingUsersCount + extraHoursCount + adminCorrectionsCount + pendingReimbursementsCount;

  const isAdminMoreActive = [
    'dashboard',
    'my_dtr',
    'corrections',
    'reimbursements',
    'payment_status',
    'profile',
    'admin_extra_hours',
    'admin_corrections',
    'admin_reimbursements',
    'admin_reports',
  ].includes(activeTab);

  const isSysAdminMoreActive = [
    'admin_users',
    'admin_audit',
    'admin_extra_hours',
    'admin_corrections',
    'admin_reimbursements',
    'admin_reports',
    'profile',
  ].includes(activeTab);

  const handleSelectTab = (tab: string) => {
    setActiveTab(tab);
    setShowMoreSheet(false);
  };

  return (
    <>
      {/* Fixed Bottom Navigation Bar for Mobile & Phablet Viewports (< 768px) */}
      <nav
        aria-label="Mobile Primary Navigation"
        className="md:hidden no-print fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe shadow-[0_-2px_12px_rgba(15,23,42,0.06)] transform-gpu will-change-transform [backface-visibility:hidden]"
        style={{ transform: 'translateZ(0)', WebkitBackfaceVisibility: 'hidden' }}
      >
        <div className="grid grid-cols-5 px-1">
          {currentUser.role === 'employee' && (
            <>
              <NavTabButton
                id="mobile-nav-emp-dashboard"
                label="Home"
                icon={<LayoutDashboard className="w-5 h-5" />}
                active={activeTab === 'dashboard'}
                onClick={() => handleSelectTab('dashboard')}
              />
              <NavTabButton
                id="mobile-nav-emp-dtr"
                label="My DTR"
                icon={<CalendarDays className="w-5 h-5" />}
                active={activeTab === 'my_dtr'}
                onClick={() => handleSelectTab('my_dtr')}
              />
              <NavTabButton
                id="mobile-nav-emp-corrections"
                label="Corrections"
                icon={<FileEdit className="w-5 h-5" />}
                active={activeTab === 'corrections'}
                badge={myPendingCorrectionsCount}
                onClick={() => handleSelectTab('corrections')}
              />
              <NavTabButton
                id="mobile-nav-emp-payments"
                label="Payments"
                icon={<Wallet className="w-5 h-5" />}
                active={activeTab === 'payment_status'}
                onClick={() => handleSelectTab('payment_status')}
              />
              <NavTabButton
                id="mobile-nav-emp-profile"
                label="Profile"
                icon={<UserIcon className="w-5 h-5" />}
                active={activeTab === 'profile'}
                onClick={() => handleSelectTab('profile')}
              />
            </>
          )}

          {currentUser.role === 'admin' && (
            <>
              <NavTabButton
                id="mobile-nav-admin-dashboard"
                label="Overview"
                icon={<LayoutDashboard className="w-5 h-5" />}
                active={activeTab === 'admin_dashboard'}
                onClick={() => handleSelectTab('admin_dashboard')}
              />
              <NavTabButton
                id="mobile-nav-admin-filings"
                label="Filings"
                icon={<ClipboardCheck className="w-5 h-5" />}
                active={activeTab === 'admin_filings'}
                badge={pendingFilingsCount}
                onClick={() => handleSelectTab('admin_filings')}
              />
              <NavTabButton
                id="mobile-nav-admin-payments"
                label="Payroll"
                icon={<Wallet className="w-5 h-5" />}
                active={activeTab === 'admin_payments'}
                onClick={() => handleSelectTab('admin_payments')}
              />
              <NavTabButton
                id="mobile-nav-admin-users"
                label="Employees"
                icon={<Users className="w-5 h-5" />}
                active={activeTab === 'admin_users'}
                badge={pendingUsersCount}
                onClick={() => handleSelectTab('admin_users')}
              />
              <NavTabButton
                id="mobile-nav-admin-more"
                label="More"
                icon={<Menu className="w-5 h-5" />}
                active={showMoreSheet || isAdminMoreActive}
                badge={adminMoreBadgeCount}
                onClick={() => setShowMoreSheet((prev) => !prev)}
              />
            </>
          )}

          {currentUser.role === 'system_admin' && (
            <>
              <NavTabButton
                id="mobile-nav-sys-dashboard"
                label="Overview"
                icon={<LayoutDashboard className="w-5 h-5" />}
                active={activeTab === 'admin_dashboard'}
                onClick={() => handleSelectTab('admin_dashboard')}
              />
              <NavTabButton
                id="mobile-nav-sys-filings"
                label="DTR Review"
                icon={<ClipboardCheck className="w-5 h-5" />}
                active={activeTab === 'admin_filings'}
                badge={pendingFilingsCount}
                onClick={() => handleSelectTab('admin_filings')}
              />
              <NavTabButton
                id="mobile-nav-sys-panel"
                label="SysAdmin"
                icon={<EyeOff className="w-5 h-5" />}
                active={activeTab === 'sysadmin'}
                accentPurple
                onClick={() => handleSelectTab('sysadmin')}
              />
              <NavTabButton
                id="mobile-nav-sys-payments"
                label="Payroll"
                icon={<Wallet className="w-5 h-5" />}
                active={activeTab === 'admin_payments'}
                onClick={() => handleSelectTab('admin_payments')}
              />
              <NavTabButton
                id="mobile-nav-sys-more"
                label="More"
                icon={<Menu className="w-5 h-5" />}
                active={showMoreSheet || isSysAdminMoreActive}
                badge={sysAdminMoreBadgeCount}
                onClick={() => setShowMoreSheet((prev) => !prev)}
              />
            </>
          )}
        </div>
      </nav>

      {/* Mobile Slide-Up "More" Navigation Drawer */}
      {showMoreSheet && (
        <div className="md:hidden no-print fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          {/* Backdrop click area */}
          <div
            className="flex-1"
            onClick={() => setShowMoreSheet(false)}
            aria-hidden="true"
          />

          <div className="bg-white rounded-t-2xl border-t border-slate-200 shadow-2xl max-h-[85dvh] flex flex-col pb-safe animate-in slide-in-from-bottom duration-200">
            {/* Sheet Handle & Header */}
            <div className="px-4 pt-3 pb-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  {currentUser.first_name?.[0] || 'U'}
                  {currentUser.last_name?.[0] || ''}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm truncate">
                    {currentUser.first_name} {currentUser.last_name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">
                    {currentUser.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreSheet(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Server Clock Strip */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Server Clock</span>
              </span>
              <span className="font-mono font-semibold text-slate-900">
                {formatTime(serverCurrentTime)} • {formatDate(serverCurrentDate)}
              </span>
            </div>

            {/* Scrollable Navigation Links */}
            <div className="overflow-y-auto p-3 space-y-4">
              {currentUser.role === 'admin' && currentUser.clocks_in && (
                <div>
                  <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    My Personal Timekeeping
                  </div>
                  <div className="space-y-1">
                    <DrawerItem
                      id="mobile-sheet-my-time"
                      icon={<Clock className="w-4 h-4 text-emerald-600" />}
                      label="My Time & File DTR"
                      sublabel="Punch clock & manual shift entry"
                      active={activeTab === 'dashboard'}
                      onClick={() => handleSelectTab('dashboard')}
                    />
                    <DrawerItem
                      id="mobile-sheet-my-dtr"
                      icon={<CalendarDays className="w-4 h-4 text-emerald-600" />}
                      label="My DTR Records"
                      sublabel="Personal shifts & monthly self-approval"
                      active={activeTab === 'my_dtr'}
                      onClick={() => handleSelectTab('my_dtr')}
                    />
                    <DrawerItem
                      id="mobile-sheet-my-reimbursements"
                      icon={<Receipt className="w-4 h-4 text-purple-600" />}
                      label="My Reimbursements"
                      sublabel="File and track expense claims"
                      active={activeTab === 'reimbursements'}
                      onClick={() => handleSelectTab('reimbursements')}
                    />
                    <DrawerItem
                      id="mobile-sheet-my-payments"
                      icon={<Wallet className="w-4 h-4 text-emerald-600" />}
                      label="My Payment & Earnings"
                      active={activeTab === 'payment_status'}
                      onClick={() => handleSelectTab('payment_status')}
                    />
                    <DrawerItem
                      id="mobile-sheet-my-profile"
                      icon={<UserIcon className="w-4 h-4 text-emerald-600" />}
                      label="My Profile"
                      active={activeTab === 'profile'}
                      onClick={() => handleSelectTab('profile')}
                    />
                  </div>
                </div>
              )}

              {currentUser.role === 'admin' && !currentUser.clocks_in && (
                <div>
                  <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Personal Settings
                  </div>
                  <div className="space-y-1">
                    <DrawerItem
                      id="mobile-sheet-admin-profile"
                      icon={<UserIcon className="w-4 h-4 text-blue-600" />}
                      label="My Profile"
                      sublabel="Edit contact details & payout account"
                      active={activeTab === 'profile'}
                      onClick={() => handleSelectTab('profile')}
                    />
                  </div>
                </div>
              )}

              {currentUser.role === 'admin' && (
                <div>
                  <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Administration Queues & Reports
                  </div>
                  <div className="space-y-1">
                    <DrawerItem
                      id="mobile-sheet-extra-hours"
                      icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                      label="Extra Hours Queue"
                      sublabel="Review shifts exceeding daily/weekly caps"
                      active={activeTab === 'admin_extra_hours'}
                      badge={extraHoursCount}
                      onClick={() => handleSelectTab('admin_extra_hours')}
                    />
                    <DrawerItem
                      id="mobile-sheet-corrections"
                      icon={<FileEdit className="w-4 h-4 text-blue-600" />}
                      label="Corrections Queue"
                      sublabel="Approve or reject employee time adjustments"
                      active={activeTab === 'admin_corrections'}
                      badge={adminCorrectionsCount}
                      onClick={() => handleSelectTab('admin_corrections')}
                    />
                    <DrawerItem
                      id="mobile-sheet-reimbursements"
                      icon={<Receipt className="w-4 h-4 text-purple-600" />}
                      label="Reimbursements Queue"
                      sublabel="Approve expense claims into employee payroll"
                      active={activeTab === 'admin_reimbursements'}
                      badge={pendingReimbursementsCount}
                      onClick={() => handleSelectTab('admin_reimbursements')}
                    />
                    {/* <DrawerItem
                      id="mobile-sheet-reports"
                      icon={<BarChart3 className="w-4 h-4 text-indigo-600" />}
                      label="Reports & Exports"
                      sublabel="Monthly payroll, hours, & CSV exports"
                      active={activeTab === 'admin_reports'}
                      onClick={() => handleSelectTab('admin_reports')}
                    /> */}
                  </div>
                </div>
              )}

              {currentUser.role === 'system_admin' && (
                <div>
                  <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    System & Governance Modules
                  </div>
                  <div className="space-y-1">
                    <DrawerItem
                      id="mobile-sheet-sys-users"
                      icon={<Users className="w-4 h-4 text-blue-600" />}
                      label="All Users & Admins"
                      sublabel="Employee directory, wages, & pending approvals"
                      active={activeTab === 'admin_users'}
                      badge={pendingUsersCount}
                      onClick={() => handleSelectTab('admin_users')}
                    />
                    <DrawerItem
                      id="mobile-sheet-sys-audit"
                      icon={<FileSearch className="w-4 h-4 text-purple-600" />}
                      label="Full Audit Trail"
                      sublabel="Immutable system & administrative logs"
                      active={activeTab === 'admin_audit'}
                      onClick={() => handleSelectTab('admin_audit')}
                    />
                    <DrawerItem
                      id="mobile-sheet-sys-extra-hours"
                      icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                      label="Extra Hours Queue"
                      active={activeTab === 'admin_extra_hours'}
                      badge={extraHoursCount}
                      onClick={() => handleSelectTab('admin_extra_hours')}
                    />
                    <DrawerItem
                      id="mobile-sheet-sys-corrections"
                      icon={<FileEdit className="w-4 h-4 text-blue-600" />}
                      label="Corrections Queue"
                      active={activeTab === 'admin_corrections'}
                      badge={adminCorrectionsCount}
                      onClick={() => handleSelectTab('admin_corrections')}
                    />
                    <DrawerItem
                      id="mobile-sheet-sys-reimbursements"
                      icon={<Receipt className="w-4 h-4 text-purple-600" />}
                      label="Reimbursements Queue"
                      active={activeTab === 'admin_reimbursements'}
                      badge={pendingReimbursementsCount}
                      onClick={() => handleSelectTab('admin_reimbursements')}
                    />
                    {/* <DrawerItem
                      id="mobile-sheet-sys-reports"
                      icon={<BarChart3 className="w-4 h-4 text-indigo-600" />}
                      label="Reports & Exports"
                      active={activeTab === 'admin_reports'}
                      onClick={() => handleSelectTab('admin_reports')}
                    /> */}
                  </div>
                </div>
              )}

              {/* Account Actions */}
              <div className="pt-2 border-t border-slate-100">
                <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Account
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectTab('profile')}
                    className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer min-h-[42px]"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span>My Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreSheet(false);
                      setShowChangePasswordModal(true);
                    }}
                    className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer min-h-[42px]"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>Password</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreSheet(false);
                      signOut();
                    }}
                    className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 transition-colors cursor-pointer min-h-[42px]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        userEmail={currentUser.email}
      />
    </>
  );
}

function NavTabButton({
  id,
  label,
  icon,
  active,
  badge,
  accentPurple,
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
  accentPurple?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1 py-2 px-1 min-h-[56px] transition-colors cursor-pointer select-none ${
        active
          ? accentPurple
            ? 'text-purple-700 font-bold'
            : 'text-slate-900 font-bold'
          : 'text-slate-500 hover:text-slate-800 font-medium'
      }`}
    >
      {active && (
        <span
          className={`absolute top-0 inset-x-3 h-0.5 rounded-b-full ${
            accentPurple ? 'bg-purple-700' : 'bg-slate-900'
          }`}
        />
      )}
      <div className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center shadow-2xs">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[10px] leading-none tracking-tight truncate max-w-full">
        {label}
      </span>
    </button>
  );
}

function DrawerItem({
  id,
  icon,
  label,
  sublabel,
  active,
  badge,
  onClick,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer min-h-[46px] ${
        active
          ? 'bg-slate-900 text-white shadow-xs'
          : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-100'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            active ? 'bg-white/15 text-white [&>*]:text-white' : 'bg-slate-100'
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate">{label}</div>
          {sublabel && (
            <div
              className={`text-[11px] truncate ${
                active ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {sublabel}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {badge !== undefined && badge > 0 && (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              active ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800'
            }`}
          >
            {badge}
          </span>
        )}
        <ChevronRight
          className={`w-4 h-4 ${active ? 'text-slate-300' : 'text-slate-400'}`}
        />
      </div>
    </button>
  );
}
