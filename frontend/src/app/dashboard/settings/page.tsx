'use client';

import { useEffect, useState } from 'react';
import { useDashboard } from '../layout';
import { apiClient } from '../../../lib/api/client';
import PaymentAccountsManager from './components/PaymentAccountsManager';

export default function SettingsPage() {
  const { activeBusinessId, refreshSession } = useDashboard();
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'PAYMENT_ACCOUNTS'>('PROFILE');
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [profile, setProfile] = useState({
    name: '',
    legalName: '',
    displayName: '',
    address: { line1: '', line2: '', city: '', state: '', postalCode: '', country: 'India' },
    contact: { phone: '', email: '', website: '' },
    timezone: 'Asia/Kolkata',
    taxProfile: { gstin: '', pan: '', taxRegistrationType: '' },
    bankDetails: { bankName: '', accountHolderName: '', accountNumber: '', ifsc: '', branch: '' },
  });

  const [invoiceDefaults, setInvoiceDefaults] = useState({
    invoiceTitle: 'TAX INVOICE',
    prefix: 'JRE',
    defaultCurrency: 'INR' as const,
    defaultPaymentTerms: '',
    defaultTaxMode: 'NONE' as const,
    defaultTaxRateBps: 0,
  });

  const [paymentDefaults, setPaymentDefaults] = useState({
    defaultPaymentStatus: 'UNPAID' as const,
  });

  async function fetchBusinessSettings() {
    if (!activeBusinessId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data: any = await apiClient.get('/business', {
        headers: { 'x-business-id': activeBusinessId },
      });
      const b = data.business;
      setProfile({
        name: b.name || '',
        legalName: b.legalName || '',
        displayName: b.displayName || '',
        address: {
          line1: b.address?.line1 || '',
          line2: b.address?.line2 || '',
          city: b.address?.city || '',
          state: b.address?.state || '',
          postalCode: b.address?.postalCode || '',
          country: b.address?.country || 'India',
        },
        contact: {
          phone: b.contact?.phone || '',
          email: b.contact?.email || '',
          website: b.contact?.website || '',
        },
        timezone: b.timezone || 'Asia/Kolkata',
        taxProfile: {
          gstin: b.taxProfile?.gstin || '',
          pan: b.taxProfile?.pan || '',
          taxRegistrationType: b.taxProfile?.taxRegistrationType || '',
        },
        bankDetails: {
          bankName: b.bankDetails?.bankName || '',
          accountHolderName: b.bankDetails?.accountHolderName || '',
          accountNumber: b.bankDetails?.accountNumber || '',
          ifsc: b.bankDetails?.ifsc || '',
          branch: b.bankDetails?.branch || '',
        },
      });

      setInvoiceDefaults({
        invoiceTitle: b.invoiceSettings?.invoiceTitle || 'TAX INVOICE',
        prefix: b.invoiceSettings?.prefix || 'JRE',
        defaultCurrency: b.invoiceSettings?.defaultCurrency || 'INR',
        defaultPaymentTerms: b.invoiceSettings?.defaultPaymentTerms || '',
        defaultTaxMode: b.invoiceSettings?.defaultTaxMode || 'NONE',
        defaultTaxRateBps: b.invoiceSettings?.defaultTaxRateBps || 0,
      });

      setPaymentDefaults({
        defaultPaymentStatus: b.paymentSettings?.defaultPaymentStatus || 'UNPAID',
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed loading settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBusinessSettings();
  }, [activeBusinessId]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBusinessId) return;
    setSubmitLoading('profile');
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await apiClient.patch('/business', profile, {
        headers: { 'x-business-id': activeBusinessId },
      });
      setSuccessMsg('Business Profile updated successfully!');
      refreshSession();
    } catch (err: any) {
      setErrorMsg(err.message || 'Profile update failed');
    } finally {
      setSubmitLoading(null);
    }
  }

  async function handleUpdateInvoiceDefaults(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBusinessId) return;
    setSubmitLoading('invoice');
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await apiClient.patch('/business/invoice-settings', invoiceDefaults, {
        headers: { 'x-business-id': activeBusinessId },
      });
      setSuccessMsg('Invoice Defaults updated successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Invoice defaults update failed');
    } finally {
      setSubmitLoading(null);
    }
  }

  async function handleUpdatePaymentDefaults(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBusinessId) return;
    setSubmitLoading('payment');
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await apiClient.patch('/business/payment-settings', paymentDefaults, {
        headers: { 'x-business-id': activeBusinessId },
      });
      setSuccessMsg('Payment Settings updated successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment settings update failed');
    } finally {
      setSubmitLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
        <p className="text-sm text-text-secondary">Loading business settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-light pb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Business Settings</h1>
          <p className="text-sm text-text-secondary mt-1">
            Configure business identity, invoices, prefixes, and receiving payment accounts.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-surface-2-app p-1 rounded-xl border border-border-app self-start">
          <button
            type="button"
            onClick={() => setActiveTab('PROFILE')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'PROFILE'
                ? 'bg-surface-app text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Business & Defaults
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PAYMENT_ACCOUNTS')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'PAYMENT_ACCOUNTS'
                ? 'bg-surface-app text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Payment Accounts
          </button>
        </div>
      </div>

      {activeTab === 'PAYMENT_ACCOUNTS' ? (
        <PaymentAccountsManager />
      ) : (
        <>
          {successMsg && (
            <div className="p-4 bg-success-soft border border-success-app/20 text-success-app text-sm rounded-lg font-medium">
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-sm rounded-lg font-medium">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Segment 1: General Business Profile */}
        <div className="lg:col-span-2 space-y-8">
          <form onSubmit={handleUpdateProfile} className="bg-surface-app border border-border-app rounded-xl p-6 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-text-primary border-b border-border-light pb-3">
              1. Business Profile Details
            </h2>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Registered Name
                </label>
                <input
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-4 border-t border-border-light pt-4">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wide">Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={profile.contact.phone}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        contact: { ...profile.contact, phone: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Email Address</label>
                  <input
                    type="email"
                    value={profile.contact.email}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        contact: { ...profile.contact, email: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wide">Workspace Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs text-text-secondary mb-1">Address Line 1 (Shop / Plot / Street)</label>
                  <input
                    type="text"
                    required
                    value={profile.address.line1}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        address: { ...profile.address, line1: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-text-secondary mb-1">Address Line 2 (Branch / Area / Landmark)</label>
                  <input
                    type="text"
                    placeholder="e.g. Mundra Branch, Baroi Road"
                    value={profile.address.line2}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        address: { ...profile.address, line2: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">City</label>
                  <input
                    type="text"
                    value={profile.address.city}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        address: { ...profile.address, city: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">State</label>
                  <input
                    type="text"
                    value={profile.address.state}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        address: { ...profile.address, state: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wide">Bank Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={profile.bankDetails.bankName}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        bankDetails: { ...profile.bankDetails, bankName: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Account Holder</label>
                  <input
                    type="text"
                    value={profile.bankDetails.accountHolderName}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        bankDetails: { ...profile.bankDetails, accountHolderName: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Account Number</label>
                  <input
                    type="text"
                    value={profile.bankDetails.accountNumber}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        bankDetails: { ...profile.bankDetails, accountNumber: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={profile.bankDetails.ifsc}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        bankDetails: { ...profile.bankDetails, ifsc: e.target.value.toUpperCase() },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Bank Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mundra Branch"
                    value={profile.bankDetails.branch}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        bankDetails: { ...profile.bankDetails, branch: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
              </div>
            </div>

            {/* Tax Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wide">Tax profile</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={profile.taxProfile.gstin}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        taxProfile: { ...profile.taxProfile, gstin: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">PAN</label>
                  <input
                    type="text"
                    value={profile.taxProfile.pan}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        taxProfile: { ...profile.taxProfile, pan: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitLoading === 'profile'}
              className="py-2 px-5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {submitLoading === 'profile' ? 'Saving Profile...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Segment 2: Invoice & Payment Defaults */}
        <div className="space-y-8">
          <form onSubmit={handleUpdateInvoiceDefaults} className="bg-surface-app border border-border-app rounded-xl p-6 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-text-primary border-b border-border-light pb-3">
              2. Invoice Defaults
            </h2>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Default Invoice Title
              </label>
              <input
                type="text"
                required
                value={invoiceDefaults.invoiceTitle}
                onChange={(e) =>
                  setInvoiceDefaults({ ...invoiceDefaults, invoiceTitle: e.target.value })
                }
                className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Sequence Prefix
              </label>
              <input
                type="text"
                required
                value={invoiceDefaults.prefix}
                onChange={(e) =>
                  setInvoiceDefaults({ ...invoiceDefaults, prefix: e.target.value })
                }
                className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Terms of Payment / Conditions
              </label>
              <textarea
                rows={3}
                value={invoiceDefaults.defaultPaymentTerms}
                onChange={(e) =>
                  setInvoiceDefaults({ ...invoiceDefaults, defaultPaymentTerms: e.target.value })
                }
                placeholder="e.g. 100% payment on delivery. Subject to local jurisdiction. Goods once sold will not be taken back."
                className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
              />
              <span className="text-[10px] text-text-secondary mt-1 block">
                Default terms printed at the bottom of every generated invoice and bill preview.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Tax Mode
              </label>
              <select
                value={invoiceDefaults.defaultTaxMode}
                onChange={(e) =>
                  setInvoiceDefaults({
                    ...invoiceDefaults,
                    defaultTaxMode: e.target.value as any,
                  })
                }
                className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
              >
                <option value="NONE">NONE (No Tax)</option>
                <option value="EXCLUSIVE">EXCLUSIVE (Add Tax on Subtotal)</option>
                <option value="INCLUSIVE">INCLUSIVE (Tax inclusive inside price)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Tax Rate (Basis Points)
              </label>
              <input
                type="number"
                value={invoiceDefaults.defaultTaxRateBps}
                onChange={(e) =>
                  setInvoiceDefaults({
                    ...invoiceDefaults,
                    defaultTaxRateBps: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="e.g. 18% is 1800"
                className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
              />
              <span className="text-[10px] text-text-secondary mt-1 block">
                1% = 100 Basis Points. (e.g., 1800 represents 18% CGST/SGST)
              </span>
            </div>

            <button
              type="submit"
              disabled={submitLoading === 'invoice'}
              className="w-full py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {submitLoading === 'invoice' ? 'Saving Invoice Settings...' : 'Save Invoice Settings'}
            </button>
          </form>

          <form onSubmit={handleUpdatePaymentDefaults} className="bg-surface-app border border-border-app rounded-xl p-6 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-text-primary border-b border-border-light pb-3">
              3. Payment Settings
            </h2>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Default Status
              </label>
              <select
                value={paymentDefaults.defaultPaymentStatus}
                onChange={(e) =>
                  setPaymentDefaults({
                    ...paymentDefaults,
                    defaultPaymentStatus: e.target.value as any,
                  })
                }
                className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
              >
                <option value="UNPAID">UNPAID</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitLoading === 'payment'}
              className="w-full py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {submitLoading === 'payment' ? 'Saving Payment Settings...' : 'Save Payment Settings'}
            </button>
          </form>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
