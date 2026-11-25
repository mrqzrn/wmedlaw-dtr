'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { User, Phone, Mail, MapPin, ShieldAlert, KeyRound, Check, CreditCard, Building2, Wallet, RefreshCw } from 'lucide-react';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { formatDate, formatCurrency } from '@/lib/utils-dtr';

export function EmployeeProfile() {
  const { currentUser, updateUser } = useApp();

  const [firstName, setFirstName] = useState(currentUser.first_name || '');
  const [lastName, setLastName] = useState(currentUser.last_name || '');
  const [position, setPosition] = useState(currentUser.position || '');
  const [contactNo, setContactNo] = useState(currentUser.contact_no || '');
  const [address, setAddress] = useState(currentUser.address || '');
  const [emergencyContact, setEmergencyContact] = useState(
    (currentUser.emergency_contact || '').replace(/\s*\[PAYOUT:.*?\]/g, '').trim()
  );
  const [bankName, setBankName] = useState(currentUser.bank_name || '');
  const [accountNo, setAccountNo] = useState(currentUser.account_no || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFirstName(currentUser.first_name || '');
    setLastName(currentUser.last_name || '');
    setPosition(currentUser.position || '');
    setContactNo(currentUser.contact_no || '');
    setAddress(currentUser.address || '');
    setEmergencyContact(
      (currentUser.emergency_contact || '').replace(/\s*\[PAYOUT:.*?\]/g, '').trim()
    );
    setBankName(currentUser.bank_name || '');
    setAccountNo(currentUser.account_no || '');
  }, [currentUser]);

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await updateUser({
      ...currentUser,
      first_name: firstName.trim() || currentUser.first_name,
      last_name: lastName.trim() || currentUser.last_name,
      position:
        currentUser.role === 'admin' || currentUser.role === 'system_admin'
          ? position.trim() || currentUser.position
          : currentUser.position,
      contact_no: contactNo.trim(),
      address: address.trim(),
      emergency_contact: emergencyContact.trim(),
      bank_name: bankName.trim(),
      account_no: accountNo.trim(),
    });
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-900 text-white font-bold text-lg sm:text-xl flex items-center justify-center shrink-0">
            {currentUser.first_name[0]}
            {currentUser.last_name[0]}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                {currentUser.first_name} {currentUser.last_name}
              </h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  currentUser.role === 'system_admin'
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : currentUser.role === 'admin'
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {currentUser.role.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono truncate">
              {currentUser.position}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowPasswordModal(true)}
          className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer shrink-0"
        >
          <KeyRound className="w-3.5 h-3.5" /> Change Password
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {/* Read-only Company Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3 text-xs">
          <h2 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
            Company Record
          </h2>
          <div>
            <span className="text-slate-500 block">System Role</span>
            <span className="font-semibold text-slate-800 capitalize">
              {currentUser.role.replace('_', ' ')}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Employee ID</span>
            <span className="font-mono text-slate-800 font-medium">
              {currentUser.employee_no || '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Department</span>
            <span className="font-medium text-slate-800">{currentUser.department}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Official Email</span>
            <span className="font-medium text-slate-800 font-mono break-all">{currentUser.email}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Pay Frequency</span>
            <span className="font-medium text-slate-800 capitalize">
              {currentUser.pay_frequency.replace('_', ' ')} cycle
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Hourly Pay Rate</span>
            <span className="font-medium text-emerald-700 font-mono font-semibold">
              {currentUser.role === 'admin' && !currentUser.clocks_in
                ? 'Administrative Role'
                : currentUser.hourly_rate
                ? `${formatCurrency(currentUser.hourly_rate)}/hr`
                : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Max Daily Limit</span>
            <span className="font-medium text-slate-800 font-mono">
              {currentUser.max_hours_day ? `${currentUser.max_hours_day.toFixed(2)} h` : 'Company Default (8.00 h)'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Payout Details</span>
            <span className="font-medium text-slate-800">
              {currentUser.bank_name ? (
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-slate-900">{currentUser.bank_name}</span>
                  {currentUser.account_no && (
                    <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                      {currentUser.account_no}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-medium">
                  Not configured
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Self-Service Contact Details Form */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h2 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2 mb-4">
            Editable Personal & Contact Details
          </h2>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none text-xs"
                />
              </div>
            </div>

            {(currentUser.role === 'admin' || currentUser.role === 'system_admin') && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">Position / Job Title</label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Operations Administrator"
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none text-xs"
                />
              </div>
            )}

            <div>
              <label className="block font-medium text-slate-700 mb-1">Contact Phone Number</label>
              <input
                type="text"
                value={contactNo}
                onChange={(e) => setContactNo(e.target.value)}
                placeholder="e.g. +63 917 123 4567"
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Residential Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, City, Postal Code"
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Emergency Contact</label>
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Name, Relationship & Phone (e.g. Jane Doe - Spouse - +63 918 000 0000)"
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none text-xs"
              />
            </div>

            {/* Bank or eWallet Details Section */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    Bank or eWallet Details (Payout Account)
                  </h3>
                  {/* <p className="text-[11px] text-slate-500 mt-0.5">
                    Administrator will view these account details when computing payroll and tagging individual disbursement payments.
                  </p> */}
                </div>
                {(currentUser.bank_name || currentUser.account_no) && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                    <Check className="w-3 h-3" /> Payout Info Saved
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Bank Name / eWallet 
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. BDO, BPI, GCash, Maya, UnionBank"
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Account No. / Mobile No. 
                  </label>
                  <input
                    type="text"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    placeholder="e.g. 0012-3456-7890 or 0917-123-4567"
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              {savedSuccess ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1 text-xs">
                  <Check className="w-4 h-4 shrink-0" /> Profile details saved &amp; synced
                </span>
              ) : (
                <span className="hidden sm:inline"></span>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto min-h-[42px] px-5 py-2.5 sm:py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Profile</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        userEmail={currentUser.email}
      />
    </div>
  );
}
