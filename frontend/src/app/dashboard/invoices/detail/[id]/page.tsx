'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../../../lib/api/client';
import { Invoice } from '../../../../../lib/api/types';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadInvoice() {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const inv = await apiClient.getInvoice(id);
      setInvoice(inv);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoice();
  }, [id]);

  async function handleRetryDocuments() {
    if (!invoice) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.retrySnapshot(invoice.id);
      setSuccessMsg('Document regeneration triggered. Please refresh in a few seconds.');
      loadInvoice();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to trigger document generation');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
        <p className="text-sm text-text-secondary">Loading invoice records...</p>
      </div>
    );
  }

  if (errorMsg || !invoice) {
    return (
      <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-sm rounded-lg font-medium">
        {errorMsg || 'Failed to locate invoice history details.'}
      </div>
    );
  }

  // Resolve customer and business details from snapshot for finalized/cancelled invoices,
  // or fall back to live references for draft status documents.
  const isDraft = invoice.status === 'DRAFT';
  const customerName = !isDraft && invoice.customerSnapshot?.name
    ? invoice.customerSnapshot.name
    : 'Referenced Draft Customer';

  const customerPhone = !isDraft && invoice.customerSnapshot?.contact?.phone
    ? invoice.customerSnapshot.contact.phone
    : '';

  const customerGSTIN = !isDraft && invoice.customerSnapshot?.taxProfile?.gstin
    ? invoice.customerSnapshot.taxProfile.gstin
    : '';

  const customerAddress = !isDraft && invoice.customerSnapshot?.address
    ? `${invoice.customerSnapshot.address.line1 || ''}${invoice.customerSnapshot.address.line2 ? ', ' + invoice.customerSnapshot.address.line2 : ''}`
    : '';

  const businessName = !isDraft && invoice.businessSnapshot?.name
    ? invoice.businessSnapshot.name
    : 'Active Workspace';

  const billingTerms = invoice.paymentTerms || 'Not configured';

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-app border border-border-app p-4 rounded-xl shadow-sm">
        <div className="flex space-x-3">
          <Link
            href="/dashboard/invoices"
            className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-lg text-xs font-semibold cursor-pointer"
          >
            ← Back to Bill Book
          </Link>
          <Link
            href={`/dashboard/invoices/preview/${invoice.id}`}
            className="px-4 py-2 bg-success-soft hover:bg-success-soft/80 text-success-app rounded-lg text-xs font-semibold cursor-pointer"
          >
            Open Live Print Bill
          </Link>
        </div>
        {isDraft && (
          <Link
            href={`/dashboard/invoices/edit/${invoice.id}`}
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Edit Draft Workspace
          </Link>
        )}
      </div>

      {successMsg && (
        <div className="p-4 bg-success-soft border border-success-app/20 text-success-app text-sm rounded-lg font-medium">
          {successMsg}
        </div>
      )}

      {/* Main Audit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core details column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-app/40 pb-4">
              <div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Invoice Identifier</p>
                <h2 className="text-xl font-bold text-text-primary">
                  {invoice.invoiceNumber ? invoice.invoiceNumber : `DRAFT: #${invoice.id.slice(-6).toUpperCase()}`}
                </h2>
              </div>
              <div className="flex space-x-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  invoice.status === 'DRAFT'
                    ? 'bg-warning-soft text-warning-app'
                    : invoice.status === 'FINALIZED'
                    ? 'bg-success-soft text-success-app'
                    : 'bg-danger-soft text-danger-app'
                }`}>
                  {invoice.status}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  invoice.paymentSummary.status === 'PAID'
                    ? 'bg-success-soft text-success-app'
                    : invoice.paymentSummary.status === 'PARTIALLY_PAID'
                    ? 'bg-warning-soft text-warning-app'
                    : 'bg-danger-soft text-danger-app'
                }`}>
                  {invoice.paymentSummary.status === 'PARTIALLY_PAID' ? 'PARTIALLY PAID' : invoice.paymentSummary.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="font-bold text-text-muted text-[10px] uppercase tracking-wider mb-1">Invoice Date</p>
                <p className="font-bold text-text-primary">
                  {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="font-bold text-text-muted text-[10px] uppercase tracking-wider mb-1">Payment Terms</p>
                <p className="font-bold text-text-primary">{billingTerms}</p>
              </div>
              <div>
                <p className="font-bold text-text-muted text-[10px] uppercase tracking-wider mb-1">Currency</p>
                <p className="font-bold text-text-primary">{invoice.currency}</p>
              </div>
              <div>
                <p className="font-bold text-text-muted text-[10px] uppercase tracking-wider mb-1">Grand Total</p>
                <p className="font-bold text-primary-700">
                  ₹{(invoice.totals.grandTotalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {invoice.status === 'CANCELLED' && (
              <div className="bg-danger-soft/20 border border-danger-app/20 p-4 rounded-lg space-y-1">
                <p className="text-xs font-bold text-danger-app uppercase tracking-wider">Cancellation Audit Log</p>
                <p className="text-sm text-text-primary font-semibold">
                  Reason: <em>{invoice.cancellationReason || 'No reason provided'}</em>
                </p>
                <p className="text-[10px] text-text-secondary mt-1">
                  Cancelled At: {invoice.cancelledAt ? new Date(invoice.cancelledAt).toLocaleString('en-IN') : '-'}
                </p>
              </div>
            )}
          </div>

          {/* Items Summary Table */}
          <div className="bg-surface-app border border-border-app rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border-app/40 bg-surface-2-app/30">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Itemized Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-2-app/50 border-b border-border-app text-text-muted font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-6">Description</th>
                    <th className="py-2.5 px-6 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-6 w-28 text-right">Unit Price</th>
                    <th className="py-2.5 px-6 w-28 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-app/40 text-text-primary font-medium">
                  {invoice.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-surface-2-app/10">
                      <td className="py-3 px-6 whitespace-pre-wrap">{it.description}</td>
                      <td className="py-3 px-6 text-center font-bold">{it.quantity} {it.uom}</td>
                      <td className="py-3 px-6 text-right">
                        ₹{(it.unitPriceMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-6 text-right font-bold">
                        ₹{(it.lineTotalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="border-t border-border-app/40 p-6 bg-surface-2-app/10 flex justify-end">
              <div className="w-72 space-y-2 text-xs">
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal:</span>
                  <span>₹{(invoice.totals.subtotalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {invoice.totals.discountMinor > 0 && (
                  <div className="flex justify-between text-danger-app">
                    <span>Discount:</span>
                    <span>-₹{(invoice.totals.discountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {invoice.totals.taxes.map((t, idx) => (
                  <div key={idx} className="flex justify-between text-text-secondary">
                    <span>{t.type} ({(t.rateBps / 100).toFixed(1)}%):</span>
                    <span>₹{(t.amountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {Math.abs(invoice.totals.roundingMinor) > 0 && (
                  <div className="flex justify-between text-text-muted">
                    <span>Rounding:</span>
                    <span>
                      {invoice.totals.roundingMinor > 0 ? '+' : ''}
                      ₹{(invoice.totals.roundingMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border-app/60 pt-2 text-sm font-black text-text-primary">
                  <span>TOTAL:</span>
                  <span className="text-primary-700">
                    ₹{(invoice.totals.grandTotalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border-app/40 bg-surface-2-app/30 text-[10px] space-y-1">
              <span className="font-bold text-text-muted uppercase tracking-wider block">Amount in words:</span>
              <p className="font-bold text-text-primary uppercase">{invoice.amountInWords}</p>
            </div>
          </div>
        </div>

        {/* Sidebar snapshots and document status */}
        <div className="space-y-6">
          {/* Documents Access Card */}
          <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-border-app/40 pb-2">
              Archived Documents
            </h3>
            
            {isDraft ? (
              <p className="text-xs text-text-muted leading-relaxed">
                Documents are only generated and archived on Cloudinary after the invoice draft has been finalized.
              </p>
            ) : (
              <div className="space-y-4">
                {/* PNG Snapshot status */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-bold text-text-secondary">PNG Image Snapshot</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      invoice.document?.snapshot?.status === 'READY'
                        ? 'bg-success-soft text-success-app'
                        : invoice.document?.snapshot?.status === 'GENERATING'
                        ? 'bg-warning-soft text-warning-app'
                        : 'bg-danger-soft text-danger-app'
                    }`}>
                      {invoice.document?.snapshot?.status || 'NOT_GENERATED'}
                    </span>
                  </div>
                  {invoice.document?.snapshot?.secureUrl ? (
                    <a
                      href={invoice.document.snapshot.secureUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-center w-full py-1.5 bg-success-soft hover:bg-success-soft/80 text-success-app text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Open PNG Image
                    </a>
                  ) : (
                    <div className="text-[10px] text-text-muted italic">Image snapshot not available</div>
                  )}
                </div>

                {/* PDF status */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-bold text-text-secondary">Official PDF Copy</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      invoice.document?.pdf?.status === 'READY'
                        ? 'bg-success-soft text-success-app'
                        : invoice.document?.pdf?.status === 'GENERATING'
                        ? 'bg-warning-soft text-warning-app'
                        : 'bg-danger-soft text-danger-app'
                    }`}>
                      {invoice.document?.pdf?.status || 'NOT_GENERATED'}
                    </span>
                  </div>
                  {invoice.document?.pdf?.secureUrl ? (
                    <a
                      href={invoice.document.pdf.secureUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-center w-full py-1.5 bg-primary-900/10 hover:bg-primary-900/20 text-primary-700 text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Download PDF
                    </a>
                  ) : (
                    <div className="text-[10px] text-text-muted italic">PDF document not available</div>
                  )}
                </div>

                {/* Regenerate Trigger */}
                {(!invoice.document?.snapshot?.secureUrl || !invoice.document?.pdf?.secureUrl || invoice.document?.snapshot?.status === 'FAILED') && (
                  <button
                    onClick={handleRetryDocuments}
                    className="w-full py-2 bg-warning-app hover:bg-warning-app/80 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Retry Document Generation
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Frozen Profile Snapshots */}
          <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-border-app/40 pb-2">
              Historical Profiles
            </h3>

            {/* Business Snapshot */}
            <div className="space-y-1.5 text-xs">
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Business Workspace</p>
              <p className="font-bold text-text-primary">{businessName}</p>
              {!isDraft && invoice.businessSnapshot?.taxProfile?.gstin && (
                <p className="text-[10px] text-text-secondary">GSTIN: {invoice.businessSnapshot.taxProfile.gstin}</p>
              )}
              {!isDraft && invoice.businessSnapshot?.address && (
                <p className="text-[10px] text-text-secondary leading-relaxed mt-1">
                  📍 {invoice.businessSnapshot.address.line1}
                  {invoice.businessSnapshot.address.city ? `, ${invoice.businessSnapshot.address.city}` : ''}
                </p>
              )}
            </div>

            {/* Customer Snapshot */}
            <div className="space-y-1.5 text-xs pt-2 border-t border-border-app/40">
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Customer profile</p>
              <p className="font-bold text-text-primary">{customerName}</p>
              {customerPhone && <p className="text-[10px] text-text-secondary">📞 {customerPhone}</p>}
              {customerGSTIN && <p className="text-[10px] text-text-secondary">GSTIN: {customerGSTIN}</p>}
              {customerAddress && <p className="text-[10px] text-text-secondary leading-relaxed mt-1">📍 {customerAddress}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
