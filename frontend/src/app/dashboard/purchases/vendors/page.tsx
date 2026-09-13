'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Edit2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  DollarSign,
  FileText,
  AlertCircle,
  Loader2,
  Eye,
} from 'lucide-react';
import { purchasesApi, Vendor } from '../../../../lib/api/purchases';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    vendorCode: '',
    contactPerson: '',
    mobile: '',
    alternateMobile: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstNumber: '',
    paymentTerms: 'Net 30',
    notes: '',
  });

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await purchasesApi.listVendors({ search: searchTerm });
      setVendors(res.vendors || []);
    } catch (err: any) {
      console.error('Error fetching vendors:', err);
      setError(err.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVendors();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const openAddModal = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      vendorCode: '',
      contactPerson: '',
      mobile: '',
      alternateMobile: '',
      email: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      gstNumber: '',
      paymentTerms: 'Net 30',
      notes: '',
    });
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      vendorCode: vendor.vendorCode,
      contactPerson: vendor.contactPerson || '',
      mobile: vendor.mobile || '',
      alternateMobile: vendor.alternateMobile || '',
      email: vendor.email || '',
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      pincode: vendor.pincode || '',
      gstNumber: vendor.gstNumber || '',
      paymentTerms: vendor.paymentTerms || 'Net 30',
      notes: vendor.notes || '',
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Vendor Name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      if (editingVendor) {
        await purchasesApi.updateVendor(editingVendor._id, formData);
      } else {
        await purchasesApi.createVendor(formData);
      }
      setIsModalOpen(false);
      await fetchVendors();
    } catch (err: any) {
      setError(err.message || 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (vendor: Vendor) => {
    try {
      await purchasesApi.toggleVendorStatus(vendor._id);
      await fetchVendors();
    } catch (err: any) {
      alert(err.message || 'Failed to update vendor status');
    }
  };

  // Calculations
  const totalPurchasesVolume = vendors.reduce((sum, v) => sum + (v.totalAmountPurchased || 0), 0);
  const totalOutstandingBalance = vendors.reduce((sum, v) => sum + (v.outstandingAmount || 0), 0);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard/purchases" className="hover:text-primary-600 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Purchases
            </Link>
            <span>/</span>
            <span className="font-semibold text-gray-700">Vendors</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary-600" />
            Vendor Directory
          </h1>
          <p className="text-sm text-gray-500">
            Manage suppliers, contact information, GSTIN details, and outstanding balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold shadow-sm transition active:scale-98"
          >
            <Plus className="w-4 h-4" />
            Add New Vendor
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-sm font-medium">
            <span>Total Vendors</span>
            <Building2 className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{vendors.length}</p>
          <p className="text-xs text-emerald-600 mt-1">
            {vendors.filter((v) => v.isActive).length} active suppliers
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-sm font-medium">
            <span>Total Purchased</span>
            <FileText className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ₹{totalPurchasesVolume.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 mt-1">Cumulative purchase volume</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-sm font-medium">
            <span>Outstanding Payables</span>
            <DollarSign className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">
            ₹{totalOutstandingBalance.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-rose-600 mt-1 font-medium">Pending vendor payments</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
        <Search className="w-5 h-5 text-gray-400 ml-2 shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by vendor name, code, contact person, mobile, or GST..."
          className="w-full text-sm outline-hidden text-gray-800 placeholder-gray-400"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs text-gray-400 hover:text-gray-600 px-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-2" />
            <p className="text-sm">Loading vendors...</p>
          </div>
        ) : vendors.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-gray-700">No vendors found</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Add your equipment and spare-parts suppliers to easily track purchases, receiving, and payables.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              Add First Vendor
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Vendor</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">GST Number</th>
                  <th className="py-3.5 px-4 text-right">Total Purchases</th>
                  <th className="py-3.5 px-4 text-right">Outstanding</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendors.map((vendor) => (
                  <tr key={vendor._id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div>
                        <Link
                          href={`/dashboard/purchases/vendors/${vendor._id}`}
                          className="font-semibold text-gray-900 hover:text-primary-600 transition"
                        >
                          {vendor.name}
                        </Link>
                        <span className="inline-block text-[11px] font-mono px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md mt-0.5">
                          {vendor.vendorCode}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-gray-600">
                      {vendor.contactPerson && (
                        <div className="font-medium text-gray-800">{vendor.contactPerson}</div>
                      )}
                      {vendor.mobile && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {vendor.mobile}
                        </div>
                      )}
                      {vendor.email && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {vendor.email}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-gray-600 text-xs">
                      {vendor.city || vendor.state ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>
                            {[vendor.city, vendor.state].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs font-mono">
                      {vendor.gstNumber ? (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold">
                          {vendor.gstNumber}
                        </span>
                      ) : (
                        <span className="text-gray-400">Unregistered</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-gray-900">
                      <div>₹{(vendor.totalAmountPurchased || 0).toLocaleString('en-IN')}</div>
                      <div className="text-[11px] text-gray-400">
                        {vendor.totalPurchases || 0} bills
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-semibold">
                      {(vendor.outstandingAmount || 0) > 0 ? (
                        <span className="text-rose-600">
                          ₹{(vendor.outstandingAmount || 0).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-emerald-600">₹0</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          vendor.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {vendor.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/purchases/vendors/${vendor._id}`}
                          title="View Vendor Ledger & Profile"
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openEditModal(vendor)}
                          title="Edit Vendor"
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(vendor)}
                          title={vendor.isActive ? 'Deactivate Vendor' : 'Activate Vendor'}
                          className={`p-1.5 rounded-lg transition ${
                            vendor.isActive
                              ? 'text-rose-500 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {vendor.isActive ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Vendor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingVendor ? 'Edit Vendor Details' : 'Add New Vendor'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enter supplier credentials and commercial terms.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Vendor / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Subzero Refrigeration Spares"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Vendor Code
                  </label>
                  <input
                    type="text"
                    value={formData.vendorCode}
                    onChange={(e) => setFormData({ ...formData, vendorCode: e.target.value })}
                    placeholder="Auto-generated if blank (e.g. VEN-001)"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    value={formData.gstNumber}
                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                    placeholder="e.g. 24AAAAA0000A1Z5"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Alternate Phone
                  </label>
                  <input
                    type="text"
                    value={formData.alternateMobile}
                    onChange={(e) => setFormData({ ...formData, alternateMobile: e.target.value })}
                    placeholder="Optional phone / landline"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="sales@vendor.com"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Shop / Unit, Complex, Area"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Mundra"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. Gujarat"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="e.g. 370421"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    placeholder="e.g. Net 15, Net 30, Immediate Cash"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about products supplied or special discounts..."
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingVendor ? 'Update Vendor' : 'Save Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
