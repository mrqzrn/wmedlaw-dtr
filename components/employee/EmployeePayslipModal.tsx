'use client';

import React, { useRef } from 'react';
import {
  FileText,
  Printer,
  X,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wallet,
  CreditCard,
  ShieldCheck,
  Calendar,
  User as UserIcon,
  Briefcase,
  Layers,
} from 'lucide-react';
import { PayPeriod, PaymentRecord, DtrEntry, User } from '@/lib/types';
import {
  formatDecimalHours,
  formatDate,
  formatTime,
  formatCurrency,
} from '@/lib/utils-dtr';

interface EmployeePayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: PayPeriod | null;
  user: User;
  record: PaymentRecord | null;
  entries: DtrEntry[];
  currencySymbol?: string;
}

export function EmployeePayslipModal({
  isOpen,
  onClose,
  period,
  user,
  record,
  entries,
  currencySymbol = '₱',
}: EmployeePayslipModalProps) {
  const printableRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !period) return null;

  // Filter approved entries for this period
  const approvedEntries = entries.filter(
    (e) => e.status === 'approved' || e.status === 'locked'
  );

  const computedApprovedHours = approvedEntries.reduce(
    (sum, e) => sum + (e.payable_hours || 0),
    0
  );

  // Total approved hours from generated payment record if available, otherwise computed
  const totalApprovedHours =
    record?.total_hours != null ? record.total_hours : computedApprovedHours;

  const baseRate =
    user.hourly_rate ||
    (record?.lines?.find((l) => l.line_type === 'hours')?.hourly_rate) ||
    (record && record.total_hours > 0
      ? record.gross_amount / record.total_hours
      : 300);

  // Total payroll amount (gross / net payable)
  const totalPayroll =
    record?.gross_amount != null
      ? record.gross_amount
      : Math.round(totalApprovedHours * baseRate * 100) / 100;

  // Reference number
  const payslipRefNo =
    record?.reference_no ||
    `PS-${period.start_date.replace(/-/g, '')}-${user.employee_no || user.id.slice(0, 5).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: PaymentRecord['status']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Disbursed / Paid
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> Processing Payout
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> On Hold
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-600" /> Pending Payout
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl sm:my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[94dvh] sm:max-h-[92dvh] overflow-hidden pb-safe">
        {/* Top Control Bar (Hidden from print) */}
        <div className="no-print px-3.5 sm:px-6 py-3 sm:py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">
              Employee Payslip View
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              id="btn-print-payslip"
              type="button"
              onClick={handlePrint}
              className="min-h-8 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Print or Save Payslip as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden xs:inline">Print / Save PDF</span>
              <span className="xs:hidden">Print / PDF</span>
            </button>
            <button
              id="btn-close-payslip-top"
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Close Payslip"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Payslip Document (Printable area) */}
        <div
          id="printable-payslip"
          ref={printableRef}
          className="p-4 sm:p-8 overflow-y-auto space-y-5 sm:space-y-6 bg-white text-slate-900"
        >
          {/* Company Branding & Payslip Header */}
          <div className="border-b-2 border-slate-900 pb-4 sm:pb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 p-1 shadow-xs">
                  <img
                    src="/wmedlaw_logo.jpeg"
                    alt="WMedlaw Official Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                    WMedlaw
                  </h1>
                </div>
              </div>
            </div>

            <div className="sm:text-right space-y-1">
              <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                Official Payroll Statement
              </span>
              <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                PAYSLIP
              </div>
              <div className="text-xs text-slate-500 font-mono break-all">
                Ref No: <span className="font-semibold text-slate-700">{payslipRefNo}</span>
              </div>
            </div>
          </div>

          {/* Key Identification Cards: Employee & Cut-Off Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Employee Information */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 text-[11px] pb-1.5 border-b border-slate-200">
                <UserIcon className="w-3.5 h-3.5 text-slate-600" />
                <span>Employee Information</span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-3 print:grid-cols-3 gap-0.5 xs:gap-1 items-center">
                <span className="text-slate-500">Employee Name:</span>
                <span className="xs:col-span-2 print:col-span-2 font-bold text-slate-900 text-sm">
                  {user.first_name} {user.last_name}
                </span>
              </div>

              {user.employee_no && (
                <div className="grid grid-cols-1 xs:grid-cols-3 print:grid-cols-3 gap-0.5 xs:gap-1 items-center">
                  <span className="text-slate-500">Employee ID:</span>
                  <span className="xs:col-span-2 print:col-span-2 font-mono font-bold text-slate-800">
                    {user.employee_no}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 xs:grid-cols-3 print:grid-cols-3 gap-0.5 xs:gap-1 items-center">
                <span className="text-slate-500">Position:</span>
                <span className="xs:col-span-2 print:col-span-2 font-semibold text-slate-800">
                  {user.position || 'Staff'}
                </span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-3 print:grid-cols-3 gap-0.5 xs:gap-1 items-center">
                <span className="text-slate-500">Department:</span>
                <span className="xs:col-span-2 print:col-span-2 font-semibold text-slate-800">
                  {user.department || 'Legal Operations'}
                </span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-3 print:grid-cols-3 gap-0.5 xs:gap-1 items-center">
                <span className="text-slate-500">Hourly Rate:</span>
                <span className="xs:col-span-2 print:col-span-2 font-mono font-semibold text-slate-800">
                  {formatCurrency(baseRate, currencySymbol)}/hr
                </span>
              </div>

            </div>

            {/* Pay Period & Cut-Off Details */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-500 text-[11px] pb-1.5 border-b border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                <span>Cut-off &amp; Disbursement Dates</span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-3 print:grid-cols-3 gap-0.5 xs:gap-1 items-center">
                <span className="text-slate-500">Cut-off Period:</span>
                <span className="xs:col-span-2 print:col-span-2 font-mono text-slate-800">
                  {formatDate(period.start_date)} → {formatDate(period.end_date)}
                </span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-3 print:grid-cols-3 gap-0.5 xs:gap-1 items-center">
                <span className="text-slate-500">Payment Date:</span>
                <span className="xs:col-span-2 print:col-span-2 font-bold text-slate-900 font-mono">
                  {formatDate(period.pay_date)}
                </span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-3 print:grid-cols-3 gap-0.5 xs:gap-1 items-center">
                <span className="text-slate-500">Payment Status:</span>
                <div className="xs:col-span-2 print:col-span-2">
                  {getStatusBadge(record?.status || 'pending')}
                </div>
              </div>

              {record?.method && (
                <div className="grid grid-cols-1 xs:grid-cols-3 print:grid-cols-3 gap-0.5 xs:gap-1 items-center">
                  <span className="text-slate-500">Method:</span>
                  <span className="xs:col-span-2 print:col-span-2 capitalize text-slate-800 font-medium">
                    {record.method.replace('_', ' ')}
                  </span>
                </div>
              )}

              {record?.paid_at && (
                <div className="grid grid-cols-1 xs:grid-cols-3 print:grid-cols-3 gap-0.5 xs:gap-1 items-center">
                  <span className="text-slate-500">Disbursed Date:</span>
                  <span className="xs:col-span-2 print:col-span-2 font-mono text-slate-800 font-medium">
                    {formatDate(record.paid_at)}
                  </span>
                </div>
              )}

              {user.bank_name && (
                <div className="grid grid-cols-1 xs:grid-cols-3 print:grid-cols-3 gap-0.5 xs:gap-1 items-center">
                  <span className="text-slate-500">Payout Account:</span>
                  <span className="xs:col-span-2 print:col-span-2 text-slate-800 text-[11px] font-mono break-all">
                    {user.bank_name}{user.account_no ? ` • ${user.account_no}` : ''}
                  </span>
                </div>
              )}

            </div>
          </div>

          {/* High-Impact Total Payroll Callout */}
          {/* <div className="bg-gradient-to-br from-emerald-50 via-emerald-100/40 to-teal-50 border-2 border-emerald-500/40 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-700" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                  Total Payroll (Net Take-Home Pay)
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 mt-1">
                Net earnings settlement for cut-off {formatDate(period.start_date)} to{' '}
                {formatDate(period.end_date)}
              </p>
              <div className="text-[11px] text-slate-600 mt-1 font-mono">
                Base Rate: <strong>{formatCurrency(baseRate, currencySymbol)}/hr</strong> • Total Approved:{' '}
                <strong>{formatDecimalHours(totalApprovedHours)} hrs</strong>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-700 tracking-tight">
                {formatCurrency(totalPayroll, currencySymbol)}
              </div>
              <span className="inline-block text-[10px] font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-200/70 px-2 py-0.5 rounded mt-0.5">
                Payable Amount
              </span>
            </div>
          </div> */}

          {/* Earnings Breakdown Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Payroll Earnings Breakdown
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-2.5 sm:px-4">Pay Item Description</th>
                    <th className="py-2.5 px-2.5 sm:px-4 text-right whitespace-nowrap">Hours</th>
                    <th className="py-2.5 px-2.5 sm:px-4 text-right whitespace-nowrap">Hourly Rate</th>
                    <th className="py-2.5 px-2.5 sm:px-4 text-right whitespace-nowrap">Gross Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {record?.lines && record.lines.length > 0 ? (
                    record.lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-2.5 sm:px-4 font-medium text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>
                              {line.description ||
                                (line.line_type === 'hours'
                                  ? 'Approved Regular Work Hours'
                                  : line.category || 'Adjustment')}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 sm:px-4 text-right font-mono font-medium text-slate-700 whitespace-nowrap">
                          {line.line_type === 'hours' ? `${formatDecimalHours(line.hours)} h` : '—'}
                        </td>
                        <td className="py-2.5 px-2.5 sm:px-4 text-right font-mono text-slate-600 whitespace-nowrap">
                          {line.line_type === 'hours' ? formatCurrency(line.hourly_rate, currencySymbol) : '—'}
                        </td>
                        <td className="py-2.5 px-2.5 sm:px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {line.line_type !== 'hours' ? '+' : ''}{formatCurrency(line.amount, currencySymbol)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-2.5 sm:px-4 font-medium text-slate-900">
                        Regular Approved DTR Hours
                      </td>
                      <td className="py-2.5 px-2.5 sm:px-4 text-right font-mono font-medium whitespace-nowrap">
                        {formatDecimalHours(totalApprovedHours)} h
                      </td>
                      <td className="py-2.5 px-2.5 sm:px-4 text-right font-mono text-slate-600 whitespace-nowrap">
                        {formatCurrency(baseRate, currencySymbol)}
                      </td>
                      <td className="py-2.5 px-2.5 sm:px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(totalPayroll, currencySymbol)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs">
                    <td colSpan={3} className="py-3 px-2.5 sm:px-4 text-slate-800 uppercase tracking-wider">
                      Total Gross Payroll Payable
                    </td>
                    <td className="py-3 px-2.5 sm:px-4 text-right font-mono font-black text-emerald-700 text-sm whitespace-nowrap">
                      {formatCurrency(totalPayroll, currencySymbol)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Approved DTR Work Sessions Covered in Cut-off */}
          {/* <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Work Sessions Covered in this Cut-off ({approvedEntries.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                Approved Daily Time Records
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
              {approvedEntries.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No approved sessions found for this pay period.
                </div>
              ) : (
                approvedEntries.map((session) => {
                  const sessionRate =
                    session.hourly_rate_snapshot || user.hourly_rate || baseRate;
                  const sessionTotal =
                    (session.payable_hours || 0) * sessionRate;

                  return (
                    <div
                      key={session.id}
                      className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="font-mono font-semibold text-slate-900 flex items-center gap-2">
                          <span>{formatDate(session.work_date)}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600 font-normal">
                            {formatTime(session.time_in)} –{' '}
                            {session.time_out ? formatTime(session.time_out) : 'Open'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 line-clamp-1">
                          <strong>Accomplishment:</strong> {session.remarks || 'Standard work session'}
                        </div>
                      </div>

                      <div className="text-left sm:text-right font-mono shrink-0">
                        <span className="font-semibold text-slate-800 mr-2">
                          {formatDecimalHours(session.payable_hours || session.hours)} h
                        </span>
                        <span className="font-bold text-emerald-700">
                          {formatCurrency(sessionTotal, currencySymbol)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div> */}

          {/* Formal Attestation Footer */}
          <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2">
            <div>
              <p className="text-[10px]">
                This document is an authentic electronic payslip statement generated by WMedlaw DTR. No physical signature is required.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Bar (Hidden from print) */}
        <div className="no-print p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Payslip</span>
          </button>

          <button
            id="btn-close-payslip-bottom"
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 sm:px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors shadow-2xs"
          >
            Close Payslip
          </button>
        </div>
      </div>
    </div>
  );
}
