'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../lib/api/client';

interface BusinessItem {
  id: string;
  name: string;
  role: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface DashboardContextType {
  user: UserProfile | null;
  businesses: BusinessItem[];
  activeBusinessId: string | null;
  setActiveBusinessId: (id: string | null) => void;
  refreshSession: () => Promise<void>;
  loading: boolean;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchSession() {
    try {
      const data: any = await apiClient.get('/auth/me');
      setUser(data.user);
      setBusinesses(data.businesses);

      // Default to first business context if none set
      if (data.businesses.length > 0 && !activeBusinessId) {
        setActiveBusinessId(data.businesses[0].id);
      }
      setLoading(false);
    } catch (err) {
      router.push('/login');
    }
  }

  useEffect(() => {
    fetchSession();
  }, []);

  async function handleLogout() {
    try {
      await apiClient.post('/auth/logout', {});
      router.push('/login');
    } catch (err) {
      console.error('Logout error', err);
    }
  }

  // Set header value for tenancy context
  useEffect(() => {
    if (activeBusinessId) {
      // Set the x-business-id on subsequent fetch requests automatically
      // Note: Since we are using standard headers inApiClient, we can pass it manually in page.tsx calls.
      // But we can also cache it in localStorage.
      localStorage.setItem('x-business-id', activeBusinessId);
    }
  }, [activeBusinessId]);

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center min-h-screen bg-background-app">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-sm text-text-secondary">Restoring active session...</p>
        </div>
      </div>
    );
  }

  const activeBusiness = businesses.find((b) => b.id === activeBusinessId);

  return (
    <DashboardContext.Provider
      value={{
        user,
        businesses,
        activeBusinessId,
        setActiveBusinessId,
        refreshSession: fetchSession,
        loading,
      }}
    >
      <div className="flex min-h-screen bg-background-app">
        {/* Desktop Sidebar Layout */}
        <aside className="w-[240px] bg-primary-900 text-white flex flex-col justify-between shrink-0 shadow-md">
          <div>
            <div className="p-6 border-b border-primary-800">
              <div className="flex items-center space-x-3">
                <div className="bg-primary-700 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm">
                  J
                </div>
                <div>
                  <h1 className="font-semibold text-sm leading-tight tracking-wide">Jay Ramji Enterprise</h1>
                  <p className="text-[10px] text-primary-500 font-semibold tracking-wider uppercase mt-0.5">Billing System</p>
                </div>
              </div>
            </div>

            {/* Sidebar Navigation */}
            <nav className="p-4 space-y-1">
              <Link
                href="/dashboard"
                className="flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm text-primary-500 hover:text-white hover:bg-primary-800/40 transition font-medium"
              >
                <span>▣ Dashboard</span>
              </Link>
              <Link
                href="/dashboard/settings"
                className="flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm text-primary-500 hover:text-white hover:bg-primary-800/40 transition font-medium"
              >
                <span>⚙ Settings</span>
              </Link>
            </nav>
          </div>

          {/* User/Signout Area */}
          <div className="p-4 border-t border-primary-800 bg-primary-900/40">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate text-white">{user?.name}</p>
                <p className="text-[10px] text-primary-500 truncate mt-0.5">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 text-primary-500 hover:text-white hover:bg-primary-800 rounded-lg transition cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Application Container */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar Navigation */}
          <header className="h-16 bg-surface-app border-b border-border-app px-6 md:px-8 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center space-x-3">
              <span className="text-text-secondary text-sm font-medium">Workspace:</span>
              {businesses.length > 0 ? (
                <div className="relative">
                  <select
                    value={activeBusinessId || ''}
                    onChange={(e) => setActiveBusinessId(e.target.value)}
                    className="appearance-none pr-8 pl-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none cursor-pointer"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.role})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-text-secondary">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              ) : (
                <span className="text-text-muted text-xs">No active business</span>
              )}
            </div>

            <div className="flex items-center space-x-2.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-soft text-success-app border border-success-app/10 uppercase">
                Active Session
              </span>
            </div>
          </header>

          {/* Page Routing Space */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
