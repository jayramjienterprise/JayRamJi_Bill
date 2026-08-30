'use client';

import { useState } from 'react';
import { Calendar, Filter, ArrowRight } from 'lucide-react';

export type DatePresetOption =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_QUARTER'
  | 'THIS_YEAR'
  | 'CUSTOM';

interface DateFilterBarProps {
  activePreset: DatePresetOption;
  customFrom: string;
  customTo: string;
  onFilterChange: (preset: DatePresetOption, from?: string, to?: string) => void;
  isLoading?: boolean;
}

const PRESETS: Array<{ id: DatePresetOption; label: string }> = [
  { id: 'TODAY', label: 'Today' },
  { id: 'YESTERDAY', label: 'Yesterday' },
  { id: 'THIS_WEEK', label: 'This Week' },
  { id: 'THIS_MONTH', label: 'This Month' },
  { id: 'LAST_MONTH', label: 'Last Month' },
  { id: 'THIS_QUARTER', label: 'This Quarter' },
  { id: 'THIS_YEAR', label: 'This Year' },
  { id: 'CUSTOM', label: 'Custom' },
];

export default function DateFilterBar({
  activePreset,
  customFrom,
  customTo,
  onFilterChange,
  isLoading = false,
}: DateFilterBarProps) {
  const [showCustomInputs, setShowCustomInputs] = useState(activePreset === 'CUSTOM');
  const [fromInput, setFromInput] = useState(customFrom || new Date().toISOString().split('T')[0]);
  const [toInput, setToInput] = useState(customTo || new Date().toISOString().split('T')[0]);

  function handlePresetClick(preset: DatePresetOption) {
    if (preset === 'CUSTOM') {
      setShowCustomInputs(true);
    } else {
      setShowCustomInputs(false);
      onFilterChange(preset);
    }
  }

  function handleCustomApply(e: React.FormEvent) {
    e.preventDefault();
    if (!fromInput || !toInput) return;
    onFilterChange('CUSTOM', fromInput, toInput);
  }

  return (
    <div className="bg-surface-app border border-border-app rounded-xl p-3.5 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Preset Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-text-muted text-xs font-semibold uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Period:</span>
          </span>
          {PRESETS.map((p) => {
            const isActive = activePreset === p.id && (!showCustomInputs || p.id === 'CUSTOM');
            return (
              <button
                key={p.id}
                type="button"
                disabled={isLoading}
                onClick={() => handlePresetClick(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-primary-700 text-white shadow-xs'
                    : 'bg-surface-2-app text-text-secondary hover:bg-surface-2-app/80 hover:text-text-primary'
                } disabled:opacity-50`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {showCustomInputs && (
        <form
          onSubmit={handleCustomApply}
          className="pt-3 border-t border-border-light flex flex-wrap items-center gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="text-text-secondary font-medium">From:</span>
            <div className="relative">
              <input
                type="date"
                required
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs text-text-primary font-medium focus:outline-none focus:border-primary-700"
              />
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-text-muted hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-text-secondary font-medium">To:</span>
            <div className="relative">
              <input
                type="date"
                required
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs text-text-primary font-medium focus:outline-none focus:border-primary-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Applying...' : 'Apply Range'}
          </button>
        </form>
      )}
    </div>
  );
}
