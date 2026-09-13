'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Building2,
  DollarSign,
  Truck,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  Plus,
  ArrowRight,
  FileText,
  Calendar,
  Layers,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { purchasesApi, Purchase } from '../../../../lib/api/purchases';

export default function PurchasesDashboardPage() {
  const [data, setData] = useState<{
    summary: {
      totalCount: number;
      totalPurchased: number;
      totalPaid: number;
      totalOutstanding: number;
      monthCount: number;
      monthPurchased: number;
      pendingDeliveriesCount: number;
      partiallyReceivedCount: number;
    };
    recentPurchases: Purchase[];
    topVendors: {
      vendorId: string;
      name: string;
      vendorCode: string;
      totalPurchases: number;
      totalAmount: number;
      totalPaid: number;
      outstandingAmount: number;
    }[];
    outstandingPayables: Purchase[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await purchasesApi.getPurchaseDashboard();
      setData(res);
    } catch (err: any) {
      console.error('Error fetching dashboard:', err);
      setError(err.message || 'Failed to load purchase dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-2" />
        <p className="text-sm">Loading purchase intelligence & analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl mb-4">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="font-semibold text-sm">{error || 'Dashboard unavailable'}</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { summary, recentPurchases, topVendors, outstandingPayables } = data;

  const getVendorName = (p: Purchase) => {
    if (typeof p.vendorId === 'object' && p.vendorId) return (p.vendorId as any).name;
    if (p.vendor?.name) return p.vendor.name;
    if (p.vendorNameSnapshot) return p.vendorNameSnapshot;
    return 'Vendor';
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-200">
              Procurement Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-primary-600" />
            Purchases Overview
          </h1>
          <p className="text-sm text-gray-500">
            Real-time insights into vendor procurement, outstanding payables, and incoming inventory.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/purchases"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold shadow-xs transition"
          >
            <FileText className="w-4 h-4 text-gray-500" />
            All Purchases
          </Link>
          <Link
            href="/dashboard/purchases/vendors"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold shadow-xs transition"
          >
            <Building2 className="w-4 h-4 text-gray-500" />
            Vendors
          </Link>
          <Link
            href="/dashboard/purchases/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold shadow-sm transition active:scale-98"
          >
            <Plus className="w-4 h-4" />
            New Purchase
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Month Purchases */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>This Month Spend</span>
            <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2 font-mono">
            ₹{(summary.monthPurchased || 0).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>{summary.monthCount || 0} purchase orders this month</span>
          </div>
        </div>

        {/* Outstanding Payables */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Outstanding Payables</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2 font-mono">
            ₹{(summary.totalOutstanding || 0).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-600 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Amount owed to vendors</span>
          </div>
        </div>

        {/* Pending Physical Delivery */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Pending Deliveries</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2 font-mono">
            {(summary.pendingDeliveriesCount || 0) + (summary.partiallyReceivedCount || 0)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700">
            <Clock className="w-3.5 h-3.5" />
            <span>{summary.partiallyReceivedCount || 0} partial • {summary.pendingDeliveriesCount || 0} not arrived</span>
          </div>
        </div>

        {/* Lifetime Purchases */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Lifetime Procured</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2 font-mono">
            ₹{(summary.totalPurchased || 0).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 font-medium">
            <span>₹{(summary.totalPaid || 0).toLocaleString('en-IN')} cleared</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Deliveries & Outstanding Payables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Vendors by Outstanding Payables */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-500" />
              <h2 className="font-bold text-gray-900 text-sm">Vendor Balances & Volume</h2>
            </div>
            <Link
              href="/dashboard/purchases/vendors"
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              View Vendors <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100 flex-1">
            {topVendors.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">No vendor purchase history yet</div>
            ) : (
              topVendors.map((vendor) => (
                <div key={vendor.vendorId} className="p-4 hover:bg-gray-50/70 transition flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/purchases/vendors/${vendor.vendorId}`}
                        className="font-bold text-gray-900 text-sm hover:text-primary-600"
                      >
                        {vendor.name}
                      </Link>
                      <span className="font-mono text-[11px] text-gray-400">({vendor.vendorCode})</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {vendor.totalPurchases} orders • Total ₹{vendor.totalAmount.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-gray-400 block uppercase font-medium">Balance Owed</span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        vendor.outstandingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      ₹{vendor.outstandingAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Required: Unpaid Bills with Balance */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-rose-500" />
              <h2 className="font-bold text-gray-900 text-sm">Action Required: Outstanding Payables</h2>
            </div>
            <span className="text-xs font-medium text-gray-500">
              {outstandingPayables.length} open bills
            </span>
          </div>

          <div className="divide-y divide-gray-100 flex-1">
            {outstandingPayables.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                🎉 All vendor purchases are fully paid! No outstanding balances.
              </div>
            ) : (
              outstandingPayables.slice(0, 5).map((p) => (
                <div key={p._id} className="p-4 hover:bg-gray-50/70 transition flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/purchases/${p._id}`}
                        className="font-bold text-gray-900 text-sm font-mono hover:text-primary-600"
                      >
                        {p.purchaseNumber}
                      </Link>
                      <span className="text-xs text-gray-600 font-medium">• {getVendorName(p)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>Invoice: {p.vendorInvoiceNumber || 'N/A'}</span>
                      <span>•</span>
                      <span>Total: ₹{p.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-rose-500 block uppercase font-medium">Due Balance</span>
                      <span className="text-sm font-bold text-rose-600 font-mono">
                        ₹{(p.outstandingAmount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/purchases/${p._id}`}
                      className="px-2.5 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-bold hover:bg-primary-100 transition"
                    >
                      Pay
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Purchases Audit Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-gray-500" />
            <h2 className="font-bold text-gray-900 text-sm">Recent Purchases Activity</h2>
          </div>
          <Link
            href="/dashboard/purchases"
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            View All Purchases <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">PO # / Bill #</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Receiving Status</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Outstanding</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    No purchase orders created yet.
                  </td>
                </tr>
              ) : (
                recentPurchases.map((purchase) => (
                  <tr key={purchase._id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/dashboard/purchases/${purchase._id}`}
                        className="font-bold font-mono text-primary-600 hover:text-primary-800"
                      >
                        {purchase.purchaseNumber}
                      </Link>
                      {purchase.vendorInvoiceNumber && (
                        <div className="text-[11px] text-gray-400 font-mono">
                          Inv: {purchase.vendorInvoiceNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-900">
                      {getVendorName(purchase)}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {new Date(purchase.purchaseDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                        {purchase.purchaseType === 'DIRECT_PURCHASE' ? 'Direct' : 'Ordered'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {purchase.receivingStatus === 'RECEIVED' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Received
                        </span>
                      ) : purchase.receivingStatus === 'PARTIALLY_RECEIVED' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3 h-3" /> Partial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Truck className="w-3 h-3" /> Pending Delivery
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {purchase.paymentStatus === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Paid
                        </span>
                      ) : purchase.paymentStatus === 'PARTIALLY_PAID' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3 h-3" /> Partial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertCircle className="w-3 h-3" /> Unpaid
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold font-mono text-gray-900">
                      ₹{purchase.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold font-mono text-rose-600">
                      ₹{(purchase.outstandingAmount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Link
                        href={`/dashboard/purchases/${purchase._id}`}
                        className="px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-primary-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
