'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context';
import {
  Clock,
  Shield,
  User as UserIcon,
  RefreshCw,
  LogOut,
  Mail,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export function PendingApprovalScreen() {
  const { currentUser, signOut, refreshCurrentUserProfile } = useApp();
  const [checking, setChecking] = useState(false);
  const [checkedNotice, setCheckedNotice] = useState<string | null>(null);

  const handleRefresh = async () => {
    setChecking(true);
    setCheckedNotice(null);
    try {
      await refreshCurrentUserProfile();
      setCheckedNotice('Status refreshed. Your account is still awaiting administrator review.');
    } catch {
      setCheckedNotice('Could not refresh status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-3.5 sm:p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 p-5 sm:p-6 text-white text-center">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md p-1 border border-amber-200/50 overflow-hidden">
            <img
              src="/wmedlaw_logo.jpeg"
              alt="WMedlaw Logo"
              className="w-full h-full object-contain"
            />
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 shadow-xs border-2 border-white">
              <Clock className="w-3 h-3 animate-pulse" />
            </div>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Account Pending Approval</h2>
          <p className="text-xs text-amber-100 mt-1">
            Your WMedlaw registration is currently under administrative review
          </p>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* User Details Box */}
          <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 shrink-0">Applicant Name</span>
              <span className="font-semibold text-slate-900 text-right truncate">
                {currentUser.first_name} {currentUser.last_name}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-slate-500 shrink-0">Email Address</span>
              <span className="font-mono text-slate-800 text-right break-all">{currentUser.email}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 shrink-0">Registration Status</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                PENDING APPROVAL
              </span>
            </div>
            {currentUser.auth_provider && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 shrink-0">Sign-in Method</span>
                <span className="capitalize font-medium text-slate-700">
                  {currentUser.auth_provider}
                </span>
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
            <p>
              Your account has been successfully created. For security and compliance, an administrator
              must approve your registration and assign your system role:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium pl-1">
              <li><strong>Employee:</strong> Access to daily punch station, DTR logs, overtime filings, and payment status.</li>
              <li><strong>Administrator:</strong> DTR approvals, wage administration, period controls, and employee records.</li>
            </ul>
            <p className="text-[11px] text-slate-500 pt-1">
              The system administrator has been notified. Once approved, you will have immediate access upon refreshing.
            </p>
          </div>

          {checkedNotice && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>{checkedNotice}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleRefresh}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Checking Status...' : 'Check Approval Status'}</span>
            </button>

            <button
              onClick={() => signOut()}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out / Switch Account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
