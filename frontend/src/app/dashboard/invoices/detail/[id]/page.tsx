'use client';

import { useEffect, useState, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Printer, ExternalLink, Share2, Mail } from 'lucide-react';
import { apiClient } from '../../../../../lib/api/client';
import { Invoice, Customer, PaymentRecord, PaymentAccount, PaymentProof, PaymentMethod } from '../../../../../lib/api/types';
import InvoicePaper from '../../components/InvoicePaper';
import PaymentProofUploader from '../../components/PaymentProofUploader';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<'NOT_GENERATED' | 'GENERATING' | 'READY' | 'FAILED'>('NOT_GENERATED');
  const [snapshotStatus, setSnapshotStatus] = useState<'NOT_GENERATED' | 'GENERATING' | 'READY' | 'FAILED'>('NOT_GENERATED');

  // Payment modal states
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentsList, setPaymentsList] = useState<PaymentRecord[]>([]);
  const [accountsList, setAccountsList] = useState<PaymentAccount[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [chequeBankName, setChequeBankName] = useState('');
  const [recordPaymentProof, setRecordPaymentProof] = useState<PaymentProof | null>(null);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Lightbox modal for proof
  const [activeProofView, setActiveProofView] = useState<PaymentProof | null>(null);

  // Sharing states
  const [shareFormat, setShareFormat] = useState<'PDF' | 'PNG' | 'LINK'>('PDF');
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

  async function loadPayments(invoiceId: string) {
    try {
      const res = await apiClient.listPayments(invoiceId);
      setPaymentsList(res || []);
    } catch (err) {
      console.error('Failed to load payments history:', err);
    }
  }

  async function loadInvoice() {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const inv = await apiClient.getInvoice(id);
      setInvoice(inv);
      setIsSharingEnabled(inv.publicAccess?.enabled || false);
      setPdfStatus(inv.document?.pdf?.status || 'NOT_GENERATED');
      setSnapshotStatus(inv.document?.snapshot?.status || 'NOT_GENERATED');

      if (inv.status === 'FINALIZED') {
        await loadPayments(id);
      }

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

  // Polling for document generation status
  useEffect(() => {
    if (!invoice || invoice.status === 'DRAFT') return;
    if (pdfStatus !== 'GENERATING' && pdfStatus !== 'NOT_GENERATED') return;

    const intervalId = setInterval(async () => {
      try {
        const inv = await apiClient.getInvoice(id);
        const currentPdfStatus = inv.document?.pdf?.status || 'NOT_GENERATED';
        const currentSnapshotStatus = inv.document?.snapshot?.status || 'NOT_GENERATED';

        setPdfStatus(currentPdfStatus);
        setSnapshotStatus(currentSnapshotStatus);

        if (currentPdfStatus === 'READY' || currentPdfStatus === 'FAILED') {
          setInvoice(inv);
        }
      } catch (err) {
        console.error('Polling document status failed:', err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [id, invoice, pdfStatus]);

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

  async function handleOpenPaymentModal() {
    if (!invoice) return;
    const dueAmountMinor = invoice.paymentSummary?.dueAmountMinor ?? invoice.totals.grandTotalMinor;
    const dueRupees = (dueAmountMinor / 100).toFixed(2);
    setPaymentAmount(dueRupees);
    setPaymentMethod('CASH');
    setSelectedAccountId('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentRef('');
    setChequeNumber('');
    setChequeDate(new Date().toISOString().split('T')[0]);
    setChequeBankName('');
    setRecordPaymentProof(null);
    setPaymentNotes('');
    setPaymentError(null);

    // Fetch active payment accounts
    try {
      const accs = await apiClient.listPaymentAccounts({ active: true });
      setAccountsList(accs || []);
    } catch (err) {
      console.error('Error fetching payment accounts:', err);
    }

    setPaymentModalOpen(true);
  }

  // Filter accounts for the selected method
  const matchingAccounts = accountsList.filter((a) => {
    if (paymentMethod === 'UPI' || paymentMethod === 'QR_CODE') return a.type === 'UPI';
    if (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHEQUE') return a.type === 'BANK';
    if (paymentMethod === 'CASH') return a.type === 'CASH';
    return false;
  });

  const selectedAccount = accountsList.find((a) => a.id === selectedAccountId || (a as any)._id === selectedAccountId);

  async function handleRecordPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Please enter a valid payment amount greater than 0');
      return;
    }

    const dueAmountMinor = invoice.paymentSummary?.dueAmountMinor ?? invoice.totals.grandTotalMinor;
    const dueRupees = dueAmountMinor / 100;
    if (amountNum > dueRupees) {
      setPaymentError(`Payment amount ₹${amountNum.toFixed(2)} cannot exceed remaining due amount ₹${dueRupees.toFixed(2)}`);
      return;
    }

    if ((paymentMethod === 'UPI' || paymentMethod === 'QR_CODE') && !selectedAccountId) {
      setPaymentError('Please select a receiving UPI Account');
      return;
    }

    if ((paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHEQUE') && !selectedAccountId) {
      setPaymentError('Please select a receiving Bank Account');
      return;
    }

    setSubmitLoading(true);
    setPaymentError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiClient.recordPayment(invoice.id || (invoice as any)._id, {
        amountMinor: Math.round(amountNum * 100),
        method: paymentMethod,
        paymentAccountId: selectedAccountId || null,
        referenceNumber: paymentRef.trim() || undefined,
        chequeDetails: paymentMethod === 'CHEQUE' ? {
          chequeNumber: chequeNumber.trim() || undefined,
          chequeDate: chequeDate ? new Date(chequeDate).toISOString() : undefined,
          bankName: chequeBankName.trim() || undefined,
          status: 'RECEIVED',
        } : undefined,
        proof: recordPaymentProof || undefined,
        paidAt: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        notes: paymentNotes.trim() || undefined,
      });

      setSuccessMsg(`Payment of ₹${amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })} recorded successfully!`);
      setPaymentModalOpen(false);
      await loadInvoice();
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleReversePayment(paymentId: string) {
    if (!invoice) return;
    if (!confirm('Are you sure you want to reverse this payment? This will update the invoice outstanding balance.')) return;

    setSubmitLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.reversePayment(invoice.id || (invoice as any)._id, paymentId, 'Reversed by shopkeeper');
      setSuccessMsg('Payment reversed successfully.');
      await loadInvoice();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reverse payment');
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

  async function handleRetryDocuments() {
    if (!invoice) return;
    setSubmitLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.retrySnapshot(invoice.id || (invoice as any)._id);
      setSuccessMsg('Document regeneration triggered. Checking status...');
      setPdfStatus('GENERATING');
      setSnapshotStatus('GENERATING');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to trigger document regeneration');
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

  function getSelectedShareTarget(): { label: string; url: string } {
    if (!invoice) return { label: 'Link', url: shareUrl || '' };

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const directPdfUrl = invoice.document?.pdf?.secureUrl || `${apiClient.getBaseUrl()}/invoices/${invoice.id || (invoice as any)._id}/download?format=pdf`;
    const directPngUrl = invoice.document?.snapshot?.secureUrl || `${apiClient.getBaseUrl()}/invoices/${invoice.id || (invoice as any)._id}/download?format=png`;
    const webShareUrl = shareUrl || `${baseUrl}/dashboard/invoices/detail/${invoice.id || (invoice as any)._id}`;

    if (shareFormat === 'PDF') {
      return { label: 'PDF Document', url: directPdfUrl };
    }
    if (shareFormat === 'PNG') {
      return { label: 'PNG Image', url: directPngUrl };
    }
    return { label: 'Interactive Link', url: webShareUrl };
  }

  function handleShareWhatsApp() {
    if (!invoice) return;
    const target = getSelectedShareTarget();
    const customerName = invoice.customerSnapshot?.name || 'Customer';
    const invoiceNum = invoice.invoiceNumber || 'Invoice';
    const amount = `₹${((invoice.totals.grandTotalMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const status = invoice.paymentSummary?.status || 'UNPAID';

    const text = `*JAY RAMJI ENTERPRISE*\n\nTax Invoice: *#${invoiceNum}*\nCustomer: ${customerName}\nTotal Amount: *${amount}*\nPayment Status: *${status}*\n\nAccess ${target.label}:\n${target.url}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  }

  function handleShareEmail() {
    if (!invoice) return;
    const target = getSelectedShareTarget();
    const customerName = invoice.customerSnapshot?.name || 'Customer';
    const invoiceNum = invoice.invoiceNumber || 'Invoice';
    const amount = `₹${((invoice.totals.grandTotalMinor || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const subject = `Invoice #${invoiceNum} from Jay Ramji Enterprise`;
    const body = `Dear ${customerName},\n\nPlease find the details for Invoice #${invoiceNum}.\n\nTotal Amount: ${amount}\n\nYou can view and download your ${target.label} directly at:\n${target.url}\n\nThank you,\nJay Ramji Enterprise`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function handleShareApp() {
    if (!invoice) return;
    const target = getSelectedShareTarget();
    const invoiceNum = invoice.invoiceNumber || 'Invoice';

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice #${invoiceNum} - Jay Ramji Enterprise`,
          text: `Invoice #${invoiceNum} (${target.label}) from Jay Ramji Enterprise`,
          url: target.url,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(target.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  // Web Share API native handler
  async function handleNativeShare() {
    setShareModalOpen(true);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div>
      </div>
    );
  }

  if (errorMsg && !invoice) {
    return (
      <div className="p-6 bg-danger-soft border border-danger-app/20 text-danger-app rounded-xl">
        <h3 className="font-bold text-sm">Failed to load invoice</h3>
        <p className="text-xs mt-1">{errorMsg}</p>
        <Link href="/dashboard/invoices" className="mt-3 inline-block text-xs font-bold underline">
          ← Return to Invoices
        </Link>
      </div>
    );
  }

  if (!invoice) return null;

  const isDraft = invoice.status === 'DRAFT';
  const customerObj = isDraft ? selectedCustomer : invoice.customerSnapshot;
  const businessObj = isDraft ? business : invoice.businessSnapshot;
  const assetsObj = isDraft ? activeAssets : invoice.assetSnapshot;

  const invoiceItems = invoice.items.map((it: any) => ({
    description: it.description,
    quantity: it.quantity,
    unitPrice: it.unitPriceMinor / 100,
    amount: (it.quantity * it.unitPriceMinor) / 100,
    type: it.type,
  }));

  const partsTotal = invoiceItems
    .filter((it: any) => it.type === 'PRODUCT')
    .reduce((sum: number, it: any) => sum + it.amount, 0);

  const laborTotal = invoiceItems
    .filter((it: any) => it.type === 'SERVICE')
    .reduce((sum: number, it: any) => sum + it.amount, 0);

  const taxTotal = (invoice.totals.taxTotalMinor || 0) / 100;
  const grandTotal = (invoice.totals.grandTotalMinor || 0) / 100;
  const totalPaid = ((invoice.paymentSummary?.paidAmountMinor || 0) / 100);
  const totalDue = ((invoice.paymentSummary?.dueAmountMinor ?? invoice.totals.grandTotalMinor) / 100);
  const paymentStatus = invoice.paymentSummary?.status || 'UNPAID';

  const logoUrl = assetsObj?.logo?.secureUrl;
  const stampUrl = assetsObj?.stamp?.secureUrl;
  const signatureUrl = assetsObj?.signature?.secureUrl;

  return (
    <div className="space-y-6">
      
      {/* Top Banner Warning for Drafts */}
      {isDraft && (
        <div className="p-4 bg-warning-soft border border-warning-app/25 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-warning-app uppercase tracking-wider">Draft Mode Workspace</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              This invoice is currently a draft and has no official invoice number. Preview and finalize it to generate files.
            </p>
          </div>
          <div className="flex space-x-3">
            <Link
              href={`/dashboard/invoices/edit/${invoice.id || (invoice as any)._id}`}
              className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer transition"
            >
              Edit Draft
            </Link>
            <Link
              href={`/dashboard/invoices/preview/${invoice.id || (invoice as any)._id}`}
              className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold shadow-sm transition text-center cursor-pointer"
            >
              Preview & Finalize
            </Link>
          </div>
        </div>
      )}

      {/* Financial Status Summary Card */}
      {!isDraft && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-app border border-border-app p-4 rounded-xl shadow-sm text-xs">
          <div className="space-y-0.5">
            <span className="text-text-muted text-[10px] uppercase font-bold tracking-wider">Total Amount</span>
            <p className="text-sm font-bold text-text-primary">
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-text-muted text-[10px] uppercase font-bold tracking-wider">Already Paid</span>
            <p className="text-sm font-bold text-success-app">
              ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-text-muted text-[10px] uppercase font-bold tracking-wider">Outstanding Due</span>
            <p className="text-sm font-bold text-danger-app">
              ₹{totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-text-muted text-[10px] uppercase font-bold tracking-wider">Payment Status</span>
            <div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase inline-block ${
                paymentStatus === 'PAID'
                  ? 'bg-success-soft text-success-app border border-success-app/20'
                  : (paymentStatus === 'PARTIALLY_PAID' || (paymentStatus as string) === 'PARTIAL')
                  ? 'bg-warning-soft text-warning-app border border-warning-app/20'
                  : 'bg-danger-soft text-danger-app border border-danger-app/20'
              }`}>
                {paymentStatus}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Document status check banner for finalized/cancelled bills */}
      {!isDraft && (
        <div className="p-4 bg-surface-app border border-border-app rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              {invoice.status === 'CANCELLED' ? 'Cancelled Invoice' : `Invoice ${invoice.invoiceNumber}`}
            </h3>
            <div className="text-xs text-text-secondary mt-0.5">
              {invoice.status === 'CANCELLED' ? `Reason: ${invoice.cancellationReason || '-'}` : (
                <>
                  {pdfStatus === 'GENERATING' && 'Generating official PDF and PNG copy...'}
                  {pdfStatus === 'READY' && 'Invoice document is ready for download and sharing.'}
                  {pdfStatus === 'FAILED' && 'Invoice was finalized, but the PDF could not be generated.'}
                </>
              )}
            </div>
          </div>
          <div className="flex space-x-3 items-center">
            {invoice.status !== 'CANCELLED' && (
              <>
                {pdfStatus === 'GENERATING' && (
                  <div className="flex items-center space-x-2 text-xs font-semibold text-text-secondary">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-700"></div>
                    <span>Processing...</span>
                  </div>
                )}
                {pdfStatus === 'FAILED' && (
                  <button
                    onClick={handleRetryDocuments}
                    disabled={submitLoading}
                    className="px-4 py-2 bg-warning-app hover:bg-warning-app/80 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    {submitLoading ? 'Retrying...' : 'Retry Generation'}
                  </button>
                )}
                {pdfStatus === 'READY' && (
                  <span className="text-[10px] bg-success-soft text-success-app px-2.5 py-1 rounded-full font-black uppercase border border-success-app/20">
                    READY
                  </span>
                )}
              </>
            )}
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
          {!isDraft && pdfStatus === 'READY' && (
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
          {!isDraft && invoice.status === 'FINALIZED' && paymentStatus !== 'PAID' && (
            <button
              onClick={handleOpenPaymentModal}
              disabled={submitLoading}
              className="px-4 py-2 bg-success-soft hover:bg-success-soft/80 text-success-app border border-success-app/20 rounded-lg text-xs font-bold cursor-pointer transition flex items-center space-x-1.5"
            >
              <span>Record Payment</span>
            </button>
          )}
          {!isDraft && pdfStatus === 'READY' && (
            <button
              onClick={handleNativeShare}
              className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-lg text-xs font-bold cursor-pointer transition"
            >
              Share Bill
            </button>
          )}
          <Link
            href={`/dashboard/invoices/preview/${invoice.id || (invoice as any)._id}`}
            target="_blank"
            className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-primary rounded-lg text-xs font-bold cursor-pointer transition"
          >
            Open Live Print Bill
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-sm rounded-lg font-medium">
          {errorMsg}
        </div>
      )}

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

      {/* Payment History Log */}
      {!isDraft && paymentsList.length > 0 && (
        <div className="bg-surface-app border border-border-app p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-border-light pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center space-x-2">
              <span>Payment History & Receiving Accounts</span>
            </h3>
            <span className="text-xs font-bold text-text-secondary">
              {paymentsList.filter((p) => p.status === 'CONFIRMED').length} Confirmed Payments
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-2-app border-b border-border-app text-text-muted uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Receiving Account</th>
                  <th className="py-2.5 px-3">Reference / Cheque</th>
                  <th className="py-2.5 px-3 text-center">Proof</th>
                  <th className="py-2.5 px-3 text-right">Amount Paid</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-app">
                {paymentsList.map((p) => (
                  <tr key={p.id || (p as any)._id} className="hover:bg-surface-2-app/20">
                    <td className="py-2.5 px-3 text-text-secondary font-medium">
                      {new Date(p.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-text-primary">
                      <span className="inline-flex items-center space-x-1">
                        <span>{p.method.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-text-primary">
                      {p.paymentAccountSnapshot?.displayName || p.paymentAccountSnapshot?.name || (p.method === 'CASH' ? 'Cash' : '-')}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary text-[11px]">
                      {p.method === 'CHEQUE' ? (
                        <span>Cheque #{p.chequeDetails?.chequeNumber || p.referenceNumber || '-'} {p.chequeDetails?.bankName ? `(${p.chequeDetails.bankName})` : ''}</span>
                      ) : (
                        <span className="font-mono">{p.referenceNumber || '-'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {p.proof?.secureUrl ? (
                        <button
                          type="button"
                          onClick={() => setActiveProofView(p.proof!)}
                          className="px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-200 rounded text-[10px] font-bold hover:bg-primary-100 transition cursor-pointer"
                        >
                          View Proof
                        </button>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-text-primary">
                      ₹{(p.amountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'CONFIRMED' ? 'bg-success-soft text-success-app border border-success-app/20' : 'bg-surface-2-app text-text-muted line-through'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {p.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleReversePayment(p.id || (p as any)._id)}
                          disabled={submitLoading}
                          className="text-danger-app hover:underline text-xs font-bold cursor-pointer"
                        >
                          Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Recording Modal Dialog */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-light pb-2">
              <h3 className="text-base font-bold text-text-primary">
                Record Payment
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="text-text-muted hover:text-text-primary font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {paymentError && (
              <div className="p-3 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-lg font-medium">
                {paymentError}
              </div>
            )}

            {/* Quick Invoice Financial Summary */}
            <div className="bg-surface-2-app/40 border border-border-app p-3.5 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">Invoice Number:</span>
                <span className="font-bold text-text-primary">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Invoice Total:</span>
                <span className="font-bold text-text-primary">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Already Paid:</span>
                <span className="font-bold text-success-app">
                  ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t border-border-light pt-1.5 font-bold">
                <span className="text-text-primary">Outstanding Due:</span>
                <span className="text-danger-app font-black text-sm">
                  ₹{totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs">
              {/* Payment Method Selector */}
              <div>
                <label className="block text-text-secondary font-semibold mb-1">
                  Payment Method <span className="text-danger-app">*</span>
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['CASH', 'UPI', 'QR_CODE', 'BANK_TRANSFER', 'CHEQUE'] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m);
                        // Auto-select first matching account if available
                        const matching = accountsList.filter((a) => {
                          if (m === 'UPI' || m === 'QR_CODE') return a.type === 'UPI';
                          if (m === 'BANK_TRANSFER' || m === 'CHEQUE') return a.type === 'BANK';
                          if (m === 'CASH') return a.type === 'CASH';
                          return false;
                        });
                        if (matching.length > 0) {
                          setSelectedAccountId(matching[0].id || (matching[0] as any)._id);
                        } else {
                          setSelectedAccountId('');
                        }
                      }}
                      className={`py-2 px-1 rounded-xl font-bold border transition text-center text-[10.5px] cursor-pointer ${
                        paymentMethod === m
                          ? 'bg-primary-700 text-white border-primary-700 shadow-sm'
                          : 'bg-surface-2-app text-text-secondary border-border-app hover:bg-surface-app'
                      }`}
                    >
                      {m === 'CASH' && 'Cash'}
                      {m === 'UPI' && 'UPI'}
                      {m === 'QR_CODE' && 'QR'}
                      {m === 'BANK_TRANSFER' && 'Bank'}
                      {m === 'CHEQUE' && 'Cheque'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Receiving Account Selector */}
              {(paymentMethod === 'UPI' || paymentMethod === 'QR_CODE' || paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHEQUE') && (
                <div className="space-y-2 bg-surface-2-app/30 p-3 rounded-xl border border-border-app">
                  <div className="flex justify-between items-center">
                    <label className="block text-text-secondary font-bold">
                      {paymentMethod === 'CHEQUE' ? 'Deposit Bank Account' : 'Receiving Account'}{' '}
                      <span className="text-danger-app">*</span>
                    </label>
                    <Link
                      href="/dashboard/settings/payment-accounts"
                      target="_blank"
                      className="text-[10px] text-primary-700 hover:underline font-bold"
                    >
                      + Manage Accounts
                    </Link>
                  </div>
                  {matchingAccounts.length === 0 ? (
                    <div className="p-2.5 bg-warning-soft border border-warning-app/20 text-warning-app text-xs rounded-lg font-medium">
                      No active {paymentMethod === 'UPI' || paymentMethod === 'QR_CODE' ? 'UPI' : 'Bank'} accounts found. Please add one in{' '}
                      <Link href="/dashboard/settings/payment-accounts" target="_blank" className="underline font-bold">
                        Settings → Payment Accounts
                      </Link>.
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-xs font-bold text-text-primary focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Select Receiving Account --</option>
                      {matchingAccounts.map((acc) => (
                        <option key={acc.id || (acc as any)._id} value={acc.id || (acc as any)._id}>
                          {acc.displayName || acc.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* QR Code Preview if QR_CODE selected */}
                  {paymentMethod === 'QR_CODE' && selectedAccount?.qrAssetUrl && (
                    <div className="p-3 bg-white rounded-xl border border-border-app flex flex-col items-center space-y-2">
                      <p className="text-[10px] font-bold text-gray-700 uppercase">Customer Scan QR</p>
                      <img src={selectedAccount.qrAssetUrl} alt="UPI QR" className="w-36 h-36 object-contain rounded-lg border border-gray-200 shadow-sm" />
                      <p className="text-[10px] font-mono font-bold text-gray-800">{selectedAccount.upiId}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Amount and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">
                    Payment Amount (₹) <span className="text-danger-app">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={totalDue}
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-sm font-bold text-text-primary focus:outline-none focus:border-primary-700"
                  />
                </div>

                <div>
                  <label className="block text-text-secondary font-semibold mb-1">
                    Payment Date <span className="text-danger-app">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Cheque specific fields */}
              {paymentMethod === 'CHEQUE' && (
                <div className="bg-surface-2-app/40 p-3 rounded-xl border border-border-app space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-text-secondary font-semibold mb-1">
                        Cheque Number <span className="text-danger-app">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 000123"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-xs font-mono font-bold text-text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-text-secondary font-semibold mb-1">Cheque Date</label>
                      <input
                        type="date"
                        value={chequeDate}
                        onChange={(e) => setChequeDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-xs text-text-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-text-secondary font-semibold mb-1">Issuing Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. State Bank of India"
                      value={chequeBankName}
                      onChange={(e) => setChequeBankName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-xs text-text-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Reference / UTR Number (for UPI, Bank, QR) */}
              {(paymentMethod === 'UPI' || paymentMethod === 'QR_CODE' || paymentMethod === 'BANK_TRANSFER') && (
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">
                    {paymentMethod === 'BANK_TRANSFER' ? 'Transaction / UTR #' : 'UPI Reference / UTR #'} (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 12-digit UTR or Transaction ID"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-xs font-mono text-text-primary focus:outline-none"
                  />
                </div>
              )}

              {/* Payment Proof Uploader (Device Upload + Phone QR Upload) */}
              <PaymentProofUploader
                proof={recordPaymentProof}
                onProofChange={setRecordPaymentProof}
                invoiceId={invoice.id || (invoice as any)._id}
                metadata={{
                  invoiceNumber: invoice.invoiceNumber,
                  amountMinor: Math.round((parseFloat(paymentAmount) || 0) * 100),
                  method: paymentMethod,
                  customerName: invoice.customerSnapshot?.name,
                }}
              />

              {/* Notes */}
              <div>
                <label className="block text-text-secondary font-semibold mb-1">Payment Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Paid in full via GPay at shop counter"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div className="flex space-x-3 pt-3 border-t border-border-app">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="flex-1 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {submitLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Proof Lightbox Modal */}
      {activeProofView && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app p-4 rounded-2xl max-w-xl w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-border-light pb-2">
              <h3 className="text-sm font-bold text-text-primary">Payment Proof Document</h3>
              <button
                type="button"
                onClick={() => setActiveProofView(null)}
                className="text-text-muted hover:text-text-primary font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="flex justify-center bg-black/5 p-2 rounded-xl max-h-[70vh] overflow-auto">
              {activeProofView.format?.toLowerCase() === 'pdf' ? (
                <iframe src={activeProofView.secureUrl || ''} className="w-full h-96 rounded-lg" />
              ) : (
                <img
                  src={activeProofView.secureUrl || ''}
                  alt="Payment Proof"
                  className="max-h-[65vh] max-w-full object-contain rounded-lg shadow"
                />
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border-light text-xs font-semibold">
              <a
                href={activeProofView.secureUrl || ''}
                target="_blank"
                rel="noreferrer"
                className="text-primary-700 hover:underline"
              >
                Open Full Size in New Tab ↗
              </a>
              <button
                type="button"
                onClick={() => setActiveProofView(null)}
                className="px-4 py-1.5 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg font-bold text-text-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Configuration Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border-light pb-3">
              <div>
                <h3 className="text-base font-bold text-text-primary">Share Invoice</h3>
                <p className="text-xs text-text-muted">Send directly via WhatsApp, Email, or copy document links.</p>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="text-text-muted hover:text-text-primary font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* 1. Format Selection */}
            <div>
              <label className="block text-text-secondary uppercase text-[10px] font-bold tracking-wider mb-2">
                Select Format to Share
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setShareFormat('PDF')}
                  className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                    shareFormat === 'PDF'
                      ? 'bg-primary-700 text-white border-primary-700 shadow-sm'
                      : 'bg-surface-2-app text-text-secondary border-border-app hover:bg-surface-app'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>PDF Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShareFormat('PNG')}
                  className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                    shareFormat === 'PNG'
                      ? 'bg-primary-700 text-white border-primary-700 shadow-sm'
                      : 'bg-surface-2-app text-text-secondary border-border-app hover:bg-surface-app'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>PNG Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShareFormat('LINK')}
                  className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                    shareFormat === 'LINK'
                      ? 'bg-primary-700 text-white border-primary-700 shadow-sm'
                      : 'bg-surface-2-app text-text-secondary border-border-app hover:bg-surface-app'
                  }`}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Web Link</span>
                </button>
              </div>
            </div>

            {/* 2. Direct Share Actions */}
            <div className="space-y-2">
              <label className="block text-text-secondary uppercase text-[10px] font-bold tracking-wider">
                Direct Share to Platforms
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareEmail}
                  className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareApp}
                  className="py-2.5 px-3 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share App</span>
                </button>
              </div>
            </div>

            {/* 3. Direct Link Copy */}
            <div className="space-y-1.5 pt-2 border-t border-border-light">
              <div className="flex items-center justify-between">
                <label className="block text-text-secondary uppercase text-[10px] font-bold">
                  {getSelectedShareTarget().label} Direct URL
                </label>
                {copied && <span className="text-[10px] text-emerald-600 font-bold">Link Copied!</span>}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  readOnly
                  value={getSelectedShareTarget().url}
                  className="flex-1 px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-text-primary select-all text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(getSelectedShareTarget().url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  }}
                  className="px-4 py-1.5 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-primary font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* 4. Public Web Link Toggle */}
            <div className="space-y-2 pt-2 border-t border-border-light text-xs font-semibold">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-text-primary font-bold block">Public Interactive Access</span>
                  <span className="text-[10px] text-text-muted block">
                    {isSharingEnabled ? 'Anyone with link can view bill' : 'Public web link is currently disabled'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={isSharingEnabled ? handleRevokeShareLink : handleGenerateShareLink}
                  className={`px-3 py-1.5 rounded-lg font-bold text-white transition text-xs cursor-pointer ${
                    isSharingEnabled ? 'bg-danger-app hover:bg-danger-app/80' : 'bg-primary-700 hover:bg-primary-800'
                  }`}
                >
                  {isSharingEnabled ? 'Revoke Web Link' : 'Enable Web Link'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border-app">
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-lg text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
