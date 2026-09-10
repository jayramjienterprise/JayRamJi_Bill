'use client';

import React, { useEffect, useState, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../../../lib/api/client';
import { convertNumberToWords } from '../../../../../lib/utils/numberToWords';
import AmcQuotationPaper from '../../components/AmcQuotationPaper';
import {
  ArrowLeft,
  Download,
  Printer,
  Share2,
  Copy,
  Check,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Maximize2,
  Minimize2,
  FileText,
  Building2,
  ShieldCheck,
  MessageCircle,
  Trash2,
} from 'lucide-react';

export default function AmcQuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [quotation, setQuotation] = useState<any | null>(null);
  const [business, setBusiness] = useState<any | null>(null);
  const [activeAssets, setActiveAssets] = useState<{ logo: any; stamp: any; signature: any }>({
    logo: null,
    stamp: null,
    signature: null,
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadQuotation() {
      if (!id) return;
      try {
        setLoading(true);
        setErrorMsg(null);

        const [quoteRes, bizRes, assetsList]: any = await Promise.all([
          apiClient.get(`/amc/quotations/${id}`),
          apiClient.get('/business').catch(() => null),
          apiClient.listAssets().catch(() => []),
        ]);

        const quoteData = quoteRes?.data || quoteRes;
        setQuotation(quoteData);

        if (bizRes) {
          setBusiness(bizRes.business || bizRes.data?.business || bizRes);
        }

        if (Array.isArray(assetsList)) {
          const logo = assetsList.find((a: any) => a.type === 'LOGO' && a.active);
          const stamp = assetsList.find((a: any) => a.type === 'STAMP' && a.active);
          const signature = assetsList.find((a: any) => a.type === 'SIGNATURE' && a.active);
          setActiveAssets({ logo, stamp, signature });
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load quotation details');
      } finally {
        setLoading(false);
      }
    }

    loadQuotation();
  }, [id]);

  // Adjust preview scaling
  useEffect(() => {
    const handleResize = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth - 48;
        const a4Width = 794;
        const newScale = Math.min(1, Math.max(0.4, containerWidth / a4Width));
        setScale(newScale);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [quotation]);

  // Handle finalize quotation
  async function handleFinalize() {
    if (!confirm('Finalize this AMC Quotation? Once finalized, line items and pricing are locked.')) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await apiClient.patch(`/amc/quotations/${id}/status`, { status: 'SENT' });
      setSuccessMsg('Quotation successfully finalized and ready for sharing!');
      const updated: any = await apiClient.get(`/amc/quotations/${id}`);
      setQuotation(updated.data || updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to finalize quotation');
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Download PDF directly via binary stream
  async function handleDownloadPdf() {
    if (!id || !quotation) return;
    try {
      setIsPdfGenerating(true);
      setErrorMsg(null);
      const baseUrl = apiClient.getBaseUrl();
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const storedBusinessId = localStorage.getItem('x-business-id');
        if (storedBusinessId) headers['x-business-id'] = storedBusinessId;
      }
      const response = await fetch(`${baseUrl}/amc/quotations/${id}/pdf`, {
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        throw new Error('Failed to generate PDF document');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quotation-${quotation.quotationNumber || 'Document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download PDF quotation');
    } finally {
      setIsPdfGenerating(false);
    }
  }

  // Handle WhatsApp Share (Sends PDF only — no text, no links)
  async function handleShareWhatsApp() {
    if (!id || !quotation) return;
    try {
      setIsPdfGenerating(true);
      setErrorMsg(null);

      // Fetch PDF Blob from backend
      const baseUrl = apiClient.getBaseUrl();
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const storedBusinessId = localStorage.getItem('x-business-id');
        if (storedBusinessId) headers['x-business-id'] = storedBusinessId;
      }
      const response = await fetch(`${baseUrl}/amc/quotations/${id}/pdf`, {
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        throw new Error('Failed to generate PDF document for WhatsApp');
      }
      const blob = await response.blob();
      const fileName = `Quotation-${quotation.quotationNumber || 'Document'}.pdf`;

      const isMobile =
        typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

      const rawPhone =
        quotation.customer?.contact?.phone ||
        (quotation.customer as any)?.phone ||
        '';
      const cleanDigits = String(rawPhone).replace(/\D/g, '');
      const phoneDigits = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

      const file = new File([blob], fileName, { type: 'application/pdf' });

      // 1. If on mobile and native sharing is supported, share directly into WhatsApp
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Quotation #${quotation.quotationNumber || 'Document'}`,
          });
          return; // Native share dialog successfully handled
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            // User cancelled share dialog
            return;
          }
        }
      }

      // 2. Download file to device
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(fileUrl);

      // 3. Open WhatsApp chat
      if (isMobile) {
        setSuccessMsg('Quotation PDF downloaded! Opening WhatsApp...');
        const mobileUrl = phoneDigits
          ? `https://api.whatsapp.com/send?phone=${phoneDigits}`
          : 'whatsapp://send';
        setTimeout(() => {
          window.location.href = mobileUrl;
        }, 400);
      } else {
        // Laptop / Desktop:
        setSuccessMsg('Quotation PDF downloaded! Attach and send directly in WhatsApp.');
        try {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = phoneDigits ? `whatsapp://send?phone=${phoneDigits}` : 'whatsapp://send';
          document.body.appendChild(iframe);
          setTimeout(() => {
            if (iframe.parentNode) document.body.removeChild(iframe);
          }, 1500);
        } catch (_) {}

        setTimeout(() => {
          const webUrl = phoneDigits
            ? `https://web.whatsapp.com/send?phone=${phoneDigits}`
            : 'https://web.whatsapp.com';
          window.open(webUrl, '_blank');
        }, 400);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message || 'Failed to prepare quotation PDF');
      }
    } finally {
      setIsPdfGenerating(false);
    }
  }

  // Handle Copy Link
  function handleCopyLink() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  // Handle Print
  function handlePrint() {
    window.print();
  }

  // Handle Convert to Contract
  async function handleConvertToContract() {
    if (!confirm(`Convert Quotation #${quotation?.quotationNumber} into an active AMC Contract?`)) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await apiClient.post(`/amc/quotations/${id}/convert`, {});
      setSuccessMsg('Quotation successfully converted to active AMC Contract!');
      setTimeout(() => {
        router.push('/dashboard/amc?tab=contracts');
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to convert quotation to contract');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteQuotation() {
    if (!confirm(`Are you sure you want to permanently delete Quotation #${quotation?.quotationNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg(null);
      await apiClient.delete(`/amc/quotations/${id}`);
      setSuccessMsg(`Quotation #${quotation?.quotationNumber} deleted successfully.`);
      setTimeout(() => {
        router.push('/dashboard/amc?tab=quotations');
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete quotation');
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700"></div>
        <p className="text-sm font-semibold text-text-secondary">Loading quotation preview...</p>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center bg-surface-app border border-border-app rounded-2xl">
          <AlertCircle className="w-10 h-10 text-danger-app mx-auto mb-3" />
          <h2 className="text-lg font-bold text-text-primary">Quotation Not Found</h2>
          <p className="text-xs text-text-secondary mt-1 mb-4">
            The requested AMC quotation could not be located.
          </p>
          <Link
            href="/dashboard/amc?tab=quotations"
            className="px-4 py-2 bg-primary-700 text-white rounded-lg text-xs font-bold transition"
          >
            Back to AMC Quotations
          </Link>
        </div>
      </div>
    );
  }

  const isDraft = quotation.status === 'DRAFT';
  const isConverted = quotation.status === 'CONVERTED_TO_CONTRACT';

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar (Hidden during print) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-app border border-border-app p-4 sm:p-5 rounded-2xl shadow-xs no-print">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/amc?tab=quotations"
            className="p-2 bg-surface-2-app hover:bg-border-app rounded-xl text-text-secondary transition cursor-pointer"
            title="Back to Quotations"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-black tracking-tight text-primary-700">
                {quotation.quotationNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isConverted
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : quotation.status === 'SENT'
                    ? 'bg-success-soft/60 text-success-app border border-success-app/20'
                    : quotation.status === 'DRAFT'
                    ? 'bg-surface-2-app text-text-secondary border border-border-app'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {isConverted
                  ? 'Active Contract'
                  : quotation.status === 'SENT'
                  ? 'Finalized'
                  : quotation.status === 'DRAFT'
                  ? 'Draft'
                  : quotation.status}
              </span>

              <span
                className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                  quotation.quotationType === 'COMPREHENSIVE'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {quotation.quotationType === 'COMPREHENSIVE'
                  ? 'Comprehensive AMC'
                  : 'Non-Comprehensive AMC'}
              </span>
            </div>

            <p className="text-xs text-text-secondary mt-0.5 font-medium">
              Client: <strong className="text-text-primary">{quotation.customerId?.name || 'Unspecified'}</strong> • Issued: {new Date(quotation.quotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Draft Actions */}
          {isDraft && (
            <>
              <Link
                href={`/dashboard/amc/quotations/create?edit=${id}`}
                className="px-4 py-2 bg-surface-2-app hover:bg-border-app border border-border-app text-text-primary rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Edit line items, rates, and terms"
              >
                <Edit3 className="w-3.5 h-3.5 text-primary-700" />
                <span>Edit Draft</span>
              </Link>

              <button
                onClick={handleFinalize}
                disabled={actionLoading}
                className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Lock and finalize proposal"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{actionLoading ? 'Finalizing...' : 'Finalize Quotation'}</span>
              </button>
            </>
          )}

          {/* Share PDF via WhatsApp */}
          <button
            onClick={handleShareWhatsApp}
            disabled={isPdfGenerating}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            title="Share quotation PDF via WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>{isPdfGenerating ? 'Preparing PDF...' : 'Share PDF on WhatsApp'}</span>
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={isPdfGenerating}
            className="px-3.5 py-2 bg-surface-2-app hover:bg-border-app border border-border-app rounded-xl text-xs font-bold text-text-primary transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Download PDF document"
          >
            <Download className="w-3.5 h-3.5 text-primary-700" />
            <span>{isPdfGenerating ? 'Generating...' : 'Download PDF'}</span>
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-surface-2-app hover:bg-border-app border border-border-app rounded-xl text-xs font-semibold text-text-secondary transition flex items-center gap-1.5 cursor-pointer"
            title="Print Quotation"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="px-3 py-2 bg-surface-2-app hover:bg-border-app border border-border-app rounded-xl text-xs font-semibold text-text-secondary transition flex items-center gap-1.5 cursor-pointer"
            title="Copy direct quotation link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success-app" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>

          {/* Convert to Contract */}
          {!isConverted && (
            <button
              onClick={handleConvertToContract}
              disabled={actionLoading}
              className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>Convert to AMC</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete Quotation */}
          {!isConverted && (
            <button
              onClick={handleDeleteQuotation}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-surface-2-app hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Delete this quotation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl flex items-center justify-between font-medium no-print">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-success-soft border border-success-app/20 text-success-app text-xs rounded-xl flex items-center justify-between font-medium no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      {/* Finalized Banner */}
      {quotation.status === 'SENT' && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-xs rounded-xl flex items-center justify-between font-medium no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>
              <strong>Quotation Finalized:</strong> This proposal is ready to share. You can send it directly to the customer via WhatsApp, download the PDF, or print it.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              disabled={isPdfGenerating}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <MessageCircle className="w-3 h-3" />
              <span>{isPdfGenerating ? 'Preparing PDF...' : 'Share PDF on WhatsApp'}</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isPdfGenerating}
              className="px-3 py-1 bg-surface-app border border-border-app hover:bg-surface-2-app text-text-primary rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Download className="w-3 h-3 text-primary-700" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Draft Banner */}
      {isDraft && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs rounded-xl flex items-center justify-between font-medium no-print">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Draft Mode:</strong> This proposal is editable. Click <strong>Edit Draft</strong> to update line items, rates, quantities, or terms. Click <strong>Finalize Quotation</strong> when ready to issue.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/dashboard/amc/quotations/create?edit=${id}`}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition"
            >
              Edit Items
            </Link>
            <button
              onClick={handleFinalize}
              className="px-3 py-1 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold transition"
            >
              Finalize Now
            </button>
          </div>
        </div>
      )}

      {/* Paper Preview Card */}
      <div className="bg-surface-app border border-border-app rounded-2xl shadow-sm p-4 sm:p-6 space-y-4 print-only-container">
        <div className="flex justify-between items-center border-b border-border-app pb-3 no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-700" />
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Official Quotation Inquiry Document Preview
            </h2>
          </div>
          <div className="text-xs text-text-secondary font-medium">
            Grand Total: <strong className="text-text-primary font-black text-sm">₹{(quotation.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        {/* Centered A4 Render Box */}
        <div
          ref={previewContainerRef}
          className="flex justify-center items-start overflow-x-auto p-2 sm:p-4 bg-surface-2-app/40 rounded-xl min-h-[850px]"
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              width: 794,
              marginBottom: `${Math.max(0, (1 - scale) * -1123)}px`,
            }}
            className="transition-transform duration-150 ease-out shadow-lg rounded bg-white shrink-0"
          >
            <AmcQuotationPaper
              quotation={{
                quotationNumber: quotation.quotationNumber,
                quotationDate: quotation.quotationDate,
                paymentTerms: quotation.paymentTerms || '10 Days from the Invoice date',
                validUntil: quotation.validUntil,
                quotationType: quotation.quotationType,
                amountInWords: convertNumberToWords(quotation.grandTotal || 0),
                termsAndConditions: quotation.termsAndConditions || [],
              }}
              business={
                business || {
                  name: 'JAY RAMJI ENTERPRISE',
                  address: { line1: 'Mundra Highway Road', city: 'Mundra', state: 'Gujarat' },
                  contact: { phone: '', email: '' },
                }
              }
              customer={quotation.customerId}
              items={quotation.items || []}
              totals={{
                subtotal: quotation.subtotal || 0,
                discount: quotation.discount || 0,
                taxTotal: quotation.taxAmount || 0,
                grandTotal: quotation.grandTotal || 0,
              }}
              assets={activeAssets}
            />
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          header,
          aside,
          nav,
          .no-print {
            display: none !important;
          }
          .print-only-container {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }
          @page {
            size: A4;
            margin: 8mm;
          }
        }
      `}</style>
    </div>
  );
}
