'use client';

import { useState } from 'react';
import { TimeSeriesPoint } from '../../../lib/api/types';
import { TrendingUp, HelpCircle } from 'lucide-react';

interface SalesOverviewChartProps {
  series: TimeSeriesPoint[];
  currency?: string;
  title?: string;
  subtitle?: string;
  height?: number;
}

export default function SalesOverviewChart({
  series,
  currency = 'INR',
  title = 'Sales Overview',
  subtitle = 'Sales turnover vs payments received over the selected period.',
  height = 240,
}: SalesOverviewChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<TimeSeriesPoint | null>(null);

  // Compute maximum value for chart scaling
  const maxVal = Math.max(
    ...series.map((s) => Math.max(s.salesMinor, s.receivedMinor)),
    10000 // default minimum ceiling (₹100)
  );

  const totalSales = series.reduce((sum, s) => sum + s.salesMinor, 0);
  const totalReceived = series.reduce((sum, s) => sum + s.receivedMinor, 0);

  if (series.length === 0) {
    return (
      <div className="bg-surface-app border border-border-app rounded-xl p-6 shadow-xs text-center space-y-3">
        <div className="flex items-center justify-between border-b border-border-light pb-3">
          <div>
            <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary-700" />
              <span>{title}</span>
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="py-12 text-text-muted text-xs">
          No finalized sales or payment data recorded for this selected period.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-app border border-border-app rounded-xl p-5 shadow-xs space-y-4">
      {/* Header & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-light pb-3">
        <div>
          <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary-700" />
            <span>{title}</span>
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-primary-700"></div>
            <span className="text-text-secondary">Sales Turnover</span>
            <span className="font-bold text-text-primary text-[11px]">
              (₹{(totalSales / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-emerald-500"></div>
            <span className="text-text-secondary">Money Received</span>
            <span className="font-bold text-emerald-600 text-[11px]">
              (₹{(totalReceived / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })})
            </span>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative pt-2" style={{ height: `${height}px` }}>
        {/* Y-Axis Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-text-muted">
          <div className="border-b border-border-light/60 pb-0.5">
            ₹{(maxVal / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="border-b border-border-light/40 pb-0.5">
            ₹{((maxVal * 0.5) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="border-b border-border-light/80 pb-0.5">₹0</div>
        </div>

        {/* Dynamic Dual-Bar / Column Graph */}
        <div className="absolute inset-0 pt-4 flex items-end justify-around gap-1 sm:gap-2 px-6">
          {series.map((pt, idx) => {
            const salesHeightPct = Math.min(100, Math.max(2, (pt.salesMinor / maxVal) * 100));
            const receivedHeightPct = Math.min(100, Math.max(2, (pt.receivedMinor / maxVal) * 100));
            const isHovered = hoveredPoint?.period === pt.period;

            return (
              <div
                key={pt.period || idx}
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
              >
                {/* Dual Bars Container */}
                <div className="w-full max-w-[40px] flex items-end justify-center gap-1 h-full">
                  {/* Sales Bar */}
                  <div
                    style={{ height: `${salesHeightPct}%` }}
                    className={`w-1/2 rounded-t-sm transition-all duration-150 ${
                      isHovered ? 'bg-primary-600 shadow-md scale-105' : 'bg-primary-700/85 hover:bg-primary-700'
                    }`}
                  ></div>

                  {/* Received Bar */}
                  <div
                    style={{ height: `${receivedHeightPct}%` }}
                    className={`w-1/2 rounded-t-sm transition-all duration-150 ${
                      isHovered ? 'bg-emerald-400 shadow-md scale-105' : 'bg-emerald-500/85 hover:bg-emerald-500'
                    }`}
                  ></div>
                </div>

                {/* X-Axis Label */}
                <div className="text-[10px] font-medium text-text-muted mt-2 truncate max-w-[60px] text-center">
                  {pt.dateLabel || pt.period}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover Floating Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-2 right-4 bg-slate-900 text-white rounded-xl p-3 shadow-xl border border-slate-700 text-xs space-y-1.5 z-20 pointer-events-none animate-in fade-in zoom-in-95 duration-100 min-w-[170px]">
            <p className="font-bold text-slate-300 border-b border-slate-800 pb-1">
              {hoveredPoint.dateLabel || hoveredPoint.period}
            </p>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Sales Turnover:</span>
              <span className="font-bold text-primary-400">
                ₹{(hoveredPoint.salesMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Received:</span>
              <span className="font-bold text-emerald-400">
                ₹{(hoveredPoint.receivedMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {hoveredPoint.invoiceCount !== undefined && (
              <div className="flex justify-between items-center text-[11px] border-t border-slate-800 pt-1 text-slate-400">
                <span>Invoices Created:</span>
                <span className="font-bold text-slate-200">{hoveredPoint.invoiceCount}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
