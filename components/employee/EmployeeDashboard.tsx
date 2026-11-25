'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context';
import { PunchClockCard } from '@/components/employee/PunchClockCard';
import {
  Calendar,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  FileCheck,
  Zap,
  Lock,
  Tag,
  Receipt,
} from 'lucide-react';
import {
  computeMinutesWorked,
  minutesToDecimalHours,
  formatDecimalHours,
  formatHoursWithClock,
  formatMonthYear,
  formatDate,
  formatTime,
  formatCurrency,
  generateMonthlyDtrRefTag,
} from '@/lib/utils-dtr';

export function EmployeeDashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const {
    currentUser,
    currentOpenSession,
    fileDtrEntry,
    dtrEntries,
    payPeriods,
    monthlySelfApprovals,
    payments,
    reimbursements,
    serverCurrentTime,
    serverCurrentDate,
    settings,
  } = useApp();

  // Mode switcher: 'punch' (Live Punch Clock) vs 'manual' (Manual DTR Filing)
  const [entryMode, setEntryMode] = useState<'punch' | 'manual'>('punch');

  // Filing form state: date, start time, end time, accomplishments
  const [workDate, setWorkDate] = useState(serverCurrentDate);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [remarks, setRemarks] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live computed duration for filing preview
  const previewMinutes = (startTime && endTime) ? computeMinutesWorked(startTime, endTime) : 0;
  const previewHours = previewMinutes > 0 ? minutesToDecimalHours(previewMinutes) : 0;

  // Daily limit calculation
  const dailyLimit = currentUser.max_hours_day ?? settings.company_max_hours?.day ?? 8.0;

  // Prior hours filed for selected work date
  const priorDateHours = dtrEntries
    .filter(
      (e) =>
        e.user_id === currentUser.id &&
        e.work_date === workDate &&
        e.status !== 'rejected'
    )
    .reduce((sum, e) => sum + (e.hours || 0), 0);

  const totalDayWithPreview = priorDateHours + previewHours;
  const willIncurExtraHours = dailyLimit ? totalDayWithPreview > dailyLimit : false;
  const extraHoursPreview = willIncurExtraHours ? Math.max(0, totalDayWithPreview - dailyLimit) : 0;
  const regularHoursPreview = Math.max(0, previewHours - extraHoursPreview);

  // Today's entries
  const todayEntries = dtrEntries.filter(
    (e) => e.user_id === currentUser.id && e.work_date === serverCurrentDate && e.status !== 'rejected'
  );
  const todayCompletedHours = todayEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

  // Pay period hours
  const userFrequency = currentUser.pay_frequency || 'monthly';
  const currentPeriod =
    payPeriods.find(
      (p) =>
        p.frequency === userFrequency &&
        p.start_date <= serverCurrentDate &&
        p.end_date >= serverCurrentDate
    ) ||
    payPeriods.find((p) => p.frequency === userFrequency && p.status === 'open') ||
    payPeriods.find((p) => p.frequency === 'monthly') ||
    payPeriods[0];

  const periodEntries = dtrEntries.filter(
    (e) =>
      e.user_id === currentUser.id &&
      (e.pay_period_id === currentPeriod?.id ||
        (currentPeriod && e.work_date >= currentPeriod.start_date && e.work_date <= currentPeriod.end_date)) &&
      e.status !== 'rejected'
  );

  const approvedPeriodHours = periodEntries
    .filter((e) => e.status === 'approved' || e.status === 'locked')
    .reduce((sum, e) => sum + (e.payable_hours || 0), 0);

  const pendingPeriodHours = periodEntries
    .filter((e) => ['submitted', 'adjusted', 'extra_hours_pending'].includes(e.status))
    .reduce((sum, e) => sum + (e.hours || 0), 0);

  // Associated payment record for this user and cycle
  const currentPeriodPayment = payments.find(
    (p) =>
      p.user_id === currentUser.id &&
      (p.pay_period_id === currentPeriod?.id ||
        (p.month && currentPeriod?.start_date.startsWith(p.month)))
  );

  // Recent entries for this employee
  const recentEntries = dtrEntries
    .filter((e) => e.user_id === currentUser.id)
    .sort((a, b) => b.work_date.localeCompare(a.work_date) || (b.time_in || '').localeCompare(a.time_in || ''))
    .slice(0, 5);

  const currentMonthStr = (serverCurrentDate || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const currentMonthEntries = dtrEntries.filter(
    (e) => e.user_id === currentUser.id && e.work_date.startsWith(currentMonthStr) && e.status !== 'rejected'
  );
  const currentMonthApproval = monthlySelfApprovals.find(
    (a) => a.user_id === currentUser.id && a.month === currentMonthStr
  );
  const isCurrentMonthApproved = Boolean(currentMonthApproval) || currentMonthEntries.some((e) => e.self_approved);
  const currentMonthHours = currentMonthEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const currentMonthRefTag =
    currentMonthApproval?.reference_no ||
    currentMonthApproval?.employee_note?.match(/\[REF:(.*?)\]/)?.[1] ||
    currentMonthEntries.find((e) => e.self_approved_ref)?.self_approved_ref ||
    generateMonthlyDtrRefTag(currentMonthStr, currentUser.employee_no, currentUser.id);

  const filingMonth = (workDate || '').slice(0, 7);
  const filingApproval = monthlySelfApprovals.find(
    (a) => a.user_id === currentUser.id && a.month === filingMonth
  );
  const isFilingMonthFinalized = Boolean(filingApproval);
  const filingRefTag =
    filingApproval?.reference_no ||
    filingApproval?.employee_note?.match(/\[REF:(.*?)\]/)?.[1] ||
    generateMonthlyDtrRefTag(filingMonth, currentUser.employee_no, currentUser.id);

  const handleApplyPreset = (start: string, end: string, note?: string) => {
    setStartTime(start);
    setEndTime(end);
    if (note && !remarks) {
      setRemarks(note);
    }
  };

  const handleFileDtr = (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);

    if (isFilingMonthFinalized) {
      setActionMessage({
        type: 'error',
        text: `Cannot file DTR: DTR records for ${formatMonthYear(filingMonth)} have already been finalized and certified (Ref Tag: ${filingRefTag}). New time entries cannot be added to a finalized month.`,
      });
      return;
    }

    setIsSubmitting(true);

    const res = fileDtrEntry({
      work_date: workDate,
      time_in: startTime,
      time_out: endTime,
      remarks,
    });

    setIsSubmitting(false);

    if (res.success) {
      setActionMessage({ type: 'success', text: res.message });
      setRemarks('');
    } else {
      setActionMessage({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Employee Workspace
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <span className="text-xs text-slate-500">{currentUser.department}</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight break-words">
            Hello, {currentUser.first_name} {currentUser.last_name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            File your daily time record (DTR) by specifying the date, start time, end time, and accomplishments.
          </p>
        </div>

        {/* Pay Frequency Badge */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left sm:text-right shrink-0">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Pay Frequency
          </div>
          <div className="text-sm font-semibold text-slate-900 capitalize">
            {currentUser.pay_frequency.replace('_', '-')} Cycle
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {currentPeriod ? `${formatDate(currentPeriod.start_date)} – ${formatDate(currentPeriod.end_date)}` : ''}
          </div>
        </div>
      </div>

      {/* Monthly Self-Approval Workflow Reminder */}
      {currentMonthEntries.length > 0 && (
        <div
          onClick={() => onNavigate('my_dtr')}
          className={`p-4 rounded-xl border text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all ${
            isCurrentMonthApproved
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100/60'
              : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 text-white border-slate-700 shadow-md hover:brightness-105'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                isCurrentMonthApproved
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {isCurrentMonthApproved ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <FileCheck className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>
                  {isCurrentMonthApproved
                    ? `${formatMonthYear(currentMonthStr)} DTR Finalized & Self-Approved`
                    : `${formatMonthYear(currentMonthStr)} DTR Self-Approval Pending`}
                </span>
                <span
                  className={`px-2 py-0.2 rounded-full text-[10px] font-extrabold uppercase ${
                    isCurrentMonthApproved
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-amber-400 text-slate-950'
                  }`}
                >
                  {isCurrentMonthApproved ? 'Finalized' : 'Action Needed'}
                </span>
                {isCurrentMonthApproved && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white text-emerald-950 font-bold border border-emerald-300 shadow-2xs break-all">
                    Ref: {currentMonthRefTag}
                  </span>
                )}
              </div>
              <p className={`text-xs mt-1 sm:mt-0.5 ${isCurrentMonthApproved ? 'text-emerald-800' : 'text-slate-300'}`}>
                {isCurrentMonthApproved
                  ? `Your records for ${formatMonthYear(currentMonthStr)} (${currentMonthHours.toFixed(2)} hrs) have been submitted to payroll administration.`
                  : `You have logged ${currentMonthHours.toFixed(2)} hours across ${currentMonthEntries.length} shifts this month. Finalize your records for payroll.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0 self-end sm:self-auto">
            <span>{isCurrentMonthApproved ? 'View in My DTR' : 'Review & Self-Approve'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Action Notification */}
      {actionMessage && (
        <div
          id="action-message-banner"
          className={`p-3.5 sm:p-4 rounded-xl border text-xs sm:text-sm flex items-start sm:items-center justify-between gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span className="break-words">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Punch Clock Station / File DTR Form + Pay Period Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Left 2 columns: Mode Selector + Active Card */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center justify-between bg-slate-100/90 p-1.5 rounded-xl border border-slate-200 text-xs">
            <div className="grid grid-cols-2 w-full sm:w-auto sm:flex items-center gap-1.5">
              <button
                type="button"
                id="tab-punch-clock-mode"
                onClick={() => setEntryMode('punch')}
                className={`min-h-9 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                  entryMode === 'punch'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Live Punch Entry</span>
                {/* {currentOpenSession && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                    Active
                  </span>
                )} */}
              </button>

              <button
                type="button"
                id="tab-manual-file-mode"
                onClick={() => setEntryMode('manual')}
                className={`min-h-9 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                  entryMode === 'manual'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">Manual Shift Entry</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 font-mono pr-2 hidden sm:block">
              {entryMode === 'punch' ? 'Real-time punch station' : 'Past / scheduled shifts'}
            </div>
          </div>

          {/* Render Punch Clock or Manual Form */}
          {entryMode === 'punch' ? (
            <PunchClockCard onFeedback={(msg) => setActionMessage(msg)} />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                    <FileCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">File DTR Entry</h2>
                    <p className="text-xs text-slate-500">Record your shift hours for admin review and payroll</p>
                  </div>
                </div>

                {/* <div className="text-xs font-mono text-slate-500 hidden sm:block">
                  Today: <strong className="text-slate-800">{formatDate(serverCurrentDate)}</strong>
                </div> */}
              </div>

              <form onSubmit={handleFileDtr} className="mt-5 space-y-5">
                {/* Finalized Month Advisory Banner */}
                {isFilingMonthFinalized && (
                  <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        <strong>Month Finalized & Certified:</strong> DTR filings for <strong>{formatMonthYear(filingMonth)}</strong> are confirmed. New time entries cannot be added to this month.
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-white text-emerald-900 border border-emerald-300 shrink-0 self-start sm:self-auto">
                      Ref Tag: {filingRefTag}
                    </span>
                  </div>
                )}

                {/* Shift Date & Time Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Work Date <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        id="dtr-input-date"
                        required
                        value={workDate}
                        onChange={(e) => setWorkDate(e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg outline-none font-mono focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Start Time (Time In) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        id="dtr-input-time-in"
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg outline-none font-mono focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      End Time (Time Out) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        id="dtr-input-time-out"
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg outline-none font-mono focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Calculation Preview Banner */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <span className="text-slate-500 block">Shift Duration</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {previewHours > 0 ? (
                          <>
                            {formatDecimalHours(previewHours)} hrs{' '}
                            <span className="text-xs text-slate-500 font-normal">
                              ({formatHoursWithClock(previewHours)})
                            </span>
                          </>
                        ) : (
                          <span className="text-rose-600 font-normal">Invalid interval (end must be after start)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="sm:text-right font-mono text-xs">
                    {previewHours > 0 && (
                      <div>
                        <span className="text-slate-600">
                          Regular: <strong>{formatDecimalHours(regularHoursPreview)}h</strong>
                        </span>
                        {extraHoursPreview > 0 && (
                          <span className="text-amber-700 ml-2 font-semibold">
                            Extra: +{formatDecimalHours(extraHoursPreview)}h
                          </span>
                        )}
                      </div>
                    )}
                    {priorDateHours > 0 && (
                      <div className="text-[11px] text-slate-500">
                        Already filed for {workDate}: {formatDecimalHours(priorDateHours)}h
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto-Approval or Extra Hours Notice */}
                {willIncurExtraHours ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Daily Limit Notice:</strong> Filing this shift brings your total on {workDate} to{' '}
                      <strong className="font-mono">{formatDecimalHours(totalDayWithPreview)}h</strong>, exceeding the{' '}
                      <strong className="font-mono">{formatDecimalHours(dailyLimit)}h</strong> limit. The excess{' '}
                      <strong className="font-mono">{formatDecimalHours(extraHoursPreview)} hours</strong> will require administrator review.
                    </div>
                  </div>
                ) : previewHours > 0 ? (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Auto-Approval Active:</strong> This shift is within daily limit ({formatDecimalHours(dailyLimit)}h) and will be <strong>automatically approved</strong> upon submission.
                    </span>
                  </div>
                ) : null}

                {/* Accomplishments / Remarks Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Accomplishments & Deliverables <span className="text-rose-600">*</span>
                    </label>
                    <span
                      className={`text-[11px] font-mono ${
                        remarks.trim().length >= (settings.remarks_min_length || 10)
                          ? 'text-emerald-600 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      {remarks.trim().length} / {settings.remarks_min_length || 10} chars min
                    </span>
                  </div>
                  <textarea
                    id="dtr-input-remarks"
                    rows={3}
                    required
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Detail what tasks and client deliverables were completed during this shift (e.g., Closed 12 support tickets, updated knowledgebase documentation, and deployed security patch)..."
                    className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none resize-none"
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="submit"
                    id="btn-submit-dtr-entry"
                    disabled={
                      isSubmitting ||
                      isFilingMonthFinalized ||
                      previewHours <= 0 ||
                      remarks.trim().length < (settings.remarks_min_length || 10)
                    }
                    className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-xs transition-all ${
                      isFilingMonthFinalized
                        ? 'bg-slate-200 border border-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                        : 'bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm hover:shadow-md cursor-pointer'
                    }`}
                  >
                    {isFilingMonthFinalized ? (
                      <>
                        <Lock className="w-4 h-4 text-slate-500" />
                        <span>Month Finalized (Locked)</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-emerald-400" />
                        <span>Submit DTR Entry ({formatDecimalHours(previewHours)} hrs)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Current Pay Period Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pay Period Hours
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                {currentPeriod?.status.toUpperCase()}
              </span>
            </div>

            <div className="space-y-4 my-3">
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Approved Hours</span>
                  <span className="font-semibold text-emerald-700 font-mono">
                    {formatDecimalHours(approvedPeriodHours)} h
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (approvedPeriodHours / Math.max(1, approvedPeriodHours + pendingPeriodHours)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Awaiting Review / Extra Hours</span>
                  <span className="font-semibold text-amber-700 font-mono">
                    {formatDecimalHours(pendingPeriodHours)} h
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (pendingPeriodHours / Math.max(1, approvedPeriodHours + pendingPeriodHours)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="shrink-0">Cycle Range:</span>
                <span className="font-mono font-medium text-slate-800 text-right">
                  {currentPeriod ? `${formatDate(currentPeriod.start_date)} to ${formatDate(currentPeriod.end_date)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="shrink-0">{currentPeriodPayment?.status === 'paid' ? 'Payout Date:' : 'Target Pay Date:'}</span>
                <span className="font-mono font-semibold text-emerald-800 text-right">
                  {currentPeriodPayment?.status === 'paid' && currentPeriodPayment.paid_at ? (
                    <span className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                      <span>{formatDate(currentPeriodPayment.paid_at)}</span>
                      {currentPeriod?.pay_date && currentPeriodPayment.paid_at.slice(0, 10) < currentPeriod.pay_date ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                          Advanced
                        </span>
                      ) : currentPeriod?.pay_date && currentPeriodPayment.paid_at.slice(0, 10) > currentPeriod.pay_date ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                          Adjusted
                        </span>
                      ) : null}
                    </span>
                  ) : currentPeriod?.pay_date ? (
                    formatDate(currentPeriod.pay_date)
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Hours Logged Today:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatDecimalHours(todayCompletedHours)} h
                </span>
              </div>
              {/* <div className="flex justify-between gap-2">
                <span>Cycle Earnings:</span>
                <span className="font-mono font-bold text-emerald-700 text-right">
                  {currentPeriodPayment?.gross_amount != null
                    ? formatCurrency(currentPeriodPayment.gross_amount, settings.currency_symbol)
                    : formatCurrency(approvedPeriodHours * (currentUser.hourly_rate || 0), settings.currency_symbol) + (approvedPeriodHours > 0 ? ' (Est.)' : '')}
                </span>
              </div> */}
              <div className="flex justify-between items-center gap-2">
                <span>Payment Status:</span>
                <span>
                  {currentPeriodPayment?.status === 'paid' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      PAID
                    </span>
                  ) : currentPeriodPayment?.status ? (
                    <span className="text-[11px] font-semibold text-blue-700 capitalize bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {currentPeriodPayment.status.replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[11px] font-medium">Pending Close</span>
                  )}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic mt-4">
              Verified, approved hours count toward payroll disbursement. Track full payment settlement and historical earnings under Payment &amp; Earnings.
            </p>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <button
              id="view-full-dtr-link"
              onClick={() => onNavigate('my_dtr')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer py-1"
            >
              View Full DTR Logs <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-3">
              <button
                id="view-reimbursements-link"
                onClick={() => onNavigate('reimbursements')}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1 cursor-pointer py-1"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Reimbursements</span>
              </button>
              <button
                id="view-payments-link"
                onClick={() => onNavigate('payment_status')}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer py-1"
              >
                Payment &amp; Earnings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Reimbursement Filing Card */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white rounded-xl border border-purple-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Have business expenses to reimburse?</h3>
            <p className="text-[11px] text-slate-600">
              Submit your out-of-pocket expenses. Once approved by administration, it will be automatically added as an additional payment to your payroll payout.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('reimbursements')}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-xs cursor-pointer transition-colors shrink-0"
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>File Reimbursement</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Recent Filed DTR Entries Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Recent Filed DTR Entries</h2>
          </div>
          <button
            onClick={() => onNavigate('my_dtr')}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
          >
            All Logs ({dtrEntries.filter((e) => e.user_id === currentUser.id).length}) <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentEntries.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No DTR entries filed yet. Use the form above to file your first working shift.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentEntries.map((session) => {
              const isOpen = session.status === 'open' || !session.time_out;
              return (
                <div
                  key={session.id}
                  className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs transition-colors ${
                    isOpen
                      ? 'bg-emerald-50/60 hover:bg-emerald-50/90 border-l-4 border-l-emerald-500'
                      : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center font-mono font-bold shrink-0 text-xs ${
                        isOpen
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800 animate-pulse'
                          : 'bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      {isOpen ? 'LIVE' : `${formatDecimalHours(session.hours)}h`}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{formatDate(session.work_date)}</span>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono text-slate-700">
                          {formatTime(session.time_in)} – {session.time_out ? formatTime(session.time_out) : 'In Progress'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isOpen
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
                              : session.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : session.status === 'adjusted'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : session.status === 'extra_hours_pending'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : session.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {isOpen ? 'OPEN / IN PROGRESS' : session.status.toUpperCase().replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 break-words">
                        {session.remarks || (isOpen ? 'Shift currently in progress...' : 'No remarks provided')}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right pl-12 sm:pl-0 shrink-0 font-mono">
                    {isOpen ? (
                      <button
                        type="button"
                        onClick={() => setEntryMode('punch')}
                        className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer shadow-2xs"
                      >
                        View Live Punch
                      </button>
                    ) : (
                      <div className="flex flex-wrap sm:flex-col items-center sm:items-end gap-x-2.5 gap-y-0.5">
                        <div className="font-semibold text-slate-800 text-xs">
                          {formatHoursWithClock(session.hours)}
                        </div>
                        {session.extra_hours > 0 && (
                          <div className="text-[10px] text-amber-800 font-semibold">
                            +{formatDecimalHours(session.extra_hours)}h extra
                          </div>
                        )}
                        {session.status === 'approved' && (
                          <div className="text-[10px] text-emerald-700">
                            Approved: {formatDecimalHours(session.payable_hours)}h
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
