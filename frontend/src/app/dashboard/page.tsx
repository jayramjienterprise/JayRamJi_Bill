'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDashboard } from './layout';
import { apiClient } from '../../lib/api/client';

export default function DashboardHome() {
  const { user, activeBusinessId, businesses } = useDashboard();
  const activeBusiness = businesses.find((b) => b.id === activeBusinessId);

  // Filter range preset selection
  const [rangePreset, setRangePreset] = useState('this-month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Dashboard Data State
  const [overview, setOverview] = useState<{
    revenueMinor: number;
    invoiceCount: number;
    paidMinor: number;
    outstandingMinor: number;
    averageInvoiceMinor: number;
    currency: string;
  } | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [topServices, setTopServices] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);

  // Page level states
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Apply default date ranges based on preset selection
  useEffect(() => {
    const today = new Date();
    let startStr = '';
    let endStr = today.toISOString().substring(0, 10);

    if (rangePreset === 'today') {
      startStr = endStr;
    } else if (rangePreset === 'this-week') {
      const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // start from Monday
      const start = new Date(today.setDate(diff));
      startStr = start.toISOString().substring(0, 10);
    } else if (rangePreset === 'this-month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      startStr = firstDay.toISOString().substring(0, 10);
    } else if (rangePreset === 'last-month') {
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      startStr = firstDayLastMonth.toISOString().substring(0, 10);
      endStr = lastDayLastMonth.toISOString().substring(0, 10);
    }

    if (rangePreset !== 'custom') {
      setFromDate(startStr);
      setToDate(endStr);
    }
  }, [rangePreset]);

  // Load dashboard metrics
  async function loadDashboard() {
    if (!activeBusinessId || !fromDate || !toDate) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // Run queries concurrently
      const [overviewData, recent, trend, services, customers] = await Promise.all([
        apiClient.getDashboardOverview({ from: fromDate, to: toDate }),
        apiClient.getRecentInvoices(5),
        apiClient.getRevenueAnalytics({ from: fromDate, to: toDate, groupBy: rangePreset === 'today' || rangePreset === 'this-week' ? 'day' : 'month' }),
        apiClient.getTopServices({ from: fromDate, to: toDate, limit: 5 }),
        apiClient.getCustomerAnalytics({ from: fromDate, to: toDate, limit: 5 }),
      ]);

      setOverview(overviewData);
      setRecentInvoices(recent);
      setRevenueTrend(trend.series || []);
      setTopServices(services || []);
      setTopCustomers(customers || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load workspace analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [activeBusinessId, fromDate, toDate]);

  // Check if there are absolutely zero finalized invoices in the system
  const hasNoDataAtAll = !loading && overview && overview.invoiceCount === 0 && recentInvoices.length === 0;

  // Custom SVG chart calculation helpers
  function renderSVGChart() {
    if (!revenueTrend || revenueTrend.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border-app rounded-xl bg-surface-2-app/30 text-xs text-text-secondary">
          <p>No Sales Data recorded for the selected period.</p>
        </div>
      );
    }

    const maxVal = Math.max(...revenueTrend.map((s: any) => s.revenueMinor), 100000);
    const n = revenueTrend.length;
    
    // Map points to coordinates within 500x200 canvas
    const points = revenueTrend.map((s: any, idx: number) => {
      const x = n > 1 ? (idx / (n - 1)) * 420 + 40 : 250;
      const y = 160 - (s.revenueMinor / maxVal) * 120;
      return { x, y, label: s.period, val: s.revenueMinor };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = points.length > 0 ? `${pathD} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z` : '';

    return (
      <div className="relative w-full">
        <svg viewBox="0 0 500 200" className="w-full h-auto overflow-visible">
          <defs>
            {/* Smooth visual gradient */}
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e40af" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#1e40af" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="30" y1="160" x2="480" y2="160" stroke="var(--color-border-app)" strokeWidth="1" />
          <line x1="30" y1="100" x2="480" y2="100" stroke="var(--color-border-app)" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
          <line x1="30" y1="40" x2="480" y2="40" stroke="var(--color-border-app)" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />

          {/* Area fill */}
          {areaD && <path d={areaD} fill="url(#chartGradient)" />}

          {/* Line stroke */}
          {pathD && <path d={pathD} fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

          {/* Interactive markers */}
          {points.map((p, idx) => (
            <g key={idx} className="group cursor-pointer">
              <circle cx={p.x} cy={p.y} r="4" fill="#1e40af" stroke="#ffffff" strokeWidth="1.5" className="transition-all hover:r-6" />
              {/* Tooltip bubble on hover */}
              <text
                x={p.x}
                y={p.y - 12}
                textAnchor="middle"
                fontSize="8"
                fontWeight="bold"
                fill="var(--color-text-primary)"
                className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-surface-app"
              >
                ₹{(p.val / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </text>
            </g>
          ))}

          {/* Y Axis Max Label */}
          <text x="25" y="44" fontSize="8" fill="var(--color-text-muted)" textAnchor="end">
            ₹{(maxVal / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </text>
          {/* Y Axis Min Label */}
          <text x="25" y="164" fontSize="8" fill="var(--color-text-muted)" textAnchor="end">
            ₹0
          </text>

          {/* X Axis Labels */}
          {points.map((p, idx) => {
            // Render alternate labels if there are too many to avoid overlap
            if (n > 8 && idx % Math.ceil(n / 6) !== 0) return null;
            
            // Format labels ("2026-08" -> "Aug", "2026-08-12" -> "12 Aug")
            let formattedLabel = p.label;
            const parts = p.label.split('-');
            if (parts.length === 2) {
              const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
              formattedLabel = dateObj.toLocaleDateString('en-IN', { month: 'short' });
            } else if (parts.length === 3) {
              const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              formattedLabel = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            }

            return (
              <text key={idx} x={p.x} y="178" fontSize="8" fill="var(--color-text-secondary)" textAnchor="middle">
                {formattedLabel}
              </text>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Welcome Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Welcome, {user?.name}!</h1>
          <p className="text-sm text-text-secondary mt-1">
            Analyze sales, monitor transaction logs, and review outstanding accounts.
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <Link
            href="/dashboard/invoices/create"
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold shadow-sm transition"
          >
            + Create Invoice
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-sm rounded-lg font-medium">
          {errorMsg}
        </div>
      )}

      {/* Date controls panel */}
      <div className="bg-surface-app border border-border-app p-4 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary uppercase">Period:</span>
          {['today', 'this-week', 'this-month', 'last-month', 'custom'].map((preset) => (
            <button
              key={preset}
              onClick={() => setRangePreset(preset)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition border cursor-pointer ${
                rangePreset === preset
                  ? 'bg-primary-900/10 border-primary-700 text-primary-700'
                  : 'bg-surface-2-app border-border-app text-text-secondary hover:bg-surface-app'
              }`}
            >
              {preset.replace('-', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {rangePreset === 'custom' && (
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none"
            />
            <span className="text-xs text-text-muted">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none"
            />
            <button
              onClick={loadDashboard}
              className="px-3 py-1 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {hasNoDataAtAll ? (
        /* Designed Empty State */
        <div className="bg-surface-app border border-border-app p-12 rounded-xl text-center shadow-sm space-y-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-lg font-bold text-text-primary mb-2">No Sales Data recorded yet</h2>
            <p className="text-xs text-text-secondary leading-relaxed mb-6">
              There are no finalized invoices in your business workspace. Finalize your first invoice to view visual trends, customer distributions, and outstanding balances.
            </p>
            <Link
              href="/dashboard/invoices/create"
              className="px-6 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold transition shadow"
            >
              Create First Invoice Draft
            </Link>
          </div>
        </div>
      ) : loading ? (
        /* Loading skeleton placeholders */
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-sm text-text-secondary">Crunching workspace statistics...</p>
        </div>
      ) : (
        /* Populate metrics */
        <div className="space-y-6">
          {/* KPI grid panel */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Sales */}
            <div className="bg-surface-app border border-border-app p-5 rounded-xl shadow-sm space-y-2">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Total Sales</p>
              <h3 className="text-xl md:text-2xl font-black text-text-primary">
                ₹{((overview?.revenueMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-text-secondary">Issued Invoices aggregate</p>
            </div>

            {/* Invoices Count */}
            <div className="bg-surface-app border border-border-app p-5 rounded-xl shadow-sm space-y-2">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Invoices Count</p>
              <h3 className="text-xl md:text-2xl font-black text-text-primary">
                {overview?.invoiceCount || 0}
              </h3>
              <p className="text-[10px] text-text-secondary">Finalized documents issued</p>
            </div>

            {/* Average Bill Ticket */}
            <div className="bg-surface-app border border-border-app p-5 rounded-xl shadow-sm space-y-2">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Average Ticket</p>
              <h3 className="text-xl md:text-2xl font-black text-text-primary">
                ₹{((overview?.averageInvoiceMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-text-secondary">Value per invoice calculation</p>
            </div>

            {/* Outstanding Accounts */}
            <div className="bg-surface-app border border-border-app p-5 rounded-xl shadow-sm space-y-2">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Outstanding Dues</p>
              <h3 className="text-xl md:text-2xl font-black text-danger-app">
                ₹{((overview?.outstandingMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-text-secondary">Unpaid invoices balance totals</p>
            </div>
          </div>

          {/* Sales Chart Overview */}
          <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-app/40 pb-2">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Sales Progression Trend</h3>
              <span className="text-[10px] font-semibold text-text-secondary">Finalized Invoices (Minor Units Summed)</span>
            </div>
            {renderSVGChart()}
          </div>

          {/* Mid section splits for customers and services */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Customers Panel */}
            <div className="bg-surface-app border border-border-app rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-6 py-4 border-b border-border-app/40 bg-surface-2-app/20">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Top Billing Customers</h3>
                </div>
                {topCustomers.length === 0 ? (
                  <p className="text-xs text-text-secondary text-center p-8">No customer accounts linked in this range.</p>
                ) : (
                  <div className="divide-y divide-border-app/40">
                    {topCustomers.map((c, index) => (
                      <div key={index} className="px-6 py-3 flex items-center justify-between text-xs hover:bg-surface-2-app/10">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-text-primary">{c.customerName}</p>
                          <p className="text-[10px] text-text-muted">{c.invoiceCount} invoices issued</p>
                        </div>
                        <span className="font-bold text-primary-700">
                          ₹{(c.revenueMinor / 100).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Services Panel */}
            <div className="bg-surface-app border border-border-app rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-6 py-4 border-b border-border-app/40 bg-surface-2-app/20">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Top Services Sold</h3>
                </div>
                {topServices.length === 0 ? (
                  <p className="text-xs text-text-secondary text-center p-8">No services recorded in this range.</p>
                ) : (
                  <div className="divide-y divide-border-app/40">
                    {topServices.map((s, index) => (
                      <div key={index} className="px-6 py-3 flex items-center justify-between text-xs hover:bg-surface-2-app/10">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-text-primary">{s.description}</p>
                          <p className="text-[10px] text-text-muted">{s.quantity} units sold</p>
                        </div>
                        <span className="font-bold text-primary-700">
                          ₹{(s.revenueMinor / 100).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Invoices Panel */}
          <div className="bg-surface-app border border-border-app rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border-app/40 bg-surface-2-app/20 flex justify-between items-center">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Recent Workspace Activity</h3>
              <Link href="/dashboard/invoices" className="text-xs text-primary-700 font-bold hover:underline">
                View All Invoices
              </Link>
            </div>
            {recentInvoices.length === 0 ? (
              <p className="text-xs text-text-secondary text-center p-8">No invoices created yet.</p>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-2-app/40 border-b border-border-app text-text-muted font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-6">Invoice Number</th>
                      <th className="py-2.5 px-6">Customer</th>
                      <th className="py-2.5 px-6">Total Amount</th>
                      <th className="py-2.5 px-6">Payment</th>
                      <th className="py-2.5 px-6">Status</th>
                      <th className="py-2.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-app/40 text-text-primary font-medium">
                    {recentInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-surface-2-app/10">
                        <td className="py-3.5 px-6 font-bold text-primary-700">
                          {inv.invoiceNumber ? inv.invoiceNumber : `DRAFT: #${inv.id.slice(-6).toUpperCase()}`}
                          <p className="text-[10px] text-text-secondary font-medium mt-0.5">
                            📅 {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </p>
                        </td>
                        <td className="py-3.5 px-6 font-semibold">{inv.customer?.name || '-'}</td>
                        <td className="py-3.5 px-6 font-bold">
                          ₹{(inv.totalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-6">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.paymentStatus === 'PAID'
                              ? 'bg-success-soft text-success-app'
                              : inv.paymentStatus === 'PARTIALLY_PAID'
                              ? 'bg-warning-soft text-warning-app'
                              : 'bg-danger-soft text-danger-app'
                          }`}>
                            {inv.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIALLY PAID' : inv.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-6">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'DRAFT'
                              ? 'bg-warning-soft text-warning-app'
                              : inv.status === 'FINALIZED'
                              ? 'bg-success-soft text-success-app'
                              : 'bg-danger-soft text-danger-app'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <Link
                            href={inv.status === 'DRAFT' ? `/dashboard/invoices/edit/${inv.id}` : `/dashboard/invoices/detail/${inv.id}`}
                            className="text-primary-700 hover:text-primary-800 font-bold hover:underline cursor-pointer"
                          >
                            {inv.status === 'DRAFT' ? 'Edit Draft' : 'View Audit'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
