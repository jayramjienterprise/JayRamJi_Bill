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
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Plus,
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
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Restore sidebar preference
  useEffect(() => {
    const saved = localStorage.getItem('jre_sidebar_collapsed');
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true');
    }
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('jre_sidebar_collapsed', String(next));
      return next;
    });
  }

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function fetchSession() {
    try {
      const data: any = await apiClient.get('/auth/me');
      setUser(data.user);
      setBusinesses(data.businesses);

      // Validate or default active business context
      if (data.businesses && data.businesses.length > 0) {
        const storedBusinessId = typeof window !== 'undefined' ? localStorage.getItem('x-business-id') : null;
        const exists = data.businesses.some((b: any) => b.id === storedBusinessId);
        if (storedBusinessId && exists) {
          setActiveBusinessId(storedBusinessId);
        } else {
          setActiveBusinessId(data.businesses[0].id);
          localStorage.setItem('x-business-id', data.businesses[0].id);
        }
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
      localStorage.removeItem('x-business-id');
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
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      <div className="flex h-screen w-screen overflow-hidden bg-background-app">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          />
        )}

        {/* Fixed Viewport Sidebar */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-50 bg-primary-900 text-white flex flex-col justify-between shrink-0 shadow-lg transition-all duration-200 ease-in-out ${
            sidebarCollapsed ? 'md:w-[72px]' : 'md:w-[240px]'
          } ${mobileMenuOpen ? 'w-[280px] translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        >
          {/* Top Brand Section */}
          <div className="flex flex-col min-h-0 flex-1">
            <div className="p-4 border-b border-primary-800 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="bg-primary-700 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  J
                </div>
                {(!sidebarCollapsed || mobileMenuOpen) && (
                  <div className="min-w-0 transition-opacity">
                    <h1 className="font-bold text-sm leading-tight tracking-wide truncate">Jay Ramji Enterprise</h1>
                    <p className="text-[10px] text-primary-400 font-semibold tracking-wider uppercase mt-0.5">Billing System</p>
                  </div>
                )}
              </div>

              {/* Close button for mobile / collapse toggle */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-primary-400 hover:text-white hover:bg-primary-800 rounded-lg md:hidden cursor-pointer"
                  title="Close Menu"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="hidden md:flex p-1.5 text-primary-400 hover:text-white hover:bg-primary-800 rounded-lg cursor-pointer transition"
                  title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                >
                  {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Nav Menu Scrollable Area */}
            <nav className="p-2 space-y-1 overflow-y-auto flex-1 custom-scrollbar">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
                const isExpanded = !sidebarCollapsed || mobileMenuOpen;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    title={!isExpanded ? item.label : undefined}
                    className={`flex items-center rounded-xl text-xs font-semibold transition ${
                      !isExpanded
                        ? 'justify-center p-2.5'
                        : 'space-x-3 px-3.5 py-2.5'
                    } ${
                      isActive
                        ? 'bg-primary-800 text-white shadow-xs'
                        : 'text-primary-300 hover:text-white hover:bg-primary-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-primary-400'}`} />
                    {isExpanded && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User / Logout Area — Always pinned at bottom */}
          <div className="p-3 border-t border-primary-800 bg-primary-950/50 shrink-0">
            <div className={`flex items-center ${sidebarCollapsed && !mobileMenuOpen ? 'flex-col space-y-2 justify-center' : 'justify-between'}`}>
              {!sidebarCollapsed || mobileMenuOpen ? (
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold truncate text-white">{user?.name}</p>
                  <p className="text-[10.5px] text-primary-400 truncate mt-0.5">{user?.email}</p>
                </div>
              ) : (
                <div
                  title={`${user?.name} (${user?.email})`}
                  className="w-7 h-7 rounded-full bg-primary-800 text-primary-200 flex items-center justify-center text-xs font-bold shrink-0 uppercase"
                >
                  {user?.name ? user.name.charAt(0) : 'U'}
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 text-primary-400 hover:text-danger-app hover:bg-primary-800/80 rounded-lg transition cursor-pointer flex items-center gap-2"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {(!sidebarCollapsed || mobileMenuOpen) && <span className="text-xs font-semibold">Logout</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Viewport Container */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* Top Bar Header */}
          <header className="h-16 bg-surface-app border-b border-border-app px-3 sm:px-6 md:px-8 flex items-center justify-between shadow-xs shrink-0 z-10 gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              {/* Mobile Hamburger Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-2-app rounded-lg md:hidden cursor-pointer shrink-0"
                title="Open Navigation"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Desktop Toggle Button */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden md:flex p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-2-app rounded-lg cursor-pointer transition shrink-0"
                title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                <PanelLeft className="w-4 h-4" />
              </button>

              <span className="text-text-muted text-xs font-bold uppercase tracking-wider hidden md:inline shrink-0">Workspace:</span>
              {businesses.length > 0 ? (
                <div className="relative min-w-0 max-w-[150px] xs:max-w-[180px] sm:max-w-xs">
                  <select
                    value={activeBusinessId || ''}
                    onChange={(e) => setActiveBusinessId(e.target.value)}
                    className="w-full appearance-none pr-7 pl-2.5 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none cursor-pointer truncate"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.role})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-text-muted">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              ) : (
                <span className="text-xs font-semibold text-text-muted truncate">No business active</span>
              )}
            </div>

            {/* Quick Actions in Top Bar */}
            <div className="flex items-center shrink-0">
              <Link
                href="/dashboard/invoices/create"
                className="px-2.5 sm:px-3.5 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs cursor-pointer shrink-0"
                title="Create Invoice"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="hidden xs:inline sm:inline">Create Invoice</span>
              </Link>
            </div>
          </header>

          {/* Page Content with Independent Vertical Scroll */}
          <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-background-app">{children}</main>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
