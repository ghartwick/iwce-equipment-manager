import { describe, expect, it } from 'vitest';
import { ServiceReading } from './serviceScheduleService';
import { historicalPeakRate, validateReading } from './readingValidation';

function reading(value: number, date: string, voided?: boolean): ServiceReading {
  return { value, date, voided };
}

// Roughly 8 hours per day of use, so a peak rate near 8.
const steadyHistory: ServiceReading[] = [
  reading(100, '2026-01-01'),
  reading(180, '2026-01-11'),
  reading(260, '2026-01-21'),
  reading(340, '2026-01-31'),
];

describe('validateReading — impossible values', () => {
  it('blocks a reading below the highest recorded value', () => {
    const result = validateReading(300, '2026-02-05', steadyHistory);
    expect(result.severity).toBe('block');
    expect(result.code).toBe('backwards');
    expect(result.previous).toEqual({ value: 340, date: '2026-01-31' });
    expect(result.message).toContain('340');
  });

  it('blocks a negative reading', () => {
    expect(validateReading(-5, '2026-02-05', steadyHistory).code).toBe('negative');
  });

  it('compares against the highest value, not the most recent one', () => {
    // A low outlier filed most recently must not lower the accepted floor.
    const withOutlier = [...steadyHistory, reading(120, '2026-02-01')];
    const result = validateReading(200, '2026-02-05', withOutlier);
    expect(result.severity).toBe('block');
    expect(result.previous?.value).toBe(340);
  });

  it('ignores voided readings when establishing the floor', () => {
    const withVoided = [...steadyHistory, reading(9999, '2026-02-01', true)];
    const result = validateReading(400, '2026-02-05', withVoided);
    expect(result.severity).toBe('ok');
  });
});

describe('validateReading — accepted values', () => {
  it('accepts a plausible increase', () => {
    const result = validateReading(400, '2026-02-05', steadyHistory);
    expect(result.severity).toBe('ok');
    expect(result.code).toBeNull();
  });

  it('accepts the first ever reading and flags it as the baseline', () => {
    const result = validateReading(1200, '2026-02-05', []);
    expect(result.severity).toBe('ok');
    expect(result.code).toBe('first-reading');
  });

  it('accepts a missing value so an empty field is not an error', () => {
    expect(validateReading(undefined, '2026-02-05', steadyHistory).severity).toBe('ok');
  });

  it('warns but does not block when unchanged', () => {
    const result = validateReading(340, '2026-02-05', steadyHistory);
    expect(result.severity).toBe('warn');
    expect(result.code).toBe('no-change');
  });
});

describe('validateReading — implausible jumps', () => {
  it('warns on a typo that inflates the reading by an order of magnitude', () => {
    // 3400 instead of 400, five days after the last reading of 340.
    const result = validateReading(3400, '2026-02-05', steadyHistory);
    expect(result.severity).toBe('warn');
    expect(result.code).toBe('implausible-rate');
  });

  it('does not warn when there is too little history to calibrate', () => {
    const sparse = [reading(100, '2026-01-01'), reading(180, '2026-01-11')];
    expect(validateReading(9000, '2026-02-05', sparse).severity).toBe('ok');
  });

  it('honours an explicit maxPerDay ceiling', () => {
    const result = validateReading(700, '2026-02-05', steadyHistory, { maxPerDay: 24 });
    // 360 gained over 5 days is 72/day, above the 24 hour physical ceiling.
    expect(result.code).toBe('implausible-rate');
  });

  it('accepts a busy but physically possible day under the hours ceiling', () => {
    const result = validateReading(440, '2026-02-05', steadyHistory, { maxPerDay: 24 });
    // 100 gained over 5 days is 20/day, under the ceiling.
    expect(result.severity).toBe('ok');
  });

  it('does not divide by zero for a same-day reading', () => {
    const result = validateReading(350, '2026-01-31', steadyHistory, { maxPerDay: 24 });
    expect(result.severity).toBe('ok');
  });
});

describe('historicalPeakRate', () => {
  it('derives the peak usage per day from consecutive readings', () => {
    expect(historicalPeakRate(steadyHistory)).toBeCloseTo(8, 5);
  });

  it('returns null without enough readings', () => {
    expect(historicalPeakRate([reading(1, '2026-01-01'), reading(2, '2026-01-02')])).toBeNull();
  });

  it('ignores backwards gaps rather than producing a negative rate', () => {
    const messy = [reading(100, '2026-01-01'), reading(50, '2026-01-05'), reading(150, '2026-01-15')];
    const peak = historicalPeakRate(messy);
    expect(peak).not.toBeNull();
    expect(peak!).toBeGreaterThan(0);
  });
});
