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
        {/* Mobile Dropdown (xs to sm) */}
        <div className="sm:hidden w-full flex items-center justify-between gap-2">
          <span className="text-text-muted text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Period:</span>
          </span>
          <div className="relative flex-1 max-w-[200px]">
            <select
              value={showCustomInputs ? 'CUSTOM' : activePreset}
              onChange={(e) => handlePresetClick(e.target.value as DatePresetOption)}
              disabled={isLoading}
              className="w-full pl-3 pr-8 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none appearance-none cursor-pointer"
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-muted">
              <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Preset Badges (Desktop / Tablet sm+) */}
        <div className="hidden sm:flex flex-wrap items-center gap-1.5">
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
