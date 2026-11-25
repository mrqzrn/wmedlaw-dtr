'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context';
import { PlusCircle, Clock, AlertCircle, CheckCircle2, XCircle, FileText, Lock } from 'lucide-react';
import { formatHoursWithClock, formatDate, formatTime, formatMonthYear, generateMonthlyDtrRefTag } from '@/lib/utils-dtr';

export function EmployeeCorrections() {
  const { currentUser, corrections, fileCorrection, dtrEntries, monthlySelfApprovals, serverCurrentDate } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [workDate, setWorkDate] = useState(serverCurrentDate || '2026-10-24');
  const [timeIn, setTimeIn] = useState('09:00');
  const [timeOut, setTimeOut] = useState('17:00');
  const [reason, setReason] = useState('');
  const [associatedEntryId, setAssociatedEntryId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedMonth = (workDate || '').slice(0, 7);
  const monthApproval = monthlySelfApprovals.find(
    (a) => a.user_id === currentUser.id && a.month === selectedMonth
  );
  const isSelectedMonthFinalized = Boolean(monthApproval);
  const refTag =
    monthApproval?.reference_no ||
    monthApproval?.employee_note?.match(/\[REF:(.*?)\]/)?.[1] ||
    generateMonthlyDtrRefTag(selectedMonth, currentUser.employee_no, currentUser.id);

  const userCorrections = corrections
    .filter((c) => c.user_id === currentUser.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Eligible existing entries for correction
  const userEntries = dtrEntries.filter((e) => e.user_id === currentUser.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isSelectedMonthFinalized) {
      setErrorMessage(`Cannot submit correction: DTR records for ${formatMonthYear(selectedMonth)} have already been finalized and certified (Ref: ${refTag}).`);
      return;
    }

    const res = fileCorrection({
      dtr_entry_id: associatedEntryId || null,
      work_date: workDate,
      requested_time_in: timeIn,
      requested_time_out: timeOut,
      reason,
    });

    if (res.success) {
      setShowModal(false);
      setReason('');
      setAssociatedEntryId('');
    } else {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              DTR Correction Requests
            </h1>
          </div>
          <p className="text-xs text-slate-600">
            Submit a correction request if you forgot to clock in, timed out late, or need time adjustments.
          </p>
        </div>

        <button
          id="btn-file-correction-modal"
          onClick={() => {
            setErrorMessage(null);
            setShowModal(true);
          }}
          className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs cursor-pointer shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Correction Request</span>
        </button>
      </div>

      {/* List of Requests */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-100 font-semibold text-xs text-slate-700">
          Your Submitted Requests ({userCorrections.length})
        </div>

        {userCorrections.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No correction requests filed yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {userCorrections.map((corr) => (
              <div key={corr.id} className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4 text-xs">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-slate-900">
                    <span className="font-mono">{formatDate(corr.work_date)}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono text-slate-700">
                      {formatTime(corr.requested_time_in)} → {formatTime(corr.requested_time_out)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        corr.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : corr.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {corr.status.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-slate-600 break-words">
                    <strong className="text-slate-700">Reason:</strong> {corr.reason}
                  </p>

                  {corr.review_note && (
                    <div className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700 break-words">
                      <strong>Administrator Note:</strong> {corr.review_note} (Reviewed by{' '}
                      {corr.reviewed_by_name || 'Admin'})
                    </div>
                  )}
                </div>

                <div className="text-left md:text-right text-[11px] text-slate-400 font-mono shrink-0">
                  Filed on {formatDate(corr.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Correction Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">File DTR Correction Request</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {isSelectedMonthFinalized && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    DTR records for <strong>{formatMonthYear(selectedMonth)}</strong> have been finalized and certified.
                  </span>
                </div>
                <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-white text-emerald-900 border border-emerald-300 shrink-0">
                  Ref: {refTag}
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Target Entry (Optional)
                </label>
                <select
                  value={associatedEntryId}
                  onChange={(e) => setAssociatedEntryId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none"
                >
                  <option value="">Create new missing session entry</option>
                  {userEntries.map((e) => (
                    <option key={e.id} value={e.id}>
                      {formatDate(e.work_date)} ({formatTime(e.time_in)} – {e.time_out ? formatTime(e.time_out) : 'open'}) - {e.remarks?.slice(0, 30)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Work Date</label>
                  <input
                    type="date"
                    required
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    className="w-full p-2.5 sm:p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Proposed In</label>
                  <input
                    type="time"
                    required
                    value={timeIn}
                    onChange={(e) => setTimeIn(e.target.value)}
                    className="w-full p-2.5 sm:p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Proposed Out</label>
                  <input
                    type="time"
                    required
                    value={timeOut}
                    onChange={(e) => setTimeOut(e.target.value)}
                    className="w-full p-2.5 sm:p-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Reason for Adjustment <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why the correction is needed (e.g., VPN outage, forgot to clock out)..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none resize-none"
                />
              </div>

              <div className="flex flex-col-reverse xs:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full xs:w-auto min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSelectedMonthFinalized}
                  className="w-full xs:w-auto min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs cursor-pointer"
                >
                  {isSelectedMonthFinalized ? 'Month Finalized (Locked)' : 'Submit Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
