'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../../../../lib/api/client';
import InvoicePaper from '../../components/InvoicePaper';


export default function InvoicePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadPreview() {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const preview = await apiClient.getInvoicePreview(id);
      setData(preview);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate invoice preview');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
  }, [id]);

  function handlePrint() {
    window.print();
  }

  async function handleFinalize() {
    setConfirmFinalize(false);
    setFinalizing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.finalizeInvoice(id);
      setSuccessMsg('Invoice finalized successfully! Sequence allocated and documents are being uploaded.');
      // Reload details from server (assigned sequence and finalized state)
      const preview = await apiClient.getInvoicePreview(id);
      setData(preview);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to finalize invoice draft');
    } finally {
      setFinalizing(false);
    }
  }

  async function handleCancel() {
    setShowCancelModal(false);
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.cancelInvoice(id, cancellationReason);
      setSuccessMsg('Invoice cancelled successfully');
      setCancellationReason('');
      const preview = await apiClient.getInvoicePreview(id);
      setData(preview);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel invoice');
    } finally {
      setLoading(false);
    }
  }

  async function handleRetryDocuments() {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.retrySnapshot(id);
      setSuccessMsg('Document regeneration triggered. Please refresh in a few seconds.');
      const preview = await apiClient.getInvoicePreview(id);
      setData(preview);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to trigger document regeneration');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
        <p className="text-sm text-text-secondary">Generating visual bill rendering...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-sm rounded-lg font-medium">
        {errorMsg || 'Failed to load render details'}
      </div>
    );
  }

  const { invoice, business, customer, items, totals, assets } = data;

  const partsTotal = items.filter((it: any) => it.type === 'PRODUCT').reduce((sum: number, it: any) => sum + it.amount, 0);
  const laborTotal = items.filter((it: any) => it.type === 'SERVICE').reduce((sum: number, it: any) => sum + it.amount, 0);

  const addressLine = [
    business.address?.line1,
    business.address?.line2,
    business.address?.city,
    business.address?.state,
    business.address?.postalCode ? `${business.address.state}-${business.address.postalCode}` : business.address?.state,
  ].filter(Boolean).join(', ');
  const phoneLine = business.contact?.phone ? `Mo:- ${business.contact.phone}` : '';
  const headerDetails = [addressLine, phoneLine].filter(Boolean).join(' ');

  return (
    <div className="space-y-6">
      {/* Informative Warning Banners (no-print) */}
      <div className="no-print space-y-4">
        {invoice.status === 'DRAFT' && (
          <div className="bg-warning-soft border border-warning-app/20 p-4 rounded-xl text-warning-app text-sm font-semibold flex items-center justify-between flex-wrap gap-4">
            <div>
              ⚠️ This is a DRAFT invoice. Review all entries carefully. You can edit before finalizing.
            </div>
            <button
              onClick={() => setConfirmFinalize(true)}
              className="px-4 py-1.5 bg-warning-app hover:bg-warning-app/80 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              Finalize Invoice
            </button>
          </div>
        )}

        {invoice.status === 'FINALIZED' && (
          <div className="bg-success-soft border border-success-app/20 p-4 rounded-xl text-success-app text-sm font-semibold flex items-center justify-between gap-4 flex-wrap">
            <div>
              ✓ This invoice is FINALIZED and assigned number: <strong>{invoice.invoiceNumber}</strong>. It is read-only.
            </div>
            <div className="flex space-x-2">
              <a
                href={`${apiClient.getBaseUrl()}/invoices/${invoice.id || (invoice as any)._id}/download?format=png`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-success-app hover:bg-success-app/85 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                View Image
              </a>
              <a
                href={`${apiClient.getBaseUrl()}/invoices/${invoice.id || (invoice as any)._id}/download?format=pdf`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Download PDF
              </a>
              {(!invoice.document?.snapshot?.secureUrl || !invoice.document?.pdf?.secureUrl || invoice.document?.snapshot?.status === 'FAILED') && (
                <button
                  onClick={handleRetryDocuments}
                  className="px-3 py-1.5 bg-warning-app hover:bg-warning-app/85 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Retry Documents Generation
                </button>
              )}
            </div>
          </div>
        )}

        {invoice.status === 'CANCELLED' && (
          <div className="bg-danger-soft border border-danger-app/20 p-4 rounded-xl text-danger-app text-sm font-semibold">
            🚫 This invoice was CANCELLED. Reason: <em>{invoice.cancellationReason}</em>.
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-success-soft border border-success-app/20 text-success-app text-sm rounded-lg font-medium">
            {successMsg}
          </div>
        )}
      </div>

      {/* Action controls (no-print) */}
      <div className="flex items-center justify-between no-print bg-surface-app border border-border-app p-4 rounded-xl shadow-sm">
        <div className="flex space-x-3">
          <Link
            href="/dashboard/invoices"
            className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-lg text-xs font-semibold cursor-pointer"
          >
            ← Back to Registry
          </Link>
          {invoice.status === 'DRAFT' && (
            <Link
              href={`/dashboard/invoices/edit/${invoice.id}`}
              className="px-4 py-2 bg-primary-900/10 hover:bg-primary-900/20 text-primary-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Edit Draft
            </Link>
          )}
          {invoice.status === 'FINALIZED' && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 bg-danger-soft hover:bg-danger-soft/80 text-danger-app rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel Invoice
            </button>
          )}
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
        >
          Print / Save PDF
        </button>
      </div>

      {/* Styled Printable A4 Document Layout */}
      <div className="flex justify-center bg-surface-2-app/20 p-2 md:p-6 rounded-xl border border-border-app overflow-x-auto">
        <div className="invoice-paper bg-white text-black border-[1.5px] border-black shadow-lg w-[210mm] min-h-[297mm] h-[297mm] box-border relative flex flex-col justify-between select-none">
          
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .invoice-paper, .invoice-paper * {
                visibility: visible;
              }
              .invoice-paper {
                position: absolute;
                left: 0;
                top: 0;
                width: 210mm;
                height: 297mm;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .no-print {
                display: none !important;
              }
            }
            @page {
              size: A4 portrait;
              margin: 0;
            }
          `}</style>

          <InvoicePaper
            invoice={{
              invoiceNumber: invoice.invoiceNumber,
              invoiceDate: invoice.invoiceDate,
              paymentTerms: invoice.paymentTerms,
              amountInWords: invoice.amountInWords,
            }}
            business={business}
            customer={customer}
            items={items}
            totals={totals}
            assets={assets}
            isDraft={invoice.status === 'DRAFT'}
          />

        </div>
      </div>

      {/* Confirmation Modals (no-print) */}
      {confirmFinalize && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-surface-app border border-border-app p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-text-primary">Confirm Invoice Finalization</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Are you sure you want to finalize this invoice? Once finalized:
            </p>
            <ul className="text-xs text-text-muted list-disc list-inside space-y-1.5 pl-1 leading-relaxed">
              <li>Customer snapshots and financial totals will be frozen.</li>
              <li>The invoice cannot be modified, updated, or deleted.</li>
              <li>A permanent sequence number will be assigned.</li>
              <li>Original PNG and PDF files will be generated and archived.</li>
            </ul>
            <div className="flex space-x-3 pt-3">
              <button
                onClick={() => setConfirmFinalize(false)}
                className="flex-1 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg text-xs font-bold text-text-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalize}
                className="flex-1 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Yes, Finalize
              </button>
            </div>
          </div>
        </div>
      )}

      {finalizing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-surface-app border border-border-app p-8 rounded-2xl max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto"></div>
            <h3 className="text-lg font-bold text-text-primary">Finalizing Official Bill</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Reserving official sequence number, creating historical snapshots, generating visual PNG and PDF documents...
            </p>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-surface-app border border-border-app p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-text-primary">Cancel Finalized Invoice</h3>
            <p className="text-xs text-text-secondary">
              Provide a brief explanation for auditing logs. This action cannot be undone.
            </p>
            <textarea
              required
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="e.g. Scope of work modified, or client cancelled order..."
              className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
              rows={3}
            />
            <div className="flex space-x-3 pt-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancellationReason('');
                }}
                className="flex-1 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg text-xs font-bold text-text-secondary cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancellationReason.trim()}
                className="flex-1 py-2 bg-danger-app hover:bg-danger-app/80 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
