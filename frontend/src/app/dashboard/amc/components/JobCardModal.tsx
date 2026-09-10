'use client';

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Gauge,
  Cpu,
  Plus,
  Trash2,
  ShieldCheck,
  FileQuestion,
} from 'lucide-react';

interface JobCardModalProps {
  visit: any;
  products: any[];
  onClose: () => void;
  onSubmit: (visitId: string, payload: any) => Promise<void>;
  loading: boolean;
}

export default function JobCardModal({
  visit,
  products,
  onClose,
  onSubmit,
  loading,
}: JobCardModalProps) {
  const [actualServiceDate, setActualServiceDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [workPerformed, setWorkPerformed] = useState('');
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [customerRemarks, setCustomerRemarks] = useState('');

  // Checklists
  const [checklist, setChecklist] = useState({
    filterCleaned: true,
    indoorCoilCleaned: true,
    outdoorCondenserWashed: false,
    electricalTightened: true,
    blowerMotorChecked: true,
    drainPipeChecked: true,
    operatingCurrentAmps: 6.5,
    suctionPressurePsi: 120,
    dischargePressurePsi: 340,
  });

  // Spares used
  const [spares, setSpares] = useState<
    Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      notes: string;
    }>
  >([]);

  // Gas refilled
  const [gasRefilledKg, setGasRefilledKg] = useState<number | ''>('');
  const [refrigerantType, setRefrigerantType] = useState<string>(
    visit?.equipmentId?.refrigerantType || 'R32'
  );
  const [isPipingDamageLeak, setIsPipingDamageLeak] = useState(false);

  // Additional recommendations (Issue 7)
  const [recommendations, setRecommendations] = useState('');

  // Helper to check if a product is covered in the contract snapshot
  const planSnapshot = visit?.contractId?.planSnapshot;
  const partCoverages = planSnapshot?.partCoverages || [];

  function getCoverageStatus(productId: string) {
    if (!productId) return null;
    const match = partCoverages.find(
      (pc: any) =>
        (pc.productId?._id || pc.productId) === productId ||
        pc.productId?.toString() === productId
    );
    if (!match) return { covered: false, label: 'Chargeable (Not Covered)' };
    return {
      covered: match.coverageType !== 'NOT_COVERED',
      type: match.coverageType,
      limit: match.quantityLimitPerYear,
      label:
        match.coverageType === 'FREE_REPLACEMENT'
          ? `Covered Free (Limit: ${match.quantityLimitPerYear}/yr)`
          : `Discounted (${match.discountPercent || 0}% Off)`,
    };
  }

  function handleAddSpare() {
    setSpares([...spares, { productId: '', quantity: 1, unitPrice: 0, notes: '' }]);
  }

  function handleRemoveSpare(index: number) {
    setSpares(spares.filter((_, i) => i !== index));
  }

  function handleProductChange(index: number, prodId: string) {
    const prod = products.find((p) => p._id === prodId);
    const updated = [...spares];
    updated[index].productId = prodId;
    if (prod) {
      updated[index].unitPrice = prod.price || prod.salePrice || 0;
    }
    setSpares(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workPerformed.trim()) {
      alert('Please describe the work performed');
      return;
    }

    const payload = {
      actualServiceDate,
      workPerformed,
      technicianNotes: technicianNotes || undefined,
      customerRemarks: customerRemarks || undefined,
      checklist,
      sparesUsed: spares.filter((s) => s.productId),
      gasRefilledKg: gasRefilledKg !== '' ? Number(gasRefilledKg) : undefined,
      refrigerantType: gasRefilledKg !== '' ? refrigerantType : undefined,
      isPipingDamageLeak,
      recommendations: recommendations || undefined,
    };

    await onSubmit(visit._id, payload);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface-app border border-border-app rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border-app flex items-center justify-between bg-surface-2-app/50">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary-700" />
              <h2 className="text-base font-black text-text-primary">
                AMC Job-Card Entry: #{visit.visitNumber}
              </h2>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Contract #{visit.contractId?.contractNumber || 'N/A'} • Unit:{' '}
              {visit.equipmentId?.brand} {visit.equipmentId?.tonnage} (
              {visit.equipmentId?.installationLocation || 'General Area'})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-2-app text-text-secondary cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* General info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">
                Actual Service Date *
              </label>
              <input
                type="date"
                value={actualServiceDate}
                onChange={(e) => setActualServiceDate(e.target.value)}
                className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">
                Service Type
              </label>
              <div className="p-2.5 bg-surface-2-app border border-border-app rounded-xl text-xs font-bold text-primary-700">
                {visit.serviceType?.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Technical Checklist */}
          <div className="bg-surface-2-app/50 border border-border-app rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-black text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Maintenance Checklist & Inspection
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {[
                { key: 'filterCleaned', label: 'Air Filter Cleaned' },
                { key: 'indoorCoilCleaned', label: 'Indoor Cooling Coil' },
                { key: 'outdoorCondenserWashed', label: 'Outdoor Condenser Wash' },
                { key: 'electricalTightened', label: 'Electrical Wiring Tight' },
                { key: 'blowerMotorChecked', label: 'Blower & Fan Checked' },
                { key: 'drainPipeChecked', label: 'Drain Pipe Cleared' },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer bg-surface-app border border-border-app p-2 rounded-lg"
                >
                  <input
                    type="checkbox"
                    checked={(checklist as any)[key]}
                    onChange={(e) =>
                      setChecklist({ ...checklist, [key]: e.target.checked })
                    }
                    className="rounded text-primary-700 focus:ring-0"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {/* Operating Pressures & Amps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">
                  Operating Current (Amps)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={checklist.operatingCurrentAmps || ''}
                  onChange={(e) =>
                    setChecklist({
                      ...checklist,
                      operatingCurrentAmps: Number(e.target.value),
                    })
                  }
                  className="w-full bg-surface-app border border-border-app rounded-lg p-2 text-xs"
                  placeholder="e.g. 6.5"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">
                  Suction Pressure (PSI)
                </label>
                <input
                  type="number"
                  step="1"
                  value={checklist.suctionPressurePsi || ''}
                  onChange={(e) =>
                    setChecklist({
                      ...checklist,
                      suctionPressurePsi: Number(e.target.value),
                    })
                  }
                  className="w-full bg-surface-app border border-border-app rounded-lg p-2 text-xs"
                  placeholder="e.g. 125"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">
                  Discharge Pressure (PSI)
                </label>
                <input
                  type="number"
                  step="1"
                  value={checklist.dischargePressurePsi || ''}
                  onChange={(e) =>
                    setChecklist({
                      ...checklist,
                      dischargePressurePsi: Number(e.target.value),
                    })
                  }
                  className="w-full bg-surface-app border border-border-app rounded-lg p-2 text-xs"
                  placeholder="e.g. 340"
                />
              </div>
            </div>
          </div>

          {/* Refrigerant Gas Refilling Section (Issue 11) */}
          <div className="bg-surface-2-app/50 border border-border-app rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-black text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-blue-600" />
              Refrigerant Gas Refill / Top-up
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">
                  Gas Charged (Kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={gasRefilledKg}
                  onChange={(e) =>
                    setGasRefilledKg(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  className="w-full bg-surface-app border border-border-app rounded-lg p-2 text-xs"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">
                  Refrigerant Type
                </label>
                <select
                  value={refrigerantType}
                  onChange={(e) => setRefrigerantType(e.target.value)}
                  className="w-full bg-surface-app border border-border-app rounded-lg p-2 text-xs font-medium"
                >
                  <option value="R32">R32</option>
                  <option value="R410A">R410A</option>
                  <option value="R22">R22</option>
                  <option value="R134a">R134a</option>
                </select>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPipingDamageLeak}
                    onChange={(e) => setIsPipingDamageLeak(e.target.checked)}
                    className="rounded text-primary-700"
                  />
                  <span>Piping / External Damage Leak</span>
                </label>
              </div>
            </div>
            {isPipingDamageLeak && (
              <p className="text-[11px] text-amber-600 font-medium">
                * Note: Gas coverage terms exclude leaks caused by piping damage. This gas charge will be flagged as chargeable.
              </p>
            )}
          </div>

          {/* Spares Used & Coverage Evaluation (Issues 1 & 6) */}
          <div className="bg-surface-2-app/50 border border-border-app rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-purple-600" />
                Spares Consumed (Inventory Deduction & AMC Coverage)
              </h3>
              <button
                type="button"
                onClick={handleAddSpare}
                className="text-primary-700 hover:text-primary-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Spare Part</span>
              </button>
            </div>

            {spares.length === 0 ? (
              <p className="text-xs text-text-secondary italic py-1">
                No spare parts used during this visit.
              </p>
            ) : (
              <div className="space-y-2.5">
                {spares.map((spare, idx) => {
                  const coverage = getCoverageStatus(spare.productId);
                  return (
                    <div
                      key={idx}
                      className="bg-surface-app border border-border-app p-3 rounded-xl space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <select
                            value={spare.productId}
                            onChange={(e) =>
                              handleProductChange(idx, e.target.value)
                            }
                            className="w-full bg-surface-2-app border border-border-app rounded-lg p-2 text-xs font-medium"
                            required
                          >
                            <option value="">-- Select Product Part --</option>
                            {products.map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name} ({p.sku || 'No SKU'}) - ₹{p.price || 0}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-20">
                          <input
                            type="number"
                            min="1"
                            value={spare.quantity}
                            onChange={(e) => {
                              const updated = [...spares];
                              updated[idx].quantity = Number(e.target.value);
                              setSpares(updated);
                            }}
                            className="w-full bg-surface-2-app border border-border-app rounded-lg p-2 text-xs"
                            placeholder="Qty"
                            required
                          />
                        </div>
                        <div className="w-24">
                          <input
                            type="number"
                            value={spare.unitPrice}
                            onChange={(e) => {
                              const updated = [...spares];
                              updated[idx].unitPrice = Number(e.target.value);
                              setSpares(updated);
                            }}
                            className="w-full bg-surface-2-app border border-border-app rounded-lg p-2 text-xs"
                            placeholder="Price"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpare(idx)}
                          className="p-1.5 text-danger-app hover:bg-danger-soft rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Real-time Coverage indicator */}
                      {coverage && (
                        <div className="flex items-center justify-between text-[11px] pt-1 px-1">
                          <div className="flex items-center gap-1.5">
                            {coverage.covered ? (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <FileQuestion className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span
                              className={`font-bold ${
                                coverage.covered
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {coverage.label}
                            </span>
                          </div>
                          <span className="text-text-secondary">
                            Deducts from warehouse stock
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Work Summary & Notes */}
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">
              Work Performed / Service Summary *
            </label>
            <textarea
              value={workPerformed}
              onChange={(e) => setWorkPerformed(e.target.value)}
              rows={2}
              className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
              placeholder="e.g. Conducted dry service. Cleaned indoor filters, dusted evaporator coil, checked blower motor and tightened terminal block."
              required
            />
          </div>

          {/* Additional Work Recommendations (Issue 7 - Approval Flow) */}
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">
              Additional Uncovered Work / Recommendations (For Supplementary Quotation)
            </label>
            <textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              rows={2}
              className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
              placeholder="e.g. Outdoor fan blade shows minor cracking; recommended replacement. Customer estimate required before undertaking."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">
                Technician Internal Notes
              </label>
              <input
                type="text"
                value={technicianNotes}
                onChange={(e) => setTechnicianNotes(e.target.value)}
                className="w-full bg-surface-2-app border border-border-app rounded-xl p-2 text-xs"
                placeholder="Internal notes..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">
                Customer Remarks / Sign-off
              </label>
              <input
                type="text"
                value={customerRemarks}
                onChange={(e) => setCustomerRemarks(e.target.value)}
                className="w-full bg-surface-2-app border border-border-app rounded-xl p-2 text-xs"
                placeholder="Satisfactory cooling verified..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-border-app">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
            >
              {loading ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Job-Card</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
