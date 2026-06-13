import { describe, it, expect } from 'vitest';
import { formatDateTime, formatRelative } from '@/utils/formatDate';

// ── formatDateTime ────────────────────────────────────────────────────────────

describe('formatDateTime', () => {
  it('formats a valid ISO string to es-AR locale — contains expected parts', () => {
    // 2024-01-15T10:00:00Z — we check structural parts rather than an exact
    // string to avoid timezone flakiness across environments.
    const result = formatDateTime('2024-01-15T10:00:00Z');
    // Year must be present
    expect(result).toMatch(/2024/);
    // Day must be present (15)
    expect(result).toMatch(/15/);
    // Hour/minute separator colon
    expect(result).toMatch(/:/);
    // Must NOT be the raw ISO string
    expect(result).not.toBe('2024-01-15T10:00:00Z');
  });

  it('returns the raw ISO string as fallback when input is invalid', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });

  it('returns the raw string for an empty string', () => {
    expect(formatDateTime('')).toBe('');
  });
});

// ── formatRelative ────────────────────────────────────────────────────────────

describe('formatRelative', () => {
  it('returns a relative string for a recent date ("hace")', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = formatRelative(fiveMinutesAgo);
    expect(result).toMatch(/hace/i);
  });

  it('returns a relative string for a date 3 days ago (not an absolute date)', () => {
    // Intl.RelativeTimeFormat with numeric:'auto' may return "anteayer" for 2 days.
    // Use 3 days to get a numeric form like "hace 3 días".
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelative(threeDaysAgo);
    // Should contain 3 and be a relative expression (not fall back to absolute date)
    expect(result).toMatch(/3/);
    // Must NOT look like an absolute date (no year like 2024/2025/2026)
    expect(result).not.toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });

  it('returns a localized date string for a date more than 30 days ago', () => {
    // 60 days ago falls back to toLocaleDateString es-AR
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelative(old);
    // Must not contain "hace" — it's an absolute date
    expect(result).not.toMatch(/^hace/i);
    // Must contain a year (4 digits)
    expect(result).toMatch(/\d{4}/);
  });

  it('returns the raw string as fallback when input is invalid', () => {
    expect(formatRelative('not-a-date')).toBe('not-a-date');
  });
});
