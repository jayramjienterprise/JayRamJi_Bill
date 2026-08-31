'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '../lib/api/client';
import { DashboardOverview, RecentActivityItem } from '../lib/api/types';
import DateFilterBar, { DatePresetOption } from './dashboard/components/DateFilterBar';
import SalesOverviewChart from './dashboard/components/SalesOverviewChart';
import PaymentMethodsSummaryCard from './dashboard/components/PaymentMethodsSummaryCard';
import {
  FilePlus,
  FileText,
  Users,
  UserPlus,
  Package,
  PackagePlus,
  CreditCard,
  BarChart3,
  TrendingUp,
  Wallet,
  AlertCircle,
  Calculator,
  Percent,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  Settings,
  Bell,
  Activity,
  ShieldCheck,
  Building2,
  ReceiptText,
} from 'lucide-react';

export default function HomePage() {
  // Session & User State
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [businessName, setBusinessName] = useState<string>('Jay Ramji Enterprise');
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  // Dashboard Data State
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter state
  const [datePreset, setDatePreset] = useState<DatePresetOption>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // 1. Dynamic Greeting based on client time
  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  // 2. Fetch User & Workspace Session
  async function fetchSession() {
    try {
      const data: any = await apiClient.get('/auth/me');
      if (data?.user) {
        setUser(data.user);
      }
      if (data?.businesses && data.businesses.length > 0) {
        setBusinessName(data.businesses[0].name || 'Jay Ramji Enterprise');
        setActiveBusinessId(data.businesses[0].id);
        localStorage.setItem('x-business-id', data.businesses[0].id);
      }
    } catch {
      // Unauthenticated visitor: continue in guest view with live dashboard preview
    }
  }

  // 3. Load Dashboard Data
  async function loadDashboardData(preset: DatePresetOption, from?: string, to?: string) {
    setLoading(true);
    setErrorMsg(null);

    try {
      const [overviewData, invoicesData] = await Promise.allSettled([
        apiClient.getDashboardOverview({
          preset: preset !== 'CUSTOM' ? preset : undefined,
          from: preset === 'CUSTOM' ? from : undefined,
          to: preset === 'CUSTOM' ? to : undefined,
        }),
        apiClient.getRecentInvoices(8),
      ]);

      if (overviewData.status === 'fulfilled') {
        setOverview(overviewData.value);
      } else {
        setOverview(null);
      }

      if (invoicesData.status === 'fulfilled') {
        setRecentInvoices(invoicesData.value || []);
      } else {
        setRecentInvoices([]);
      }

      if (overviewData.status === 'rejected' && invoicesData.status === 'rejected') {
        setErrorMsg('Unable to load dashboard data. Please verify your connection.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSession();
  }, []);

  useEffect(() => {
    loadDashboardData(datePreset, customFrom, customTo);
  }, [activeBusinessId]);

  function handleFilterChange(preset: DatePresetOption, from?: string, to?: string) {
    setDatePreset(preset);
    if (from) setCustomFrom(from);
    if (to) setCustomTo(to);
    loadDashboardData(preset, from, to);
  }

  // Calculate Outstanding Invoices from Recent List
  const outstandingInvoices = recentInvoices.filter(
    (inv) => (inv.status === 'FINALIZED' || inv.status === 'PARTIAL') && inv.paymentStatus !== 'PAID'
  );

  return (
    <div className="min-h-screen bg-background-app text-text-primary flex flex-col justify-between font-sans">
      {/* ---------------------------------------------------- */}
      {/* 1. TOP HEADER */}
      {/* ---------------------------------------------------- */}
      <header className="bg-primary-900 text-white py-3.5 px-4 sm:px-6 lg:px-8 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Branding */}
          <div className="flex items-center gap-3">
            <div className="bg-primary-700 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
              J
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight leading-tight">
                  Jay Ramji Enterprise
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-800 text-primary-200 uppercase tracking-wider">
                  Billing & GST
                </span>
              </div>
              <p className="text-xs text-primary-300 font-normal hidden sm:block">
                Billing & Invoice Management System
              </p>
            </div>
          </div>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* System Status Link */}
            <Link
              href="/system-status"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-800/80 hover:bg-primary-800 text-primary-200 text-xs font-semibold transition"
              title="System & Backend Diagnostics"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden md:inline">System Status</span>
            </Link>

            {/* Notifications */}
            <button
              type="button"
              className="p-2 rounded-lg text-primary-200 hover:text-white hover:bg-primary-800 transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>

            {/* Settings */}
            <Link
              href="/dashboard/settings"
              className="p-2 rounded-lg text-primary-200 hover:text-white hover:bg-primary-800 transition"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>

            {/* User / Workspace State */}
            {user ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-primary-800 hover:bg-primary-700 text-white text-xs font-bold transition border border-primary-700/50"
              >
                <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-[11px] font-black">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <span className="max-w-[120px] truncate hidden sm:inline">{user.name}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-3.5 py-1.5 rounded-lg bg-primary-700 hover:bg-primary-600 text-white text-xs font-bold transition shadow-sm"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* MAIN DASHBOARD CONTENT */}
      {/* ---------------------------------------------------- */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* -------------------------------------------------- */}
        {/* 2. WELCOME SECTION */}
        {/* -------------------------------------------------- */}
        <div className="bg-surface-app border border-border-app rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">
                {getGreeting()}
              </span>
              <span className="text-text-muted">•</span>
              <span className="text-xs font-semibold text-text-secondary">{businessName}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight mt-0.5">
              Billing & Invoicing Workspace
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-2xl">
              Manage invoices, payments, customers and sales from one place.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/dashboard/invoices"
              className="px-4 py-2.5 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-primary rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
            >
              <FileText className="w-4 h-4 text-text-secondary" />
              <span>View Invoices</span>
            </Link>
            <Link
              href="/dashboard/invoices/create"
              className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm shadow-primary-700/20"
            >
              <FilePlus className="w-4 h-4" />
              <span>+ Create Invoice</span>
            </Link>
          </div>
        </div>

        {/* -------------------------------------------------- */}
        {/* 3. QUICK ACTIONS */}
        {/* -------------------------------------------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/dashboard/invoices/create"
            className="bg-surface-app hover:bg-surface-2-app border border-border-app hover:border-primary-700/30 rounded-xl p-3.5 flex flex-col items-center text-center transition group shadow-xs"
          >
            <div className="p-2.5 rounded-xl bg-primary-700/10 text-primary-700 group-hover:scale-105 transition">
              <FilePlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary mt-2">Create Invoice</span>
            <span className="text-[10px] text-text-muted mt-0.5">New GST / bill</span>
          </Link>

          <Link
            href="/dashboard/customers"
            className="bg-surface-app hover:bg-surface-2-app border border-border-app hover:border-primary-700/30 rounded-xl p-3.5 flex flex-col items-center text-center transition group shadow-xs"
          >
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 group-hover:scale-105 transition">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary mt-2">Add Customer</span>
            <span className="text-[10px] text-text-muted mt-0.5">Client profiles</span>
          </Link>

          <Link
            href="/dashboard/services"
            className="bg-surface-app hover:bg-surface-2-app border border-border-app hover:border-primary-700/30 rounded-xl p-3.5 flex flex-col items-center text-center transition group shadow-xs"
          >
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 group-hover:scale-105 transition">
              <PackagePlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary mt-2">Add Product</span>
            <span className="text-[10px] text-text-muted mt-0.5">Goods & services</span>
          </Link>

          <Link
            href="/dashboard/invoices"
            className="bg-surface-app hover:bg-surface-2-app border border-border-app hover:border-primary-700/30 rounded-xl p-3.5 flex flex-col items-center text-center transition group shadow-xs"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-105 transition">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary mt-2">Record Payment</span>
            <span className="text-[10px] text-text-muted mt-0.5">UPI, Cash & Bank</span>
          </Link>

          <Link
            href="/dashboard/invoices"
            className="bg-surface-app hover:bg-surface-2-app border border-border-app hover:border-primary-700/30 rounded-xl p-3.5 flex flex-col items-center text-center transition group shadow-xs"
          >
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-600 group-hover:scale-105 transition">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary mt-2">View Invoices</span>
            <span className="text-[10px] text-text-muted mt-0.5">History & PDFs</span>
          </Link>

          <Link
            href="/dashboard/analytics"
            className="bg-surface-app hover:bg-surface-2-app border border-border-app hover:border-primary-700/30 rounded-xl p-3.5 flex flex-col items-center text-center transition group shadow-xs"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-105 transition">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary mt-2">Analytics</span>
            <span className="text-[10px] text-text-muted mt-0.5">Sales trends</span>
          </Link>
        </div>

        {/* -------------------------------------------------- */}
        {/* DATE FILTER BAR */}
        {/* -------------------------------------------------- */}
        <DateFilterBar
          activePreset={datePreset}
          customFrom={customFrom}
          customTo={customTo}
          onFilterChange={handleFilterChange}
          isLoading={loading}
        />

        {/* Error notification with Retry */}
        {errorMsg && (
          <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => loadDashboardData(datePreset, customFrom, customTo)}
              className="underline font-bold hover:opacity-80 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* 4. BUSINESS OVERVIEW (KPI CARDS) */}
        {/* -------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* KPI 1: Total Sales */}
          <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Sales</span>
              <div className="p-1.5 rounded-lg bg-primary-700/10 text-primary-700">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              {loading ? (
                <div className="h-7 w-24 bg-surface-2-app animate-pulse rounded my-0.5"></div>
              ) : (
                <p className="text-xl font-black text-text-primary">
                  ₹{((overview?.kpis.salesMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-[10px] text-text-muted mt-0.5">Billed turnover</p>
            </div>
          </div>

          {/* KPI 2: Money Received */}
          <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Paid Amount</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div>
              {loading ? (
                <div className="h-7 w-24 bg-surface-2-app animate-pulse rounded my-0.5"></div>
              ) : (
                <p className="text-xl font-black text-emerald-600">
                  ₹{((overview?.kpis.moneyReceivedMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-[10px] text-text-muted mt-0.5">Collected revenue</p>
            </div>
          </div>

          {/* KPI 3: Outstanding Dues */}
          <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Outstanding Dues</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div>
              {loading ? (
                <div className="h-7 w-24 bg-surface-2-app animate-pulse rounded my-0.5"></div>
              ) : (
                <p className="text-xl font-black text-amber-600">
                  ₹{((overview?.kpis.outstandingMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-[10px] text-text-muted mt-0.5">Pending receivables</p>
            </div>
          </div>

          {/* KPI 4: Total Invoices */}
          <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Invoices</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div>
              {loading ? (
                <div className="h-7 w-16 bg-surface-2-app animate-pulse rounded my-0.5"></div>
              ) : (
                <p className="text-xl font-black text-text-primary">
                  {overview?.kpis.invoiceCount || 0}
                </p>
              )}
              <p className="text-[10px] text-text-muted mt-0.5">Finalized bills</p>
            </div>
          </div>

          {/* KPI 5: Average Invoice Value */}
          <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Avg. Ticket</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                <Calculator className="w-4 h-4" />
              </div>
            </div>
            <div>
              {loading ? (
                <div className="h-7 w-24 bg-surface-2-app animate-pulse rounded my-0.5"></div>
              ) : (
                <p className="text-xl font-black text-text-primary">
                  ₹{((overview?.kpis.averageInvoiceMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-[10px] text-text-muted mt-0.5">Average bill value</p>
            </div>
          </div>

          {/* KPI 6: Collection Rate */}
          <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Collection Rate</span>
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div>
              {loading ? (
                <div className="h-7 w-16 bg-surface-2-app animate-pulse rounded my-0.5"></div>
              ) : (
                <p className="text-xl font-black text-teal-600">
                  {overview?.kpis.paidRatePercentage || 0}%
                </p>
              )}
              <p className="text-[10px] text-text-muted mt-0.5">Paid vs billed ratio</p>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------- */}
        {/* 5. SALES OVERVIEW & 9. PAYMENT SUMMARY GRID */}
        {/* -------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Chart (2 cols on desktop) */}
          <div className="lg:col-span-2">
            <SalesOverviewChart
              series={overview?.salesOverviewSeries || []}
              title="Sales & Collections Progression"
              subtitle="Turnover billed vs cash/UPI collected over selected period."
              height={240}
            />
          </div>

          {/* Payment Method Breakdown (1 col on desktop) */}
          <div className="lg:col-span-1">
            <PaymentMethodsSummaryCard
              methods={overview?.paymentMethods || []}
            />
          </div>
        </div>

        {/* -------------------------------------------------- */}
        {/* 6. RECENT INVOICES & 7. OUTSTANDING PAYMENTS GRID */}
        {/* -------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Invoices Table (2 cols on desktop) */}
          <div className="lg:col-span-2 bg-surface-app border border-border-app rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border-app mb-4">
                <div>
                  <h3 className="font-bold text-sm text-text-primary">Recent Invoices</h3>
                  <p className="text-xs text-text-secondary">Latest finalized & draft billing records</p>
                </div>
                <Link
                  href="/dashboard/invoices"
                  className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-1 transition"
                >
                  <span>View All Invoices</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3 py-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="h-12 bg-surface-2-app animate-pulse rounded-lg"></div>
                  ))}
                </div>
              ) : recentInvoices.length === 0 ? (
                <div className="py-12 text-center">
                  <ReceiptText className="w-10 h-10 text-text-muted mx-auto mb-2" />
                  <p className="text-sm font-bold text-text-primary">No invoices yet</p>
                  <p className="text-xs text-text-secondary mt-1 mb-4">
                    Create your first invoice to start tracking sales.
                  </p>
                  <Link
                    href="/dashboard/invoices/create"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>Create Invoice</span>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border-app text-text-muted font-bold uppercase tracking-wider text-[10px]">
                        <th className="pb-2.5">Invoice No</th>
                        <th className="pb-2.5">Customer</th>
                        <th className="pb-2.5">Date</th>
                        <th className="pb-2.5 text-right">Amount</th>
                        <th className="pb-2.5 text-center">Payment</th>
                        <th className="pb-2.5 text-center">Status</th>
                        <th className="pb-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-app/50">
                      {recentInvoices.slice(0, 6).map((inv) => {
                        const grandTotal = (inv.totals?.grandTotalMinor || 0) / 100;
                        const dateStr = inv.invoiceDate
                          ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                            })
                          : '—';

                        return (
                          <tr key={inv._id || inv.id} className="hover:bg-surface-2-app/50 transition">
                            <td className="py-3 font-mono font-bold text-text-primary">
                              {inv.invoiceNumber || 'DRAFT'}
                            </td>
                            <td className="py-3 font-medium text-text-primary max-w-[140px] truncate">
                              {inv.customerSnapshot?.name || inv.customer?.name || 'Walk-in Customer'}
                            </td>
                            <td className="py-3 text-text-secondary">{dateStr}</td>
                            <td className="py-3 text-right font-bold text-text-primary">
                              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  inv.paymentStatus === 'PAID'
                                    ? 'bg-emerald-500/10 text-emerald-700'
                                    : inv.paymentStatus === 'PARTIAL'
                                    ? 'bg-amber-500/10 text-amber-700'
                                    : 'bg-danger-soft text-danger-app'
                                }`}
                              >
                                {inv.paymentStatus || 'UNPAID'}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  inv.status === 'FINALIZED'
                                    ? 'bg-blue-500/10 text-blue-700'
                                    : 'bg-surface-2-app text-text-muted'
                                }`}
                              >
                                {inv.status || 'DRAFT'}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <Link
                                href={`/dashboard/invoices/detail/${inv._id || inv.id}`}
                                className="text-primary-700 hover:text-primary-800 font-bold text-xs inline-flex items-center gap-0.5"
                              >
                                <span>Details</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {recentInvoices.length > 0 && (
              <div className="pt-4 border-t border-border-app text-right">
                <Link
                  href="/dashboard/invoices"
                  className="text-xs font-bold text-primary-700 hover:underline"
                >
                  View complete invoice history →
                </Link>
              </div>
            )}
          </div>

          {/* 7. Outstanding Payments Section (1 col on desktop) */}
          <div className="lg:col-span-1 bg-surface-app border border-border-app rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border-app mb-4">
                <div>
                  <h3 className="font-bold text-sm text-text-primary">Outstanding Payments</h3>
                  <p className="text-xs text-text-secondary">Pending customer balances</p>
                </div>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>

              {loading ? (
                <div className="space-y-3 py-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-14 bg-surface-2-app animate-pulse rounded-lg"></div>
                  ))}
                </div>
              ) : outstandingInvoices.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-text-primary">All payments are up to date</p>
                  <p className="text-xs text-text-muted mt-1">
                    No pending customer balances found.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {outstandingInvoices.slice(0, 5).map((inv) => {
                    const grandTotal = (inv.totals?.grandTotalMinor || 0) / 100;
                    const paidAmount = (inv.paymentSummary?.paidAmountMinor || 0) / 100;
                    const dueAmount = Math.max(0, grandTotal - paidAmount);

                    return (
                      <div
                        key={inv._id || inv.id}
                        className="p-3 bg-surface-2-app/50 border border-border-app rounded-lg flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-text-primary truncate">
                            {inv.customerSnapshot?.name || 'Customer'}
                          </p>
                          <p className="text-[10px] text-text-muted font-mono">
                            Bill #{inv.invoiceNumber || '—'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-amber-600">
                            ₹{dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <Link
                            href={`/dashboard/invoices/detail/${inv._id || inv.id}`}
                            className="text-[10px] font-bold text-primary-700 hover:underline inline-flex items-center gap-0.5"
                          >
                            <span>Pay</span>
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border-app text-center">
              <Link
                href="/dashboard/invoices?status=UNPAID"
                className="text-xs font-bold text-primary-700 hover:underline"
              >
                Filter all unpaid invoices →
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ---------------------------------------------------- */}
      {/* FOOTER */}
      {/* ---------------------------------------------------- */}
      <footer className="bg-surface-app border-t border-border-app py-4 px-6 text-xs text-text-muted mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary-700" />
            <span>Jay Ramji Enterprise — Billing & Invoice Management Platform</span>
          </div>
          <div className="flex items-center gap-4 text-text-secondary">
            <Link href="/dashboard" className="hover:text-text-primary transition">Dashboard</Link>
            <Link href="/dashboard/invoices" className="hover:text-text-primary transition">Invoices</Link>
            <Link href="/system-status" className="hover:text-text-primary transition">Diagnostics</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
