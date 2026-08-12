'use client';

import { useDashboard } from './layout';

export default function DashboardHome() {
  const { user, activeBusinessId, businesses } = useDashboard();
  const activeBusiness = businesses.find((b) => b.id === activeBusinessId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Welcome, {user?.name}!</h1>
        <p className="text-sm text-text-secondary mt-1">
          You are logged into the Jay Ramji Enterprise Billing & Invoice System workspace.
        </p>
      </div>

      {/* Workspace Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Operator Profile</p>
          <h3 className="text-lg font-bold text-text-primary">{user?.name}</h3>
          <p className="text-xs text-text-secondary mt-1 truncate">{user?.email}</p>
        </div>

        <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Active Workspace</p>
          <h3 className="text-lg font-bold text-text-primary">{activeBusiness?.name || 'Loading...'}</h3>
          <p className="text-xs text-text-secondary mt-1">Workspace Role: {activeBusiness?.role || 'Loading...'}</p>
        </div>

        <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Workspace Tenancy</p>
          <h3 className="text-lg font-bold text-text-primary">Multi-Tenant Context</h3>
          <p className="text-xs text-text-secondary mt-1 truncate">ID: {activeBusinessId || 'None'}</p>
        </div>
      </div>

      <div className="bg-surface-app border border-border-app rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-text-primary mb-3">Phase 2 Verification Checklist</h2>
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-surface-2-app rounded-lg border border-border-light text-sm text-text-secondary">
            <span className="bg-success-soft text-success-app p-1 rounded-full">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span>Registration automatically registers your profile and auto-provisions a business workspace.</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-surface-2-app rounded-lg border border-border-light text-sm text-text-secondary">
            <span className="bg-success-soft text-success-app p-1 rounded-full">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span>Session cookies (HttpOnly JWT) safely manage state persistence and restore workspace context.</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-surface-2-app rounded-lg border border-border-light text-sm text-text-secondary">
            <span className="bg-success-soft text-success-app p-1 rounded-full">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span>Accessing workspace resources validates business tenancy and restricts roles to OWNER/ADMIN/STAFF thresholds.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
