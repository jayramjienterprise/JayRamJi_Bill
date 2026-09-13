'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDashboard } from './layout';
import { apiClient } from '../../lib/api/client';
import { DashboardOverview, RecentActivityItem } from '../../lib/api/types';
import { purchasesApi } from '../../lib/api/purchases';
import DateFilterBar, { DatePresetOption } from './components/DateFilterBar';
import SalesOverviewChart from './components/SalesOverviewChart';
import PaymentMethodsSummaryCard from './components/PaymentMethodsSummaryCard';
import {
  TrendingUp,
  Wallet,
  AlertCircle,
  FileText,
  Percent,
  Calculator,
  Plus,
  ArrowUpRight,
  ChevronRight,
  Users,
  Package,
  Activity,
  CreditCard,
  Building,
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  Building2,
  DollarSign,
  Receipt,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, activeBusinessId } = useDashboard();

  // State
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [purchaseData, setPurchaseData] = useState<any>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter state
  const [datePreset, setDatePreset] = useState<DatePresetOption>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  async function loadDashboardData(preset: DatePresetOption, from?: string, to?: string) {
    if (!activeBusinessId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const [overviewData, invoicesData, activityData, purchaseDashboard] = await Promise.all([
        apiClient.getDashboardOverview({
          preset: preset !== 'CUSTOM' ? preset : undefined,
          from: preset === 'CUSTOM' ? from : undefined,
          to: preset === 'CUSTOM' ? to : undefined,
        }),
        apiClient.getRecentInvoices(6),
        apiClient.getRecentActivity(),
        purchasesApi.getPurchaseDashboard().catch(() => null),
      ]);

      setOverview(overviewData);
      setRecentInvoices(invoicesData || []);
      setRecentActivity(activityData || []);
      setPurchaseData(purchaseDashboard);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData(datePreset, customFrom, customTo);
  }, [activeBusinessId]);

  function handleFilterChange(preset: DatePresetOption, from?: string, to?: string) {
    setDatePreset(preset);
    if (from) setCustomFrom(from);
    if (to) setCustomTo(to);
    loadDashboardData(preset, from, to);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header with Title and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-text-primary">
            Welcome, {user?.name || 'Jay Ramji Owner'}
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Business overview, sales revenue, procurement expenses, and recent operations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/dashboard/analytics"
            className="px-3 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary transition flex items-center gap-1.5 shadow-xs"
          >
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Sales Analytics</span>
          </Link>
          <Link
            href="/dashboard/purchases/new"
            className="px-3.5 py-2 bg-surface-app hover:bg-surface-2-app border border-border-app text-text-primary rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
            <span>+ New Purchase</span>
          </Link>
          <Link
            href="/dashboard/amc/quotations/create?category=general"
            className="px-3.5 py-2 bg-surface-app hover:bg-surface-2-app border border-border-app text-text-primary rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4 text-text-secondary" />
            <span className="hidden sm:inline">+ Quotation</span>
          </Link>
          <Link
            href="/dashboard/invoices/create"
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-primary-700/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Invoice</span>
          </Link>
        </div>
      </div>

      {/* 2. Global Date Filter Bar */}
      <DateFilterBar
        activePreset={datePreset}
        customFrom={customFrom}
        customTo={customTo}
        onFilterChange={handleFilterChange}
        isLoading={loading}
      />

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl font-semibold flex items-center justify-between">
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

      {/* 3. Top Sales & Revenue KPI Metric Grid */}
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
            <p className="text-xl font-black text-text-primary">
              ₹{((overview?.kpis.salesMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5" title="Finalized invoice totals in period">
              Billed turnover
            </p>
          </div>
        </div>

        {/* KPI 2: Money Received */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Money Received</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-emerald-600">
              ₹{((overview?.kpis.moneyReceivedMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5" title="Actual collected payments in period">
              Collected cash & bank
            </p>
          </div>
        </div>

        {/* KPI 3: Customer Outstanding Dues */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Customer Dues</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-amber-600">
              ₹{((overview?.kpis.outstandingMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5" title="Current pending balance on finalized customer invoices">
              Receivables from clients
            </p>
          </div>
        </div>

        {/* KPI 4: Invoices Count */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Invoices</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-text-primary">
              {overview?.kpis.invoiceCount || 0}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">Finalized bills</p>
          </div>
        </div>

        {/* KPI 5: Average Invoice */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg. Ticket</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-text-primary">
              ₹{((overview?.kpis.averageInvoiceMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">Average bill value</p>
          </div>
        </div>

        {/* KPI 6: Paid Collection Rate */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Collection Rate</span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-teal-600">
              {overview?.kpis.paidRatePercentage || 0}%
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">Collected vs billed</p>
          </div>
        </div>
      </div>

      {/* 4. Purchase & Procurement Analytics Section */}
      <div className="bg-surface-app border border-border-app rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-light pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <span>Purchase & Procurement Analytics</span>
                <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                  Expenses & Stock
                </span>
              </h2>
              <p className="text-[11px] text-text-muted">
                Track products ordered, vendor bills, outstanding payables, and incoming inventory shipments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/dashboard/purchases/vendors"
              className="text-xs font-semibold text-text-secondary hover:text-text-primary px-3 py-1.5 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg transition flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5 text-text-muted" />
              <span>Vendors ({purchaseData?.topVendors?.length || 0})</span>
            </Link>
            <Link
              href="/dashboard/purchases/dashboard"
              className="text-xs font-bold text-primary-700 hover:text-primary-800 px-3 py-1.5 bg-primary-700/10 hover:bg-primary-700/20 rounded-lg transition flex items-center gap-1"
            >
              <span>Full Purchase Analytics</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Purchase Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Purchase KPI 1: Total Purchases */}
          <div className="bg-surface-2-app/50 border border-border-app rounded-xl p-4 space-y-1.5 hover:border-indigo-300 transition">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Purchases</span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-text-primary">
              ₹{(purchaseData?.summary?.totalPurchased || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10.5px] text-text-muted">
              {purchaseData?.summary?.totalCount || 0} total purchase orders
            </p>
          </div>

          {/* Purchase KPI 2: Outstanding Payables (Vendor Dues) */}
          <div className="bg-surface-2-app/50 border border-border-app rounded-xl p-4 space-y-1.5 hover:border-rose-300 transition">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Vendor Payables</span>
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-rose-600">
              ₹{(purchaseData?.summary?.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10.5px] text-text-muted">
              Outstanding vendor credit balance
            </p>
          </div>

          {/* Purchase KPI 3: Total Paid to Vendors */}
          <div className="bg-surface-2-app/50 border border-border-app rounded-xl p-4 space-y-1.5 hover:border-emerald-300 transition">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Paid to Vendors</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-emerald-600">
              ₹{(purchaseData?.summary?.totalPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10.5px] text-text-muted">
              Settled purchase bills
            </p>
          </div>

          {/* Purchase KPI 4: Pending Deliveries */}
          <div className="bg-surface-2-app/50 border border-border-app rounded-xl p-4 space-y-1.5 hover:border-amber-300 transition">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Pending Deliveries</span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-amber-600">
              {purchaseData?.summary?.pendingDeliveriesCount || 0}
            </p>
            <p className="text-[10.5px] text-text-muted">
              Orders awaiting physical receiving
            </p>
          </div>
        </div>
      </div>

      {/* 5. Sales & Payments Overview Chart */}
      <SalesOverviewChart
        series={overview?.salesOverviewSeries || []}
        title="Sales & Payments Progression"
        subtitle="Turnover billed vs cash/UPI collected over the selected timeframe."
        height={220}
      />

      {/* 6. Middle Grid: Customer Receivables vs Vendor Payables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left (6 cols): Customer Outstanding Invoices (Receivables) */}
        <div className="lg:col-span-6 bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-2">
            <div>
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Customer Invoices Due (Receivables)</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Unpaid customer bills awaiting collection.
              </p>
            </div>
            <Link
              href="/dashboard/invoices?paymentStatus=UNPAID"
              className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(!overview?.outstandingInvoices || overview.outstandingInvoices.length === 0) ? (
            <div className="py-8 text-center text-text-muted text-xs">
              All customer invoices are fully settled! No pending dues.
            </div>
          ) : (
            <div className="divide-y divide-border-light">
              {overview.outstandingInvoices.slice(0, 4).map((inv) => (
                <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-text-primary">{inv.invoiceNumber}</span>
                      <span className="truncate text-text-secondary max-w-[150px]">
                        {inv.customerName}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted">
                      Total ₹{(inv.grandTotalMinor / 100).toLocaleString('en-IN')} • Date:{' '}
                      {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-text-muted uppercase font-semibold block">Due</span>
                      <span className="font-black text-amber-600 text-xs">
                        ₹{(inv.dueAmountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/invoices/detail/${inv.id}`}
                      className="px-2.5 py-1 bg-primary-700/10 hover:bg-primary-700/20 text-primary-700 font-bold rounded-lg text-xs transition cursor-pointer"
                    >
                      Collect
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (6 cols): Outstanding Vendor Payables */}
        <div className="lg:col-span-6 bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-2">
            <div>
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Vendor Payables Due (Credit Bills)</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Outstanding purchase bills to suppliers awaiting settlement.
              </p>
            </div>
            <Link
              href="/dashboard/purchases?paymentStatus=UNPAID"
              className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(!purchaseData?.outstandingPayables || purchaseData.outstandingPayables.length === 0) ? (
            <div className="py-8 text-center text-text-muted text-xs">
              All vendor bills are completely paid! No outstanding payables.
            </div>
          ) : (
            <div className="divide-y divide-border-light">
              {purchaseData.outstandingPayables.slice(0, 4).map((p: any) => (
                <div key={p._id || p.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-text-primary">{p.purchaseNumber}</span>
                      <span className="truncate text-text-secondary max-w-[150px]">
                        {p.vendor?.name || p.vendorNameSnapshot || 'Vendor'}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted">
                      Total ₹{(p.totalAmount || 0).toLocaleString('en-IN')} • Date:{' '}
                      {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-text-muted uppercase font-semibold block">Payable</span>
                      <span className="font-black text-rose-600 text-xs">
                        ₹{(p.outstandingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/purchases/${p._id || p.id}`}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs transition border border-rose-200"
                    >
                      Pay Bill
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7. Lower Grid: Payment Channels & Top Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left (5 cols): Payment Methods Breakdown */}
        <div className="lg:col-span-5">
          <PaymentMethodsSummaryCard methods={overview?.paymentMethods || []} />
        </div>

        {/* Right (7 cols): Top Suppliers & Vendors */}
        <div className="lg:col-span-7 bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-2">
            <div>
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary-700" />
                <span>Top Suppliers & Vendors</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">Highest volume spare parts & equipment vendors.</p>
            </div>
            <Link
              href="/dashboard/purchases/vendors"
              className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-1"
            >
              <span>Manage Vendors</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(!purchaseData?.topVendors || purchaseData.topVendors.length === 0) ? (
            <div className="py-8 text-center text-text-muted text-xs">
              No vendor purchase history recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-text-muted font-bold border-b border-border-light text-[10.5px] uppercase">
                    <th className="pb-2">Vendor Name</th>
                    <th className="pb-2 text-center">Orders</th>
                    <th className="pb-2 text-right">Total Purchased</th>
                    <th className="pb-2 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {purchaseData.topVendors.map((ven: any, idx: number) => (
                    <tr key={ven.vendorId || idx} className="hover:bg-surface-2-app/40">
                      <td className="py-2.5 font-bold text-text-primary truncate max-w-[170px]">
                        <Link href={`/dashboard/purchases/vendors/${ven.vendorId}`} className="hover:underline text-primary-700">
                          {ven.name}
                        </Link>
                      </td>
                      <td className="py-2.5 text-center text-text-secondary font-semibold">{ven.totalPurchases}</td>
                      <td className="py-2.5 text-right font-bold text-text-primary">
                        ₹{(ven.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 text-right font-bold text-rose-600">
                        {(ven.outstandingAmount || 0) > 0 ? (
                          `₹${(ven.outstandingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        ) : (
                          <span className="text-emerald-600 text-[11px] font-semibold">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 8. Lower Grid: Top Customers & Best Selling Catalogue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Top Customers (6 cols) */}
        <div className="lg:col-span-6 bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-2">
            <div>
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary-700" />
                <span>Top Customers</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">Highest turnover clients during selected period.</p>
            </div>
            <Link
              href="/dashboard/analytics"
              className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-1"
            >
              <span>Full Breakdown</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(!overview?.topCustomers || overview.topCustomers.length === 0) ? (
            <div className="py-8 text-center text-text-muted text-xs">
              No customer transactions recorded in this date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-text-muted font-bold border-b border-border-light text-[10.5px] uppercase">
                    <th className="pb-2">Customer</th>
                    <th className="pb-2 text-center">Orders</th>
                    <th className="pb-2 text-right">Sales</th>
                    <th className="pb-2 text-right">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {overview.topCustomers.map((cust, idx) => (
                    <tr key={cust.customerId || idx} className="hover:bg-surface-2-app/40">
                      <td className="py-2.5 font-bold text-text-primary truncate max-w-[150px]">
                        {cust.customerName}
                      </td>
                      <td className="py-2.5 text-center text-text-secondary font-semibold">{cust.orders}</td>
                      <td className="py-2.5 text-right font-bold text-text-primary">
                        ₹{(cust.salesMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 text-right font-bold text-amber-600">
                        {cust.outstandingMinor > 0 ? (
                          `₹${(cust.outstandingMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        ) : (
                          <span className="text-emerald-600 text-[11px]">Paid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Best Selling Items (6 cols) */}
        <div className="lg:col-span-6 bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-2">
            <div>
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <Package className="w-4 h-4 text-primary-700" />
                <span>Best Selling Items</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">Top billed services and parts from finalized invoices.</p>
            </div>
            <Link
              href="/dashboard/services"
              className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-1"
            >
              <span>Catalogue</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(!overview?.bestSelling || overview.bestSelling.length === 0) ? (
            <div className="py-8 text-center text-text-muted text-xs">
              No line item sales recorded in this date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-text-muted font-bold border-b border-border-light text-[10.5px] uppercase">
                    <th className="pb-2">Item / Service</th>
                    <th className="pb-2 text-center">Qty</th>
                    <th className="pb-2 text-center">Orders</th>
                    <th className="pb-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {overview.bestSelling.map((item, idx) => (
                    <tr key={item.description || idx} className="hover:bg-surface-2-app/40">
                      <td className="py-2.5 font-bold text-text-primary truncate max-w-[160px]">
                        {item.description}
                      </td>
                      <td className="py-2.5 text-center text-text-secondary font-semibold">{item.quantitySold}</td>
                      <td className="py-2.5 text-center text-text-secondary">{item.orders}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-600">
                        ₹{(item.revenueMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 9. Recent Invoices Table */}
      <div className="bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border-light pb-2">
          <div>
            <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary-700" />
              <span>Recent Invoices</span>
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Latest finalized and draft bills created in the system.</p>
          </div>
          <Link
            href="/dashboard/invoices"
            className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-1"
          >
            <span>View All Invoices</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="py-8 text-center text-text-muted text-xs space-y-3">
            <p>No invoices created yet. Issue your first bill or create a quotation.</p>
            <div className="flex items-center justify-center gap-2">
              <Link
                href="/dashboard/amc/quotations/create?category=general"
                className="px-3 py-1.5 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-primary rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-text-secondary" />
                <span>+ Create Quotation</span>
              </Link>
              <Link
                href="/dashboard/invoices/create"
                className="px-3 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Create Invoice</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-2-app border-b border-border-app text-[11px] font-bold text-text-muted uppercase">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-center">Payment Status</th>
                  <th className="py-2.5 px-4 text-center">Invoice Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-2-app/30">
                    <td className="py-3 px-4 font-mono font-bold text-primary-700">
                      <Link href={`/dashboard/invoices/detail/${inv.id}`} className="hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-bold text-text-primary">{inv.customerName}</td>
                    <td className="py-3 px-4 text-text-secondary">
                      {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-text-primary">
                      ₹{(inv.grandTotalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase ${
                          inv.paymentStatus === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                            : inv.paymentStatus === 'PARTIALLY_PAID' || inv.paymentStatus === 'PARTIAL'
                            ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-700 border border-rose-500/20'
                        }`}
                      >
                        {inv.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIAL' : inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase ${
                          inv.status === 'FINALIZED'
                            ? 'bg-blue-500/10 text-blue-700 border border-blue-500/20'
                            : inv.status === 'DRAFT'
                            ? 'bg-slate-500/10 text-slate-700 border border-slate-500/20'
                            : 'bg-rose-500/10 text-rose-700 border border-rose-500/20'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/dashboard/invoices/detail/${inv.id}`}
                        className="px-2.5 py-1 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg font-bold text-text-secondary hover:text-text-primary transition"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 10. Recent Activity Timeline */}
      {recentActivity.length > 0 && (
        <div className="bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5 border-b border-border-light pb-2">
            <Activity className="w-4 h-4 text-primary-700" />
            <span>Recent Activity Stream</span>
          </h3>

          <div className="divide-y divide-border-light">
            {recentActivity.map((act) => (
              <div key={act.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg ${
                      act.type === 'PAYMENT_RECEIVED'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-blue-500/10 text-blue-600'
                    }`}
                  >
                    {act.type === 'PAYMENT_RECEIVED' ? (
                      <Wallet className="w-3.5 h-3.5" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-text-primary">{act.title}</p>
                    <p className="text-[10.5px] text-text-muted">{act.description}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-bold text-text-primary">
                    ₹{(act.amountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-text-muted block">
                    {new Date(act.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
