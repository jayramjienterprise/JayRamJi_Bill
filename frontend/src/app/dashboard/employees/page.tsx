'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api/client';
import {
  UserCheck,
  UserPlus,
  Search,
  Phone,
  Mail,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Wrench,
  Shield,
} from 'lucide-react';

export default function EmployeesPage() {
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [addForm, setAddForm] = useState({
    name: '',
    phone: '',
    email: '',
    specialization: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [techRes, visitRes]: any = await Promise.all([
        apiClient.get('/amc/technicians').catch(() => ({ data: [] })),
        apiClient.get('/amc/visits').catch(() => ({ data: [] })),
      ]);

      setTechnicians(techRes.data || techRes || []);
      setVisits(visitRes.data || visitRes || []);
    } catch (err: any) {
      setErrorMsg('Failed to load employee list');
    } finally {
      setLoading(false);
    }
  }

  // Count active/pending visits per technician
  function getAssignedVisitsCount(techId: string) {
    return visits.filter(
      (v) =>
        (v.technicianId?._id === techId || v.technicianId === techId) &&
        ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'].includes(v.status)
    ).length;
  }

  // Filtered list
  const filteredTechnicians = technicians.filter((t) => {
    if (statusFilter === 'ACTIVE' && t.active === false) return false;
    if (statusFilter === 'SUSPENDED' && t.active !== false) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = t.name?.toLowerCase().includes(q);
      const phoneMatch = t.phone?.toLowerCase().includes(q);
      const emailMatch = t.email?.toLowerCase().includes(q);
      return nameMatch || phoneMatch || emailMatch;
    }
    return true;
  });

  async function handleAddTechnician(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.phone.trim()) {
      setErrorMsg('Name and phone number are required');
      return;
    }

    setActionLoading(true);
    try {
      await apiClient.post('/amc/technicians', {
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        email: addForm.email.trim() || undefined,
        specialization: addForm.specialization.trim() || undefined,
      });

      setSuccessMsg(`Employee "${addForm.name}" added successfully!`);
      setIsAddModalOpen(false);
      setAddForm({ name: '', phone: '', email: '', specialization: '' });
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add employee');
    } finally {
      setActionLoading(false);
    }
  }

  function startEdit(tech: any) {
    setEditingTech(tech);
    setEditForm({
      name: tech.name || '',
      phone: tech.phone || '',
      email: tech.email || '',
      active: tech.active !== false,
    });
  }

  async function handleUpdateTechnician(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTech) return;

    setActionLoading(true);
    try {
      await apiClient.patch(`/amc/technicians/${editingTech._id}`, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || undefined,
        active: editForm.active,
      });

      setSuccessMsg(`Employee "${editForm.name}" updated successfully!`);
      setEditingTech(null);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update employee details');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteTechnician(tech: any) {
    const assignedCount = getAssignedVisitsCount(tech._id);
    if (assignedCount > 0) {
      alert(`Cannot delete ${tech.name}: they have ${assignedCount} active service visit(s) assigned. Please reassign those visits before deleting.`);
      return;
    }

    if (!confirm(`Are you sure you want to remove ${tech.name} from the staff directory?`)) {
      return;
    }

    try {
      await apiClient.delete(`/amc/technicians/${tech._id}`);
      setSuccessMsg(`Employee ${tech.name} removed successfully.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove employee');
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-app border border-border-app p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-900/10 text-primary-700 rounded-xl">
              <UserCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-text-primary">
              Employee &amp; Technician Directory
            </h1>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Manage your HVAC field engineers, technicians, and assignable staff
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Employee</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="cursor-pointer">
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
          <button onClick={() => setSuccessMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-app border border-border-app p-3.5 rounded-xl shadow-xs text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-text-secondary">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface-2-app border border-border-app rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Staff</option>
            <option value="SUSPENDED">Suspended / Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name, phone, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs text-text-primary placeholder:text-text-secondary focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="p-2 hover:bg-surface-2-app rounded-lg text-text-secondary cursor-pointer"
            title="Refresh employees"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-surface-app border border-border-app rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2-app border-b border-border-app text-text-secondary uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Employee Name</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Active Tasks</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-app">
              {filteredTechnicians.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-secondary">
                    {searchQuery || statusFilter !== 'ALL'
                      ? 'No employees found matching the filters.'
                      : 'No employees registered yet. Click "+ Add Employee" to create one.'}
                  </td>
                </tr>
              ) : (
                filteredTechnicians.map((t) => {
                  const assignedCount = getAssignedVisitsCount(t._id);
                  const isOwner = t.role === 'OWNER';

                  return (
                    <tr key={t._id} className="hover:bg-surface-2-app/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary-700/10 text-primary-700 font-bold flex items-center justify-center text-xs">
                            {t.name?.charAt(0)?.toUpperCase() || 'E'}
                          </div>
                          <div>
                            <span className="font-bold text-text-primary block">{t.name}</span>
                            {isOwner && (
                              <span className="text-[10px] text-primary-700 font-semibold flex items-center gap-1">
                                <Shield className="w-2.5 h-2.5" /> Account Owner
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-text-primary">
                        <div className="flex items-center gap-1 text-text-secondary">
                          <Phone className="w-3 h-3" />
                          <span>{t.phone || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-text-secondary">
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <span>{t.email || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-text-primary">
                        <span className="px-2 py-0.5 rounded-md bg-surface-2-app text-[11px]">
                          {t.role === 'OWNER' ? 'Owner / Admin' : 'Field Technician'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10.5px] ${
                            assignedCount > 0
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-surface-2-app text-text-secondary'
                          }`}
                        >
                          {assignedCount} visit{assignedCount === 1 ? '' : 's'} assigned
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            t.active !== false
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {t.active !== false ? 'ACTIVE' : 'SUSPENDED'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => startEdit(t)}
                            className="px-2.5 py-1 bg-surface-2-app hover:bg-border-app rounded-lg text-text-primary text-[11px] font-semibold transition cursor-pointer inline-flex items-center gap-1"
                            title="Edit details"
                          >
                            <Pencil className="w-3 h-3 text-primary-700" />
                            <span>Edit</span>
                          </button>

                          {!isOwner && (
                            <button
                              onClick={() => handleDeleteTechnician(t)}
                              className="px-2.5 py-1 bg-surface-2-app hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-lg text-rose-600 text-[11px] font-semibold transition cursor-pointer inline-flex items-center gap-1"
                              title="Delete employee"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL: ADD EMPLOYEE */}
      {/* ---------------------------------------------------- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary-700" />
                <h3 className="text-base font-black text-text-primary">Add New Employee</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTechnician} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Mukesh Sharma"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1">Phone Number *</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. tech@jayramji.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1">Specialization / Skills</label>
                <input
                  type="text"
                  placeholder="e.g. Ductable, VRV/VRF, Split Inverter"
                  value={addForm.specialization}
                  onChange={(e) => setAddForm({ ...addForm, specialization: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-app">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: EDIT EMPLOYEE */}
      {/* ---------------------------------------------------- */}
      {editingTech && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary-700" />
                <h3 className="text-base font-black text-text-primary">Edit Employee Details</h3>
              </div>
              <button
                onClick={() => setEditingTech(null)}
                className="p-1 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTechnician} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1">Email Address</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-text-primary pt-1">
                  <input
                    type="checkbox"
                    checked={editForm.active}
                    onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                    className="rounded text-primary-700"
                  />
                  <span>Active in Staff Directory</span>
                </label>
                <p className="text-[11px] text-text-secondary mt-1">
                  Unchecking suspends this technician from new visit assignments.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-app">
                <button
                  type="button"
                  onClick={() => setEditingTech(null)}
                  className="px-4 py-2 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
