'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../lib/api/client';
import { Lock, CheckCircle2, AlertCircle, ArrowLeft, KeyRound, Eye, EyeOff } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isTokenInvalid, setIsTokenInvalid] = useState(!token);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setIsTokenInvalid(true);
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please ensure both fields match.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await apiClient.post('/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      if (
        err.code === 'INVALID_OR_EXPIRED_TOKEN' ||
        err.code === 'TOKEN_ALREADY_USED' ||
        err.code === 'TOKEN_EXPIRED'
      ) {
        setIsTokenInvalid(true);
      } else {
        setErrorMsg(err.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // 1. Missing, Expired or Invalid Token State
  if (isTokenInvalid) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 bg-danger-soft text-danger-app rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Reset link expired or invalid</h2>
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
            This password reset link is no longer valid or has already been used.
          </p>
        </div>
        <div className="pt-3 space-y-2">
          <Link
            href="/forgot-password"
            className="w-full py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold tracking-wide shadow-sm transition flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>Request New Reset Link</span>
          </Link>
          <Link
            href="/login"
            className="w-full py-2.5 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Login</span>
          </Link>
        </div>
      </div>
    );
  }

  // 2. Success State
  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 bg-success-soft text-success-app rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Password updated successfully</h2>
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
            Your password has been changed. You can now sign in with your new password.
          </p>
        </div>
        <div className="pt-3">
          <Link
            href="/login"
            className="w-full py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold tracking-wide shadow-sm transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to Login</span>
          </Link>
        </div>
      </div>
    );
  }

  // 3. Reset Password Input Form
  return (
    <div>
      <div className="text-center mb-6">
        <div className="inline-flex bg-primary-900/5 text-primary-700 w-12 h-12 rounded-xl items-center justify-center font-black text-2xl shadow-sm mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Reset your password</h1>
        <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
          Create a new secure password for your operator account (minimum 6 characters).
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleResetPassword} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
            New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 bg-surface-app border border-border-app rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
            Confirm New Password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-surface-app border border-border-app rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !password || !confirmPassword}
          className="w-full py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold tracking-wide shadow-sm transition disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Resetting Password...</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>Reset Password</span>
            </>
          )}
        </button>

        <div className="border-t border-border-app mt-6 pt-4 text-center">
          <Link
            href="/login"
            className="text-xs text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-background-app p-4">
      <div className="max-w-md w-full bg-surface-app border border-border-app rounded-2xl p-8 shadow-sm">
        <Suspense
          fallback={
            <div className="py-12 text-center text-xs text-text-secondary flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-primary-700 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading secure session...</span>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
