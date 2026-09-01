import { useEffect, useState } from 'react';
import { apiClient } from '../../../../lib/api/client';
import { PaymentAccount, PaymentAccountType, Asset } from '../../../../lib/api/types';
import { Building2, Smartphone, Banknote, CreditCard, Plus } from 'lucide-react';

export default function PaymentAccountsManager() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null);

  // Form states
  const [formType, setFormType] = useState<PaymentAccountType>('BANK');
  const [formName, setFormName] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountHolderName, setFormAccountHolderName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formIfsc, setFormIfsc] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formUpiId, setFormUpiId] = useState('');
  const [formQrAssetId, setFormQrAssetId] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [accs, asts] = await Promise.all([
        apiClient.listPaymentAccounts(),
        apiClient.listAssets().catch(() => []),
      ]);
      setAccounts(accs || []);
      setAssets(asts || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed loading payment accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingAccount(null);
    setFormType('BANK');
    setFormName('');
    setFormDisplayName('');
    setFormBankName('');
    setFormAccountHolderName('');
    setFormAccountNumber('');
    setFormIfsc('');
    setFormBranch('');
    setFormUpiId('');
    setFormQrAssetId('');
    setFormIsDefault(false);
    setModalError(null);
    setIsModalOpen(true);
  }

  function openEditModal(acc: PaymentAccount) {
    setEditingAccount(acc);
    setFormType(acc.type);
    setFormName(acc.name || '');
    setFormDisplayName(acc.displayName || '');
    setFormBankName(acc.bankName || '');
    setFormAccountHolderName(acc.accountHolderName || '');
    setFormAccountNumber(acc.accountNumber || '');
    setFormIfsc(acc.ifsc || '');
    setFormBranch(acc.branch || '');
    setFormUpiId(acc.upiId || '');
    setFormQrAssetId(acc.qrAssetId || '');
    setFormIsDefault(acc.isDefault || false);
    setModalError(null);
    setIsModalOpen(true);
  }

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    setSubmitLoading(true);
    setModalError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: Partial<PaymentAccount> = {
        name: formName.trim(),
        displayName: formDisplayName.trim() || undefined,
        type: formType,
        isDefault: formIsDefault,
      };

      if (formType === 'BANK') {
        payload.bankName = formBankName.trim() || null;
        payload.accountHolderName = formAccountHolderName.trim() || null;
        payload.accountNumber = formAccountNumber.trim() || null;
        payload.ifsc = formIfsc.trim().toUpperCase() || null;
        payload.branch = formBranch.trim() || null;
      } else if (formType === 'UPI') {
        payload.upiId = formUpiId.trim() || null;
        payload.qrAssetId = formQrAssetId || null;
        if (formQrAssetId) {
          const selectedAsset = assets.find((a) => a.id === formQrAssetId || (a as any)._id === formQrAssetId);
          if (selectedAsset) {
            payload.qrAssetUrl = selectedAsset.secureUrl;
          }
        }
      }

      if (editingAccount) {
        await apiClient.updatePaymentAccount(editingAccount.id || (editingAccount as any)._id, payload);
        setSuccessMsg(`Payment account "${formName}" updated successfully!`);
      } else {
        await apiClient.createPaymentAccount(payload);
        setSuccessMsg(`Payment account "${formName}" created successfully!`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed saving payment account');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleToggleActive(acc: PaymentAccount) {
    const accId = acc.id || (acc as any)._id;
    setSubmitLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (acc.active) {
        if (!confirm(`Are you sure you want to deactivate "${acc.name}"? Inactive accounts cannot be used for new payments, but historical payments remain intact.`)) {
          setSubmitLoading(false);
          return;
        }
        await apiClient.deactivatePaymentAccount(accId);
        setSuccessMsg(`Account "${acc.name}" deactivated.`);
      } else {
        await apiClient.activatePaymentAccount(accId);
        setSuccessMsg(`Account "${acc.name}" activated.`);
      }
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed updating account status');
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Receiving Payment Accounts</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage Bank Accounts, UPI IDs, and Cash receiving channels used to record customer payments.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5 cursor-pointer self-start"
        >
          <span>+</span>
          <span>Add Payment Account</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-success-soft border border-success-app/20 text-success-app text-xs rounded-xl font-medium animate-pulse">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl font-medium">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="p-8 text-center bg-surface-app border border-border-app rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface-2-app flex items-center justify-center mx-auto text-primary-700">
            <CreditCard className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-text-primary">No Payment Accounts Created</h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Add your shop's Bank Accounts, UPI IDs, or Cash ledger to start recording verified customer payments.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-primary-700 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-primary-800 transition cursor-pointer"
          >
            Create Your First Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const accId = acc.id || (acc as any)._id;
            return (
              <div
                key={accId}
                className={`bg-surface-app border rounded-2xl p-5 shadow-sm space-y-3 transition flex flex-col justify-between ${
                  acc.active ? 'border-border-app' : 'border-border-app opacity-60 bg-surface-2-app/20'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-lg bg-surface-2-app border border-border-app text-primary-700">
                        {acc.type === 'BANK' && <Building2 className="w-4 h-4" />}
                        {acc.type === 'UPI' && <Smartphone className="w-4 h-4" />}
                        {acc.type === 'CASH' && <Banknote className="w-4 h-4" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-text-primary">{acc.name}</h3>
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{acc.type} ACCOUNT</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        acc.active
                          ? 'bg-success-soft text-success-app border border-success-app/20'
                          : 'bg-surface-2-app text-text-muted border border-border-app'
                      }`}
                    >
                      {acc.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  <div className="bg-surface-2-app/50 border border-border-app rounded-xl p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Display Label:</span>
                      <span className="font-semibold text-text-primary truncate max-w-[170px]">{acc.displayName}</span>
                    </div>
                    {acc.type === 'BANK' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Bank Name:</span>
                          <span className="font-semibold text-text-primary">{acc.bankName || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Account Number:</span>
                          <span className="font-mono font-bold text-text-primary">{acc.maskedAccountNumber || '-'}</span>
                        </div>
                        {acc.ifsc && (
                          <div className="flex justify-between">
                            <span className="text-text-muted">IFSC Code:</span>
                            <span className="font-mono font-semibold text-text-primary">{acc.ifsc}</span>
                          </div>
                        )}
                      </>
                    )}
                    {acc.type === 'UPI' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-text-muted">UPI ID:</span>
                          <span className="font-mono font-bold text-text-primary">{acc.upiId}</span>
                        </div>
                        {acc.qrAssetUrl && (
                          <div className="flex justify-between items-center pt-1 border-t border-border-light">
                            <span className="text-text-muted">QR Code:</span>
                            <img src={acc.qrAssetUrl} alt="QR Code" className="w-8 h-8 object-contain rounded border border-border-app" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-light text-xs font-semibold">
                  <button
                    onClick={() => openEditModal(acc)}
                    className="text-primary-700 hover:underline cursor-pointer"
                  >
                    Edit Details
                  </button>
                  <button
                    onClick={() => handleToggleActive(acc)}
                    disabled={submitLoading}
                    className={`cursor-pointer ${
                      acc.active ? 'text-danger-app hover:underline' : 'text-success-app hover:underline'
                    }`}
                  >
                    {acc.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Account Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-light pb-2">
              <h3 className="text-base font-bold text-text-primary">
                {editingAccount ? 'Edit Payment Account' : 'Add New Payment Account'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-primary font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-lg font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-secondary font-semibold mb-1">
                  Account Type <span className="text-danger-app">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['BANK', 'UPI', 'CASH'] as PaymentAccountType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={!!editingAccount}
                      onClick={() => setFormType(t)}
                      className={`py-2 px-3 rounded-xl font-bold border transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                        formType === t
                          ? 'bg-primary-700 text-white border-primary-700'
                          : 'bg-surface-2-app text-text-secondary border-border-app hover:bg-surface-app'
                      } ${editingAccount ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {t === 'BANK' && <Building2 className="w-4 h-4" />}
                      {t === 'UPI' && <Smartphone className="w-4 h-4" />}
                      {t === 'CASH' && <Banknote className="w-4 h-4" />}
                      <span>
                        {t === 'BANK' && 'Bank Account'}
                        {t === 'UPI' && 'UPI ID'}
                        {t === 'CASH' && 'Cash Ledger'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-text-secondary font-semibold mb-1">
                  Account Name / Nickname <span className="text-danger-app">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={formType === 'BANK' ? 'e.g. HDFC Main Current' : formType === 'UPI' ? 'e.g. Shop GPay UPI' : 'e.g. Cash Ledger'}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none font-semibold"
                />
              </div>

              {formType === 'BANK' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-text-secondary font-semibold mb-1">Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC Bank"
                        value={formBankName}
                        onChange={(e) => setFormBankName(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-text-secondary font-semibold mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Jay Ramji Enterprise"
                        value={formAccountHolderName}
                        onChange={(e) => setFormAccountHolderName(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-text-secondary font-semibold mb-1">Account Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 50200012345678"
                        value={formAccountNumber}
                        onChange={(e) => setFormAccountNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-text-secondary font-semibold mb-1">IFSC Code</label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC0001234"
                        value={formIfsc}
                        onChange={(e) => setFormIfsc(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-text-secondary font-semibold mb-1">Branch Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Mundra Branch"
                      value={formBranch}
                      onChange={(e) => setFormBranch(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none"
                    />
                  </div>
                </>
              )}

              {formType === 'UPI' && (
                <>
                  <div>
                    <label className="block text-text-secondary font-semibold mb-1">
                      UPI ID (VPA) <span className="text-danger-app">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. jayramji@okaxis or 9876543210@paytm"
                      value={formUpiId}
                      onChange={(e) => setFormUpiId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-text-secondary font-semibold mb-1">
                      Link QR Asset (Optional)
                    </label>
                    <select
                      value={formQrAssetId}
                      onChange={(e) => setFormQrAssetId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none cursor-pointer"
                    >
                      <option value="">No QR Asset Linked</option>
                      {assets.map((ast) => (
                        <option key={ast.id || (ast as any)._id} value={ast.id || (ast as any)._id}>
                          {ast.type} - {ast.format?.toUpperCase()} ({new Date(ast.createdAt).toLocaleDateString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-text-secondary font-semibold mb-1">
                  Custom Display Label (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-generated if left empty (e.g. HDFC Bank ••••5678)"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="defaultAccountCheckbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded border-border-app text-primary-700 focus:ring-primary-700 cursor-pointer"
                />
                <label htmlFor="defaultAccountCheckbox" className="text-text-primary font-semibold cursor-pointer">
                  Set as default receiving account
                </label>
              </div>

              <div className="flex space-x-3 pt-3 border-t border-border-app">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {submitLoading ? 'Saving...' : editingAccount ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
