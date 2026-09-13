'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Plus,
  Edit2,
  Receipt,
  Loader2,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Layers,
} from 'lucide-react';
import { purchasesApi, Vendor, Purchase, VendorPayment } from '../../../../../lib/api/purchases';

export default function VendorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params?.id as string;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [activeTab, setActiveTab] = useState<'PURCHASES' | 'PAYMENTS' | 'DETAILS'>('PURCHASES');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendorData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [vendorRes, purchasesRes, paymentsRes] = await Promise.all([
        purchasesApi.getVendor(vendorId),
        purchasesApi.listPurchases({ vendorId }),
        purchasesApi.listVendorPayments(vendorId),
      ]);

      setVendor(vendorRes.vendor);
      setPurchases(purchasesRes.purchases || []);
      setPayments(paymentsRes.payments || []);
    } catch (err: any) {
      console.error('Error loading vendor profile:', err);
      setError(err.message || 'Failed to load vendor ledger & profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) {
      fetchVendorData();
    }
  }, [vendorId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-2" />
        <p className="text-sm">Loading vendor ledger & profile...</p>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl mb-4">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="font-semibold text-sm">{error || 'Vendor not found'}</p>
        </div>
        <Link
          href="/dashboard/purchases/vendors"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Vendors
        </Link>
      </div>
    );
  }

  const totalPurchasesAmount = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalPaidAmount = purchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
  const totalOutstanding = purchases.reduce((sum, p) => sum + (p.outstandingAmount || 0), 0);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Back Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Link href="/dashboard/purchases" className="hover:text-primary-600">
            Purchases
          </Link>
          <span>/</span>
          <Link href="/dashboard/purchases/vendors" className="hover:text-primary-600">
            Vendors
          </Link>
          <span>/</span>
          <span className="font-semibold text-gray-800">{vendor.name}</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/purchases/new?vendorId=${vendor._id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-98"
          >
            <Plus className="w-4 h-4" />
            New Purchase Order
          </Link>
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-50 rounded-2xl border border-primary-100 text-primary-700">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">{vendor.name}</h1>
                <span className="font-mono text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md font-semibold">
                  {vendor.vendorCode}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    vendor.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}
                >
                  {vendor.isActive ? 'Active Vendor' : 'Inactive'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-xs text-gray-500">
                {vendor.contactPerson && (
                  <span className="font-medium text-gray-700">Contact: {vendor.contactPerson}</span>
                )}
                {vendor.mobile && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    {vendor.mobile}
                  </span>
                )}
                {vendor.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    {vendor.email}
                  </span>
                )}
                {(vendor.city || vendor.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    {[vendor.city, vendor.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Balance Status */}
          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
            <div>
              <span className="text-xs uppercase font-semibold text-gray-400 block">
                Current Payable Balance
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  className={`text-2xl font-extrabold font-mono ${
                    totalOutstanding > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  ₹{totalOutstanding.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="text-[11px] text-gray-400">
                {totalOutstanding > 0 ? 'Due to vendor' : 'All accounts settled'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Total Purchased</span>
            <FileText className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2 font-mono">
            ₹{totalPurchasesAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 mt-1">{purchases.length} lifetime bills/orders</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Total Paid Out</span>
            <CreditCard className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
            ₹{totalPaidAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">
            {payments.length} payment transactions recorded
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Outstanding Balance</span>
            <DollarSign className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2 font-mono">
            ₹{totalOutstanding.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-rose-600 mt-1 font-medium">
            {purchases.filter((p) => (p.outstandingAmount || 0) > 0).length} bills pending settlement
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('PURCHASES')}
          className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'PURCHASES'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Purchase Orders & Bills ({purchases.length})
        </button>

        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'PAYMENTS'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment Transactions ({payments.length})
        </button>

        <button
          onClick={() => setActiveTab('DETAILS')}
          className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'DETAILS'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Vendor Information
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'PURCHASES' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">PO # / Bill #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Receiving Status</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400">
                      No purchase orders or bills recorded for this vendor.
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
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
                            <Truck className="w-3 h-3" /> Pending
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
                      <td className="py-3.5 px-4 text-right font-bold font-mono text-emerald-600">
                        ₹{(purchase.paidAmount || 0).toLocaleString('en-IN')}
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
      )}

      {activeTab === 'PAYMENTS' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Payment #</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Reference / UTR #</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      No payment transactions recorded for this vendor yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((pmt) => (
                    <tr key={pmt._id} className="hover:bg-gray-50/50 transition">
                      <td className="py-3.5 px-4 font-bold font-mono text-gray-900">
                        {pmt.paymentNumber}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {new Date(pmt.paymentDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md font-semibold bg-gray-100 text-gray-700 text-[11px]">
                          {pmt.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-500">
                        {pmt.referenceNumber || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">{pmt.notes || '—'}</td>
                      <td className="py-3.5 px-4 text-right font-bold font-mono text-emerald-600 text-sm">
                        ₹{pmt.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'DETAILS' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                Business & Tax Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400 block">Vendor Name:</span>
                  <span className="font-semibold text-gray-900">{vendor.name}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Vendor Code:</span>
                  <span className="font-mono font-semibold text-gray-900">{vendor.vendorCode}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">GST Number:</span>
                  <span className="font-mono font-semibold text-gray-900">
                    {vendor.gstNumber || 'Unregistered'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">Payment Terms:</span>
                  <span className="font-semibold text-gray-900">{vendor.paymentTerms || 'Net 30'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                Address & Contact
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400 block">Contact Person:</span>
                  <span className="font-semibold text-gray-900">{vendor.contactPerson || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Mobile:</span>
                  <span className="font-semibold text-gray-900">{vendor.mobile || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 block">Address:</span>
                  <span className="font-semibold text-gray-900">
                    {[vendor.address, vendor.city, vendor.state, vendor.pincode]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {vendor.notes && (
            <div className="pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-400 block mb-1">Vendor Notes:</span>
              <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200">
                {vendor.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
