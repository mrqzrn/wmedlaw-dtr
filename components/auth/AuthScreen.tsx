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
  ArrowLeft,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AuthScreenProps {
  initialMode?: 'signin' | 'signup' | 'forgot' | 'recovery';
}

export function AuthScreen({ initialMode = 'signin' }: AuthScreenProps = {}) {
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    resetPasswordForEmail,
    changePassword,
    setIsPasswordRecovery,
  } = useApp();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'recovery'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Countdown timer for email send rate limit cooldown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Sync initialMode if prop updates
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    if (mode === 'signin') {
      const res = await signInWithEmail(email, password, rememberMe);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid credentials. Please verify your email and password.');
      }
    } else if (mode === 'signup') {
      if (!firstName.trim() || !lastName.trim()) {
        setErrorMsg('Please enter both your first and last name.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
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

      if (cooldownSeconds > 0) {
        setErrorMsg(`For security purposes, you can only request this after ${cooldownSeconds} seconds.`);
        setLoading(false);
        return;
      }

      const res = await resetPasswordForEmail(email.trim());
      setLoading(false);
      if (!res.success) {
        if (res.rateLimited && res.retryAfter) {
          setCooldownSeconds(res.retryAfter);
        }
        setErrorMsg(res.error || 'Failed to send password reset email.');
      } else {
        setSuccessMsg(
          res.message || 'Password reset link sent! Check your inbox for instructions to set a new password.'
        );
      }
    } else if (mode === 'recovery') {
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please verify both fields.');
        setLoading(false);
        return;
      }

      const res = await changePassword(password);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to update password.');
      } else {
        setSuccessMsg('Your password has been successfully updated! Entering application...');
        setPassword('');
        setConfirmPassword('');
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
          'Google Sign-In is not enabled yet in your Supabase Dashboard. You can enable it under Authentication > Providers > Google, or register / sign in using the Email & Password form below.'
        );
      } else {
        setErrorMsg(res.error || 'Google sign in could not be initiated.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-900 flex flex-col justify-center items-center px-3.5 py-6 sm:p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-xl shadow-black/20 mb-3 border border-slate-700/60 p-2 overflow-hidden">
            <img
              src="/wmedlaw_logo.jpeg"
              alt="WMedlaw Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">WMedlaw</h1>
          <p className="text-xs text-slate-300 font-medium mt-1">Daily Time Record (DTR) &amp; Timekeeping</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Card Top Nav Tabs */}
          {mode === 'forgot' || mode === 'recovery' ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50/80">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  if (setIsPasswordRecovery) setIsPasswordRecovery(false);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {mode === 'forgot' ? 'Account Recovery' : 'Reset Password'}
              </span>
            </div>
          ) : (
            <div className="flex border-b border-slate-200 bg-slate-50/80 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
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
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <div className="p-4 sm:p-6 space-y-4">
            {/* Feedback Alerts */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>{errorMsg}</div>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>{successMsg}</div>
              </div>
            )}

            {/* Google OAuth Button - only for signin / signup */}
            {/* {(mode === 'signin' || mode === 'signup') && (
              <>
                <button
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
                  <span>Continue with Google Account</span>
                </button>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-slate-200"></div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    or with email
                  </span>
                  <div className="flex-1 h-px bg-slate-200"></div>
                </div>
              </>
            )} */}

            {/* Mode 1 & 2: Sign In / Sign Up Form */}
            {(mode === 'signin' || mode === 'signup') && (
              <form onSubmit={handleSubmit} className="space-y-3.5">
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
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs pl-9 pr-10 py-2.5 sm:py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {mode === 'signin' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <label htmlFor="auth-remember-me" className="flex items-center gap-2 cursor-pointer select-none group">
                      <input
                        id="auth-remember-me"
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
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 flex items-start gap-2.5 leading-relaxed">
                    <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Admin Review Notice:</strong> New registered accounts will be reviewed by an administrator to assign your role (Employee or Administrator) and activate your access.
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[42px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <span>Authenticating...</span>
                  ) : mode === 'signin' ? (
                    <>
                      <span>Sign In to Account</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Register Account</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Mode 3: Forgot Password Form */}
            {mode === 'forgot' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-center py-1">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mb-2">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Reset your password</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Enter your account email and we'll send you a secure link to reset your password.
                  </p>
                </div>

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
                </div>

                <button
                  type="submit"
                  disabled={loading || cooldownSeconds > 0}
                  className="w-full min-h-[42px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span>Verifying account...</span>
                  ) : cooldownSeconds > 0 ? (
                    <span>Please wait ({cooldownSeconds}s)</span>
                  ) : (
                    <>
                      <span>Send Password Reset Link</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer py-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </button>
                </div>
              </form>
            )}

            {/* Mode 4: Password Recovery / Set New Password Form */}
            {mode === 'recovery' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-center py-1">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mb-2">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Create New Password</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Enter and confirm your new account password to complete recovery.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full text-xs pl-9 pr-10 py-2.5 sm:py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="w-full text-xs pl-9 pr-10 py-2.5 sm:py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[42px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <span>Updating password...</span>
                  ) : (
                    <>
                      <span>Save and Update Password</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      if (setIsPasswordRecovery) setIsPasswordRecovery(false);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer py-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Cancel and Back to Sign In</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
