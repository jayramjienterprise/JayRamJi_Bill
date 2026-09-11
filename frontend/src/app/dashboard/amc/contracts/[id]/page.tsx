'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../../../../lib/api/client';
import AmcContractPaper from '../../components/AmcContractPaper';
import ContractPaymentModal from '../../components/ContractPaymentModal';
import {
  ArrowLeft,
  Printer,
  Download,
  Share2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  FileCheck,
  Building2,
  ShieldCheck,
  RefreshCw,
  XCircle,
  PauseCircle,
  CreditCard,
} from 'lucide-react';

interface ContractPageProps {
  params: Promise<{ id: string }>;
}

export default function ContractPreviewPage({ params }: ContractPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [contract, setContract] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [assets, setAssets] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Status Change Dialog state
  const [confirmStatusModal, setConfirmStatusModal] = useState<string | null>(null);
  // Delete Dialog state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchContractData();
    }
  }, [id]);

  async function fetchContractData() {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [contractRes, bizRes, assetsList]: any = await Promise.all([
        apiClient.get(`/amc/contracts/${id}`),
        apiClient.get('/business').catch(() => null),
        apiClient.listAssets().catch(() => []),
      ]);

      const contractData = contractRes?.data || contractRes;
      if (!contractData || !contractData.contractNumber) {
        throw new Error('AMC Contract document not found');
      }
      setContract(contractData);

      if (bizRes) {
        setBusiness(bizRes.business || bizRes.data?.business || bizRes);
      }

      if (Array.isArray(assetsList)) {
        const logo = assetsList.find((a: any) => a.type === 'LOGO' && a.active);
        const stamp = assetsList.find((a: any) => a.type === 'STAMP' && a.active);
        const signature = assetsList.find((a: any) => a.type === 'SIGNATURE' && a.active);
        setAssets({ logo, stamp, signature });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load AMC Contract document');
    } finally {
      setLoading(false);
    }
  }

  // Handle Status Transition
  async function handleStatusChange(newStatus: string) {
    if (!id) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await apiClient.patch(`/amc/contracts/${id}/status`, { status: newStatus });
      setSuccessMsg(`Contract status successfully updated to ${newStatus.replace('_', ' ')}!`);
      setConfirmStatusModal(null);
      await fetchContractData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update contract status');
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Contract Deletion (Cascades to visits)
  async function handleDeleteContract() {
    if (!id) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await apiClient.delete(`/amc/contracts/${id}`);
      setShowDeleteModal(false);
      router.push('/dashboard/amc?tab=contracts');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete contract');
      setActionLoading(false);
    }
  }

  // Handle PDF Download
  async function handleDownloadPdf() {
    if (!id || !contract) return;
    try {
      setIsPdfGenerating(true);
      setErrorMsg(null);

      const baseUrl = apiClient.getBaseUrl();
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const storedBusinessId = localStorage.getItem('x-business-id');
        if (storedBusinessId) headers['x-business-id'] = storedBusinessId;
      }

      const response = await fetch(`${baseUrl}/amc/contracts/${id}/pdf`, {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to generate official Contract PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contract-${contract.contractNumber || 'Agreement'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download PDF contract');
    } finally {
      setIsPdfGenerating(false);
    }
  }

  // Handle WhatsApp Share (Strictly sends PDF file only)
  async function handleShareWhatsApp() {
    if (!id || !contract) return;
    try {
      setIsPdfGenerating(true);
      setErrorMsg(null);

      const baseUrl = apiClient.getBaseUrl();
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const storedBusinessId = localStorage.getItem('x-business-id');
        if (storedBusinessId) headers['x-business-id'] = storedBusinessId;
      }

      const response = await fetch(`${baseUrl}/amc/contracts/${id}/pdf`, {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to prepare PDF document for WhatsApp sharing');
      }

      const blob = await response.blob();
      const fileName = `Contract-${contract.contractNumber || 'Agreement'}.pdf`;

      const isMobile =
        typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

      const rawPhone =
        contract.customerId?.contact?.phone ||
        contract.customerId?.phone ||
        '';
      const cleanDigits = String(rawPhone).replace(/\D/g, '');
      const phoneDigits = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

      const file = new File([blob], fileName, { type: 'application/pdf' });

      // 1. Mobile Native Web Share (shares strictly PDF file)
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Contract #${contract.contractNumber || 'Agreement'}`,
          });
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return;
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

      // 3. Open WhatsApp chat directly without link or message
      if (isMobile) {
        setSuccessMsg('Contract PDF downloaded! Opening WhatsApp...');
        const mobileUrl = phoneDigits
          ? `https://api.whatsapp.com/send?phone=${phoneDigits}`
          : 'whatsapp://send';
        setTimeout(() => {
          window.location.href = mobileUrl;
        }, 400);
      } else {
        setSuccessMsg('Contract PDF downloaded! Attach and send directly in WhatsApp.');
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
        setErrorMsg(err.message || 'Failed to prepare contract PDF');
      }
    } finally {
      setIsPdfGenerating(false);
    }
  }

  // Handle Print
  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-text-secondary text-sm font-semibold">Loading contract agreement document...</p>
      </div>
    );
  }

  if (errorMsg && !contract) {
    return (
      <div className="max-w-xl mx-auto mt-12 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-text-primary">Contract Document Error</h2>
        <p className="text-sm text-text-secondary">{errorMsg}</p>
        <Link
          href="/dashboard/amc?tab=contracts"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Contracts
        </Link>
      </div>
    );
  }

  const customerData = contract?.customerId || { name: 'Customer' };

  return (
    <div className="space-y-6 pb-16">
      {/* ---------------------------------------------------- */}
      {/* TOP CONTROL ACTION BAR */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-app border border-border-app p-4 rounded-2xl shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/amc?tab=contracts"
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-2-app rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-text-primary">
                Contract #{contract.contractNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                  contract.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : contract.status === 'PENDING_APPROVAL'
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    : 'bg-surface-2-app text-text-secondary border border-border-app'
                }`}
              >
                {contract.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-text-secondary font-medium">
              Client: {customerData.name} • Issued {new Date(contract.startDate || contract.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1-Click Approve & Activate (if pending) */}
          {(contract.status === 'PENDING_APPROVAL' || contract.status === 'PENDING_PAYMENT' || contract.status === 'DRAFT') && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleStatusChange('ACTIVE')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve & Activate
            </button>
          )}

          {/* Record Payment Button */}
          <button
            type="button"
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Record Customer Advance or Milestone Payment"
          >
            <CreditCard className="w-4 h-4" />
            Record Payment
          </button>

          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5 bg-surface-2-app border border-border-app rounded-xl px-2.5 py-1 text-xs">
            <span className="text-text-secondary font-bold">Status:</span>
            <select
              value={contract.status}
              disabled={actionLoading}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-transparent font-bold text-text-primary focus:outline-hidden cursor-pointer"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
              <option value="PENDING_PAYMENT">PENDING PAYMENT</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="TERMINATED">TERMINATED</option>
            </select>
          </div>

          {/* Print */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-2-app hover:bg-border-app text-text-primary rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>

          {/* Download PDF */}
          <button
            type="button"
            disabled={isPdfGenerating}
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-2-app hover:bg-border-app text-text-primary rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {isPdfGenerating ? <RefreshCw className="w-4 h-4 animate-spin text-primary" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>

          {/* Share on WhatsApp (Strictly PDF file only) */}
          <button
            type="button"
            disabled={isPdfGenerating}
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
          >
            {isPdfGenerating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            Share PDF
          </button>

          {/* Delete Contract */}
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-bold flex items-center gap-2 print:hidden">
          <CheckCircle2 className="w-4 h-4" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2 print:hidden">
          <AlertCircle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* CONTRACT DOCUMENT PAPER PREVIEW */}
      {/* ---------------------------------------------------- */}
      <div className="overflow-x-auto py-4 flex justify-center bg-surface-2-app rounded-2xl border border-border-app">
        <AmcContractPaper
          contract={contract}
          business={business || { name: 'Jay Ramji Enterprise', address: { line1: '' }, contact: {} }}
          customer={customerData}
          assets={assets}
        />
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL: DELETE CONTRACT CONFIRMATION */}
      {/* ---------------------------------------------------- */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-600">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-text-primary">
                Delete Contract #{contract.contractNumber}?
              </h3>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to delete this AMC contract? This action will{' '}
              <strong className="text-red-600">cascade delete all scheduled and pending service visits & job cards</strong>{' '}
              associated with this contract.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-app">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-surface-2-app hover:bg-border-app text-text-secondary rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteContract}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: CONTRACT PAYMENT RECORDING & MILESTONES */}
      {/* ---------------------------------------------------- */}
      {contract && (
        <ContractPaymentModal
          contract={contract}
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onPaymentSuccess={(updated) => {
            setContract(updated);
            fetchContractData();
          }}
        />
      )}
    </div>
  );
}
