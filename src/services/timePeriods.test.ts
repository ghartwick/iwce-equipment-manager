import { describe, expect, it } from 'vitest';
import { calculateTimePeriods } from './timePeriods';

describe('calculateTimePeriods', () => {
  it('excludes gaps from worked hours', () => {
    expect(calculateTimePeriods([{ clockIn: '08:00', clockOut: '12:00' }, { clockIn: '14:00', clockOut: '16:00' }])).toEqual({ hours: 6, error: null });
  });
  it('supports a single period and rounds once', () => {
    expect(calculateTimePeriods([{ clockIn: '08:00', clockOut: '09:20' }]).hours).toBe(1.33);
  });
  it('allows adjacent and out-of-order periods', () => {
    expect(calculateTimePeriods([{ clockIn: '12:00', clockOut: '14:00' }, { clockIn: '08:00', clockOut: '12:00' }])).toEqual({ hours: 6, error: null });
  });
  it.each([
    [{ clockIn: '08:00', clockOut: '' }],
    [{ clockIn: '12:00', clockOut: '08:00' }],
    [{ clockIn: '08:00', clockOut: '08:00' }],
    [{ clockIn: '08:00', clockOut: '12:00' }, { clockIn: '11:00', clockOut: '14:00' }]
  ])('rejects incomplete, reversed, zero-length, or overlapping periods: %j', (...periods) => {
    expect(calculateTimePeriods(periods).error).not.toBeNull();
  });
});
