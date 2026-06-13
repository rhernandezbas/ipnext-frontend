/**
 * #79 — Pure SLA timer helpers: elapsed-minutes formatting and threshold color.
 *
 * The color escalates green → amber → red by the configurable thresholds. A
 * CLOSED ticket never escalates: its timer freezes in a neutral color (it is no
 * longer "running" against the SLA). These are pure functions — no clock, no DOM
 * — so the color logic can be pinned independently of the rendered column.
 */
import { describe, it, expect } from 'vitest';
import { slaTimerLevel, slaTimerColor, formatElapsed } from '@/utils/slaTimer';

const T = { warnMinutes: 60, dangerMinutes: 240 };

describe('#79 slaTimerLevel', () => {
  it('is "ok" below warnMinutes', () => {
    expect(slaTimerLevel(0, T, false)).toBe('ok');
    expect(slaTimerLevel(59, T, false)).toBe('ok');
  });

  it('is "warn" from warnMinutes up to (but not including) dangerMinutes', () => {
    expect(slaTimerLevel(60, T, false)).toBe('warn');
    expect(slaTimerLevel(239, T, false)).toBe('warn');
  });

  it('is "danger" at and beyond dangerMinutes', () => {
    expect(slaTimerLevel(240, T, false)).toBe('danger');
    expect(slaTimerLevel(10_000, T, false)).toBe('danger');
  });

  it('is always "closed" (neutral) for a closed ticket regardless of elapsed', () => {
    expect(slaTimerLevel(5, T, true)).toBe('closed');
    expect(slaTimerLevel(10_000, T, true)).toBe('closed');
  });
});

describe('#79 slaTimerColor', () => {
  it('maps each level to a distinct color, closed → neutral gray', () => {
    expect(slaTimerColor('ok')).toBe('#22c55e');
    expect(slaTimerColor('warn')).toBe('#f59e0b');
    expect(slaTimerColor('danger')).toBe('#dc2626');
    expect(slaTimerColor('closed')).toBe('#94a3b8');
  });
});

describe('#79 formatElapsed', () => {
  it('renders sub-hour minutes as "{n} min"', () => {
    expect(formatElapsed(0)).toBe('0 min');
    expect(formatElapsed(59)).toBe('59 min');
  });

  it('renders >= 1h as "{h}h {m}m"', () => {
    expect(formatElapsed(60)).toBe('1h 0m');
    expect(formatElapsed(125)).toBe('2h 5m');
  });

  it('returns "—" for a missing/NaN elapsed value', () => {
    expect(formatElapsed(NaN)).toBe('—');
  });
});
