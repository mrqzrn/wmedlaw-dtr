'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import {
  Download,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  Filter,
  User as UserIcon,
  CreditCard,
  AlertCircle,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  Printer,
  Info,
  History,
  Tag,
  Mail,
} from 'lucide-react';
import {
  formatCurrency,
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
import { PaymentStatus, PaymentMethod, PaymentRecord, User, DtrEntry, PayPeriod } from '@/lib/types';
import { EmployeePayslipModal } from '@/components/employee/EmployeePayslipModal';

export function AdminReports() {
  const {
    visibleUsers,
    dtrEntries,
    payments,
    payPeriods,
    monthlySelfApprovals,
    serverCurrentDate,
    generateMonthlyPayments,
    updateMonthlyPaymentStatus,
    sendPaymentReceiptEmail,
    settings,
  } = useApp();

  const [activeReport, setActiveReport] = useState<
    'monthly_payroll' | 'hours' | 'payroll' | 'extra' | 'accomplishments'
  >('monthly_payroll');

  // Month selection (defaults to current month YYYY-MM)
  const currentMonthStr = (serverCurrentDate || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedPeriodId, setSelectedPeriodId] = useState('all');

  // Filters for monthly payroll
  const [deptFilter, setDeptFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [selfApproveFilter, setSelfApproveFilter] = useState('all');

  // Modals
  const [breakdownUser, setBreakdownUser] = useState<{
    user: User;
    entries: DtrEntry[];
    total: number;
    approved: number;
    gross: number;
  } | null>(null);

  const [updatingPaymentUser, setUpdatingPaymentUser] = useState<{
    userId: string;
    userName: string;
    gross: number;
    currentStatus: PaymentStatus | 'unpaid';
    method?: string;
    reference_no?: string;
    paid_at?: string;
  } | null>(null);

  const [viewingPayslip, setViewingPayslip] = useState<{
    user: User;
    period: PayPeriod;
    record: PaymentRecord | null;
    entries: DtrEntry[];
  } | null>(null);

  const [newStatus, setNewStatus] = useState<PaymentStatus>('paid');
  const [newMethod, setNewMethod] = useState<PaymentMethod>('bank_transfer');
  const [newRef, setNewRef] = useState('');
  const [newPaidDate, setNewPaidDate] = useState(serverCurrentDate);
  const [newReason, setNewReason] = useState('');
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Available months discovered from entries, approvals, and recent calendar
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

  // Departments list
  const departments = useMemo(() => {
    return Array.from(new Set(visibleUsers.map((u) => u.department))).filter(Boolean);
  }, [visibleUsers]);

  // Current month date range
  const monthRange = useMemo(() => getMonthDateRange(selectedMonth), [selectedMonth]);

  // Navigate months
  const handleShiftMonth = (direction: -1 | 1) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + direction, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  // Monthly Summary Calculation
  const monthlySummary = useMemo(() => {
    return visibleUsers
      .filter((u) => u.clocks_in || dtrEntries.some((e) => e.user_id === u.id && e.work_date.startsWith(selectedMonth)))
      .map((user) => {
        const userMonthEntries = dtrEntries.filter(
          (e) => e.user_id === user.id && e.work_date.startsWith(selectedMonth) && e.status !== 'rejected'
        );
        const regular = userMonthEntries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
        const extra = userMonthEntries.reduce((sum, e) => sum + (e.extra_hours || 0), 0);
        const total = userMonthEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
        const approved = userMonthEntries
          .filter((e) => e.status === 'approved' || e.status === 'locked')
          .reduce((sum, e) => sum + (e.payable_hours || 0), 0);

        // Self-Approval record
        const approval = monthlySelfApprovals.find(
          (a) => a.user_id === user.id && a.month === selectedMonth
        );
        const selfApproved = Boolean(approval) || userMonthEntries.some((e) => e.self_approved);

        const matchingPeriod = payPeriods.find(
          (pp) =>
            (pp.frequency === 'monthly' || !pp.frequency) &&
            (pp.start_date.startsWith(selectedMonth) || pp.end_date.startsWith(selectedMonth)) &&
            pp.status !== 'purged'
        );

        // Payment record (direct month record, matching period record, or within date range)
        const payment =
          payments.find(
            (p) =>
              (p.user_id === user.id || (user.email && p.user_id?.toLowerCase() === user.email.toLowerCase())) &&
              (p.month === selectedMonth ||
                p.pay_period_id === `month-${selectedMonth}` ||
                (matchingPeriod && p.pay_period_id === matchingPeriod.id))
          ) ||
          payments.find((p) => {
            if (p.user_id !== user.id && (!user.email || p.user_id?.toLowerCase() !== user.email.toLowerCase())) return false;
            const pp = payPeriods.find((x) => x.id === p.pay_period_id);
            return pp && (pp.start_date.startsWith(selectedMonth) || pp.end_date.startsWith(selectedMonth));
          });

        const paymentStatus: PaymentStatus | 'unpaid' = payment?.status || 'unpaid';

        const gross = payment ? payment.gross_amount : Math.round(approved * (user.hourly_rate || 0) * 100) / 100;

        return {
          user,
          entries: userMonthEntries,
          regular,
          extra,
          total,
          approved,
          hourlyRate: user.hourly_rate || 0,
          gross,
          approval,
          selfApproved,
          selfApprovedAt: approval?.submitted_at,
          selfApprovedNote: approval?.employee_note,
          refTag: approval?.reference_no || (selfApproved ? generateMonthlyDtrRefTag(selectedMonth, user.employee_no, user.id) : null),
          payment,
          paymentStatus,
          sessionCount: userMonthEntries.length,
        };
      });
  }, [visibleUsers, dtrEntries, monthlySelfApprovals, payments, payPeriods, selectedMonth]);

  // Filtered monthly summary for display
  const filteredMonthlySummary = useMemo(() => {
    return monthlySummary.filter((item) => {
      if (deptFilter !== 'all' && item.user.department !== deptFilter) return false;
      if (paymentStatusFilter !== 'all') {
        if (paymentStatusFilter === 'unpaid' && item.paymentStatus !== 'unpaid') return false;
        if (paymentStatusFilter !== 'unpaid' && item.paymentStatus !== paymentStatusFilter) return false;
      }
      if (selfApproveFilter !== 'all') {
        if (selfApproveFilter === 'approved' && !item.selfApproved) return false;
        if (selfApproveFilter === 'pending' && item.selfApproved) return false;
      }
      return true;
    });
  }, [monthlySummary, deptFilter, paymentStatusFilter, selfApproveFilter]);

  // Grand totals for filtered monthly summary table
  const monthlyGrandTotals = useMemo(() => {
    return filteredMonthlySummary.reduce(
      (acc, item) => ({
        regular: acc.regular + (item.regular || 0),
        extra: acc.extra + (item.extra || 0),
        total: acc.total + (item.total || 0),
        approved: acc.approved + (item.approved || 0),
        gross: acc.gross + (item.gross || 0),
        sessionCount: acc.sessionCount + (item.sessionCount || 0),
      }),
      { regular: 0, extra: 0, total: 0, approved: 0, gross: 0, sessionCount: 0 }
    );
  }, [filteredMonthlySummary]);

  // Overall KPIs for the month
  const monthlyKpis = useMemo(() => {
    const totalStaff = monthlySummary.length;
    const staffWithHours = monthlySummary.filter((s) => s.total > 0).length;
    const totalHoursLogged = monthlySummary.reduce((sum, s) => sum + s.total, 0);
    const totalApprovedHours = monthlySummary.reduce((sum, s) => sum + s.approved, 0);
    const totalGrossPayroll = monthlySummary.reduce((sum, s) => sum + s.gross, 0);
    const selfApprovedCount = monthlySummary.filter((s) => s.selfApproved).length;
    const paidCount = monthlySummary.filter((s) => s.paymentStatus === 'paid').length;
    const pendingPaymentCount = monthlySummary.filter((s) => s.paymentStatus === 'pending').length;

    return {
      totalStaff,
      staffWithHours,
      totalHoursLogged,
      totalApprovedHours,
      totalGrossPayroll,
      selfApprovedCount,
      paidCount,
      pendingPaymentCount,
    };
  }, [monthlySummary]);

  // Filter entries for other reports
  const filteredEntries = useMemo(() => {
    if (selectedPeriodId === 'all') return dtrEntries;
    const selectedPeriod = payPeriods.find((p) => p.id === selectedPeriodId);
    return dtrEntries.filter(
      (e) =>
        e.pay_period_id === selectedPeriodId ||
        (selectedPeriod && e.work_date >= selectedPeriod.start_date && e.work_date <= selectedPeriod.end_date)
    );
  }, [dtrEntries, selectedPeriodId, payPeriods]);

  const filteredPayments = useMemo(() => {
    let list = payments;
    if (selectedPeriodId !== 'all') {
      const selectedPeriod = payPeriods.find((p) => p.id === selectedPeriodId);
      const selectedPeriodMonth = selectedPeriod?.start_date.slice(0, 7);
      list = list.filter(
        (p) =>
          p.pay_period_id === selectedPeriodId ||
          (selectedPeriodMonth &&
            (p.month === selectedPeriodMonth || p.pay_period_id === `month-${selectedPeriodMonth}`))
      );
    }

    // Deduplicate payments by user and period/month so duplicate entries never appear
    const uniqueMap = new Map<string, PaymentRecord>();
    for (const p of list) {
      const matchingPeriod = payPeriods.find(
        (pp) =>
          pp.id === p.pay_period_id ||
          (p.month && pp.start_date.startsWith(p.month)) ||
          p.pay_period_id === `month-${pp.start_date.slice(0, 7)}`
      );
      const periodKey = matchingPeriod ? matchingPeriod.id : (p.month || p.pay_period_id);
      const key = `${p.user_id}_${periodKey}`;

      const existing = uniqueMap.get(key);
      if (!existing) {
        uniqueMap.set(key, p);
      } else {
        const isBetter =
          (p.status === 'paid' && existing.status !== 'paid') ||
          (Boolean(p.reference_no) && !existing.reference_no) ||
          (!p.pay_period_id.startsWith('month-') && existing.pay_period_id.startsWith('month-'));
        const winner = isBetter ? p : existing;
        const loser = isBetter ? existing : p;
        uniqueMap.set(key, {
          ...winner,
          status: winner.status === 'paid' || loser.status === 'paid' ? 'paid' : winner.status,
          method: winner.method || loser.method,
          reference_no: winner.reference_no || loser.reference_no,
          paid_at: winner.paid_at || loser.paid_at,
          lines: winner.lines && winner.lines.length > 0 ? winner.lines : loser.lines,
        });
      }
    }

    return Array.from(uniqueMap.values());
  }, [payments, selectedPeriodId, payPeriods]);

  const hoursByEmployee = useMemo(() => {
    return visibleUsers.map((user) => {
      const userEntries = filteredEntries.filter((e) => e.user_id === user.id && e.status !== 'rejected');
      const regular = userEntries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
      const extra = userEntries.reduce((sum, e) => sum + (e.extra_hours || 0), 0);
      const total = userEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
      const approved = userEntries
        .filter((e) => e.status === 'approved' || e.status === 'locked')
        .reduce((sum, e) => sum + (e.payable_hours || 0), 0);
      return {
        user,
        regular,
        extra,
        total,
        approved,
        sessionCount: userEntries.length,
      };
    });
  }, [visibleUsers, filteredEntries]);

  const hoursGrandTotals = useMemo(() => {
    return hoursByEmployee.reduce(
      (acc, h) => ({
        regular: acc.regular + (h.regular || 0),
        extra: acc.extra + (h.extra || 0),
        total: acc.total + (h.total || 0),
        approved: acc.approved + (h.approved || 0),
        sessionCount: acc.sessionCount + (h.sessionCount || 0),
      }),
      { regular: 0, extra: 0, total: 0, approved: 0, sessionCount: 0 }
    );
  }, [hoursByEmployee]);

  const payrollGrandTotals = useMemo(() => {
    return filteredPayments.reduce(
      (acc, p) => ({
        hours: acc.hours + (p.total_hours || 0),
        gross: acc.gross + (p.gross_amount || 0),
      }),
      { hours: 0, gross: 0 }
    );
  }, [filteredPayments]);

  const extraHoursList = filteredEntries
    .filter((e) => e.extra_hours > 0)
    .map((e) => ({
      entry: e,
      user: visibleUsers.find((u) => u.id === e.user_id),
    }));

  // CSV Exporter helper
  const exportCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    if (activeReport === 'monthly_payroll') {
      const headers = [
        'Month',
        'Employee ID',
        'Employee Name',
        'Department',
        'Position',
        'Self Approval Status',
        'Self Approved Date',
        'DTR Ref Tag',
        'Regular Hours',
        'Extra Hours',
        'Total Logged Hours',
        'Approved Payable Hours',
        'Hourly Rate',
        'Gross Amount',
        'Payment Status',
        'Paid Date',
        'Payment Method',
        'Reference No',
      ];
      const rows = monthlySummary.map((s) => [
        selectedMonth,
        s.user.employee_no,
        `${s.user.first_name} ${s.user.last_name}`,
        s.user.department,
        s.user.position,
        s.selfApproved ? 'Self-Approved' : 'Pending Self-Approval',
        s.selfApprovedAt ? formatDate(s.selfApprovedAt) : 'N/A',
        s.refTag || '',
        s.regular.toFixed(2),
        s.extra.toFixed(2),
        s.total.toFixed(2),
        s.approved.toFixed(2),
        s.hourlyRate.toFixed(2),
        s.gross.toFixed(2),
        s.paymentStatus.toUpperCase().replace('_', ' '),
        s.payment?.paid_at ? formatDate(s.payment.paid_at) : '',
        s.payment?.method || '',
        s.payment?.reference_no || '',
      ]);
      exportCsv(`Monthly_Payroll_Report_${selectedMonth}`, headers, rows);
    } else if (activeReport === 'hours') {
      const headers = ['Employee ID', 'Employee Name', 'Department', 'Regular Hours', 'Extra Hours', 'Total Hours', 'Approved Hours'];
      const rows = hoursByEmployee.map((h) => [
        h.user.employee_no,
        `${h.user.first_name} ${h.user.last_name}`,
        h.user.department,
        h.regular.toFixed(2),
        h.extra.toFixed(2),
        h.total.toFixed(2),
        h.approved.toFixed(2),
      ]);
      exportCsv('Hours_By_Employee', headers, rows);
    } else if (activeReport === 'payroll') {
      const headers = ['Period Start', 'Period End', 'Employee ID', 'Name', 'Approved Hours', 'Hourly Wage', 'Gross Pay', 'Status', 'Paid Date', 'Payment Method', 'Reference'];
      const rows = filteredPayments.map((p) => {
        const u = visibleUsers.find((user) => user.id === p.user_id);
        const period = payPeriods.find((x) => x.id === p.pay_period_id);
        const rate = p.lines?.find((l) => l.line_type === 'hours')?.hourly_rate || (p.lines && p.lines.length > 0 && p.lines[0].hourly_rate) || (u?.hourly_rate || 0);
        return [
          period?.start_date || '',
          period?.end_date || '',
          u?.employee_no || '',
          `${u?.first_name} ${u?.last_name}`,
          p.total_hours.toFixed(2),
          rate.toFixed(2),
          p.gross_amount.toFixed(2),
          p.status,
          p.paid_at ? formatDate(p.paid_at) : '',
          p.method || '',
          p.reference_no || '',
        ];
      });
      exportCsv('Payroll_Summary', headers, rows);
    } else if (activeReport === 'extra') {
      const headers = ['Date', 'Employee Name', 'Time In', 'Time Out', 'Total Hours', 'Extra Hours', 'Threshold Limit', 'Extra Status', 'Note'];
      const rows = extraHoursList.map(({ entry, user }) => [
        entry.work_date,
        `${user?.first_name} ${user?.last_name}`,
        entry.time_in,
        entry.time_out || '',
        entry.hours.toFixed(2),
        entry.extra_hours.toFixed(2),
        entry.extra_hours_limit || 'Daily',
        entry.extra_hours_status,
        entry.extra_hours_note || '',
      ]);
      exportCsv('Extra_Hours_Report', headers, rows);
    } else if (activeReport === 'accomplishments') {
      const headers = ['Date', 'Employee Name', 'Department', 'In', 'Out', 'Hours', 'Accomplishment Remarks'];
      const rows = filteredEntries.map((e) => {
        const u = visibleUsers.find((user) => user.id === e.user_id);
        return [
          e.work_date,
          `${u?.first_name} ${u?.last_name}`,
          u?.department || '',
          e.time_in,
          e.time_out || '',
          e.hours.toFixed(2),
          e.remarks || '',
        ];
      });
      exportCsv('Accomplishment_Remarks_Report', headers, rows);
    }
  };

  const handleGeneratePayroll = () => {
    const res = generateMonthlyPayments(selectedMonth);
    setActionAlert({
      type: 'success',
      text: `Generated monthly payroll for ${formatMonthYear(selectedMonth)}: ${res.count} employee record(s) totaling ${formatCurrency(res.totalGross)}.`,
    });
    setTimeout(() => setActionAlert(null), 6000);
  };

  const handleSavePaymentStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingPaymentUser) return;
    const res = updateMonthlyPaymentStatus(updatingPaymentUser.userId, selectedMonth, newStatus, {
      method: newMethod,
      reference_no: newRef,
      paid_at: newPaidDate,
      reason: newReason,
    });
    if (res.success) {
      let emailNotice = '';
      if (newStatus === 'paid' && sendEmailNotification) {
        const targetUser = visibleUsers.find((u) => u.id === updatingPaymentUser.userId);
        const targetEmail = targetUser?.email;
        if (targetEmail) {
          try {
            const emailRes = await sendPaymentReceiptEmail({
              user_id: targetUser.id,
              email: targetEmail,
              employee_name: updatingPaymentUser.userName,
              department: targetUser.department,
              hourly_rate: targetUser.hourly_rate,
              gross_amount: updatingPaymentUser.gross,
              method: newMethod,
              reference_no: newRef,
              paid_at: newPaidDate,
              bank_name: targetUser.bank_name,
              account_no: targetUser.account_no,
              pay_period_label: formatMonthYear(selectedMonth),
            });
            if (emailRes.success && emailRes.sent) {
              emailNotice = emailRes.simulated
                ? ` (Receipt email simulated for ${targetEmail})`
                : ` (Receipt emailed to ${targetEmail})`;
            } else {
              emailNotice = ` (Email note: ${emailRes.error || emailRes.message || 'could not send receipt email'})`;
            }
          } catch (err: any) {
            console.warn('Error sending receipt from reports:', err);
            emailNotice = ' (Note: Email service unavailable)';
          }
        } else {
          emailNotice = ' (Note: No email address on employee profile)';
        }
      }

      setActionAlert({
        type: 'success',
        text: `Payment status updated for ${updatingPaymentUser.userName}.${emailNotice}`,
      });
      setUpdatingPaymentUser(null);
      setTimeout(() => setActionAlert(null), 5000);
    } else {
      alert(res.message);
    }
  };

  const getStatusBadge = (status: PaymentStatus | 'unpaid') => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> PAID
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span> PROCESSING
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span> ON HOLD
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> CANCELLED
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> PENDING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">
            UNPROCESSED
          </span>
        );
    }
  };

  type MonthlySummaryItem = (typeof monthlySummary)[number];

  const handleOpenPaymentStatusModal = (item: MonthlySummaryItem) => {
    setUpdatingPaymentUser({
      userId: item.user.id,
      userName: `${item.user.first_name} ${item.user.last_name}`,
      gross: item.gross,
      currentStatus: item.paymentStatus,
      method: item.payment?.method,
      reference_no: item.payment?.reference_no,
      paid_at: item.payment?.paid_at,
    });
    setNewStatus(item.paymentStatus === 'unpaid' ? 'paid' : item.paymentStatus);
    setNewMethod((item.payment?.method as PaymentMethod) || 'bank_transfer');
    setNewRef(item.payment?.reference_no || '');
    setNewPaidDate(item.payment?.paid_at ? item.payment.paid_at.slice(0, 10) : serverCurrentDate);
    setNewReason(item.payment?.status_reason || '');
  };

  const handleOpenBreakdown = (item: MonthlySummaryItem) => {
    setBreakdownUser({
      user: item.user,
      entries: item.entries,
      total: item.total,
      approved: item.approved,
      gross: item.gross,
    });
  };

  const handleOpenMonthlyPayslip = (item: MonthlySummaryItem) => {
    const matchingPeriod = payPeriods.find(
      (pp) =>
        (pp.frequency === 'monthly' || !pp.frequency) &&
        (pp.start_date.startsWith(selectedMonth) || pp.end_date.startsWith(selectedMonth)) &&
        pp.status !== 'purged'
    );
    const { start, end } = getMonthDateRange(selectedMonth);
    const effectivePeriod: PayPeriod = matchingPeriod || {
      id: `month-${selectedMonth}`,
      frequency: 'monthly',
      start_date: start,
      end_date: end,
      pay_date: end,
      status: 'closed',
    };

    const effectiveRecord: PaymentRecord = item.payment
      ? {
          ...item.payment,
          reference_no: item.payment.reference_no || item.refTag || undefined,
          gross_amount: item.payment.gross_amount ?? item.gross,
          total_hours: item.payment.total_hours ?? (item.approved > 0 ? item.approved : item.total),
          status:
            item.payment.status ||
            (item.paymentStatus === 'unpaid' ? 'pending' : (item.paymentStatus as PaymentStatus)),
          lines:
            item.payment.lines && item.payment.lines.length > 0
              ? item.payment.lines
              : [
                  {
                    id: `line-${item.user.id}`,
                    line_type: 'hours',
                    description: `Approved Work Hours (${formatMonthYear(selectedMonth)})`,
                    hours: item.approved > 0 ? item.approved : item.total,
                    hourly_rate: item.hourlyRate || item.user.hourly_rate || 300,
                    amount: item.gross,
                  },
                ],
        }
      : {
          id: `payslip-${selectedMonth}-${item.user.id}`,
          pay_period_id: effectivePeriod.id,
          user_id: item.user.id,
          month: selectedMonth,
          total_hours: item.approved > 0 ? item.approved : item.total,
          sessions_count: item.entries.length,
          gross_amount: item.gross,
          status: (item.paymentStatus === 'unpaid' ? 'pending' : item.paymentStatus) as PaymentStatus,
          reference_no: item.refTag || undefined,
          generated_at: new Date().toISOString(),
          lines: [
            {
              id: `line-${item.user.id}`,
              line_type: 'hours',
              description: `Approved Work Hours (${formatMonthYear(selectedMonth)})`,
              hours: item.approved > 0 ? item.approved : item.total,
              hourly_rate: item.hourlyRate || item.user.hourly_rate || 300,
              amount: item.gross,
            },
          ],
        };

    setViewingPayslip({
      user: item.user,
      period: effectivePeriod,
      record: effectiveRecord,
      entries: item.entries,
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Action Notification Alert */}
      {actionAlert && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
            actionAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 font-medium min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="break-words">{actionAlert.text}</span>
          </div>
          <button
            onClick={() => setActionAlert(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer shrink-0 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Report Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Payroll & Operational Reports
            </h1>
          </div>
          <p className="text-xs text-slate-600">
            Monthly employee total hours breakdown, payment reconciliation, and employee self-approval audit.
          </p>
        </div>

        <div className="w-full md:w-auto flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          {activeReport === 'monthly_payroll' ? (
            <>
              {/* Month Selector Buttons */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-300 rounded-lg p-0.5 shadow-2xs min-h-[40px]">
                <button
                  type="button"
                  onClick={() => handleShiftMonth(-1)}
                  className="p-2 sm:p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors cursor-pointer shrink-0"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  id="select-monthly-payroll-month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="flex-1 sm:flex-initial text-center sm:text-left text-xs px-2.5 py-1 bg-transparent border-none text-slate-900 font-bold outline-none cursor-pointer"
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
                  className="p-2 sm:p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors cursor-pointer shrink-0"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Generate Payroll Action */}
              {/* <button
                type="button"
                id="btn-generate-monthly-payroll"
                onClick={handleGeneratePayroll}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                title="Calculate gross amounts and create payment records for all active staff"
              >
                <FileCheck2 className="w-4 h-4 shrink-0" />
                <span>Generate Monthly Payroll</span>
              </button> */}
            </>
          ) : (
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full sm:w-auto min-h-[40px] text-xs p-2 bg-white border border-slate-300 rounded-lg outline-none"
            >
              <option value="all">All Pay Periods</option>
              {payPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatDate(p.start_date)} → {formatDate(p.end_date)} ({p.frequency})
                </option>
              ))}
            </select>
          )}

          {/* Export CSV Button */}
          <button
            type="button"
            id="btn-export-csv"
            onClick={handleExport}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex border-b border-slate-200 gap-1 sm:gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
        <button
          onClick={() => setActiveReport('monthly_payroll')}
          className={`shrink-0 pb-3 px-2.5 sm:px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeReport === 'monthly_payroll'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Monthly Payroll Report</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
            New
          </span>
        </button>
        <button
          onClick={() => setActiveReport('hours')}
          className={`shrink-0 pb-3 px-2.5 sm:px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeReport === 'hours'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Hours by Employee
        </button>
        <button
          onClick={() => setActiveReport('payroll')}
          className={`shrink-0 pb-3 px-2.5 sm:px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeReport === 'payroll'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Pay Period Summary
        </button>
        <button
          onClick={() => setActiveReport('extra')}
          className={`shrink-0 pb-3 px-2.5 sm:px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeReport === 'extra'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Extra Hours Log
        </button>
        <button
          onClick={() => setActiveReport('accomplishments')}
          className={`shrink-0 pb-3 px-2.5 sm:px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
            activeReport === 'accomplishments'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Accomplishment Remarks
        </button>
      </div>

      {/* VIEW: Monthly Payroll Report */}
      {activeReport === 'monthly_payroll' && (
        <div className="space-y-4 sm:space-y-5">
          {/* Month KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
                Active Staff
              </span>
              <span className="text-base sm:text-xl font-bold font-mono text-slate-900 mt-1 block truncate">
                {monthlyKpis.staffWithHours} / {monthlyKpis.totalStaff}
              </span>
              <span className="text-[10px] text-slate-500 block truncate">logged in {formatMonthYear(selectedMonth)}</span>
            </div>

            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
                Total Hours
              </span>
              <span className="text-base sm:text-xl font-bold font-mono text-slate-900 mt-1 block truncate">
                {formatDecimalHours(monthlyKpis.totalHoursLogged)} h
              </span>
              <span className="text-[10px] text-slate-500 block truncate">gross logged hours</span>
            </div>

            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block truncate">
                Payable Hours
              </span>
              <span className="text-base sm:text-xl font-bold font-mono text-emerald-700 mt-1 block truncate">
                {formatDecimalHours(monthlyKpis.totalApprovedHours)} h
              </span>
              <span className="text-[10px] text-emerald-800 font-medium block truncate">approved for pay</span>
            </div>

            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
                Total Payroll
              </span>
              <span className="text-base sm:text-xl font-bold font-mono text-emerald-800 mt-1 block truncate">
                {formatCurrency(monthlyKpis.totalGrossPayroll, settings.currency_symbol)}
              </span>
              <span className="text-[10px] text-slate-500 block truncate">computed gross total</span>
            </div>

            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider block truncate">
                Self-Approvals
              </span>
              <span className="text-base sm:text-xl font-bold font-mono text-blue-700 mt-1 block truncate">
                {monthlyKpis.selfApprovedCount} / {monthlyKpis.totalStaff}
              </span>
              <span className="text-[10px] text-blue-800 font-medium block truncate">employees finalized</span>
            </div>

            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
                Payment Status
              </span>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
                <span className="text-xs sm:text-sm font-bold font-mono text-emerald-700">
                  {monthlyKpis.paidCount} Paid
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs sm:text-sm font-bold font-mono text-slate-700">
                  {monthlyKpis.pendingPaymentCount} Pending
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block truncate">disbursement status</span>
            </div>
          </div>

          {/* Sub-Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
            <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3">
              <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Filters:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full min-h-[38px] px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg outline-none font-medium text-slate-700"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className="w-full min-h-[38px] px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg outline-none font-medium text-slate-700"
                >
                  <option value="all">All Payment Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="processing">Processing</option>
                  <option value="pending">Pending</option>
                  <option value="on_hold">On Hold</option>
                  <option value="unpaid">Unprocessed</option>
                </select>

                <select
                  value={selfApproveFilter}
                  onChange={(e) => setSelfApproveFilter(e.target.value)}
                  className="w-full min-h-[38px] px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg outline-none font-medium text-slate-700"
                >
                  <option value="all">All Self-Approval Statuses</option>
                  <option value="approved">Self-Approved by Employee</option>
                  <option value="pending">Pending Self-Approval</option>
                </select>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              Month Period: <strong>{monthRange.start}</strong> to <strong>{monthRange.end}</strong>
            </div>
          </div>

          {/* Monthly Payroll Summary Table & Mobile Cards */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Self-Approval</th>
                    <th className="py-3 px-4">Regular</th>
                    <th className="py-3 px-4">Extra</th>
                    <th className="py-3 px-4">Total Hours</th>
                    <th className="py-3 px-4">Approved Hours</th>
                    <th className="py-3 px-4">Hourly Wage</th>
                    <th className="py-3 px-4">Gross Total</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
                  {filteredMonthlySummary.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400">
                        No employees found matching filter criteria for {formatMonthYear(selectedMonth)}.
                      </td>
                    </tr>
                  ) : (
                    filteredMonthlySummary.map((item) => (
                      <tr key={item.user.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Employee Identity */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {item.user.first_name} {item.user.last_name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {item.user.employee_no} • {item.user.department}
                          </div>
                          {/* {item.user.bank_name || item.user.account_no ? (
                            <div className="text-[10px] text-slate-600 flex items-center gap-1 mt-0.5">
                              <span className="font-semibold text-emerald-800">{item.user.bank_name || 'Bank/Wallet'}</span>
                              {item.user.account_no && (
                                <span className="font-mono text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
                                  {item.user.account_no}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-amber-700 italic">No bank details</span>
                          )} */}
                        </td>

                        {/* Self-Approval Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {item.selfApproved ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Self-Approved
                              </span>
                              {item.refTag && (
                                <div>
                                  <span className="font-mono text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1 font-semibold">
                                    <Tag className="w-2.5 h-2.5 text-indigo-500" />
                                    {item.refTag}
                                  </span>
                                </div>
                              )}
                              {item.selfApprovedAt && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {formatDateTime(item.selfApprovedAt)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" /> Awaiting Sign-off
                            </span>
                          )}
                        </td>

                        {/* Regular Hours */}
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {formatDecimalHours(item.regular)} h
                        </td>

                        {/* Extra Hours */}
                        <td className="py-3 px-4 font-mono">
                          {item.extra > 0 ? (
                            <span className="font-bold text-amber-700">+{formatDecimalHours(item.extra)} h</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Total Logged Hours */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {formatDecimalHours(item.total)} h
                          <span className="text-[10px] text-slate-400 font-normal block font-sans">
                            {item.sessionCount} shifts
                          </span>
                        </td>

                        {/* Approved Payable Hours */}
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                          {formatDecimalHours(item.approved)} h
                        </td>

                        {/* Hourly Rate */}
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {formatCurrency(item.hourlyRate, settings.currency_symbol)}/h
                        </td>

                        {/* Gross Amount */}
                        <td className="py-3 px-4 font-mono font-extrabold text-emerald-800">
                          {formatCurrency(item.gross, settings.currency_symbol)}
                        </td>

                        {/* Payment Status & Reference */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentStatusModal(item)}
                            className="group inline-flex items-center gap-1 cursor-pointer text-left hover:opacity-85 transition-opacity"
                            title="Click to update payment status"
                          >
                            {getStatusBadge(item.paymentStatus)}
                          </button>
                          {item.payment?.paid_at && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Paid: {item.payment.paid_at}
                            </div>
                          )}
                          {item.payment?.reference_no && (
                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]" title={item.payment.reference_no}>
                              Ref: {item.payment.reference_no}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenBreakdown(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                            title="View daily shifts breakdown for this month"
                          >
                            <FileText className="w-3 h-3" /> Breakdown
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenMonthlyPayslip(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                            title="View official employee payslip statement for this month"
                          >
                            <FileText className="w-3 h-3 text-emerald-600" /> Payslip
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredMonthlySummary.length > 0 && (
                  <tfoot className="border-t-2 border-slate-300 bg-slate-100/95 font-bold text-slate-900 text-xs">
                    <tr>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 text-[11px] uppercase tracking-wider">
                          Grand Total
                        </div>
                        <span className="text-[10px] text-slate-500 font-normal font-sans block">
                          {filteredMonthlySummary.length} employee{filteredMonthlySummary.length !== 1 ? 's' : ''}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium text-[11px]">
                        {filteredMonthlySummary.filter((s) => s.selfApproved).length} of {filteredMonthlySummary.length} certified
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {formatDecimalHours(monthlyGrandTotals.regular)} h
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-amber-800 whitespace-nowrap">
                        {monthlyGrandTotals.extra > 0 ? `+${formatDecimalHours(monthlyGrandTotals.extra)} h` : '—'}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-extrabold text-slate-950 whitespace-nowrap">
                        {formatDecimalHours(monthlyGrandTotals.total)} h
                        <span className="text-[10px] text-slate-500 font-normal block font-sans">
                          {monthlyGrandTotals.sessionCount} shifts
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-700 whitespace-nowrap">
                        {formatDecimalHours(monthlyGrandTotals.approved)} h
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        —
                      </td>

                      <td className="py-3.5 px-4 font-mono font-black text-emerald-800 text-sm whitespace-nowrap">
                        {formatCurrency(monthlyGrandTotals.gross, settings.currency_symbol)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-[11px] font-medium text-slate-600">
                        {filteredMonthlySummary.filter((s) => s.paymentStatus === 'paid').length} Paid • {filteredMonthlySummary.filter((s) => s.paymentStatus === 'pending').length} Pending
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap text-slate-400">
                        —
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-100 text-xs">
              {filteredMonthlySummary.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  No employees found matching filter criteria for {formatMonthYear(selectedMonth)}.
                </div>
              ) : (
                <>
                  {filteredMonthlySummary.map((item) => (
                    <div key={item.user.id} className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            {item.user.first_name} {item.user.last_name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate">
                            {item.user.employee_no} • {item.user.department}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenPaymentStatusModal(item)}
                          className="shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                          title="Tap to update payment status"
                        >
                          {getStatusBadge(item.paymentStatus)}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.selfApproved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Self-Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" /> Awaiting Sign-off
                          </span>
                        )}
                        {item.refTag && (
                          <span className="font-mono text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1 font-semibold">
                            <Tag className="w-2.5 h-2.5 text-indigo-500" />
                            {item.refTag}
                          </span>
                        )}
                        {item.payment?.paid_at && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            • Paid {item.payment.paid_at}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Logged ({item.sessionCount} shifts)</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatDecimalHours(item.total)} h
                          </span>
                          {item.extra > 0 && (
                            <span className="text-[10px] font-mono font-bold text-amber-700 ml-1">
                              (+{formatDecimalHours(item.extra)}h)
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-700 font-medium block">Payable Hours</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {formatDecimalHours(item.approved)} h
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Hourly Wage</span>
                          <span className="font-mono font-medium text-slate-700">
                            {formatCurrency(item.hourlyRate, settings.currency_symbol)}/h
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Gross Total</span>
                          <span className="font-mono font-extrabold text-emerald-800">
                            {formatCurrency(item.gross, settings.currency_symbol)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleOpenBreakdown(item)}
                          className="inline-flex items-center justify-center gap-1.5 min-h-[38px] text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" /> Breakdown
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenMonthlyPayslip(item)}
                          className="inline-flex items-center justify-center gap-1.5 min-h-[38px] text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" /> Payslip
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Mobile Grand Total Footer */}
                  <div className="bg-slate-100/95 border-t-2 border-slate-300 p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-extrabold text-slate-900 text-[11px] uppercase tracking-wider block">
                          Grand Total ({filteredMonthlySummary.length} staff)
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {filteredMonthlySummary.filter((s) => s.selfApproved).length} certified •{' '}
                          {filteredMonthlySummary.filter((s) => s.paymentStatus === 'paid').length} Paid
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-emerald-800 text-sm block">
                          {formatCurrency(monthlyGrandTotals.gross, settings.currency_symbol)}
                        </span>
                        <span className="font-mono font-bold text-[11px] text-emerald-700">
                          {formatDecimalHours(monthlyGrandTotals.approved)} h payable
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Hours by Employee (Pay Period based) */}
      {activeReport === 'hours' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Regular Hours</th>
                  <th className="py-3 px-4">Extra Hours</th>
                  <th className="py-3 px-4">Total Logged</th>
                  <th className="py-3 px-4">Approved Payable</th>
                  <th className="py-3 px-4 text-right">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
                {hoursByEmployee.map((h) => (
                  <tr key={h.user.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-900">
                      {h.user.first_name} {h.user.last_name}
                      <span className="text-[11px] text-slate-500 font-mono block">
                        {h.user.employee_no}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{h.user.department}</td>
                    <td className="py-3 px-4 font-mono">{formatDecimalHours(h.regular)} h</td>
                    <td className="py-3 px-4 font-mono text-amber-800">
                      {h.extra > 0 ? `+${formatDecimalHours(h.extra)} h` : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {formatDecimalHours(h.total)} h
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                      {formatDecimalHours(h.approved)} h
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {h.sessionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
              {hoursByEmployee.length > 0 && (
                <tfoot className="border-t-2 border-slate-300 bg-slate-100/95 font-bold text-slate-900 text-xs">
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="font-extrabold text-[11px] uppercase tracking-wider">Grand Total</div>
                      <span className="text-[10px] text-slate-500 font-normal font-sans block">
                        {hoursByEmployee.length} employee{hoursByEmployee.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">—</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                      {formatDecimalHours(hoursGrandTotals.regular)} h
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-amber-800">
                      {hoursGrandTotals.extra > 0 ? `+${formatDecimalHours(hoursGrandTotals.extra)} h` : '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-slate-950">
                      {formatDecimalHours(hoursGrandTotals.total)} h
                    </td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-700">
                      {formatDecimalHours(hoursGrandTotals.approved)} h
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                      {hoursGrandTotals.sessionCount}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100 text-xs">
            {hoursByEmployee.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No employees found.</div>
            ) : (
              <>
                {hoursByEmployee.map((h) => (
                  <div key={h.user.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {h.user.first_name} {h.user.last_name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {h.user.employee_no} • {h.user.department}
                        </div>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                        {h.sessionCount} {h.sessionCount === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Regular</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {formatDecimalHours(h.regular)} h
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Extra</span>
                        <span className="font-mono font-semibold text-amber-800">
                          {h.extra > 0 ? `+${formatDecimalHours(h.extra)} h` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Total Logged</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatDecimalHours(h.total)} h
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-700 font-medium block">Approved Payable</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {formatDecimalHours(h.approved)} h
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-slate-100/95 border-t-2 border-slate-300 p-3.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-extrabold text-slate-900 text-[11px] uppercase tracking-wider block">
                      Grand Total ({hoursByEmployee.length} staff)
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">
                      {hoursGrandTotals.sessionCount} sessions • {formatDecimalHours(hoursGrandTotals.total)} h logged
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-emerald-700 text-sm block">
                      {formatDecimalHours(hoursGrandTotals.approved)} h
                    </span>
                    <span className="text-[10px] text-emerald-800 font-medium">approved payable</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* VIEW: Payroll Summary (Pay Period based) */}
      {activeReport === 'payroll' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Approved Hours</th>
                  <th className="py-3 px-4">Hourly Rate</th>
                  <th className="py-3 px-4">Gross Pay</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Paid Date</th>
                  <th className="py-3 px-4">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No payroll records generated for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const u = visibleUsers.find((user) => user.id === p.user_id);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {u?.first_name} {u?.last_name}
                        </td>
                        <td className="py-3 px-4 font-mono">{formatDecimalHours(p.total_hours)} h</td>
                        <td className="py-3 px-4 font-mono">
                          {p.lines?.find((l) => l.line_type === 'hours')
                            ? formatCurrency(p.lines.find((l) => l.line_type === 'hours')!.hourly_rate, settings.currency_symbol)
                            : u?.hourly_rate
                            ? formatCurrency(u.hourly_rate, settings.currency_symbol)
                            : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                          {formatCurrency(p.gross_amount, settings.currency_symbol)}
                        </td>
                        <td className="py-3 px-4 capitalize">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'on_hold'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">{formatDate(p.paid_at)}</td>
                        <td className="py-3 px-4 font-mono text-slate-700 font-semibold">{p.reference_no || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredPayments.length > 0 && (
                <tfoot className="border-t-2 border-slate-300 bg-slate-100/95 font-bold text-slate-900 text-xs">
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="font-extrabold text-[11px] uppercase tracking-wider">Grand Total</div>
                      <span className="text-[10px] text-slate-500 font-normal block font-sans">
                        {filteredPayments.length} record{filteredPayments.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-slate-950">
                      {formatDecimalHours(payrollGrandTotals.hours)} h
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">—</td>
                    <td className="py-3.5 px-4 font-mono font-black text-emerald-800 text-sm">
                      {formatCurrency(payrollGrandTotals.gross, settings.currency_symbol)}
                    </td>
                    <td colSpan={3} className="py-3.5 px-4 text-slate-600 text-[11px] font-medium">
                      {filteredPayments.filter((p) => p.status === 'paid').length} Paid • {filteredPayments.filter((p) => p.status === 'pending').length} Pending
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100 text-xs">
            {filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No payroll records generated for the selected period.
              </div>
            ) : (
              <>
                {filteredPayments.map((p) => {
                  const u = visibleUsers.find((user) => user.id === p.user_id);
                  const rateLabel = p.lines?.find((l) => l.line_type === 'hours')
                    ? formatCurrency(p.lines.find((l) => l.line_type === 'hours')!.hourly_rate, settings.currency_symbol)
                    : u?.hourly_rate
                    ? formatCurrency(u.hourly_rate, settings.currency_symbol)
                    : '—';
                  return (
                    <div key={p.id} className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 min-w-0 truncate">
                          {u?.first_name} {u?.last_name}
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            p.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.status === 'on_hold'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-500 block">Hours</span>
                          <span className="font-mono font-semibold text-slate-800 block truncate">
                            {formatDecimalHours(p.total_hours)} h
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-500 block">Rate</span>
                          <span className="font-mono font-medium text-slate-700 block truncate">
                            {rateLabel}
                          </span>
                        </div>
                        <div className="min-w-0 text-right">
                          <span className="text-[10px] text-slate-500 block">Gross Pay</span>
                          <span className="font-mono font-bold text-emerald-700 block truncate">
                            {formatCurrency(p.gross_amount, settings.currency_symbol)}
                          </span>
                        </div>
                      </div>
                      {(p.paid_at || p.reference_no) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                          <span>Paid: {formatDate(p.paid_at)}</span>
                          {p.reference_no && (
                            <span className="font-semibold text-slate-700 break-all">Ref: {p.reference_no}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="bg-slate-100/95 border-t-2 border-slate-300 p-3.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-extrabold text-slate-900 text-[11px] uppercase tracking-wider block">
                      Grand Total ({filteredPayments.length} records)
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {filteredPayments.filter((p) => p.status === 'paid').length} Paid •{' '}
                      {filteredPayments.filter((p) => p.status === 'pending').length} Pending
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-emerald-800 text-sm block">
                      {formatCurrency(payrollGrandTotals.gross, settings.currency_symbol)}
                    </span>
                    <span className="font-mono font-semibold text-[11px] text-slate-700">
                      {formatDecimalHours(payrollGrandTotals.hours)} h
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* VIEW: Extra Hours Report */}
      {activeReport === 'extra' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Work Date</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Total Session</th>
                  <th className="py-3 px-4">Extra Portion</th>
                  <th className="py-3 px-4">Limit Triggered</th>
                  <th className="py-3 px-4">Approval Decision</th>
                  <th className="py-3 px-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
                {extraHoursList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No extra hours recorded in the selected period.
                    </td>
                  </tr>
                ) : (
                  extraHoursList.map(({ entry, user }) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono">{formatDate(entry.work_date)}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {user?.first_name} {user?.last_name}
                      </td>
                      <td className="py-3 px-4 font-mono">{formatDecimalHours(entry.hours)} h</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-800">
                        +{formatDecimalHours(entry.extra_hours)} h
                      </td>
                      <td className="py-3 px-4 uppercase text-[11px] font-semibold text-slate-600">
                        {entry.extra_hours_limit || 'Daily'}
                      </td>
                      <td className="py-3 px-4 capitalize font-semibold">
                        {entry.extra_hours_status === 'approved' ? (
                          <span className="text-emerald-700">Approved (Paid)</span>
                        ) : entry.extra_hours_status === 'declined' ? (
                          <span className="text-rose-700">Declined (Unpaid)</span>
                        ) : (
                          <span className="text-amber-800">Awaiting Decision</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 italic">
                        {entry.extra_hours_note || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100 text-xs">
            {extraHoursList.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No extra hours recorded in the selected period.
              </div>
            ) : (
              extraHoursList.map(({ entry, user }) => (
                <div key={entry.id} className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">
                        {user?.first_name} {user?.last_name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {formatDate(entry.work_date)} • {(entry.extra_hours_limit || 'Daily').toUpperCase()} limit
                      </div>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        entry.extra_hours_status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : entry.extra_hours_status === 'declined'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {entry.extra_hours_status === 'approved'
                        ? 'Approved'
                        : entry.extra_hours_status === 'declined'
                        ? 'Declined'
                        : 'Pending'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Total Session</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {formatDecimalHours(entry.hours)} h
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Extra Portion</span>
                      <span className="font-mono font-bold text-amber-800">
                        +{formatDecimalHours(entry.extra_hours)} h
                      </span>
                    </div>
                  </div>
                  {entry.extra_hours_note && (
                    <p className="text-[11px] text-slate-600 italic break-words">
                      Note: {entry.extra_hours_note}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW: Accomplishments Report */}
      {activeReport === 'accomplishments' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Hours</th>
                  <th className="py-3 px-4">Accomplishment Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
                {filteredEntries.map((e) => {
                  const u = visibleUsers.find((user) => user.id === e.user_id);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono whitespace-nowrap">{formatDate(e.work_date)}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {u?.first_name} {u?.last_name}
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        {e.time_out ? `${formatDecimalHours(e.hours)} h` : 'Open'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 leading-relaxed">
                        {e.remarks || 'No remarks provided'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100 text-xs">
            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No entries recorded in the selected period.
              </div>
            ) : (
              filteredEntries.map((e) => {
                const u = visibleUsers.find((user) => user.id === e.user_id);
                return (
                  <div key={e.id} className="p-3.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {u?.first_name} {u?.last_name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {formatDate(e.work_date)}
                        </div>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-800">
                        {e.time_out ? `${formatDecimalHours(e.hours)} h` : 'Open'}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed break-words bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {e.remarks || 'No remarks provided'}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL: Employee Monthly Breakdown Modal */}
      {breakdownUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full sm:w-[50vw] sm:max-w-[50vw] p-4 sm:p-6 pb-safe space-y-4 max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-start gap-2 min-w-0">
                <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                    Monthly DTR Breakdown: {breakdownUser.user.first_name} {breakdownUser.user.last_name}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    {formatMonthYear(selectedMonth)} • {breakdownUser.user.employee_no} • {breakdownUser.user.department}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBreakdownUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Quick Summary Pill */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-slate-50 p-2.5 sm:p-3 rounded-lg border border-slate-200 text-xs text-center">
              <div className="min-w-0">
                <span className="text-slate-500 text-[10px] sm:text-[11px] block truncate">Total Logged</span>
                <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm block truncate">
                  {formatDecimalHours(breakdownUser.total)} h
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-emerald-700 text-[10px] sm:text-[11px] block font-semibold truncate">Payable Hours</span>
                <span className="font-mono font-bold text-emerald-700 text-xs sm:text-sm block truncate">
                  {formatDecimalHours(breakdownUser.approved)} h
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-slate-500 text-[10px] sm:text-[11px] block truncate">Gross Pay</span>
                <span className="font-mono font-bold text-emerald-800 text-xs sm:text-sm block truncate">
                  {formatCurrency(breakdownUser.gross, settings.currency_symbol)}
                </span>
              </div>
            </div>

            {/* Daily entries list */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
              <div className="hidden sm:block">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">In</th>
                      <th className="py-2.5 px-3">Out</th>
                      <th className="py-2.5 px-3">Hours</th>
                      <th className="py-2.5 px-3">Remarks</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {breakdownUser.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          No shifts filed for this month.
                        </td>
                      </tr>
                    ) : (
                      [...breakdownUser.entries]
                        .sort((a, b) => b.work_date.localeCompare(a.work_date) || (b.time_in || '').localeCompare(a.time_in || ''))
                        .map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                              {formatDate(e.work_date)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">{formatTime(e.time_in)}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">{formatTime(e.time_out)}</td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                              {formatDecimalHours(e.hours)} h
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 max-w-xs line-clamp-2">
                              {e.remarks || 'No remarks'}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  e.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {e.status}
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                  {breakdownUser.entries.length > 0 && (
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900 text-xs">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 uppercase tracking-wider text-[11px] text-slate-800">
                          Total ({breakdownUser.entries.length} shift{breakdownUser.entries.length !== 1 ? 's' : ''})
                        </td>
                        <td className="py-2.5 px-3 font-mono font-extrabold text-slate-950">
                          {formatDecimalHours(breakdownUser.total)} h
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-emerald-800 font-mono text-[11px]">
                          Approved: {formatDecimalHours(breakdownUser.approved)} h • Gross: {formatCurrency(breakdownUser.gross, settings.currency_symbol)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Mobile Shift Cards inside Breakdown Modal */}
              <div className="sm:hidden divide-y divide-slate-100 text-xs">
                {breakdownUser.entries.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    No shifts filed for this month.
                  </div>
                ) : (
                  <>
                    {[...breakdownUser.entries]
                      .sort((a, b) => b.work_date.localeCompare(a.work_date) || (b.time_in || '').localeCompare(a.time_in || ''))
                      .map((e) => (
                        <div key={e.id} className="p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-slate-900">{formatDate(e.work_date)}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${
                                e.status === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {e.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
                            <span>
                              {formatTime(e.time_in)} → {formatTime(e.time_out)}
                            </span>
                            <span className="font-bold text-slate-900">{formatDecimalHours(e.hours)} h</span>
                          </div>
                          {e.remarks && (
                            <p className="text-[11px] text-slate-600 break-words leading-snug">
                              {e.remarks}
                            </p>
                          )}
                        </div>
                      ))}
                    <div className="p-3 bg-slate-50 border-t-2 border-slate-200 flex items-center justify-between text-[11px] font-bold">
                      <span className="uppercase tracking-wider text-slate-700">
                        Total ({breakdownUser.entries.length} shifts)
                      </span>
                      <span className="font-mono text-emerald-800">
                        {formatDecimalHours(breakdownUser.approved)} h • {formatCurrency(breakdownUser.gross, settings.currency_symbol)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setBreakdownUser(null)}
                className="w-full sm:w-auto min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Update Payment Status Modal */}
      {updatingPaymentUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600 shrink-0" />
                <h3 className="font-bold text-slate-900 text-base">
                  Update Payment Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUpdatingPaymentUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            {(() => {
              const targetUser = visibleUsers.find((u) => u.id === updatingPaymentUser.userId);
              return (
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-slate-900 min-w-0 truncate">{updatingPaymentUser.userName}</div>
                    <div className="font-mono font-bold text-emerald-700 shrink-0">
                      {formatCurrency(updatingPaymentUser.gross, settings.currency_symbol)}
                    </div>
                  </div>
                  <div className="text-slate-500 font-mono text-[11px]">
                    Month: <strong>{formatMonthYear(selectedMonth)}</strong>
                  </div>
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-slate-500 text-[10px] block uppercase font-medium">Payout Destination:</span>
                      <span className="font-bold text-slate-800 text-[11px] break-all">
                        {targetUser?.bank_name || <span className="text-amber-700 font-normal">Not provided</span>}
                        {targetUser?.account_no ? ` • ${targetUser.account_no}` : ''}
                      </span>
                    </div>
                    {targetUser?.account_no && (
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator?.clipboard) {
                            navigator.clipboard.writeText(targetUser.account_no || '');
                            setActionAlert({ type: 'success', text: 'Account number copied to clipboard!' });
                            setTimeout(() => setActionAlert(null), 3000);
                          }
                        }}
                        className="shrink-0 text-[10px] font-semibold bg-white border border-slate-200 px-2.5 py-1.5 rounded text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
                      >
                        Copy No.
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleSavePaymentStatus} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as PaymentStatus)}
                  className="w-full min-h-[40px] text-xs p-2 bg-white border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                >
                  <option value="paid">Paid (Disbursed)</option>
                  <option value="processing">Processing (Scheduled / In Transit)</option>
                  <option value="pending">Pending (Awaiting Release)</option>
                  <option value="on_hold">On Hold (Verification Required)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={newMethod}
                  onChange={(e) => setNewMethod(e.target.value as PaymentMethod)}
                  className="w-full min-h-[40px] text-xs p-2 bg-white border border-slate-300 rounded-lg outline-none text-slate-800"
                >
                  <option value="bank_transfer">Bank Transfer (BDO, BPI, UnionBank, etc.)</option>
                  <option value="ewallet">eWallet (GCash, Maya, etc.)</option>
                  <option value="direct_deposit">Direct Deposit / ACH</option>
                  <option value="check">Company Check</option>
                  <option value="cash">Cash Voucher</option>
                </select>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Reference / Check #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TR-99824"
                    value={newRef}
                    onChange={(e) => setNewRef(e.target.value)}
                    className="w-full min-h-[40px] text-xs p-2 border border-slate-300 rounded-lg outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Disbursement Date
                  </label>
                  <input
                    type="date"
                    value={newPaidDate}
                    onChange={(e) => setNewPaidDate(e.target.value)}
                    className="w-full min-h-[40px] text-xs p-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              {newStatus === 'on_hold' && (
                <div>
                  <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                    Hold Reason (Visible to Employee)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Specify why payment is on hold..."
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    className="w-full text-xs p-2 border border-amber-300 rounded-lg outline-none"
                  />
                </div>
              )}

              {newStatus === 'paid' && (
                <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-lg p-2.5 text-xs">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendEmailNotification}
                      onChange={(e) => setSendEmailNotification(e.target.checked)}
                      className="mt-0.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 shrink-0 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-[11px] leading-snug">
                      <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Email payment confirmation receipt to employee</span>
                    </span>
                  </label>
                </div>
              )}

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUpdatingPaymentUser(null)}
                  className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Employee Payslip Modal */}
      {viewingPayslip && (
        <EmployeePayslipModal
          isOpen={!!viewingPayslip}
          onClose={() => setViewingPayslip(null)}
          period={viewingPayslip.period}
          user={viewingPayslip.user}
          record={viewingPayslip.record}
          entries={viewingPayslip.entries}
          currencySymbol={settings.currency_symbol || '₱'}
        />
      )}
    </div>
  );
}
