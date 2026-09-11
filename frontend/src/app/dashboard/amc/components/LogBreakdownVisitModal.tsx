'use client';

import React, { useState, useEffect } from 'react';
import { X, Wrench, ShieldCheck } from 'lucide-react';

interface LogBreakdownVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiClient: any;
  contracts: any[];
  technicians: any[];
  preSelectedContract?: any | null;
  setSuccessMsg: (msg: string) => void;
  setErrorMsg: (msg: string) => void;
}

export default function LogBreakdownVisitModal({
  isOpen,
  onClose,
  onSuccess,
  apiClient,
  contracts,
  technicians,
  preSelectedContract,
  setSuccessMsg,
  setErrorMsg,
}: LogBreakdownVisitModalProps) {
  const [selectedContractId, setSelectedContractId] = useState('');
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [serviceType, setServiceType] = useState('BREAKDOWN_REPAIR');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [technicianId, setTechnicianId] = useState('');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'EMERGENCY'>('NORMAL');
  const [submitting, setSubmitting] = useState(false);
  const [entitlementInfo, setEntitlementInfo] = useState<any | null>(null);

  // Active contracts only
  const activeContracts = contracts.filter((c) => c.status === 'ACTIVE');

  useEffect(() => {
    if (preSelectedContract) {
      setSelectedContractId(preSelectedContract._id);
      setSelectedContract(preSelectedContract);
    } else if (activeContracts.length > 0 && !selectedContractId) {
      setSelectedContractId(activeContracts[0]._id);
      setSelectedContract(activeContracts[0]);
    }
  }, [preSelectedContract, activeContracts.length]);

  useEffect(() => {
    if (selectedContractId) {
      const found = contracts.find((c) => c._id === selectedContractId);
      setSelectedContract(found || null);
      if (found && found.coveredUnits?.length > 0) {
        setSelectedEquipmentId(found.coveredUnits[0].acEquipmentId?._id || found.coveredUnits[0].acEquipmentId || '');
      } else {
        setSelectedEquipmentId('');
      }

      // Check breakdown entitlements for this contract
      if (found) {
        const breakdownEnt = found.planSnapshot?.entitlements?.find(
          (e: any) => e.serviceType === 'BREAKDOWN_REPAIR'
        );
        setEntitlementInfo({
          allowed: breakdownEnt?.quantity || 0,
          planName: found.planSnapshot?.planName || 'Custom Plan',
          planType: found.contractType,
        });
      }
    }
  }, [selectedContractId]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContractId) {
      setErrorMsg('Please select an active contract');
      return;
    }
    if (!selectedEquipmentId) {
      setErrorMsg('Please select a covered AC unit');
      return;
    }
    if (!complaintDescription.trim()) {
      setErrorMsg('Please provide complaint or problem details');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        contractId: selectedContractId,
        acEquipmentId: selectedEquipmentId,
        serviceType,
        scheduledDate,
        technicianId: technicianId || undefined,
        complaintDescription: complaintDescription.trim(),
        priority,
      };

      const res: any = await apiClient.post('/amc/visits', payload);
      setSuccessMsg(res.message || 'Service visit ticket created successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to log service visit');
    } finally {
      setSubmitting(false);
    }
  }

  const customerName = selectedContract?.customerId?.name || 'Selected Customer';
  const customerPhone = selectedContract?.customerId?.contact?.phone || '';
  const customerAddress = selectedContract?.customerId?.address?.line1 || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-surface-app border border-border-app rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-app flex justify-between items-center bg-surface-2-app/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 text-rose-600 rounded-xl">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Log Breakdown / Service Visit</h3>
              <p className="text-xs text-text-secondary">
                Dispatch an ad-hoc emergency repair or maintenance ticket for an active contract
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-2-app rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Active Contract Selector */}
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">
              Select Active AMC Contract <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              disabled={Boolean(preSelectedContract)}
              className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-700 disabled:opacity-75"
            >
              {activeContracts.length === 0 && (
                <option value="">No active AMC contracts found</option>
              )}
              {activeContracts.map((c) => (
                <option key={c._id} value={c._id}>
                  #{c.contractNumber} — {c.customerId?.name || 'Customer'} ({c.contractType})
                </option>
              ))}
            </select>
          </div>

          {/* Customer & Plan Summary Card */}
          {selectedContract && (
            <div className="p-3.5 bg-surface-2-app/60 border border-border-app rounded-xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-text-primary">{customerName}</span>
                <span className="px-2 py-0.5 rounded-md font-bold text-[10.5px] bg-primary-700/10 text-primary-700 border border-primary-700/20">
                  {selectedContract.contractType}
                </span>
              </div>
              <div className="text-text-secondary text-[11px] space-y-0.5">
                {customerPhone && <p>📞 Phone: {customerPhone}</p>}
                {customerAddress && <p>📍 Location: {customerAddress}</p>}
                <p>
                  📅 Coverage: {new Date(selectedContract.startDate).toLocaleDateString()} to{' '}
                  {new Date(selectedContract.endDate).toLocaleDateString()}
                </p>
              </div>

              {/* Entitlement Quota Alert */}
              {entitlementInfo && (
                <div className="mt-2 pt-2 border-t border-border-light flex items-center justify-between text-[11px]">
                  <span className="text-text-secondary flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Plan Entitlement:</span>
                  </span>
                  <span className="font-bold text-text-primary">
                    {entitlementInfo.allowed > 0
                      ? `${entitlementInfo.allowed} Free Breakdown Calls Included / Year`
                      : 'Non-comprehensive: Breakdown calls may be billable extra'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Covered Equipment Selection */}
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">
              Covered AC Unit with Issue <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedEquipmentId}
              onChange={(e) => setSelectedEquipmentId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-700"
            >
              {selectedContract?.coveredUnits?.length === 0 && (
                <option value="">No AC units covered in this contract</option>
              )}
              {selectedContract?.coveredUnits?.map((u: any, idx: number) => {
                const eq = u.acEquipmentId;
                const eqId = eq?._id || eq || idx;
                const brand = eq?.brand || u.unitBrand || 'AC';
                const tonnage = eq?.tonnage || u.unitTonnage || '';
                const location = eq?.installationLocation || u.unitLocation || `Unit #${idx + 1}`;
                const serial = eq?.serialNumber || u.unitSerial || '';
                return (
                  <option key={eqId} value={eqId}>
                    {brand} {tonnage ? `${tonnage}T` : ''} ({location}) {serial ? `[S/N: ${serial}]` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Row: Service Type & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Service Type</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-700"
              >
                <option value="BREAKDOWN_REPAIR">🚨 Breakdown / Emergency Repair</option>
                <option value="PREVENTIVE_HEALTH_CHECK">🔍 Preventive Health Check</option>
                <option value="WATER_SERVICE">💧 Water Service (Wet Wash)</option>
                <option value="DRY_SERVICE">🧹 Dry Filter Cleaning</option>
                <option value="GAS_CHARGING">❄️ Gas Charging / Top-up</option>
                <option value="INSTALLATION_DISMANTLING">🔧 Installation / Relocation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Priority / Urgency</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-700"
              >
                <option value="NORMAL">Standard / Normal</option>
                <option value="HIGH">⚠️ High Priority</option>
                <option value="EMERGENCY">🚨 Urgent Emergency (Same Day)</option>
              </select>
            </div>
          </div>

          {/* Row: Date & Technician */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">
                Visit Scheduled Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">
                Assign Technician (Optional)
              </label>
              <select
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-700"
              >
                <option value="">-- Assign Later --</option>
                {technicians.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.phone || t.specialization || 'Field Tech'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer Complaint / Issue Description */}
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">
              Customer Complaint / Problem Reported <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. AC unit is blowing normal room temperature air, compressor not starting, water dripping from indoor unit..."
              value={complaintDescription}
              onChange={(e) => setComplaintDescription(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary-700"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-app">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary hover:text-text-primary rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedContractId || !selectedEquipmentId}
              className="px-5 py-2 bg-[#245A82] hover:bg-[#1b4463] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{submitting ? 'Creating Ticket...' : 'Create Visit Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
