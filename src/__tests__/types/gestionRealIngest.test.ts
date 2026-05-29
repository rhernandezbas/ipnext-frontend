import { describe, it, expect } from 'vitest';
import {
  INTERVAL_PRESETS_MIN,
  minutesToMs,
  msToMinutes,
  resolveIntervalPreset,
} from '@/types/gestionRealIngest';

describe('INTERVAL_PRESETS_MIN', () => {
  it('lists the settled minute presets', () => {
    expect(INTERVAL_PRESETS_MIN).toEqual([3, 5, 15, 30, 60]);
  });
});

describe('minutesToMs', () => {
  it('converts minutes to milliseconds', () => {
    expect(minutesToMs(5)).toBe(300000);
    expect(minutesToMs(3)).toBe(180000);
  });
});

describe('msToMinutes', () => {
  it('converts milliseconds back to minutes', () => {
    expect(msToMinutes(300000)).toBe(5);
  });

  it('rounds non-exact millisecond values to the nearest minute', () => {
    expect(msToMinutes(123456)).toBe(2);
  });
});

describe('resolveIntervalPreset', () => {
  it('returns the matching preset when intervalMs maps to a known preset', () => {
    expect(resolveIntervalPreset(300000)).toEqual({ minutes: 5, isPreset: true });
  });

  it('handles a non-preset intervalMs gracefully as a custom value', () => {
    expect(resolveIntervalPreset(123456)).toEqual({ minutes: 2, isPreset: false });
  });
});
