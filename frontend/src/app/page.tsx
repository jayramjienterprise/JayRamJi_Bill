'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api/client';
import { HealthCheckResponse } from '../lib/api/types';

export default function Home() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const data = await apiClient.get<HealthCheckResponse>('/health');
        if (data.status === 'ok') {
          setStatus('connected');
        } else {
          setStatus('disconnected');
        }
      } catch (err: any) {
        setStatus('disconnected');
        setErrorMsg(err.message || 'Could not reach backend API');
      }
    }
    checkHealth();
  }, []);

  return (
    <div className="flex-1 flex flex-col justify-between min-h-screen">
      {/* Navigation Header */}
      <header className="bg-primary-900 text-white py-4 px-6 md:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary-700 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm">
              J
            </div>
            <div>
              <h1 className="font-semibold text-lg tracking-tight">Jay Ramji Enterprise</h1>
              <p className="text-xs text-primary-500 font-medium">Billing & Invoice Management System</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-800 text-primary-500">
              PHASE 1 — FOUNDATION
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 flex flex-col justify-center items-center">
        <div className="bg-surface-app border border-border-app rounded-xl p-8 max-w-md w-full shadow-sm text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-primary-900/5 text-primary-700 p-4 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 2.24a4.751 4.751 0 0 1 7.477 0M9 3.75h.008v.008H9V3.75Zm.3 0h.008v.008H9.3V3.75Z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-text-primary mb-2">System Status</h2>
          <p className="text-sm text-text-secondary mb-6">
            Verifying the connection between Next.js frontend and Express.js backend.
          </p>

          {/* Connection Status Indicator */}
          <div className="mb-6">
            {status === 'loading' && (
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-surface-2-app text-text-secondary rounded-lg border border-border-light text-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-text-muted opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-text-muted"></span>
                </span>
                <span>Checking connection...</span>
              </div>
            )}

            {status === 'connected' && (
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-success-soft text-success-app rounded-lg border border-success-app/20 text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-app opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success-app"></span>
                </span>
                <span>Backend Connected</span>
              </div>
            )}

            {status === 'disconnected' && (
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-danger-soft text-danger-app rounded-lg border border-danger-app/20 text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-danger-app"></span>
                </span>
                <span>Connection Failed</span>
              </div>
            )}
          </div>

          {status === 'disconnected' && (
            <div className="bg-surface-2-app text-left border border-border-app p-4 rounded-lg mb-4 text-xs font-mono text-text-secondary overflow-x-auto max-w-full">
              <p className="font-semibold text-danger-app mb-1">Details:</p>
              <p>{errorMsg}</p>
            </div>
          )}

          <div className="border-t border-border-app pt-6 text-left">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Phase 1 Specs Verified</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-success-app" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Next.js App Router + TypeScript</span>
              </li>
              <li className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-success-app" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Tailwind CSS configuration</span>
              </li>
              <li className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-success-app" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Centralized fetch-based API Client</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-app border-t border-border-app py-4 text-center text-xs text-text-muted">
        <p>© 2026 JAY RAMJI ENTERPRISE. All Rights Reserved. (Phase 1 — Project Foundation)</p>
      </footer>
    </div>
  );
}
