'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  X,
  Wallet,
  DollarSign,
  RefreshCw,
  Building2,
  FileCheck2,
  FileText,
} from 'lucide-react';
import {
  formatDecimalHours,
  formatHoursWithClock,
  formatDate,
  formatTime,
  formatCurrency,
} from '@/lib/utils-dtr';
import { PayPeriod, PaymentRecord } from '@/lib/types';
import { EmployeePayslipModal } from './EmployeePayslipModal';

export function EmployeePayments() {
  const {
    currentUser,
    payments,
    payPeriods,
    dtrEntries,
    settings,
    session,
    refreshRemotePayments,
    refreshRemotePayPeriods,
    refreshRemoteDtrEntries,
  } = useApp();

  const [selectedPayslipPeriod, setSelectedPayslipPeriod] = useState<PayPeriod | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currencySymbol = settings.currency_symbol || '₱';

  // Automatically refresh payments, periods, and DTR entries on mount and whenever session token is available
  useEffect(() => {
    const token = session?.access_token;
    if (token) {
      refreshRemotePayments?.(token);
      refreshRemotePayPeriods?.(token);
      refreshRemoteDtrEntries?.(token);
    } else {
      refreshRemotePayments?.();
      refreshRemotePayPeriods?.();
      refreshRemoteDtrEntries?.();
    }
  }, [session?.access_token, refreshRemotePayments, refreshRemotePayPeriods, refreshRemoteDtrEntries]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const token = session?.access_token;
      await Promise.allSettled([
        refreshRemotePayments?.(token),
        refreshRemotePayPeriods?.(token),
        refreshRemoteDtrEntries?.(token),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Robust user matching function supporting UUID, email, and employee number
  const isMatchUser = (targetUserId?: string | null) => {
    if (!targetUserId || !currentUser) return false;
    const tid = targetUserId.trim().toLowerCase();
    if (currentUser.id && currentUser.id.toLowerCase() === tid) return true;
    if (currentUser.email && currentUser.email.toLowerCase() === tid) return true;
    if (currentUser.employee_no && currentUser.employee_no.toLowerCase() === tid) return true;
    return false;
  };

  // User's payment records (matching by UUID, email, or employee_no)
  const userPayments = payments.filter((p) => isMatchUser(p.user_id));

  // Display only pay cycles that are closed (or locked) or have been paid
  const userPeriods = payPeriods
    .filter(
      (p) =>
        p.frequency === (currentUser.pay_frequency || 'monthly') ||
        userPayments.some(
          (pay) =>
            pay.pay_period_id === p.id ||
            (pay.month && p.start_date.startsWith(pay.month))
        )
    )
    .filter((period) => {
      const record = userPayments.find(
        (p) =>
          p.pay_period_id === period.id ||
          (p.month && period.start_date.startsWith(p.month))
      );
      const isClosed = period.status === 'closed' || period.status === 'locked';
      const isPaid = record?.status === 'paid';
      return isClosed || isPaid;
    });

  // Entries and record for selected payslip period
  const payslipEntries = selectedPayslipPeriod
    ? dtrEntries.filter(
        (e) =>
          isMatchUser(e.user_id) &&
          (e.pay_period_id === selectedPayslipPeriod.id ||
            (e.work_date >= selectedPayslipPeriod.start_date && e.work_date <= selectedPayslipPeriod.end_date)) &&
          e.status !== 'rejected'
      )
    : [];

  const payslipRecord = selectedPayslipPeriod
    ? userPayments.find(
        (p) =>
          p.pay_period_id === selectedPayslipPeriod.id ||
          (p.month && selectedPayslipPeriod.start_date.startsWith(p.month))
      ) ||
      payments.find(
        (p) =>
          isMatchUser(p.user_id) &&
          (p.pay_period_id === selectedPayslipPeriod.id ||
            (p.month && selectedPayslipPeriod.start_date.startsWith(p.month)))
      ) ||
      null
    : null;

  // Stat summary calculations
  const totalPaidEarnings = userPayments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.gross_amount || 0), 0);

  const totalPaidHours = userPayments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.total_hours || 0), 0);

  // Most recent payment or active period
  const latestPayment = userPayments.find((p) => p.status === 'paid');

  const getStatusBadge = (status: PaymentRecord['status']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Paid
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" /> Processing
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" /> On Hold
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Pay Period &amp; Earnings
            </h1>
          </div>
          <p className="text-xs text-slate-600">
            View your approved hours, computed earnings, disbursement status, and official employee payslips across pay cycles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            id="btn-refresh-payments"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="min-h-9 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
            title="Refresh payment and earnings data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          {/* <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs text-emerald-800 flex items-center gap-2 font-medium">
            <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Base Wage: <strong>{formatCurrency(currentUser.hourly_rate || 0, currencySymbol)}/hr</strong></span>
          </div> */}

          <div className="flex bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 items-center gap-2 font-medium min-w-0">
            <CreditCard className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate">
              Payout:{' '}
              {currentUser.bank_name ? (
                <strong className="text-slate-900">
                  {currentUser.bank_name} {currentUser.account_no ? `(${currentUser.account_no})` : ''}
                </strong>
              ) : (
                <span className="text-amber-700 font-normal">Not configured</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-medium">Total Paid Earnings</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 truncate">
            {formatCurrency(totalPaidEarnings, currencySymbol)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Across {formatDecimalHours(totalPaidHours)} total settled hours
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-medium">Latest Paid Cycle</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 truncate">
            {latestPayment ? formatCurrency(latestPayment.gross_amount, currencySymbol) : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {latestPayment?.paid_at ? (
              <span className="text-emerald-700 font-medium">
                Paid on {formatDate(latestPayment.paid_at)}
              </span>
            ) : (
              'No paid disbursements recorded yet'
            )}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-medium">Current Hourly Rate</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 truncate">
            {formatCurrency(currentUser.hourly_rate || 0, currencySymbol)}
            <span className="text-xs font-normal text-slate-500">/hr</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 capitalize">
            {currentUser.pay_frequency || 'monthly'} payout schedule
          </p>
        </div>
      </div>

      {/* Pay Periods Table / Mobile Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Pay Cycles &amp; Disbursement History ({userPeriods.length})
          </h2>
          <span className="text-[11px] text-slate-500">
            Payouts processed via direct bank transfer
          </span>
        </div>

        {/* Desktop Table (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Pay Period Range</th>
                <th className="py-3 px-4">Approved Hours</th>
                <th className="py-3 px-4">Wage Breakdown</th>
                <th className="py-3 px-4">Gross Payable</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4">Disbursement Info</th>
                <th className="py-3 px-4 text-right">Payslip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
              {userPeriods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center text-slate-400">
                    <p className="font-medium text-slate-500">No closed or paid pay cycles found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Pay cycles will appear here once they are closed or disbursement is completed.
                    </p>
                  </td>
                </tr>
              ) : (
                userPeriods.map((period) => {
                const record = userPayments.find(
                  (p) =>
                    p.pay_period_id === period.id ||
                    (p.month && period.start_date.startsWith(p.month))
                );

                // Calculate approved & pending hours from DTR entries for this period
                const periodEntries = dtrEntries.filter(
                  (e) =>
                    isMatchUser(e.user_id) &&
                    (e.pay_period_id === period.id ||
                      (e.work_date >= period.start_date && e.work_date <= period.end_date)) &&
                    e.status !== 'rejected'
                );

                const computedApprovedHours = periodEntries
                  .filter((e) => e.status === 'approved' || e.status === 'locked')
                  .reduce((sum, e) => sum + (e.payable_hours || 0), 0);

                const pendingHours = periodEntries
                  .filter((e) => ['submitted', 'adjusted', 'extra_hours_pending', 'open'].includes(e.status))
                  .reduce((sum, e) => sum + (e.hours || 0), 0);

                // Authoritative approved hours from generated payroll record, falling back to computed DTR hours
                const totalApprovedHours = record?.total_hours != null
                  ? record.total_hours
                  : computedApprovedHours;

                // Status priority: generated payment status, else pending
                const status = record?.status || (computedApprovedHours > 0 ? 'pending' : 'pending');

                // Gross amount: from payment record if generated, else calculated preview
                const grossAmount = record?.gross_amount != null
                  ? record.gross_amount
                  : Math.round(totalApprovedHours * (currentUser.hourly_rate || 0) * 100) / 100;

                return (
                  <tr key={period.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono font-medium text-slate-900">
                        {formatDate(period.start_date)} → {formatDate(period.end_date)}
                      </div>
                      <div className="text-[11px] text-slate-500 capitalize">
                        {period.frequency.replace('_', ' ')} cycle
                        {period.status === 'closed' && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                            Closed
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      <div className="font-bold text-emerald-700">
                        {formatDecimalHours(totalApprovedHours)} h
                      </div>
                      {pendingHours > 0 && (
                        <div className="text-[10px] text-amber-700 font-semibold">
                          +{formatDecimalHours(pendingHours)} h awaiting approval
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                      {record?.lines && record.lines.length > 0 ? (
                        <div className="space-y-1">
                          {record.lines.map((line, idx) => (
                            line.line_type === 'hours' ? (
                              <div key={idx} className="text-[11px] font-mono">
                                {formatDecimalHours(line.hours)}h @ {formatCurrency(line.hourly_rate, currencySymbol)} = {formatCurrency(line.amount, currencySymbol)}
                              </div>
                            ) : (
                              <div key={idx} className="text-[11px] font-mono text-emerald-700 font-medium">
                                + {formatCurrency(line.amount, currencySymbol)} ({line.category || line.description || 'Allowance'})
                              </div>
                            )
                          ))}
                        </div>
                      ) : totalApprovedHours > 0 ? (
                        <div className="text-[11px] font-mono">
                          {formatDecimalHours(totalApprovedHours)}h @ {formatCurrency(currentUser.hourly_rate || 0, currencySymbol)} = {formatCurrency(grossAmount, currencySymbol)}
                        </div>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-400">
                          @ {formatCurrency(currentUser.hourly_rate || 0, currencySymbol)}/hr
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap text-sm">
                      {grossAmount > 0 ? (
                        <span className="text-emerald-700">
                          {formatCurrency(grossAmount, currencySymbol)}
                          {!record && <span className="text-[10px] text-slate-500 font-normal ml-1">(Est.)</span>}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(status)}
                      {record?.status === 'on_hold' && record.status_reason && (
                        <div className="text-[11px] text-amber-800 mt-1 font-medium">
                          Note: {record.status_reason}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {status === 'paid' && record?.paid_at ? (
                        <div className="space-y-0.5">
                          <div className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1.5 flex-wrap">
                            <span>Paid on {formatDate(record.paid_at)}</span>
                            {period.pay_date && (
                              record.paid_at.slice(0, 10) < period.pay_date ? (
                                <span
                                  className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200"
                                  title={`Disbursed in advance ahead of scheduled ${formatDate(period.pay_date)}`}
                                >
                                  Advanced Payout
                                </span>
                              ) : record.paid_at.slice(0, 10) > period.pay_date ? (
                                // <span
                                //   className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-200"
                                //   title={`Disbursed on adjusted date after scheduled ${formatDate(period.pay_date)}`}
                                // >
                                //   Adjusted Payout
                                // </span>
                                <span></span>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  On Schedule
                                </span>
                              )
                            )}
                          </div>
                          {record?.reference_no && (
                            <div className="text-[11px] text-slate-600 font-mono">
                              Ref: {record.reference_no}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-600 text-[11px]">
                          Scheduled: <strong className="font-mono text-slate-800">{formatDate(period.pay_date)}</strong>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        id={`btn-view-payslip-${period.id}`}
                        onClick={() => setSelectedPayslipPeriod(period)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                        title="View employee payslip statement"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Payslip</span>
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                      </button>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {/* Mobile Pay Cycle Card List (< 768px) */}
        <div className="md:hidden divide-y divide-slate-100 text-xs">
          {userPeriods.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400">
              <p className="font-medium text-slate-500">No closed or paid pay cycles found</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Pay cycles will appear here once they are closed or disbursement is completed.
              </p>
            </div>
          ) : (
            userPeriods.map((period) => {
              const record = userPayments.find(
                (p) =>
                  p.pay_period_id === period.id ||
                  (p.month && period.start_date.startsWith(p.month))
              );

              const periodEntries = dtrEntries.filter(
                (e) =>
                  isMatchUser(e.user_id) &&
                  (e.pay_period_id === period.id ||
                    (e.work_date >= period.start_date && e.work_date <= period.end_date)) &&
                  e.status !== 'rejected'
              );

              const computedApprovedHours = periodEntries
                .filter((e) => e.status === 'approved' || e.status === 'locked')
                .reduce((sum, e) => sum + (e.payable_hours || 0), 0);

              const pendingHours = periodEntries
                .filter((e) => ['submitted', 'adjusted', 'extra_hours_pending', 'open'].includes(e.status))
                .reduce((sum, e) => sum + (e.hours || 0), 0);

              const totalApprovedHours = record?.total_hours != null
                ? record.total_hours
                : computedApprovedHours;

              const status = record?.status || 'pending';

              const grossAmount = record?.gross_amount != null
                ? record.gross_amount
                : Math.round(totalApprovedHours * (currentUser.hourly_rate || 0) * 100) / 100;

              return (
                <div key={period.id} className="p-3.5 space-y-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-900">
                        {formatDate(period.start_date)} → {formatDate(period.end_date)}
                      </div>
                      <div className="text-[11px] text-slate-500 capitalize mt-0.5">
                        {period.frequency.replace('_', ' ')} cycle
                        {period.status === 'closed' && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                            Closed
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">{getStatusBadge(status)}</div>
                  </div>

                  {/* Hours & Gross Grid */}
                  <div className="grid grid-cols-2 gap-2.5 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                        Approved Hours
                      </span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        {formatDecimalHours(totalApprovedHours)} h
                      </span>
                      {pendingHours > 0 && (
                        <span className="text-[10px] text-amber-700 font-semibold block">
                          +{formatDecimalHours(pendingHours)}h pending
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                        Gross Payable
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {grossAmount > 0 ? formatCurrency(grossAmount, currencySymbol) : '—'}
                      </span>
                      {!record && grossAmount > 0 && (
                        <span className="text-[10px] text-slate-500 block">(Estimated)</span>
                      )}
                    </div>
                  </div>

                  {/* Wage Breakdown & Disbursement Info */}
                  <div className="space-y-1.5 text-[11px] text-slate-600">
                    {record?.lines && record.lines.length > 0 ? (
                      <div className="space-y-0.5">
                        {record.lines.map((line, idx) =>
                          line.line_type === 'hours' ? (
                            <div key={idx} className="font-mono">
                              {formatDecimalHours(line.hours)}h @ {formatCurrency(line.hourly_rate, currencySymbol)} = {formatCurrency(line.amount, currencySymbol)}
                            </div>
                          ) : (
                            <div key={idx} className="font-mono text-emerald-700 font-medium">
                              + {formatCurrency(line.amount, currencySymbol)} ({line.category || line.description || 'Allowance'})
                            </div>
                          )
                        )}
                      </div>
                    ) : totalApprovedHours > 0 ? (
                      <div className="font-mono">
                        {formatDecimalHours(totalApprovedHours)}h @ {formatCurrency(currentUser.hourly_rate || 0, currencySymbol)} = {formatCurrency(grossAmount, currencySymbol)}
                      </div>
                    ) : null}

                    {record?.status === 'on_hold' && record.status_reason && (
                      <div className="text-amber-800 font-medium">
                        Hold Note: {record.status_reason}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      {status === 'paid' && record?.paid_at ? (
                        <>
                          <span className="text-emerald-700 font-semibold">
                            Paid on {formatDate(record.paid_at)}
                          </span>
                          {record.reference_no && (
                            <span className="font-mono text-slate-500 break-all">
                              Ref: {record.reference_no}
                            </span>
                          )}
                        </>
                      ) : (
                        <span>
                          Scheduled Pay Date: <strong className="font-mono text-slate-800">{formatDate(period.pay_date)}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    id={`mobile-btn-view-payslip-${period.id}`}
                    onClick={() => setSelectedPayslipPeriod(period)}
                    className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>View Official Payslip</span>
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Official Employee Payslip Modal */}
      <EmployeePayslipModal
        isOpen={!!selectedPayslipPeriod}
        onClose={() => setSelectedPayslipPeriod(null)}
        period={selectedPayslipPeriod}
        user={currentUser}
        record={payslipRecord}
        entries={payslipEntries}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
