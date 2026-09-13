'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingBag,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Package,
  PackageCheck,
  AlertCircle,
  XCircle,
  Loader2,
  User,
  Phone,
  MapPin,
  Truck,
  Plus,
  History,
  ShieldCheck,
  Paperclip,
  Upload,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import {
  purchasesApi,
  Purchase,
  ReceivingStatus,
  PaymentStatus,
  PurchaseType,
  Vendor,
  PurchaseReceipt,
  BillAttachment,
} from '../../../../lib/api/purchases';

interface ItemReceiveState {
  purchaseItemId: string;
  productName: string;
  sku?: string;
  ordered: number;
  alreadyReceived: number;
  remaining: number;
  receiveNow: number;
}

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const purchaseId = params?.id as string;

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Receiving Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveItems, setReceiveItems] = useState<ItemReceiveState[]>([]);
  const [deliveryChallanNumber, setDeliveryChallanNumber] = useState('');
  const [receivingNotes, setReceivingNotes] = useState('');
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Attachment State
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const fetchPurchaseAndReceipts = async () => {
    try {
      setLoading(true);
      setError(null);
      const [purchaseRes, receiptsRes, paymentsRes] = await Promise.all([
        purchasesApi.getPurchase(purchaseId),
        purchasesApi.listPurchaseReceipts(purchaseId),
        purchasesApi.listPurchasePayments(purchaseId),
      ]);
      setPurchase(purchaseRes.purchase);
      setReceipts(receiptsRes.receipts || []);
      setPayments(paymentsRes.payments || []);
    } catch (err: any) {
      console.error('Error loading purchase:', err);
      setError(err.message || 'Failed to load purchase details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (purchaseId) {
      fetchPurchaseAndReceipts();
    }
  }, [purchaseId]);

  const openReceiveModal = () => {
    if (!purchase) return;
    const initialItems: ItemReceiveState[] = purchase.items
      .filter((it) => (it.remainingQuantity || 0) > 0)
      .map((it) => ({
        purchaseItemId: it._id!,
        productName: it.productNameSnapshot,
        sku: it.skuSnapshot || undefined,
        ordered: it.orderedQuantity,
        alreadyReceived: it.receivedQuantity,
        remaining: it.remainingQuantity,
        receiveNow: it.remainingQuantity, // Default to full remaining
      }));

    setReceiveItems(initialItems);
    setDeliveryChallanNumber('');
    setReceivingNotes('');
    setReceiveError(null);
    setIsReceiveModalOpen(true);
  };

  const handleReceiveNowChange = (purchaseItemId: string, value: number) => {
    setReceiveItems((prev) =>
      prev.map((item) => {
        if (item.purchaseItemId === purchaseItemId) {
          const validatedVal = Math.min(item.remaining, Math.max(0, value));
          return { ...item, receiveNow: validatedVal };
        }
        return item;
      })
    );
  };

  const handleReceiveAllRemaining = () => {
    setReceiveItems((prev) =>
      prev.map((it) => ({
        ...it,
        receiveNow: it.remaining,
      }))
    );
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceiveError(null);

    const itemsToReceive = receiveItems
      .filter((it) => it.receiveNow > 0)
      .map((it) => ({
        purchaseItemId: it.purchaseItemId,
        quantityReceived: it.receiveNow,
      }));

    if (itemsToReceive.length === 0) {
      setReceiveError('Please enter a quantity greater than 0 for at least one item');
      return;
    }

    try {
      setSubmittingReceipt(true);
      await purchasesApi.receivePurchaseProducts(purchaseId, {
        items: itemsToReceive,
        deliveryChallanNumber: deliveryChallanNumber.trim() || undefined,
        notes: receivingNotes.trim() || undefined,
      });

      setIsReceiveModalOpen(false);
      await fetchPurchaseAndReceipts();
    } catch (err: any) {
      console.error('Receiving error:', err);
      setReceiveError(err.message || 'Failed to process physical receipt');
    } finally {
      setSubmittingReceipt(false);
    }
  };

  const openPaymentModal = () => {
    if (!purchase) return;
    setPaymentAmount(purchase.outstandingAmount || 0);
    setPaymentMethod('UPI');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentReference('');
    setPaymentNotes('');
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      setPaymentError('Payment amount must be greater than 0');
      return;
    }

    if (purchase && amt > purchase.outstandingAmount) {
      setPaymentError(`Payment amount cannot exceed outstanding balance of ₹${purchase.outstandingAmount}`);
      return;
    }

    try {
      setSubmittingPayment(true);
      await purchasesApi.recordPurchasePayment(purchaseId, {
        amount: amt,
        paymentMethod,
        paymentDate,
        referenceNumber: paymentReference.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });

      setIsPaymentModalOpen(false);
      await fetchPurchaseAndReceipts();
    } catch (err: any) {
      console.error('Payment error:', err);
      setPaymentError(err.message || 'Failed to record vendor payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCancelPurchase = async () => {
    if (!confirm('Are you sure you want to cancel this purchase order?')) return;

    try {
      setCancelling(true);
      await purchasesApi.cancelPurchase(purchaseId);
      await fetchPurchaseAndReceipts();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel purchase');
    } finally {
      setCancelling(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAttachment(true);
      setAttachmentError(null);
      await purchasesApi.uploadPurchaseAttachment(purchaseId, file);
      await fetchPurchaseAndReceipts();
    } catch (err: any) {
      console.error('Upload attachment error:', err);
      setAttachmentError(err.message || 'Failed to upload bill attachment');
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this bill document?')) return;

    try {
      await purchasesApi.deletePurchaseAttachment(purchaseId, attachmentId);
      await fetchPurchaseAndReceipts();
    } catch (err: any) {
      alert(err.message || 'Failed to remove attachment');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-2" />
        <p className="text-sm">Loading purchase details...</p>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm flex items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || 'Purchase not found'}</span>
        </div>
        <Link
          href="/dashboard/purchases"
          className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Purchases
        </Link>
      </div>
    );
  }

  const vendor = typeof purchase.vendorId === 'object' ? (purchase.vendorId as Vendor) : purchase.vendor;

  // Status badge helpers
  const getReceivingBadge = (status: ReceivingStatus) => {
    switch (status) {
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Fully Received
          </span>
        );
      case 'PARTIALLY_RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" />
            Partially Received
          </span>
        );
      case 'NOT_RECEIVED':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Not Received
          </span>
        );
    }
  };

  const getPaymentBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Fully Paid
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            <Clock className="w-3.5 h-3.5" />
            Partially Paid
          </span>
        );
      case 'UNPAID':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Unpaid
          </span>
        );
    }
  };

  const canCancel =
    purchase.status !== 'CANCELLED' &&
    purchase.receivingStatus === 'NOT_RECEIVED' &&
    (purchase.paidAmount || 0) === 0;

  const canReceive = purchase.status !== 'CANCELLED' && purchase.receivingStatus !== 'RECEIVED';
  const canPay = purchase.status !== 'CANCELLED' && (purchase.outstandingAmount || 0) > 0;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumbs & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard/purchases" className="hover:text-primary-600 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Purchases
            </Link>
            <span>/</span>
            <span className="font-mono font-semibold text-gray-700">{purchase.purchaseNumber}</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap mt-1">
            <h1 className="text-2xl font-bold font-mono text-gray-900 tracking-tight">
              {purchase.purchaseNumber}
            </h1>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${
                purchase.purchaseType === 'DIRECT_PURCHASE'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {purchase.purchaseType === 'DIRECT_PURCHASE' ? 'Direct Purchase' : 'Ordered Purchase'}
            </span>

            {purchase.status === 'CANCELLED' ? (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-gray-200 text-gray-700">
                CANCELLED
              </span>
            ) : (
              <>
                {getReceivingBadge(purchase.receivingStatus)}
                {getPaymentBadge(purchase.paymentStatus)}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {canReceive && (
            <button
              onClick={openReceiveModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-98 cursor-pointer"
            >
              <PackageCheck className="w-4 h-4" />
              Receive Products
            </button>
          )}

          {canPay && (
            <button
              onClick={openPaymentModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-98 cursor-pointer"
            >
              <DollarSign className="w-4 h-4" />
              Record Payment
            </button>
          )}

          {canCancel && (
            <button
              onClick={handleCancelPurchase}
              disabled={cancelling}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              {cancelling ? 'Cancelling...' : 'Cancel Purchase'}
            </button>
          )}

          <Link
            href="/dashboard/purchases/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <ShoppingBag className="w-4 h-4" />
            + New Purchase
          </Link>
        </div>
      </div>

      {/* 3 Overview Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Vendor Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Supplier / Vendor</span>
            <Building2 className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <div className="font-bold text-base text-gray-900">{vendor?.name || 'N/A'}</div>
            <div className="text-xs font-mono text-gray-500 mt-0.5">{vendor?.vendorCode}</div>
          </div>

          <div className="text-xs text-gray-600 space-y-1 pt-1 border-t border-gray-100">
            {vendor?.mobile && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span>{vendor.mobile}</span>
              </div>
            )}
            {vendor?.gstNumber && (
              <div className="font-mono text-slate-700">GST: {vendor.gstNumber}</div>
            )}
            {(vendor?.city || vendor?.state) && (
              <div className="flex items-center gap-1.5 text-gray-500">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span>{[vendor.city, vendor.state].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Invoice & Dates Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Invoice & Dates</span>
            <Calendar className="w-4 h-4 text-gray-400" />
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-gray-500 block">Vendor Invoice Number:</span>
              <span className="font-mono font-bold text-sm text-gray-900">
                {purchase.vendorInvoiceNumber || '— (No Bill #)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
              <div>
                <span className="text-gray-500 block">Purchase Date:</span>
                <span className="font-semibold text-gray-800">
                  {new Date(purchase.purchaseDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block">Due Date:</span>
                <span className="font-semibold text-gray-800">
                  {purchase.dueDate
                    ? new Date(purchase.dueDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Commercial Balance</span>
            <DollarSign className="w-4 h-4 text-gray-400" />
          </div>

          <div>
            <div className="text-xs text-gray-500">Total Purchase Amount:</div>
            <div className="text-2xl font-bold font-mono text-gray-900">
              ₹{(purchase.totalAmount || 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-100">
            <div>
              <span className="text-gray-500 block">Paid:</span>
              <span className="font-semibold text-emerald-600">
                ₹{(purchase.paidAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="text-right">
              <span className="text-gray-500 block">Outstanding:</span>
              <span className="font-bold text-rose-600 text-sm font-mono">
                ₹{(purchase.outstandingAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Product Items Table with Historical Snapshots */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-base text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Purchased Products
          </h2>
          <span className="text-xs text-gray-500">
            {purchase.items?.length || 0} product lines snapshot
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Product Name (Snapshot)</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4 text-center">Ordered</th>
                <th className="py-3 px-4 text-center">Received</th>
                <th className="py-3 px-4 text-center">Remaining</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Tax (GST)</th>
                <th className="py-3 px-4 text-right">Line Total</th>
                <th className="py-3 px-4 text-center">Receiving</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchase.items?.map((item, idx) => (
                <tr key={item._id || idx} className="hover:bg-gray-50/50">
                  <td className="py-3.5 px-4 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-gray-900">{item.productNameSnapshot}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">
                    {item.skuSnapshot || '—'}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-gray-800">
                    {item.orderedQuantity}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                    {item.receivedQuantity}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-amber-600">
                    {item.remainingQuantity}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-gray-800">
                    ₹{(item.unitPurchasePrice || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 text-right text-xs text-gray-600">
                    {item.taxRate}% (₹{(item.taxAmount || 0).toLocaleString('en-IN')})
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                    ₹{(item.totalAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {item.receivingStatus === 'RECEIVED' ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Received
                      </span>
                    ) : item.receivingStatus === 'PARTIALLY_RECEIVED' ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        Partial
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Math Breakdown Footer */}
        <div className="p-4 bg-gray-50/75 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-gray-600">
          <div>
            {purchase.notes && (
              <div>
                <strong>Notes / Instructions:</strong> {purchase.notes}
              </div>
            )}
          </div>

          <div className="space-y-1 text-right w-full sm:w-auto">
            <div className="flex justify-between sm:justify-end gap-6">
              <span>Gross Subtotal:</span>
              <span className="font-mono font-medium">₹{(purchase.subtotal || 0).toLocaleString('en-IN')}</span>
            </div>
            {purchase.discountAmount > 0 && (
              <div className="flex justify-between sm:justify-end gap-6 text-emerald-600">
                <span>Discount:</span>
                <span className="font-mono font-medium">- ₹{purchase.discountAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between sm:justify-end gap-6">
              <span>GST Tax:</span>
              <span className="font-mono font-medium">+ ₹{(purchase.taxAmount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between sm:justify-end gap-6 font-bold text-sm text-gray-900 pt-1 border-t border-gray-200">
              <span>Grand Total:</span>
              <span className="font-mono text-primary-700">₹{(purchase.totalAmount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Receiving History Section (Phase 2) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-base text-gray-900">Physical Receiving History</h3>
              <p className="text-xs text-gray-500">
                Audit trail of goods inward transactions with sequential receipt receipts.
              </p>
            </div>
          </div>

          {canReceive && (
            <button
              onClick={openReceiveModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition"
            >
              <PackageCheck className="w-4 h-4" />
              Receive Inward Goods
            </button>
          )}
        </div>

        {receipts.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-xs">
            <Truck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            No physical deliveries have been logged yet for this purchase order.
            {canReceive && (
              <div className="mt-2">
                <button
                  onClick={openReceiveModal}
                  className="text-emerald-600 font-bold hover:underline"
                >
                  Log First Delivery
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <div
                key={receipt._id}
                className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/25 space-y-2 text-xs"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                      {receipt.receiptNumber}
                    </span>
                    <span className="text-gray-500">
                      {new Date(receipt.receivedAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {receipt.receivedBy?.name && (
                      <span className="text-gray-600">
                        by <strong>{receipt.receivedBy.name}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {receipt.deliveryChallanNumber && (
                      <span className="font-mono text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                        Challan: {receipt.deliveryChallanNumber}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      Stock Increased
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-emerald-100/60">
                  {receipt.items.map((rItem, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border border-emerald-200 text-gray-800 font-medium"
                    >
                      <span className="text-emerald-700 font-bold font-mono">
                        +{rItem.quantityReceived}
                      </span>
                      <span>{rItem.productNameSnapshot}</span>
                    </span>
                  ))}
                </div>

                {receipt.notes && (
                  <div className="text-gray-500 italic pt-1">
                    Note: {receipt.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment History Section (Phase 3) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-base text-gray-900">Vendor Payment History</h3>
              <p className="text-xs text-gray-500">
                Log of settlement transactions, payment modes, and banking references.
              </p>
            </div>
          </div>

          {canPay && (
            <button
              onClick={openPaymentModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold transition"
            >
              <DollarSign className="w-4 h-4" />
              Record Payment
            </button>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-xs">
            <DollarSign className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            No vendor payments recorded yet for this purchase bill.
            {canPay && (
              <div className="mt-2">
                <button
                  onClick={openPaymentModal}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Record First Payment
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment._id || payment.id}
                className="p-4 rounded-xl border border-blue-100 bg-blue-50/20 space-y-2 text-xs"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-md">
                      {payment.paymentNumber}
                    </span>
                    <span className="text-gray-500">
                      {new Date(payment.paymentDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="inline-block px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 text-slate-700 uppercase">
                      {payment.paymentMethod?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {payment.referenceNumber && (
                      <span className="font-mono text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                        Ref: {payment.referenceNumber}
                      </span>
                    )}
                    <span className="font-mono font-bold text-sm text-emerald-700">
                      ₹{(payment.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {payment.notes && (
                  <div className="text-gray-500 italic pt-1 border-t border-blue-100/50">
                    Note: {payment.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bill Attachments & Proofs */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Paperclip className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="font-bold text-base text-gray-900">
                Bill Attachments & Supporting Documents ({(purchase.billAttachments?.length || 0)})
              </h3>
              <p className="text-xs text-gray-500">
                Uploaded supplier invoices, scanned receipts, and delivery challans.
              </p>
            </div>
          </div>

          <div>
            <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold transition cursor-pointer">
              {uploadingAttachment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Attach Document
                </>
              )}
              <input
                type="file"
                disabled={uploadingAttachment}
                onChange={handleUploadAttachment}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
              />
            </label>
          </div>
        </div>

        {attachmentError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{attachmentError}</span>
          </div>
        )}

        {(!purchase.billAttachments || purchase.billAttachments.length === 0) ? (
          <div className="text-center py-6 text-gray-400 text-xs">
            <Paperclip className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            No bill documents attached to this purchase order yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {purchase.billAttachments.map((att: any) => (
              <div
                key={att._id || att.id}
                className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center justify-between gap-2 hover:bg-gray-50 transition text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-purple-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate" title={att.fileName}>
                      {att.fileName}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">
                      {new Date(att.uploadedAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition"
                    title="View / Download"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteAttachment(att._id || att.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receiving & Payment Operation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Receiving Status & Action */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-primary-600" />
              Physical Product Receiving
            </h3>
            {getReceivingBadge(purchase.receivingStatus)}
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            {purchase.receivingStatus === 'RECEIVED'
              ? 'All ordered products have been physically received and confirmed.'
              : 'Products pending delivery. Physical warehouse stock updates automatically when received quantity is confirmed.'}
          </p>

          <div className="pt-2">
            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600 flex items-center justify-between">
              <span>Status: <strong>{purchase.receivingStatus.replace('_', ' ')}</strong></span>
              {canReceive && (
                <button
                  onClick={openReceiveModal}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  Receive Now →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payment Status & Action */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Vendor Payment Settlement
            </h3>
            {getPaymentBadge(purchase.paymentStatus)}
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            Payment tracking is independent from product receipt. Record UPI, Cheque, Cash, or Bank transfers against this purchase bill.
          </p>

          <div className="pt-2">
            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600 flex items-center justify-between">
              <span>Outstanding: <strong className="text-rose-600">₹{(purchase.outstandingAmount || 0).toLocaleString('en-IN')}</strong></span>
              <span className="text-[11px] text-primary-600 font-semibold">
                Phase 3 Payables Workflow
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Receive Products Modal */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-emerald-600" />
                  Receive Inward Products
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Confirm physical delivery. Warehouse stock will increase by the received quantities.
                </p>
              </div>
              <button
                onClick={() => setIsReceiveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReceipt} className="p-6 space-y-4">
              {receiveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{receiveError}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Pending Delivery Items:</span>
                <button
                  type="button"
                  onClick={handleReceiveAllRemaining}
                  className="font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Receive All Full Balance
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-center">Ordered</th>
                      <th className="py-2.5 px-3 text-center">Received</th>
                      <th className="py-2.5 px-3 text-center">Remaining</th>
                      <th className="py-2.5 px-3 w-28 text-right">Receive Now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {receiveItems.map((item) => (
                      <tr key={item.purchaseItemId} className="hover:bg-gray-50/50">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-gray-900">{item.productName}</div>
                          {item.sku && (
                            <div className="font-mono text-gray-400 text-[11px]">{item.sku}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center text-gray-600">{item.ordered}</td>
                        <td className="py-3 px-3 text-center text-emerald-600 font-medium">
                          {item.alreadyReceived}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-amber-600">
                          {item.remaining}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max={item.remaining}
                            value={item.receiveNow}
                            onChange={(e) =>
                              handleReceiveNowChange(item.purchaseItemId, Number(e.target.value))
                            }
                            className="w-20 text-right font-bold text-sm px-2 py-1 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Delivery Challan / LR #
                  </label>
                  <input
                    type="text"
                    value={deliveryChallanNumber}
                    onChange={(e) => setDeliveryChallanNumber(e.target.value)}
                    placeholder="e.g. DC-2026-901"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Receipt Notes / Inspector
                  </label>
                  <input
                    type="text"
                    value={receivingNotes}
                    onChange={(e) => setReceivingNotes(e.target.value)}
                    placeholder="Condition verified, carton received intact..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReceipt}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 active:scale-98"
                >
                  {submittingReceipt ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating Inventory...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm Receipt & Increase Stock
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && purchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Record Vendor Payment</h3>
                  <p className="text-xs text-gray-500 font-mono">
                    {purchase.purchaseNumber} • {vendor?.name || 'Vendor'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              {paymentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Outstanding Balance Banner */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase text-amber-700 block">
                    Outstanding Payable
                  </span>
                  <span className="text-lg font-extrabold text-amber-900 font-mono">
                    ₹{(purchase.outstandingAmount || 0).toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(purchase.outstandingAmount || 0)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-200/60 hover:bg-amber-200 text-amber-900 transition"
                >
                  Pay Full
                </button>
              </div>

              {/* Amount & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Amount Paid (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={purchase.outstandingAmount || 0}
                    step="0.01"
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    required
                    className="w-full text-sm font-bold font-mono px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                    className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              {/* Payment Date & Ref */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Ref / UTR / Cheque #
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. UTR12345678"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Payment Notes / Remarks
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional memo or bank note..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 active:scale-98"
                >
                  {submittingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Recording Payment...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
