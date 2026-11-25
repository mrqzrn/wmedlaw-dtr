'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/lib/context';
import {
  Clock,
  Play,
  Square,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Zap,
  TrendingUp,
  RotateCcw,
  Lock,
  Tag,
} from 'lucide-react';
import {
  computeSecondsWorked,
  formatElapsedDuration,
  minutesToDecimalHours,
  formatDecimalHours,
  formatHoursWithClock,
  formatDate,
  formatTime,
  formatMonthYear,
  generateMonthlyDtrRefTag,
  addMinutesToWallClock,
  MAX_SESSION_HOURS,
  MAX_SESSION_MINUTES,
} from '@/lib/utils-dtr';
import { requestNotificationPermission } from '@/lib/browser-notifications';

interface PunchClockCardProps {
  onFeedback?: (message: { type: 'success' | 'error'; text: string } | null) => void;
}

export function PunchClockCard({ onFeedback }: PunchClockCardProps) {
  const {
    currentUser,
    currentOpenSession,
    timeIn,
    timeOut,
    cancelClockIn,
    dtrEntries,
    settings,
    monthlySelfApprovals,
    serverCurrentDate,
    serverCurrentTime,
    serverCurrentSeconds,
    serverCurrentTimeWithSeconds,
    isSimulated,
  } = useApp();

  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Local 1-second ticker for clock display and active shift duration
  const [localTicker, setLocalTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setLocalTicker((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const liveCurrentTimeWithSeconds = useMemo(() => {
    if (isSimulated && serverCurrentTime) {
      const secStr = String(new Date().getSeconds()).padStart(2, '0');
      return `${serverCurrentTime}:${secStr}`;
    }
    return new Date().toTimeString().slice(0, 8);
  }, [isSimulated, serverCurrentTime, localTicker]);

  const currentMonthStr = useMemo(() => {
    return (serverCurrentDate || '').slice(0, 7);
  }, [serverCurrentDate]);

  const currentMonthApproval = useMemo(() => {
    return monthlySelfApprovals.find(
      (a) => a.user_id === currentUser.id && a.month === currentMonthStr
    );
  }, [monthlySelfApprovals, currentUser.id, currentMonthStr]);

  const isCurrentMonthFinalized = Boolean(currentMonthApproval);
  const refTag = useMemo(() => {
    if (!currentMonthApproval) return '';
    return (
      currentMonthApproval.reference_no ||
      currentMonthApproval.employee_note?.match(/\[REF:(.*?)\]/)?.[1] ||
      generateMonthlyDtrRefTag(currentMonthStr, currentUser.employee_no, currentUser.id)
    );
  }, [currentMonthApproval, currentMonthStr, currentUser.employee_no, currentUser.id]);

  // Daily limit
  const dailyLimit = currentUser.max_hours_day ?? settings.company_max_hours?.day ?? 8.0;

  // Prior hours filed today (excluding the currently open session)
  const priorHoursToday = useMemo(() => {
    return dtrEntries
      .filter(
        (e) =>
          e.user_id === currentUser.id &&
          e.work_date === serverCurrentDate &&
          e.id !== currentOpenSession?.id &&
          e.status !== 'rejected'
      )
      .reduce((sum, e) => sum + (e.hours || 0), 0);
  }, [dtrEntries, currentUser.id, serverCurrentDate, currentOpenSession]);

  // Live elapsed duration in seconds for open session (derived from live server seconds or exact created_at)
  const elapsedSeconds = useMemo(() => {
    if (!currentOpenSession) return 0;
    return computeSecondsWorked(
      currentOpenSession.time_in,
      currentOpenSession.work_date,
      serverCurrentTime,
      serverCurrentDate,
      isSimulated ? serverCurrentSeconds : new Date().getSeconds(),
      isSimulated ? undefined : currentOpenSession.created_at
    );
  }, [currentOpenSession, serverCurrentTime, serverCurrentDate, serverCurrentSeconds, isSimulated, localTicker]);

  // Current session duration in decimal hours
  const liveElapsedMinutes = Math.floor(elapsedSeconds / 60);
  const liveDecimalHours = minutesToDecimalHours(Math.max(1, liveElapsedMinutes));

  // Max session duration: forgotten punch-outs are auto-closed at time-in + MAX_SESSION_HOURS
  const autoCloseAt = currentOpenSession
    ? addMinutesToWallClock(currentOpenSession.work_date, currentOpenSession.time_in, MAX_SESSION_MINUTES)
    : null;
  const minutesUntilAutoClose = Math.max(0, MAX_SESSION_MINUTES - liveElapsedMinutes);
  const isNearAutoClose = Boolean(currentOpenSession) && minutesUntilAutoClose <= 30;

  // Live day totals
  const totalDayHoursWithCurrent = priorHoursToday + (currentOpenSession ? liveDecimalHours : 0);
  const isExceedingDailyLimit = totalDayHoursWithCurrent > dailyLimit;
  const extraHoursAccumulated = isExceedingDailyLimit ? Math.max(0, totalDayHoursWithCurrent - dailyLimit) : 0;

  const handlePunchClockIn = () => {
    setLocalFeedback(null);
    if (isCurrentMonthFinalized) {
      const msg = {
        type: 'error' as const,
        text: `Cannot clock in: DTR records for ${formatMonthYear(currentMonthStr)} have already been finalized and certified (Ref Tag: ${refTag}).`,
      };
      setLocalFeedback(msg);
      onFeedback?.(msg);
      return;
    }
    // Ask for desktop-alert permission during the click, so hourly "still working?" reminders can reach them
    void requestNotificationPermission();
    setIsSubmitting(true);

    const res = timeIn();
    setIsSubmitting(false);

    if (res.success) {
      const msg = { type: 'success' as const, text: res.message };
      setLocalFeedback(msg);
      onFeedback?.(msg);
      setRemarks('');
    } else {
      const msg = { type: 'error' as const, text: res.message };
      setLocalFeedback(msg);
      onFeedback?.(msg);
    }
  };

  const handlePunchClockOut = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalFeedback(null);

    const minChars = settings.remarks_min_length || 10;
    if (!remarks || remarks.trim().length < minChars) {
      const msg = {
        type: 'error' as const,
        text: `Accomplishment remarks are required (at least ${minChars} characters).`,
      };
      setLocalFeedback(msg);
      onFeedback?.(msg);
      return;
    }

    setIsSubmitting(true);
    const res = timeOut(remarks.trim());
    setIsSubmitting(false);

    if (res.success) {
      const msg = { type: 'success' as const, text: res.message };
      setLocalFeedback(msg);
      onFeedback?.(msg);
      setRemarks('');
    } else {
      const msg = { type: 'error' as const, text: res.message };
      setLocalFeedback(msg);
      onFeedback?.(msg);
    }
  };

  const handleConfirmCancelPunch = () => {
    const res = cancelClockIn(cancelReason || 'Accidental clock-in discarded by user');
    setShowCancelConfirm(false);
    setCancelReason('');
    if (res.success) {
      const msg = { type: 'success' as const, text: res.message };
      setLocalFeedback(msg);
      onFeedback?.(msg);
    } else {
      const msg = { type: 'error' as const, text: res.message };
      setLocalFeedback(msg);
      onFeedback?.(msg);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 bg-slate-50/50">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs transition-colors shrink-0 ${
              currentOpenSession
                ? 'bg-emerald-600 text-white shadow-emerald-200'
                : 'bg-slate-900 text-white'
            }`}
          >
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                Live Punch Clock Status
              </h2>
              {currentOpenSession ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  ON DUTY 
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700 border border-slate-300">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  OFF DUTY 
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tamper-resistant timekeeping synchronized to company server clock
            </p>
          </div>
        </div>

        {/* Server Clock Real-time Badge */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 bg-white border border-slate-200 rounded-xl px-3.5 sm:px-4 py-2.5 text-left sm:text-right shadow-2xs shrink-0">
          <span className="sm:hidden text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Server Time
          </span>
          <div className="text-right">
            {/* <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Server Time ({settings.timezone.split(' ')[0]})
            </div> */}
            <div className="font-mono font-bold text-slate-900 text-sm sm:text-lg tracking-tight">
              {formatTime(liveCurrentTimeWithSeconds, true)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {formatDate(serverCurrentDate)}
            </div>
          </div>
        </div>
      </div>

      {/* Local Feedback banner */}
      {localFeedback && (
        <div
          className={`p-3.5 mx-4 sm:mx-6 mt-4 sm:mt-5 rounded-lg border text-xs flex items-start sm:items-center justify-between gap-3 ${
            localFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            {localFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span className="break-words">{localFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocalFeedback(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Body */}
      <div className="p-4 sm:p-6">
        {!currentOpenSession ? (
          /* ========================================================
             CLOCKED OUT STATE
             ======================================================== */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-center">
              {/* Left: Punch In CTA button */}
              {isCurrentMonthFinalized ? (
                <div className="md:col-span-2 flex flex-col items-center sm:items-start text-center sm:text-left bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 rounded-2xl border border-slate-300 shadow-xs">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 border border-amber-300 text-amber-900 shadow-2xs mb-3">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Month Finalized & Certified</span>
                  </div>
                  <h3 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                    Punch Clock Locked for {formatMonthYear(currentMonthStr)}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md">
                    You have finalized and self-approved all DTR records for <strong>{formatMonthYear(currentMonthStr)}</strong>. New time entries cannot be added to this month.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-white text-emerald-950 border border-emerald-300 shadow-2xs break-all">
                    <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Ref Tag: <strong className="text-emerald-800">{refTag}</strong></span>
                  </div>

                  <div className="mt-5 w-full sm:w-auto">
                    <button
                      type="button"
                      id="btn-punch-clock-in-locked"
                      disabled
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 sm:gap-3 px-5 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-slate-200 border border-slate-300 text-slate-500 font-bold text-xs sm:text-base cursor-not-allowed shadow-none"
                    >
                      <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                      <span>MONTH FINALIZED (LOCKED)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="md:col-span-2 flex flex-col items-center sm:items-start text-center sm:text-left bg-gradient-to-br from-slate-50 to-emerald-50/40 p-4 sm:p-6 rounded-2xl border border-slate-200">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs mb-3">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ready to start work</span>
                  </div>
                  <h3 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                    Punch In to Record Shift
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md">
                    Click the button below to start your shift. Your actual start time will be recorded as{' '}
                    <strong className="font-mono text-slate-900">{formatTime(serverCurrentTime)}</strong> on{' '}
                    <strong className="font-mono text-slate-900">{formatDate(serverCurrentDate)}</strong>.
                  </p>

                  <div className="mt-5 w-full sm:w-auto">
                    <button
                      type="button"
                      id="btn-punch-clock-in"
                      onClick={handlePunchClockIn}
                      disabled={isSubmitting || !currentUser.clocks_in}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 sm:gap-3 px-5 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <Play className="w-5 h-5 fill-white text-white shrink-0" />
                      <span>PUNCH CLOCK IN</span>
                      <span className="font-mono font-normal text-emerald-100 text-xs border-l border-emerald-500 pl-2 sm:pl-2.5">
                        {formatTime(serverCurrentTime)}
                      </span>
                    </button>
                  </div>

                  {!currentUser.clocks_in && (
                    <p className="text-xs text-rose-600 mt-2">
                      Clocking in is disabled for this account by company policy.
                    </p>
                  )}
                </div>
              )}

              {/* Right: Today's Summary card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5 text-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Today&apos;s Summary</span>
                  {/* <span className="font-mono">{formatDate(serverCurrentDate)}</span> */}
                </div>

                <div className="divide-y divide-slate-100">
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-600">Hours Logged Today:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatDecimalHours(priorHoursToday)} h
                    </span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-600">Daily Limit:</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {formatDecimalHours(dailyLimit)} h
                    </span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-600">Remaining Hours:</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {formatDecimalHours(Math.max(0, dailyLimit - priorHoursToday))} h
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Tamper-resistant server clock verified</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================
             CLOCKED IN STATE (ACTIVE OPEN SESSION)
             ======================================================== */
          <div className="space-y-5 sm:space-y-6">
            {/* Live Ticker Hero Banner */}
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 rounded-2xl p-4 sm:p-7 text-white shadow-md relative overflow-hidden">
              {/* Background ambient glowing circle */}
              <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6 relative z-10">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      SHIFT IN PROGRESS
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Started: {formatTime(currentOpenSession.time_in)} • {formatDate(currentOpenSession.work_date)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    Elapsed Shift Duration
                  </div>
                  <div className="text-3xl xs:text-4xl sm:text-5xl font-mono font-extrabold tracking-tight text-emerald-400 mt-1">
                    {formatElapsedDuration(elapsedSeconds)}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-300 font-mono mt-1">
                    ≈ <strong>{formatDecimalHours(liveDecimalHours)} hrs</strong>{' '}
                    <span className="text-slate-400">
                      ({formatHoursWithClock(liveDecimalHours).split('(')[1]?.replace(')', '')})
                    </span>
                  </div>
                  {autoCloseAt && (
                    <div
                      className={`text-[11px] mt-2 flex items-center gap-1 font-medium ${
                        isNearAutoClose ? 'text-amber-300' : 'text-slate-400'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isNearAutoClose
                          ? `Auto-closes in ${minutesUntilAutoClose} min (${formatTime(autoCloseAt.time)}). Punch out now to record your remarks.`
                          : `Auto-closes at ${formatTime(autoCloseAt.time)}${
                              autoCloseAt.date !== currentOpenSession.work_date ? ` (${formatDate(autoCloseAt.date)})` : ''
                            } if you forget to punch out (${MAX_SESSION_HOURS}-hour max)`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress toward Daily Limit */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 sm:p-4 sm:min-w-[240px] text-xs">
                  <div className="flex items-center justify-between mb-1.5 text-slate-300 font-medium">
                    <span>Daily Limit Progress</span>
                    <span className="font-mono">
                      {formatDecimalHours(totalDayHoursWithCurrent)} / {formatDecimalHours(dailyLimit)}h
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isExceedingDailyLimit ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (totalDayHoursWithCurrent / dailyLimit) * 100)}%`,
                      }}
                    />
                  </div>
                  {isExceedingDailyLimit ? (
                    <div className="text-[11px] text-amber-300 mt-2 flex items-center gap-1 font-medium">
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      <span>+{formatDecimalHours(extraHoursAccumulated)}h extra hours awaiting approval</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-300/90 mt-2">
                      {formatDecimalHours(Math.max(0, dailyLimit - totalDayHoursWithCurrent))} regular hours remaining (Auto-approved upon punch out)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Daily limit advisory notice if applicable */}
            {isExceedingDailyLimit && (
              <div className="p-3.5 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Daily Limit Threshold Reached:</strong> Your total shift hours for today have crossed the{' '}
                  <strong className="font-mono">{formatDecimalHours(dailyLimit)}h</strong> limit. The excess time (currently{' '}
                  <strong className="font-mono">+{formatDecimalHours(extraHoursAccumulated)}h</strong>) will be logged as
                  extra hours and routed to administration for review.
                </div>
              </div>
            )}

            {/* Clock Out Form (Accomplishments + Punch Out Button) */}
            <form onSubmit={handlePunchClockOut} className="space-y-4 pt-1">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
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
                  id="punch-clock-out-remarks"
                  rows={3}
                  required
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Summarize what tasks, deliverables, or tickets were accomplished during this work shift..."
                  className="w-full text-xs p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none resize-none shadow-2xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Company policy requires documenting deliverables upon clocking out.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  id="btn-cancel-punch"
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  title="Discard accidental punch session"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Cancel Accidental Punch</span>
                </button>

                <button
                  type="submit"
                  id="btn-punch-clock-out"
                  disabled={
                    isSubmitting ||
                    remarks.trim().length < (settings.remarks_min_length || 10)
                  }
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-white text-white shrink-0" />
                  <span>PUNCH CLOCK OUT</span>
                  <span className="font-mono font-normal text-rose-100 text-xs border-l border-rose-500 pl-2">
                    {formatTime(serverCurrentTime)}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Cancel Punch Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                  Discard Accidental Clock-In?
                </h3>
              </div>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel this open punch session clocked in at{' '}
              <strong className="font-mono text-slate-900">{formatTime(currentOpenSession?.time_in)}</strong>?
              This will discard the session completely without adding an entry to your DTR logs.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reason for cancellation (optional):
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Clicked clock-in by mistake"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="w-full xs:w-auto min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Keep Shift
              </button>
              <button
                type="button"
                id="btn-confirm-cancel-punch"
                onClick={handleConfirmCancelPunch}
                className="w-full xs:w-auto min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
              >
                Yes, Discard Punch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
