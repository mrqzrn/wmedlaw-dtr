'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Square,
  X,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { DtrEntry } from '@/lib/types';
import {
  computeSecondsWorked,
  formatElapsedDuration,
  minutesToDecimalHours,
  formatDecimalHours,
  formatDate,
  formatTime,
} from '@/lib/utils-dtr';

interface NavPunchOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOpenSession: DtrEntry | null;
  serverCurrentTime: string;
  serverCurrentDate: string;
  serverCurrentSeconds: number;
  isSimulated: boolean;
  minRemarksLength: number;
  onConfirmPunchOut: (remarks: string) => { success: boolean; message?: string };
  onCancelAccidentalPunch: (reason?: string) => { success: boolean; message?: string };
}

export function NavPunchOutModal({
  isOpen,
  onClose,
  currentOpenSession,
  serverCurrentTime,
  serverCurrentDate,
  serverCurrentSeconds,
  isSimulated,
  minRemarksLength = 10,
  onConfirmPunchOut,
  onCancelAccidentalPunch,
}: NavPunchOutModalProps) {
  const [remarks, setRemarks] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Local 1-second ticker while the modal is open
  const [modalTicker, setModalTicker] = useState(0);
  useEffect(() => {
    if (!isOpen || !currentOpenSession) return;
    const interval = setInterval(() => setModalTicker((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isOpen, currentOpenSession]);

  // Live elapsed duration in seconds
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
  }, [currentOpenSession, serverCurrentTime, serverCurrentDate, serverCurrentSeconds, modalTicker, isSimulated]);

  const liveElapsedMinutes = Math.floor(elapsedSeconds / 60);
  const liveDecimalHours = minutesToDecimalHours(Math.max(1, liveElapsedMinutes));

  if (!isOpen || !currentOpenSession) return null;

  const trimmedRemarksLength = remarks.trim().length;
  const isValidLength = trimmedRemarksLength >= minRemarksLength;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isValidLength) {
      setErrorMessage(`Accomplishment remarks must be at least ${minRemarksLength} characters.`);
      return;
    }

    setIsSubmitting(true);
    const res = onConfirmPunchOut(remarks.trim());
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.message || 'Failed to punch out. Please try again.');
    } else {
      setRemarks('');
      onClose();
    }
  };

  const handleConfirmCancel = () => {
    const res = onCancelAccidentalPunch(cancelReason || 'Accidental clock-in discarded by user');
    if (res.success) {
      setShowCancelConfirm(false);
      setCancelReason('');
      onClose();
    } else {
      setErrorMessage(res.message || 'Failed to cancel punch session.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 pb-safe">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Square className="w-4 h-4 fill-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                Punch Out & Complete Shift
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                Record your accomplishments and finish your work session
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cancel Confirmation View */}
        {showCancelConfirm ? (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Discard Accidental Clock-In?</strong>
                <p className="mt-1 text-rose-800">
                  This will completely remove this session clocked in at{' '}
                  <strong className="font-mono">{formatTime(currentOpenSession.time_in)}</strong>. No hours will be recorded in your DTR.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for cancellation (optional):
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Clicked clock-in by mistake"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="w-full xs:w-auto px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer min-h-[40px]"
              >
                Go Back
              </button>
              <button
                type="button"
                id="btn-nav-confirm-cancel-punch"
                onClick={handleConfirmCancel}
                className="w-full xs:w-auto px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer min-h-[40px]"
              >
                Yes, Discard Punch
              </button>
            </div>
          </div>
        ) : (
          /* Normal Punch Out Form */
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
            {/* Shift Session Summary Box */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3.5 sm:p-4 rounded-xl shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-300 border-b border-slate-700/60 pb-2">
                <span className="font-medium">Active Shift Summary</span>
                <span className="font-mono text-slate-400">{formatDate(currentOpenSession.work_date)}</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                <div className="bg-white/5 rounded-lg p-1.5 sm:p-2 min-w-0">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider truncate">Clock In</div>
                  <div className="font-mono font-bold text-xs sm:text-sm text-emerald-400 mt-0.5 truncate">
                    {formatTime(currentOpenSession.time_in)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5 sm:p-2 min-w-0">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider truncate">Clock Out</div>
                  <div className="font-mono font-bold text-xs sm:text-sm text-rose-400 mt-0.5 truncate">
                    {formatTime(serverCurrentTime)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5 sm:p-2 min-w-0">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider truncate">Duration</div>
                  <div className="font-mono font-bold text-xs sm:text-sm text-white mt-0.5 truncate">
                    {formatElapsedDuration(elapsedSeconds)}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1">
                <span>Calculated Hours:</span>
                <span className="font-mono font-bold text-emerald-300">
                  ≈ {formatDecimalHours(liveDecimalHours)} hrs
                </span>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Remarks / Accomplishments */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Accomplishments & Deliverables <span className="text-rose-600">*</span>
                </label>
                <span
                  className={`text-[11px] font-mono font-medium ${
                    isValidLength ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  {trimmedRemarksLength} / {minRemarksLength} chars min
                </span>
              </div>
              <textarea
                id="nav-punch-clock-out-remarks"
                rows={3}
                required
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Summarize what tasks, deliverables, or tickets were accomplished during this work shift..."
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none resize-none shadow-2xs"
                autoFocus
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Company policy requires documenting accomplishments before clocking out.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
              <button
                type="button"
                id="btn-nav-cancel-accidental"
                onClick={() => setShowCancelConfirm(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors cursor-pointer min-h-[40px]"
                title="Discard accidental punch session"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cancel Accidental Punch</span>
              </button>

              <div className="w-full sm:w-auto flex flex-col-reverse xs:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full xs:w-auto px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer min-h-[40px]"
                >
                  Keep Working
                </button>
                <button
                  type="submit"
                  id="btn-nav-confirm-punch-out"
                  disabled={isSubmitting || !isValidLength}
                  className="w-full xs:flex-1 sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer min-h-[42px]"
                >
                  <Square className="w-3.5 h-3.5 fill-white text-white shrink-0" />
                  <span>PUNCH CLOCK OUT</span>
                  <span className="font-mono font-normal text-rose-100 text-[11px] border-l border-rose-500 pl-1.5">
                    {formatTime(serverCurrentTime)}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
