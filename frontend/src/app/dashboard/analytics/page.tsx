'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDashboard } from '../layout';
import { apiClient } from '../../../lib/api/client';
import {
  AnalyticsOverview,
  AnalyticsPaymentMethods,
  AnalyticsReceivingAccounts,
  AnalyticsCustomers,
  AnalyticsProducts,
  AnalyticsOutstanding,
  TimeSeriesPoint,
} from '../../../lib/api/types';
import DateFilterBar, { DatePresetOption } from '../components/DateFilterBar';
import SalesOverviewChart from '../components/SalesOverviewChart';
import { getPaymentMethodIcon, getPaymentMethodColor } from '../components/PaymentMethodsSummaryCard';
import {
  TrendingUp,
  Wallet,
  AlertCircle,
  ShoppingBag,
  Users,
  Percent,
  Calculator,
  Download,
  Building,
  CreditCard,
  Package,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  HelpCircle,
} from 'lucide-react';

export default function AnalyticsPage() {
  const { activeBusinessId } = useDashboard();

  // Filters
  const [datePreset, setDatePreset] = useState<DatePresetOption>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'hour'>('day');

  // Customer & Product Sort states
  const [customerSort, setCustomerSort] = useState<'sales' | 'orders' | 'outstanding'>('sales');
  const [productSort, setProductSort] = useState<'revenue' | 'quantity' | 'orders'>('revenue');

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trendSeries, setTrendSeries] = useState<TimeSeriesPoint[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<AnalyticsPaymentMethods | null>(null);
  const [receivingAccounts, setReceivingAccounts] = useState<AnalyticsReceivingAccounts | null>(null);
  const [customersData, setCustomersData] = useState<AnalyticsCustomers | null>(null);
  const [productsData, setProductsData] = useState<AnalyticsProducts | null>(null);
  const [outstandingData, setOutstandingData] = useState<AnalyticsOutstanding | null>(null);

  async function loadAllAnalytics(preset: DatePresetOption, from?: string, to?: string) {
    if (!activeBusinessId) return;
    setLoading(true);
    setErrorMsg(null);

    const queryParams = {
      preset: preset !== 'CUSTOM' ? preset : undefined,
      from: preset === 'CUSTOM' ? from : undefined,
      to: preset === 'CUSTOM' ? to : undefined,
    };

    try {
      const [
        overviewRes,
        trendRes,
        paymentsRes,
        accountsRes,
        customersRes,
        productsRes,
        outstandingRes,
      ] = await Promise.all([
        apiClient.getAnalyticsOverview(queryParams),
        apiClient.getSalesTrend({ ...queryParams, groupBy }),
        apiClient.getPaymentMethodAnalytics(queryParams),
        apiClient.getReceivingAccountsAnalytics(queryParams),
        apiClient.getCustomerAnalytics({ ...queryParams, sortBy: customerSort }),
        apiClient.getProductAnalytics({ ...queryParams, sortBy: productSort }),
        apiClient.getOutstandingAnalytics(),
      ]);

      setOverview(overviewRes);
      setTrendSeries(trendRes.series || []);
      setPaymentMethods(paymentsRes);
      setReceivingAccounts(accountsRes);
      setCustomersData(customersRes);
      setProductsData(productsRes);
      setOutstandingData(outstandingRes);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllAnalytics(datePreset, customFrom, customTo);
  }, [activeBusinessId, customerSort, productSort, groupBy]);

  function handleFilterChange(preset: DatePresetOption, from?: string, to?: string) {
    setDatePreset(preset);
    if (from) setCustomFrom(from);
    if (to) setCustomTo(to);
    loadAllAnalytics(preset, from, to);
  }

  // Export CSV Helper
  function exportToCSV() {
    if (!productsData?.products || !customersData?.customers) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += '=== JAY RAMJI BUSINESS ANALYTICS REPORT ===\n';
    csvContent += `Generated Date: ${new Date().toLocaleDateString('en-IN')}\n\n`;

    csvContent += '--- BEST SELLING PRODUCTS & SERVICES ---\n';
    csvContent += 'Item,Type,Quantity Sold,Orders,Revenue (INR),Avg Price (INR),Turnover %\n';
    productsData.products.forEach((p) => {
      csvContent += `"${p.description}","${p.type || 'PRODUCT'}",${p.quantitySold},${p.orders},${(p.revenueMinor / 100).toFixed(2)},${((p.averagePriceMinor || 0) / 100).toFixed(2)},${p.percentOfTurnover || 0}%\n`;
    });

    csvContent += '\n--- CUSTOMER ORDER ANALYTICS ---\n';
    csvContent += 'Customer Name,Orders,Turnover (INR),Paid (INR),Outstanding (INR),Avg Order (INR)\n';
    customersData.customers.forEach((c) => {
      csvContent += `"${c.customerName}",${c.orders},${(c.turnoverMinor / 100).toFixed(2)},${(c.paidMinor / 100).toFixed(2)},${(c.outstandingMinor / 100).toFixed(2)},${(c.averageOrderMinor / 100).toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `JayRamJi_Analytics_${datePreset}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-text-primary">Business Analytics</h1>
          <p className="text-xs text-text-secondary mt-1">
            Comprehensive business analysis across sales turnover, payments, accounts, customers, and services.
          </p>
        </div>

        <button
          type="button"
          onClick={exportToCSV}
          disabled={loading || !productsData}
          className="px-3.5 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* 2. Global Filter Bar with Date Semantics Helper */}
      <div className="space-y-2">
        <DateFilterBar
          activePreset={datePreset}
          customFrom={customFrom}
          customTo={customTo}
          onFilterChange={handleFilterChange}
          isLoading={loading}
        />
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted px-1">
          <HelpCircle className="w-3.5 h-3.5 shrink-0 text-text-muted" />
          <span>
            Sales are grouped by invoice date. Payment analytics are grouped by actual payment receipt date.
          </span>
        </div>
      </div>

      {/* Error State */}
      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => loadAllAnalytics(datePreset, customFrom, customTo)}
            className="underline font-bold hover:opacity-80 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Analytics KPI Summary Cards (7 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
        {/* KPI 1: Turnover */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Total Turnover</span>
          <p className="text-lg font-black text-text-primary">
            ₹{((overview?.kpis.turnoverMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          {overview?.comparison?.turnoverGrowthPercent !== null && overview?.comparison?.turnoverGrowthPercent !== undefined && (
            <div className="flex items-center gap-1 text-[10.5px] font-bold">
              {overview.comparison.turnoverGrowthPercent >= 0 ? (
                <span className="text-emerald-600 flex items-center">
                  <ArrowUpRight className="w-3 h-3" /> +{overview.comparison.turnoverGrowthPercent}%
                </span>
              ) : (
                <span className="text-rose-600 flex items-center">
                  <ArrowDownRight className="w-3 h-3" /> {overview.comparison.turnoverGrowthPercent}%
                </span>
              )}
              <span className="text-text-muted font-normal text-[10px]">vs prev</span>
            </div>
          )}
        </div>

        {/* KPI 2: Total Received */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Total Received</span>
          <p className="text-lg font-black text-emerald-600">
            ₹{((overview?.kpis.totalReceivedMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          {overview?.comparison?.receivedGrowthPercent !== null && overview?.comparison?.receivedGrowthPercent !== undefined && (
            <div className="flex items-center gap-1 text-[10.5px] font-bold">
              {overview.comparison.receivedGrowthPercent >= 0 ? (
                <span className="text-emerald-600 flex items-center">
                  <ArrowUpRight className="w-3 h-3" /> +{overview.comparison.receivedGrowthPercent}%
                </span>
              ) : (
                <span className="text-rose-600 flex items-center">
                  <ArrowDownRight className="w-3 h-3" /> {overview.comparison.receivedGrowthPercent}%
                </span>
              )}
              <span className="text-text-muted font-normal text-[10px]">vs prev</span>
            </div>
          )}
        </div>

        {/* KPI 3: Outstanding */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Outstanding</span>
          <p className="text-lg font-black text-amber-600">
            ₹{((overview?.kpis.outstandingMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-text-muted block">Active dues</span>
        </div>

        {/* KPI 4: Total Orders */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Total Orders</span>
          <p className="text-lg font-black text-text-primary">{overview?.kpis.totalOrders || 0}</p>
          {overview?.comparison?.ordersGrowthPercent !== null && overview?.comparison?.ordersGrowthPercent !== undefined && (
            <span className="text-emerald-600 text-[10.5px] font-bold block">
              +{overview.comparison.ordersGrowthPercent}% vs prev
            </span>
          )}
        </div>

        {/* KPI 5: Unique Customers */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Customers</span>
          <p className="text-lg font-black text-text-primary">{overview?.kpis.uniqueCustomers || 0}</p>
          <span className="text-[10px] text-text-muted block">Billed in period</span>
        </div>

        {/* KPI 6: Average Order Value */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Avg Order Value</span>
          <p className="text-lg font-black text-text-primary">
            ₹{((overview?.kpis.averageOrderValueMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-text-muted block">Per finalized bill</span>
        </div>

        {/* KPI 7: Collection Rate */}
        <div className="bg-surface-app border border-border-app rounded-xl p-4 shadow-xs space-y-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">Collection Rate</span>
          <p className="text-lg font-black text-teal-600">{overview?.kpis.collectionRate || 0}%</p>
          <span className="text-[10px] text-text-muted block">Collected / Billed</span>
        </div>
      </div>

      {/* 4. Sales Performance Chart with Granularity Selector */}
      <div className="space-y-2">
        <div className="flex justify-end gap-2 text-xs">
          <span className="text-text-muted self-center text-[11px] font-semibold uppercase">Granularity:</span>
          {(['hour', 'day', 'week', 'month'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupBy(g)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition ${
                groupBy === g
                  ? 'bg-primary-700 text-white'
                  : 'bg-surface-2-app text-text-secondary hover:bg-surface-app'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <SalesOverviewChart
          series={trendSeries}
          title="Turnover vs Payments Timeline"
          subtitle="Time-series comparison of invoice billing amounts against payment collections."
          height={260}
        />
      </div>

      {/* 5. Payment Analytics & Receiving Accounts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left (7 cols): Payment Channel Analytics & Frequencies */}
        <div className="lg:col-span-7 bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-2">
            <div>
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-primary-700" />
                <span>Payment Method Analytics</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Breakdown of receipts across UPI, Bank Transfer, Cash, Cheque, and QR.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-text-muted uppercase font-semibold block">Total Collected</span>
              <span className="font-black text-emerald-600 text-xs">
                ₹{(((paymentMethods?.totalReceivedMinor || 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Highlights: Most Used & Highest Value */}
          {paymentMethods && (paymentMethods.mostUsedMethod || paymentMethods.highestValueMethod) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {paymentMethods.mostUsedMethod && (
                <div className="bg-surface-2-app border border-border-app p-3 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-text-muted tracking-wider block">
                    Most Frequent Channel
                  </span>
                  <div className="flex items-center gap-2">
                    {getPaymentMethodIcon(paymentMethods.mostUsedMethod.method)}
                    <span className="font-black text-sm text-text-primary">
                      {paymentMethods.mostUsedMethod.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    {paymentMethods.mostUsedMethod.count} payments ({paymentMethods.mostUsedMethod.percentage}% of transactions)
                  </p>
                </div>
              )}

              {paymentMethods.highestValueMethod && (
                <div className="bg-surface-2-app border border-border-app p-3 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase text-text-muted tracking-wider block">
                    Highest Value Channel
                  </span>
                  <div className="flex items-center gap-2">
                    {getPaymentMethodIcon(paymentMethods.highestValueMethod.method)}
                    <span className="font-black text-sm text-emerald-600">
                      ₹{((paymentMethods.highestValueMethod.amountMinor / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    {paymentMethods.highestValueMethod.label} ({paymentMethods.highestValueMethod.percentage}% of collected revenue)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Methods Detailed Table */}
          {(!paymentMethods?.methods || paymentMethods.methods.length === 0) ? (
            <div className="py-8 text-center text-text-muted text-xs">
              No payment transactions recorded during this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-text-muted font-bold border-b border-border-light text-[10.5px] uppercase">
                    <th className="pb-2">Payment Method</th>
                    <th className="pb-2 text-center">Transactions</th>
                    <th className="pb-2 text-right">Amount Received</th>
                    <th className="pb-2 text-right">Share %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {paymentMethods.methods.map((m) => (
                    <tr key={m.method} className="hover:bg-surface-2-app/40">
                      <td className="py-2.5 font-bold text-text-primary flex items-center gap-2">
                        {getPaymentMethodIcon(m.method)}
                        <span>{m.label}</span>
                      </td>
                      <td className="py-2.5 text-center text-text-secondary font-semibold">{m.transactions ?? m.count}</td>
                      <td className="py-2.5 text-right font-black text-text-primary">
                        ₹{(m.amountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 text-right font-bold text-emerald-600">{m.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right (5 cols): Receiving Accounts Performance */}
        <div className="lg:col-span-5 bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-2">
            <div>
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <Building className="w-4 h-4 text-primary-700" />
                <span>Receiving Accounts</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">Where customer collections were deposited.</p>
            </div>
          </div>

          {(!receivingAccounts?.accounts || receivingAccounts.accounts.length === 0) ? (
            <div className="py-8 text-center text-text-muted text-xs">
              No payments recorded into registered business accounts.
            </div>
          ) : (
            <div className="space-y-3">
              {receivingAccounts.accounts.map((acc, idx) => (
                <div key={acc.accountId || idx} className="p-3 bg-surface-2-app/50 border border-border-app rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-text-primary truncate max-w-[200px]">
                      {acc.accountName}
                    </span>
                    <span className="font-black text-xs text-emerald-600">
                      ₹{(acc.amountReceivedMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] text-text-muted">
                    <span>{acc.paymentCount} payments received</span>
                    <span className="font-bold text-text-secondary">{acc.percentage}% of total</span>
                  </div>

                  {/* Visual mini-bar */}
                  <div className="h-1.5 w-full bg-border-light rounded-full overflow-hidden">
                    <div
                      style={{ width: `${acc.percentage}%` }}
                      className="h-full bg-primary-700 rounded-full"
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. Customer Order Analytics Section */}
      <div className="bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-light pb-3">
          <div>
            <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary-700" />
              <span>Customer Sales & Order Analysis</span>
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Breakdown of customer orders, billed turnover, collections, and dues.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted font-medium text-[11px]">Sort By:</span>
            <button
              type="button"
              onClick={() => setCustomerSort('sales')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                customerSort === 'sales' ? 'bg-primary-700 text-white' : 'bg-surface-2-app text-text-secondary'
              }`}
            >
              Highest Sales
            </button>
            <button
              type="button"
              onClick={() => setCustomerSort('orders')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                customerSort === 'orders' ? 'bg-primary-700 text-white' : 'bg-surface-2-app text-text-secondary'
              }`}
            >
              Most Orders
            </button>
            <button
              type="button"
              onClick={() => setCustomerSort('outstanding')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                customerSort === 'outstanding' ? 'bg-primary-700 text-white' : 'bg-surface-2-app text-text-secondary'
              }`}
            >
              Highest Dues
            </button>
          </div>
        </div>

        {(!customersData?.customers || customersData.customers.length === 0) ? (
          <div className="py-8 text-center text-text-muted text-xs">
            No customer order history in this selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-2-app text-text-muted font-bold border-b border-border-app text-[11px] uppercase">
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4 text-center">Orders</th>
                  <th className="py-2.5 px-4 text-right">Total Sales</th>
                  <th className="py-2.5 px-4 text-right">Average Order</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {customersData.customers.map((c, idx) => (
                  <tr key={c.customerId || idx} className="hover:bg-surface-2-app/30">
                    <td className="py-3 px-4 font-bold text-text-primary">{c.customerName}</td>
                    <td className="py-3 px-4 text-center text-text-secondary font-semibold">{c.orders}</td>
                    <td className="py-3 px-4 text-right font-black text-text-primary">
                      ₹{(c.turnoverMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right text-text-secondary">
                      ₹{(c.averageOrderMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      ₹{(c.paidMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-amber-600">
                      {c.outstandingMinor > 0 ? (
                        `₹${(c.outstandingMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      ) : (
                        <span className="text-emerald-600 font-bold text-[11px]">Paid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7. Best Selling Products & Services Section */}
      <div className="bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-light pb-3">
          <div>
            <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
              <Package className="w-4 h-4 text-primary-700" />
              <span>Products & Services Performance</span>
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Derived strictly from finalized invoice line-item snapshots and revenue.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted font-medium text-[11px]">Sort By:</span>
            <button
              type="button"
              onClick={() => setProductSort('revenue')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                productSort === 'revenue' ? 'bg-primary-700 text-white' : 'bg-surface-2-app text-text-secondary'
              }`}
            >
              Top Revenue
            </button>
            <button
              type="button"
              onClick={() => setProductSort('quantity')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                productSort === 'quantity' ? 'bg-primary-700 text-white' : 'bg-surface-2-app text-text-secondary'
              }`}
            >
              Top Quantity
            </button>
            <button
              type="button"
              onClick={() => setProductSort('orders')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                productSort === 'orders' ? 'bg-primary-700 text-white' : 'bg-surface-2-app text-text-secondary'
              }`}
            >
              Most Orders
            </button>
          </div>
        </div>

        {(!productsData?.products || productsData.products.length === 0) ? (
          <div className="py-8 text-center text-text-muted text-xs">
            No line-item sales found for the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-2-app text-text-muted font-bold border-b border-border-app text-[11px] uppercase">
                  <th className="py-2.5 px-4">Item / Service</th>
                  <th className="py-2.5 px-4 text-center">Type</th>
                  <th className="py-2.5 px-4 text-center">Quantity Sold</th>
                  <th className="py-2.5 px-4 text-center">Orders</th>
                  <th className="py-2.5 px-4 text-right">Avg Unit Price</th>
                  <th className="py-2.5 px-4 text-right">Turnover %</th>
                  <th className="py-2.5 px-4 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {productsData.products.map((item, idx) => (
                  <tr key={item.description || idx} className="hover:bg-surface-2-app/30">
                    <td className="py-3 px-4 font-bold text-text-primary">{item.description}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-2-app border border-border-app uppercase">
                        {item.type || 'PRODUCT'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-text-primary">{item.quantitySold}</td>
                    <td className="py-3 px-4 text-center text-text-secondary">{item.orders}</td>
                    <td className="py-3 px-4 text-right text-text-secondary">
                      ₹{((item.averagePriceMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-primary-700">{item.percentOfTurnover || 0}%</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600">
                      ₹{(item.revenueMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 8. Outstanding Dues In-Depth Analysis */}
      {outstandingData && (
        <div className="bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-2">
            <div>
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Outstanding Dues Analysis</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Detailed aging status of pending receivables and top debtor accounts.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-text-muted uppercase font-semibold block">Total Pending Dues</span>
              <span className="font-black text-amber-600 text-sm">
                ₹{(outstandingData.totalOutstandingMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-surface-2-app rounded-xl border border-border-app space-y-1">
              <span className="text-[10.5px] font-bold uppercase text-text-muted block">Unpaid Invoices</span>
              <p className="text-base font-black text-rose-600">
                ₹{(outstandingData.breakdown.unpaidMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10.5px] text-text-muted">{outstandingData.breakdown.unpaidCount} bills with 0% paid</span>
            </div>

            <div className="p-3 bg-surface-2-app rounded-xl border border-border-app space-y-1">
              <span className="text-[10.5px] font-bold uppercase text-text-muted block">Partially Paid Invoices</span>
              <p className="text-base font-black text-amber-600">
                ₹{(outstandingData.breakdown.partialMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10.5px] text-text-muted">{outstandingData.breakdown.partialCount} bills with partial payments</span>
            </div>

            <div className="p-3 bg-surface-2-app rounded-xl border border-border-app space-y-1">
              <span className="text-[10.5px] font-bold uppercase text-text-muted block">Average Due / Bill</span>
              <p className="text-base font-black text-text-primary">
                ₹{(outstandingData.averageDueMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10.5px] text-text-muted">Across {outstandingData.outstandingInvoiceCount} unpaid bills</span>
            </div>
          </div>

          {/* Top Outstanding Debtors */}
          {outstandingData.topCustomers.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold text-text-secondary uppercase mb-2">Top Outstanding Customer Balances</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-text-muted font-bold border-b border-border-light text-[10.5px] uppercase">
                      <th className="pb-2">Customer</th>
                      <th className="pb-2">Phone</th>
                      <th className="pb-2 text-center">Unpaid Invoices</th>
                      <th className="pb-2 text-right">Outstanding Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {outstandingData.topCustomers.map((debtor, idx) => (
                      <tr key={debtor.customerId || idx} className="hover:bg-surface-2-app/40">
                        <td className="py-2.5 font-bold text-text-primary">{debtor.customerName}</td>
                        <td className="py-2.5 text-text-secondary font-mono">{debtor.phone || 'N/A'}</td>
                        <td className="py-2.5 text-center text-text-secondary font-semibold">{debtor.invoiceCount}</td>
                        <td className="py-2.5 text-right font-black text-amber-600">
                          ₹{(debtor.outstandingMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
