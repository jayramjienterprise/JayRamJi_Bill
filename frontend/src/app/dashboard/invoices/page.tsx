'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDashboard } from '../layout';
import { apiClient } from '../../../lib/api/client';
import { Invoice } from '../../../lib/api/types';

export default function InvoicesPage() {
  const { activeBusinessId } = useDashboard();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  async function loadInvoices(targetPage = 1) {
    if (!activeBusinessId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiClient.listInvoices({
        page: targetPage,
        limit: 10,
        status: statusFilter || undefined,
      });
      setInvoices(data.invoices);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.pages);
      setTotalItems(data.pagination.total);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load invoices list');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices(1);
  }, [activeBusinessId, statusFilter]);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this draft invoice? This action is permanent.')) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient.deleteInvoiceDraft(id);
      setSuccessMsg('Draft invoice deleted successfully');
      loadInvoices(page);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete draft invoice');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Invoices Registry</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your billing documents, track draft stages, and review computed totals.
          </p>
        </div>
        <Link
          href="/dashboard/invoices/create"
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold shadow-sm transition shrink-0 text-center cursor-pointer"
        >
          + Create Invoice
        </Link>
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

      {/* Filter and Status controls */}
      <div className="bg-surface-app border border-border-app p-4 rounded-xl shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-text-secondary uppercase">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none cursor-pointer"
          >
            <option value="">All Invoices</option>
            <option value="DRAFT">DRAFT</option>
            <option value="FINALIZED">FINALIZED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-surface-app border border-border-app rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
            <p className="text-sm text-text-secondary">Loading invoices registry...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-base font-medium text-text-primary mb-2">No invoices found</p>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Draft your first invoice by clicking the "+ Create Invoice" button above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2-app border-b border-border-app text-xs font-semibold text-text-muted uppercase tracking-wider">
                  <th className="py-3 px-6">Invoice ID / Date</th>
                  <th className="py-3 px-6">Customer</th>
                  <th className="py-3 px-6">Grand Total</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-app text-sm">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-2-app/30">
                    <td className="py-4 px-6">
                      <p className="font-semibold text-text-primary">#{inv.id.slice(-6).toUpperCase()}</p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        📅 {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="py-4 px-6 text-text-primary font-medium">
                      {/* Customer reference - snapshot is checked if finalized, otherwise we fetch from referenced metadata */}
                      {inv.customerId ? (
                        <span>Referenced Customer</span>
                      ) : (
                        <span className="text-text-muted italic">No customer linked</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-text-primary font-bold">
                      ₹{(inv.totals.grandTotalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        inv.status === 'DRAFT'
                          ? 'bg-warning-soft text-warning-app'
                          : inv.status === 'FINALIZED'
                          ? 'bg-success-soft text-success-app'
                          : 'bg-danger-soft text-danger-app'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-3">
                      {inv.status === 'DRAFT' ? (
                        <>
                          <Link
                            href={`/dashboard/invoices/edit/${inv.id}`}
                            className="text-primary-700 hover:text-primary-800 text-xs font-bold cursor-pointer"
                          >
                            Edit Draft
                          </Link>
                          <button
                            onClick={() => handleDelete(inv.id)}
                            className="text-danger-app hover:text-danger-app/80 text-xs font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-text-muted">Finalized copy</span>
                      )}
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
              Showing page {page} of {totalPages} ({totalItems} total documents)
            </span>
            <div className="flex space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => loadInvoices(page - 1)}
                className="px-3 py-1 bg-surface-app border border-border-app hover:bg-surface-2-app text-xs rounded-lg text-text-secondary disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => loadInvoices(page + 1)}
                className="px-3 py-1 bg-surface-app border border-border-app hover:bg-surface-2-app text-xs rounded-lg text-text-secondary disabled:opacity-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
