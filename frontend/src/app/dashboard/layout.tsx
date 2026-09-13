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
  ChevronDown,
  PanelLeft,
  Plus,
  ShieldCheck,
  UserCheck,
  Bell,
  ShoppingBag,
  Building2,
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

interface SubMenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems: SubMenuItem[];
}

type NavEntry =
  | { type: 'single'; item: SubMenuItem }
  | { type: 'group'; id: string; label: string; icon: React.ComponentType<{ className?: string }>; subItems: SubMenuItem[] };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Group expansion state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    sales: true,
    amc: true,
    purchases: true,
    settings: true,
  });

  // Flyout state when sidebar is collapsed
  const [activeFlyout, setActiveFlyout] = useState<string | null>(null);

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
    setActiveFlyout(null);
  }

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setActiveFlyout(null);
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

  // Hierarchical Navigation Structure
  const navStructure: NavEntry[] = [
    {
      type: 'single',
      item: { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    },
    {
      type: 'group',
      id: 'sales',
      label: 'Sales & Invoicing',
      icon: FileText,
      subItems: [
        { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },
        { href: '/dashboard/customers', label: 'Customers', icon: Users },
        { href: '/dashboard/services', label: 'Products / Services', icon: Package },
        { href: '/dashboard/analytics', label: 'Sales Analytics', icon: BarChart3 },
      ],
    },
    {
      type: 'group',
      id: 'amc',
      label: 'AMC Contracts',
      icon: ShieldCheck,
      subItems: [
        { href: '/dashboard/amc', label: 'Contracts & Quotes', icon: ShieldCheck },
        { href: '/dashboard/employees', label: 'Employees', icon: UserCheck },
        { href: '/dashboard/notifications', label: 'Visit Alerts', icon: Bell },
      ],
    },
    {
      type: 'group',
      id: 'purchases',
      label: 'Purchases',
      icon: ShoppingBag,
      subItems: [
        { href: '/dashboard/purchases', label: 'Purchases', icon: ShoppingBag, exact: true },
        { href: '/dashboard/purchases/vendors', label: 'Vendors', icon: Building2 },
        { href: '/dashboard/purchases/dashboard', label: 'Purchase Analytics', icon: BarChart3 },
      ],
    },
    {
      type: 'group',
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      subItems: [
        { href: '/dashboard/settings', label: 'Business Profile', icon: Settings, exact: true },
        { href: '/dashboard/settings/payment-accounts', label: 'Payment Accounts', icon: CreditCard },
        { href: '/dashboard/branding', label: 'Branding', icon: Palette },
      ],
    },
  ];

  const isItemActive = (item: SubMenuItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname?.startsWith(`${item.href}/`);
  };

  const isGroupActive = (subItems: SubMenuItem[]) => {
    return subItems.some((sub) => isItemActive(sub));
  };

  // Auto-expand group if current route is inside it
  useEffect(() => {
    navStructure.forEach((entry) => {
      if (entry.type === 'group' && isGroupActive(entry.subItems)) {
        setExpandedGroups((prev) => ({ ...prev, [entry.id]: true }));
      }
    });
  }, [pathname]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

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

  const isExpanded = !sidebarCollapsed || mobileMenuOpen;

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
            sidebarCollapsed ? 'md:w-[72px]' : 'md:w-[245px]'
          } ${mobileMenuOpen ? 'w-[280px] translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        >
          {/* Top Brand Section */}
          <div className="flex flex-col min-h-0 flex-1">
            <div className="p-4 border-b border-primary-800 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="bg-primary-700 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  J
                </div>
                {isExpanded && (
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

            {/* Categorized Nav Menu Scrollable Area */}
            <nav className="p-2.5 space-y-1.5 overflow-y-auto flex-1 custom-scrollbar">
              {navStructure.map((entry) => {
                if (entry.type === 'single') {
                  const item = entry.item;
                  const Icon = item.icon;
                  const isActive = isItemActive(item);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      title={!isExpanded ? item.label : undefined}
                      className={`flex items-center rounded-xl text-xs font-semibold transition ${
                        !isExpanded ? 'justify-center p-2.5' : 'space-x-3 px-3 py-2.5'
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
                }

                // Group item with submenus
                const group = entry;
                const GroupIcon = group.icon;
                const groupActive = isGroupActive(group.subItems);
                const isOpen = expandedGroups[group.id];

                if (!isExpanded) {
                  // Collapsed Mini-Sidebar Mode: Icon with Flyout Popup
                  return (
                    <div
                      key={group.id}
                      className="relative"
                      onMouseEnter={() => setActiveFlyout(group.id)}
                      onMouseLeave={() => setActiveFlyout(null)}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveFlyout(activeFlyout === group.id ? null : group.id)}
                        className={`w-full flex items-center justify-center p-2.5 rounded-xl text-xs transition relative cursor-pointer ${
                          groupActive
                            ? 'bg-primary-800 text-white shadow-xs'
                            : 'text-primary-300 hover:text-white hover:bg-primary-800/50'
                        }`}
                        title={group.label}
                      >
                        <GroupIcon className={`w-4 h-4 shrink-0 ${groupActive ? 'text-white' : 'text-primary-400'}`} />
                        {groupActive && (
                          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-400" />
                        )}
                      </button>

                      {/* Mini Sidebar Flyout Menu */}
                      {activeFlyout === group.id && (
                        <div className="absolute left-[54px] top-0 w-52 bg-primary-900 border border-primary-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                          <div className="px-2.5 py-1 border-b border-primary-800/80 mb-1 flex items-center justify-between">
                            <span className="text-[10.5px] font-bold tracking-wider uppercase text-primary-300">
                              {group.label}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {group.subItems.map((sub) => {
                              const subActive = isItemActive(sub);
                              const SubIcon = sub.icon;
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={() => {
                                    setActiveFlyout(null);
                                    setMobileMenuOpen(false);
                                  }}
                                  className={`flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                                    subActive
                                      ? 'bg-primary-800 text-white font-semibold shadow-xs'
                                      : 'text-primary-300 hover:text-white hover:bg-primary-800/50'
                                  }`}
                                >
                                  <SubIcon className={`w-3.5 h-3.5 shrink-0 ${subActive ? 'text-primary-300' : 'text-primary-400'}`} />
                                  <span className="truncate">{sub.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Expanded Mode: Accordion Category with Submenu
                return (
                  <div key={group.id} className="space-y-0.5">
                    {/* Category Header Button */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        groupActive
                          ? 'text-white bg-primary-800/40'
                          : 'text-primary-300 hover:text-white hover:bg-primary-800/30'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <GroupIcon className={`w-4 h-4 shrink-0 ${groupActive ? 'text-primary-300' : 'text-primary-400'}`} />
                        <span className="truncate">{group.label}</span>
                      </div>
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 text-primary-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                    </button>

                    {/* Submenu Items */}
                    {isOpen && (
                      <div className="ml-4 pl-2.5 border-l border-primary-800/80 space-y-0.5 mt-0.5">
                        {group.subItems.map((sub) => {
                          const subActive = isItemActive(sub);
                          const SubIcon = sub.icon;

                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition ${
                                subActive
                                  ? 'bg-primary-800 text-white font-semibold shadow-xs'
                                  : 'text-primary-300 hover:text-white hover:bg-primary-800/40'
                              }`}
                            >
                              <SubIcon className={`w-3.5 h-3.5 shrink-0 ${subActive ? 'text-primary-300' : 'text-primary-400'}`} />
                              <span className="truncate">{sub.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* User / Logout Area — Always pinned at bottom */}
          <div className="p-3 border-t border-primary-800 bg-primary-950/50 shrink-0">
            <div className={`flex items-center ${sidebarCollapsed && !mobileMenuOpen ? 'flex-col space-y-2 justify-center' : 'justify-between'}`}>
              {isExpanded ? (
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
                {isExpanded && <span className="text-xs font-semibold">Logout</span>}
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
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/dashboard/amc/quotations/create?category=general"
                className="px-2.5 sm:px-3 py-1.5 bg-surface-app hover:bg-surface-2-app text-text-primary border border-border-app rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs cursor-pointer shrink-0"
                title="Create Quotation / Estimate"
              >
                <FileText className="w-3.5 h-3.5 shrink-0 text-text-secondary" />
                <span className="hidden xs:inline sm:inline">Create Quotation</span>
              </Link>
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
