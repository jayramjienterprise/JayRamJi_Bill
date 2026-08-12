'use client';

import { useEffect, useState } from 'react';
import { useDashboard } from '../layout';
import { apiClient } from '../../../lib/api/client';
import { Customer } from '../../../lib/api/types';

export default function CustomersPage() {
  const { activeBusinessId } = useDashboard();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pagination & Filter States
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    gstin: '',
    pan: '',
    notes: '',
  });

  async function loadCustomers(targetPage = 1) {
    if (!activeBusinessId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiClient.listCustomers({
        page: targetPage,
        limit: 10,
        search: search.trim(),
        active: true,
      });
      setCustomers(data.customers);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.pages);
      setTotalItems(data.pagination.total);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load customers list');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers(1);
  }, [activeBusinessId, search]);

  function openCreateModal() {
    setForm({
      name: '',
      phone: '',
      email: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      gstin: '',
      pan: '',
      notes: '',
    });
    setModalMode('create');
    setEditingCustomer(null);
    setModalOpen(true);
  }

  function openEditModal(c: Customer) {
    setForm({
      name: c.name || '',
      phone: c.contact?.phone || '',
      email: c.contact?.email || '',
      line1: c.address?.line1 || '',
      line2: c.address?.line2 || '',
      city: c.address?.city || '',
      state: c.address?.state || '',
      postalCode: c.address?.postalCode || '',
      country: c.address?.country || 'India',
      gstin: c.taxProfile?.gstin || '',
      pan: c.taxProfile?.pan || '',
      notes: c.notes || '',
    });
    setModalMode('edit');
    setEditingCustomer(c);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBusinessId) return;
    setSubmitLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      name: form.name.trim(),
      contact: {
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      },
      address: {
        line1: form.line1.trim() || null,
        line2: form.line2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postalCode: form.postalCode.trim() || null,
        country: form.country,
      },
      taxProfile: {
        gstin: form.gstin.trim() || null,
        pan: form.pan.trim() || null,
      },
      notes: form.notes.trim() || null,
    };

    try {
      if (modalMode === 'create') {
        await apiClient.createCustomer(payload);
        setSuccessMsg('Customer created successfully');
      } else {
        if (!editingCustomer) return;
        await apiClient.updateCustomer(editingCustomer.id, payload);
        setSuccessMsg('Customer profile updated successfully');
      }
      setModalOpen(false);
      loadCustomers(page);
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Are you sure you want to deactivate this customer? They will not appear in the active list.')) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.deactivateCustomer(id);
      setSuccessMsg('Customer deactivated successfully');
      loadCustomers(page);
    } catch (err: any) {
      setErrorMsg(err.message || 'Deactivation failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Customers Directory</h1>
          <p className="text-sm text-text-secondary mt-1">
            Maintain customer profiles, billing addresses, and tax identifiers (GSTIN/PAN).
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold shadow-sm transition shrink-0 cursor-pointer"
        >
          + Add Customer
        </button>
      </div>

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

      {/* Filter and Search Bar */}
      <div className="bg-surface-app border border-border-app p-4 rounded-xl shadow-sm flex items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers by name, phone, or email..."
            className="w-full pl-10 pr-4 py-2 bg-surface-2-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus placeholder:text-text-muted"
          />
          <span className="absolute left-3.5 top-2.5 text-text-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>
      </div>

      {/* Customers Table / Card Lists */}
      <div className="bg-surface-app border border-border-app rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
            <p className="text-sm text-text-secondary">Loading customers directory...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-base font-medium text-text-primary mb-2">No customers found</p>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Add your first customer by clicking the "+ Add Customer" button to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2-app border-b border-border-app text-xs font-semibold text-text-muted uppercase tracking-wider">
                  <th className="py-3 px-6">Customer Name</th>
                  <th className="py-3 px-6">Contact Info</th>
                  <th className="py-3 px-6">Location</th>
                  <th className="py-3 px-6">Tax Identifiers</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-app text-sm">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2-app/30">
                    <td className="py-4 px-6 font-medium text-text-primary">{c.name}</td>
                    <td className="py-4 px-6 text-text-secondary space-y-0.5">
                      {c.contact?.phone && <p>📞 {c.contact.phone}</p>}
                      {c.contact?.email && <p>✉ {c.contact.email}</p>}
                      {!c.contact?.phone && !c.contact?.email && <span className="text-text-muted text-xs">No contact details</span>}
                    </td>
                    <td className="py-4 px-6 text-text-secondary">
                      {c.address?.city || c.address?.state ? (
                        <p>{[c.address.city, c.address.state].filter(Boolean).join(', ')}</p>
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-text-secondary space-y-0.5 text-xs">
                      {c.taxProfile?.gstin && <p><span className="font-semibold text-text-muted">GST:</span> {c.taxProfile.gstin}</p>}
                      {c.taxProfile?.pan && <p><span className="font-semibold text-text-muted">PAN:</span> {c.taxProfile.pan}</p>}
                      {!c.taxProfile?.gstin && !c.taxProfile?.pan && <span className="text-text-muted">-</span>}
                    </td>
                    <td className="py-4 px-6 text-right space-x-3">
                      <button
                        onClick={() => openEditModal(c)}
                        className="text-primary-700 hover:text-primary-800 text-xs font-bold cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeactivate(c.id)}
                        className="text-danger-app hover:text-danger-app/80 text-xs font-bold cursor-pointer"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="bg-surface-2-app border-t border-border-app px-6 py-4 flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              Showing page {page} of {totalPages} ({totalItems} total customers)
            </span>
            <div className="flex space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => loadCustomers(page - 1)}
                className="px-3 py-1 bg-surface-app border border-border-app hover:bg-surface-2-app text-xs rounded-lg text-text-secondary disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => loadCustomers(page + 1)}
                className="px-3 py-1 bg-surface-app border border-border-app hover:bg-surface-2-app text-xs rounded-lg text-text-secondary disabled:opacity-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface-app border border-border-app rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border-app pb-3">
              <h3 className="text-lg font-bold text-text-primary">
                {modalMode === 'create' ? 'Create Customer Profile' : 'Edit Customer Profile'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-text-muted hover:text-text-primary text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Customer / Entity Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. AON ENGINEERS AND CONSULTANTS PVT. LTD."
                  className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="10-digit number"
                    className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wide border-b border-border-light pb-1">
                  Billing Address
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-text-secondary mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={form.line1}
                      onChange={(e) => setForm({ ...form, line1: e.target.value })}
                      placeholder="Street, Complex name, etc."
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">State</label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      placeholder="State"
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={form.postalCode}
                      onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                      placeholder="Pincode"
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Country</label>
                    <input
                      type="text"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wide border-b border-border-light pb-1">
                  Tax Registration Profile
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={form.gstin}
                      onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                      placeholder="15-character GSTIN"
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">PAN</label>
                    <input
                      type="text"
                      value={form.pan}
                      onChange={(e) => setForm({ ...form, pan: e.target.value })}
                      placeholder="10-character PAN"
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary uppercase"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Private Notes / Terms
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Billing comments, specialized details..."
                  className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  rows={2}
                />
              </div>

              <div className="flex justify-end space-x-3 border-t border-border-app pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-lg text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-5 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submitLoading ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
