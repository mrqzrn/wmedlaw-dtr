'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { EmployeeDashboard } from '@/components/employee/EmployeeDashboard';
import { EmployeeDtrList } from '@/components/employee/EmployeeDtrList';
import { EmployeeCorrections } from '@/components/employee/EmployeeCorrections';
import { EmployeeReimbursements } from '@/components/employee/EmployeeReimbursements';
import { EmployeePayments } from '@/components/employee/EmployeePayments';
import { EmployeeProfile } from '@/components/employee/EmployeeProfile';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminDtrFilings } from '@/components/admin/AdminDtrFilings';
import { AdminExtraHours } from '@/components/admin/AdminExtraHours';
import { AdminCorrections } from '@/components/admin/AdminCorrections';
import { AdminReimbursements } from '@/components/admin/AdminReimbursements';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminPayments } from '@/components/admin/AdminPayments';
import { AdminReports } from '@/components/admin/AdminReports';
import { AdminAuditLog } from '@/components/admin/AdminAuditLog';
import { SysAdminPanel } from '@/components/sysadmin/SysAdminPanel';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { PendingApprovalScreen } from '@/components/auth/PendingApprovalScreen';
import { AccountLockedScreen } from '@/components/auth/AccountLockedScreen';

export function TimekeepingApp() {
  const { currentUser, supabaseUser, isAuthLoading, isPasswordRecovery } = useApp();

  // Active navigation tab (honors ?tab= URL parameter from email links)
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const paramTab = new URLSearchParams(window.location.search).get('tab');
      if (paramTab) return paramTab;
    }
    return 'dashboard';
  });

  // Loading state
  if (isAuthLoading && (!supabaseUser || !currentUser || !currentUser.id)) {
    return (
      <div className="min-h-screen min-h-[100svh] bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-400 text-xs">
          <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin"></div>
          <span>Connecting to Supabase...</span>
        </div>
      </div>
    );
  }

  // Password Recovery Mode Gate
  if (isPasswordRecovery) {
    return <AuthScreen initialMode="recovery" />;
  }

  // Persist Login Page ONLY if no authenticated session exists
  if (!supabaseUser) {
    return <AuthScreen />;
  }

  // If session exists but profile is still resolving
  if (!currentUser || !currentUser.id) {
    return (
      <div className="min-h-screen min-h-[100svh] bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-400 text-xs">
          <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin"></div>
          <span>Loading session...</span>
        </div>
      </div>
    );
  }

  // Account Pending Approval Gate
  if (currentUser.status === 'pending_approval') {
    return <PendingApprovalScreen />;
  }

  // Account Inactive or Locked Gate
  if (currentUser.status === 'inactive' || currentUser.status === 'locked') {
    return <AccountLockedScreen />;
  }

  // Compute effective tab for current user role
  const effectiveTab = (() => {
    const normalizedTab = activeTab === 'admin_periods' ? 'admin_payments' : activeTab;

    if (currentUser.role === 'employee') {
      if (!['dashboard', 'my_dtr', 'corrections', 'reimbursements', 'payment_status', 'profile'].includes(normalizedTab)) {
        return 'dashboard';
      }
    } else if (currentUser.role === 'admin' && !currentUser.clocks_in) {
      if (['dashboard', 'my_dtr', 'corrections', 'reimbursements', 'payment_status'].includes(normalizedTab)) {
        return 'admin_dashboard';
      }
    }
    return normalizedTab;
  })();

  return (
    <div className="min-h-screen min-h-[100svh] bg-slate-50/60 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Sticky Top Navigation & Role Bar */}
      <Navbar activeTab={effectiveTab} setActiveTab={setActiveTab} />

      {/* Main App Content Viewport */}
      <main className="flex-1 w-full max-w-7xl min-w-0 mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Employee Views */}
        {effectiveTab === 'dashboard' && (
          <EmployeeDashboard onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {effectiveTab === 'my_dtr' && (
          <EmployeeDtrList onNavigateToCorrections={() => setActiveTab('corrections')} />
        )}

        {effectiveTab === 'corrections' && <EmployeeCorrections />}

        {effectiveTab === 'reimbursements' && <EmployeeReimbursements />}

        {effectiveTab === 'payment_status' && <EmployeePayments />}

        {effectiveTab === 'profile' && <EmployeeProfile />}

        {/* Administrator Views */}
        {effectiveTab === 'admin_dashboard' && (
          <AdminDashboard onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {effectiveTab === 'admin_filings' && <AdminDtrFilings />}

        {effectiveTab === 'admin_extra_hours' && <AdminExtraHours />}

        {effectiveTab === 'admin_corrections' && <AdminCorrections />}

        {effectiveTab === 'admin_reimbursements' && <AdminReimbursements />}

        {effectiveTab === 'admin_users' && <AdminUsers />}

        {effectiveTab === 'admin_payments' && <AdminPayments />}

        {effectiveTab === 'admin_reports' && <AdminReports />}

        {effectiveTab === 'admin_audit' && <AdminAuditLog />}

        {/* System Administrator View */}
        {effectiveTab === 'sysadmin' && <SysAdminPanel />}
      </main>

      {/* Light Theme Clean Footer */}
      <footer className="no-print border-t border-slate-200 bg-white pt-4 pb-24 md:pb-4 mt-auto">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 p-0.5">
              <img
                src="/wmedlaw_logo.jpeg"
                alt="WMedlaw Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-semibold text-slate-700">WMedlaw DTR & Timekeeping</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            {/* <span>Active Persona: <strong className="text-slate-800 font-mono capitalize">{currentUser.role.replace('_', ' ')}</strong></span>
            <span>•</span> */}
            <span>Tamper-Resistant Server Clock</span>
          </div>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Thumb-Zone Navigation (< 768px) */}
      <MobileBottomNav activeTab={effectiveTab} setActiveTab={setActiveTab} />
    </div>
  );
}
