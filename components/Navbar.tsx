'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/lib/context';
import {
  Clock,
  Shield,
  User as UserIcon,
  Sliders,
  ChevronDown,
  EyeOff,
  Briefcase,
  AlertCircle,
  Calendar,
  LogOut,
  UserCheck,
  Sparkles,
  KeyRound,
  Play,
  Square,
  CheckCircle2,
  Bell,
  CheckCheck,
  Lock,
  Wallet,
  Receipt,
} from 'lucide-react';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { NavPunchOutModal } from '@/components/NavPunchOutModal';
import { StillWorkingReminder } from '@/components/StillWorkingReminder';
import { requestNotificationPermission } from '@/lib/browser-notifications';
import { computeSecondsWorked, formatElapsedDuration, formatDate, formatTime, formatMonthYear } from '@/lib/utils-dtr';

export function Navbar({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  const {
    currentUser,
    currentOpenSession,
    serverCurrentTime,
    serverCurrentDate,
    serverCurrentSeconds,
    isSimulated,
    settings,
    timeIn,
    timeOut,
    cancelClockIn,
    setSimulatedClock,
    resetToRealClock,
    supabaseUser,
    signOut,
    pendingUsers,
    monthlySelfApprovals,
    notifications,
    reimbursements,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useApp();

  const pendingReimbursementsCount = useMemo(() => {
    return reimbursements.filter((r) => r.status === 'pending').length;
  }, [reimbursements]);

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showClockModal, setShowClockModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showPunchOutModal, setShowPunchOutModal] = useState(false);
  const [isPunchSubmitting, setIsPunchSubmitting] = useState(false);
  const [navFeedback, setNavFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tempDate, setTempDate] = useState(serverCurrentDate);
  const [tempTime, setTempTime] = useState(serverCurrentTime);

  // Local 1-second ticker ONLY when a session is active, keeping Navbar shift duration up to date without re-rendering the whole tree
  const [navTicker, setNavTicker] = useState(0);
  useEffect(() => {
    if (!currentOpenSession) return;
    const interval = setInterval(() => setNavTicker((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [currentOpenSession]);

  // Live elapsed duration in seconds for open session
  const liveNavElapsedSeconds = useMemo(() => {
    if (!currentOpenSession) return 0;
    return computeSecondsWorked(
      currentOpenSession.time_in,
      currentOpenSession.work_date,
      serverCurrentTime,
      serverCurrentDate,
      isSimulated ? serverCurrentSeconds : new Date().getSeconds(),
      isSimulated ? undefined : currentOpenSession.created_at
    );
  }, [currentOpenSession, serverCurrentTime, serverCurrentDate, serverCurrentSeconds, navTicker, isSimulated]);

  const canClock = currentUser.clocks_in || currentUser.role === 'employee';

  const currentMonthStr = useMemo(() => {
    return (serverCurrentDate || '').slice(0, 7);
  }, [serverCurrentDate]);

  const isCurrentMonthFinalized = useMemo(() => {
    return monthlySelfApprovals.some(
      (a) => a.user_id === currentUser.id && a.month === currentMonthStr
    );
  }, [monthlySelfApprovals, currentUser.id, currentMonthStr]);

  const handleNavPunchIn = () => {
    if (isCurrentMonthFinalized) {
      setNavFeedback({
        type: 'error',
        text: `Cannot clock in: DTR records for ${formatMonthYear(currentMonthStr)} have already been finalized and certified.`,
      });
      return;
    }
    // Ask for desktop-alert permission during the click, so hourly "still working?" reminders can reach them
    void requestNotificationPermission();
    setIsPunchSubmitting(true);
    setNavFeedback(null);
    const res = timeIn();
    setIsPunchSubmitting(false);

    if (res.success) {
      setNavFeedback({ type: 'success', text: res.message });
      setTimeout(() => {
        setNavFeedback((curr) => (curr?.text === res.message ? null : curr));
      }, 5000);
    } else {
      setNavFeedback({ type: 'error', text: res.message });
    }
  };

  const handleConfirmPunchOut = (remarks: string) => {
    const res = timeOut(remarks);
    if (res.success) {
      setNavFeedback({ type: 'success', text: res.message });
      setTimeout(() => {
        setNavFeedback((curr) => (curr?.text === res.message ? null : curr));
      }, 5000);
      return { success: true };
    }
    return { success: false, message: res.message };
  };

  const handleCancelAccidentalPunch = (reason?: string) => {
    const res = cancelClockIn(reason || 'Accidental clock-in discarded by user');
    if (res.success) {
      setNavFeedback({ type: 'success', text: res.message });
      setTimeout(() => {
        setNavFeedback((curr) => (curr?.text === res.message ? null : curr));
      }, 5000);
      return { success: true };
    }
    return { success: false, message: res.message };
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'system_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <EyeOff className="w-3 h-3" /> System Admin (Hidden)
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Shield className="w-3 h-3" /> Administrator
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <UserIcon className="w-3 h-3" /> Employee
          </span>
        );
    }
  };

  return (
    <>
      <header
        className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs pt-safe transform-gpu will-change-transform [backface-visibility:hidden]"
        style={{ transform: 'translateZ(0)', WebkitBackfaceVisibility: 'hidden' }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
            {/* Logo and Brand */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center overflow-hidden shrink-0 p-0.5">
                <img
                  src="/wmedlaw_logo.jpeg"
                  alt="WMedlaw Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-lg truncate">
                    <span className="sm:hidden">WMedlaw DTR</span>
                    <span className="hidden sm:inline">WMedlaw Daily Time Record</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block truncate">
                  Hourly Timekeeping & Payment Status
                </p>
              </div>
            </div>

            {/* Server Clock & Simulation Controller */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Employee Top Navigation Punch In / Punch Out Action */}
              {canClock && (
                currentOpenSession ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Live active shift indicator chip */}
                    <button
                      type="button"
                      id="navbar-live-punch-chip"
                      onClick={() => setActiveTab('dashboard')}
                      className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
                      title="Active shift in progress (Click to view punch station on dashboard)"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
                      <span>Clocked In: <strong className="font-mono">{currentOpenSession.time_in}</strong></span>
                      <span className="font-mono text-[11px] text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded font-normal">
                        {formatElapsedDuration(liveNavElapsedSeconds)}
                      </span>
                    </button>

                    {/* Punch Out Action Button */}
                    <button
                      type="button"
                      id="btn-nav-punch-out"
                      onClick={() => setShowPunchOutModal(true)}
                      className="min-h-9 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-xs hover:shadow-sm transition-all cursor-pointer shrink-0"
                      title="Punch out of active shift"
                    >
                      <Square className="w-3.5 h-3.5 fill-white text-white shrink-0" />
                      <span>Punch Out</span>
                    </button>
                  </div>
                ) : isCurrentMonthFinalized ? (
                  /* Punch In Disabled: Month Finalized */
                  <div
                    id="nav-punch-in-locked"
                    className="min-h-9 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-300 shadow-2xs cursor-not-allowed shrink-0"
                    title={`Punch in locked: ${formatMonthYear(currentMonthStr)} DTR records have already been finalized and certified.`}
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="hidden xs:inline">Month Finalized</span>
                    <span className="xs:hidden">Locked</span>
                  </div>
                ) : (
                  /* Punch In Action Button */
                  <button
                    type="button"
                    id="btn-nav-punch-in"
                    onClick={handleNavPunchIn}
                    disabled={isPunchSubmitting}
                    className="min-h-9 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white shadow-xs hover:shadow-sm transition-all cursor-pointer shrink-0"
                    title={`Punch in shift at current server time (${formatTime(serverCurrentTime)})`}
                  >
                    <Play className="w-3.5 h-3.5 fill-white text-white shrink-0" />
                    <span>Punch In</span>
                    <span className="hidden sm:inline font-mono font-normal text-[11px] text-emerald-100 border-l border-emerald-500/80 pl-1.5">
                      {formatTime(serverCurrentTime)}
                    </span>
                  </button>
                )
              )}

              <button
                id="server-clock-button"
                onClick={() => {
                  setTempDate(serverCurrentDate);
                  setTempTime(serverCurrentTime);
                  setShowClockModal(false);
                }}
                className="hidden xs:inline-flex min-h-9 items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-md text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors shrink-0"
                title="Server Clock (Click to test or adjust simulated time)"
              >
                <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="hidden lg:inline text-slate-500">Local Time:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatTime(serverCurrentTime)}
                  <span className="hidden md:inline"> &nbsp;{formatDate(serverCurrentDate)}</span>
                </span>
                <Sliders className="hidden md:inline w-3 h-3 text-slate-400" />
              </button>

              {/* Admin Notification Bell */}
              {(currentUser.role === 'admin' || currentUser.role === 'system_admin') && (
                <div className="relative">
                  <button
                    id="admin-notifications-btn"
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      setShowRoleMenu(false);
                    }}
                    className="relative min-w-9 min-h-9 p-2 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                    title="Employee DTR Notifications"
                  >
                    <Bell className="w-4 h-4 text-slate-600" />
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
                        {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowNotifications(false)}
                        aria-hidden="true"
                      />
                      <div
                        id="admin-notifications-popover"
                        className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 max-h-[calc(100dvh-5.5rem)] flex flex-col bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <Bell className="w-4 h-4 text-blue-600" />
                            <h4 className="font-bold text-slate-900 text-xs">
                              Activity Notifications
                            </h4>
                            {unreadNotificationsCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                {unreadNotificationsCount} new
                              </span>
                            )}
                          </div>
                          {notifications.length > 0 && (
                            <button
                              onClick={markAllNotificationsAsRead}
                              className="text-[11px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                              title="Mark all as read"
                            >
                              <CheckCheck className="w-3 h-3" />
                              <span>Mark all read</span>
                            </button>
                          )}
                        </div>

                        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                          {notifications.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 space-y-1">
                              <CheckCircle2 className="w-6 h-6 text-slate-300 mx-auto" />
                              <p className="text-xs font-medium text-slate-600">No new notifications</p>
                              <p className="text-[11px] text-slate-400">
                                You will be alerted when employees submit monthly self-approvals or time corrections.
                              </p>
                            </div>
                          ) : (
                            notifications.slice(0, 15).map((n) => (
                              <div
                                key={n.id}
                                onClick={() => {
                                  markNotificationAsRead(n.id);
                                  setShowNotifications(false);
                                  if (n.link_tab) {
                                    setActiveTab(n.link_tab);
                                  }
                                }}
                                className={`p-2.5 rounded-lg transition-colors cursor-pointer flex gap-3 ${
                                  !n.is_read ? 'bg-blue-50/60 hover:bg-blue-50 font-medium' : 'hover:bg-slate-50 opacity-80'
                                }`}
                              >
                                <div className="mt-0.5 shrink-0">
                                  {n.type === 'monthly_self_approval' ? (
                                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                      <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                  ) : n.type === 'payment_disbursed' ? (
                                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                      <Wallet className="w-4 h-4" />
                                    </div>
                                  ) : n.type === 'reimbursement_request' || n.type === 'reimbursement_adjudicated' ? (
                                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                                      <Receipt className="w-4 h-4" />
                                    </div>
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                                      <Bell className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <p className="text-xs font-semibold text-slate-900 truncate">
                                      {n.title}
                                    </p>
                                    <span className="text-[10px] text-slate-400 shrink-0">
                                      {formatTime(n.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                                    {n.message}
                                  </p>
                                  {n.link_tab === 'payments' ? (
                                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold">
                                      <span>View Payslip &amp; Disbursements →</span>
                                    </div>
                                  ) : n.month ? (
                                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-blue-700 font-semibold">
                                      <span>View in Monthly Payroll Report →</span>
                                    </div>
                                  ) : null}
                                </div>
                                {!n.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 self-center"></span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Reset Demo Button */}
              {/* User Menu */}
              <div className="relative">
                <button
                  id="role-switcher-dropdown"
                  onClick={() => {
                    setShowRoleMenu(!showRoleMenu);
                    setShowNotifications(false);
                  }}
                  className="min-h-9 inline-flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium transition-all shadow-xs cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-300 shrink-0">
                    {currentUser.first_name?.[0] || 'U'}
                    {currentUser.last_name?.[0] || ''}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="font-semibold text-slate-900 leading-tight">
                      {currentUser.first_name} {currentUser.last_name}
                    </div>
                    <div className="text-[10px] text-slate-500 capitalize">
                      {currentUser.role.replace('_', ' ')}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                {showRoleMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowRoleMenu(false)}
                      aria-hidden="true"
                    />
                    <div
                      id="role-switcher-menu"
                      className="fixed right-3 top-16 w-[min(17rem,calc(100vw-1.5rem))] sm:absolute sm:right-0 sm:top-auto sm:mt-2 sm:w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    >
                      {/* User Identity Header */}
                      <div className="px-2.5 py-2 border-b border-slate-100 mb-1.5 bg-slate-50 rounded-lg">
                        <div className="font-bold text-slate-900 text-xs truncate">
                          {currentUser.first_name} {currentUser.last_name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {currentUser.email}
                        </div>
                        <div className="mt-1.5 md:hidden flex items-center justify-between text-[11px] text-slate-600 pt-1.5 border-t border-slate-200/70">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>Server:</span>
                          </span>
                          <span className="font-mono font-semibold text-slate-800">
                            {formatTime(serverCurrentTime)} • {formatDate(serverCurrentDate)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {/* {getRoleBadge(currentUser.role)} */}
                          {/* {supabaseUser && (
                            <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              Supabase Auth
                            </span>
                          )} */}
                        </div>
                      </div>

                      {/* Pending Approvals Shortcut for Admins */}
                      {(currentUser.role === 'admin' || currentUser.role === 'system_admin') && pendingUsers.length > 0 && (
                        <button
                          onClick={() => {
                            setActiveTab('admin_users');
                            setShowRoleMenu(false);
                          }}
                          className="w-full min-h-9 flex items-center justify-between px-2.5 py-2 mb-1.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending Approvals</span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-200 text-amber-900 font-bold">
                            {pendingUsers.length}
                          </span>
                        </button>
                      )}

                      {/* My Profile Action */}
                      <button
                        id="btn-nav-my-profile"
                        onClick={() => {
                          setActiveTab('profile');
                          setShowRoleMenu(false);
                        }}
                        className="w-full min-h-9 flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer mb-1"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>My Profile</span>
                      </button>

                      {/* Change Password Action */}
                      <button
                        id="btn-nav-change-password"
                        onClick={() => {
                          setShowChangePasswordModal(true);
                          setShowRoleMenu(false);
                        }}
                        className="w-full min-h-9 flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer mb-1"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                        <span>Change Password</span>
                      </button>

                      {/* Sign Out Action */}
                      <button
                        id="btn-nav-sign-out"
                        onClick={() => {
                          signOut();
                          setShowRoleMenu(false);
                        }}
                        className="w-full min-h-9 flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Desktop & Tablet Navigation Tabs based on Role (>= 768px; mobile uses MobileBottomNav) */}
          <div className="hidden md:flex overflow-x-auto space-x-1 border-t border-slate-100 py-2 scrollbar-none text-xs">
            {currentUser.role === 'employee' && (
              <>
                <button
                  id="nav-emp-dashboard"
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'dashboard'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  id="nav-emp-dtr"
                  onClick={() => setActiveTab('my_dtr')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'my_dtr'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  My DTR Records
                </button>
                <button
                  id="nav-emp-corrections"
                  onClick={() => setActiveTab('corrections')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'corrections'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Correction Requests
                </button>
                <button
                  id="nav-emp-reimbursements"
                  onClick={() => setActiveTab('reimbursements')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'reimbursements'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Reimbursements
                </button>
                <button
                  id="nav-emp-payments"
                  onClick={() => setActiveTab('payment_status')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'payment_status'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Payment & Earnings
                </button>
                <button
                  id="nav-emp-profile"
                  onClick={() => setActiveTab('profile')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  My Profile
                </button>
              </>
            )}

            {currentUser.role === 'admin' && (
              <>
                {currentUser.clocks_in && (
                  <button
                    id="nav-admin-my-time"
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                      activeTab === 'dashboard' || activeTab === 'my_dtr'
                        ? 'bg-emerald-700 text-white'
                        : 'text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                    }`}
                  >
                    My Time & File DTR
                  </button>
                )}
                <button
                  id="nav-admin-dashboard"
                  onClick={() => setActiveTab('admin_dashboard')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_dashboard'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Admin Overview
                </button>
                <button
                  id="nav-admin-filings"
                  onClick={() => setActiveTab('admin_filings')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_filings'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  DTR Filings & Approvals
                </button>
                <button
                  id="nav-admin-extra-hours"
                  onClick={() => setActiveTab('admin_extra_hours')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_extra_hours'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Extra Hours Queue
                </button>
                <button
                  id="nav-admin-corrections"
                  onClick={() => setActiveTab('admin_corrections')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_corrections'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Corrections Queue
                </button>
                <button
                  id="nav-admin-reimbursements"
                  onClick={() => setActiveTab('admin_reimbursements')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    activeTab === 'admin_reimbursements'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>Reimbursements</span>
                  {pendingReimbursementsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                      {pendingReimbursementsCount}
                    </span>
                  )}
                </button>
                
                <button
                  id="nav-admin-payments"
                  onClick={() => setActiveTab('admin_payments')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_payments'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Pay Periods & Payroll
                </button>
                <button
                  id="nav-admin-reports"
                  onClick={() => setActiveTab('admin_reports')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_reports'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Reports & Exports
                </button>
                <button
                  id="nav-admin-users"
                  onClick={() => setActiveTab('admin_users')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_users'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Employees & Wages
                </button>
                <button
                  id="nav-admin-profile"
                  onClick={() => setActiveTab('profile')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  My Profile
                </button>
                
              </>
            )}

            {currentUser.role === 'system_admin' && (
              <>
                <button
                  id="nav-sys-admin-dashboard"
                  onClick={() => setActiveTab('admin_dashboard')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_dashboard'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Admin View
                </button>
                <button
                  id="nav-sys-filings"
                  onClick={() => setActiveTab('admin_filings')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_filings'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  DTR Review
                </button>
                <button
                  id="nav-sys-reimbursements"
                  onClick={() => setActiveTab('admin_reimbursements')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    activeTab === 'admin_reimbursements'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>Reimbursements</span>
                  {pendingReimbursementsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                      {pendingReimbursementsCount}
                    </span>
                  )}
                </button>
                <button
                  id="nav-sys-panel"
                  onClick={() => setActiveTab('sysadmin')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'sysadmin'
                      ? 'bg-purple-900 text-white font-semibold'
                      : 'text-purple-700 hover:bg-purple-50 border border-purple-200'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <EyeOff className="w-3.5 h-3.5" /> System Admin Control Panel
                  </span>
                </button>
                <button
                  id="nav-sys-users"
                  onClick={() => setActiveTab('admin_users')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_users'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  All Users & Admins
                </button>
                <button
                  id="nav-sys-payments"
                  onClick={() => setActiveTab('admin_payments')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_payments'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Pay Periods
                </button>
                <button
                  id="nav-sys-audit"
                  onClick={() => setActiveTab('admin_audit')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'admin_audit'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Full Audit Trail
                </button>
                <button
                  id="nav-sys-profile"
                  onClick={() => setActiveTab('profile')}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  My Profile
                </button>
                
              </>
            )}
          </div>
        </div>
      </header>

      {/* Navbar Action Feedback Notification Toast */}
      {navFeedback && (
        <div className="no-print bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2">
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150 ${
                navFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {navFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-medium break-words">{navFeedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setNavFeedback(null)}
                className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer p-1 shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulated Server Clock Modal */}
      {showClockModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900 text-base">
                  Server Clock Simulation
                </h3>
              </div>
              <button
                onClick={() => setShowClockModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Per specification, the system enforces tamper-resistant timekeeping using the
              <strong> server clock only</strong>, ignoring employee device clocks. You can set
              a simulated server date/time below to test work dates, overnight sessions, and decimal
              hour calculations.
            </p>

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Server Work Date
                </label>
                <input
                  id="simulated-date-input"
                  type="date"
                  value={tempDate}
                  onChange={(e) => setTempDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Server Time (HH:mm)
                </label>
                <input
                  id="simulated-time-input"
                  type="time"
                  value={tempTime}
                  onChange={(e) => setTempTime(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-600 outline-none font-mono"
                />
              </div>
            </div>

            {/* Quick Test Presets */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Quick Simulation Presets
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTempDate('2026-09-12');
                    setTempTime('09:35');
                  }}
                  className="px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]"
                >
                  Sept. 12, 09:35 AM (Session 1 End)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTempDate('2026-09-15');
                    setTempTime('21:45');
                  }}
                  className="px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]"
                >
                  Sept. 15, 09:45 PM (Clock Out Maria)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTempDate('2026-09-16');
                    setTempTime('10:00');
                  }}
                  className="px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]"
                >
                  Sept. 16, 2026 (Pay Date)
                </button>
              </div>
            </div>

            <div className="flex flex-col-reverse xs:flex-row xs:items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  resetToRealClock();
                  setShowClockModal(false);
                }}
                className="text-xs text-slate-600 hover:text-slate-900 underline self-center xs:self-auto"
              >
                Use Real-time Clock
              </button>
              <div className="flex gap-2 w-full xs:w-auto">
                <button
                  type="button"
                  onClick={() => setShowClockModal(false)}
                  className="flex-1 xs:flex-none px-3 py-2 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedClock(tempDate, tempTime);
                    setShowClockModal(false);
                  }}
                  className="flex-1 xs:flex-none px-3 py-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium shadow-xs"
                >
                  Apply Server Time
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        userEmail={currentUser.email}
      />

      {/* Hourly "Are you still working?" check-in while punched in */}
      <StillWorkingReminder onPunchOut={() => setShowPunchOutModal(true)} />

      {/* Nav Punch Out Modal */}
      <NavPunchOutModal
        isOpen={showPunchOutModal}
        onClose={() => setShowPunchOutModal(false)}
        currentOpenSession={currentOpenSession}
        serverCurrentTime={serverCurrentTime}
        serverCurrentDate={serverCurrentDate}
        serverCurrentSeconds={serverCurrentSeconds}
        isSimulated={isSimulated}
        minRemarksLength={settings.remarks_min_length || 10}
        onConfirmPunchOut={handleConfirmPunchOut}
        onCancelAccidentalPunch={handleCancelAccidentalPunch}
      />
    </>
  );
}
