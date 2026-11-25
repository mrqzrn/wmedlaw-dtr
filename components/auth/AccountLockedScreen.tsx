'use client';

import React from 'react';
import { useApp } from '@/lib/context';
import { Lock, LogOut } from 'lucide-react';

export function AccountLockedScreen() {
  const { currentUser, signOut } = useApp();

  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-3.5 sm:p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-rose-500 to-rose-700 p-5 sm:p-6 text-white text-center">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md p-1 border border-rose-200/50 overflow-hidden">
            <img
              src="/wmedlaw_logo.jpeg"
              alt="WMedlaw Logo"
              className="w-full h-full object-contain"
            />
            <div className="absolute -bottom-1 -right-1 bg-rose-600 text-white rounded-full p-1 shadow-xs border-2 border-white">
              <Lock className="w-3 h-3" />
            </div>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Account Deactivated or Suspended</h2>
          <p className="text-xs text-rose-100 mt-1">
            Access to WMedlaw DTR has been restricted
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-3">
              <span className="text-slate-500 shrink-0">Account</span>
              <span className="font-semibold text-slate-900 text-right break-all">{currentUser.email}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 shrink-0">Status</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 uppercase shrink-0">
                {currentUser.status}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Your account is currently inactive or locked. If you believe this is an error, please contact your company administrator or system administrator to restore your access.
          </p>

          <div className="pt-2">
            <button
              onClick={() => signOut()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
