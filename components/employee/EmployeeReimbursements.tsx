'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import {
  Receipt,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wallet,
  Calendar,
  FileText,
  DollarSign,
  Tag,
  Car,
  Utensils,
  Laptop,
  Wifi,
  ShoppingBag,
  Paperclip,
  Trash2,
  Check,
  ChevronRight,
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils-dtr';
import { ReimbursementRequest, ReimbursementStatus } from '@/lib/types';

const CATEGORY_OPTIONS = [
  { label: 'Travel & Transportation', icon: Car, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { label: 'Meals & Representation', icon: Utensils, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { label: 'Office & Supplies', icon: ShoppingBag, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { label: 'Internet & Utilities', icon: Wifi, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { label: 'Equipment & Software', icon: Laptop, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { label: 'Other Business Expense', icon: Tag, color: 'text-slate-600 bg-slate-50 border-slate-200' },
];

export function EmployeeReimbursements() {
  const {
    currentUser,
    reimbursements,
    fileReimbursement,
    deleteReimbursement,
    payPeriods,
    serverCurrentDate,
    settings,
  } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].label);
  const [expenseDate, setExpenseDate] = useState(serverCurrentDate || new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReimbursementStatus>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currencySymbol = settings.currency_symbol || '₱';

  // Filter reimbursements for this user
  const userReimbursements = useMemo(() => {
    return reimbursements
      .filter((r) => r.user_id === currentUser.id || (currentUser.email && r.user_id === currentUser.email))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [reimbursements, currentUser]);

  // Statistics
  const stats = useMemo(() => {
    const totalClaimed = userReimbursements.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const pendingList = userReimbursements.filter((r) => r.status === 'pending');
    const pendingAmount = pendingList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const approvedList = userReimbursements.filter((r) => r.status === 'approved');
    const approvedAmount = approvedList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const rejectedList = userReimbursements.filter((r) => r.status === 'rejected');

    return {
      totalClaimed,
      pendingCount: pendingList.length,
      pendingAmount,
      approvedCount: approvedList.length,
      approvedAmount,
      rejectedCount: rejectedList.length,
    };
  }, [userReimbursements]);

  // Filtered list
  const filteredList = useMemo(() => {
    if (statusFilter === 'all') return userReimbursements;
    return userReimbursements.filter((r) => r.status === statusFilter);
  }, [userReimbursements, statusFilter]);

  // Available open pay periods
  const openPeriods = useMemo(() => {
    return payPeriods.filter((p) => p.status === 'open' || p.status === 'closed');
  }, [payPeriods]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Please enter the name of the reimbursement.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0.');
      return;
    }

    if (!expenseDate) {
      setErrorMessage('Please select the date the expense was incurred.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fileReimbursement({
        title: trimmedTitle,
        amount: numAmount,
        category,
        expense_date: expenseDate,
        description: description.trim(),
        receipt_url: receiptUrl.trim() || undefined,
        pay_period_id: selectedPayPeriodId || undefined,
      });

      if (res.success) {
        setShowModal(false);
        setTitle('');
        setAmount('');
        setDescription('');
        setReceiptUrl('');
        setSelectedPayPeriodId('');
        setSuccessMessage('Reimbursement request submitted! Awaiting administrator review.');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this reimbursement request?')) return;
    setDeletingId(id);
    try {
      const res = await deleteReimbursement(id);
      if (!res.success) {
        alert(res.message);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const getCategoryIcon = (catName: string) => {
    const found = CATEGORY_OPTIONS.find((c) => c.label.toLowerCase() === catName.toLowerCase());
    if (found) {
      const Icon = found.icon;
      return <Icon className="w-3.5 h-3.5" />;
    }
    return <Receipt className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
              <Receipt className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Expense Reimbursement Filing
            </h1>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            File claims for out-of-pocket business expenses. Once approved by an administrator, the amount is automatically added as an additional payment to your payroll.
          </p>
        </div>

        <button
          id="btn-file-reimbursement-modal"
          onClick={() => {
            setErrorMessage(null);
            setShowModal(true);
          }}
          className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs cursor-pointer shrink-0 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>File Reimbursement</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-slate-500">Total Claims Filed</span>
            <Receipt className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-2">
            {formatCurrency(stats.totalClaimed, currencySymbol)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {userReimbursements.length} total request(s)
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-amber-800">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-900 mt-2">
            {formatCurrency(stats.pendingAmount, currencySymbol)}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            {stats.pendingCount} awaiting approval
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-emerald-800">Approved for Payroll</span>
            <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-900 mt-2">
            {formatCurrency(stats.approvedAmount, currencySymbol)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            {stats.approvedCount} credited to paychecks
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-slate-500">Declined Claims</span>
            <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-2">
            {stats.rejectedCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Requires amendment or refiling
          </div>
        </div>
      </div>

      {/* Main List Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filter bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-slate-900">Your Reimbursement History</span>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {filteredList.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({userReimbursements.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Pending ({stats.pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'approved'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Approved ({stats.approvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'rejected'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Declined ({stats.rejectedCount})
            </button>
          </div>
        </div>

        {/* Requests List */}
        {filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">No reimbursement requests found.</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              {statusFilter === 'all'
                ? 'You have not submitted any reimbursement claims yet. Click "File Reimbursement" to submit one.'
                : `No requests with status "${statusFilter}".`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredList.map((reimb) => {
              const matchedPeriod = reimb.pay_period_id
                ? payPeriods.find((p) => p.id === reimb.pay_period_id)
                : null;

              return (
                <div
                  key={reimb.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 text-xs hover:bg-slate-50/50 transition-colors"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 tracking-tight">
                        {reimb.title}
                      </span>

                      {/* Category tag */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 font-medium">
                        {getCategoryIcon(reimb.category)}
                        <span>{reimb.category}</span>
                      </span>

                      {/* Status badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          reimb.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : reimb.status === 'rejected'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {reimb.status === 'approved' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Approved &amp; Added to Payroll</span>
                          </>
                        ) : reimb.status === 'rejected' ? (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Declined</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending Administrator Review</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-[11px]">
                      <span>Expense Date: <strong className="text-slate-700 font-mono">{formatDate(reimb.expense_date)}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Filed: <strong className="text-slate-700 font-mono">{formatDate(reimb.created_at)}</strong></span>
                      {reimb.receipt_url && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <Paperclip className="w-3 h-3" />
                            <span>Ref: {reimb.receipt_url}</span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Description note */}
                    {reimb.description && (
                      <p className="text-slate-600 text-xs break-words bg-slate-50 p-2 rounded-lg border border-slate-150">
                        {reimb.description}
                      </p>
                    )}

                    {/* Admin review note & payroll credit notification */}
                    {reimb.status === 'approved' && (
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-900 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            Credited into Payroll Cycle:{' '}
                            <strong className="underline">
                              {matchedPeriod ? `${matchedPeriod.start_date} to ${matchedPeriod.end_date}` : reimb.pay_period_id || 'Current Pay Period'}
                            </strong>
                          </span>
                        </div>
                        {reimb.review_note && (
                          <p className="text-[11px] text-emerald-700">
                            Note from {reimb.reviewed_by_name || 'Admin'}: &ldquo;{reimb.review_note}&rdquo;
                          </p>
                        )}
                      </div>
                    )}

                    {reimb.status === 'rejected' && reimb.review_note && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs space-y-0.5">
                        <div className="font-semibold text-rose-800 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Declined by {reimb.reviewed_by_name || 'Administrator'}</span>
                        </div>
                        <p className="text-[11px] text-rose-700">
                          Reason: {reimb.review_note}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right side: Amount & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Claim Amount</span>
                      <span className="text-lg sm:text-xl font-bold font-mono text-slate-900">
                        {formatCurrency(reimb.amount, currencySymbol)}
                      </span>
                    </div>

                    {reimb.status === 'pending' && (
                      <button
                        onClick={() => handleCancelRequest(reimb.id)}
                        disabled={deletingId === reimb.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md cursor-pointer transition-colors"
                        title="Cancel this pending reimbursement claim"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Cancel Claim</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* File Reimbursement Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">
                    File Expense Reimbursement
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Submit claim for admin review and payroll inclusion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Reimbursement Name / Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Name / Title of Reimbursement <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Taxi fare to client meeting, Office stationery, Internet backup"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Give a concise, descriptive name for the expense.
                </span>
              </div>

              {/* Amount & Expense Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount ({currencySymbol}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 text-xs font-mono font-semibold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expense Incurred Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expense Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORY_OPTIONS.map((cat) => {
                    const isSelected = category === cat.label;
                    const Icon = cat.icon;
                    return (
                      <button
                        type="button"
                        key={cat.label}
                        onClick={() => setCategory(cat.label)}
                        className={`flex items-center gap-1.5 p-2 rounded-lg text-left text-[11px] font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-50 text-purple-900 border-purple-400 ring-1 ring-purple-400'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-purple-600' : 'text-slate-400'}`} />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Pay Period (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Payroll Cycle (Optional)
                </label>
                <select
                  value={selectedPayPeriodId}
                  onChange={(e) => setSelectedPayPeriodId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                >
                  <option value="">Auto-assign to matching open pay cycle</option>
                  {openPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.start_date} to {p.end_date} ({p.frequency} - {p.status.toUpperCase()})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Select which pay cycle you would like this reimbursement included in.
                </span>
              </div>

              {/* Receipt Reference / URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receipt / Invoice Reference (Optional)
                </label>
                <input
                  type="text"
                  value={receiptUrl}
                  onChange={(e) => setReceiptUrl(e.target.value)}
                  placeholder="e.g. Official Receipt OR# 98214, or shared drive link"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Notes / Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description &amp; Business Purpose (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly state the business justification, attendees, or items purchased..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Claim'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
