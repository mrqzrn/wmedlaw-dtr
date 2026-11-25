'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { formatDecimalHours, formatHoursWithClock, formatDate, formatTime } from '@/lib/utils-dtr';
import { DtrEntry } from '@/lib/types';

export function AdminExtraHours() {
  const { visibleUsers, dtrEntries, approveExtraHours, rejectDtrEntry } = useApp();

  const [declineModalEntry, setDeclineModalEntry] = useState<DtrEntry | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const [rejectModalEntry, setRejectModalEntry] = useState<DtrEntry | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Find entries where extra_hours > 0 and status is extra_hours_pending (excluding already rejected/approved/locked entries)
  const extraHoursEntries = dtrEntries
    .filter(
      (e) =>
        e.status !== 'rejected' &&
        e.status !== 'approved' &&
        e.status !== 'locked' &&
        (e.status === 'extra_hours_pending' || e.extra_hours_status === 'pending')
    )
    .sort((a, b) => b.work_date.localeCompare(a.work_date));

  const handleApproveAll = (entryId: string) => {
    const res = approveExtraHours(entryId, 'all');
    if (!res.success) alert(res.message);
  };

  const handleConfirmDecline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineModalEntry) return;
    const res = approveExtraHours(declineModalEntry.id, 'regular_only', declineReason);
    if (res.success) {
      setDeclineModalEntry(null);
      setDeclineReason('');
    } else {
      alert(res.message);
    }
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalEntry) return;
    const res = rejectDtrEntry(rejectModalEntry.id, rejectReason);
    if (res.success) {
      setRejectModalEntry(null);
      setRejectReason('');
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Extra Hours Approval Queue
            </h1>
          </div>
          <p className="text-xs text-slate-600">
            Deliberate adjudication queue for sessions that pushed past daily, weekly, or monthly hour thresholds.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3.5 py-2 rounded-lg font-medium w-full sm:w-auto text-center">
          {extraHoursEntries.length} session(s) awaiting review
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {extraHoursEntries.length === 0 ? (
          <div className="p-10 sm:p-12 text-center text-slate-400 text-xs space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">No Pending Extra Hours</p>
            <p>All recorded sessions are within limits or have already been adjudicated.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {extraHoursEntries.map((entry) => {
              const user = visibleUsers.find((u) => u.id === entry.user_id);
              return (
                <div key={entry.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5 text-xs">
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
                        {user?.first_name[0]}
                        {user?.last_name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-sm">
                          {user?.first_name} {user?.last_name}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {user?.position} • {user?.department}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {entry.extra_hours_limit?.toUpperCase() || 'DAILY'} LIMIT EXCEEDED
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Work Date</span>
                        <strong className="text-slate-800">{formatDate(entry.work_date)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Time Interval</span>
                        <strong className="text-slate-800">
                          {formatTime(entry.time_in)} → {entry.time_out ? formatTime(entry.time_out) : 'Open'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Regular Portion</span>
                        <strong className="text-emerald-700">
                          {formatDecimalHours(entry.regular_hours)} h
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Extra Hours</span>
                        <strong className="text-amber-800 font-bold">
                          +{formatDecimalHours(entry.extra_hours)} h
                        </strong>
                      </div>
                    </div>

                    <div className="text-slate-700 break-words">
                      <strong>Accomplishment Note:</strong> {entry.remarks || 'No remarks provided'}
                    </div>

                    {entry.extra_hours_note && (
                      <div className="text-slate-500 text-[11px] italic">
                        Limit rule: {entry.extra_hours_note}
                      </div>
                    )}
                  </div>

                  {/* Decision Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 justify-end w-full lg:w-auto">
                    <button
                      id={`btn-approve-all-${entry.id}`}
                      onClick={() => handleApproveAll(entry.id)}
                      className="px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow-xs cursor-pointer transition-colors text-center"
                      title="Both regular and extra hours are approved and paid"
                    >
                      Approve All ({formatDecimalHours(entry.hours)} h)
                    </button>

                    <button
                      id={`btn-regular-only-${entry.id}`}
                      onClick={() => {
                        setDeclineModalEntry(entry);
                        setDeclineReason('');
                      }}
                      className="px-4 py-2 min-h-[40px] bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-medium rounded-lg text-xs cursor-pointer transition-colors text-center"
                      title="Pays regular hours only, declines extra portion with required note"
                    >
                      Approve Regular Only ({formatDecimalHours(entry.regular_hours)} h)
                    </button>

                    <button
                      id={`btn-reject-${entry.id}`}
                      onClick={() => {
                        setRejectModalEntry(entry);
                        setRejectReason('');
                      }}
                      className="px-4 py-2 min-h-[40px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-lg text-xs cursor-pointer transition-colors text-center"
                      title="Reject / decline the entire session (0.00 h payable)"
                    >
                      Reject / Decline Session
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decline Extra Hours Justification Modal */}
      {declineModalEntry && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-slate-900 text-base">
              Decline Extra Hours ({formatDecimalHours(declineModalEntry.extra_hours)} h)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Per specification, <strong>regular hours ({formatDecimalHours(declineModalEntry.regular_hours)}h) will be paid</strong>.
              The extra hours beyond the limit will be declined. A written justification is required for the employee record.
            </p>

            <form onSubmit={handleConfirmDecline} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Justification Note <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g., Overtime was not pre-authorized by project manager; shift concluded at 8.00h standard limit."
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none resize-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                />
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeclineModalEntry(null)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Confirm Regular Hours Only
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject / Decline Entire Session Modal */}
      {rejectModalEntry && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5 shrink-0" />
              <h3 className="font-semibold text-slate-900 text-base">
                Reject / Decline Entire Session
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will reject the entire DTR entry for <strong>{formatDate(rejectModalEntry.work_date)}</strong> ({formatTime(rejectModalEntry.time_in)} → {rejectModalEntry.time_out ? formatTime(rejectModalEntry.time_out) : 'Open'}).
              <strong className="block mt-1 text-rose-700">No hours (0.00 h) will be approved or paid.</strong>
              A written justification is required for the employee record.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Rejection Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g., Wrong filing submitted by employee; incorrect hours or duplicate session."
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none resize-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectModalEntry(null)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  Confirm Reject Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
