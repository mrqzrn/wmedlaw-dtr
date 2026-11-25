'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { Pagination } from '@/components/common/Pagination';
import {
  Calendar,
  Filter,
  History,
  Edit2,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  Info,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Send,
  Lock,
  Tag,
  Copy,
  Check,
  Mail,
} from 'lucide-react';
import {
  formatDecimalHours,
  formatHoursWithClock,
  formatMonthYear,
  getMonthDateRange,
  getRecentMonths,
  formatDate,
  formatTime,
  formatDateTime,
  generateMonthlyDtrRefTag,
} from '@/lib/utils-dtr';
import { DtrEntry } from '@/lib/types';

export function EmployeeDtrList({ onNavigateToCorrections }: { onNavigateToCorrections: () => void }) {
  const {
    currentUser,
    currentOpenSession,
    dtrEntries,
    payPeriods,
    monthlySelfApprovals,
    submitMonthlySelfApproval,
    updateRemarks,
    serverCurrentDate,
  } = useApp();

  // Mode: 'month' (Monthly Self-Approval Workflow) vs 'period' (Pay Period view)
  const [filterMode, setFilterMode] = useState<'month' | 'period'>('month');

  // Month selection (defaults to current month YYYY-MM)
  const currentMonthStr = (serverCurrentDate || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Pay period selection
  const userPeriods = payPeriods.filter((p) => p.frequency === (currentUser.pay_frequency || 'monthly'));
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(userPeriods[0]?.id || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Pagination (Default 25 per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filterKey = `${filterMode}|${selectedMonth}|${selectedPeriodId}|${statusFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  // Modal states
  const [activeRevisionEntry, setActiveRevisionEntry] = useState<DtrEntry | null>(null);
  const [editingRemarksEntry, setEditingRemarksEntry] = useState<DtrEntry | null>(null);
  const [editedRemarks, setEditedRemarks] = useState('');
  const [showSelfApproveModal, setShowSelfApproveModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [employeeNote, setEmployeeNote] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // Available months discovered from user entries and recent calendar
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    dtrEntries
      .filter((e) => e.user_id === currentUser.id)
      .forEach((e) => {
        if (e.work_date && e.work_date.length >= 7) {
          set.add(e.work_date.slice(0, 7));
        }
      });
    monthlySelfApprovals
      .filter((a) => a.user_id === currentUser.id)
      .forEach((a) => set.add(a.month));
    getRecentMonths(serverCurrentDate, 5, 1).forEach((m) => set.add(m));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [dtrEntries, monthlySelfApprovals, currentUser.id, serverCurrentDate]);

  // Navigate months
  const handleShiftMonth = (direction: -1 | 1) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + direction, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  // User's entries for the selected month
  const userMonthEntries = useMemo(() => {
    return dtrEntries.filter(
      (e) => e.user_id === currentUser.id && e.work_date.startsWith(selectedMonth) && e.status !== 'rejected'
    );
  }, [dtrEntries, currentUser.id, selectedMonth]);

  // Self-approval state for selected month
  const currentMonthApproval = useMemo(() => {
    return monthlySelfApprovals.find(
      (a) => a.user_id === currentUser.id && a.month === selectedMonth
    );
  }, [monthlySelfApprovals, currentUser.id, selectedMonth]);

  const isMonthSelfApproved = Boolean(currentMonthApproval) || userMonthEntries.some((e) => e.self_approved);

  const monthRefTag = useMemo(() => {
    if (!isMonthSelfApproved) return '';
    return (
      currentMonthApproval?.reference_no ||
      currentMonthApproval?.employee_note?.match(/\[REF:(.*?)\]/)?.[1] ||
      userMonthEntries.find((e) => e.self_approved_ref)?.self_approved_ref ||
      generateMonthlyDtrRefTag(selectedMonth, currentUser.employee_no, currentUser.id)
    );
  }, [isMonthSelfApproved, currentMonthApproval, userMonthEntries, selectedMonth, currentUser.employee_no, currentUser.id]);

  const handleCopyRef = (tag: string) => {
    if (!tag) return;
    try {
      navigator.clipboard.writeText(tag);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2500);
    } catch {}
  };

  // Filter entries based on mode
  const filteredEntries = useMemo(() => {
    return dtrEntries
      .filter((e) => e.user_id === currentUser.id)
      .filter((e) => {
        if (filterMode === 'month') {
          return e.work_date.startsWith(selectedMonth);
        }
        return selectedPeriodId === 'all' ? true : e.pay_period_id === selectedPeriodId;
      })
      .filter((e) => (statusFilter === 'all' ? true : e.status === statusFilter))
      .sort((a, b) => b.work_date.localeCompare(a.work_date) || (b.time_in || '').localeCompare(a.time_in || ''));
  }, [dtrEntries, currentUser.id, filterMode, selectedMonth, selectedPeriodId, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedEntries = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, validPage, pageSize]);

  // Summary hours
  const totalPeriodHours = filteredEntries
    .filter((e) => e.status !== 'rejected')
    .reduce((sum, e) => sum + (e.hours || 0), 0);

  const totalApprovedHours = filteredEntries
    .filter((e) => e.status === 'approved' || e.status === 'locked')
    .reduce((sum, e) => sum + (e.payable_hours || 0), 0);

  const totalExtraHours = filteredEntries
    .filter((e) => e.status !== 'rejected')
    .reduce((sum, e) => sum + (e.extra_hours || 0), 0);

  const handleSaveRemarks = () => {
    if (!editingRemarksEntry) return;
    const res = updateRemarks(editingRemarksEntry.id, editedRemarks);
    if (res.success) {
      setEditingRemarksEntry(null);
      setFeedbackToast({ type: 'success', text: 'Accomplishment remarks updated successfully.' });
      setTimeout(() => setFeedbackToast(null), 4000);
    } else {
      alert(res.message);
    }
  };

  const handleConfirmSelfApprove = async () => {
    if (!attestationChecked) {
      alert('Please check the attestation box confirming the accuracy of your records.');
      return;
    }
    setIsSubmittingApproval(true);
    try {
      const res = await submitMonthlySelfApproval({
        month: selectedMonth,
        employee_note: employeeNote,
      });

      if (res.success) {
        setShowSelfApproveModal(false);
        setEmployeeNote('');
        setAttestationChecked(false);
        const emailMsg = res.admin_recipients && res.admin_recipients.length > 0
          ? ` Administrators (${res.admin_recipients.join(', ')}) have been notified via email.`
          : ' Administrators have been notified via email.';

        setFeedbackToast({
          type: 'success',
          text: `Your DTR records for ${formatMonthYear(selectedMonth)} have been finalized and certified!${emailMsg}`,
        });
        setTimeout(() => setFeedbackToast(null), 6000);
      } else {
        alert(res.message);
      }
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const getStatusBadge = (status: DtrEntry['status'], selfApproved?: boolean, entryRef?: string) => {
    return (
      <div className="flex flex-col gap-1 items-start">
        {status === 'approved' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Approved
          </span>
        )}
        {status === 'adjusted' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Adjusted
          </span>
        )}
        {status === 'extra_hours_pending' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
            Extra Hours Pending
          </span>
        )}
        {status === 'submitted' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Submitted
          </span>
        )}
        {status === 'open' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse">
            Open
          </span>
        )}
        {status === 'rejected' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
            Rejected
          </span>
        )}
        {status === 'locked' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-800 border border-slate-300">
            Locked
          </span>
        )}
        {selfApproved && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {/* <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              <CheckCircle2 className="w-2.5 h-2.5 text-teal-600" /> Finalized
            </span> */}
            {/* {(entryRef || monthRefTag) && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200" title="Finalization Tag Reference">
                <Tag className="w-2.5 h-2.5 text-slate-500" />
                {entryRef || monthRefTag}
              </span>
            )} */}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedbackToast && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackToast.text}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header and Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              My Daily Time Records (DTR)
            </h1>
          </div>
          {/* <p className="text-xs text-slate-600">
            {currentUser.first_name} {currentUser.last_name} • {currentUser.employee_no} •{' '}
            <span className="capitalize">{currentUser.pay_frequency.replace('_', ' ')} cycle</span>
          </p> */}
        </div>

        {/* View mode & Filters */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          {/* Mode Pill Toggle */}
          <div className="grid grid-cols-2 sm:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterMode('month')}
              className={`min-h-8 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                filterMode === 'month'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Month
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('period')}
              className={`min-h-8 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                filterMode === 'period'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Pay Period
            </button>
          </div>

          {filterMode === 'month' ? (
            /* Month Stepper */
            <div className="flex items-center justify-between bg-slate-50 border border-slate-300 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => handleShiftMonth(-1)}
                className="p-2 sm:p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                id="select-dtr-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex-1 text-center sm:text-left text-xs px-2.5 py-1.5 sm:py-1 bg-transparent border-none text-slate-900 font-bold outline-none cursor-pointer"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthYear(m)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleShiftMonth(1)}
                className="p-2 sm:p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="w-full sm:w-auto">
              <select
                id="period-select"
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="w-full sm:w-auto text-xs px-3 py-2 sm:py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none"
              >
                <option value="all">All Pay Periods</option>
                {userPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatDate(p.start_date)} to {formatDate(p.end_date)} ({p.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex items-center gap-2">
            <select
              id="status-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto text-xs px-3 py-2 sm:py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-slate-900 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="adjusted">Adjusted</option>
              <option value="extra_hours_pending">Extra Hours Pending</option>
              <option value="submitted">Submitted</option>
              <option value="open">Open</option>
              <option value="rejected">Rejected</option>
            </select>

            <button
              id="btn-nav-corrections"
              onClick={() => {
                if (isMonthSelfApproved && filterMode === 'month') {
                  setFeedbackToast({
                    type: 'error',
                    text: `Cannot request correction: DTR records for ${formatMonthYear(selectedMonth)} have already been finalized and certified (Ref: ${monthRefTag}).`,
                  });
                  return;
                }
                onNavigateToCorrections();
              }}
              disabled={isMonthSelfApproved && filterMode === 'month'}
              className={`min-h-[36px] text-xs font-semibold px-3 py-2 sm:py-1.5 rounded-lg border transition-all text-center ${
                isMonthSelfApproved && filterMode === 'month'
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'
              }`}
              title={isMonthSelfApproved && filterMode === 'month' ? 'Corrections disabled for finalized month' : 'Request DTR correction'}
            >
              Request Correction
            </button>
          </div>
        </div>
      </div>

      {/* MONTHLY REVIEW & SELF-APPROVAL CARD */}
      {filterMode === 'month' && (
        <div
          className={`rounded-xl p-4 sm:p-5 border shadow-xs transition-all ${
            isMonthSelfApproved
              ? 'bg-gradient-to-r from-emerald-50 via-teal-50/70 to-slate-50 border-emerald-300 text-emerald-950'
              : 'bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border-slate-700 text-white shadow-md'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                  isMonthSelfApproved
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isMonthSelfApproved ? (
                  <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <FileCheck2 className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={`font-bold text-sm sm:text-base tracking-tight ${isMonthSelfApproved ? 'text-emerald-900' : 'text-white'}`}>
                    {formatMonthYear(selectedMonth)} DTR Review & Self-Approval
                  </h2>
                  {isMonthSelfApproved ? (
                    <>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Finalized & Self-Approved
                      </span>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-white text-emerald-950 border border-emerald-300 shadow-2xs break-all">
                        <Tag className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Ref Tag: <strong className="text-emerald-800">{monthRefTag}</strong></span>
                        <button
                          type="button"
                          onClick={() => handleCopyRef(monthRefTag)}
                          className="ml-1 p-0.5 text-emerald-700 hover:text-emerald-900 cursor-pointer shrink-0"
                          title="Copy reference tag"
                        >
                          {copiedRef ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3 text-emerald-600" />}
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-amber-950 uppercase">
                      Action Required
                    </span>
                  )}
                </div>

                <p className={`text-xs mt-1 leading-relaxed max-w-2xl ${isMonthSelfApproved ? 'text-emerald-800' : 'text-slate-300'}`}>
                  {isMonthSelfApproved
                    ? `You finalized and self-approved all DTR records for ${formatMonthYear(
                        selectedMonth
                      )}. `
                    : `Carefully examine your time-in/out records, total hours, and accomplishment remarks for ${formatMonthYear(
                        selectedMonth
                      )}. When ready, submit your monthly self-approval to finalize your logs for payroll processing.`}
                </p>

                {isMonthSelfApproved && currentMonthApproval?.submitted_at && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-mono text-emerald-800">
                    <span>
                      Attested on: <strong>{new Date(currentMonthApproval.submitted_at).toLocaleString()}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 font-sans">
                      <Mail className="w-3 h-3 text-emerald-700" />
                      Admins Notified via Email
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Finalize Button / Certificate Button */}
            <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
              {isMonthSelfApproved ? (
                <button
                  type="button"
                  id="btn-view-certificate"
                  onClick={() => setShowCertificateModal(true)}
                  className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-white text-emerald-900 hover:bg-emerald-100/70 border border-emerald-300 shadow-2xs transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>View Submission Certificate</span>
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-finalize-monthly-dtr"
                  onClick={() => setShowSelfApproveModal(true)}
                  className="w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 shadow-md transition-all cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 fill-slate-950 text-emerald-400" />
                  <span>Finalize & Self-Approve Month</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Shift in Progress Banner */}
      {currentOpenSession && (
        <div className="bg-gradient-to-r from-emerald-950 to-slate-900 rounded-xl p-4 text-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-emerald-800/40">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-white text-sm">Active Working Shift in Progress</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-emerald-950 uppercase animate-pulse">
                  On Duty
                </span>
              </div>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Clocked in at <strong className="font-mono text-emerald-300">{formatTime(currentOpenSession.time_in)}</strong> on{' '}
                <strong className="font-mono text-emerald-300">{formatDate(currentOpenSession.work_date)}</strong>. Your shift is currently accumulating actual work hours.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            {filterMode === 'month' ? 'Shifts in Month' : 'Total Filed Shifts'}
          </span>
          <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono mt-1 block">
            {filteredEntries.length}
          </span>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Total Logged Hours
          </span>
          <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono mt-1 block">
            {formatDecimalHours(totalPeriodHours)} h
          </span>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider block">
            Approved Payable Hours
          </span>
          <span className="text-lg sm:text-xl font-bold text-emerald-700 font-mono mt-1 block">
            {formatDecimalHours(totalApprovedHours)} h
          </span>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wider block">
            Pending / Extra Hours
          </span>
          <span className="text-lg sm:text-xl font-bold text-amber-700 font-mono mt-1 block">
            {formatDecimalHours(Math.max(0, totalPeriodHours - totalApprovedHours))} h
          </span>
        </div>
      </div>

      {/* DTR Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isMonthSelfApproved && (
          <div className="bg-emerald-50/80 border-b border-emerald-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 font-medium">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>
                <strong>Certified Records:</strong> All DTR filings for {formatMonthYear(selectedMonth)} are finalized and locked for payroll processing.
              </span>
            </div>
            <div className="inline-flex items-center gap-1 font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-300">
              <Tag className="w-3 h-3 text-emerald-600" />
              <span>{monthRefTag}</span>
            </div>
          </div>
        )}
        {/* Desktop DTR Table (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">In</th>
                <th className="py-3 px-4">Out</th>
                <th className="py-3 px-4">Hours (Decimal)</th>
                <th className="py-3 px-4">Accomplished Remarks</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal text-slate-800">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <p className="font-medium text-slate-600">
                      No DTR filings recorded for {filterMode === 'month' ? formatMonthYear(selectedMonth) : 'the selected period'}.
                    </p>
                    {availableMonths.length > 0 && availableMonths[0] !== selectedMonth && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Use the month switcher or select a pay period to browse previous records.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium whitespace-nowrap text-slate-900">
                      {formatDate(entry.work_date)}
                    </td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap font-medium text-slate-700">
                      {formatTime(entry.time_in)}
                    </td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap font-medium text-slate-700">
                      {formatTime(entry.time_out)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-900">
                        {entry.time_out ? formatDecimalHours(entry.hours) : '—'}
                      </div>
                      {entry.time_out && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          {formatHoursWithClock(entry.hours).split('(')[1]?.replace(')', '')}
                        </div>
                      )}
                      {entry.extra_hours > 0 && (
                        <div className="text-[10px] text-amber-700 font-medium">
                          + {entry.extra_hours.toFixed(2)}h extra
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs sm:max-w-md text-slate-700">
                      <p className="line-clamp-2 leading-relaxed">
                        {entry.remarks || (entry.time_out ? 'No remarks' : 'Working in progress...')}
                      </p>
                      {entry.extra_hours_note && (
                        <p className="text-[11px] text-amber-800 mt-0.5 italic">
                          Limit note: {entry.extra_hours_note}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(entry.status, entry.self_approved || isMonthSelfApproved, entry.self_approved_ref || monthRefTag)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                      {entry.revisions && entry.revisions.length > 0 && (
                        <button
                          id={`view-rev-${entry.id}`}
                          onClick={() => setActiveRevisionEntry(entry)}
                          className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 font-medium px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 cursor-pointer"
                          title="View administrator adjustment history"
                        >
                          <History className="w-3 h-3" /> Revisions ({entry.revisions.length})
                        </button>
                      )}
                      {!isMonthSelfApproved && !entry.self_approved && entry.status !== 'locked' && entry.status !== 'rejected' && (
                        <button
                          id={`edit-remarks-${entry.id}`}
                          onClick={() => {
                            setEditingRemarksEntry(entry);
                            setEditedRemarks(entry.remarks);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-700 hover:text-slate-900 font-medium px-2 py-1 rounded hover:bg-slate-100 border border-slate-200 cursor-pointer"
                          title="Edit accomplishment remarks"
                        >
                          <Edit2 className="w-3 h-3" /> Remarks
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile DTR Card List (< 768px) */}
        <div className="md:hidden divide-y divide-slate-100 text-xs">
          {filteredEntries.length === 0 ? (
            <div className="py-10 px-4 text-center text-slate-400">
              <p className="font-medium text-slate-600">
                No DTR filings recorded for {filterMode === 'month' ? formatMonthYear(selectedMonth) : 'the selected period'}.
              </p>
              {availableMonths.length > 0 && availableMonths[0] !== selectedMonth && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Use the month switcher or select a pay period to browse previous records.
                </p>
              )}
            </div>
          ) : (
            paginatedEntries.map((entry) => {
              const hasRevisions = entry.revisions && entry.revisions.length > 0;
              const canEditRemarks =
                !isMonthSelfApproved &&
                !entry.self_approved &&
                entry.status !== 'locked' &&
                entry.status !== 'rejected';

              return (
                <div key={entry.id} className="p-3.5 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono font-bold text-slate-900 text-sm">
                        {formatDate(entry.work_date)}
                      </div>
                      <div className="font-mono text-slate-600 text-xs mt-0.5">
                        {formatTime(entry.time_in)} – {entry.time_out ? formatTime(entry.time_out) : 'In Progress'}
                      </div>
                    </div>
                    {getStatusBadge(entry.status, entry.self_approved || isMonthSelfApproved, entry.self_approved_ref || monthRefTag)}
                  </div>

                  {/* Hours Strip */}
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 font-mono">
                    <span className="text-slate-500 font-sans text-[11px]">Duration:</span>
                    <span className="font-bold text-slate-900">
                      {entry.time_out ? `${formatDecimalHours(entry.hours)} hrs` : 'Open Shift'}
                    </span>
                    {entry.time_out && (
                      <span className="text-[11px] text-slate-500">
                        ({formatHoursWithClock(entry.hours).split('(')[1]?.replace(')', '')})
                      </span>
                    )}
                    {entry.extra_hours > 0 && (
                      <span className="ml-auto text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        +{entry.extra_hours.toFixed(2)}h extra
                      </span>
                    )}
                  </div>

                  {/* Remarks */}
                  <div className="text-slate-700 leading-relaxed break-words">
                    <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">Accomplishments:</span>
                    <p>{entry.remarks || (entry.time_out ? 'No remarks' : 'Working in progress...')}</p>
                    {entry.extra_hours_note && (
                      <p className="text-[11px] text-amber-800 mt-1 italic">
                        Limit note: {entry.extra_hours_note}
                      </p>
                    )}
                  </div>

                  {/* Mobile Actions */}
                  {(hasRevisions || canEditRemarks) && (
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      {hasRevisions && (
                        <button
                          id={`mobile-view-rev-${entry.id}`}
                          onClick={() => setActiveRevisionEntry(entry)}
                          className="min-h-8 inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-semibold px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200/70 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" /> Revisions ({entry.revisions.length})
                        </button>
                      )}
                      {canEditRemarks && (
                        <button
                          id={`mobile-edit-remarks-${entry.id}`}
                          onClick={() => {
                            setEditingRemarksEntry(entry);
                            setEditedRemarks(entry.remarks);
                          }}
                          className="min-h-8 inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 font-semibold px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit Remarks
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <Pagination
          currentPage={validPage}
          totalItems={filteredEntries.length}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          itemLabel="entries"
        />
      </div>

      {/* MODAL: Finalize & Self-Approve Month Modal */}
      {showSelfApproveModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Finalize & Self-Approve DTR
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSelfApproveModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Active shift warning */}
            {currentOpenSession && currentOpenSession.work_date.startsWith(selectedMonth) && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Active shift in progress!</strong> You are currently clocked in. Please punch out before finalizing your monthly DTR.
                </span>
              </div>
            )}

            {/* Zero entries warning */}
            {userMonthEntries.length === 0 && (
              <div className="p-3 bg-rose-50 rounded-lg border border-rose-300 text-rose-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>No DTR records filed for {formatMonthYear(selectedMonth)}. You cannot finalize an empty month.</span>
              </div>
            )}

            <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-900 text-sm">
                Summary for {formatMonthYear(selectedMonth)}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">Shifts Logged</span>
                  <span className="font-bold text-slate-900">{userMonthEntries.length} sessions</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block font-sans">Total Hours</span>
                  <span className="font-bold text-slate-900">{formatDecimalHours(totalPeriodHours)} h</span>
                </div>
                <div>
                  <span className="text-emerald-700 text-[10px] block font-sans font-semibold">Payable Hours</span>
                  <span className="font-bold text-emerald-700">{formatDecimalHours(totalApprovedHours)} h</span>
                </div>
              </div>
            </div>

            {/* Employee Attestation Statement */}
            <div className="bg-emerald-50/70 p-3.5 sm:p-4 rounded-xl border border-emerald-200 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-emerald-950 font-medium">
                <input
                  type="checkbox"
                  id="checkbox-attestation"
                  checked={attestationChecked}
                  onChange={(e) => setAttestationChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 shrink-0"
                />
                <span className="leading-relaxed">
                  <strong>Certification & Employee Attestation:</strong> I hereby certify and solemnly declare that I have reviewed all my daily time record (DTR) punches and accomplishment descriptions for <strong>{formatMonthYear(selectedMonth)}</strong>. All entries represent true, complete, and accurate records of actual working time rendered.
                </span>
              </label>
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Optional Notes for Payroll Administration
              </label>
              <textarea
                rows={3}
                placeholder="Add any note or clarification for management regarding this month's logs..."
                value={employeeNote}
                onChange={(e) => setEmployeeNote(e.target.value)}
                className="w-full text-xs p-3 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-emerald-600 resize-none"
              />
            </div>

            {/* Admin Email Notification Advisory */}
            <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200/80 text-[11px] text-blue-900 flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Email Notification to Administrators:</strong> Submitting this self-approval will automatically notify payroll administrators via email with your certified hours breakdown and reference tag for payroll review.
              </div>
            </div>

            <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSelfApproveModal(false)}
                className="w-full xs:w-auto min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-self-approve"
                disabled={
                  !attestationChecked ||
                  userMonthEntries.length === 0 ||
                  isSubmittingApproval ||
                  Boolean(currentOpenSession && currentOpenSession.work_date.startsWith(selectedMonth))
                }
                onClick={handleConfirmSelfApprove}
                className="w-full xs:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs cursor-pointer"
              >
                {isSubmittingApproval ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>
                  {isSubmittingApproval ? 'Submitting & Notifying Admins...' : 'Confirm & Submit Self-Approval'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Submission Certificate Modal */}
      {showCertificateModal && currentMonthApproval && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-1 pb-3 border-b border-slate-100">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                Employee DTR Self-Approval Certificate
              </h3>
              <div className="pt-2 flex items-center justify-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-2xs break-all">
                  <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Ref Tag: {monthRefTag}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyRef(monthRefTag)}
                    className="ml-1 text-emerald-700 hover:text-emerald-900 cursor-pointer shrink-0"
                    title="Copy reference tag"
                  >
                    {copiedRef ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3 text-emerald-600" />}
                  </button>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-1 break-all">
                System Record: {currentMonthApproval.id}
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Employee</span>
                <span className="font-semibold text-slate-900 text-right">{currentUser.first_name} {currentUser.last_name} ({currentUser.employee_no})</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Month Period</span>
                <span className="font-semibold text-slate-900 text-right">{formatMonthYear(currentMonthApproval.month)}</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Attestation Timestamp</span>
                <span className="font-mono text-slate-900 text-right">{new Date(currentMonthApproval.submitted_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Certified Shifts</span>
                <span className="font-mono font-semibold text-slate-900">{currentMonthApproval.entries_count} sessions</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Total Certified Hours</span>
                <span className="font-mono font-bold text-slate-900">{currentMonthApproval.total_hours.toFixed(2)} h</span>
              </div>
              {currentMonthApproval.employee_note && (
                <div className="py-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 break-words">
                  <span className="text-slate-500 block mb-0.5">Employee Note:</span>
                  <p className="text-slate-800 italic">&ldquo;{currentMonthApproval.employee_note}&rdquo;</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowCertificateModal(false)}
                className="w-full xs:w-auto min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Revision History */}
      {activeRevisionEntry && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600 shrink-0" />
                <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                  DTR Revision Audit History
                </h3>
              </div>
              <button
                onClick={() => setActiveRevisionEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Session on <strong>{formatDate(activeRevisionEntry.work_date)}</strong> (
              {formatTime(activeRevisionEntry.time_in)} – {activeRevisionEntry.time_out ? formatTime(activeRevisionEntry.time_out) : 'Open'})
            </div>

            <div className="space-y-3">
              {activeRevisionEntry.revisions.map((rev) => (
                <div key={rev.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-slate-500 text-[11px]">
                    <span className="font-semibold text-slate-700">{rev.display_actor}</span>
                    <span className="font-mono">{formatDateTime(rev.changed_at)}</span>
                  </div>
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Previous value:</span>
                      <span className="font-mono text-rose-700 line-through break-all">{rev.old_value}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Adjusted to:</span>
                      <span className="font-mono text-emerald-700 font-semibold break-all">{rev.new_value}</span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-200/60 text-slate-800 break-words">
                    <strong>Reason for Adjustment:</strong> {rev.reason}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveRevisionEntry(null)}
                className="w-full xs:w-auto min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Remarks */}
      {editingRemarksEntry && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Edit Accomplished Remarks</h3>
              <button
                onClick={() => setEditingRemarksEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You can edit remarks while this record is not locked or finalized.
            </p>

            <textarea
              rows={4}
              value={editedRemarks}
              onChange={(e) => setEditedRemarks(e.target.value)}
              className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none resize-none"
            />

            <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRemarksEntry(null)}
                className="w-full xs:w-auto min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRemarks}
                className="w-full xs:w-auto min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
              >
                Save Remarks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
