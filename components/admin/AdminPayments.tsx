'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import {
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Lock,
  Calendar,
  PhilippinePeso,
  FileSpreadsheet,
  ChevronRight,
  Info,
  ExternalLink,
  Building2,
  Wallet,
  Copy,
  Check,
  Calculator,
  RefreshCw,
  RotateCcw,
  DollarSign,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  Users,
  User as UserIcon,
  Gift,
  Car,
  Utensils,
  Wifi,
  Coins,
  X,
  Mail,
  Loader2,
  DollarSignIcon,
  HandCoinsIcon,
  BanknoteIcon,
} from 'lucide-react';
import { formatCurrency, formatDecimalHours, formatDate, formatMonthYear } from '@/lib/utils-dtr';
import { PayPeriod, PaymentRecord, PaymentLine, PaymentMethod, PaymentStatus, User, DtrFinalizeReminderResult } from '@/lib/types';

const CATEGORY_PRESETS = [
  { label: 'Performance Bonus', icon: Sparkles, color: 'text-amber-500' },
  { label: 'Cash Advance', icon: HandCoinsIcon, color: 'text-emerald-500' },
  { label: 'Transpo. Allowance', icon: Car, color: 'text-blue-500' },
  { label: 'Reimbursement', icon: BanknoteIcon, color: 'text-purple-500' },
  // { label: '13th Month Pay', icon: Gift, color: 'text-rose-500' },
  { label: 'Holiday Bonus', icon: Coins, color: 'text-yellow-600' },
  { label: 'Custom', icon: Plus, color: 'text-slate-600' },
];

const AMOUNT_PRESETS = [1000, 2500, 5000, 7500, 10000];

export function AdminPayments() {
  const {
    visibleUsers,
    payPeriods,
    payments,
    dtrEntries,
    settings,
    closePayPeriod,
    lockPayPeriod,
    updatePayPeriodPayDate,
    generatePaymentsForPeriod,
    updatePaymentStatus,
    sendPaymentReceiptEmail,
    addAdditionalPayment,
    removeAdditionalPaymentLine,
    refreshRemotePayments,
    serverCurrentDate,
    monthlySelfApprovals,
    sendDtrFinalizeReminders,
  } = useApp();

  useEffect(() => {
    refreshRemotePayments?.();
  }, [refreshRemotePayments]);

  const initialMonthlyPeriod =
    payPeriods.find(
      (p) =>
        p.frequency === 'monthly' &&
        p.start_date <= serverCurrentDate &&
        p.end_date >= serverCurrentDate
    ) ||
    payPeriods.find((p) => p.frequency === 'monthly' && p.status === 'open') ||
    payPeriods.find((p) => p.frequency === 'monthly') ||
    payPeriods[0] ||
    null;

  const [selectedPeriod, setSelectedPeriod] = useState<PayPeriod | null>(initialMonthlyPeriod);

  useEffect(() => {
    if (!selectedPeriod && payPeriods.length > 0) {
      const activeMonthly =
        payPeriods.find(
          (p) =>
            p.frequency === 'monthly' &&
            p.start_date <= serverCurrentDate &&
            p.end_date >= serverCurrentDate
        ) ||
        payPeriods.find((p) => p.frequency === 'monthly') ||
        payPeriods[0];
      setSelectedPeriod(activeMonthly);
    }
  }, [payPeriods, selectedPeriod, serverCurrentDate]);

  // Computation alert banner
  const [computeAlert, setComputeAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Close period validation state
  const [preCloseCheck, setPreCloseCheck] = useState<{
    canClose: boolean;
    unapprovedCount: number;
    pendingExtraCount: number;
    openSessionsCount: number;
  } | null>(null);

  // Mark Paid Modal state
  const [payingRecord, setPayingRecord] = useState<PaymentRecord | null>(null);
  const [paidDate, setPaidDate] = useState(serverCurrentDate);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [refNumber, setRefNumber] = useState('');
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [customRecipientEmail, setCustomRecipientEmail] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [resendingReceiptId, setResendingReceiptId] = useState<string | null>(null);

  // Hold Modal state
  const [holdingRecord, setHoldingRecord] = useState<PaymentRecord | null>(null);
  const [holdReason, setHoldReason] = useState('');

  // Cancel Modal state
  const [cancellingRecord, setCancellingRecord] = useState<PaymentRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Additional Payment Modal state
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [addPaymentTarget, setAddPaymentTarget] = useState<'all' | 'individual'>('all');
  const [selectedUserIdForAdd, setSelectedUserIdForAdd] = useState<string>('');
  const [paymentCategory, setPaymentCategory] = useState<string>('Performance Bonus');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDescription, setPaymentDescription] = useState<string>('');
  const [isSubmittingAddPayment, setIsSubmittingAddPayment] = useState(false);

  const handleOpenAddPaymentModal = (userId?: string) => {
    if (userId) {
      setAddPaymentTarget('individual');
      setSelectedUserIdForAdd(userId);
    } else {
      setAddPaymentTarget('all');
      const firstEligible = visibleUsers.find((u) => u.role === 'employee' || u.clocks_in);
      if (firstEligible && !selectedUserIdForAdd) {
        setSelectedUserIdForAdd(firstEligible.id);
      }
    }
    setPaymentCategory('Performance Bonus');
    setCustomCategory('');
    setPaymentAmount('');
    setPaymentDescription('');
    setIsAddPaymentModalOpen(true);
  };

  const handleSubmitAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriod) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid positive payment amount.');
      return;
    }

    const effectiveCategory = paymentCategory === 'Custom' ? customCategory.trim() : paymentCategory.trim();
    if (!effectiveCategory) {
      alert('Please provide a category name for this additional payment.');
      return;
    }

    if (addPaymentTarget === 'individual' && !selectedUserIdForAdd) {
      alert('Please select an employee.');
      return;
    }

    setIsSubmittingAddPayment(true);
    try {
      const res = await addAdditionalPayment({
        payPeriodId: selectedPeriod.id,
        target: addPaymentTarget,
        userId: addPaymentTarget === 'individual' ? selectedUserIdForAdd : undefined,
        category: effectiveCategory,
        amount: amountNum,
        description: paymentDescription.trim() || effectiveCategory,
      });

      if (res.success) {
        setIsAddPaymentModalOpen(false);
        setComputeAlert({
          type: 'success',
          message: res.message,
        });
        setTimeout(() => setComputeAlert(null), 5000);
      } else {
        alert(res.message);
      }
    } finally {
      setIsSubmittingAddPayment(false);
    }
  };

  const handleRemoveAdditionalLine = async (paymentId: string, lineId: string, lineLabel: string) => {
    if (!confirm(`Are you sure you want to remove "${lineLabel}" from this payment record?`)) {
      return;
    }

    const res = await removeAdditionalPaymentLine({ paymentId, lineId });
    if (res.success) {
      setComputeAlert({
        type: 'success',
        message: res.message,
      });
      setTimeout(() => setComputeAlert(null), 4000);
    } else {
      alert(res.message);
    }
  };

  // ---------------------------------------------------------------------------
  // DTR Finalization Reminders (current month)
  // ---------------------------------------------------------------------------
  const reminderMonth = serverCurrentDate.slice(0, 7);
  const reminderDeadline = React.useMemo(() => {
    const [y, m] = reminderMonth.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${reminderMonth}-${String(lastDay).padStart(2, '0')}`;
  }, [reminderMonth]);
  const reminderDaysLeft = Math.max(
    0,
    Math.round((Date.parse(`${reminderDeadline}T00:00:00Z`) - Date.parse(`${serverCurrentDate}T00:00:00Z`)) / 86_400_000)
  );

  const unfinalizedEmployees = React.useMemo(() => {
    const finalizedIds = new Set(
      monthlySelfApprovals.filter((a) => a.month === reminderMonth).map((a) => a.user_id)
    );
    return visibleUsers
      .filter(
        (u) =>
          u.status === 'active' &&
          (u.role === 'employee' || u.clocks_in) &&
          !u.is_hidden &&
          !finalizedIds.has(u.id)
      )
      .map((u) => {
        const monthEntries = dtrEntries.filter(
          (e) => e.user_id === u.id && e.work_date.startsWith(reminderMonth) && e.status !== 'rejected'
        );
        return {
          user: u,
          shifts: monthEntries.length,
          hours: monthEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0),
          openSessions: monthEntries.filter((e) => !e.time_out || e.status === 'open').length,
        };
      })
      .sort((a, b) => `${a.user.last_name} ${a.user.first_name}`.localeCompare(`${b.user.last_name} ${b.user.first_name}`));
  }, [visibleUsers, monthlySelfApprovals, dtrEntries, reminderMonth]);

  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderSending, setReminderSending] = useState<'all' | string | null>(null);
  const [reminderStatus, setReminderStatus] = useState<Record<string, DtrFinalizeReminderResult>>({});

  const handleSendFinalizeReminders = async (userId?: string) => {
    if (reminderSending) return;
    if (!userId && unfinalizedEmployees.length === 0) return;

    setReminderSending(userId || 'all');
    try {
      const res = await sendDtrFinalizeReminders({
        month: reminderMonth,
        user_ids: userId ? [userId] : undefined,
      });

      if (!res.success) {
        setComputeAlert({ type: 'error', message: `Reminder could not be sent: ${res.error || 'Unknown error'}` });
        return;
      }

      setReminderStatus((prev) => {
        const next = { ...prev };
        res.results.forEach((r) => {
          next[r.user_id] = r;
        });
        return next;
      });

      const failedNames = res.results.filter((r) => !r.success).map((r) => `${r.name} (${r.error})`);
      const alreadyDone = (res.skipped || []).filter((s) => s.reason === 'already_finalized').length;
      let message =
        res.sent > 0
          ? `Finalization reminder ${res.simulated ? 'simulated' : 'emailed'} to ${res.sent} employee${res.sent === 1 ? '' : 's'} for ${formatMonthYear(reminderMonth)}.`
          : res.message || 'No reminders were sent.';
      if (failedNames.length > 0) message += ` Failed: ${failedNames.join(', ')}.`;
      if (alreadyDone > 0) message += ` ${alreadyDone} already finalized and skipped.`;

      setComputeAlert({ type: res.sent > 0 && failedNames.length === 0 ? 'success' : 'error', message });
    } catch (err: any) {
      setComputeAlert({ type: 'error', message: `Reminder could not be sent: ${err?.message || 'Email service unavailable'}` });
    } finally {
      setReminderSending(null);
      setTimeout(() => setComputeAlert(null), 7000);
    }
  };

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'on_hold'>('all');

  // Scheduled pay date adjustment state
  const [isAdjustingPayDate, setIsAdjustingPayDate] = useState(false);
  const [adjustedPayDate, setAdjustedPayDate] = useState(selectedPeriod?.pay_date || '');

  useEffect(() => {
    if (selectedPeriod) {
      setAdjustedPayDate(selectedPeriod.pay_date);
      setIsAdjustingPayDate(false);
    }
  }, [selectedPeriod?.id, selectedPeriod?.pay_date]);

  const handleSaveAdjustedPayDate = () => {
    if (!selectedPeriod || !adjustedPayDate) return;
    const res = updatePayPeriodPayDate(selectedPeriod.id, adjustedPayDate);
    if (res.success) {
      setSelectedPeriod({ ...selectedPeriod, pay_date: adjustedPayDate });
      setIsAdjustingPayDate(false);
      setComputeAlert({
        type: 'success',
        message: `Scheduled payout date adjusted to ${formatDate(adjustedPayDate)}.`,
      });
      setTimeout(() => setComputeAlert(null), 4000);
    } else {
      alert(res.message);
    }
  };

  // Clipboard copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const currentPeriodPayments = React.useMemo(() => {
    if (!selectedPeriod) return [];
    const periodMonth = selectedPeriod.start_date.slice(0, 7);
    const list = payments.filter(
      (p) =>
        p.pay_period_id === selectedPeriod.id ||
        (p.month && p.month === periodMonth) ||
        p.pay_period_id === `month-${periodMonth}`
    );

    const userMap = new Map<string, PaymentRecord>();
    for (const p of list) {
      const matchedUser = visibleUsers.find(
        (u) =>
          u.id === p.user_id ||
          (u.email && u.email.toLowerCase() === p.user_id?.toLowerCase()) ||
          (u.employee_no && u.employee_no === p.user_id)
      );
      const canonicalUserId = matchedUser ? matchedUser.id : p.user_id;

      const existing = userMap.get(canonicalUserId);
      if (!existing) {
        userMap.set(canonicalUserId, {
          ...p,
          user_id: canonicalUserId,
        });
      } else {
        const isBetter =
          (p.status === 'paid' && existing.status !== 'paid') ||
          (Boolean(p.reference_no) && !existing.reference_no) ||
          (p.pay_period_id === selectedPeriod.id && existing.pay_period_id !== selectedPeriod.id);
        const winner = isBetter ? p : existing;
        const loser = isBetter ? existing : p;

        // Merge lines from both winner and loser so additional lines are preserved
        const winnerLines = Array.isArray(winner.lines) ? winner.lines : [];
        const loserLines = Array.isArray(loser.lines) ? loser.lines : [];
        const mergedLinesMap = new Map<string, PaymentLine>();

        winnerLines.forEach((l) => {
          const lKey = l.id || `${l.line_type}_${l.category || ''}_${l.amount}`;
          mergedLinesMap.set(lKey, l);
        });
        loserLines.forEach((l) => {
          if (l.line_type !== 'hours') {
            const lKey = l.id || `${l.line_type}_${l.category || ''}_${l.amount}`;
            if (!mergedLinesMap.has(lKey)) {
              mergedLinesMap.set(lKey, l);
            }
          }
        });

        const mergedLines = Array.from(mergedLinesMap.values());
        const recalculatedGross = mergedLines.length > 0
          ? Math.round(mergedLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0) * 100) / 100
          : winner.gross_amount;

        userMap.set(canonicalUserId, {
          ...winner,
          user_id: canonicalUserId,
          status: winner.status === 'paid' || loser.status === 'paid' ? 'paid' : winner.status,
          method: winner.method || loser.method,
          reference_no: winner.reference_no || loser.reference_no,
          paid_at: winner.paid_at || loser.paid_at,
          lines: mergedLines,
          gross_amount: recalculatedGross,
        });
      }
    }
    return Array.from(userMap.values());
  }, [payments, selectedPeriod, visibleUsers]);

  // Summary Metrics for Active Period
  const totalGrossPayroll = currentPeriodPayments.reduce((sum, p) => sum + (p.gross_amount || 0), 0);
  const totalApprovedHours = currentPeriodPayments.reduce((sum, p) => sum + (p.total_hours || 0), 0);
  const totalAdditionalAmount = currentPeriodPayments.reduce((sum, p) => {
    const additionalLines = (p.lines || []).filter((l) => l.line_type !== 'hours');
    return sum + additionalLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }, 0);

  const paidPayments = currentPeriodPayments.filter((p) => p.status === 'paid');
  const totalPaidAmount = paidPayments.reduce((sum, p) => sum + (p.gross_amount || 0), 0);

  const pendingPayments = currentPeriodPayments.filter(
    (p) => p.status === 'pending' || p.status === 'processing'
  );
  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + (p.gross_amount || 0), 0);

  const onHoldPayments = currentPeriodPayments.filter((p) => p.status === 'on_hold');
  const totalOnHoldAmount = onHoldPayments.reduce((sum, p) => sum + (p.gross_amount || 0), 0);

  const filteredPeriodPayments = currentPeriodPayments.filter((p) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return p.status === 'pending' || p.status === 'processing';
    if (statusFilter === 'paid') return p.status === 'paid';
    if (statusFilter === 'on_hold') return p.status === 'on_hold';
    return true;
  });

  const handleComputeTotalPayroll = () => {
    if (!selectedPeriod) return;
    const genRes = generatePaymentsForPeriod(selectedPeriod.id);
    setComputeAlert({
      type: 'success',
      message: `Total payroll computed successfully: ${formatCurrency(genRes.totalGross)} for ${genRes.count} eligible employee(s).`,
    });
    setTimeout(() => setComputeAlert(null), 6000);
  };

  const handleRunPreCloseCheck = () => {
    if (!selectedPeriod) return;
    const periodEntries = dtrEntries.filter((e) => e.pay_period_id === selectedPeriod.id);
    const unapprovedCount = periodEntries.filter(
      (e) => e.status !== 'approved' && e.status !== 'locked' && e.status !== 'rejected'
    ).length;
    const pendingExtraCount = periodEntries.filter(
      (e) => (e.extra_hours_status === 'pending' || e.status === 'extra_hours_pending') && e.status !== 'rejected'
    ).length;
    const openSessionsCount = periodEntries.filter((e) => !e.time_out || e.status === 'open').length;
    const canClose = unapprovedCount === 0 && pendingExtraCount === 0 && openSessionsCount === 0;

    setPreCloseCheck({
      canClose,
      unapprovedCount,
      pendingExtraCount,
      openSessionsCount,
    });
  };

  const handleExecuteClose = () => {
    if (!selectedPeriod) return;
    const closeRes = closePayPeriod(selectedPeriod.id);
    if (!closeRes.success) {
      alert(closeRes.message);
      return;
    }
    const genRes = generatePaymentsForPeriod(selectedPeriod.id);
    setSelectedPeriod({ ...selectedPeriod, status: 'closed' });
    setPreCloseCheck(null);
    setComputeAlert({
      type: 'success',
      message: `Pay period closed & payroll generated: ${genRes.count} payment records totaling ${formatCurrency(genRes.totalGross)}.`,
    });
    setTimeout(() => setComputeAlert(null), 6000);
  };

  const handleOpenMarkPaid = (record: PaymentRecord) => {
    const user = visibleUsers.find(
      (u) =>
        u.id === record.user_id ||
        (u.email && record.user_id && u.email.toLowerCase() === record.user_id.toLowerCase()) ||
        (u.employee_no && u.employee_no === record.user_id)
    );
    setPayingRecord(record);
    setPaidDate(serverCurrentDate);
    setSendEmailNotification(true);
    setCustomRecipientEmail('');
    setIsSubmittingPayment(false);

    // Smart-select payment method based on employee bank/ewallet name
    const bName = (user?.bank_name || '').toLowerCase();
    if (
      bName.includes('gcash') ||
      bName.includes('maya') ||
      bName.includes('paymaya') ||
      bName.includes('grab') ||
      bName.includes('wallet')
    ) {
      setPaymentMethod('ewallet');
    } else {
      setPaymentMethod('bank_transfer');
    }

    // Default reference helper
    if (record.reference_no) {
      setRefNumber(record.reference_no);
    } else {
      const prefix = bName.includes('gcash')
        ? 'GCASH'
        : bName.includes('maya')
        ? 'MAYA'
        : bName
        ? bName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
        : 'BNK';
      setRefNumber(`${prefix}-${Date.now().toString().slice(-6)}`);
    }
  };

  const payingUser = payingRecord
    ? visibleUsers.find(
        (u) =>
          u.id === payingRecord.user_id ||
          (u.email && payingRecord.user_id && u.email.toLowerCase() === payingRecord.user_id.toLowerCase()) ||
          (u.employee_no && u.employee_no === payingRecord.user_id)
      )
    : null;

  // Direct 1-click receipt email dispatch for paid records
  const handleQuickSendReceipt = async (record: PaymentRecord) => {
    const user = visibleUsers.find(
      (u) =>
        u.id === record.user_id ||
        (u.email && record.user_id && u.email.toLowerCase() === record.user_id.toLowerCase()) ||
        (u.employee_no && u.employee_no === record.user_id)
    );

    const targetEmail = (user?.email || '').trim();
    if (!targetEmail) {
      handleOpenMarkPaid(record);
      return;
    }

    setResendingReceiptId(record.id);
    try {
      const emailRes = await sendPaymentReceiptEmail({
        payment_id: record.id,
        user_id: user?.id || record.user_id,
        email: targetEmail,
        employee_name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Employee',
        employee_no: user?.employee_no,
        department: user?.department,
        hourly_rate: user?.hourly_rate,
        gross_amount: record.gross_amount,
        total_hours: record.total_hours,
        method: record.method || 'bank_transfer',
        reference_no: record.reference_no || 'PAID',
        paid_at: record.paid_at || serverCurrentDate,
        bank_name: user?.bank_name,
        account_no: user?.account_no,
        pay_period_label: selectedPeriod
          ? `${formatDate(selectedPeriod.start_date)} - ${formatDate(selectedPeriod.end_date)}`
          : record.month || 'Current Pay Period',
        lines: record.lines || [],
      });

      if (emailRes.success && emailRes.sent) {
        setComputeAlert({
          type: 'success',
          message: emailRes.simulated
            ? `Confirmation receipt simulated for ${targetEmail}.`
            : `Confirmation receipt successfully emailed to ${targetEmail} [Ref: ${record.reference_no || 'PAID'}].`,
        });
      } else {
        setComputeAlert({
          type: 'error',
          message: `Email could not be delivered to ${targetEmail}: ${emailRes.error || 'Failed to dispatch receipt'}`,
        });
      }
    } catch (err: any) {
      setComputeAlert({
        type: 'error',
        message: `Error sending receipt: ${err?.message || 'Email service unavailable'}`,
      });
    } finally {
      setResendingReceiptId(null);
      setTimeout(() => setComputeAlert(null), 6000);
    }
  };

  const handleConfirmPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingRecord) return;
    if (!refNumber.trim()) {
      alert('Payment Reference or Check number is required.');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = updatePaymentStatus(payingRecord.id, 'paid', {
        method: paymentMethod,
        reference_no: refNumber.trim(),
        paid_at: paidDate,
      });

      if (!res.success) {
        alert(res.message);
        setIsSubmittingPayment(false);
        return;
      }

      let emailNotice = '';
      const targetEmail = (payingUser?.email || customRecipientEmail).trim();

      if (sendEmailNotification && targetEmail) {
        try {
          const emailRes = await sendPaymentReceiptEmail({
            payment_id: payingRecord.id,
            user_id: payingUser?.id || payingRecord.user_id,
            email: targetEmail,
            employee_name: `${payingUser?.first_name || ''} ${payingUser?.last_name || ''}`.trim() || 'Employee',
            employee_no: payingUser?.employee_no,
            department: payingUser?.department,
            hourly_rate: payingUser?.hourly_rate,
            gross_amount: payingRecord.gross_amount,
            total_hours: payingRecord.total_hours,
            method: paymentMethod,
            reference_no: refNumber.trim(),
            paid_at: paidDate,
            bank_name: payingUser?.bank_name,
            account_no: payingUser?.account_no,
            pay_period_label: selectedPeriod
              ? `${formatDate(selectedPeriod.start_date)} - ${formatDate(selectedPeriod.end_date)}`
              : payingRecord.month || 'Current Pay Period',
            lines: payingRecord.lines || [],
          });

          if (emailRes.success && emailRes.sent) {
            if (emailRes.simulated) {
              emailNotice = ` Confirmation receipt simulated for ${targetEmail}.`;
            } else {
              emailNotice = ` Confirmation receipt emailed to ${targetEmail}.`;
            }
          } else {
            console.warn('Payment receipt email notification warning:', emailRes.error);
            emailNotice = ` (Email delivery note: ${emailRes.error || 'could not send receipt email'})`;
          }
        } catch (mailErr: any) {
          console.warn('Receipt email failed:', mailErr);
          emailNotice = ' (Note: Email service unavailable)';
        }
      }

      setPayingRecord(null);
      setRefNumber('');
      setCustomRecipientEmail('');
      setComputeAlert({
        type: 'success',
        message: `Disbursement successfully recorded as PAID.${emailNotice}`,
      });
      setTimeout(() => setComputeAlert(null), 6000);
    } catch (err: any) {
      alert(err?.message || 'Failed to update payment status');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleConfirmHold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdingRecord) return;
    if (!holdReason.trim()) {
      alert('A reason is required to place payment on hold.');
      return;
    }
    const res = updatePaymentStatus(holdingRecord.id, 'on_hold', {
      reason: holdReason,
    });
    if (res.success) {
      setHoldingRecord(null);
      setHoldReason('');
    } else {
      alert(res.message);
    }
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingRecord) return;
    if (!cancelReason.trim()) {
      alert('A cancellation reason is required.');
      return;
    }
    const res = updatePaymentStatus(cancellingRecord.id, 'cancelled', {
      reason: cancelReason,
    });
    if (res.success) {
      setCancellingRecord(null);
      setCancelReason('');
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Pay Period & Payroll Management
          </h1>
          <p className="text-xs text-slate-600">
            Compute total payroll for all employees, view their payout bank or eWallet details, and tag individual payment disbursements.
          </p>
        </div>

        {/* Selected Period Switcher & Compute Action */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <div className="flex flex-col xs:flex-row xs:items-center gap-1.5 w-full md:w-auto">
            <label className="text-xs font-semibold text-slate-600 shrink-0">Period:</label>
            <select
              value={selectedPeriod?.id || ''}
              onChange={(e) => {
                const p = payPeriods.find((x) => x.id === e.target.value);
                setSelectedPeriod(p || null);
                setPreCloseCheck(null);
              }}
              className="text-xs p-2 min-h-[38px] w-full md:w-auto bg-white border border-slate-300 rounded-lg outline-none font-medium"
            >
              {payPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatDate(p.start_date)} → {formatDate(p.end_date)} ({p.frequency.replace('_', ' ')} - {p.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* {selectedPeriod && (
            <button
              id="btn-compute-payroll-header"
              onClick={handleComputeTotalPayroll}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Compute or refresh gross payroll calculations for all employees in this period"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-400" />
              <span>Compute Total Payroll</span>
            </button>
          )} */}
        </div>
      </div>

      {/* Compute Feedback Banner */}
      {computeAlert && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200 ${
            computeAlert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words">{computeAlert.message}</span>
          </div>
          <button
            onClick={() => setComputeAlert(null)}
            className="text-slate-500 hover:text-slate-800 text-xs font-semibold shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {selectedPeriod && (
        <>
          {/* Total Payroll KPI Summary Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Payroll */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Computed Payroll
              </span>
              <span className="text-lg xs:text-xl sm:text-2xl font-bold font-mono text-emerald-700 mt-1 block truncate">
                {formatCurrency(totalGrossPayroll)}
              </span>
              <span className="text-[11px] text-slate-500">
                {currentPeriodPayments.length} employee{currentPeriodPayments.length === 1 ? '' : 's'} included
                {totalAdditionalAmount > 0 && (
                  <span className="block text-[10px] text-emerald-700 font-semibold mt-0.5 truncate">
                    (Includes {formatCurrency(totalAdditionalAmount)} additions)
                  </span>
                )}
              </span>
            </div>

            {/* Approved Hours */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Approved Hours
              </span>
              <span className="text-lg xs:text-xl sm:text-2xl font-bold font-mono text-slate-900 mt-1 block truncate">
                {formatDecimalHours(totalApprovedHours)} h
              </span>
              <span className="text-[11px] text-slate-500">Payable work time</span>
            </div>

            {/* Total Paid */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Paid to Date
              </span>
              <span className="text-lg xs:text-xl sm:text-2xl font-bold font-mono text-blue-700 mt-1 block truncate">
                {formatCurrency(totalPaidAmount)}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {paidPayments.length} of {currentPeriodPayments.length} tagged paid
              </span>
            </div>

            {/* Pending Payout */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Remaining to Disburse
              </span>
              <span className="text-lg xs:text-xl sm:text-2xl font-bold font-mono text-amber-700 mt-1 block truncate">
                {formatCurrency(totalPendingAmount)}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {pendingPayments.length} employee{pendingPayments.length === 1 ? '' : 's'} pending
              </span>
            </div>
          </div>

          {/* Period Status Card with Close / Compute Workflow */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm sm:text-base text-slate-900 font-mono">
                  {formatDate(selectedPeriod.start_date)} to {formatDate(selectedPeriod.end_date)}
                </span>
                <span className="capitalize text-xs font-semibold text-slate-500">
                  ({selectedPeriod.frequency.replace('_', ' ')})
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    selectedPeriod.status === 'locked'
                      ? 'bg-slate-200 text-slate-800'
                      : selectedPeriod.status === 'closed'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {selectedPeriod.status.toUpperCase()}
                </span>
              </div>
              <div>
                {!isAdjustingPayDate ? (
                  <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span>
                      Scheduled Payout Date:{' '}
                      <strong className="font-mono text-slate-800">{formatDate(selectedPeriod.pay_date)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustedPayDate(selectedPeriod.pay_date);
                        setIsAdjustingPayDate(true);
                      }}
                      className="text-[11px] text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
                      title="Adjust or advance the scheduled payout date"
                    >
                      Adjust Payout Date
                    </button>
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs text-slate-600 font-medium">New Payout Date:</span>
                    <input
                      type="date"
                      value={adjustedPayDate}
                      onChange={(e) => setAdjustedPayDate(e.target.value)}
                      className="px-2 py-1.5 min-h-[36px] text-xs border border-slate-300 rounded font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveAdjustedPayDate}
                      className="px-3 py-1.5 min-h-[36px] text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAdjustingPayDate(false)}
                      className="px-2.5 py-1.5 min-h-[36px] text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Actions for Period */}
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex items-center gap-2 flex-wrap w-full lg:w-auto">
              <button
                id="btn-add-additional-payment-period"
                onClick={() => handleOpenAddPaymentModal()}
                className="justify-center px-3.5 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Add Performance Bonus, Transpo Allowance, or other additional payment for all employees or an individual employee"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
                <span>+ Add Bonus / Allowance</span>
              </button>

              <button
                id="btn-remind-finalize-dtr"
                onClick={() => setIsReminderModalOpen(true)}
                className="justify-center px-3.5 py-2 min-h-[40px] bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title={`Email employees who have not finalized their ${formatMonthYear(reminderMonth)} time logs`}
              >
                <Mail className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Remind to Finalize DTR</span>
                {unfinalizedEmployees.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold leading-none">
                    {unfinalizedEmployees.length}
                  </span>
                )}
              </button>

              <button
                id="btn-recompute-period-payroll"
                onClick={handleComputeTotalPayroll}
                className="justify-center px-3.5 py-2 min-h-[40px] bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Recalculate total payroll using approved DTR hours and wages"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>Calculate Payroll</span>
              </button>

              {selectedPeriod.status === 'open' && (
                <button
                  id="btn-run-preclose-check"
                  onClick={handleRunPreCloseCheck}
                  className="xs:col-span-2 sm:col-span-1 justify-center px-4 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Verify & Close Period
                </button>
              )}
              {selectedPeriod.status === 'closed' && (
                <span className="xs:col-span-2 sm:col-span-1 text-center text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 font-medium">
                  Closed & Payroll Generated
                </span>
              )}
              {selectedPeriod.status === 'locked' && (
                <span className="xs:col-span-2 sm:col-span-1 text-center text-xs text-slate-600 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200 font-mono">
                  Locked (System Admin Control)
                </span>
              )}
            </div>
          </div>

          {/* Pre-close Verification Drawer */}
          {preCloseCheck && (
            <div className="bg-slate-50 rounded-xl border border-slate-300 p-4 sm:p-5 space-y-4 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Pre-Closing Verification Checklist
                </h3>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    preCloseCheck.canClose
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {preCloseCheck.canClose ? 'READY TO CLOSE' : 'BLOCKED BY UNRESOLVED ENTRIES'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className={`p-3 rounded-lg border ${preCloseCheck.unapprovedCount === 0 ? 'bg-white border-slate-200' : 'bg-rose-50 border-rose-200'}`}>
                  <span className="text-slate-500 block">Unapproved Entries</span>
                  <span className="text-lg font-bold font-mono text-slate-900">
                    {preCloseCheck.unapprovedCount}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">Must be approved or rejected before close.</p>
                </div>

                <div className={`p-3 rounded-lg border ${preCloseCheck.pendingExtraCount === 0 ? 'bg-white border-slate-200' : 'bg-rose-50 border-rose-200'}`}>
                  <span className="text-slate-500 block">Pending Extra Hours</span>
                  <span className="text-lg font-bold font-mono text-slate-900">
                    {preCloseCheck.pendingExtraCount}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">Must have deliberate decision made.</p>
                </div>

                <div className={`p-3 rounded-lg border ${preCloseCheck.openSessionsCount === 0 ? 'bg-white border-slate-200' : 'bg-rose-50 border-rose-200'}`}>
                  <span className="text-slate-500 block">Incomplete Filings</span>
                  <span className="text-lg font-bold font-mono text-slate-900">
                    {preCloseCheck.openSessionsCount}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">All entries must have both start and end time.</p>
                </div>
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPreCloseCheck(null)}
                  className="px-3 py-2 min-h-[40px] text-xs text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Dismiss
                </button>
                <button
                  id="btn-confirm-close-period"
                  disabled={!preCloseCheck.canClose}
                  onClick={handleExecuteClose}
                  className="px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  Confirm Period Close & Generate Payroll
                </button>
              </div>
            </div>
          )}

          {/* Generated Payroll & Payment Records */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Table Header and Filter Tabs */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Individual Employee Payment Records ({currentPeriodPayments.length})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Calculated from approved DTR hours × hourly rate + additional allowances and bonuses. Tag paid status individually for each employee below.
                </p>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 max-w-full text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1.5 min-h-[32px] whitespace-nowrap shrink-0 rounded-lg font-medium transition-colors cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({currentPeriodPayments.length})
                </button>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`px-2.5 py-1.5 min-h-[32px] whitespace-nowrap shrink-0 rounded-lg font-medium transition-colors cursor-pointer ${
                    statusFilter === 'pending'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  Pending ({pendingPayments.length})
                </button>
                <button
                  onClick={() => setStatusFilter('paid')}
                  className={`px-2.5 py-1.5 min-h-[32px] whitespace-nowrap shrink-0 rounded-lg font-medium transition-colors cursor-pointer ${
                    statusFilter === 'paid'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  Paid ({paidPayments.length})
                </button>
                {onHoldPayments.length > 0 && (
                  <button
                    onClick={() => setStatusFilter('on_hold')}
                    className={`px-2.5 py-1.5 min-h-[32px] whitespace-nowrap shrink-0 rounded-lg font-medium transition-colors cursor-pointer ${
                      statusFilter === 'on_hold'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    On Hold ({onHoldPayments.length})
                  </button>
                )}
              </div>
            </div>

            {currentPeriodPayments.length === 0 ? (
              <div className="p-8 sm:p-10 text-center text-slate-500 space-y-3">
                <Calculator className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-medium text-slate-700">
                  No payroll records calculated for this period yet.
                </p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  Click &ldquo;Compute Total Payroll&rdquo; to calculate gross wages for all employees based on approved hours and hourly rates.
                </p>
                <button
                  onClick={handleComputeTotalPayroll}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Compute Total Payroll Now</span>
                </button>
              </div>
            ) : filteredPeriodPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No payment records matching the &ldquo;{statusFilter}&rdquo; filter.
              </div>
            ) : (
              <>
                {/* Desktop Table (kept first in DOM for Playwright desktop selectors) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Bank / eWallet Details</th>
                        <th className="py-3 px-4">Approved Hours</th>
                        <th className="py-3 px-4">Wage Breakdown</th>
                        <th className="py-3 px-4">Gross Payable</th>
                        <th className="py-3 px-4">Payment Status</th>
                        <th className="py-3 px-4">Disbursement Info</th>
                        <th className="py-3 px-4 text-right">Individual Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
                      {filteredPeriodPayments.map((record) => {
                        const user = visibleUsers.find(
                          (u) =>
                            u.id === record.user_id ||
                            (u.email && record.user_id && u.email.toLowerCase() === record.user_id.toLowerCase()) ||
                            (u.employee_no && u.employee_no === record.user_id)
                        );
                        return (
                          <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                            {/* Employee Identity */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="font-semibold text-slate-900">
                                {user?.first_name} {user?.last_name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {user?.employee_no} • {user?.department}
                              </div>
                            </td>

                            {/* Bank or eWallet Details */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {user?.bank_name || user?.account_no ? (
                                <div className="space-y-1">
                                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>{user.bank_name || 'Bank/Wallet'}</span>
                                  </div>
                                  {user.account_no ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-medium">
                                        {user.account_no}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(user.account_no!, record.id)}
                                        className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                        title="Copy Account Number to Clipboard"
                                      >
                                        {copiedId === record.id ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">No account number</span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                                  No bank info
                                </span>
                              )}
                            </td>

                            {/* Approved Hours */}
                            <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                              {formatDecimalHours(record.total_hours)} h
                            </td>

                            {/* Wage Breakdown */}
                            <td className="py-3.5 px-4 text-slate-600 min-w-[220px] max-w-sm">
                              {record.lines && record.lines.length > 0 ? (
                                <div className="space-y-1">
                                  {record.lines.map((line, idx) => (
                                    line.line_type === 'hours' ? (
                                      <div key={line.id || idx} className="text-[11px] font-mono font-medium text-slate-800">
                                        {formatDecimalHours(line.hours)}h @ {formatCurrency(line.hourly_rate)} = {formatCurrency(line.amount)}
                                      </div>
                                    ) : (
                                      <div
                                        key={line.id || idx}
                                        className="group/line flex items-center justify-between gap-1 text-[11px] bg-emerald-50/80 border border-emerald-200/90 rounded-md px-2 py-0.5 text-emerald-900"
                                      >
                                        <div className="flex items-center gap-1 min-w-0 flex-wrap">
                                          <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                                          <span className="font-semibold">{line.category || 'Addition'}:</span>
                                          <span className="font-mono font-bold text-emerald-700">+{formatCurrency(line.amount)}</span>
                                          {line.description && line.description !== line.category && (
                                            <span className="text-[10px] text-slate-500 italic truncate max-w-[130px]" title={line.description}>
                                              ({line.description})
                                            </span>
                                          )}
                                        </div>
                                        {record.status !== 'paid' && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveAdditionalLine(record.id, line.id, line.category || line.description)}
                                            className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 cursor-pointer ml-1"
                                            title="Remove this additional payment item"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    )
                                  ))}
                                </div>
                              ) : (
                                <span className="font-mono text-[11px]">
                                  {formatDecimalHours(record.total_hours)}h
                                </span>
                              )}
                            </td>

                            {/* Gross Payable */}
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 whitespace-nowrap text-sm">
                              {formatCurrency(record.gross_amount)}
                            </td>

                            {/* Payment Status */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  record.status === 'paid'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : record.status === 'processing'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : record.status === 'on_hold'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : record.status === 'cancelled'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {record.status.toUpperCase().replace('_', ' ')}
                              </span>
                              {record.status === 'on_hold' && record.status_reason && (
                                <div className="text-[11px] text-amber-800 mt-1 max-w-xs">
                                  Reason: {record.status_reason}
                                </div>
                              )}
                            </td>

                            {/* Disbursement Info */}
                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                              {record.status === 'paid' && record.paid_at ? (
                                <div className="text-[11px] font-mono space-y-0.5">
                                  <div className="text-emerald-700 font-semibold flex items-center gap-1.5">
                                    <span>Paid: {formatDate(record.paid_at)}</span>
                                    {selectedPeriod?.pay_date && (
                                      record.paid_at.slice(0, 10) < selectedPeriod.pay_date ? (
                                        <span
                                          className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200"
                                          title={`Triggered ahead of scheduled ${formatDate(selectedPeriod.pay_date)}`}
                                        >
                                          Advanced
                                        </span>
                                      ) : record.paid_at.slice(0, 10) > selectedPeriod.pay_date ? (
                                        <span
                                          className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-200"
                                          title={`Triggered after scheduled ${formatDate(selectedPeriod.pay_date)}`}
                                        >
                                          Late
                                        </span>
                                      ) : null
                                    )}
                                  </div>
                                  <div>Method: {record.method?.replace('_', ' ')}</div>
                                  <div>Ref: {record.reference_no}</div>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">—</span>
                              )}
                            </td>

                            {/* Individual Tag Actions */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1">

                              {/* Tag Paid / Mark Paid button */}
                              {record.status !== 'paid' && record.status !== 'cancelled' && (
                                <button
                                  id={`btn-mark-paid-${record.id}`}
                                  onClick={() => handleOpenMarkPaid(record)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[11px] shadow-xs cursor-pointer inline-flex items-center gap-1"
                                  title="Tag this employee as Paid with transaction reference"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Tag Paid</span>
                                </button>
                              )}

                              {/* Hold Tag */}
                              {record.status !== 'on_hold' && record.status !== 'paid' && record.status !== 'cancelled' && (
                                <button
                                  onClick={() => {
                                    setHoldingRecord(record);
                                    setHoldReason('');
                                  }}
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded font-medium text-[11px] cursor-pointer"
                                >
                                  Hold
                                </button>
                              )}

                              {/* Release Hold */}
                              {record.status === 'on_hold' && (
                                <button
                                  onClick={() => updatePaymentStatus(record.id, 'pending')}
                                  className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded font-medium text-[11px] cursor-pointer"
                                >
                                  Release Hold
                                </button>
                              )}

                              {/* Send / Resend Receipt Email for Paid records */}
                              {record.status === 'paid' && (
                                <button
                                  id={`btn-resend-receipt-${record.id}`}
                                  onClick={() => handleQuickSendReceipt(record)}
                                  disabled={resendingReceiptId === record.id}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-semibold text-[11px] cursor-pointer inline-flex items-center gap-1 shadow-2xs transition-colors disabled:opacity-50"
                                  title="Send payment disbursement receipt email to employee"
                                >
                                  {resendingReceiptId === record.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />
                                  ) : (
                                    <Mail className="w-3 h-3 text-emerald-700" />
                                  )}
                                  <span>{resendingReceiptId === record.id ? 'Sending...' : 'Email Receipt'}</span>
                                </button>
                              )}

                              {/* Retag Paid Record if needed */}
                              {record.status === 'paid' && (
                                <button
                                  onClick={() => handleOpenMarkPaid(record)}
                                  className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-medium text-[11px] cursor-pointer"
                                  title="Edit disbursement details or update reference"
                                >
                                  Edit Ref
                                </button>
                              )}

                              {/* Cancel Tag */}
                              {record.status !== 'paid' && record.status !== 'cancelled' && (
                                <button
                                  onClick={() => {
                                    setCancellingRecord(record);
                                    setCancelReason('');
                                  }}
                                  className="px-2 py-1 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded font-medium text-[11px] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Summary Footer */}
                    <tfoot>
                      <tr className="bg-slate-50/90 font-bold border-t-2 border-slate-200 text-slate-900 text-xs">
                        <td colSpan={2} className="py-3 px-4">
                          TOTAL ({filteredPeriodPayments.length} of {currentPeriodPayments.length} records shown)
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {formatDecimalHours(filteredPeriodPayments.reduce((s, p) => s + (p.total_hours || 0), 0))} h
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-normal">
                          Sum across employees
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-700 text-sm">
                          {formatCurrency(filteredPeriodPayments.reduce((s, p) => s + (p.gross_amount || 0), 0))}
                        </td>
                        <td colSpan={3} className="py-3 px-4 text-slate-500 font-normal text-right">
                          {paidPayments.length} Tagged Paid • {pendingPayments.length} Pending
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile Employee Payment Cards */}
                <div className="md:hidden divide-y divide-slate-100 text-xs">
                  {filteredPeriodPayments.map((record) => {
                    const user = visibleUsers.find(
                      (u) =>
                        u.id === record.user_id ||
                        (u.email && record.user_id && u.email.toLowerCase() === record.user_id.toLowerCase()) ||
                        (u.employee_no && u.employee_no === record.user_id)
                    );
                    return (
                      <div key={record.id} className="p-3.5 space-y-2.5">
                        {/* Top row: Employee & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 text-sm">
                              {user?.first_name} {user?.last_name}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {user?.employee_no} • {user?.department}
                            </div>
                          </div>

                          <span
                            className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              record.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : record.status === 'processing'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : record.status === 'on_hold'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : record.status === 'cancelled'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {record.status.toUpperCase().replace('_', ' ')}
                          </span>
                        </div>

                        {record.status === 'on_hold' && record.status_reason && (
                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 break-words">
                            <strong>Hold Reason:</strong> {record.status_reason}
                          </div>
                        )}

                        {/* Bank / eWallet Payout Account */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200">
                          {user?.bank_name || user?.account_no ? (
                            <>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="font-semibold text-slate-800">{user.bank_name || 'Bank/Wallet'}</span>
                                {user.account_no && (
                                  <span className="font-mono text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[11px] break-all">
                                    {user.account_no}
                                  </span>
                                )}
                              </div>
                              {user.account_no && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(user.account_no!, `m-${record.id}`)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-700 cursor-pointer shrink-0"
                                >
                                  {copiedId === `m-${record.id}` ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-700">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-amber-800 font-medium">
                              No bank / eWallet info on profile
                            </span>
                          )}
                        </div>

                        {/* Hours & Gross Payable */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-50/70 border border-slate-200 rounded-lg p-2.5 font-mono">
                          <div>
                            <span className="text-[10px] text-slate-400 font-sans block">Approved Hours</span>
                            <span className="font-semibold text-slate-900">
                              {formatDecimalHours(record.total_hours)} h
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-sans block">Gross Payable</span>
                            <span className="font-bold text-emerald-700 text-sm">
                              {formatCurrency(record.gross_amount)}
                            </span>
                          </div>
                        </div>

                        {/* Wage & Bonus Lines */}
                        {record.lines && record.lines.length > 0 && (
                          <div className="space-y-1">
                            {record.lines.map((line, idx) =>
                              line.line_type === 'hours' ? (
                                <div key={line.id || idx} className="text-[11px] font-mono text-slate-600">
                                  {formatDecimalHours(line.hours)}h @ {formatCurrency(line.hourly_rate)} = {formatCurrency(line.amount)}
                                </div>
                              ) : (
                                <div
                                  key={line.id || idx}
                                  className="flex items-center justify-between gap-1 text-[11px] bg-emerald-50/80 border border-emerald-200 rounded-md px-2 py-1 text-emerald-900"
                                >
                                  <div className="flex items-center gap-1 min-w-0 flex-wrap">
                                    <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span className="font-semibold">{line.category || 'Addition'}:</span>
                                    <span className="font-mono font-bold text-emerald-700">+{formatCurrency(line.amount)}</span>
                                  </div>
                                  {record.status !== 'paid' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAdditionalLine(record.id, line.id, line.category || line.description)}
                                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                                      title="Remove additional payment"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {/* Disbursement Info if Paid */}
                        {record.status === 'paid' && record.paid_at && (
                          <div className="text-[11px] font-mono text-slate-600 bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 space-y-0.5">
                            <div className="text-emerald-800 font-semibold flex flex-wrap items-center gap-1.5">
                              <span>Paid: {formatDate(record.paid_at)}</span>
                              {selectedPeriod?.pay_date && (
                                record.paid_at.slice(0, 10) < selectedPeriod.pay_date ? (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 rounded border border-emerald-200">
                                    Advanced
                                  </span>
                                ) : record.paid_at.slice(0, 10) > selectedPeriod.pay_date ? (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 rounded border border-amber-200">
                                    Late
                                  </span>
                                ) : null
                              )}
                            </div>
                            <div className="capitalize">Method: {record.method?.replace('_', ' ')}</div>
                            <div className="break-all">Ref: {record.reference_no}</div>
                          </div>
                        )}

                        {/* Individual Tag Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {record.status !== 'paid' && record.status !== 'cancelled' && (
                            <button
                              id={`mobile-btn-mark-paid-${record.id}`}
                              onClick={() => handleOpenMarkPaid(record)}
                              className="flex-1 min-h-[36px] justify-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Tag Paid</span>
                            </button>
                          )}

                          {record.status !== 'on_hold' && record.status !== 'paid' && record.status !== 'cancelled' && (
                            <button
                              onClick={() => {
                                setHoldingRecord(record);
                                setHoldReason('');
                              }}
                              className="min-h-[36px] px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-medium text-xs cursor-pointer"
                            >
                              Hold
                            </button>
                          )}

                          {record.status === 'on_hold' && (
                            <button
                              onClick={() => updatePaymentStatus(record.id, 'pending')}
                              className="min-h-[36px] px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-lg font-medium text-xs cursor-pointer"
                            >
                              Release Hold
                            </button>
                          )}

                          {record.status === 'paid' && (
                            <>
                              <button
                                onClick={() => handleQuickSendReceipt(record)}
                                disabled={resendingReceiptId === record.id}
                                className="flex-1 min-h-[36px] px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-semibold text-xs cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
                              >
                                {resendingReceiptId === record.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                                ) : (
                                  <Mail className="w-3.5 h-3.5 text-emerald-700" />
                                )}
                                <span>{resendingReceiptId === record.id ? 'Sending Email...' : 'Email Receipt'}</span>
                              </button>
                              <button
                                onClick={() => handleOpenMarkPaid(record)}
                                className="min-h-[36px] px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium text-xs cursor-pointer"
                              >
                                Edit Ref
                              </button>
                            </>
                          )}

                          {record.status !== 'paid' && record.status !== 'cancelled' && (
                            <button
                              onClick={() => {
                                setCancellingRecord(record);
                                setCancelReason('');
                              }}
                              className="min-h-[36px] px-3 py-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg font-medium text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Mobile Grand Total Footer */}
                  <div className="p-3.5 bg-slate-50/95 border-t-2 border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span className="uppercase text-[11px] tracking-wider">
                        TOTAL ({filteredPeriodPayments.length} of {currentPeriodPayments.length})
                      </span>
                      <span className="font-mono text-emerald-700 text-sm">
                        {formatCurrency(filteredPeriodPayments.reduce((s, p) => s + (p.gross_amount || 0), 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                      <span>
                        Hours: {formatDecimalHours(filteredPeriodPayments.reduce((s, p) => s + (p.total_hours || 0), 0))} h
                      </span>
                      <span className="font-sans">
                        {paidPayments.length} Paid • {pendingPayments.length} Pending
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Individual Mark / Tag Paid Modal */}
      {payingRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[92dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                  {payingRecord.status === 'paid' ? 'Edit Disbursement & Resend Receipt' : 'Record Payment Disbursement'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPayingRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payee Disbursement Details Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Payee & Payout Account Information
              </span>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Employee Name</span>
                  <span className="font-bold text-slate-900 text-[13px]">
                    {payingUser?.first_name} {payingUser?.last_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Department / Rate</span>
                  <span className="font-medium text-slate-800 text-[13px]">{payingUser?.department}</span>
                  <span className="text-xs text-slate-500 block font-mono">
                    {formatCurrency(payingUser?.hourly_rate || 0)}/hr
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Bank / eWallet Name</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1 text-[13px]">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    {payingUser?.bank_name || <span className="text-amber-700 font-normal italic">Not provided</span>}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Account / Mobile No.</span>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="font-mono font-bold text-slate-900 text-[13px] break-all">
                      {payingUser?.account_no || <span className="text-amber-700 font-normal italic">Not provided</span>}
                    </span>
                    {payingUser?.account_no && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(payingUser.account_no!, 'modal')}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 shadow-2xs cursor-pointer"
                        title="Copy Account Number"
                      >
                        {copiedId === 'modal' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Earnings Itemized Breakdown */}
            {payingRecord.lines && payingRecord.lines.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5 text-xs">
                <div className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                  Payment Calculation Breakdown
                </div>
                <div className="space-y-1 divide-y divide-slate-100">
                  {payingRecord.lines.map((line, idx) => (
                    <div key={idx} className="pt-1 flex items-start justify-between gap-2 text-xs">
                      <span className="text-slate-600 font-medium break-words">
                        {line.line_type === 'hours'
                          ? `Base Hourly Wage (${formatDecimalHours(line.hours)}h @ ${formatCurrency(line.hourly_rate)})`
                          : line.category || line.description || 'Additional Payment'}
                      </span>
                      <span className="font-mono font-bold text-slate-900 shrink-0">
                        {formatCurrency(line.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-1.5 flex items-center justify-between gap-2 font-bold text-xs text-emerald-800">
                    <span>Total Disbursable Gross Pay</span>
                    <span className="font-mono text-sm shrink-0">{formatCurrency(payingRecord.gross_amount)}</span>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleConfirmPaid} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1 text-xs">
                    Payment Date <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1 text-xs">
                    Disbursement Method <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full p-2 min-h-[40px] bg-white border border-slate-300 rounded-lg outline-none capitalize"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="ewallet">E-Wallet</option>
                    <option value="direct_deposit">Direct Deposit</option>
                    <option value="check">Paper Check</option>
                    <option value="cash">Cash Voucher</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <label className="block font-medium text-slate-700">
                    Transaction Reference / Confirmation No. <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const bName = (payingUser?.bank_name || '').toLowerCase();
                      const prefix = bName.includes('gcash')
                        ? 'GCASH'
                        : bName.includes('maya')
                        ? 'MAYA'
                        : bName
                        ? bName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
                        : 'BNK';
                      setRefNumber(`${prefix}-${Date.now().toString().slice(-6)}`);
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    Auto-Generate Ref
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="e.g. GCASH-881923, TXN-9948201 or Reference No."
                  className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none font-mono text-xs"
                />
              </div>

              {/* Email Receipt Notification Option */}
              <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 text-xs space-y-1.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmailNotification}
                    onChange={(e) => setSendEmailNotification(e.target.checked)}
                    className="mt-0.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Email disbursement confirmation receipt to employee</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug break-words">
                      {payingUser?.email ? (
                        <>
                          An official receipt with breakdown and reference will be sent to <strong className="text-emerald-900 break-all">{payingUser.email}</strong>.
                        </>
                      ) : (
                        <span className="text-amber-700 font-medium">
                          No email address found on profile. Enter employee recipient email below:
                        </span>
                      )}
                    </p>
                  </div>
                </label>

                {sendEmailNotification && !payingUser?.email && (
                  <div className="pt-1.5 sm:pl-6.5">
                    <input
                      type="email"
                      required
                      placeholder="e.g. employee@company.com"
                      value={customRecipientEmail}
                      onChange={(e) => setCustomRecipientEmail(e.target.value)}
                      className="w-full p-2 min-h-[40px] border border-emerald-300 rounded-lg outline-none bg-white font-sans text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayingRecord(null)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="justify-center px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  {isSubmittingPayment ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Confirming &amp; Sending...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{payingRecord.status === 'paid' ? 'Save & Send Receipt' : 'Confirm Individual Payment'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Place On Hold Modal */}
      {holdingRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-slate-900 text-base">Place Payment on Hold</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This note will be displayed in the employee&apos;s payment portal so they know why their disbursement
              is held without contacting HR.
            </p>

            <form onSubmit={handleConfirmHold} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Hold Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="e.g. Bank account details need re-verification following routing number change"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none resize-none"
                />
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setHoldingRecord(null)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Place On Hold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Payment Modal */}
      {cancellingRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-slate-900 text-base">Cancel Payment Record</h3>
            <form onSubmit={handleConfirmCancel} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Cancellation Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="State reason for cancellation..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none resize-none"
                />
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancellingRecord(null)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Cancel Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Additional Payment / Allowance Modal */}
      {isAddPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92dvh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">Add Additional Payment / Allowance</h3>
                  <p className="text-xs text-slate-500">
                    Add bonuses, allowances, or other earnings additions for this pay period.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAddPayment} className="space-y-4 text-xs">
              {/* Target / Application Scope Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Apply Additional Payment To <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAddPaymentTarget('all')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      addPaymentTarget === 'all'
                        ? 'bg-emerald-50/70 border-emerald-500 text-emerald-950 shadow-2xs ring-1 ring-emerald-400'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${addPaymentTarget === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs">All Employees</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                        Apply equally to all active employees in period
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddPaymentTarget('individual')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      addPaymentTarget === 'individual'
                        ? 'bg-emerald-50/70 border-emerald-500 text-emerald-950 shadow-2xs ring-1 ring-emerald-400'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${addPaymentTarget === 'individual' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs">Individual Employee</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                        Apply to one specific employee only
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Individual Employee Selection Dropdown */}
              {addPaymentTarget === 'individual' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 animate-in fade-in">
                  <label className="block font-semibold text-slate-700">
                    Select Employee <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={selectedUserIdForAdd}
                    onChange={(e) => setSelectedUserIdForAdd(e.target.value)}
                    required
                    className="w-full p-2 min-h-[40px] bg-white border border-slate-300 rounded-lg outline-none font-medium text-xs"
                  >
                    <option value="" disabled>-- Choose an Employee --</option>
                    {visibleUsers
                      .filter((u) => u.role === 'employee' || u.clocks_in)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} ({u.employee_no || 'No ID'} • {u.department || 'Staff'})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Payment Category Presets & Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Payment Category / Purpose <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                  {CATEGORY_PRESETS.map((preset) => {
                    const IconComponent = preset.icon;
                    const isSelected = paymentCategory === preset.label;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setPaymentCategory(preset.label);
                          if (preset.label !== 'Custom') {
                            setPaymentDescription(preset.label);
                          }
                        }}
                        className={`p-2 min-h-[38px] rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer text-xs ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-white font-semibold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : preset.color}`} />
                        <span className="truncate">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>

                {paymentCategory === 'Custom' && (
                  <div className="mt-2 animate-in fade-in">
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="e.g. Relocation Allowance, Hazard Pay, Project Incentive"
                      className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none font-medium text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Amount Input with Presets */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Additional Amount <span className="text-rose-600">*</span>
                </label>
                <div className="relative mb-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 font-mono">
                    ₱
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 min-h-[42px] text-base font-bold font-mono border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
                {/* Quick Amount Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-medium mr-1">Quick:</span>
                  {AMOUNT_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPaymentAmount(String(amt))}
                      className="px-2.5 py-1 min-h-7 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-mono font-medium text-slate-700 cursor-pointer"
                    >
                      +₱{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description / Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Remarks / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  placeholder="e.g. Q3 Performance Excellence Bonus, Transportation stipend for client visits"
                  className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none text-xs"
                />
              </div>

              {/* Summary Impact Preview */}
              {paymentAmount && parseFloat(paymentAmount) > 0 && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1 text-emerald-950 animate-in fade-in">
                  <div className="font-bold flex items-center justify-between text-xs">
                    <span>Summary Preview:</span>
                    <span className="font-mono text-emerald-700 text-sm">
                      +{formatCurrency(parseFloat(paymentAmount))}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    {addPaymentTarget === 'all'
                      ? `Will add ${formatCurrency(parseFloat(paymentAmount))} to all eligible employees in this period. This will increase gross payable and reflect on payslips.`
                      : `Will add ${formatCurrency(parseFloat(paymentAmount))} to the total earnings of selected employee for this period.`}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddPaymentModalOpen(false)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAddPayment}
                  className="justify-center px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  {isSubmittingAddPayment ? (
                    <span>Adding...</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Add Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DTR Finalization Reminder Modal */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92dvh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Remind Employees to Finalize DTR
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formatMonthYear(reminderMonth)} &middot; Deadline{' '}
                    <strong className="text-slate-700">{formatDate(reminderDeadline)}</strong>{' '}
                    ({reminderDaysLeft === 0 ? 'due today' : `${reminderDaysLeft} day${reminderDaysLeft === 1 ? '' : 's'} left`})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReminderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {unfinalizedEmployees.length === 0 ? (
              <div className="flex flex-col items-center text-center gap-2 py-8 text-xs text-slate-600">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
                <span className="font-semibold text-slate-900 text-sm">Everyone has finalized</span>
                <span>All active employees have finalized their {formatMonthYear(reminderMonth)} time logs.</span>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-600">
                  <strong className="text-slate-900">{unfinalizedEmployees.length}</strong> employee
                  {unfinalizedEmployees.length === 1 ? ' has' : 's have'} not finalized their time logs. Each one gets an
                  email asking them to review and finalize before the last day of the month.
                </p>

                <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {unfinalizedEmployees.map(({ user, shifts, hours, openSessions }) => {
                    const status = reminderStatus[user.id];
                    const isSendingThis = reminderSending === user.id || reminderSending === 'all';
                    const hasEmail = Boolean(user.email && user.email.includes('@'));
                    return (
                      <div key={user.id} className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 p-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {user.first_name} {user.last_name}
                            {user.employee_no && (
                              <span className="ml-1.5 font-mono text-[10px] text-slate-500">{user.employee_no}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {hasEmail ? user.email : <span className="text-rose-600">No email on file</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {shifts} shift{shifts === 1 ? '' : 's'} &middot; {formatDecimalHours(hours)} h logged
                            {openSessions > 0 && (
                              <span className="ml-1.5 text-rose-600 font-semibold">
                                &middot; {openSessions} open session{openSessions === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {status && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                status.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                              title={status.error || undefined}
                            >
                              {status.success ? (status.simulated ? 'Simulated' : 'Sent') : 'Failed'}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSendFinalizeReminders(user.id)}
                            disabled={!hasEmail || Boolean(reminderSending)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[34px] bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            {isSendingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Mail className="w-3.5 h-3.5 text-slate-600" />
                            )}
                            <span>{status?.success ? 'Resend' : 'Send'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReminderModalOpen(false)}
                className="px-4 py-2 min-h-[40px] text-xs text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
              >
                Close
              </button>
              {unfinalizedEmployees.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleSendFinalizeReminders()}
                  disabled={Boolean(reminderSending)}
                  className="justify-center px-4 py-2 min-h-[40px] bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  {reminderSending === 'all' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send to All ({unfinalizedEmployees.length})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
