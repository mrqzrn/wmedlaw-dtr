'use client';

import React, { useState, useEffect } from 'react';
import { useApp, STORAGE_KEY_REMEMBER_ME, STORAGE_KEY_REMEMBER_EMAIL } from '@/lib/context';
import {
  Clock,
  Shield,
  User as UserIcon,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  X,
  ExternalLink,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  allowClose?: boolean;
}

export function AuthModal({ isOpen, onClose, allowClose = true }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPasswordForEmail } = useApp();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load remembered credentials on mount
  useEffect(() => {
    try {
      const savedRememberMe = localStorage.getItem(STORAGE_KEY_REMEMBER_ME);
      const savedEmail = localStorage.getItem(STORAGE_KEY_REMEMBER_EMAIL);
      if (savedRememberMe === 'true') {
        setRememberMe(true);
        if (savedEmail) {
          setEmail(savedEmail);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setRememberMe(isChecked);
    if (!isChecked) {
      try {
        localStorage.removeItem(STORAGE_KEY_REMEMBER_ME);
        localStorage.removeItem(STORAGE_KEY_REMEMBER_EMAIL);
      } catch {
        // ignore
      }
    }
  };

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    if (mode === 'signin') {
      const res = await signInWithEmail(email, password, rememberMe);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid credentials or login failure.');
      } else {
        if (onClose) onClose();
      }
    } else if (mode === 'signup') {
      if (!firstName.trim() || !lastName.trim()) {
        setErrorMsg('Please enter your first and last name.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }

      const res = await signUpWithEmail(email, password, { firstName, lastName });
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to register account.');
      } else {
        setSuccessMsg(
          res.message ||
            'Registration received! Your account is pending administrator approval before you can access the timekeeping system.'
        );
      }
    } else if (mode === 'forgot') {
      if (!email.trim()) {
        setErrorMsg('Please enter your email address.');
        setLoading(false);
        return;
      }

      const res = await resetPasswordForEmail(email.trim());
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to send password reset email.');
      } else {
        setSuccessMsg(
          res.message || 'Password reset link sent! Check your inbox for instructions to reset your password.'
        );
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setLoading(true);
    const res = await signInWithGoogle();
    if (!res.success) {
      if (
        res.error?.includes('provider is not enabled') ||
        res.error?.includes('Unsupported provider')
      ) {
        setErrorMsg(
          'Google Sign-In is not enabled yet in your Supabase Dashboard. You can enable it under Authentication > Providers > Google, or sign in using Email & Password.'
        );
      } else {
        setErrorMsg(res.error || 'Google sign in could not be initiated.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full max-h-[92dvh] flex flex-col overflow-hidden pb-safe">
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-4 sm:p-6 text-white relative shrink-0">
          {allowClose && onClose && (
            <button
              onClick={onClose}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3 mb-2 pr-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white shadow-md flex items-center justify-center overflow-hidden shrink-0 p-1 border border-white/20">
              <img
                src="/wmedlaw_logo.jpeg"
                alt="WMedlaw Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">WMedlaw DTR & Timekeeping</h2>
              <p className="text-xs text-blue-200 truncate">Enterprise Work Hours & Payroll Management</p>
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-200 border border-blue-400/30">
            <Sparkles className="w-3 h-3 text-blue-300 shrink-0" />
            <span>Connected to Supabase Authentication</span>
          </div>
        </div>

        {/* Tab Selection */}
        {mode === 'forgot' ? (
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50/70 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer py-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Password Reset
            </span>
          </div>
        ) : (
          <div className="flex border-b border-slate-200 bg-slate-50/70 p-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Body Form */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Alerts */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>{successMsg}</div>
            </div>
          )}

          {/* Google OAuth Button - only for signin or signup */}
          {(mode === 'signin' || mode === 'signup') && (
            <>
              {/* <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer hover:border-slate-400 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27A7.18 7.18 0 0 1 4.9 12c0-.79.14-1.57.38-2.27V6.58H1.25A11.96 11.96 0 0 0 0 12c0 1.92.45 3.74 1.25 5.42l4.03-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15C6.23 6.85 8.88 4.75 12 4.75Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button> */}

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  or with email
                </span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Maria"
                    className="w-full text-xs px-3 py-2.5 sm:py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Santos"
                    className="w-full text-xs px-3 py-2.5 sm:py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full text-xs pl-9 pr-3 py-2.5 sm:py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                />
              </div>
              {email.toLowerCase().trim() === 'marquez.ronrons@gmail.com' && (
                <p className="mt-1 text-[11px] text-purple-700 font-medium flex items-center gap-1">
                  <Shield className="w-3 h-3 text-purple-600 shrink-0" />
                  Default System Administrator account detected.
                </p>
              )}
            </div>

            {(mode === 'signin' || mode === 'signup') && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs pl-9 pr-3 py-2.5 sm:py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  />
                </div>
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <label htmlFor="modal-remember-me" className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    id="modal-remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={handleRememberMeChange}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors font-medium">
                    Remember me
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {mode === 'signup' && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800 flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Approval Notice:</strong> New registered accounts must be approved by an administrator before access to timekeeping is granted.
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Processing...</span>
              ) : mode === 'signin' ? (
                <>
                  <span>Sign In to Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : mode === 'signup' ? (
                <>
                  <span>Register Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Send Password Reset Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Preview fallback */}
          {allowClose && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Testing without login?</span>
              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                }}
                className="text-blue-600 hover:text-blue-800 font-medium hover:underline text-xs"
              >
                Preview in Demo Mode →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
