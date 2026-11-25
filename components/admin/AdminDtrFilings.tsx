'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { Pagination } from '@/components/common/Pagination';
import {
  Filter,
  Check,
  X,
  Edit,
  Clock,
  AlertTriangle,
  History,
  CheckCircle,
  CheckCircle2,
  FileCheck2,
  Calendar,
  ShieldCheck,
  Info,
  Tag,
  Mail,
} from 'lucide-react';
import {
  formatDecimalHours,
  formatHoursWithClock,
  formatDate,
  formatTime,
  formatDateTime,
  formatMonthYear,
  getRecentMonths,
  generateMonthlyDtrRefTag,
} from '@/lib/utils-dtr';
import { DtrEntry, MonthlySelfApproval } from '@/lib/types';

export function AdminDtrFilings() {
  const {
    visibleUsers,
    dtrEntries,
    payPeriods,
    monthlySelfApprovals,
    serverCurrentDate,
    approveDtrEntry,
    rejectDtrEntry,
    adjustDtrTime,
    timeOutOnBehalf,
    bulkApproveEligible,
  } = useApp();

  const currentMonthStr = (serverCurrentDate || new Date().toISOString().slice(0, 10)).slice(0, 7);

  // Discover available months from entries, approvals, and recent calendar
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    dtrEntries.forEach((e) => {
      if (e.work_date && e.work_date.length >= 7) {
        set.add(e.work_date.slice(0, 7));
      }
    });
    monthlySelfApprovals.forEach((a) => {
      if (a.month) set.add(a.month);
    });
    getRecentMonths(serverCurrentDate, 6, 2).forEach((m) => set.add(m));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [dtrEntries, monthlySelfApprovals, serverCurrentDate]);

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'finalized' | 'pending'>('all');

  // Pagination (Default 25 per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filterKey = `${employeeFilter}|${departmentFilter}|${statusFilter}|${periodFilter}|${monthFilter}|${approvalFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  // Modals
  const [adjustingEntry, setAdjustingEntry] = useState<DtrEntry | null>(null);
  const [newInTime, setNewInTime] = useState('');
  const [newOutTime, setNewOutTime] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const [timingOutEntry, setTimingOutEntry] = useState<DtrEntry | null>(null);
  const [behalfOutTime, setBehalfOutTime] = useState('18:00');
  const [behalfReason, setBehalfReason] = useState('');

  const [rejectingEntry, setRejectingEntry] = useState<DtrEntry | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [viewingRevisionEntry, setViewingRevisionEntry] = useState<DtrEntry | null>(null);
  const [viewingCertificate, setViewingCertificate] = useState<MonthlySelfApproval | null>(null);

  // Departments list
  const departments = Array.from(new Set(visibleUsers.map((u) => u.department)));

  // Helper: Determine if entry is self-approved (directly on record or via monthly approval)
  const isEntrySelfApproved = (entry: DtrEntry): boolean => {
    if (entry.self_approved) return true;
    const month = entry.work_date ? entry.work_date.slice(0, 7) : '';
    const u = visibleUsers.find(
      (user) => user.id === entry.user_id || (user.email && entry.user_id && user.email.toLowerCase() === entry.user_id.toLowerCase())
    );
    return monthlySelfApprovals.some(
      (a) => (a.user_id === entry.user_id || (u && a.user_id === u.id)) && a.month === month
    );
  };

  // Pre-filter count for scope
  const totalInScope = useMemo(() => {
    return dtrEntries.filter((e) => {
      const u = visibleUsers.find(
        (user) => user.id === e.user_id || (user.email && e.user_id && user.email.toLowerCase() === e.user_id.toLowerCase())
      );
      if (!u) return false;
      if (employeeFilter !== 'all' && e.user_id !== employeeFilter && u.id !== employeeFilter) return false;
      if (departmentFilter !== 'all' && u.department !== departmentFilter) return false;
      if (periodFilter !== 'all' && e.pay_period_id !== periodFilter) return false;
      if (monthFilter !== 'all' && !e.work_date.startsWith(monthFilter)) return false;
      return true;
    });
  }, [dtrEntries, visibleUsers, employeeFilter, departmentFilter, periodFilter, monthFilter]);

  const countFinalized = useMemo(() => totalInScope.filter(isEntrySelfApproved).length, [totalInScope, isEntrySelfApproved]);
  const countPending = totalInScope.length - countFinalized;

  // Filter entries
  const filtered = useMemo(() => {
    return dtrEntries
      .filter((e) => {
        const u = visibleUsers.find(
          (user) => user.id === e.user_id || (user.email && e.user_id && user.email.toLowerCase() === e.user_id.toLowerCase())
        );
        if (!u) return false; // Hide entries from hidden users to normal admin
        if (employeeFilter !== 'all' && e.user_id !== employeeFilter && u.id !== employeeFilter) return false;
        if (departmentFilter !== 'all' && u.department !== departmentFilter) return false;
        if (periodFilter !== 'all' && e.pay_period_id !== periodFilter) return false;
        if (monthFilter !== 'all' && !e.work_date.startsWith(monthFilter)) return false;

        const selfApproved = isEntrySelfApproved(e);
        if (approvalFilter === 'finalized' && !selfApproved) return false;
        if (approvalFilter === 'pending' && selfApproved) return false;

        if (statusFilter !== 'all') {
          if (statusFilter === 'open' && e.time_out !== null) return false;
          if (statusFilter !== 'open' && e.status !== statusFilter) return false;
        }
        return true;
      })
      .sort((a, b) => b.work_date.localeCompare(a.work_date) || (b.time_in || '').localeCompare(a.time_in || ''));
  }, [
    dtrEntries,
    visibleUsers,
    employeeFilter,
    departmentFilter,
    periodFilter,
    monthFilter,
    approvalFilter,
    statusFilter,
    isEntrySelfApproved,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedEntries = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, validPage, pageSize]);

  const eligibleForBulk = filtered.filter(
    (e) => ['submitted', 'adjusted'].includes(e.status) && e.extra_hours === 0 && e.extra_hours_status === 'none'
  ).length;

  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const handleBulkApprove = async () => {
    if (isBulkApproving) return;
    setIsBulkApproving(true);
    try {
      const res = await bulkApproveEligible();
      if (res.success) {
        alert(`Bulk approved and saved ${res.count} eligible entries without extra hours.`);
      } else {
        alert(res.message || 'Bulk approval failed to persist.');
      }
    } catch (err: any) {
      alert(`Bulk approval error: ${err?.message || 'Network error'}`);
    } finally {
      setIsBulkApproving(false);
    }
  };

  const handleSingleApprove = async (entryId: string) => {
    if (approvingId) return;
    setApprovingId(entryId);
    try {
      const res = await approveDtrEntry(entryId);
      if (!res.success) {
        alert(res.message);
      }
    } catch (err: any) {
      alert(`Approval error: ${err?.message || 'Network error'}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleConfirmAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingEntry) return;
    const res = adjustDtrTime(adjustingEntry.id, newInTime, newOutTime, adjustReason);
    if (res.success) {
      setAdjustingEntry(null);
      setAdjustReason('');
    } else {
      alert(res.message);
    }
  };

  const handleConfirmTimeoutOnBehalf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timingOutEntry) return;
    const res = timeOutOnBehalf(timingOutEntry.id, behalfOutTime, behalfReason);
    if (res.success) {
      setTimingOutEntry(null);
      setBehalfReason('');
    } else {
      alert(res.message);
    }
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingEntry) return;
    const res = rejectDtrEntry(rejectingEntry.id, rejectReason);
    if (res.success) {
      setRejectingEntry(null);
      setRejectReason('');
    } else {
      alert(res.message);
    }
  };

  // Selected employee approval details
  const selectedUser = employeeFilter !== 'all' ? visibleUsers.find((u) => u.id === employeeFilter) : null;
  const activeMonth = monthFilter !== 'all' ? monthFilter : currentMonthStr;
  const selectedEmployeeApproval = useMemo(() => {
    if (!selectedUser) return null;
    return monthlySelfApprovals.find(
      (a) => (a.user_id === selectedUser.id || (selectedUser.email && a.user_id === selectedUser.email)) && a.month === activeMonth
    );
  }, [monthlySelfApprovals, selectedUser, activeMonth]);

  const selectedEmployeeMonthEntries = useMemo(() => {
    if (!selectedUser) return [];
    return dtrEntries.filter(
      (e) =>
        (e.user_id === selectedUser.id || (selectedUser.email && e.user_id === selectedUser.email)) &&
        e.work_date.startsWith(activeMonth) &&
        e.status !== 'rejected'
    );
  }, [dtrEntries, selectedUser, activeMonth]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Bulk Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            DTR Filings & Timesheet Approvals
          </h1>
          <p className="text-xs text-slate-600">
            Standard timelogs and manual DTR filings are automatically approved upon completion. Admin review is reserved for Extra Hours and Corrections.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            id="btn-bulk-approve"
            onClick={handleBulkApprove}
            disabled={eligibleForBulk === 0 || isBulkApproving}
            className="w-full md:w-auto justify-center inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            title="Bulk approve all submitted entries with no extra hours"
          >
            {isBulkApproving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Saving Approvals...</span>
              </>
            ) : (
              <>
                <FileCheck2 className="w-4 h-4" />
                <span>Bulk Approve ({eligibleForBulk})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selected Employee Month Finalization Status Banner */}
      {selectedUser && (
        <>
          {selectedEmployeeApproval ? (
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-xl p-4 text-white shadow-xs border border-emerald-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h2 className="font-bold text-sm tracking-tight text-white">
                      {formatMonthYear(activeMonth)} DTR Finalized &amp; Self-Approved
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-slate-950 uppercase">
                      <CheckCircle2 className="w-3 h-3 text-slate-950" /> Certified by {selectedUser.first_name}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-white text-emerald-950 font-bold border border-emerald-300 shadow-2xs break-all">
                      <Tag className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                      Ref: {selectedEmployeeApproval.reference_no || selectedEmployeeApproval.employee_note?.match(/\[REF:(.*?)\]/)?.[1] || generateMonthlyDtrRefTag(activeMonth, selectedUser.employee_no, selectedUser.id)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-sans text-[10px] px-2 py-0.5 rounded-full bg-emerald-300 text-emerald-950 font-bold border border-emerald-400">
                      <Mail className="w-2.5 h-2.5 text-emerald-900" />
                      Email Notified
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200 mt-1">
                    {selectedUser.first_name} {selectedUser.last_name} finalized and certified{' '}
                    <strong>{selectedEmployeeApproval.total_hours.toFixed(2)} hours</strong> across{' '}
                    <strong>{selectedEmployeeApproval.entries_count} shifts</strong> on{' '}
                    {new Date(selectedEmployeeApproval.submitted_at).toLocaleString()}.
                    {selectedEmployeeApproval.employee_note && (
                      <span className="italic block mt-0.5 text-emerald-100 font-sans break-words">
                        &ldquo;{selectedEmployeeApproval.employee_note}&rdquo;
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-admin-view-cert"
                onClick={() => setViewingCertificate(selectedEmployeeApproval)}
                className="w-full sm:w-auto justify-center shrink-0 inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg text-xs font-semibold bg-white text-emerald-900 hover:bg-emerald-50 shadow-xs cursor-pointer whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>View Submission Certificate</span>
              </button>
            </div>
          ) : selectedEmployeeMonthEntries.length > 0 ? (
            <div className="bg-amber-50 rounded-xl p-4 text-amber-950 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
              <div className="flex items-start sm:items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <div className="font-semibold text-amber-900 text-sm">
                    {formatMonthYear(activeMonth)} DTR Pending Employee Finalization &amp; Self-Approval
                  </div>
                  <p className="text-amber-800 mt-0.5">
                    {selectedUser.first_name} {selectedUser.last_name} has logged{' '}
                    <strong>{selectedEmployeeMonthEntries.length} shift(s)</strong> (
                    {selectedEmployeeMonthEntries.reduce((s, e) => s + (e.hours || 0), 0).toFixed(2)}h) for{' '}
                    {formatMonthYear(activeMonth)}, but has not yet submitted monthly self-approval.
                    Certified submission will be marked ready here once the employee finalizes the month.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 text-xs">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Employee
          </label>
          <select
            id="filing-filter-employee"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="w-full p-2 min-h-[38px] bg-white border border-slate-300 rounded-lg outline-none"
          >
            <option value="all">All Employees</option>
            {visibleUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Department
          </label>
          <select
            id="filing-filter-department"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full p-2 min-h-[38px] bg-white border border-slate-300 rounded-lg outline-none"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Month
          </label>
          <select
            id="filing-filter-month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full p-2 min-h-[38px] bg-white border border-slate-300 rounded-lg outline-none font-medium text-slate-800"
          >
            <option value="all">All Months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthYear(m)}
              </option>
            ))}
          </select>
        </div> */}

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Pay Period
          </label>
          <select
            id="filing-filter-period"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="w-full p-2 min-h-[38px] bg-white border border-slate-300 rounded-lg outline-none"
          >
            <option value="all">All Periods</option>
            {payPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {formatDate(p.start_date)} – {formatDate(p.end_date)} ({p.frequency})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Timesheet Status
          </label>
          <select
            id="filing-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full p-2 min-h-[38px] bg-white border border-slate-300 rounded-lg outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted (Pending Review)</option>
            <option value="extra_hours_pending">Extra Hours Awaiting Decision</option>
            <option value="open">Currently Open Sessions</option>
            <option value="adjusted">Adjusted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Self-Approval
          </label>
          <select
            id="filing-filter-approval"
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value as any)}
            className="w-full p-2 min-h-[38px] bg-white border border-slate-300 rounded-lg outline-none font-medium text-slate-800"
          >
            <option value="all">All Submissions</option>
            <option value="finalized">Finalized &amp; Self-Approved (Ready)</option>
            <option value="pending">Pending Employee Finalization</option>
          </select>
        </div>
      </div>

      {/* Fast Filter Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 max-w-full">
          <button
            type="button"
            id="tab-all-filings"
            onClick={() => setApprovalFilter('all')}
            className={`px-3 py-1.5 min-h-[36px] whitespace-nowrap shrink-0 rounded-lg font-medium transition-colors cursor-pointer ${
              approvalFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Filings ({totalInScope.length})
          </button>
          <button
            type="button"
            id="tab-finalized-filings"
            onClick={() => setApprovalFilter('finalized')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] whitespace-nowrap shrink-0 rounded-lg font-medium transition-colors cursor-pointer ${
              approvalFilter === 'finalized'
                ? 'bg-emerald-700 text-white'
                : 'bg-white border border-slate-200 text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Finalized &amp; Self-Approved ({countFinalized})</span>
          </button>
          <button
            type="button"
            id="tab-pending-filings"
            onClick={() => setApprovalFilter('pending')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] whitespace-nowrap shrink-0 rounded-lg font-medium transition-colors cursor-pointer ${
              approvalFilter === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-white border border-slate-200 text-amber-800 hover:bg-amber-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Pending Finalization ({countPending})</span>
          </button>
        </div>

        {monthFilter !== 'all' && (
          <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Month: <strong>{formatMonthYear(monthFilter)}</strong></span>
            <button
              type="button"
              onClick={() => setMonthFilter('all')}
              className="text-blue-600 hover:underline text-[11px] ml-1 cursor-pointer"
            >
              (Clear month)
            </button>
          </div>
        )}
      </div>

      {/* DTR Filings Table & Mobile Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Table (kept first in DOM for Playwright desktop selectors) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Work Date</th>
                <th className="py-3 px-4">Time Range</th>
                <th className="py-3 px-4">Total Hours</th>
                <th className="py-3 px-4">Accomplishments</th>
                <th className="py-3 px-4">Status &amp; Verification</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto" />
                      <div className="font-semibold text-slate-700">No filings match the current filter selection</div>
                      <p className="text-xs text-slate-500">
                        {approvalFilter === 'finalized'
                          ? 'No employee has finalized and self-approved DTR logs for this selection yet.'
                          : 'Try adjusting the employee, month, or status filters above.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => {
                  const user = visibleUsers.find(
                    (u) => u.id === entry.user_id || (u.email && entry.user_id && u.email.toLowerCase() === entry.user_id.toLowerCase())
                  );
                  const selfApproved = isEntrySelfApproved(entry);
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {user?.first_name} {user?.last_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {user?.department} • {user?.employee_no}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-800">
                        {formatDate(entry.work_date)}
                      </td>

                      <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-700">
                        {formatTime(entry.time_in)} → {entry.time_out ? formatTime(entry.time_out) : 'Open'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">
                          {entry.time_out ? formatDecimalHours(entry.hours) : '—'} h
                        </div>
                        {entry.extra_hours > 0 && (
                          <div className="text-[10px] text-amber-700 font-medium">
                            {entry.extra_hours.toFixed(2)}h extra
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 max-w-xs text-slate-700">
                        <p className="line-clamp-2 leading-relaxed">
                          {entry.remarks || (entry.time_out ? 'No remarks' : 'In session...')}
                        </p>
                        {entry.revisions && entry.revisions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setViewingRevisionEntry(entry)}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline mt-0.5 cursor-pointer"
                          >
                            <History className="w-3 h-3" /> Has {entry.revisions.length} revision(s)
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              entry.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : entry.status === 'adjusted'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : entry.status === 'extra_hours_pending'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : entry.status === 'open'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse'
                                : entry.status === 'rejected'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {entry.status.toUpperCase()}
                          </span>

                          {selfApproved ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200"
                              title="Employee finalized and self-approved this month"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5 text-teal-600" /> Self-Approved
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                              title="Employee has not yet finalized and self-approved this month"
                            >
                              <Clock className="w-2.5 h-2.5 text-slate-400" /> Pending Finalize
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        {/* If open session: button to Time Out on Behalf */}
                        {entry.status === 'open' && (
                          <button
                            type="button"
                            id={`btn-behalf-timeout-${entry.id}`}
                            onClick={() => {
                              setTimingOutEntry(entry);
                              setBehalfReason('');
                            }}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded font-semibold text-[11px] cursor-pointer"
                          >
                            Time Out on Behalf
                          </button>
                        )}

                        {/* Adjust Times button */}
                        {entry.status !== 'open' && (
                          <button
                            type="button"
                            id={`btn-adjust-${entry.id}`}
                            onClick={() => {
                              setAdjustingEntry(entry);
                              setNewInTime(entry.time_in);
                              setNewOutTime(entry.time_out || '17:00');
                              setAdjustReason('');
                            }}
                            className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded font-medium text-[11px] cursor-pointer"
                            title="Adjust time entry with reason"
                          >
                            Adjust
                          </button>
                        )}

                        {/* Approve button */}
                        {['submitted', 'adjusted'].includes(entry.status) && (
                          <button
                            type="button"
                            id={`btn-approve-${entry.id}`}
                            onClick={() => handleSingleApprove(entry.id)}
                            disabled={approvingId === entry.id || isBulkApproving}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-semibold text-[11px] shadow-xs cursor-pointer transition-colors"
                          >
                            {approvingId === entry.id ? 'Saving...' : 'Approve'}
                          </button>
                        )}

                        {/* Reject button */}
                        {['submitted', 'adjusted', 'extra_hours_pending'].includes(entry.status) && (
                          <button
                            type="button"
                            id={`btn-reject-${entry.id}`}
                            onClick={() => {
                              setRejectingEntry(entry);
                              setRejectReason('');
                            }}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-medium text-[11px] cursor-pointer"
                          >
                            Reject
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Filing Cards */}
        <div className="md:hidden divide-y divide-slate-100 text-xs">
          {filtered.length === 0 ? (
            <div className="py-10 px-4 text-center text-slate-400">
              <div className="max-w-sm mx-auto space-y-2">
                <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="font-semibold text-slate-700">No filings match the current filter selection</div>
                <p className="text-xs text-slate-500">
                  {approvalFilter === 'finalized'
                    ? 'No employee has finalized and self-approved DTR logs for this selection yet.'
                    : 'Try adjusting the employee, month, or status filters above.'}
                </p>
              </div>
            </div>
          ) : (
            paginatedEntries.map((entry) => {
              const user = visibleUsers.find(
                (u) => u.id === entry.user_id || (u.email && entry.user_id && u.email.toLowerCase() === entry.user_id.toLowerCase())
              );
              const selfApproved = isEntrySelfApproved(entry);
              return (
                <div key={entry.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-sm">
                        {user?.first_name} {user?.last_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {user?.department} • {user?.employee_no}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          entry.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : entry.status === 'adjusted'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : entry.status === 'extra_hours_pending'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : entry.status === 'open'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse'
                            : entry.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {entry.status.toUpperCase()}
                      </span>

                      {selfApproved ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          <CheckCircle2 className="w-2.5 h-2.5 text-teal-600" /> Self-Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <Clock className="w-2.5 h-2.5 text-slate-400" /> Pending Finalize
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 grid grid-cols-2 gap-2 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Work Date</span>
                      <span className="font-semibold text-slate-800">{formatDate(entry.work_date)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Total Hours</span>
                      <span className="font-bold text-slate-900">
                        {entry.time_out ? formatDecimalHours(entry.hours) : '—'} h
                      </span>
                      {entry.extra_hours > 0 && (
                        <span className="text-[10px] text-amber-700 font-sans font-medium ml-1">
                          (+{entry.extra_hours.toFixed(2)}h extra)
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/70">
                      <span className="text-[10px] text-slate-400 font-sans block">Time Range</span>
                      <span className="text-slate-700">
                        {formatTime(entry.time_in)} → {entry.time_out ? formatTime(entry.time_out) : 'Open'}
                      </span>
                    </div>
                  </div>

                  <div className="text-slate-700">
                    <p className="leading-relaxed break-words">
                      {entry.remarks || (entry.time_out ? 'No remarks' : 'In session...')}
                    </p>
                    {entry.revisions && entry.revisions.length > 0 && (
                      <button
                        type="button"
                        id={`mobile-view-rev-${entry.id}`}
                        onClick={() => setViewingRevisionEntry(entry)}
                        className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline mt-1 cursor-pointer"
                      >
                        <History className="w-3 h-3" /> Has {entry.revisions.length} revision(s)
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {entry.status === 'open' && (
                      <button
                        type="button"
                        id={`mobile-btn-behalf-timeout-${entry.id}`}
                        onClick={() => {
                          setTimingOutEntry(entry);
                          setBehalfReason('');
                        }}
                        className="flex-1 min-h-[36px] px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-semibold text-xs cursor-pointer"
                      >
                        Time Out on Behalf
                      </button>
                    )}

                    {entry.status !== 'open' && (
                      <button
                        type="button"
                        id={`mobile-btn-adjust-${entry.id}`}
                        onClick={() => {
                          setAdjustingEntry(entry);
                          setNewInTime(entry.time_in);
                          setNewOutTime(entry.time_out || '17:00');
                          setAdjustReason('');
                        }}
                        className="flex-1 min-h-[36px] px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-medium text-xs cursor-pointer"
                      >
                        Adjust
                      </button>
                    )}

                    {['submitted', 'adjusted'].includes(entry.status) && (
                      <button
                        type="button"
                        id={`mobile-btn-approve-${entry.id}`}
                        onClick={() => handleSingleApprove(entry.id)}
                        disabled={approvingId === entry.id || isBulkApproving}
                        className="flex-1 min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold text-xs shadow-xs cursor-pointer transition-colors"
                      >
                        {approvingId === entry.id ? 'Saving...' : 'Approve'}
                      </button>
                    )}

                    {['submitted', 'adjusted', 'extra_hours_pending'].includes(entry.status) && (
                      <button
                        type="button"
                        id={`mobile-btn-reject-${entry.id}`}
                        onClick={() => {
                          setRejectingEntry(entry);
                          setRejectReason('');
                        }}
                        className="flex-1 min-h-[36px] px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-medium text-xs cursor-pointer"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Pagination
          currentPage={validPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          itemLabel="filings"
        />
      </div>

      {/* Adjust Time Modal */}
      {adjustingEntry && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-slate-900 text-base">Adjust Time Entry</h3>
            <form onSubmit={handleConfirmAdjust} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Time In</label>
                  <input
                    type="time"
                    required
                    value={newInTime}
                    onChange={(e) => setNewInTime(e.target.value)}
                    className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Time Out</label>
                  <input
                    type="time"
                    required
                    value={newOutTime}
                    onChange={(e) => setNewOutTime(e.target.value)}
                    className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none font-mono"
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
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Mandatory reason for audit trail..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none resize-none"
                />
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustingEntry(null)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time Out on Behalf Modal */}
      {timingOutEntry && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-slate-900 text-base">Clock Out On Behalf of Employee</h3>
            <p className="text-xs text-slate-600">
              Set the punch-out time for this open session. A permanent audit log will be created.
            </p>
            <form onSubmit={handleConfirmTimeoutOnBehalf} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Punch Out Time</label>
                <input
                  type="time"
                  required
                  value={behalfOutTime}
                  onChange={(e) => setBehalfOutTime(e.target.value)}
                  className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Reason for Proxy Clock Out <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={behalfReason}
                  onChange={(e) => setBehalfReason(e.target.value)}
                  placeholder="e.g., Employee forgot to punch out before leaving premises..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none resize-none"
                />
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTimingOutEntry(null)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Confirm Time Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingEntry && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-slate-900 text-base">Reject DTR Entry</h3>
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
                  placeholder="State reason for rejecting this entry..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none resize-none"
                />
              </div>
              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingEntry(null)}
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

      {/* Revisions Viewer */}
      {viewingRevisionEntry && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-base">Entry Revision History</h3>
              <button
                type="button"
                onClick={() => setViewingRevisionEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {viewingRevisionEntry.revisions.map((rev) => (
                <div key={rev.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">{rev.display_actor}</span>
                    <span className="font-mono">{formatDateTime(rev.changed_at)}</span>
                  </div>
                  <div className="text-[11px] break-words">
                    <span className="text-slate-400">Old:</span> <span className="font-mono text-rose-700">{rev.old_value}</span> →{' '}
                    <span className="text-slate-400">New:</span> <span className="font-mono text-emerald-700">{rev.new_value}</span>
                  </div>
                  <div className="text-slate-800 pt-1 break-words">
                    <strong>Reason:</strong> {rev.reason}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingRevisionEntry(null)}
                className="w-full xs:w-auto px-4 py-2 min-h-[40px] text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Submission Certificate Modal for Admin */}
      {viewingCertificate && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-1 pb-3 border-b border-slate-100">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                Employee DTR Self-Approval Certificate
              </h3>
              <div className="pt-2 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-2xs break-all">
                  <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Ref Tag:{' '}
                    <strong>
                      {(() => {
                        const certUser = visibleUsers.find((u) => u.id === viewingCertificate.user_id);
                        const refMatch = viewingCertificate.employee_note?.match(/\[REF:(.*?)\]/);
                        return (
                          viewingCertificate.reference_no ||
                          (refMatch ? refMatch[1] : null) ||
                          generateMonthlyDtrRefTag(
                            viewingCertificate.month,
                            certUser?.employee_no,
                            viewingCertificate.user_id
                          )
                        );
                      })()}
                    </strong>
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-1 break-all">
                System Record: {viewingCertificate.id}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Employee</span>
                <span className="font-semibold text-slate-900 text-right break-words">
                  {(() => {
                    const certUser = visibleUsers.find((u) => u.id === viewingCertificate.user_id);
                    return certUser
                      ? `${certUser.first_name} ${certUser.last_name} (${certUser.employee_no || 'EMP'})`
                      : viewingCertificate.user_id;
                  })()}
                </span>
              </div>
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Month Period</span>
                <span className="font-semibold text-slate-900 text-right">{formatMonthYear(viewingCertificate.month)}</span>
              </div>
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Attestation Timestamp</span>
                <span className="font-mono text-slate-900 text-right">{new Date(viewingCertificate.submitted_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Certified Shifts</span>
                <span className="font-mono font-semibold text-slate-900 text-right">{viewingCertificate.entries_count} sessions</span>
              </div>
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Total Certified Hours</span>
                <span className="font-mono font-bold text-slate-900 text-right">{viewingCertificate.total_hours.toFixed(2)} h</span>
              </div>
              {viewingCertificate.employee_note && (
                <div className="py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-0.5">Employee Submission Note:</span>
                  <p className="italic text-slate-800 break-words">&ldquo;{viewingCertificate.employee_note}&rdquo;</p>
                </div>
              )}
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
                <strong>Certified Legal Declaration:</strong> The employee formally affirmed that all time-in and time-out punches, hours worked, and accomplishment remarks for {formatMonthYear(viewingCertificate.month)} are accurate and true.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingCertificate(null)}
                className="w-full py-2.5 min-h-[42px] bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
