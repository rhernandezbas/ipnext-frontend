import { describe, it, expect } from 'vitest';
import { getDefaultYearMonthRange, formatYearMonthLabel } from './financeGrowthDates';

describe('getDefaultYearMonthRange', () => {
  it('returns a [from, to] inclusive range ending at the reference month', () => {
    const range = getDefaultYearMonthRange(6, new Date('2026-07-27T12:00:00Z'));
    expect(range.to).toBe('2026-07');
    expect(range.from).toBe('2026-02');
  });

  it('rolls back across a year boundary', () => {
    const range = getDefaultYearMonthRange(3, new Date('2026-01-15T00:00:00Z'));
    expect(range.to).toBe('2026-01');
    expect(range.from).toBe('2025-11');
  });
});

describe('formatYearMonthLabel', () => {
  it('formats "YYYY-MM" as a short Spanish month + year label', () => {
    expect(formatYearMonthLabel('2026-07')).toBe('jul 2026');
  });
});
