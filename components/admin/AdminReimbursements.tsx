'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import {
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Calendar,
  Wallet,
  Search,
  Check,
  X,
  FileText,
  User as UserIcon,
  Building2,
  Paperclip,
  Tag,
  ArrowRight,
  Filter,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { formatDate, formatTime, formatCurrency } from '@/lib/utils-dtr';
import { ReimbursementRequest, ReimbursementStatus, PayPeriod, User } from '@/lib/types';

type EnrichedReimbursement = ReimbursementRequest & { user?: User };

export function AdminReimbursements() {
  const {
    visibleUsers,
    reimbursements,
    approveReimbursement,
    rejectReimbursement,
    payPeriods,
    settings,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Modals state
  const [approvingModal, setApprovingModal] = useState<EnrichedReimbursement | null>(null);
  const [targetPayPeriodId, setTargetPayPeriodId] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const [rejectingModal, setRejectingModal] = useState<EnrichedReimbursement | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currencySymbol = settings.currency_symbol || '₱';

  // Open & active pay periods for payroll crediting
  const openPeriods = useMemo(() => {
    return payPeriods.filter((p) => p.status === 'open' || p.status === 'closed');
  }, [payPeriods]);

  // Enriched reimbursements with user info
  const enrichedReimbursements = useMemo(() => {
    return reimbursements
      .map((r) => {
        const user = visibleUsers.find(
          (u) =>
            u.id === r.user_id ||
            (u.email && u.email.toLowerCase() === r.user_id.toLowerCase()) ||
            (u.employee_no && u.employee_no === r.user_id)
        );
        return {
          ...r,
          user,
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [reimbursements, visibleUsers]);

  // Stats
  const stats = useMemo(() => {
    const pendingList = enrichedReimbursements.filter((r) => r.status === 'pending');
    const pendingSum = pendingList.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const approvedList = enrichedReimbursements.filter((r) => r.status === 'approved');
    const approvedSum = approvedList.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const rejectedList = enrichedReimbursements.filter((r) => r.status === 'rejected');

    return {
      pendingCount: pendingList.length,
      pendingSum,
      approvedCount: approvedList.length,
      approvedSum,
      rejectedCount: rejectedList.length,
      totalCount: enrichedReimbursements.length,
    };
  }, [enrichedReimbursements]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    visibleUsers.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set).sort();
  }, [visibleUsers]);

  // Filtered items
  const filteredList = useMemo(() => {
    return enrichedReimbursements.filter((r) => {
      // Tab filter
      if (activeTab !== 'all' && r.status !== activeTab) return false;

      // Department filter
      if (departmentFilter !== 'all' && r.user?.department !== departmentFilter) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const userName = `${r.user?.first_name || ''} ${r.user?.last_name || ''}`.toLowerCase();
        const empNo = (r.user?.employee_no || '').toLowerCase();
        const title = (r.title || '').toLowerCase();
        const category = (r.category || '').toLowerCase();
        const notes = (r.description || '').toLowerCase();

        const matches =
          userName.includes(q) ||
          empNo.includes(q) ||
          title.includes(q) ||
          category.includes(q) ||
          notes.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [enrichedReimbursements, activeTab, departmentFilter, searchQuery]);

  // Open Approval Confirmation
  const handleOpenApproveModal = (reimb: EnrichedReimbursement) => {
    // Determine default pay period:
    // 1. If reimbursement already has a pay_period_id matching open period, use that
    // 2. Otherwise find open period covering the expense date
    // 3. Otherwise find first open period
    let defaultPeriodId = '';
    if (reimb.pay_period_id && openPeriods.some((p) => p.id === reimb.pay_period_id)) {
      defaultPeriodId = reimb.pay_period_id;
    } else {
      const match = openPeriods.find(
        (p) => p.start_date <= reimb.expense_date && p.end_date >= reimb.expense_date
      );
      if (match) {
        defaultPeriodId = match.id;
      } else if (openPeriods.length > 0) {
        defaultPeriodId = openPeriods[0].id;
      }
    }

    setTargetPayPeriodId(defaultPeriodId);
    setApprovalNote('Approved by Administrator');
    setApprovingModal(reimb);
  };

  // Confirm Approval
  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingModal) return;

    setIsApproving(true);
    setActionFeedback(null);
    try {
      const res = await approveReimbursement(approvingModal.id, {
        payPeriodId: targetPayPeriodId || undefined,
        note: approvalNote.trim(),
      });

      if (res.success) {
        setActionFeedback({ type: 'success', text: res.message });
        setApprovingModal(null);
        setTimeout(() => setActionFeedback(null), 6000);
      } else {
        alert(res.message);
      }
    } finally {
      setIsApproving(false);
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (reimb: EnrichedReimbursement) => {
    setRejectNote('');
    setRejectingModal(reimb);
  };

  // Confirm Rejection
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingModal) return;

    if (!rejectNote.trim()) {
      alert('Please provide a reason for declining this reimbursement.');
      return;
    }

    setIsRejecting(true);
    setActionFeedback(null);
    try {
      const res = await rejectReimbursement(rejectingModal.id, rejectNote.trim());
      if (res.success) {
        setActionFeedback({ type: 'success', text: 'Reimbursement request declined.' });
        setRejectingModal(null);
        setTimeout(() => setActionFeedback(null), 5000);
      } else {
        alert(res.message);
      }
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
              <Receipt className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Reimbursement Requests Queue
            </h1>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Review and adjudicate employee business expense filings. Approving a claim automatically generates and adds an additional payment line to the employee&apos;s payroll disbursement.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            <span>{stats.pendingCount} Pending Review</span>
          </div>
        </div>
      </div>

      {/* Action Feedback Alert */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setActiveTab('pending')}
          className={`bg-white p-3.5 sm:p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
            activeTab === 'pending'
              ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/10'
              : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-amber-800">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-900 mt-2">
            {formatCurrency(stats.pendingSum, currencySymbol)}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            {stats.pendingCount} claim(s) awaiting approval
          </div>
        </div>

        <div
          onClick={() => setActiveTab('approved')}
          className={`bg-white p-3.5 sm:p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
            activeTab === 'approved'
              ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/10'
              : 'border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-emerald-800">Approved into Payroll</span>
            <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-900 mt-2">
            {formatCurrency(stats.approvedSum, currencySymbol)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            {stats.approvedCount} credited to pay periods
          </div>
        </div>

        <div
          onClick={() => setActiveTab('rejected')}
          className={`bg-white p-3.5 sm:p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
            activeTab === 'rejected'
              ? 'border-rose-400 ring-2 ring-rose-400/20 bg-rose-50/10'
              : 'border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-slate-500">Declined Claims</span>
            <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-2">
            {stats.rejectedCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Not credited to employee payroll
          </div>
        </div>

        <div
          onClick={() => setActiveTab('all')}
          className={`bg-white p-3.5 sm:p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
            activeTab === 'all'
              ? 'border-purple-400 ring-2 ring-purple-400/20 bg-purple-50/10'
              : 'border-slate-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-slate-500">All Filing History</span>
            <Receipt className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-2">
            {stats.totalCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total lifetime filings recorded
          </div>
        </div>
      </div>

      {/* Main Filter & Queue Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Pending Review</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'pending' ? 'bg-amber-800 text-amber-100' : 'bg-slate-100 text-slate-700'
              }`}>
                {stats.pendingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('approved')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'approved'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Approved</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'approved' ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-100 text-slate-700'
              }`}>
                {stats.approvedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'rejected'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Declined</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'rejected' ? 'bg-rose-900 text-rose-100' : 'bg-slate-100 text-slate-700'
              }`}>
                {stats.rejectedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({stats.totalCount})
            </button>
          </div>

          {/* Search & Department Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, claim, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Queue Items */}
        {filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">No reimbursement filings found.</p>
            <p className="text-[11px] text-slate-400">
              {activeTab === 'pending'
                ? 'All employee expense claims have been adjudicated.'
                : 'No claims match your filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredList.map((reimb) => {
              const user = reimb.user;
              const matchedPeriod = reimb.pay_period_id
                ? payPeriods.find((p) => p.id === reimb.pay_period_id)
                : null;

              return (
                <div
                  key={reimb.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs hover:bg-slate-50/60 transition-colors"
                >
                  {/* Left: Employee and Details */}
                  <div className="space-y-2.5 min-w-0 flex-1">
                    {/* Employee & Department Bar */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {user?.first_name?.[0] || 'E'}
                      </div>
                      <span className="font-bold text-sm text-slate-900">
                        {user ? `${user.first_name} ${user.last_name}` : 'Unknown Employee'}
                      </span>
                      {user?.employee_no && (
                        <span className="text-[11px] font-mono text-slate-400">
                          ({user.employee_no})
                        </span>
                      )}
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 text-slate-600 font-medium text-[11px]">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{user?.department || 'Staff'}</span>
                      </span>

                      {/* Status indicator badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          reimb.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : reimb.status === 'rejected'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {reimb.status === 'approved' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Approved</span>
                          </>
                        ) : reimb.status === 'rejected' ? (
                          <>
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Declined</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending Review</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Reimbursement Title & Category */}
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        {reimb.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-700 font-medium">
                        {reimb.category}
                      </span>
                    </div>

                    {/* Dates & Reference line */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-[11px]">
                      <span>Expense Date: <strong className="text-slate-700 font-mono">{formatDate(reimb.expense_date)}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Filed: <strong className="text-slate-700 font-mono">{formatDate(reimb.created_at)}</strong></span>
                      {reimb.receipt_url && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                            <Paperclip className="w-3 h-3" />
                            <span>Receipt: {reimb.receipt_url}</span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Description */}
                    {reimb.description && (
                      <p className="text-slate-600 text-xs break-words bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                        <strong className="text-slate-700">Justification:</strong> {reimb.description}
                      </p>
                    )}

                    {/* Status note & Payroll association banner */}
                    {reimb.status === 'approved' && (
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-950 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            Credited to Payroll:{' '}
                            <strong className="underline">
                              {matchedPeriod ? `${matchedPeriod.start_date} to ${matchedPeriod.end_date} (${matchedPeriod.frequency})` : reimb.pay_period_id || 'Pay Period'}
                            </strong>
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800">
                          Reviewed by <strong>{reimb.reviewed_by_name || 'Admin'}</strong> on{' '}
                          {reimb.reviewed_at ? formatDate(reimb.reviewed_at) : ''}
                          {reimb.review_note ? ` — Note: "${reimb.review_note}"` : ''}
                        </p>
                      </div>
                    )}

                    {reimb.status === 'rejected' && reimb.review_note && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs space-y-0.5">
                        <span className="font-semibold text-rose-800">
                          Declined by {reimb.reviewed_by_name || 'Admin'}:
                        </span>
                        <p className="text-[11px] text-rose-700">&ldquo;{reimb.review_note}&rdquo;</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Claim Amount & Adjudication Actions */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                        Reimbursement Amount
                      </span>
                      <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                        {formatCurrency(reimb.amount, currencySymbol)}
                      </span>
                    </div>

                    {reimb.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenRejectModal(reimb)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenApproveModal(reimb)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve &amp; Add to Payroll</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] font-mono text-slate-400">
                        Decision logged
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {approvingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200">
                  <Wallet className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">
                    Approve &amp; Credit to Payroll
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Add reimbursement payment line to employee paycheck
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovingModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmApprove} className="p-5 space-y-4">
              {/* Claim Summary Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Employee:</span>
                  <span className="font-bold text-slate-900">
                    {approvingModal.user?.first_name} {approvingModal.user?.last_name} ({approvingModal.user?.employee_no || approvingModal.user?.department})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Reimbursement:</span>
                  <span className="font-semibold text-slate-900">{approvingModal.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Expense Date:</span>
                  <span className="font-mono text-slate-700">{formatDate(approvingModal.expense_date)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Amount to Credit:</span>
                  <span className="font-bold font-mono text-emerald-700 text-sm">
                    {formatCurrency(approvingModal.amount, currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Target Pay Period Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Credit to Pay Period <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={targetPayPeriodId}
                  onChange={(e) => setTargetPayPeriodId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">Select target pay cycle...</option>
                  {openPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.start_date} to {p.end_date} (Pay Date: {p.pay_date}) — {p.status.toUpperCase()}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  A payment line of <strong>{formatCurrency(approvingModal.amount, currencySymbol)}</strong> will be appended to the employee&apos;s payroll record in this cycle.
                </span>
              </div>

              {/* Administrator Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Approval Note / Audit Memo (Optional)
                </label>
                <input
                  type="text"
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="e.g. Approved with verified receipt OR#123"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Confirmation Notice */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-[11px]">
                  <span className="font-bold">Automatic Payroll Integration:</span>
                  <p className="text-emerald-800">
                    Once confirmed, the employee&apos;s gross and net payout for the selected period will update immediately, reflecting in their payslip and payroll report.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setApprovingModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApproving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isApproving ? 'Crediting...' : 'Confirm Approval & Credit Payroll'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200">
                  <XCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">
                    Decline Reimbursement
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Provide reason for declining this claim
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectingModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                You are declining the claim <strong>&ldquo;{rejectingModal.title}&rdquo;</strong> (
                {formatCurrency(rejectingModal.amount, currencySymbol)}) filed by{' '}
                <strong>{rejectingModal.user?.first_name} {rejectingModal.user?.last_name}</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Decline <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="e.g. Missing official receipts, personal expense not covered by policy..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 resize-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  This explanation will be sent to the employee in their notification.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  <span>{isRejecting ? 'Declining...' : 'Confirm Decline'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
