'use client';

import { PaymentMethodBreakdown, PaymentMethod } from '../../../lib/api/types';
import { Smartphone, Building2, Banknote, CheckSquare, QrCode, CreditCard } from 'lucide-react';

interface PaymentMethodsSummaryCardProps {
  methods: PaymentMethodBreakdown[];
  title?: string;
  subtitle?: string;
}

export function getPaymentMethodIcon(method: PaymentMethod | string) {
  switch (method) {
    case 'UPI':
      return <Smartphone className="w-4 h-4 text-purple-600" />;
    case 'BANK_TRANSFER':
      return <Building2 className="w-4 h-4 text-blue-600" />;
    case 'CASH':
      return <Banknote className="w-4 h-4 text-emerald-600" />;
    case 'CHEQUE':
      return <CheckSquare className="w-4 h-4 text-amber-600" />;
    case 'QR_CODE':
      return <QrCode className="w-4 h-4 text-indigo-600" />;
    default:
      return <CreditCard className="w-4 h-4 text-slate-600" />;
  }
}

export function getPaymentMethodColor(method: PaymentMethod | string) {
  switch (method) {
    case 'UPI':
      return 'bg-purple-500';
    case 'BANK_TRANSFER':
      return 'bg-blue-500';
    case 'CASH':
      return 'bg-emerald-500';
    case 'CHEQUE':
      return 'bg-amber-500';
    case 'QR_CODE':
      return 'bg-indigo-500';
    default:
      return 'bg-slate-500';
  }
}

export default function PaymentMethodsSummaryCard({
  methods,
  title = 'Payment Methods',
  subtitle = 'Breakdown of money received by payment channel.',
}: PaymentMethodsSummaryCardProps) {
  const totalAmountMinor = methods.reduce((sum, m) => sum + m.amountMinor, 0);

  if (methods.length === 0 || totalAmountMinor === 0) {
    return (
      <div className="bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-3">
        <div className="border-b border-border-light pb-2">
          <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-primary-700" />
            <span>{title}</span>
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="py-8 text-center text-text-muted text-xs">
          No payment transactions recorded during this period.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
      <div className="border-b border-border-light pb-2 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-primary-700" />
            <span>{title}</span>
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-text-muted uppercase font-semibold block">Total Received</span>
          <span className="font-bold text-emerald-600 text-xs">
            ₹{(totalAmountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Proportional Stacked Progress Bar */}
      <div className="h-3 w-full bg-surface-2-app rounded-full overflow-hidden flex shadow-inner">
        {methods.map((m) => {
          if (m.percentage <= 0) return null;
          return (
            <div
              key={m.method}
              style={{ width: `${m.percentage}%` }}
              title={`${m.label}: ₹${(m.amountMinor / 100).toLocaleString('en-IN')} (${m.percentage}%)`}
              className={`h-full ${getPaymentMethodColor(m.method)} transition-all`}
            ></div>
          );
        })}
      </div>

      {/* Breakdown List */}
      <div className="space-y-2.5 pt-1">
        {methods.map((m) => (
          <div key={m.method} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-surface-2-app border border-border-app">
                {getPaymentMethodIcon(m.method)}
              </div>
              <div>
                <p className="font-bold text-text-primary">{m.label}</p>
                <p className="text-[10px] text-text-muted">
                  {m.count} {m.count === 1 ? 'transaction' : 'transactions'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-bold text-text-primary">
                ₹{(m.amountMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10.5px] font-semibold text-text-secondary">{m.percentage}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
