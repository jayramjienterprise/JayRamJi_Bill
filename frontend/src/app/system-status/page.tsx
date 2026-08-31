'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '../../lib/api/client';
import { HealthCheckResponse } from '../../lib/api/types';
import { Activity, ArrowLeft, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

export default function SystemStatusPage() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  async function checkHealth() {
    setStatus('loading');
    setErrorMsg(null);
    try {
      const data = await apiClient.get<HealthCheckResponse>('/health');
      setHealthData(data);
      if (data.status === 'ok') {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch (err: any) {
      setStatus('disconnected');
      setErrorMsg(err.message || 'Could not reach backend API');
    } finally {
      setLastChecked(new Date().toLocaleTimeString('en-IN'));
    }
  }

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="flex-1 flex flex-col justify-between min-h-screen bg-background-app">
      {/* Header */}
      <header className="bg-primary-900 text-white py-4 px-6 md:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="bg-primary-700 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm hover:opacity-90 transition">
              J
            </Link>
            <div>
              <h1 className="font-semibold text-lg tracking-tight">Jay Ramji Enterprise</h1>
              <p className="text-xs text-primary-500 font-medium">System Diagnostics & Backend Status</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-800 text-primary-200 hover:bg-primary-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 flex flex-col justify-center items-center">
        <div className="bg-surface-app border border-border-app rounded-xl p-8 max-w-md w-full shadow-sm text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-primary-900/5 text-primary-700 p-4 rounded-full">
              <Activity className="w-10 h-10" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-text-primary mb-2">Backend Connection Status</h2>
          <p className="text-sm text-text-secondary mb-6">
            Direct API connection between Next.js frontend and Render Express backend.
          </p>

          {/* Connection Status Indicator */}
          <div className="mb-6">
            {status === 'loading' && (
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-surface-2-app text-text-secondary rounded-lg border border-border-app text-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-text-muted opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-text-muted"></span>
                </span>
                <span>Testing Render backend connection...</span>
              </div>
            )}

            {status === 'connected' && (
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-500/10 text-emerald-700 rounded-lg border border-emerald-500/20 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Backend Online & Connected</span>
              </div>
            )}

            {status === 'disconnected' && (
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-danger-soft text-danger-app rounded-lg border border-danger-app/20 text-sm font-medium">
                <XCircle className="w-4 h-4 text-danger-app" />
                <span>Connection Failed</span>
              </div>
            )}
          </div>

          {/* Details */}
          {healthData && (
            <div className="bg-surface-2-app text-left border border-border-app p-4 rounded-lg mb-4 text-xs font-mono text-text-secondary space-y-1">
              <p><strong className="text-text-primary">Status:</strong> {healthData.status}</p>
              <p><strong className="text-text-primary">Database:</strong> {healthData.database}</p>
              <p><strong className="text-text-primary">Timestamp:</strong> {healthData.timestamp}</p>
              {lastChecked && <p><strong className="text-text-primary">Last Checked:</strong> {lastChecked}</p>}
            </div>
          )}

          {status === 'disconnected' && (
            <div className="bg-surface-2-app text-left border border-border-app p-4 rounded-lg mb-4 text-xs font-mono text-text-secondary overflow-x-auto max-w-full">
              <p className="font-semibold text-danger-app mb-1">Error Details:</p>
              <p>{errorMsg}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={checkHealth}
              className="flex-1 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retest Connection</span>
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-primary rounded-lg text-sm font-semibold transition"
            >
              Home
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-text-muted border-t border-border-app">
        Jay Ramji Enterprise — Billing & Invoice Management Platform
      </footer>
    </div>
  );
}
