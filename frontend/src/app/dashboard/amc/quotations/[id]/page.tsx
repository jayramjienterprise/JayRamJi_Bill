'use client';

import React, { useEffect, useState, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../../../lib/api/client';
import { convertNumberToWords } from '../../../../../lib/utils/numberToWords';
import AmcQuotationPaper, { AmcQuotationPaperItem } from '../../components/AmcQuotationPaper';
import {
  ArrowLeft,
  Download,
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
  Check,
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
      setSuccessMsg('Quotation successfully finalized!');
      // Reload
      const updated: any = await apiClient.get(`/amc/quotations/${id}`);
      setQuotation(updated.data || updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to finalize quotation');
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Download PDF
  async function handleDownloadPdf() {
    if (!id) return;
    try {
      setIsPdfGenerating(true);
      setErrorMsg(null);
      const res: any = await apiClient.get(`/amc/quotations/${id}/pdf`);
      if (res?.pdfUrl) {
        window.open(res.pdfUrl, '_blank');
      } else {
        alert('PDF document is being compiled. Please try again in a few moments.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate PDF quotation');
    } finally {
      setIsPdfGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700"></div>
        <p className="text-sm font-semibold text-text-secondary">Loading quotation details...</p>
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
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-app border border-border-app p-4 sm:p-5 rounded-2xl shadow-xs">
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
                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                    : quotation.status === 'DRAFT'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
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

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDraft && (
            <Link
              href={`/dashboard/amc/quotations/create?edit=${id}`}
              className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Edit line items and pricing"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Draft Quotation</span>
            </Link>
          )}

          {isDraft && (
            <button
              onClick={handleFinalize}
              disabled={actionLoading}
              className="px-4 py-2 bg-surface-2-app hover:bg-border-app border border-border-app text-text-primary rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Lock and finalize proposal"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-success-app" />
              <span>{actionLoading ? 'Finalizing...' : 'Finalize Quotation'}</span>
            </button>
          )}

          <button
            onClick={handleDownloadPdf}
            disabled={isPdfGenerating}
            className="px-3.5 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-xl text-xs font-semibold text-text-primary transition flex items-center gap-1.5 cursor-pointer"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isPdfGenerating ? 'Generating...' : 'Download PDF'}</span>
          </button>

          {!isConverted && (
            <Link
              href={`/dashboard/amc?tab=quotations&convertId=${id}`}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>Convert to AMC</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-success-soft border border-success-app/20 text-success-app text-xs rounded-xl flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      {isDraft && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs rounded-xl flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Draft Mode:</strong> This proposal is editable. Click <strong>Edit Draft Quotation</strong> above to modify services, quantities, prices, or terms.
            </span>
          </div>
          <Link
            href={`/dashboard/amc/quotations/create?edit=${id}`}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shrink-0"
          >
            Edit Now
          </Link>
        </div>
      )}

      {/* Paper Preview Card */}
      <div className="bg-surface-app border border-border-app rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-border-app pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-700" />
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Official Quotation Inquiry Document
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
            className="transition-transform duration-150 ease-out"
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
    </div>
  );
}
