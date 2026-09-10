'use client';

import React from 'react';
import { X, ShieldCheck, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';

interface EntitlementModalProps {
  data: {
    contractNumber: string;
    totalCoveredUnits: number;
    entitlements: Array<{
      serviceType: string;
      scheduling: string;
      entitlementScope: string;
      targetQuota: number;
      completedCount: number;
      remainingCount: number;
    }>;
  };
  onClose: () => void;
}

export default function EntitlementModal({ data, onClose }: EntitlementModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-surface-app border border-border-app rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 sm:p-5 border-b border-border-app flex items-center justify-between bg-surface-2-app/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-text-primary">
                Contract Entitlement Audit: #{data.contractNumber}
              </h2>
              <p className="text-[11px] text-text-secondary">
                Authoritative Completed Visits Breakdown ({data.totalCoveredUnits} AC Units)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-2-app text-text-secondary cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-blue-50/50 border border-blue-200/50 rounded-xl p-3 text-xs text-blue-800">
            <p className="font-semibold flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>Real-Time Database Verification</span>
            </p>
            <p className="text-[11px] text-blue-700/80 mt-1">
              Visit counts are dynamically calculated directly from completed service records in the database to guarantee zero counter drift.
            </p>
          </div>

          <div className="space-y-3">
            {data.entitlements.map((ent, idx) => {
              const percent =
                ent.targetQuota > 0
                  ? Math.min(100, Math.round((ent.completedCount / ent.targetQuota) * 100))
                  : 0;

              return (
                <div
                  key={idx}
                  className="bg-surface-2-app/50 border border-border-app rounded-xl p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-black text-xs text-text-primary uppercase tracking-wide">
                        {ent.serviceType.replace('_', ' ')}
                      </span>
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-md bg-surface-app border border-border-app text-text-secondary font-semibold">
                        {ent.scheduling} • {ent.entitlementScope}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-text-primary">
                      {ent.completedCount} / {ent.targetQuota} Visits
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-border-app rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        percent >= 100 ? 'bg-emerald-500' : 'bg-primary-700'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-text-secondary">
                    <span>{percent}% Completed</span>
                    <span className="font-semibold text-text-primary">
                      {ent.remainingCount} Remaining
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
