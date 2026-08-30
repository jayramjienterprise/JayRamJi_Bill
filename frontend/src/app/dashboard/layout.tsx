'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../lib/api/client';
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  Users,
  Package,
  Palette,
  Settings,
  CreditCard,
  LogOut,
} from 'lucide-react';

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
  const pathname = usePathname();
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

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },
    { href: '/dashboard/customers', label: 'Customers', icon: Users },
    { href: '/dashboard/services', label: 'Products / Services', icon: Package },
    { href: '/dashboard/settings/payment-accounts', label: 'Payment Accounts', icon: CreditCard },
    { href: '/dashboard/branding', label: 'Branding', icon: Palette },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings, exact: true },
  ];

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
            <div className="p-5 border-b border-primary-800">
              <div className="flex items-center space-x-3">
                <div className="bg-primary-700 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base shadow-sm">
                  J
                </div>
                <div>
                  <h1 className="font-bold text-sm leading-tight tracking-wide">Jay Ramji Enterprise</h1>
                  <p className="text-[10px] text-primary-400 font-semibold tracking-wider uppercase mt-0.5">Billing System</p>
                </div>
              </div>
            </div>

            {/* Sidebar Navigation */}
            <nav className="p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? 'bg-primary-800 text-white shadow-xs'
                        : 'text-primary-300 hover:text-white hover:bg-primary-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-primary-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User/Signout Area */}
          <div className="p-4 border-t border-primary-800 bg-primary-950/40">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold truncate text-white">{user?.name}</p>
                <p className="text-[10.5px] text-primary-400 truncate mt-0.5">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 text-primary-400 hover:text-white hover:bg-primary-800 rounded-lg transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Application Container */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar Navigation */}
          <header className="h-16 bg-surface-app border-b border-border-app px-6 md:px-8 flex items-center justify-between shadow-xs shrink-0">
            <div className="flex items-center space-x-3">
              <span className="text-text-muted text-xs font-bold uppercase tracking-wider">Workspace:</span>
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
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-muted">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              ) : (
                <span className="text-xs font-semibold text-text-muted">No business workspace active</span>
              )}
            </div>

            {/* Quick Action Navigation in Top Bar */}
            <div className="flex items-center space-x-3">
              <Link
                href="/dashboard/invoices/create"
                className="px-3 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
              >
                <span>+ Create Invoice</span>
              </Link>
            </div>
          </header>

          {/* Page Content Body */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-background-app">{children}</main>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
