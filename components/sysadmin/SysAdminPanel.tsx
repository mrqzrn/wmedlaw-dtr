'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context';
import {
  ShieldAlert,
  Settings,
  Users,
  Unlock,
  RotateCcw,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { User, SystemSettings, PayFrequency, DEFAULT_HOURLY_WAGE } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils-dtr';

export function SysAdminPanel() {
  const {
    users,
    settings,
    updateSettings,
    createUser,
    updateUser,
    setHourlyWage,
    payPeriods,
    payments,
    reopenPayPeriod,
    reversePayment,
    purgePeriodRetention,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'admins' | 'settings' | 'periods' | 'retention'>('admins');

  // Admin account modal state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [adminFirst, setAdminFirst] = useState('');
  const [adminLast, setAdminLast] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminClocksIn, setAdminClocksIn] = useState(false);
  const [adminWage, setAdminWage] = useState(DEFAULT_HOURLY_WAGE.toFixed(2));
  const [adminFrequency, setAdminFrequency] = useState<PayFrequency>('monthly');

  // Reopen period modal
  const [reopenPeriodId, setReopenPeriodId] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenModal, setShowReopenModal] = useState(false);

  // Reverse payment modal
  const [reversePaymentId, setReversePaymentId] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [showReverseModal, setShowReverseModal] = useState(false);

  // Retention purge state
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [selectedPurgePeriodId, setSelectedPurgePeriodId] = useState('');

  // List of all admins (excluding hidden sysadmin)
  const adminUsers = users.filter((u) => u.role === 'admin');

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<SystemSettings>(settings);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(settingsForm);
    alert('System settings updated successfully.');
  };

  const handleSaveAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAdmin) {
      updateUser({
        ...editingAdmin,
        first_name: adminFirst,
        last_name: adminLast,
        email: adminEmail,
        clocks_in: adminClocksIn,
        pay_frequency: adminFrequency,
      });
      if (adminClocksIn) {
        setHourlyWage(
          editingAdmin.id,
          parseFloat(adminWage) || 45.0,
          new Date().toISOString().slice(0, 10),
          'Admin wage updated by System Administrator'
        );
      }
    } else {
      createUser({
        username: adminUsername,
        email: adminEmail,
        first_name: adminFirst,
        last_name: adminLast,
        employee_no: `ADM-${Math.floor(1000 + Math.random() * 9000)}`,
        position: 'Operations Administrator',
        department: 'Admin & Payroll',
        contact_no: '+1 (555) 019-2831',
        role: 'admin',
        status: 'active',
        is_hidden: false,
        clocks_in: adminClocksIn,
        hourly_rate: adminClocksIn ? parseFloat(adminWage) || DEFAULT_HOURLY_WAGE : 0,
        pay_frequency: adminFrequency,
        hire_date: new Date().toISOString().slice(0, 10),
      });
    }
    setShowAdminModal(false);
    setEditingAdmin(null);
  };

  const handleConfirmReopen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenPeriodId || !reopenReason.trim()) {
      alert('Period selection and permanent reason are required.');
      return;
    }
    const res = reopenPayPeriod(reopenPeriodId, reopenReason);
    if (res.success) {
      setShowReopenModal(false);
      setReopenReason('');
      alert(res.message);
    } else {
      alert(res.message);
    }
  };

  const handleConfirmReverse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversePaymentId || !reverseReason.trim()) {
      alert('Payment selection and permanent reason are required.');
      return;
    }
    const res = reversePayment(reversePaymentId, reverseReason);
    if (res.success) {
      setShowReverseModal(false);
      setReverseReason('');
      alert(res.message);
    } else {
      alert(res.message);
    }
  };

  const handleExecutePurge = () => {
    if (purgeConfirmText !== 'PURGE') {
      alert('You must type PURGE to confirm.');
      return;
    }
    if (!selectedPurgePeriodId) {
      alert('Please select an archived period to purge.');
      return;
    }
    const res = purgePeriodRetention(selectedPurgePeriodId);
    setShowPurgeModal(false);
    setPurgeConfirmText('');
    alert(res.message);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-purple-600 shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              System Administrator Controls
            </h1>
          </div>
          <p className="text-xs text-slate-600">
            Exclusive super-admin privilege: Admin wage management, system configuration, period unlocks, and retention.
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-800 px-3 py-1.5 rounded-lg text-xs font-semibold w-full md:w-auto shrink-0">
          <span>ROOT PRIVILEGES ACTIVE</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto scrollbar-none">
        <button
          id="tab-sysadmin-admins"
          onClick={() => setActiveTab('admins')}
          className={`pb-3 px-3 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'admins'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Manage Admin Accounts & Wages
        </button>
        <button
          id="tab-sysadmin-settings"
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-3 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'settings'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          System-Wide Rules & Settings
        </button>
        <button
          id="tab-sysadmin-periods"
          onClick={() => setActiveTab('periods')}
          className={`pb-3 px-3 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'periods'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Period Unlock & Payment Reversals
        </button>
        <button
          id="tab-sysadmin-retention"
          onClick={() => setActiveTab('retention')}
          className={`pb-3 px-3 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'retention'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Data Retention & Archiving
        </button>
      </div>

      {/* 1. Manage Admin Accounts */}
      {activeTab === 'admins' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <p className="text-xs text-slate-600">
              Only the System Administrator sets and updates Admin wages. Regular admins cannot see or modify them.
            </p>
            <button
              onClick={() => {
                setEditingAdmin(null);
                setAdminFirst('');
                setAdminLast('');
                setAdminUsername('');
                setAdminEmail('');
                setAdminClocksIn(false);
                setAdminWage('45.00');
                setShowAdminModal(true);
              }}
              className="w-full sm:w-auto px-3.5 py-2 min-h-[40px] bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 shadow-xs shrink-0 cursor-pointer"
            >
              + Create Admin Account
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Administrator</th>
                    <th className="py-3 px-4">Clocks In & Paid?</th>
                    <th className="py-3 px-4">Hourly Wage (SysAdmin Only)</th>
                    <th className="py-3 px-4">Pay Frequency</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
                  {adminUsers.map((admin) => (
                    <tr key={admin.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {admin.first_name} {admin.last_name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {admin.employee_no} • {admin.email}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {admin.clocks_in ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Yes (Staff UI Enabled)
                          </span>
                        ) : (
                          <span className="text-slate-400">No (Management Only)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        {admin.clocks_in ? `${formatCurrency(admin.hourly_rate)} / hr` : '—'}
                      </td>
                      <td className="py-3.5 px-4 capitalize font-medium">
                        {admin.clocks_in ? admin.pay_frequency.replace('_', ' ') : '—'}
                      </td>
                      <td className="py-3.5 px-4 capitalize">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {admin.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditingAdmin(admin);
                            setAdminFirst(admin.first_name);
                            setAdminLast(admin.last_name);
                            setAdminUsername(admin.username);
                            setAdminEmail(admin.email);
                            setAdminClocksIn(admin.clocks_in);
                            setAdminWage(admin.hourly_rate.toString());
                            setAdminFrequency(admin.pay_frequency);
                            setShowAdminModal(true);
                          }}
                          className="text-xs text-purple-700 hover:text-purple-900 font-semibold cursor-pointer"
                        >
                          Edit / Set Wage →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Admin Cards */}
            <div className="md:hidden divide-y divide-slate-100 text-xs">
              {adminUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  No administrator accounts configured.
                </div>
              ) : (
                adminUsers.map((admin) => (
                  <div key={admin.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-sm">
                          {admin.first_name} {admin.last_name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono break-all">
                          {admin.employee_no} • {admin.email}
                        </div>
                      </div>
                      <span className="shrink-0 capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {admin.status}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <span className="text-[10px] text-slate-400 block">Clock-In & Staff UI</span>
                        {admin.clocks_in ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Yes (Staff UI Enabled)
                          </span>
                        ) : (
                          <span className="text-slate-500">No (Management Only)</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Hourly Wage</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {admin.clocks_in ? `${formatCurrency(admin.hourly_rate)}/hr` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Pay Frequency</span>
                        <span className="capitalize font-medium text-slate-700">
                          {admin.clocks_in ? admin.pay_frequency.replace('_', ' ') : '—'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEditingAdmin(admin);
                        setAdminFirst(admin.first_name);
                        setAdminLast(admin.last_name);
                        setAdminUsername(admin.username);
                        setAdminEmail(admin.email);
                        setAdminClocksIn(admin.clocks_in);
                        setAdminWage(admin.hourly_rate.toString());
                        setAdminFrequency(admin.pay_frequency);
                        setShowAdminModal(true);
                      }}
                      className="w-full py-2 min-h-[38px] rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-semibold cursor-pointer"
                    >
                      Edit / Set Wage →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. System Settings */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
                Pay Frequency & Calendar Configuration
              </h2>
              <p className="text-xs text-slate-500">
                Configure supported frequencies, week start rules, and holiday/weekend pay day roll behaviors.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Monthly Pay Date Rule (Primary)</label>
                <select
                  value={settingsForm.pay_date_rule_monthly || '1st'}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      pay_date_rule_monthly: e.target.value as '1st' | 'end_of_month',
                    })
                  }
                  className="w-full p-2 min-h-[40px] bg-white border border-slate-300 rounded-lg outline-none font-medium"
                >
                  <option value="1st">1st of Following Month (Standard)</option>
                  <option value="end_of_month">End of Current Month (Last Day)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Weekend / Holiday Pay Date Rule</label>
                <select
                  value={settingsForm.weekend_pay_date_handling}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      weekend_pay_date_handling: e.target.value as 'previous_business_day' | 'next_business_day',
                    })
                  }
                  className="w-full p-2 min-h-[40px] bg-white border border-slate-300 rounded-lg outline-none font-medium"
                >
                  <option value="previous_business_day">Pay Friday Before (Previous Business Day)</option>
                  <option value="next_business_day">Pay Monday After (Next Business Day)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Semi-Monthly Pay Date Rule</label>
                <select
                  value={settingsForm.pay_date_rule_semi_monthly}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      pay_date_rule_semi_monthly: e.target.value as '16th_and_1st' | '15th_and_end',
                    })
                  }
                  className="w-full p-2 min-h-[40px] bg-white border border-slate-300 rounded-lg outline-none"
                >
                  <option value="16th_and_1st">16th & 1st of month</option>
                  <option value="15th_and_end">15th & End of month</option>
                </select>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
                DTR Submission & Quality Rules
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Enforce mandatory accomplishment remarks and set minimum descriptive thresholds.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Minimum Character Length for Accomplishments
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={settingsForm.remarks_min_length}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, remarks_min_length: parseInt(e.target.value) || 0 })
                    }
                    className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Staff must write at least this many characters before clocking out.
                  </p>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Compliance Retention Lifespan (Years)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={settingsForm.retention_period_years}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, retention_period_years: parseInt(e.target.value) || 5 })
                    }
                    className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Legal record retention window before data can be purged.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                Save System Configuration
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 3. Period Unlock & Payment Reversals */}
      {activeTab === 'periods' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Reopen Locked Period */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4 text-xs">
              <div className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900">Reopen Locked Pay Period</h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Only the System Administrator can unlock a closed/locked pay period. A written justification is
                permanently etched into the system compliance audit log.
              </p>
              <button
                onClick={() => setShowReopenModal(true)}
                className="w-full py-2.5 min-h-[42px] bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Unlock a Pay Period
              </button>
            </div>

            {/* Reverse a Paid Payment */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4 text-xs">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900">Reverse Paid Payment Record</h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Reverse a disbursement marked as Paid back to Processing/Pending state. Requires root authorization
                and permanent justification reason.
              </p>
              <button
                onClick={() => setShowReverseModal(true)}
                className="w-full py-2.5 min-h-[42px] bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Reverse Payment Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Data Retention */}
      {activeTab === 'retention' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5 text-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
              Data Retention, Archiving, & Legal Purge
            </h2>
            <p className="text-slate-500">
              Configure compliance retention lifespan and execute confirmed archives or permanent deletions.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="font-semibold text-slate-800">Current Retention Policy:</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-base font-bold text-slate-900">
                {settings.retention_period_years} Years
              </span>
              <span className="text-slate-500">
                (All timesheet records older than {settings.retention_period_years} years are eligible for compliance purge)
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                alert('Archive data package downloaded. (JSON format containing historic DTR and Wage logs)');
              }}
              className="justify-center inline-flex items-center gap-2 px-4 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" /> Download Full Data Archive (JSON)
            </button>

            <button
              onClick={() => setShowPurgeModal(true)}
              className="justify-center inline-flex items-center gap-2 px-4 py-2 min-h-[40px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-lg cursor-pointer"
            >
              <Trash2 className="w-4 h-4 shrink-0" /> Purge Expired Period Records
            </button>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-semibold text-slate-900 text-base">
              {editingAdmin ? 'Configure Admin Account & Wage' : 'Create New Administrator'}
            </h3>

            <form onSubmit={handleSaveAdmin} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={adminFirst}
                    onChange={(e) => setAdminFirst(e.target.value)}
                    className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={adminLast}
                    onChange={(e) => setAdminLast(e.target.value)}
                    className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none"
                />
              </div>

              {!editingAdmin && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              )}

              {/* Toggle: Admin Clocks In and is Paid */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="admin-clocks-in"
                    checked={adminClocksIn}
                    onChange={(e) => setAdminClocksIn(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-0 shrink-0"
                  />
                  <label htmlFor="admin-clocks-in" className="font-semibold text-slate-900">
                    This admin clocks in and is paid hourly
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">
                  If enabled, they receive the employee clocking interface alongside the admin console, appear in pay periods,
                  and their wage is strictly governed by the System Administrator.
                </p>

                {adminClocksIn && (
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Hourly Wage (₱)</label>
                      <input
                        type="number"
                        step="0.5"
                        required
                        value={adminWage}
                        onChange={(e) => setAdminWage(e.target.value)}
                        className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Pay Frequency</label>
                      <select
                        value={adminFrequency}
                        onChange={(e) => setAdminFrequency(e.target.value as PayFrequency)}
                        className="w-full p-2 min-h-[40px] bg-white border border-slate-300 rounded-lg outline-none capitalize"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="semi_monthly">Semi-Monthly</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Save Administrator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Period Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-semibold text-slate-900 text-base">Reopen Locked Pay Period</h3>
            <form onSubmit={handleConfirmReopen} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Select Period to Unlock</label>
                <select
                  required
                  value={reopenPeriodId}
                  onChange={(e) => setReopenPeriodId(e.target.value)}
                  className="w-full p-2 min-h-[40px] bg-white border border-slate-300 rounded-lg outline-none"
                >
                  <option value="">Select period...</option>
                  {payPeriods
                    .filter((p) => p.status === 'locked' || p.status === 'closed')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatDate(p.start_date)} → {formatDate(p.end_date)} ({p.frequency}) - {p.status.toUpperCase()}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Permanent Reopen Justification <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g., Department audit found missing shift adjustment needing manual entry."
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none resize-none"
                />
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Authorize Reopen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse Payment Modal */}
      {showReverseModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-semibold text-slate-900 text-base">Reverse Paid Payment Record</h3>
            <form onSubmit={handleConfirmReverse} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Select Paid Record</label>
                <select
                  required
                  value={reversePaymentId}
                  onChange={(e) => setReversePaymentId(e.target.value)}
                  className="w-full p-2 min-h-[40px] bg-white border border-slate-300 rounded-lg outline-none"
                >
                  <option value="">Select paid disbursement...</option>
                  {payments
                    .filter((p) => p.status === 'paid')
                    .map((p) => {
                      const u = users.find((user) => user.id === p.user_id);
                      return (
                        <option key={p.id} value={p.id}>
                          {u?.first_name} {u?.last_name} — {formatCurrency(p.gross_amount)} (Paid: {p.paid_at || 'Recorded'})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Reason for Reversal <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="e.g. Bank ACH returned due to incorrect account number, reissuing payment"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none resize-none"
                />
              </div>

              <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReverseModal(false)}
                  className="px-4 py-2 min-h-[40px] text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Execute Reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purge Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-slate-200 w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 pb-safe space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-semibold text-rose-700 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" /> Permanent Data Purge
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This action permanently destroys all DTR sessions, revisions, and closed payment logs for the selected pay period.
              This operation cannot be undone.
            </p>

            <div className="text-xs space-y-2">
              <label className="block font-medium text-slate-700">Select Period to Purge:</label>
              <select
                value={selectedPurgePeriodId}
                onChange={(e) => setSelectedPurgePeriodId(e.target.value)}
                className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg outline-none bg-white"
              >
                <option value="">Select pay period...</option>
                {payPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatDate(p.start_date)} → {formatDate(p.end_date)} ({p.frequency}) - Status: {p.status.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs space-y-2">
              <label className="block font-medium text-slate-700">Type PURGE to confirm deletion:</label>
              <input
                type="text"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                placeholder="PURGE"
                className="w-full p-2 min-h-[40px] border border-slate-300 rounded-lg font-mono outline-none uppercase"
              />
            </div>

            <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="px-4 py-2 min-h-[40px] text-xs text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={purgeConfirmText !== 'PURGE' || !selectedPurgePeriodId}
                onClick={handleExecutePurge}
                className="px-4 py-2 min-h-[40px] text-xs bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Permanently Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
