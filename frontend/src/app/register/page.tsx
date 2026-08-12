'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../lib/api/client';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      await apiClient.post('/auth/register', formData);
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-background-app p-4">
      <div className="max-w-md w-full bg-surface-app border border-border-app rounded-xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="inline-flex bg-primary-900/5 text-primary-700 w-12 h-12 rounded-lg items-center justify-center font-bold text-2xl shadow-sm mb-4">
            J
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Create an Account</h1>
          <p className="text-sm text-text-secondary mt-1">
            Register your JRE billing operator profile
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-sm rounded-lg font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Priy Ramani"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="operator@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3.5 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold tracking-wide shadow-sm transition disabled:opacity-50 mt-2 cursor-pointer"
          >
            {loading ? 'Registering Account...' : 'Register Operator'}
          </button>
        </form>

        <div className="border-t border-border-app mt-6 pt-4 text-center">
          <p className="text-xs text-text-secondary">
            Already have an account?{' '}
            <Link href="/login" className="text-primary-600 hover:underline font-medium">
              Log in instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
