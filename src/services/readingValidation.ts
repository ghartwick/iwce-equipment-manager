import { MS_PER_DAY, ServiceReading } from './serviceScheduleService';

export type ReadingSeverity = 'ok' | 'warn' | 'block';

export type ReadingIssueCode =
  | 'first-reading'
  | 'negative'
  | 'backwards'
  | 'no-change'
  | 'implausible-rate';

export interface ReadingValidation {
  severity: ReadingSeverity;
  code: ReadingIssueCode | null;
  message: string | null;
  // The reading the new value was judged against, if any.
  previous: { value: number; date: string } | null;
}

export interface ValidateReadingOptions {
  // Explicit ceiling on units gained per day. Engine hours have a hard physical
  // ceiling of 24. Distance has no physical ceiling, so callers pass a
  // fleet-appropriate figure or omit it to fall back on self-calibration.
  maxPerDay?: number;
  // Multiple of a unit's own historical peak usage that counts as implausible.
  rateTolerance?: number;
  label?: string;
}

const OK: ReadingValidation = { severity: 'ok', code: null, message: null, previous: null };

function timeOf(date: string): number {
  return new Date(date).getTime();
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatDate(date: string): string {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString();
}

/**
 * Highest usage-per-day this unit has ever actually achieved, derived from gaps
 * between consecutive readings. Self-calibrating, so it works regardless of
 * whether the meter counts hours or distance. Returns null when there is too
 * little history to draw a conclusion.
 */
export function historicalPeakRate(readings: ServiceReading[]): number | null {
  const sorted = readings
    .filter(r => !r.voided)
    .slice()
    .sort((a, b) => timeOf(a.date) - timeOf(b.date));
  if (sorted.length < 3) return null;

  let peak = 0;
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].value - sorted[i - 1].value;
    if (delta <= 0) continue;
    const days = Math.max((timeOf(sorted[i].date) - timeOf(sorted[i - 1].date)) / MS_PER_DAY, 1);
    const rate = delta / days;
    if (rate > peak) peak = rate;
  }

  return peak > 0 ? peak : null;
}

/**
 * Validates a newly entered meter reading against the unit's history.
 *
 * A reading below the highest previously recorded value is physically
 * impossible, so it blocks. An implausibly large jump only warns, since it is a
 * heuristic and unusual-but-real spikes do happen.
 */
export function validateReading(
  value: number | undefined,
  date: string,
  priorReadings: ServiceReading[],
  options: ValidateReadingOptions = {}
): ReadingValidation {
  if (value == null || Number.isNaN(value)) return OK;

  const label = options.label ?? 'reading';

  if (value < 0) {
    return {
      severity: 'block',
      code: 'negative',
      message: `A ${label} cannot be negative.`,
      previous: null,
    };
  }

  const valid = priorReadings.filter(r => !r.voided);
  if (valid.length === 0) {
    return {
      severity: 'ok',
      code: 'first-reading',
      message: `First recorded ${label} for this unit — it becomes the baseline.`,
      previous: null,
    };
  }

  // Compared against the highest prior value, matching the scheduling engine's
  // ratchet, so a single low outlier cannot quietly widen the accepted range.
  const highest = valid.reduce((max, r) => (r.value > max.value ? r : max), valid[0]);
  const previous = { value: highest.value, date: highest.date };

  if (value < highest.value) {
    return {
      severity: 'block',
      code: 'backwards',
      message:
        `This ${label} is lower than the highest recorded value of ${formatNumber(highest.value)} ` +
        `on ${formatDate(highest.date)}. Meters do not run backwards — check for a typo. ` +
        `If the meter was replaced or the earlier entry was wrong, an admin must void that reading first.`,
      previous,
    };
  }

  if (value === highest.value) {
    return {
      severity: 'warn',
      code: 'no-change',
      message: `Unchanged from the last ${label} of ${formatNumber(highest.value)} on ${formatDate(highest.date)}. Confirm the unit has not been used.`,
      previous,
    };
  }

  const limit = options.maxPerDay ?? (() => {
    const peak = historicalPeakRate(valid);
    return peak == null ? null : peak * (options.rateTolerance ?? 5);
  })();

  if (limit != null && limit > 0) {
    const delta = value - highest.value;
    // A one-day floor absorbs same-day and late data entry, which would
    // otherwise divide by a near-zero elapsed time.
    const days = Math.max((timeOf(date) - timeOf(highest.date)) / MS_PER_DAY, 1);
    const perDay = delta / days;
    if (perDay > limit) {
      return {
        severity: 'warn',
        code: 'implausible-rate',
        message:
          `That is a jump of ${formatNumber(delta)} in ${formatNumber(days)} day(s) ` +
          `(about ${formatNumber(perDay)} per day), well above what this unit normally accumulates ` +
          `(around ${formatNumber(limit)} per day). Double-check the ${label} for a typo.`,
        previous,
      };
    }
  }

  return { ...OK, previous };
}
