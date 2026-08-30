export type DatePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_QUARTER'
  | 'THIS_YEAR'
  | 'CUSTOM'
  | 'ALL_TIME';

export interface ResolvedDateRange {
  startDate: Date;
  endDate: Date;
  preset: DatePreset;
  previousStartDate?: Date;
  previousEndDate?: Date;
  groupBy: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Resolves a date preset or custom from/to range into exact UTC boundaries
 * along with previous comparison period boundaries.
 */
export function resolveDateRange(params: {
  preset?: string;
  from?: string;
  to?: string;
  groupBy?: string;
}): ResolvedDateRange {
  const now = new Date();
  
  // Create start of today (00:00:00.000) and end of today (23:59:59.999)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let preset: DatePreset = (params.preset?.toUpperCase() as DatePreset) || 'THIS_MONTH';
  let startDate: Date = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  let endDate: Date = endOfToday;
  let previousStartDate: Date | undefined;
  let previousEndDate: Date | undefined;
  let defaultGroupBy: 'hour' | 'day' | 'week' | 'month' = 'day';

  if (params.from || params.to) {
    preset = 'CUSTOM';
    if (params.from) {
      const parts = params.from.split('-');
      if (parts.length === 3) {
        startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0);
      } else {
        startDate = new Date(params.from);
      }
    } else {
      startDate = new Date(2020, 0, 1);
    }

    if (params.to) {
      const parts = params.to.split('-');
      if (parts.length === 3) {
        endDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999);
      } else {
        endDate = new Date(params.to);
      }
    } else {
      endDate = endOfToday;
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    previousEndDate = new Date(startDate.getTime() - 1);
    previousStartDate = new Date(previousEndDate.getTime() - durationMs);
  } else {
    switch (preset) {
      case 'TODAY': {
        startDate = startOfToday;
        endDate = endOfToday;
        previousStartDate = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        previousEndDate = new Date(endOfToday.getTime() - 24 * 60 * 60 * 1000);
        defaultGroupBy = 'hour';
        break;
      }
      case 'YESTERDAY': {
        startDate = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        endDate = new Date(endOfToday.getTime() - 24 * 60 * 60 * 1000);
        previousStartDate = new Date(startOfToday.getTime() - 2 * 24 * 60 * 60 * 1000);
        previousEndDate = new Date(endOfToday.getTime() - 2 * 24 * 60 * 60 * 1000);
        defaultGroupBy = 'hour';
        break;
      }
      case 'THIS_WEEK': {
        const day = now.getDay(); // 0 is Sunday, 1 is Monday
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
        endDate = endOfToday;
        previousStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousEndDate = new Date(startDate.getTime() - 1);
        defaultGroupBy = 'day';
        break;
      }
      case 'THIS_MONTH': {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = endOfToday;
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        defaultGroupBy = 'day';
        break;
      }
      case 'LAST_MONTH': {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
        previousEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
        defaultGroupBy = 'day';
        break;
      }
      case 'THIS_QUARTER': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0);
        endDate = endOfToday;
        previousStartDate = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1, 0, 0, 0, 0);
        previousEndDate = new Date(now.getFullYear(), currentQuarter * 3, 0, 23, 59, 59, 999);
        defaultGroupBy = 'week';
        break;
      }
      case 'THIS_YEAR': {
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        endDate = endOfToday;
        previousStartDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
        previousEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        defaultGroupBy = 'month';
        break;
      }
      case 'ALL_TIME': {
        startDate = new Date(2020, 0, 1, 0, 0, 0, 0);
        endDate = endOfToday;
        defaultGroupBy = 'month';
        break;
      }
      default: {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = endOfToday;
        defaultGroupBy = 'day';
        break;
      }
    }
  }

  // Determine granularity based on day duration if not explicitly passed
  let groupBy = (params.groupBy as any) || defaultGroupBy;
  if (!params.groupBy) {
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) groupBy = 'hour';
    else if (diffDays <= 31) groupBy = 'day';
    else if (diffDays <= 92) groupBy = 'week';
    else groupBy = 'month';
  }

  return {
    startDate,
    endDate,
    preset,
    previousStartDate,
    previousEndDate,
    groupBy,
  };
}
