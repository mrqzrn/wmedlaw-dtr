'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context';
import { FileCheck, Check, X, Clock, AlertCircle } from 'lucide-react';
import { CorrectionRequest } from '@/lib/types';
import { formatDate, formatTime } from '@/lib/utils-dtr';

export function AdminCorrections() {
  const { visibleUsers, corrections, approveCorrection, rejectCorrection, dtrEntries } = useApp();

  const [rejectingModal, setRejectingModal] = useState<CorrectionRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const pendingList = corrections.filter((c) => c.status === 'pending');
  const pastList = corrections.filter((c) => c.status !== 'pending');

  const handleApprove = (id: string) => {
    const res = approveCorrection(id, 'Approved by Administrator');
    if (!res.success) alert(res.message);
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingModal) return;
    const res = rejectCorrection(rejectingModal.id, rejectNote);
    if (res.success) {
      setRejectingModal(null);
      setRejectNote('');
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Correction Requests Queue
            </h1>
          </div>
          <p className="text-xs text-slate-600">
            Adjudicate employee time adjustment filings with side-by-side interval comparisons.
          </p>
        </div>

        <div className="text-xs font-semibold px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 w-full sm:w-auto text-center">
          {pendingList.length} request(s) awaiting review
        </div>
      </div>

      {/* Pending Queue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-900">
          Pending Correction Requests ({pendingList.length})
        </div>

        {pendingList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No pending correction requests.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingList.map((corr) => {
              const user = visibleUsers.find((u) => u.id === corr.user_id);
              const originalEntry = corr.dtr_entry_id
                ? dtrEntries.find((e) => e.id === corr.dtr_entry_id)
                : null;

              return (
                <div key={corr.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-slate-900 text-sm">
                        {user?.first_name} {user?.last_name}
                      </span>
                      <span className="text-slate-400 hidden xs:inline">•</span>
                      <span className="text-slate-500">{user?.department}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-mono text-slate-700 font-medium">{formatDate(corr.work_date)}</span>
                    </div>

                    {/* Side by side comparison */}
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3 max-w-full sm:max-w-md bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans block">Original Recorded</span>
                        <span className="text-slate-700 font-medium">
                          {originalEntry ? `${formatTime(originalEntry.time_in)} – ${originalEntry.time_out ? formatTime(originalEntry.time_out) : 'Open'}` : '(Missing Session)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-blue-600 font-sans font-semibold block">Proposed Correction</span>
                        <span className="text-blue-700 font-bold">
                          {formatTime(corr.requested_time_in)} – {formatTime(corr.requested_time_out)}
                        </span>
                      </div>
                    </div>

                    <div className="text-slate-700 break-words">
                      <strong>Reason for Correction:</strong> {corr.reason}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0 w-full md:w-auto">
                    <button
                      id={`btn-corr-reject-${corr.id}`}
                      onClick={() => {
                        setRejectingModal(corr);
                        setRejectNote('');
                      }}
                      className="px-3 py-2 min-h-[38px] text-xs font-semibold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg shadow-xs cursor-pointer"
                    >
                      Reject Request
                    </button>
                    <button
                      id={`btn-corr-approve-${corr.id}`}
                      onClick={() => handleApprove(corr.id)}
                      className="px-3.5 py-2 min-h-[38px] text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs cursor-pointer"
                    >
                      Approve Correction
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical Queue */}
      {pastList.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-semibold text-xs text-slate-500 uppercase tracking-wider">
            Resolved Requests History ({pastList.length})
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {pastList.slice(0, 5).map((corr) => {
              const user = visibleUsers.find((u) => u.id === corr.user_id);
              return (
                <div key={corr.id} className="p-3.5 sm:p-4 flex flex-col xs:flex-row xs:items-center justify-between gap-2 text-slate-600">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800">
                      {user?.first_name} {user?.last_name}
                    </span>{' '}
                    — {formatDate(corr.work_date)} ({formatTime(corr.requested_time_in)} → {formatTime(corr.requested_time_out)})
                    <div className="text-[11px] text-slate-500 mt-0.5 break-words">
                      {corr.review_note ? `Note: ${corr.review_note}` : corr.reason}
                    </div>
                  </div>
                  <span
                    className={`self-start xs:self-auto shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      corr.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {corr.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-slate-900 text-base">Reject Correction Request</h3>
            <p className="text-xs text-slate-600">
              Provide an explanation to the employee why this proposed time modification cannot be approved.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Rejection Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="e.g., Unable to verify late clock out against git commit or ticket timestamps"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none resize-none"
                />
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingModal(null)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
