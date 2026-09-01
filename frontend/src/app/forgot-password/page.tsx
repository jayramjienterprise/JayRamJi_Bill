'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '../../lib/api/client';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err: any) {
      // If network fails, show network error, otherwise always show generic success
      if (err.code === 'NETWORK_FAILURE') {
        setErrorMsg('Network error: Unable to reach server. Please check your connection.');
      } else {
        // Generic safety fallback
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-background-app p-4">
      <div className="max-w-md w-full bg-surface-app border border-border-app rounded-2xl p-8 shadow-sm">
        
        {/* Brand Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex bg-primary-900/5 text-primary-700 w-12 h-12 rounded-xl items-center justify-center font-black text-2xl shadow-sm mb-3">
            JRE
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            {submitted ? 'Check your email' : 'Forgot your password?'}
          </h1>
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
            {submitted
              ? "If an account exists for this email, you'll receive a password reset link."
              : "Enter your registered email address and we'll send you a password reset link."}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-6">
            <div className="p-4 bg-success-soft border border-success-app/20 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-success-app shrink-0 mt-0.5" />
              <div className="text-xs text-text-primary space-y-1">
                <p className="font-semibold text-success-app">Password Reset Link Sent</p>
                <p className="text-text-secondary leading-normal">
                  The link will expire in <strong className="text-text-primary">30 minutes</strong>. Please check your inbox and spam folder.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                href="/login"
                className="w-full py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold tracking-wide shadow-sm transition flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Login</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
                className="w-full py-2.5 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Send Another Link
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Email address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="operator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-app border border-border-app rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold tracking-wide shadow-sm transition disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Send Reset Link</span>
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
        )}

      </div>
    </div>
  );
}
