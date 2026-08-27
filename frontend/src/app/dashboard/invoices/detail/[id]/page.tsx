'use client';

import { useEffect, useState, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../../../lib/api/client';
import { Invoice, Customer } from '../../../../../lib/api/types';
import InvoicePaper from '../../components/InvoicePaper';


export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sharing states
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiry, setShareExpiry] = useState<string>('');
  const [isSharingEnabled, setIsSharingEnabled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Business & Assets defaults (only used for drafts)
  const [business, setBusiness] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeAssets, setActiveAssets] = useState<{ logo: any; stamp: any; signature: any }>({
    logo: null,
    stamp: null,
    signature: null,
  });

  const [scale, setScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  async function loadInvoice() {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const inv = await apiClient.getInvoice(id);
      setInvoice(inv);
      setIsSharingEnabled(inv.publicAccess?.enabled || false);

      if (inv.status === 'DRAFT') {
        // Load draft branding metadata dynamically
        try {
          const bizRes: any = await apiClient.get('/business');
          setBusiness(bizRes.business);

          const assetsList = await apiClient.listAssets();
          const logo = assetsList.find((a) => a.type === 'LOGO' && a.active);
          const stamp = assetsList.find((a) => a.type === 'STAMP' && a.active);
          const signature = assetsList.find((a) => a.type === 'SIGNATURE' && a.active);
          setActiveAssets({ logo, stamp, signature });

          if (inv.customerId) {
            const cust = await apiClient.getCustomer(inv.customerId);
            setSelectedCustomer(cust);
          }
        } catch (bizErr) {
          console.error('Error loading draft dependencies:', bizErr);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoice();
  }, [id]);

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const containerWidth = entry.contentRect.width;
        const canonicalWidth = 794;
        const newScale = Math.min(1, containerWidth / canonicalWidth);
        setScale(newScale);
      }
    });
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [loading]);

  async function handleMarkPaid() {
    if (!invoice) return;
    setSubmitLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      // Direct paymentStatus patch endpoint update
      await apiClient.patch(`/invoices/${invoice.id || (invoice as any)._id}`, { paymentStatus: 'PAID' });
      setSuccessMsg('Invoice has been marked as fully PAID successfully.');
      await loadInvoice();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update payment status');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleFinalizeBill() {
    if (!invoice) return;
    setSubmitLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.finalizeInvoice(invoice.id || (invoice as any)._id);
      setSuccessMsg('Invoice has been finalized and official sequence bill generated!');
      await loadInvoice();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to finalize invoice draft');
    } finally {
      setSubmitLoading(false);
    }
  }

  // Generate public link
  async function handleGenerateShareLink() {
    if (!invoice) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await apiClient.createShareLink(invoice.id || (invoice as any)._id, shareExpiry || undefined);
      setShareUrl(result.shareUrl);
      setIsSharingEnabled(true);
      setSuccessMsg('Public share link generated successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate public share link');
    }
  }

  // Revoke public link
  async function handleRevokeShareLink() {
    if (!invoice) return;
    if (!confirm('Are you sure you want to disable public access? The old link will stop working immediately.')) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.disableShareLink(invoice.id || (invoice as any)._id);
      setShareUrl(null);
      setIsSharingEnabled(false);
      setSuccessMsg('Public sharing access revoked successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to revoke public access');
    }
  }

  // Copy link helper
  function handleCopyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Web Share API native handler
  async function handleNativeShare() {
    if (!invoice) return;
    const shareTarget = shareUrl || `${apiClient.getBaseUrl()}/invoices/${invoice.id || (invoice as any)._id}/download?format=pdf`;
    if (!shareTarget) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bill ${invoice.invoiceNumber || 'Draft'}`,
          text: `Here is the official bill for invoice ${invoice.invoiceNumber || ''}`,
          url: shareTarget,
        });
      } catch (_) {}
    } else {
      setShareModalOpen(true);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
        <p className="text-sm text-text-secondary">Loading bill layout details...</p>
      </div>
    );
  }

  if (errorMsg || !invoice) {
    return (
      <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-sm rounded-lg font-medium">
        {errorMsg || 'Failed to load billing preview.'}
      </div>
    );
  }

  const isDraft = invoice.status === 'DRAFT';
  const customerObj = isDraft ? selectedCustomer : invoice.customerSnapshot;
  const businessObj = isDraft ? business : invoice.businessSnapshot;
  
  const logoUrl = isDraft ? activeAssets.logo?.secureUrl : invoice.assetSnapshot?.logo?.secureUrl;
  const stampUrl = isDraft ? activeAssets.stamp?.secureUrl : invoice.assetSnapshot?.stamp?.secureUrl;
  const signatureUrl = isDraft ? activeAssets.signature?.secureUrl : invoice.assetSnapshot?.signature?.secureUrl;

  const invoiceItems = invoice.items.map((it: any) => ({
    description: it.description,
    quantity: it.quantity,
    unitPrice: it.unitPriceMinor / 100,
    amount: (it.quantity * it.unitPriceMinor) / 100,
    type: it.type,
  }));

  const partsTotal = invoiceItems.filter((it: any) => it.type === 'PRODUCT').reduce((sum: number, it: any) => sum + it.amount, 0);
  const laborTotal = invoiceItems.filter((it: any) => it.type === 'SERVICE').reduce((sum: number, it: any) => sum + it.amount, 0);
  const taxTotal = invoice.totals.taxTotalMinor / 100;
  const grandTotal = invoice.totals.grandTotalMinor / 100;

  return (
    <div className="space-y-6">
      
      {/* Top Banner Warning for Drafts */}
      {isDraft && (
        <div className="p-4 bg-warning-soft border border-warning-app/25 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-warning-app uppercase tracking-wider">Draft Mode Workspace</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              This invoice is currently a draft and has no official invoice number. Finalize it to print and download.
            </p>
          </div>
          <div className="flex space-x-3">
            <Link
              href={`/dashboard/invoices/edit/${invoice.id || (invoice as any)._id}`}
              className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer transition"
            >
              Edit Draft
            </Link>
            <button
              onClick={handleFinalizeBill}
              disabled={submitLoading}
              className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              {submitLoading ? 'Finalizing...' : 'FINALIZE & GENERATE BILL'}
            </button>
          </div>
        </div>
      )}

      {/* Action Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-app border border-border-app p-4 rounded-xl shadow-sm">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/invoices"
            className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-lg text-xs font-bold cursor-pointer"
          >
            ← Back
          </Link>
          {!isDraft && (
            <>
              <a
                href={`${apiClient.getBaseUrl()}/invoices/${invoice.id || (invoice as any)._id}/download?format=pdf`}
                download={`${invoice.invoiceNumber || 'bill'}.pdf`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer inline-block"
              >
                Download PDF
              </a>
              <a
                href={`${apiClient.getBaseUrl()}/invoices/${invoice.id || (invoice as any)._id}/download?format=png`}
                download={`${invoice.invoiceNumber || 'bill'}.png`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-primary rounded-lg text-xs font-bold cursor-pointer inline-block"
              >
                Download PNG
              </a>
            </>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {!isDraft && invoice.paymentSummary?.status !== 'PAID' && (
            <button
              onClick={handleMarkPaid}
              disabled={submitLoading}
              className="px-4 py-2 bg-success-soft hover:bg-success-soft/80 text-success-app rounded-lg text-xs font-bold cursor-pointer transition"
            >
              Mark Paid
            </button>
          )}
          <button
            onClick={handleNativeShare}
            className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-lg text-xs font-bold cursor-pointer transition"
          >
            Share Bill
          </button>
          <Link
            href={`/dashboard/invoices/preview/${invoice.id || (invoice as any)._id}`}
            target="_blank"
            className="px-4 py-2 bg-success-soft hover:bg-success-soft/80 text-success-app rounded-lg text-xs font-bold cursor-pointer transition"
          >
            Open Live Print Bill
          </Link>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-success-soft border border-success-app/20 text-success-app text-sm rounded-lg font-medium animate-pulse">
          {successMsg}
        </div>
      )}

      {/* Central Visual A4 Container */}
      <div className="flex justify-center bg-surface-2-app/10 p-6 border border-border-app rounded-2xl">
        <div ref={previewContainerRef} className="w-full relative overflow-hidden flex justify-center items-center">
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              width: '794px',
              height: '1123px',
              minWidth: '794px',
              minHeight: '1123px',
              marginBottom: `${(scale - 1) * 1123}px`
            }}
            className="invoice-paper bg-white text-black border-[1.5px] border-black shadow-2xl w-[210mm] min-h-[297mm] h-[297mm] box-border relative flex flex-col justify-between select-none"
          >
            <InvoicePaper
              invoice={{
                invoiceNumber: invoice.invoiceNumber,
                invoiceDate: invoice.invoiceDate,
                paymentTerms: invoice.paymentTerms,
                amountInWords: invoice.amountInWords,
              }}
              business={{
                name: businessObj?.name || '',
                legalName: businessObj?.legalName,
                address: businessObj?.address || { line1: '' },
                contact: businessObj?.contact || {},
                taxProfile: businessObj?.taxProfile,
                bankDetails: businessObj?.bankDetails,
                invoiceTitle: businessObj?.invoiceSettings?.invoiceTitle || 'TAX INVOICE',
              } as any}
              customer={customerObj as any}
              items={invoiceItems}
              totals={{
                partsTotal,
                laborTotal,
                discount: (invoice.totals.discountMinor || 0) / 100,
                taxTotal,
                rounding: (invoice.totals.roundingMinor || 0) / 100,
                grandTotal,
                subtotal: invoice.totals.subtotalMinor ? (invoice.totals.subtotalMinor / 100) : (partsTotal + laborTotal),
              }}
              assets={{
                logo: logoUrl ? { secureUrl: logoUrl } : null,
                stamp: stampUrl ? { secureUrl: stampUrl } : null,
                signature: signatureUrl ? { secureUrl: signatureUrl } : null,
              }}
              isDraft={isDraft}
            />
          </div>
        </div>
      </div>

      {/* Share Configuration Drawer Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-light pb-2">
              <h3 className="text-base font-bold text-text-primary">Share Configuration</h3>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="text-text-muted hover:text-text-primary font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-2">
                <label className="block text-text-secondary uppercase text-[10px]">
                  Public Access Sharing
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-text-primary font-bold">
                    {isSharingEnabled ? 'Sharing Enabled' : 'Sharing Disabled'}
                  </span>
                  <button
                    onClick={isSharingEnabled ? handleRevokeShareLink : handleGenerateShareLink}
                    className={`px-3 py-1.5 rounded-lg font-bold text-white transition ${
                      isSharingEnabled ? 'bg-danger-app hover:bg-danger-app/80' : 'bg-primary-700 hover:bg-primary-800'
                    }`}
                  >
                    {isSharingEnabled ? 'Revoke Access' : 'Enable Sharing'}
                  </button>
                </div>
              </div>

              {isSharingEnabled && (
                <div className="space-y-2 pt-2 border-t border-border-light">
                  <label className="block text-text-secondary uppercase text-[10px]">Expiry Time</label>
                  <input
                    type="datetime-local"
                    value={shareExpiry}
                    onChange={(e) => setShareExpiry(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-text-primary focus:outline-none"
                  />
                  <button
                    onClick={handleGenerateShareLink}
                    className="px-3 py-1 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg text-text-secondary"
                  >
                    Update Expiry Link
                  </button>
                </div>
              )}

              {shareUrl && (
                <div className="space-y-2 pt-2 border-t border-border-light">
                  <label className="block text-text-secondary uppercase text-[10px]">Public Sharing Link</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-text-primary select-all text-xs font-mono"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 bg-primary-700 text-white hover:bg-primary-800 rounded-lg transition"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border-app">
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
