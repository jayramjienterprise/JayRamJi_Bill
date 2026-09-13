'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  DollarSign,
  ChevronRight,
  Eye,
  Loader2,
  X,
  PackageCheck,
  RefreshCw,
} from 'lucide-react';
import { purchasesApi, Purchase, PurchasesSummary, Vendor, ReceivingStatus, PaymentStatus, PurchaseType } from '../../../lib/api/purchases';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [summary, setSummary] = useState<PurchasesSummary>({
    totalCount: 0,
    totalPurchased: 0,
    totalPaid: 0,
    totalOutstanding: 0,
  });
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedReceivingStatus, setSelectedReceivingStatus] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [purchasesRes, vendorsRes] = await Promise.all([
        purchasesApi.listPurchases({
          search: searchTerm,
          vendorId: selectedVendor,
          purchaseType: selectedType,
          receivingStatus: selectedReceivingStatus,
          paymentStatus: selectedPaymentStatus,
        }),
        purchasesApi.listVendors(),
      ]);

      setPurchases(purchasesRes.purchases || []);
      setSummary(
        purchasesRes.summary || {
          totalCount: 0,
          totalPurchased: 0,
          totalPaid: 0,
          totalOutstanding: 0,
        }
      );
      setVendors(vendorsRes.vendors || []);
    } catch (err: any) {
      console.error('Error fetching purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedVendor, selectedType, selectedReceivingStatus, selectedPaymentStatus]);

  // Status badge styling helpers
  const getReceivingBadge = (status: ReceivingStatus) => {
    switch (status) {
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Received
          </span>
        );
      case 'PARTIALLY_RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" />
            Partial Receipt
          </span>
        );
      case 'NOT_RECEIVED':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" />
            Not Received
          </span>
        );
    }
  };

  const getPaymentBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Paid
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            <Clock className="w-3 h-3" />
            Partial Paid
          </span>
        );
      case 'UNPAID':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3" />
            Unpaid
          </span>
        );
    }
  };

  const getTypeBadge = (type: PurchaseType) => {
    if (type === 'DIRECT_PURCHASE') {
      return (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
          Direct
        </span>
      );
    }
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
        Ordered
      </span>
    );
  };

  const pendingDeliveryCount = purchases.filter((p) => p.receivingStatus !== 'RECEIVED').length;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-primary-600" />
            Purchase Management
          </h1>
          <p className="text-sm text-gray-500">
            Track ordered goods, physical product receipts, vendor invoices, and outstanding balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/purchases/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold shadow-xs transition"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
            Analytics
          </Link>
          <Link
            href="/dashboard/purchases/vendors"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold shadow-xs transition"
          >
            <Building2 className="w-4 h-4 text-gray-500" />
            Vendors ({vendors.length})
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
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-sm font-medium">
            <span>Total Purchases</span>
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ₹{summary.totalPurchased.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 mt-1">{summary.totalCount} total bills</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-sm font-medium">
            <span>Outstanding Payables</span>
            <DollarSign className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">
            ₹{summary.totalOutstanding.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-rose-600 mt-1 font-medium">Vendor credit balance</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-sm font-medium">
            <span>Total Paid</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            ₹{summary.totalPaid.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-emerald-600 mt-1">Settled payments</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-sm font-medium">
            <span>Pending Deliveries</span>
            <PackageCheck className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{pendingDeliveryCount}</p>
          <p className="text-xs text-amber-600 mt-1">Awaiting physical receiving</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Purchase # or Vendor Invoice #..."
              className="w-full text-sm pl-9 pr-8 py-2 rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Vendor Filter */}
          <div>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-primary-500 text-gray-700"
            >
              <option value="ALL">All Vendors</option>
              {vendors.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Receiving Status Filter */}
          <div>
            <select
              value={selectedReceivingStatus}
              onChange={(e) => setSelectedReceivingStatus(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-primary-500 text-gray-700"
            >
              <option value="ALL">All Receiving</option>
              <option value="NOT_RECEIVED">Not Received</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="RECEIVED">Fully Received</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-primary-500 text-gray-700"
            >
              <option value="ALL">All Payments</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Fully Paid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Purchases Data Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-2" />
            <p className="text-sm">Loading purchase records...</p>
          </div>
        ) : purchases.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-gray-700">No purchases found</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Create your direct or ordered purchases to accurately track vendor supplies and warehouse stock.
            </p>
            <Link
              href="/dashboard/purchases/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              Create First Purchase
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Purchase #</th>
                  <th className="py-3.5 px-4">Vendor</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Receiving</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4 text-right">Outstanding</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchases.map((purchase) => {
                  const vendorObj = typeof purchase.vendorId === 'object' ? purchase.vendorId : purchase.vendor;

                  return (
                    <tr key={purchase._id} className="hover:bg-gray-50/50 transition">
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/dashboard/purchases/${purchase._id}`}
                          className="font-mono font-bold text-primary-600 hover:text-primary-800 hover:underline"
                        >
                          {purchase.purchaseNumber}
                        </Link>
                        {purchase.vendorInvoiceNumber && (
                          <div className="text-[11px] text-gray-500">
                            Inv: {purchase.vendorInvoiceNumber}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">
                          {vendorObj?.name || 'Unknown Vendor'}
                        </div>
                        {vendorObj?.vendorCode && (
                          <div className="text-[11px] font-mono text-gray-400">
                            {vendorObj.vendorCode}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-gray-600">
                        {new Date(purchase.purchaseDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3.5 px-4">{getTypeBadge(purchase.purchaseType)}</td>

                      <td className="py-3.5 px-4">{getReceivingBadge(purchase.receivingStatus)}</td>

                      <td className="py-3.5 px-4">{getPaymentBadge(purchase.paymentStatus)}</td>

                      <td className="py-3.5 px-4 text-right font-semibold text-gray-900">
                        ₹{(purchase.totalAmount || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold">
                        {(purchase.outstandingAmount || 0) > 0 ? (
                          <span className="text-rose-600">
                            ₹{(purchase.outstandingAmount || 0).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-emerald-600">₹0</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/dashboard/purchases/${purchase._id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-gray-500" />
                          View
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
    </div>
  );
}
