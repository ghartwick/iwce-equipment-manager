export interface TimePeriod {
  clockIn: string;
  clockOut: string;
}

export function calculateTimePeriods(periods: TimePeriod[]): { hours: number; error: string | null } {
  const ranges: { start: number; end: number }[] = [];
  for (const [index, period] of periods.entries()) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(period.clockIn) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.clockOut)) {
      return { hours: 0, error: `Please select both in and out times for time period ${index + 1}.` };
    }
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const start = minutes(period.clockIn);
    const end = minutes(period.clockOut);
    if (end <= start) return { hours: 0, error: `Out time must be after in time for time period ${index + 1}.` };
    ranges.push({ start, end });
  }
  ranges.sort((a, b) => a.start - b.start);
  if (ranges.some((range, index) => index > 0 && range.start < ranges[index - 1].end)) {
    return { hours: 0, error: 'Time periods cannot overlap.' };
  }
  return { hours: Math.round(ranges.reduce((sum, range) => sum + range.end - range.start, 0) / 60 * 100) / 100, error: null };
}
