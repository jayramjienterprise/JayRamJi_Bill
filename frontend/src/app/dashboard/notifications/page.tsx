'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api/client';
import {
  Bell,
  Calendar,
  AlertTriangle,
  Clock,
  UserCheck,
  UserX,
  Settings,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  ArrowRight,
  Phone,
  MapPin,
  Wrench,
  ShieldCheck,
  CreditCard,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import ContractPaymentModal from '../amc/components/ContractPaymentModal';

export default function NotificationsPage() {
  const [visits, setVisits] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedContractForPayment, setSelectedContractForPayment] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Editable threshold settings
  const [earlyDays, setEarlyDays] = useState(7);
  const [awareDays, setAwareDays] = useState(2);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Assign modal state
  const [selectedVisitForAssign, setSelectedVisitForAssign] = useState<any | null>(null);
  const [assignTechId, setAssignTechId] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Load saved notification threshold preferences
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jre_visit_alert_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.earlyDays) setEarlyDays(Number(parsed.earlyDays));
          if (parsed.awareDays) setAwareDays(Number(parsed.awareDays));
        } catch (e) {}
      }
    }
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [visitsRes, techsRes, contractsRes]: any = await Promise.all([
        apiClient.get('/amc/visits').catch(() => ({ data: [] })),
        apiClient.get('/amc/technicians').catch(() => ({ data: [] })),
        apiClient.get('/amc/contracts').catch(() => ({ data: [] })),
      ]);

      setVisits(visitsRes.data || visitsRes || []);
      setTechnicians(techsRes.data || techsRes || []);
      setContracts(contractsRes.data || contractsRes || []);
    } catch (err: any) {
      setErrorMsg('Failed to load notifications data');
    } finally {
      setLoading(false);
    }
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'jre_visit_alert_settings',
        JSON.stringify({ earlyDays, awareDays })
      );
    }
    setSuccessMsg('Notification alert thresholds updated successfully!');
    setIsSettingsOpen(false);
  }

  async function handleAssignTechnician(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisitForAssign || !assignTechId) return;

    setActionLoading(true);
    try {
      await apiClient.patch(`/amc/visits/${selectedVisitForAssign._id}/assign`, {
        technicianId: assignTechId,
        scheduledDate: assignDate || undefined,
      });
      setSuccessMsg(`Technician assigned to Visit #${selectedVisitForAssign.visitNumber}!`);
      setSelectedVisitForAssign(null);
      setAssignTechId('');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign technician');
    } finally {
      setActionLoading(false);
    }
  }

  // Calculate day difference between today and visit scheduled date
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  function getDaysUntil(dateStr?: string | Date) {
    if (!dateStr) return 999;
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - now.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  // Active pending visits
  const pendingVisits = visits.filter(
    (v) => ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'].includes(v.status)
  );

  // Group visits into categories
  const todayVisits = pendingVisits.filter((v) => {
    const diff = getDaysUntil(v.scheduledDate || v.createdAt);
    return diff === 0;
  });

  const awareVisits = pendingVisits.filter((v) => {
    const diff = getDaysUntil(v.scheduledDate || v.createdAt);
    return diff > 0 && diff <= awareDays;
  });

  const earlyVisits = pendingVisits.filter((v) => {
    const diff = getDaysUntil(v.scheduledDate || v.createdAt);
    return diff > awareDays && diff <= earlyDays;
  });

  const unassignedVisits = pendingVisits.filter((v) => !v.technicianId);

  // Active payment milestone alerts
  const milestoneAlerts: any[] = contracts.flatMap((contract) => {
    if (!contract.installments || !Array.isArray(contract.installments)) return [];
    return contract.installments
      .map((inst: any, idx: number) => {
        if (inst.status === 'PAID') return null;
        const diff = getDaysUntil(inst.dueDate);
        const isOverdue = diff < 0 || inst.status === 'OVERDUE';
        const isDueSoon = diff >= 0 && diff <= earlyDays;
        if (isOverdue || isDueSoon) {
          return {
            contract,
            installment: inst,
            installmentIndex: idx,
            daysUntil: diff,
            isOverdue,
            isDueSoon,
          };
        }
        return null;
      })
      .filter(Boolean);
  });

  const totalMilestonesDueAmount = milestoneAlerts.reduce(
    (sum, item) => sum + (item?.installment?.amount || 0),
    0
  );

  function matchesMilestoneSearch(item: any) {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const cNum = item.contract?.contractNumber?.toLowerCase().includes(q);
    const cName = item.contract?.customerId?.name?.toLowerCase().includes(q);
    const mTitle = item.installment?.title?.toLowerCase().includes(q);
    return cNum || cName || mTitle;
  }

  // Search filter
  function matchesSearch(v: any) {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const numMatch = v.visitNumber?.toLowerCase().includes(q);
    const custMatch = v.customerId?.name?.toLowerCase().includes(q);
    const techMatch = v.technicianId?.name?.toLowerCase().includes(q);
    const locMatch = v.equipmentId?.installationLocation?.toLowerCase().includes(q);
    return numMatch || custMatch || techMatch || locMatch;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-app border border-border-app p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-900/10 text-primary-700 rounded-xl">
              <Bell className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-text-primary">
              Service Visit Notification Center
            </h1>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Early warnings, aware notices, and visit-day dispatches for shopkeeper and staff
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-3.5 py-2 bg-surface-2-app hover:bg-border-app border border-border-app rounded-xl text-xs font-bold text-text-primary transition flex items-center gap-1.5 cursor-pointer"
            title="Configure Alert Days"
          >
            <Settings className="w-4 h-4 text-primary-700" />
            <span>Configure Alert Days</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2 hover:bg-surface-2-app rounded-lg text-text-secondary cursor-pointer"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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

      {/* Alert KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Today's Visits */}
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Due Today</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-400">
            {todayVisits.length}
          </div>
          <p className="text-[11px] text-text-secondary mt-1">Visits scheduled for today</p>
        </div>

        {/* Aware Visits (2 days) */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Next {awareDays} Days
            </span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
            {awareVisits.length}
          </div>
          <p className="text-[11px] text-text-secondary mt-1">Imminent service visits</p>
        </div>

        {/* Early Notice (7 days) */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Within {earlyDays} Days
            </span>
            <Calendar className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-blue-700 dark:text-blue-400">
            {earlyVisits.length}
          </div>
          <p className="text-[11px] text-text-secondary mt-1">Advance planning visits</p>
        </div>

        {/* Unassigned Warning */}
        <div className="p-4 bg-surface-app border border-border-app rounded-2xl">
          <div className="flex items-center justify-between text-primary-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Unassigned</span>
            <UserX className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-text-primary">
            {unassignedVisits.length}
          </div>
          <p className="text-[11px] text-text-secondary mt-1">Needs technician dispatch</p>
        </div>

        {/* Payment Milestones Due */}
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Milestones Due</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {milestoneAlerts.length}
          </div>
          <p className="text-[11px] text-text-secondary mt-1">
            ₹ {totalMilestonesDueAmount.toLocaleString('en-IN')} pending
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative w-full sm:w-80">
        <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Filter alerts by customer, visit #, location, contract..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-2 bg-surface-app border border-border-app rounded-xl text-xs text-text-primary placeholder:text-text-secondary focus:outline-none"
        />
      </div>

      {/* ---------------------------------------------------- */}
      {/* SECTION 0: PAYMENT MILESTONES DUE & OVERDUE */}
      {/* ---------------------------------------------------- */}
      {milestoneAlerts.filter(matchesMilestoneSearch).length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-sm font-black uppercase tracking-wider text-emerald-700">
                Payment Installments Due &amp; Overdue ({milestoneAlerts.filter(matchesMilestoneSearch).length})
              </h2>
            </div>
            <span className="text-xs font-bold text-text-secondary">
              Total Due: <strong className="text-emerald-700">₹ {totalMilestonesDueAmount.toLocaleString('en-IN')}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {milestoneAlerts.filter(matchesMilestoneSearch).map((item: any, idx: number) => {
              const { contract: c, installment: inst, isOverdue, daysUntil } = item;
              const customer = c.customerId || {};
              const phone = customer.contact?.phone || customer.phone || '';

              return (
                <div
                  key={idx}
                  className={`p-4 bg-surface-app border rounded-2xl shadow-xs transition flex flex-col justify-between space-y-3 ${
                    isOverdue
                      ? 'border-red-500/40 hover:border-red-500'
                      : 'border-emerald-500/40 hover:border-emerald-500'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isOverdue
                            ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        }`}
                      >
                        {isOverdue ? `Overdue (${Math.abs(daysUntil)}d)` : `Due in ${daysUntil}d`}
                      </span>
                      <span className="text-sm font-black text-text-primary">
                        ₹ {(inst.amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xs font-black text-text-primary">
                        {inst.title}
                      </h3>
                      <Link
                        href={`/dashboard/amc/contracts/${c._id}`}
                        className="text-[11px] font-bold text-primary-700 hover:underline inline-block mt-0.5"
                      >
                        Contract #{c.contractNumber} &rarr;
                      </Link>
                    </div>

                    <div className="p-2.5 bg-surface-2-app/50 rounded-xl border border-border-app text-xs space-y-1">
                      <div className="flex justify-between text-text-primary">
                        <span className="font-semibold text-text-secondary">Client:</span>
                        <span className="font-bold">{customer.name || 'Customer'}</span>
                      </div>
                      <div className="flex justify-between text-text-primary">
                        <span className="font-semibold text-text-secondary">Due Date:</span>
                        <span className={`font-bold ${isOverdue ? 'text-red-600' : ''}`}>
                          {new Date(inst.dueDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      {phone && (
                        <div className="flex justify-between text-text-secondary pt-0.5">
                          <span>Phone:</span>
                          <span className="font-mono">{phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border-app flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedContractForPayment(c)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Record Payment</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* SECTION 1: TODAY'S DUE VISITS */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
          <h2 className="text-sm font-black uppercase tracking-wider text-rose-600">
            Today&apos;s Service Visits ({todayVisits.filter(matchesSearch).length})
          </h2>
        </div>

        {todayVisits.filter(matchesSearch).length === 0 ? (
          <div className="p-4 bg-surface-app border border-border-app rounded-xl text-xs text-text-secondary text-center">
            No service visits due for dispatch today.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {todayVisits.filter(matchesSearch).map((v) => renderVisitAlertCard(v, 'TODAY'))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* SECTION 2: AWARE NOTICES (NEXT 2 DAYS) */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <h2 className="text-sm font-black uppercase tracking-wider text-amber-600">
            Aware Alerts (Upcoming in 1 to {awareDays} Days) ({awareVisits.filter(matchesSearch).length})
          </h2>
        </div>

        {awareVisits.filter(matchesSearch).length === 0 ? (
          <div className="p-4 bg-surface-app border border-border-app rounded-xl text-xs text-text-secondary text-center">
            No service visits scheduled in the next {awareDays} days.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {awareVisits.filter(matchesSearch).map((v) => renderVisitAlertCard(v, 'AWARE'))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* SECTION 3: EARLY PLANNING (NEXT 7 DAYS) */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
          <h2 className="text-sm font-black uppercase tracking-wider text-blue-600">
            Early Planning Notices (Next {earlyDays} Days) ({earlyVisits.filter(matchesSearch).length})
          </h2>
        </div>

        {earlyVisits.filter(matchesSearch).length === 0 ? (
          <div className="p-4 bg-surface-app border border-border-app rounded-xl text-xs text-text-secondary text-center">
            No upcoming visits in the next {earlyDays} days.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {earlyVisits.filter(matchesSearch).map((v) => renderVisitAlertCard(v, 'EARLY'))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL: EDIT ALERT THRESHOLDS */}
      {/* ---------------------------------------------------- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-700" />
                <h3 className="text-base font-black text-text-primary">Configure Alert Days</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-secondary font-bold mb-1">
                  Early Notice Threshold (Days before visit)
                </label>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={earlyDays}
                  onChange={(e) => setEarlyDays(Number(e.target.value))}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-bold"
                  required
                />
                <p className="text-[11px] text-text-secondary mt-1">
                  Alerts you in advance for scheduling &amp; parts preparation (default: 7 days).
                </p>
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1">
                  Aware Notice Threshold (Days before visit)
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={awareDays}
                  onChange={(e) => setAwareDays(Number(e.target.value))}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-bold"
                  required
                />
                <p className="text-[11px] text-text-secondary mt-1">
                  Imminent dispatch warning for tomorrow / next 48h (default: 2 days).
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-app">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Save Thresholds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: ASSIGN TECHNICIAN DIRECTLY FROM ALERT */}
      {/* ---------------------------------------------------- */}
      {selectedVisitForAssign && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <h3 className="text-sm font-black text-text-primary">
                Dispatch Visit #{selectedVisitForAssign.visitNumber}
              </h3>
              <button
                onClick={() => setSelectedVisitForAssign(null)}
                className="p-1 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignTechnician} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary font-bold mb-1">
                  Assign Technician *
                </label>
                <select
                  value={assignTechId}
                  onChange={(e) => setAssignTechId(e.target.value)}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium"
                  required
                >
                  <option value="">Select Technician</option>
                  {technicians.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.phone || 'No phone'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-app">
                <button
                  type="button"
                  onClick={() => setSelectedVisitForAssign(null)}
                  className="px-4 py-2 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Assigning...' : 'Confirm Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contract Payment Modal */}
      {selectedContractForPayment && (
        <ContractPaymentModal
          contract={selectedContractForPayment}
          isOpen={!!selectedContractForPayment}
          onClose={() => setSelectedContractForPayment(null)}
          onPaymentSuccess={() => {
            setSelectedContractForPayment(null);
            fetchData();
          }}
        />
      )}
    </div>
  );

  // Helper card renderer
  function renderVisitAlertCard(v: any, urgency: 'TODAY' | 'AWARE' | 'EARLY') {
    const isUnassigned = !v.technicianId;
    const borderClass =
      urgency === 'TODAY'
        ? 'border-rose-500/40 bg-rose-500/5'
        : urgency === 'AWARE'
        ? 'border-amber-500/40 bg-amber-500/5'
        : 'border-blue-500/40 bg-blue-500/5';

    return (
      <div
        key={v._id}
        className={`p-4 bg-surface-app border ${borderClass} rounded-2xl shadow-xs space-y-3 flex flex-col justify-between`}
      >
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-black text-primary-700">#{v.visitNumber}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                v.serviceType === 'BREAKDOWN_REPAIR'
                  ? 'bg-rose-100 text-rose-800'
                  : v.serviceType === 'WATER_SERVICE'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {v.serviceType?.replace(/_/g, ' ')}
            </span>
          </div>

          <div>
            <h3 className="font-bold text-text-primary text-sm">
              {v.customerId?.name || 'Customer'}
            </h3>
            {v.customerId?.contact?.phone && (
              <p className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-text-secondary" />
                <span>{v.customerId.contact.phone}</span>
              </p>
            )}
          </div>

          <div className="p-2.5 bg-surface-2-app rounded-xl space-y-1 text-[11.5px]">
            <div className="flex items-center gap-1.5 text-text-primary">
              <MapPin className="w-3.5 h-3.5 text-primary-700 shrink-0" />
              <span className="truncate">
                {v.equipmentId?.installationLocation || 'On-site location'}
              </span>
            </div>
            <div className="text-text-secondary truncate">
              {v.equipmentId?.brand} ({v.equipmentId?.tonnage} Ton) - S/N:{' '}
              {v.equipmentId?.serialNumber || 'N/A'}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-text-secondary font-medium">Technician:</span>
            {isUnassigned ? (
              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10.5px] flex items-center gap-1">
                <UserX className="w-3 h-3" /> Unassigned!
              </span>
            ) : (
              <span className="font-bold text-text-primary flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                {v.technicianId?.name}
              </span>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-border-app flex items-center justify-between gap-2">
          {isUnassigned ? (
            <button
              onClick={() => {
                setSelectedVisitForAssign(v);
                setAssignTechId('');
                setAssignDate(
                  v.scheduledDate
                    ? new Date(v.scheduledDate).toISOString().split('T')[0]
                    : ''
                );
              }}
              className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assign Tech Now</span>
            </button>
          ) : (
            <Link
              href="/dashboard/amc?tab=visits"
              className="w-full py-1.5 bg-surface-2-app hover:bg-border-app text-text-primary rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer text-center"
            >
              <span>View in Calendar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    );
  }
}
