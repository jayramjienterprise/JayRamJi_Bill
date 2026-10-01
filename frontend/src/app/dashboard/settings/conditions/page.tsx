'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDashboard } from '../../layout';
import { apiClient } from '../../../../lib/api/client';
import { ConditionPreset, ConditionCategory } from '../../../../lib/api/types';
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Copy,
  Check,
  ShieldCheck,
  Receipt,
  FileCheck,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';

export default function ConditionPresetsPage() {
  const { activeBusinessId } = useDashboard();

  const [conditions, setConditions] = useState<ConditionPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState<ConditionCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form inputs (strictly forced to UPPERCASE)
  const [formData, setFormData] = useState({
    title: '',
    text: '',
    category: 'ALL' as ConditionCategory,
    isDefault: false,
    active: true,
  });

  // Load Conditions
  const loadConditions = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res: any = await apiClient.get('/conditions');
      const list = res?.conditions || res?.data?.conditions || (Array.isArray(res) ? res : []);
      setConditions(list);
    } catch (err: any) {
      console.error('Failed to load conditions:', err);
      setErrorMsg(err.message || 'Failed to load condition presets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeBusinessId) {
      loadConditions();
    }
  }, [activeBusinessId]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      title: '',
      text: '',
      category: selectedCategory === 'ALL' ? 'GENERAL' : selectedCategory,
      isDefault: false,
      active: true,
    });
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (cond: ConditionPreset) => {
    setEditingId(cond._id || cond.id || '');
    setFormData({
      title: cond.title.toUpperCase(),
      text: cond.text.toUpperCase(),
      category: cond.category || 'ALL',
      isDefault: Boolean(cond.isDefault),
      active: cond.active !== undefined ? cond.active : true,
    });
    setModalOpen(true);
  };

  // Save (Create or Update)
  const handleSaveCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.text.trim()) {
      setErrorMsg('Please enter both title and condition text');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      const payload = {
        title: formData.title.toUpperCase().trim(),
        text: formData.text.toUpperCase().trim(),
        category: formData.category,
        isDefault: formData.isDefault,
        active: formData.active,
      };

      if (editingId) {
        await apiClient.put(`/conditions/${editingId}`, payload);
        setSuccessMsg('Condition preset updated successfully!');
      } else {
        await apiClient.post('/conditions', payload);
        setSuccessMsg('New condition preset created successfully!');
      }

      setModalOpen(false);
      await loadConditions();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save condition preset');
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      setErrorMsg(null);
      await apiClient.delete(`/conditions/${id}`);
      setSuccessMsg('Condition preset deleted successfully!');
      await loadConditions();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete condition preset');
    }
  };

  // Copy text to clipboard
  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered conditions
  const filteredConditions = conditions.filter((c) => {
    const matchCategory =
      selectedCategory === 'ALL' || c.category === 'ALL' || c.category === selectedCategory;
    const matchQuery =
      !searchQuery.trim() ||
      c.title.toUpperCase().includes(searchQuery.toUpperCase()) ||
      c.text.toUpperCase().includes(searchQuery.toUpperCase());
    return matchCategory && matchQuery;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-app border border-border-app p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/settings"
              className="p-2 bg-surface-2-app hover:bg-border-app rounded-xl text-text-secondary transition"
              title="Back to Settings"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <FileCheck className="w-6 h-6 text-primary-700" />
                <h1 className="text-xl font-black tracking-tight text-text-primary uppercase">
                  Condition Menu &amp; Presets
                </h1>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Manage predefined terms and conditions for Quotations, Invoices, and AMC Contracts.
                All conditions are strictly saved and displayed in <strong>CAPITAL LETTERS</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Condition</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-success-soft border border-success-app/20 text-success-app text-xs rounded-xl flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-surface-app border border-border-app p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Conditions' },
              { id: 'GENERAL', label: 'Quotations / Estimates' },
              { id: 'AMC', label: 'AMC Contracts' },
              { id: 'INVOICE', label: 'Invoices / Bills' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedCategory === tab.id
                    ? 'bg-primary-700 text-white shadow-xs'
                    : 'bg-surface-2-app text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              placeholder="SEARCH CONDITIONS..."
              className="w-full bg-surface-2-app border border-border-app rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-text-primary focus:outline-none uppercase"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-text-secondary hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conditions Grid / List */}
      {loading ? (
        <div className="p-12 text-center text-text-secondary text-xs">
          Loading condition presets...
        </div>
      ) : filteredConditions.length === 0 ? (
        <div className="bg-surface-app border border-border-app rounded-2xl p-10 text-center space-y-3">
          <FileText className="w-10 h-10 text-text-secondary mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-text-primary uppercase">No conditions found</h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            {searchQuery
              ? 'No condition matches your search query. Try clearing the search or adding a new condition.'
              : 'Click "Add New Condition" to create reusable conditions for your quotations and bills.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Condition</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredConditions.map((cond) => {
            const id = cond._id || cond.id || '';
            const categoryBadgeColor =
              cond.category === 'AMC'
                ? 'bg-blue-100 text-blue-800 border-blue-200'
                : cond.category === 'GENERAL'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : cond.category === 'INVOICE'
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-purple-100 text-purple-800 border-purple-200';

            return (
              <div
                key={id}
                className="bg-surface-app border border-border-app p-4 rounded-2xl shadow-xs hover:border-primary-500/40 transition flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${categoryBadgeColor}`}
                    >
                      {cond.category === 'ALL'
                        ? 'ALL DOCUMENTS'
                        : cond.category === 'GENERAL'
                        ? 'QUOTATION'
                        : cond.category === 'AMC'
                        ? 'AMC CONTRACT'
                        : 'TAX INVOICE'}
                    </span>
                    {cond.isDefault && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-primary-50 text-primary-700 border border-primary-200 uppercase">
                        DEFAULT
                      </span>
                    )}
                  </div>

                  <h3 className="text-xs font-black text-text-primary tracking-wide uppercase">
                    {cond.title}
                  </h3>

                  <p className="text-xs text-text-secondary leading-relaxed bg-surface-2-app p-3 rounded-xl border border-border-app/50 font-medium uppercase select-all">
                    {cond.text}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-app/60 text-xs">
                  <button
                    type="button"
                    onClick={() => handleCopyText(id, cond.text)}
                    className="text-text-secondary hover:text-text-primary text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>COPY</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(cond)}
                      className="p-1.5 text-text-secondary hover:text-primary-700 hover:bg-surface-2-app rounded-lg cursor-pointer transition"
                      title="Edit Condition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(id, cond.title)}
                      className="p-1.5 text-text-secondary hover:text-danger-app hover:bg-danger-soft rounded-lg cursor-pointer transition"
                      title="Delete Condition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-border-app bg-surface-2-app">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary-700" />
                <h3 className="text-sm font-black text-text-primary uppercase tracking-wide">
                  {editingId ? 'Edit Condition Preset' : 'Create New Condition'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCondition} className="p-5 space-y-4">
              <div className="p-3 bg-primary-50/70 border border-primary-100 rounded-xl text-[11px] text-primary-900 font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-700 shrink-0" />
                <span>
                  CAPITAL LETTERS ONLY: Typing in these inputs automatically converts to UPPERCASE for all previews, PDFs, and invoices.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  CONDITION TITLE (UPPERCASE) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value.toUpperCase() })}
                  placeholder="E.G. VALIDITY 30 DAYS"
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-bold uppercase focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  CONDITION TEXT / CLAUSE (UPPERCASE) *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value.toUpperCase() })}
                  placeholder="E.G. THIS QUOTATION IS VALID FOR 30 DAYS FROM ISSUANCE DATE."
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium uppercase leading-relaxed focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    APPLIES TO CATEGORY
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-bold focus:outline-none uppercase"
                  >
                    <option value="ALL">ALL DOCUMENTS</option>
                    <option value="GENERAL">QUOTATION / ESTIMATE</option>
                    <option value="AMC">AMC CONTRACT</option>
                    <option value="INVOICE">TAX INVOICE / BILL</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2.5 bg-surface-2-app border border-border-app rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="rounded border-border-app text-primary-700 focus:ring-0"
                    />
                    <span className="text-xs font-bold text-text-primary uppercase">
                      Default Condition
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-app">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-surface-2-app hover:bg-border-app text-text-secondary rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'SAVING...' : editingId ? 'UPDATE CONDITION' : 'SAVE CONDITION'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
