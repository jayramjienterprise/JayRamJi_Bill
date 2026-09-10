'use client';

import React, { useState } from 'react';
import {
  Clock,
  UserCheck,
  CheckCircle2,
  FileText,
  AlertCircle,
  Filter,
  Search,
  Calendar as CalendarIcon,
  Wrench,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  ArrowUpRight,
  X,
  Plus,
  UserPlus,
  List,
  Phone,
  Mail,
} from 'lucide-react';
import JobCardModal from './JobCardModal';

interface VisitsTabProps {
  visits: any[];
  technicians: any[];
  products: any[];
  onRefresh: () => void;
  apiClient: any;
  setSuccessMsg: (msg: string) => void;
  setErrorMsg: (msg: string) => void;
}

export default function VisitsTab({
  visits,
  technicians,
  products,
  onRefresh,
  apiClient,
  setSuccessMsg,
  setErrorMsg,
}: VisitsTabProps) {
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [technicianFilter, setTechnicianFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Calendar state
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  // Selected visit for modals
  const [selectedVisitForJobCard, setSelectedVisitForJobCard] = useState<any | null>(null);
  const [selectedVisitForAssign, setSelectedVisitForAssign] = useState<any | null>(null);
  const [assignTechnicianId, setAssignTechnicianId] = useState('');
  const [scheduledServiceDate, setScheduledServiceDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Selected visit for details modal
  const [viewingVisitDetails, setViewingVisitDetails] = useState<any | null>(null);

  // Add Technician Modal state
  const [isAddTechModalOpen, setIsAddTechModalOpen] = useState(false);
  const [techForm, setTechForm] = useState({
    name: '',
    phone: '',
    email: '',
    specialization: '',
  });

  // Filtering
  const filteredVisits = visits.filter((v) => {
    if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && v.serviceType !== typeFilter) return false;
    if (technicianFilter !== 'ALL') {
      const techId = v.technicianId?._id || v.technicianId;
      if (techId !== technicianFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const numMatch = v.visitNumber?.toLowerCase().includes(q);
      const custMatch = v.customerId?.name?.toLowerCase().includes(q);
      const companyMatch = v.customerId?.companyName?.toLowerCase().includes(q);
      const contractMatch = v.contractId?.contractNumber?.toLowerCase().includes(q);
      const techMatch = v.technicianId?.name?.toLowerCase().includes(q);
      const locMatch = v.equipmentId?.installationLocation?.toLowerCase().includes(q);
      return numMatch || custMatch || companyMatch || contractMatch || techMatch || locMatch;
    }
    return true;
  });

  async function handleAssignTechnician(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisitForAssign || !assignTechnicianId) return;

    setActionLoading(true);
    try {
      await apiClient.patch(`/amc/visits/${selectedVisitForAssign._id}/assign`, {
        technicianId: assignTechnicianId,
        scheduledDate: scheduledServiceDate || undefined,
      });
      setSuccessMsg(`Technician assigned to Visit #${selectedVisitForAssign.visitNumber}!`);
      setSelectedVisitForAssign(null);
      setAssignTechnicianId('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign technician');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteJobCard(visitId: string, payload: any) {
    setActionLoading(true);
    try {
      const res: any = await apiClient.post(
        `/amc/visits/${visitId}/complete-jobcard`,
        payload
      );
      setSuccessMsg(res.message || 'Job-card completed and stock ledger updated!');
      setSelectedVisitForJobCard(null);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete job card');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleGenerateSupplementaryQuotation(visitId: string, visitNumber: string) {
    if (
      !confirm(
        `Create supplementary quotation for Visit #${visitNumber}? This will generate an official quotation for non-covered parts/labor for customer approval.`
      )
    )
      return;

    setActionLoading(true);
    try {
      const res: any = await apiClient.post(
        `/amc/visits/${visitId}/supplementary-quotation`,
        {}
      );
      setSuccessMsg(
        `Quotation #${res.data?.quotationNumber} generated for customer approval!`
      );
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate supplementary quotation');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddTechnician(e: React.FormEvent) {
    e.preventDefault();
    if (!techForm.name.trim() || !techForm.phone.trim()) {
      setErrorMsg('Technician name and phone number are required');
      return;
    }

    setActionLoading(true);
    try {
      await apiClient.post('/amc/technicians', {
        name: techForm.name.trim(),
        phone: techForm.phone.trim(),
        email: techForm.email.trim() || undefined,
        specialization: techForm.specialization.trim() || undefined,
      });
      setSuccessMsg(`Technician "${techForm.name}" added successfully!`);
      setIsAddTechModalOpen(false);
      setTechForm({ name: '', phone: '', email: '', specialization: '' });
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add technician');
    } finally {
      setActionLoading(false);
    }
  }

  // Calendar Helpers
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };
  const goToToday = () => {
    setCurrentCalendarDate(new Date());
  };

  const getVisitsForDay = (day: number) => {
    return filteredVisits.filter((v) => {
      const dateStr = v.scheduledDate || v.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return (
        d.getFullYear() === year &&
        d.getMonth() === month &&
        d.getDate() === day
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header & View Switcher Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface-app border border-border-app p-3.5 rounded-xl shadow-xs">
        {/* Left: View Mode Toggle & Add Technician Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Toggle */}
          <div className="inline-flex bg-surface-2-app border border-border-app p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-primary-700 text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-primary-700 text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar View</span>
            </button>
          </div>

          {/* Add Technician Button */}
          <button
            type="button"
            onClick={() => setIsAddTechModalOpen(true)}
            className="px-3 py-1.5 bg-surface-2-app hover:bg-border-app border border-border-app text-text-primary rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Add a new technician to assign to visits"
          >
            <UserPlus className="w-3.5 h-3.5 text-primary-700" />
            <span>+ Add Technician</span>
          </button>
        </div>

        {/* Right: Search Box */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search visit #, customer, contract, tech..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs text-text-primary placeholder:text-text-secondary focus:outline-none"
          />
        </div>
      </div>

      {/* Filter Options Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-app border border-border-app px-3.5 py-2.5 rounded-xl shadow-xs text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-text-secondary" />
            <span className="font-bold text-text-secondary">Filters:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-text-secondary">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-2-app border border-border-app rounded-lg px-2 py-1 text-xs font-medium text-text-primary focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-text-secondary">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-surface-2-app border border-border-app rounded-lg px-2 py-1 text-xs font-medium text-text-primary focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="DRY_SERVICE">Dry Service</option>
              <option value="WATER_SERVICE">Water Service</option>
              <option value="BREAKDOWN_REPAIR">Breakdown Repair</option>
              <option value="INSPECTION">Inspection</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-text-secondary">Technician:</span>
            <select
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
              className="bg-surface-2-app border border-border-app rounded-lg px-2 py-1 text-xs font-medium text-text-primary focus:outline-none"
            >
              <option value="ALL">All Technicians ({technicians.length})</option>
              {technicians.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-text-secondary font-medium">
          Showing <span className="font-bold text-text-primary">{filteredVisits.length}</span> of{' '}
          <span className="font-bold text-text-primary">{visits.length}</span> visits
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. CALENDAR VIEW */}
      {/* ---------------------------------------------------- */}
      {viewMode === 'calendar' && (
        <div className="bg-surface-app border border-border-app rounded-2xl p-4 shadow-xs space-y-4">
          {/* Calendar Month Navigation Header */}
          <div className="flex items-center justify-between border-b border-border-app pb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-text-primary">
                {monthNames[month]} {year}
              </h2>
              <button
                type="button"
                onClick={goToToday}
                className="px-2.5 py-1 bg-surface-2-app hover:bg-border-app border border-border-app rounded-lg text-xs font-bold text-text-primary transition cursor-pointer"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 hover:bg-surface-2-app rounded-lg text-text-secondary hover:text-text-primary transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 hover:bg-surface-2-app rounded-lg text-text-secondary hover:text-text-primary transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-text-secondary uppercase tracking-wider py-1 border-b border-border-app">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Blank cells for offset */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[110px] rounded-xl bg-surface-2-app/20 border border-transparent p-1.5"
              />
            ))}

            {/* Day Cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday =
                new Date().getDate() === day &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;
              const dayVisits = getVisitsForDay(day);

              return (
                <div
                  key={`day-${day}`}
                  className={`min-h-[110px] rounded-xl border p-2 flex flex-col justify-between transition ${
                    isToday
                      ? 'bg-primary-900/5 border-primary-500/50 shadow-xs'
                      : 'bg-surface-2-app/40 border-border-app hover:border-border-app/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-black inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        isToday
                          ? 'bg-primary-700 text-white'
                          : 'text-text-primary'
                      }`}
                    >
                      {day}
                    </span>
                    {dayVisits.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700">
                        {dayVisits.length}
                      </span>
                    )}
                  </div>

                  {/* Visits Chips on this Day */}
                  <div className="space-y-1.5 overflow-y-auto max-h-[85px]">
                    {dayVisits.map((v) => {
                      const isCompleted = v.status === 'COMPLETED';
                      const isInProgress = v.status === 'IN_PROGRESS';
                      const isBreakdown = v.serviceType === 'BREAKDOWN_REPAIR';

                      return (
                        <div
                          key={v._id}
                          onClick={() => {
                            if (isCompleted) {
                              setViewingVisitDetails(v);
                            } else {
                              setSelectedVisitForJobCard(v);
                            }
                          }}
                          className={`p-1.5 rounded-lg text-[10.5px] cursor-pointer transition border shadow-2xs ${
                            isCompleted
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20'
                              : isInProgress
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20'
                              : isBreakdown
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300 hover:bg-rose-500/20'
                              : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300 hover:bg-blue-500/20'
                          }`}
                          title={`Click to open Job Card / Details for Visit #${v.visitNumber}`}
                        >
                          <div className="flex items-center justify-between font-black">
                            <span>{v.visitNumber}</span>
                            <span className="text-[9px] uppercase font-bold">
                              {v.serviceType === 'BREAKDOWN_REPAIR'
                                ? 'Breakdown'
                                : v.serviceType === 'WATER_SERVICE'
                                ? 'Water'
                                : 'Dry'}
                            </span>
                          </div>
                          <div className="truncate font-semibold text-text-primary text-[10px]">
                            {v.customerId?.name || 'Customer'}
                          </div>
                          <div className="truncate text-text-secondary text-[9.5px]">
                            {v.technicianId?.name ? `Tech: ${v.technicianId.name}` : 'Unassigned'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. TABLE VIEW */}
      {/* ---------------------------------------------------- */}
      {viewMode === 'table' && (
        <div className="bg-surface-app border border-border-app rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2-app border-b border-border-app text-text-secondary uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Visit #</th>
                  <th className="py-3 px-4">Service Type</th>
                  <th className="py-3 px-4">Customer & Contract</th>
                  <th className="py-3 px-4">AC Unit Details</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Technician</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-app">
                {filteredVisits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-text-secondary">
                      No service visits found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredVisits.map((v) => {
                    const hasUncoveredWork =
                      (v.sparesUsed || []).some((s: any) => !s.isCoveredByAmc) ||
                      (v.additionalWorkRecommendations || []).length > 0;

                    return (
                      <tr key={v._id} className="hover:bg-surface-2-app/50 transition">
                        <td className="py-3.5 px-4 font-black text-primary-700">
                          {v.visitNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              v.serviceType === 'WATER_SERVICE'
                                ? 'bg-blue-100 text-blue-800'
                                : v.serviceType === 'BREAKDOWN_REPAIR'
                                ? 'bg-red-100 text-red-800'
                                : v.serviceType === 'DRY_SERVICE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-neutral-100 text-neutral-800'
                            }`}
                          >
                            {v.serviceType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-text-primary block">
                            {v.customerId?.name || 'Customer'}
                          </span>
                          <span className="text-[10px] text-text-secondary">
                            #{v.contractId?.contractNumber || 'Contract'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-text-primary block">
                            {v.equipmentId?.brand} {v.equipmentId?.tonnage}
                          </span>
                          <span className="text-[10px] text-text-secondary">
                            {v.equipmentId?.installationLocation || 'Location'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-text-secondary">
                          {v.scheduledDate
                            ? new Date(v.scheduledDate).toLocaleDateString()
                            : new Date(v.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4">
                          {v.technicianId ? (
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="font-medium text-text-primary">
                                {v.technicianId?.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-text-secondary italic">Not Assigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              v.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : v.status === 'IN_PROGRESS'
                                ? 'bg-amber-100 text-amber-800'
                                : v.status === 'ASSIGNED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-neutral-100 text-neutral-800'
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Assign Technician Button */}
                            {v.status !== 'COMPLETED' && (
                              <button
                                onClick={() => {
                                  setSelectedVisitForAssign(v);
                                  setAssignTechnicianId(v.technicianId?._id || '');
                                  setScheduledServiceDate(
                                    v.scheduledDate
                                      ? new Date(v.scheduledDate).toISOString().split('T')[0]
                                      : ''
                                  );
                                }}
                                className="px-2.5 py-1 bg-surface-2-app hover:bg-border-app rounded-lg text-text-primary font-semibold text-[11px] transition cursor-pointer"
                                title="Assign Technician & Date"
                              >
                                {v.technicianId ? 'Reassign' : 'Assign'}
                              </button>
                            )}

                            {/* Job Card Execution Button */}
                            {v.status !== 'COMPLETED' && (
                              <button
                                onClick={() => setSelectedVisitForJobCard(v)}
                                className="px-2.5 py-1 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-bold text-[11px] transition cursor-pointer inline-flex items-center gap-1 shadow-xs"
                                title="Open Job-Card Modal"
                              >
                                <Wrench className="w-3 h-3" />
                                <span>Job Card</span>
                              </button>
                            )}

                            {/* Completed Visit Review Button */}
                            {v.status === 'COMPLETED' && (
                              <button
                                onClick={() => setViewingVisitDetails(v)}
                                className="px-2.5 py-1 bg-surface-2-app hover:bg-border-app rounded-lg text-text-primary font-semibold text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Report</span>
                              </button>
                            )}

                            {/* Supplementary Quotation Generator */}
                            {hasUncoveredWork && !v.supplementaryQuotationId && (
                              <button
                                onClick={() =>
                                  handleGenerateSupplementaryQuotation(v._id, v.visitNumber)
                                }
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                                title="Spares/Labor not covered under AMC plan. Click to generate official supplementary quotation!"
                              >
                                <ShieldAlert className="w-3 h-3" />
                                <span>Quote Uncovered</span>
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
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: ASSIGN TECHNICIAN */}
      {/* ---------------------------------------------------- */}
      {selectedVisitForAssign && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <h3 className="text-sm font-black text-text-primary">
                Assign Visit #{selectedVisitForAssign.visitNumber}
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
                  Select Field Technician *
                </label>
                <select
                  value={assignTechnicianId}
                  onChange={(e) => setAssignTechnicianId(e.target.value)}
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
                  Scheduled Service Date
                </label>
                <input
                  type="date"
                  value={scheduledServiceDate}
                  onChange={(e) => setScheduledServiceDate(e.target.value)}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedVisitForAssign(null)}
                  className="px-3.5 py-2 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: ADD TECHNICIAN */}
      {/* ---------------------------------------------------- */}
      {isAddTechModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary-700" />
                <h3 className="text-sm font-black text-text-primary">
                  Add New Technician
                </h3>
              </div>
              <button
                onClick={() => setIsAddTechModalOpen(false)}
                className="p-1 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTechnician} className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary font-bold mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={techForm.name}
                  onChange={(e) => setTechForm({ ...techForm, name: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={techForm.phone}
                  onChange={(e) => setTechForm({ ...techForm, phone: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. tech@jayramji.com"
                  value={techForm.email}
                  onChange={(e) => setTechForm({ ...techForm, email: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1">
                  Specialization / Skills
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ductable, VRV/VRF, Inverter Split"
                  value={techForm.specialization}
                  onChange={(e) => setTechForm({ ...techForm, specialization: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTechModalOpen(false)}
                  className="px-3.5 py-2 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Technician'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: COMPLETE JOB CARD */}
      {/* ---------------------------------------------------- */}
      {selectedVisitForJobCard && (
        <JobCardModal
          visit={selectedVisitForJobCard}
          products={products}
          onClose={() => setSelectedVisitForJobCard(null)}
          onSubmit={(visitId: string, payload: any) => handleCompleteJobCard(visitId, payload)}
          loading={actionLoading}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: VIEW COMPLETED VISIT DETAILS */}
      {/* ---------------------------------------------------- */}
      {viewingVisitDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <div>
                <h3 className="text-base font-black text-text-primary">
                  Visit #{viewingVisitDetails.visitNumber} Report
                </h3>
                <p className="text-xs text-text-secondary">
                  Completed on{' '}
                  {viewingVisitDetails.completedAt
                    ? new Date(viewingVisitDetails.completedAt).toLocaleString()
                    : 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setViewingVisitDetails(null)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-surface-2-app p-3 rounded-xl">
                <div>
                  <span className="text-text-secondary block">Customer:</span>
                  <span className="font-bold text-text-primary">
                    {viewingVisitDetails.customerId?.name}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary block">Technician:</span>
                  <span className="font-bold text-text-primary">
                    {viewingVisitDetails.technicianId?.name || 'Assigned Staff'}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-text-primary block mb-1">
                  Work Performed:
                </span>
                <p className="bg-surface-2-app p-2.5 rounded-xl text-text-secondary">
                  {viewingVisitDetails.workPerformed || 'Regular servicing completed.'}
                </p>
              </div>

              {viewingVisitDetails.sparesUsed?.length > 0 && (
                <div>
                  <span className="font-bold text-text-primary block mb-1">
                    Spares Consumed:
                  </span>
                  <div className="space-y-1.5">
                    {viewingVisitDetails.sparesUsed.map((sp: any, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between items-center bg-surface-2-app p-2 rounded-lg text-[11px]"
                      >
                        <span className="font-medium text-text-primary">
                          {sp.productId?.name || 'Part'} x {sp.quantity}
                        </span>
                        <span
                          className={`font-bold ${
                            sp.isCoveredByAmc
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {sp.isCoveredByAmc ? 'Covered (₹0)' : `₹${sp.totalAmount || 0} (Chargeable)`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingVisitDetails.gasRefilledKg > 0 && (
                <div className="bg-surface-2-app p-2.5 rounded-xl flex justify-between items-center text-[11px]">
                  <span>
                    Gas Refill: {viewingVisitDetails.gasRefilledKg} Kg (
                    {viewingVisitDetails.refrigerantType})
                  </span>
                  <span
                    className={`font-bold ${
                      viewingVisitDetails.isGasCovered
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {viewingVisitDetails.isGasCovered ? 'Covered' : 'Chargeable'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border-app">
              <button
                onClick={() => setViewingVisitDetails(null)}
                className="px-4 py-2 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
