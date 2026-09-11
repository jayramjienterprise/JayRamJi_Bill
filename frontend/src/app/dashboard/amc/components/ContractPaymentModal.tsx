'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../../lib/api/client';
import { PaymentAccount, PaymentProof } from '../../../../lib/api/types';
import PaymentProofUploader from '../../invoices/components/PaymentProofUploader';
import {
  X,
  CreditCard,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  QrCode,
  FileText,
  Eye,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

interface ContractPaymentModalProps {
  contract: any;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: (updatedContract: any) => void;
}

export default function ContractPaymentModal({
  contract,
  isOpen,
  onClose,
  onPaymentSuccess,
}: ContractPaymentModalProps) {
  const [activeTab, setActiveTab] = useState<'record' | 'milestones' | 'history'>('record');
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'QR_CODE' | 'BANK_TRANSFER' | 'CHEQUE'>('UPI');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedInstallmentIndex, setSelectedInstallmentIndex] = useState<number | null>(null);
  const [paymentProof, setPaymentProof] = useState<PaymentProof | null>(null);

  // Cheque fields
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [chequeBankName, setChequeBankName] = useState('');
  const [chequeStatus, setChequeStatus] = useState<'RECEIVED' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED'>('RECEIVED');

  // Schedule Configuration State
  const [scheduleType, setScheduleType] = useState<string>(contract?.paymentScheduleType || 'LUMP_SUM');
  const [updatingSchedule, setUpdatingSchedule] = useState(false);

  // Proof Lightbox Preview
  const [lightboxProofUrl, setLightboxProofUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPaymentAccounts();
      if (contract) {
        setScheduleType(contract.paymentScheduleType || 'LUMP_SUM');
        const remaining = Math.max(0, (contract.financials?.finalAmount || 0) - (contract.financials?.paidAmount || 0));
        setPaymentAmount(remaining > 0 ? remaining.toString() : '');
      }
    }
  }, [isOpen, contract]);

  async function loadPaymentAccounts() {
    setLoadingAccounts(true);
    try {
      const accs = await apiClient.listPaymentAccounts({ active: true });
      setAccounts(accs || []);
      // Pre-select default or first account
      if (accs && accs.length > 0) {
        const def = accs.find((a) => a.isDefault) || accs[0];
        setSelectedAccountId(def.id || (def as any)._id);
      }
    } catch (err: any) {
      console.error('Failed to load payment accounts:', err);
    } finally {
      setLoadingAccounts(false);
    }
  }

  if (!isOpen || !contract) return null;

  const totalAmount = contract.financials?.finalAmount || 0;
  const paidAmount = contract.financials?.paidAmount || 0;
  const outstandingBalance = Math.max(0, totalAmount - paidAmount);
  const installments = contract.installments || [];
  const paymentRecords = contract.paymentRecords || [];

  // Filter accounts based on method
  const matchingAccounts = accounts.filter((acc) => {
    if (paymentMethod === 'UPI' || paymentMethod === 'QR_CODE') {
      return acc.type === 'UPI';
    }
    if (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHEQUE') {
      return acc.type === 'BANK';
    }
    return true; // Cash or fallback
  });

  const selectedAccount = accounts.find((a) => (a.id || (a as any)._id) === selectedAccountId);

  function handleSelectMilestoneForPayment(inst: any, index: number) {
    setSelectedInstallmentIndex(index);
    setPaymentAmount(inst.amount.toString());
    setActiveTab('record');
  }

  async function handleScheduleChange(newSchedule: string) {
    try {
      setUpdatingSchedule(true);
      setErrorMsg(null);
      const res: any = await apiClient.patch(`/amc/contracts/${contract._id}/payment`, {
        paymentScheduleType: newSchedule,
      });
      setScheduleType(newSchedule);
      setSuccessMsg(`Payment schedule updated to ${newSchedule.replace('_', ' ')}!`);
      if (onPaymentSuccess) {
        onPaymentSuccess(res.data || res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update payment schedule');
    } finally {
      setUpdatingSchedule(false);
    }
  }

  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        isNewPaymentRecord: true,
        paidAmount: amountNum,
        paidAt: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
        paymentMethod,
        paymentAccountId: selectedAccountId || undefined,
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined,
        proof: paymentProof || undefined,
      };

      if (selectedInstallmentIndex !== null && selectedInstallmentIndex !== undefined) {
        payload.installmentIndex = selectedInstallmentIndex;
      }

      if (paymentMethod === 'CHEQUE') {
        payload.chequeDetails = {
          chequeNumber,
          chequeDate,
          bankName: chequeBankName,
          status: chequeStatus,
        };
      }

      const res: any = await apiClient.patch(`/amc/contracts/${contract._id}/payment`, payload);
      setSuccessMsg(`Payment of ₹${amountNum.toLocaleString('en-IN')} recorded successfully!`);

      // Reset form
      setPaymentProof(null);
      setReferenceNumber('');
      setNotes('');
      setSelectedInstallmentIndex(null);

      if (onPaymentSuccess) {
        onPaymentSuccess(res.data || res);
      }

      setTimeout(() => {
        setSuccessMsg(null);
        setActiveTab('milestones');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-app border border-border-app rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border-app flex justify-between items-start bg-surface-2-app/50">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary-700/10 text-primary-700 rounded-xl">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-text-primary">
                  Manage Contract Payments
                </h3>
                <p className="text-xs text-text-secondary font-medium">
                  Contract #{contract.contractNumber} • {contract.customerId?.name || 'Customer'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-2-app rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial KPI Banner */}
        <div className="grid grid-cols-3 divide-x divide-border-app bg-surface-app border-b border-border-app text-center py-3 px-4">
          <div>
            <span className="text-[11px] font-bold text-text-secondary uppercase">Total Contract Value</span>
            <p className="text-sm font-black text-text-primary mt-0.5">
              ₹ {totalAmount.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-600 uppercase">Paid Amount</span>
            <p className="text-sm font-black text-emerald-600 mt-0.5">
              ₹ {paidAmount.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-rose-600 uppercase">Outstanding Balance</span>
            <p className="text-sm font-black text-rose-600 mt-0.5">
              ₹ {outstandingBalance.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border-app bg-surface-2-app/30 px-5 pt-2 gap-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('record')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 cursor-pointer transition ${
              activeTab === 'record'
                ? 'border-primary-700 text-primary-700'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Record Payment Receipt
          </button>
          <button
            onClick={() => setActiveTab('milestones')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 cursor-pointer transition ${
              activeTab === 'milestones'
                ? 'border-primary-700 text-primary-700'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Payment Milestones ({installments.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 cursor-pointer transition ${
              activeTab === 'history'
                ? 'border-primary-700 text-primary-700'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Clock className="w-4 h-4" />
            Payment Receipts History ({paymentRecords.length})
          </button>
        </div>

        {/* Alerts Banner */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: RECORD PAYMENT FORM */}
          {activeTab === 'record' && (
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              {/* Linked Milestone Notice if chosen */}
              {selectedInstallmentIndex !== null && installments[selectedInstallmentIndex] && (
                <div className="p-3 bg-primary-700/10 border border-primary-700/20 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-primary-700">Recording for Milestone:</span>{' '}
                    <span className="text-text-primary font-semibold">
                      {installments[selectedInstallmentIndex].title} (Due:{' '}
                      {new Date(installments[selectedInstallmentIndex].dueDate).toLocaleDateString('en-IN')})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedInstallmentIndex(null)}
                    className="text-text-secondary hover:text-text-primary font-bold cursor-pointer underline"
                  >
                    Clear Milestone Link
                  </button>
                </div>
              )}

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-secondary text-xs font-bold mb-1">
                    Payment Amount (₹) <span className="text-danger-app">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-text-secondary">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={outstandingBalance > 0 ? outstandingBalance : 9999999}
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full pl-7 pr-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-sm font-black text-text-primary focus:outline-none focus:border-primary-700"
                    />
                  </div>
                  {outstandingBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(outstandingBalance.toString())}
                      className="text-[10.5px] text-primary-700 font-bold hover:underline mt-1 cursor-pointer inline-block"
                    >
                      Fill Full Balance Due (₹{outstandingBalance.toLocaleString('en-IN')})
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-text-secondary text-xs font-bold mb-1">
                    Payment Date <span className="text-danger-app">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-xs font-bold text-text-primary focus:outline-none focus:border-primary-700"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-text-secondary text-xs font-bold mb-1.5">
                  Payment Method <span className="text-danger-app">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'UPI', label: 'UPI / GPay' },
                    { id: 'QR_CODE', label: 'Scan QR' },
                    { id: 'BANK_TRANSFER', label: 'NEFT / IMPS' },
                    { id: 'CHEQUE', label: 'Cheque' },
                    { id: 'CASH', label: 'Cash' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                        paymentMethod === m.id
                          ? 'bg-primary-700 text-white border-primary-700 shadow-xs'
                          : 'bg-surface-2-app border-border-app text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Receiving Destination Account */}
              {paymentMethod !== 'CASH' && (
                <div className="p-3.5 bg-surface-2-app/40 rounded-xl border border-border-app space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-text-secondary">
                      {paymentMethod === 'CHEQUE' ? 'Deposit Into Bank Account' : 'Receiving Payment Account'}{' '}
                      <span className="text-danger-app">*</span>
                    </label>
                    <Link
                      href="/dashboard/settings/payment-accounts"
                      target="_blank"
                      className="text-[11px] text-primary-700 hover:underline font-bold"
                    >
                      + Manage Accounts
                    </Link>
                  </div>

                  {matchingAccounts.length === 0 ? (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs rounded-xl font-medium">
                      No active {paymentMethod === 'UPI' || paymentMethod === 'QR_CODE' ? 'UPI' : 'Bank'} accounts configured. Please add one in{' '}
                      <Link href="/dashboard/settings/payment-accounts" target="_blank" className="underline font-bold">
                        Settings &rarr; Payment Accounts
                      </Link>.
                    </div>
                  ) : (
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-xl text-xs font-bold text-text-primary focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Select Receiving Account --</option>
                      {matchingAccounts.map((acc) => (
                        <option key={acc.id || (acc as any)._id} value={acc.id || (acc as any)._id}>
                          {acc.displayName || acc.name} {acc.maskedAccountNumber ? `(${acc.maskedAccountNumber})` : ''} {acc.upiId ? `(${acc.upiId})` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* QR Preview if QR_CODE selected */}
                  {paymentMethod === 'QR_CODE' && selectedAccount?.qrAssetUrl && (
                    <div className="p-3 bg-white rounded-xl border border-border-app flex flex-col items-center space-y-2">
                      <p className="text-[10.5px] font-bold text-gray-700 uppercase">Customer Scan QR</p>
                      <img
                        src={selectedAccount.qrAssetUrl}
                        alt="UPI QR Code"
                        className="w-36 h-36 object-contain rounded-lg border border-gray-200 shadow-xs"
                      />
                      <p className="text-xs font-mono font-bold text-gray-800">{selectedAccount.upiId}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Cheque Specific Fields */}
              {paymentMethod === 'CHEQUE' && (
                <div className="p-3.5 bg-surface-2-app/40 rounded-xl border border-border-app space-y-3 text-xs">
                  <span className="font-black text-text-primary uppercase tracking-wider block text-[11px]">
                    Cheque Processing Details
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-text-secondary font-bold mb-1">
                        Cheque Number <span className="text-danger-app">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 000451"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-xl text-xs font-mono font-bold text-text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-text-secondary font-bold mb-1">Cheque Date</label>
                      <input
                        type="date"
                        value={chequeDate}
                        onChange={(e) => setChequeDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-text-secondary font-bold mb-1">Issuing Bank</label>
                      <input
                        type="text"
                        placeholder="e.g. State Bank of India"
                        value={chequeBankName}
                        onChange={(e) => setChequeBankName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-xl text-xs text-text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-text-secondary font-bold mb-1">Status</label>
                      <select
                        value={chequeStatus}
                        onChange={(e) => setChequeStatus(e.target.value as any)}
                        className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-xl text-xs font-bold text-text-primary focus:outline-none cursor-pointer"
                      >
                        <option value="RECEIVED">RECEIVED (In Hand)</option>
                        <option value="DEPOSITED">DEPOSITED</option>
                        <option value="CLEARED">CLEARED</option>
                        <option value="BOUNCED">BOUNCED</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Reference / UTR Number for Digital Transfers */}
              {(paymentMethod === 'UPI' || paymentMethod === 'QR_CODE' || paymentMethod === 'BANK_TRANSFER') && (
                <div>
                  <label className="block text-text-secondary text-xs font-bold mb-1">
                    Transaction Reference / UTR # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 12-digit UPI UTR or Bank Transaction ID"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-xs font-mono text-text-primary focus:outline-none focus:border-primary-700"
                  />
                </div>
              )}

              {/* Payment Proof Uploader */}
              <div className="pt-1">
                <PaymentProofUploader
                  proof={paymentProof}
                  onProofChange={setPaymentProof}
                  invoiceId={contract._id}
                  metadata={{
                    invoiceNumber: contract.contractNumber,
                    amountMinor: Math.round(parseFloat(paymentAmount || '0') * 100),
                    method: paymentMethod,
                    customerName: contract.customerId?.name,
                  }}
                />
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-text-secondary text-xs font-bold mb-1">
                  Notes / Payment Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 1st installment paid via PhonePe by customer manager"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-xs text-text-primary focus:outline-none focus:border-primary-700"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end gap-3 border-t border-border-app">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-border-app rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface-2-app transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Save Payment Record
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: MILESTONES & SCHEDULE */}
          {activeTab === 'milestones' && (
            <div className="space-y-4">
              {/* Schedule Type Selector */}
              <div className="p-4 bg-surface-2-app/50 border border-border-app rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-text-secondary uppercase text-[11px]">Active Payment Schedule</span>
                  <p className="text-xs font-black text-text-primary mt-0.5">
                    {scheduleType.replace('_', ' ')} Schedule
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary font-bold">Change:</span>
                  <select
                    value={scheduleType}
                    disabled={updatingSchedule}
                    onChange={(e) => handleScheduleChange(e.target.value)}
                    className="bg-surface-app border border-border-app rounded-xl px-2.5 py-1.5 text-xs font-bold text-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="LUMP_SUM">Lump Sum (100% Advance)</option>
                    <option value="HALF_YEARLY">Half-Yearly (2 Milestones: 50% / 50%)</option>
                    <option value="QUARTERLY">Quarterly (4 Milestones: 25% each)</option>
                    <option value="CUSTOM">Custom Schedule</option>
                  </select>
                </div>
              </div>

              {/* Milestones Table */}
              <div className="border border-border-app rounded-2xl overflow-hidden bg-surface-app">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2-app border-b border-border-app text-text-secondary uppercase font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Milestone Title</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-app">
                    {installments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-text-secondary">
                          No payment milestone installments generated for this contract yet. Select a schedule above to generate milestones.
                        </td>
                      </tr>
                    ) : (
                      installments.map((inst: any, idx: number) => {
                        const isOverdue =
                          inst.status === 'OVERDUE' ||
                          (inst.status !== 'PAID' && new Date(inst.dueDate) < new Date());

                        return (
                          <tr key={idx} className="hover:bg-surface-2-app/40 transition">
                            <td className="py-3 px-4 font-mono font-bold text-text-secondary">
                              #{inst.installmentNumber || idx + 1}
                            </td>
                            <td className="py-3 px-4 font-bold text-text-primary">
                              {inst.title}
                            </td>
                            <td className="py-3 px-4 text-text-secondary">
                              <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
                                {new Date(inst.dueDate).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-black text-text-primary">
                              ₹ {(inst.amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  inst.status === 'PAID'
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                    : isOverdue
                                    ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                                    : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                }`}
                              >
                                {inst.status === 'PAID' ? 'PAID' : isOverdue ? 'OVERDUE' : 'PENDING'}
                              </span>
                              {inst.paidAt && (
                                <span className="block text-[9.5px] text-text-secondary mt-0.5">
                                  Paid {new Date(inst.paidAt).toLocaleDateString('en-IN')}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {inst.status !== 'PAID' ? (
                                <button
                                  type="button"
                                  onClick={() => handleSelectMilestoneForPayment(inst, idx)}
                                  className="px-3 py-1 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs inline-flex items-center gap-1"
                                >
                                  <span>Pay Milestone</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className="text-[11px] font-bold text-emerald-600 flex items-center justify-end gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PAYMENT RECEIPTS HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {paymentRecords.length === 0 ? (
                <div className="py-12 text-center text-text-secondary bg-surface-2-app/30 border border-border-app rounded-2xl space-y-2">
                  <CreditCard className="w-8 h-8 mx-auto text-text-secondary opacity-40" />
                  <p className="text-xs font-bold text-text-primary">No payment receipts recorded yet</p>
                  <p className="text-[11px] text-text-secondary">
                    Click the &quot;Record Payment Receipt&quot; tab to log customer advance or milestone payments.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentRecords.map((record: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 bg-surface-app border border-border-app rounded-2xl hover:border-border-app/80 transition space-y-2.5 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            {record.method || 'PAYMENT'}
                          </span>
                          <span className="text-sm font-black text-text-primary">
                            ₹ {(record.amount || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <span className="text-xs text-text-secondary font-medium">
                          {new Date(record.paidAt || record.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Account details and transaction references */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-surface-2-app/40 p-2.5 rounded-xl text-text-secondary">
                        <div>
                          <span className="font-bold text-text-primary">Destination Account:</span>{' '}
                          {record.paymentAccountSnapshot?.displayName ||
                            record.paymentAccountSnapshot?.name ||
                            'Primary Account'}
                          {record.paymentAccountSnapshot?.maskedAccountNumber && (
                            <span className="font-mono ml-1">
                              ({record.paymentAccountSnapshot.maskedAccountNumber})
                            </span>
                          )}
                        </div>

                        {record.referenceNumber && (
                          <div>
                            <span className="font-bold text-text-primary">Ref / UTR #:</span>{' '}
                            <span className="font-mono text-text-primary font-bold">{record.referenceNumber}</span>
                          </div>
                        )}

                        {record.chequeDetails && (
                          <div className="col-span-full">
                            <span className="font-bold text-text-primary">Cheque:</span>{' '}
                            <span className="font-mono">#{record.chequeDetails.chequeNumber}</span> (
                            {record.chequeDetails.bankName || 'Bank'}, Status:{' '}
                            <span className="font-bold text-primary-700">{record.chequeDetails.status}</span>)
                          </div>
                        )}
                      </div>

                      {record.notes && (
                        <p className="text-xs text-text-secondary italic">
                          &quot;{record.notes}&quot;
                        </p>
                      )}

                      {/* Attached Proof Button */}
                      {record.proof?.secureUrl && (
                        <div className="pt-1 flex items-center justify-between border-t border-border-app">
                          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Proof Attached
                          </span>
                          <button
                            type="button"
                            onClick={() => setLightboxProofUrl(record.proof.secureUrl)}
                            className="px-2.5 py-1 bg-surface-2-app hover:bg-border-app rounded-lg text-xs font-bold text-text-primary transition cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-primary-700" />
                            View Attached Proof
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Preview Modal for Payment Proof */}
      {lightboxProofUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative max-w-2xl w-full bg-surface-app border border-border-app rounded-2xl overflow-hidden shadow-2xl p-4">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-border-app">
              <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">
                Payment Proof Preview
              </h4>
              <button
                onClick={() => setLightboxProofUrl(null)}
                className="p-1 hover:bg-surface-2-app rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
            <div className="flex justify-center items-center max-h-[70vh] overflow-auto">
              <img
                src={lightboxProofUrl}
                alt="Payment Proof"
                className="max-h-[65vh] object-contain rounded-xl shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
