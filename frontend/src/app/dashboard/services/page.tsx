'use client';

import { useEffect, useState } from 'react';
import { useDashboard } from '../layout';
import { apiClient } from '../../../lib/api/client';
import { Product } from '../../../lib/api/types';

const COMMON_UOMS = ['JOB', 'NOS', 'PCS', 'HOUR', 'DAY', 'KG', 'SET', 'UNIT'];

export default function ServicesPage() {
  const { activeBusinessId } = useDashboard();
  const [products, setProducts] = useState<Product[]>([]);
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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State (we translate price between float Rupees and integer Paise/Minor units)
  const [form, setForm] = useState({
    type: 'SERVICE' as 'SERVICE' | 'PRODUCT',
    name: '',
    description: '',
    uom: 'JOB',
    customUom: '',
    priceFloat: '',
    defaultTaxRateBps: '0',
  });

  async function loadProducts(targetPage = 1) {
    if (!activeBusinessId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiClient.listProducts({
        page: targetPage,
        limit: 10,
        search: search.trim(),
        active: true,
      });
      setProducts(data.products);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.pages);
      setTotalItems(data.pagination.total);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load products/services list');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts(1);
  }, [activeBusinessId, search]);

  function openCreateModal() {
    setForm({
      type: 'SERVICE',
      name: '',
      description: '',
      uom: 'JOB',
      customUom: '',
      priceFloat: '',
      defaultTaxRateBps: '0',
    });
    setModalMode('create');
    setEditingProduct(null);
    setModalOpen(true);
  }

  function openEditModal(p: Product) {
    const isCustomUom = !COMMON_UOMS.includes(p.uom);
    setForm({
      type: p.type,
      name: p.name || '',
      description: p.description || '',
      uom: isCustomUom ? 'CUSTOM' : p.uom,
      customUom: isCustomUom ? p.uom : '',
      priceFloat: (p.defaultPriceMinor / 100).toFixed(2),
      defaultTaxRateBps: p.defaultTaxRateBps.toString(),
    });
    setModalMode('edit');
    setEditingProduct(p);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBusinessId) return;
    setSubmitLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Convert UOM
    const uomValue = form.uom === 'CUSTOM' ? form.customUom.trim().toUpperCase() : form.uom;
    if (!uomValue) {
      setErrorMsg('Please specify a valid unit of measurement (UOM)');
      setSubmitLoading(false);
      return;
    }

    // Convert price to integer minor units (paise)
    const floatVal = parseFloat(form.priceFloat);
    if (isNaN(floatVal) || floatVal < 0) {
      setErrorMsg('Please specify a valid non-negative price amount');
      setSubmitLoading(false);
      return;
    }
    const defaultPriceMinor = Math.round(floatVal * 100);

    const payload = {
      type: form.type,
      name: form.name.trim(),
      description: form.description.trim() || null,
      uom: uomValue,
      defaultPriceMinor,
      currency: 'INR' as const,
      defaultTaxRateBps: parseInt(form.defaultTaxRateBps) || 0,
    };

    try {
      if (modalMode === 'create') {
        await apiClient.createProduct(payload);
        setSuccessMsg('Service created successfully');
      } else {
        if (!editingProduct) return;
        const productId = editingProduct.id || (editingProduct as any)._id;
        if (!productId) {
          setErrorMsg('Missing product identifier');
          setSubmitLoading(false);
          return;
        }
        await apiClient.updateProduct(productId, payload);
        setSuccessMsg('Service details updated successfully');
      }
      setModalOpen(false);
      loadProducts(page);
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!id) return;
    if (!confirm('Are you sure you want to deactivate this service? It will no longer appear in the active selection list.')) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.deactivateProduct(id);
      setSuccessMsg('Service deactivated successfully');
      loadProducts(page);
    } catch (err: any) {
      setErrorMsg(err.message || 'Deactivation failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Services Catalogue</h1>
          <p className="text-sm text-text-secondary mt-1">
            Configure reusable products and work services with default prices and tax rate thresholds.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold shadow-sm transition shrink-0 cursor-pointer"
        >
          + Add Service
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
            placeholder="Search services by name or description..."
            className="w-full pl-10 pr-4 py-2 bg-surface-2-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus placeholder:text-text-muted"
          />
          <span className="absolute left-3.5 top-2.5 text-text-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>
      </div>

      {/* Products/Services Table */}
      <div className="bg-surface-app border border-border-app rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
            <p className="text-sm text-text-secondary">Loading services list...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-base font-medium text-text-primary mb-2">No services found</p>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Add your first product or service by clicking the "+ Add Service" button to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2-app border-b border-border-app text-xs font-semibold text-text-muted uppercase tracking-wider">
                  <th className="py-3 px-6">Name / Description</th>
                  <th className="py-3 px-6">Type</th>
                  <th className="py-3 px-6">UOM</th>
                  <th className="py-3 px-6">Default Price (INR)</th>
                  <th className="py-3 px-6">Default Tax Rate</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-app text-sm">
                {products.map((p) => {
                  const pId = p.id || (p as any)._id;
                  return (
                    <tr key={pId} className="hover:bg-surface-2-app/30">
                      <td className="py-4 px-6">
                        <p className="font-medium text-text-primary">{p.name}</p>
                        {p.description && <p className="text-xs text-text-secondary mt-0.5">{p.description}</p>}
                      </td>
                      <td className="py-4 px-6 text-text-secondary">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.type === 'SERVICE' ? 'bg-primary-900/10 text-primary-700' : 'bg-success-soft text-success-app'}`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-text-secondary font-medium">{p.uom}</td>
                      <td className="py-4 px-6 text-text-primary font-bold">
                        ₹{(p.defaultPriceMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-text-secondary">
                        {p.defaultTaxRateBps > 0 ? `${(p.defaultTaxRateBps / 100).toFixed(1)}%` : '0% (Exempt)'}
                      </td>
                      <td className="py-4 px-6 text-right space-x-3">
                        <button
                          onClick={() => openEditModal(p)}
                          className="text-primary-700 hover:text-primary-800 text-xs font-bold cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeactivate(pId)}
                          className="text-danger-app hover:text-danger-app/80 text-xs font-bold cursor-pointer"
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="bg-surface-2-app border-t border-border-app px-6 py-4 flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              Showing page {page} of {totalPages} ({totalItems} total services)
            </span>
            <div className="flex space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => loadProducts(page - 1)}
                className="px-3 py-1 bg-surface-app border border-border-app hover:bg-surface-2-app text-xs rounded-lg text-text-secondary disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => loadProducts(page + 1)}
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
          <div className="bg-surface-app border border-border-app rounded-xl max-w-md w-full shadow-xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border-app pb-3">
              <h3 className="text-lg font-bold text-text-primary">
                {modalMode === 'create' ? 'Add Product / Service' : 'Edit Service details'}
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
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                >
                  <option value="SERVICE">SERVICE (Default)</option>
                  <option value="PRODUCT">PRODUCT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Catalogue Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. AC WATER SERVICE"
                  className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Item Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. AC water service for split unit"
                  className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    UOM (Unit) *
                  </label>
                  <select
                    value={form.uom}
                    onChange={(e) => setForm({ ...form, uom: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                  >
                    {COMMON_UOMS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="CUSTOM">CUSTOM...</option>
                  </select>
                </div>
                {form.uom === 'CUSTOM' && (
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                      Custom UOM Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.customUom}
                      onChange={(e) => setForm({ ...form, customUom: e.target.value })}
                      placeholder="e.g. BOX, CAN"
                      className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary uppercase"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Default Price (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.priceFloat}
                    onChange={(e) => setForm({ ...form, priceFloat: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Tax Rate (Bps)
                  </label>
                  <input
                    type="number"
                    value={form.defaultTaxRateBps}
                    onChange={(e) => setForm({ ...form, defaultTaxRateBps: e.target.value })}
                    placeholder="e.g. 18% is 1800"
                    className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                  />
                  <span className="text-[9px] text-text-secondary mt-1 block">1800 = 18%</span>
                </div>
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
                  {submitLoading ? 'Saving...' : 'Save Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
