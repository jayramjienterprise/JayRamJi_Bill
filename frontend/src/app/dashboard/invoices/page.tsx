'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDashboard } from '../layout';
import { apiClient } from '../../../lib/api/client';
import { Invoice } from '../../../lib/api/types';

export default function InvoicesPage() {
  const { activeBusinessId } = useDashboard();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter State
  const [searchVal, setSearchVal] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('invoiceDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [openDownloadId, setOpenDownloadId] = useState<string | null>(null);

  async function loadCustomers() {
    if (!activeBusinessId) return;
    try {
      const data = await apiClient.listCustomers({ limit: 100 });
      setCustomers(data.customers);
    } catch (_) {}
  }

  async function loadInvoices(targetPage = 1) {
    if (!activeBusinessId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiClient.listInvoices({
        page: targetPage,
        limit: 20,
        status: statusFilter || undefined,
        customerId: customerFilter || undefined,
        paymentStatus: paymentStatusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        search: searchVal.trim() || undefined,
        sortBy,
        sortOrder,
      });
      setInvoices(data.invoices);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.pages);
      setTotalItems(data.pagination.total);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load digital bill book');
    } finally {
      setLoading(false);
    }
  }

  // Load customer filter options on init
  useEffect(() => {
    loadCustomers();
  }, [activeBusinessId]);

  // Debounced execution for search text inputs and filter triggers
  useEffect(() => {
    const handler = setTimeout(() => {
      loadInvoices(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [
    searchVal,
    statusFilter,
    customerFilter,
    paymentStatusFilter,
    fromDate,
    toDate,
    sortBy,
    sortOrder,
    activeBusinessId,
  ]);

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

  function handleClearFilters() {
    setSearchVal('');
    setStatusFilter('');
    setPaymentStatusFilter('');
    setCustomerFilter('');
    setFromDate('');
    setToDate('');
    setSortBy('invoiceDate');
    setSortOrder('desc');
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Digital Bill Book</h1>
          <p className="text-sm text-text-secondary mt-1">
            Search, filter, and access historical finalized invoices, original snapshots, and PDF copies.
          </p>
        </div>
        <Link
          href="/dashboard/invoices/create"
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold shadow-sm transition text-center cursor-pointer"
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

      {/* Bill Book Controls Panel */}
      <div className="bg-surface-app border border-border-app p-4 rounded-xl shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Search Keyword
            </label>
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search by invoice number, name, phone, gstin..."
              className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none placeholder:text-text-muted"
            />
          </div>

          {/* Customer Filter */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Customer
            </label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none cursor-pointer"
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Invoice Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="FINALIZED">FINALIZED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-1">
          {/* From Date */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none"
            />
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Payment Status
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none cursor-pointer"
            >
              <option value="">All Payments</option>
              <option value="UNPAID">UNPAID</option>
              <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
              <option value="PAID">PAID</option>
            </select>
          </div>

          {/* Sorting */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Sort By
            </label>
            <div className="flex space-x-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none cursor-pointer"
              >
                <option value="invoiceDate">Invoice Date</option>
                <option value="invoiceNumber">Invoice Number</option>
                <option value="totals.grandTotalMinor">Grand Total</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="px-2 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none cursor-pointer"
              >
                <option value="desc">↓</option>
                <option value="asc">↑</option>
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full py-1.5 bg-surface-2-app hover:bg-surface-app border border-border-app text-xs text-text-secondary font-bold rounded-lg cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Bill Book Table / Cards */}
      <div className="bg-surface-app border border-border-app rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
            <p className="text-sm text-text-secondary">Loading digital bill book...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-base font-medium text-text-primary mb-2">No invoices found</p>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Finalized invoices will appear here after you create your first bill.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-2-app border-b border-border-app text-xs font-semibold text-text-muted uppercase tracking-wider">
                    <th className="py-3 px-6">Invoice Number / Date</th>
                    <th className="py-3 px-6">Customer</th>
                    <th className="py-3 px-6">Grand Total</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-app text-sm">
                  {invoices.map((inv) => {
                    const payStatus = inv.paymentStatus === 'PAID' 
                      ? 'PAID' 
                      : (inv.paymentStatus === 'PARTIALLY_PAID' || inv.paymentStatus === 'PARTIAL' ? 'PARTIAL' : 'UNPAID');

                    const payBadgeClass = payStatus === 'PAID'
                      ? 'bg-success-soft text-success-app border border-success-app/20'
                      : payStatus === 'PARTIAL'
                      ? 'bg-warning-soft text-warning-app border border-warning-app/20'
                      : 'bg-danger-soft text-danger-app border border-danger-app/20';

                    return (
                      <tr key={inv.id || (inv as any)._id} className="hover:bg-surface-2-app/30">
                        <td className="py-4 px-6">
                          <Link href={`/dashboard/invoices/detail/${inv.id || (inv as any)._id}`} className="hover:underline font-bold text-primary-700">
                            {inv.invoiceNumber ? inv.invoiceNumber : `#${(inv.id || (inv as any)._id).slice(-6).toUpperCase()}`}
                          </Link>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </td>
                        <td className="py-4 px-6 text-text-primary font-medium">
                          {inv.customer?.name || <span className="text-text-muted italic">No customer linked</span>}
                        </td>
                        <td className="py-4 px-6 text-text-primary font-bold">
                          ₹{(inv.totalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                            {inv.status === 'DRAFT' ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-2-app text-text-secondary border border-border-app">
                                DRAFT
                              </span>
                            ) : inv.status === 'CANCELLED' ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-danger-soft text-danger-app border border-danger-app/20">
                                CANCELLED
                              </span>
                            ) : (
                              <>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${payBadgeClass}`}>
                                  {payStatus}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-soft/60 text-success-app border border-success-app/20">
                                  FINALIZED
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Link
                            href={`/dashboard/invoices/detail/${inv.id || (inv as any)._id}`}
                            className="px-3 py-1 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg text-xs font-bold text-text-primary cursor-pointer transition inline-block"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards View */}
            <div className="md:hidden divide-y divide-border-app">
              {invoices.map((inv) => {
                const payStatus = inv.paymentStatus === 'PAID' 
                  ? 'PAID' 
                  : (inv.paymentStatus === 'PARTIALLY_PAID' || inv.paymentStatus === 'PARTIAL' ? 'PARTIAL' : 'UNPAID');

                const payBadgeClass = payStatus === 'PAID'
                  ? 'bg-success-soft text-success-app border border-success-app/20'
                  : payStatus === 'PARTIAL'
                  ? 'bg-warning-soft text-warning-app border border-warning-app/20'
                  : 'bg-danger-soft text-danger-app border border-danger-app/20';

                return (
                  <div key={inv.id || (inv as any)._id} className="p-4 space-y-3 hover:bg-surface-2-app/10">
                    <div className="flex justify-between items-start">
                      <div>
                        <Link href={`/dashboard/invoices/detail/${inv.id || (inv as any)._id}`} className="font-bold text-sm text-primary-700 hover:underline">
                          {inv.invoiceNumber ? inv.invoiceNumber : `#${(inv.id || (inv as any)._id).slice(-6).toUpperCase()}`}
                        </Link>
                        <p className="text-[10px] text-text-secondary mt-0.5">
                          {new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        {inv.status === 'DRAFT' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-2-app text-text-secondary">
                            DRAFT
                          </span>
                        ) : inv.status === 'CANCELLED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger-soft text-danger-app">
                            CANCELLED
                          </span>
                        ) : (
                          <>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${payBadgeClass}`}>
                              {payStatus}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <p className="text-text-muted text-[10px] uppercase font-bold tracking-wider">Customer</p>
                        <p className="font-semibold text-text-primary">{inv.customer?.name || '-'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-text-muted text-[10px] uppercase font-bold tracking-wider">Grand Total</p>
                        <p className="font-bold text-text-primary text-sm">₹{(inv.totalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end border-t border-border-app/40 pt-2.5">
                      <Link
                        href={`/dashboard/invoices/detail/${inv.id || (inv as any)._id}`}
                        className="px-3 py-1 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg text-xs font-bold text-text-primary cursor-pointer transition"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="bg-surface-2-app border-t border-border-app px-6 py-4 flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              Page {page} of {totalPages} ({totalItems} records)
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
