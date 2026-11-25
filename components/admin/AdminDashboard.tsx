'use client';

import React from 'react';
import { useApp } from '@/lib/context';
import {
  Users,
  Clock,
  AlertTriangle,
  FileCheck,
  CheckCircle,
  Calendar,
  ArrowRight,
  TrendingUp,
  FileText,
  CheckCircle2,
  Receipt,
} from 'lucide-react';
import { formatDecimalHours, formatHoursWithClock, formatMonthYear, formatDate, formatTime, formatCurrency } from '@/lib/utils-dtr';

export function AdminDashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const {
    users,
    visibleUsers,
    dtrEntries,
    corrections,
    reimbursements,
    payPeriods,
    monthlySelfApprovals,
    notifications,
    serverCurrentTime,
    serverCurrentDate,
    pendingUsers,
    settings,
  } = useApp();

  const currencySymbol = settings.currency_symbol || '₱';

  // Action queues
  const extraHoursQueue = dtrEntries.filter((e) => e.status === 'extra_hours_pending');
  const pendingCorrections = corrections.filter((c) => c.status === 'pending');
  const pendingApprovals = dtrEntries.filter((e) => ['submitted', 'adjusted'].includes(e.status));
  const pendingReimbursements = reimbursements.filter((r) => r.status === 'pending');
  const pendingReimbursementsSum = pendingReimbursements.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  // Today's filed entries
  const todayEntries = dtrEntries.filter((e) => e.work_date === serverCurrentDate && e.status !== 'rejected');
  const todayFiledHours = todayEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

  // Recent filed DTR entries (latest filed first)
  const recentFiled = [...dtrEntries]
    .filter((e) => {
      const u = visibleUsers.find((user) => user.id === e.user_id);
      return Boolean(u);
    })
    .sort((a, b) => b.work_date.localeCompare(a.work_date) || (b.time_in || '').localeCompare(a.time_in || ''))
    .slice(0, 6)
    .map((e) => {
      const user = users.find((u) => u.id === e.user_id);
      return {
        ...e,
        user,
      };
    });

  // Upcoming pay dates
  const upcomingPeriods = payPeriods
    .filter((p) => p.status === 'open' || p.status === 'closed')
    .sort((a, b) => a.pay_date.localeCompare(b.pay_date));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Welcome */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Administration Console
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Operations & DTR Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Review filed DTR records, manage extra hours decision queues, and audit pay period approvals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg w-full sm:w-auto">
          <Clock className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Server Date: <strong>{formatDate(serverCurrentDate)}</strong></span>
          <span className="text-slate-300 hidden xs:inline">|</span>
          <span>Time: <strong>{formatTime(serverCurrentTime)}</strong></span>
        </div>
      </div>

      {/* Pending User Registrations Banner */}
      {pendingUsers.length > 0 && (
        <div
          onClick={() => onNavigate('admin_users')}
          className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 rounded-xl text-white shadow-md flex items-center justify-between gap-3 sm:gap-4 cursor-pointer hover:brightness-105 transition-all"
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>{pendingUsers.length} Registration(s) Awaiting Approval</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-white text-amber-900 font-extrabold uppercase">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                New staff registered via Google or Email need role assignment (Employee or Administrator) and activation.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 sm:hidden shrink-0 text-white/90" />
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg shrink-0">
            <span>Review Approvals</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Employee Monthly Self-Approvals Submitted Banner */}
      {monthlySelfApprovals.length > 0 && (
        <div
          onClick={() => onNavigate('admin_payments')}
          className="p-3.5 sm:p-4 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 rounded-xl text-white shadow-md flex items-center justify-between gap-3 sm:gap-4 cursor-pointer hover:brightness-105 transition-all border border-emerald-700/40"
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>{monthlySelfApprovals.length} Employee Monthly Self-Approval(s) Received</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-400 text-emerald-950 font-extrabold uppercase">
                  Ready for Payroll
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Staff have finalized and attested their DTR records for the month. Generate payroll and review hours summary.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 sm:hidden shrink-0 text-emerald-300" />
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg shrink-0 border border-white/20">
            <span>View Monthly Payroll</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Pending Reimbursements Banner */}
      {pendingReimbursements.length > 0 && (
        <div
          onClick={() => onNavigate('admin_reimbursements')}
          className="p-3.5 sm:p-4 bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 rounded-xl text-white shadow-md flex items-center justify-between gap-3 sm:gap-4 cursor-pointer hover:brightness-105 transition-all border border-purple-700/40"
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold shrink-0">
              <Receipt className="w-5 h-5 text-purple-300" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>{pendingReimbursements.length} Employee Reimbursement Claim(s) Awaiting Review</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-400 text-purple-950 font-extrabold uppercase">
                  {formatCurrency(pendingReimbursementsSum, currencySymbol)}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Staff have submitted expense filings with receipts. Once approved, amounts are automatically added to payroll.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 sm:hidden shrink-0 text-purple-300" />
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg shrink-0 border border-white/20">
            <span>Review Claims</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* KPI Alert Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div
          onClick={() => onNavigate('admin_reimbursements')}
          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs hover:border-purple-400 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-slate-500">Reimbursements</span>
            <Receipt className="w-4 h-4 text-purple-600 shrink-0" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {pendingReimbursements.length}
          </div>
          <div className="text-[11px] text-purple-700 font-medium mt-1">
            {formatCurrency(pendingReimbursementsSum, currencySymbol)} pending
          </div>
        </div>

        <div
          onClick={() => onNavigate('admin_extra_hours')}
          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs hover:border-amber-400 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-slate-500">Extra Hours</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {extraHoursQueue.length}
          </div>
          <div className="text-[11px] text-amber-800 font-medium mt-1">Exceeding caps</div>
        </div>

        <div
          onClick={() => onNavigate('admin_corrections')}
          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-slate-500">Corrections</span>
            <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {pendingCorrections.length}
          </div>
          <div className="text-[11px] text-blue-700 font-medium mt-1">Time adjustments</div>
        </div>

        <div
          onClick={() => onNavigate('admin_filings')}
          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-400 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-slate-500">Filings to Review</span>
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {pendingApprovals.length}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            {pendingApprovals.length > 0 ? 'Eligible for review' : 'Auto-approval active'}
          </div>
        </div>

        <div
          onClick={() => onNavigate('admin_reports')}
          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-400 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-slate-500">Self-Approvals</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {monthlySelfApprovals.length}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">Employee sign-offs</div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-slate-500">Hours Today</span>
            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {formatDecimalHours(todayFiledHours)} h
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            {todayEntries.length} filed shifts today
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Filed DTR Entries + Upcoming Pay Dates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Filed Entries Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Recent Filed DTR Entries ({dtrEntries.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                Latest submissions from employees ready for review and audit.
              </p>
            </div>
            <button
              onClick={() => onNavigate('admin_filings')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              All Filings <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentFiled.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No DTR entries have been filed yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentFiled.map((session) => (
                <div
                  key={session.id}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold flex items-center justify-center text-xs shrink-0">
                      {session.user?.first_name[0]}
                      {session.user?.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-sm flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{session.user?.first_name} {session.user?.last_name}</span>
                        <span className="text-slate-400 font-normal hidden xs:inline">•</span>
                        <span className="text-xs font-normal text-slate-500">{session.user?.department}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {formatDate(session.work_date)} • <strong className="font-mono text-slate-700">{formatTime(session.time_in)} – {formatTime(session.time_out)}</strong>
                      </div>
                      {session.remarks && (
                        <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-1 italic">
                          &ldquo;{session.remarks}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="flex items-center gap-2 sm:block sm:text-right">
                      <div className="font-mono font-bold text-slate-900 text-sm">
                        {formatDecimalHours(session.hours)} h
                      </div>
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          session.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : session.status === 'adjusted'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : session.status === 'extra_hours_pending'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {session.status.toUpperCase().replace('_', ' ')}
                      </span>
                    </div>
                    <button
                      id={`action-review-${session.id}`}
                      onClick={() => onNavigate('admin_filings')}
                      className="px-3 py-1.5 min-h-8 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md border border-slate-200 whitespace-nowrap cursor-pointer"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Pay Dates & Cycle Tracking */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-bold text-slate-900">Upcoming Pay Dates</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Pay date calculation rules follow configured system policies.
            </p>

            <div className="space-y-3">
              {upcomingPeriods.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between font-medium text-slate-800">
                    <span className="capitalize">{p.frequency.replace('_', '-')} Cycle</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold font-mono ${
                        p.status === 'open'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'closed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">
                    Period: {formatDate(p.start_date)} – {formatDate(p.end_date)}
                  </div>
                  <div className="text-[11px] text-emerald-800 font-semibold font-mono mt-0.5">
                    Pay Date: {formatDate(p.pay_date)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={() => onNavigate('admin_payments')}
              className="w-full text-center text-xs font-semibold text-blue-700 hover:text-blue-900 py-2 min-h-9 rounded-lg border border-blue-100 bg-blue-50/50 hover:bg-blue-50 cursor-pointer"
            >
              Manage All Pay Periods
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
