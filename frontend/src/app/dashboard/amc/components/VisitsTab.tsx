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
  Calendar,
  Wrench,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  X,
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
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected visit for modals
  const [selectedVisitForJobCard, setSelectedVisitForJobCard] = useState<any | null>(null);
  const [selectedVisitForAssign, setSelectedVisitForAssign] = useState<any | null>(null);
  const [assignTechnicianId, setAssignTechnicianId] = useState('');
  const [scheduledServiceDate, setScheduledServiceDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Selected visit for details modal
  const [viewingVisitDetails, setViewingVisitDetails] = useState<any | null>(null);

  // Filtering
  const filteredVisits = visits.filter((v) => {
    if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && v.serviceType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const numMatch = v.visitNumber?.toLowerCase().includes(q);
      const custMatch = v.customerId?.name?.toLowerCase().includes(q);
      const contractMatch = v.contractId?.contractNumber?.toLowerCase().includes(q);
      const techMatch = v.technicianId?.name?.toLowerCase().includes(q);
      return numMatch || custMatch || contractMatch || techMatch;
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

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-app border border-border-app p-3.5 rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-secondary">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-2-app border border-border-app rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-secondary">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-surface-2-app border border-border-app rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="DRY_SERVICE">Dry Service</option>
              <option value="WATER_SERVICE">Water Service</option>
              <option value="BREAKDOWN_REPAIR">Breakdown Repair</option>
              <option value="INSPECTION">Inspection</option>
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search visit, customer, tech..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs text-text-primary placeholder:text-text-secondary focus:outline-none"
          />
        </div>
      </div>

      {/* Visits Table */}
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
                          {v.equipmentId?.installationLocation || 'General Area'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-text-secondary font-medium">
                        {new Date(v.scheduledDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        {v.technicianId ? (
                          <span className="font-bold text-text-primary flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-primary-700" />
                            <span>{v.technicianId.name}</span>
                          </span>
                        ) : (
                          <span className="text-text-secondary italic text-[11px]">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            v.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : v.status === 'ASSIGNED'
                              ? 'bg-blue-100 text-blue-800'
                              : v.status === 'IN_PROGRESS'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {v.status !== 'COMPLETED' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedVisitForAssign(v);
                                setAssignTechnicianId(v.technicianId?._id || '');
                                setScheduledServiceDate(
                                  v.scheduledDate ? v.scheduledDate.split('T')[0] : ''
                                );
                              }}
                              className="px-2.5 py-1 bg-surface-2-app hover:bg-border-app rounded-lg text-text-secondary text-[11px] font-semibold transition cursor-pointer"
                              title="Assign Technician"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => setSelectedVisitForJobCard(v)}
                              className="px-2.5 py-1 bg-primary-900/10 hover:bg-primary-900/20 text-primary-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                              title="Complete Service Job Card"
                            >
                              Job Card
                            </button>
                          </>
                        )}

                        {v.status === 'COMPLETED' && (
                          <>
                            <button
                              onClick={() => setViewingVisitDetails(v)}
                              className="px-2.5 py-1 bg-surface-2-app hover:bg-border-app rounded-lg text-text-secondary text-[11px] font-semibold transition cursor-pointer"
                            >
                              Details
                            </button>

                            {hasUncoveredWork && !v.supplementaryQuotationId && (
                              <button
                                onClick={() =>
                                  handleGenerateSupplementaryQuotation(v._id, v.visitNumber)
                                }
                                className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                                title="Issue 7: Create supplementary quotation for customer approval before invoicing"
                              >
                                Supplementary Quote
                              </button>
                            )}

                            {v.supplementaryQuotationId && (
                              <span className="text-[10px] font-bold text-emerald-700 px-2 py-0.5 bg-emerald-50 rounded-md">
                                Quote #{v.supplementaryQuotationId.quotationNumber || 'Issued'}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Technician Modal */}
      {selectedVisitForAssign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border-app pb-3">
              <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary-700" />
                Assign Technician: #{selectedVisitForAssign.visitNumber}
              </h3>
              <button
                onClick={() => setSelectedVisitForAssign(null)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignTechnician} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Select Technician *
                </label>
                <select
                  value={assignTechnicianId}
                  onChange={(e) => setAssignTechnicianId(e.target.value)}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium"
                  required
                >
                  <option value="">-- Choose Field Technician --</option>
                  {technicians.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.role || 'Staff'}) {t.phone ? `• ${t.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Scheduled Date
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
                  className="px-4 py-2 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {actionLoading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Job Card Modal */}
      {selectedVisitForJobCard && (
        <JobCardModal
          visit={selectedVisitForJobCard}
          products={products}
          onClose={() => setSelectedVisitForJobCard(null)}
          onSubmit={handleCompleteJobCard}
          loading={actionLoading}
        />
      )}

      {/* Visit Details Modal */}
      {viewingVisitDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-app pb-3">
              <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Visit Summary: #{viewingVisitDetails.visitNumber}
              </h3>
              <button
                onClick={() => setViewingVisitDetails(null)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-surface-2-app/50 p-3 rounded-xl">
                <div>
                  <span className="text-text-secondary block">Service Date:</span>
                  <span className="font-bold text-text-primary">
                    {new Date(
                      viewingVisitDetails.actualServiceDate ||
                        viewingVisitDetails.scheduledDate
                    ).toLocaleDateString()}
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
