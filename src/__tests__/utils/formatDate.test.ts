import { describe, it, expect } from 'vitest';
import {
  formatDateTime,
  formatRelative,
  formatDateTimeShort,
  formatDateShort,
} from '@/utils/formatDate';

// ── formatDateTime (legacy, #77) ──────────────────────────────────────────────

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

// ── formatDateTimeShort (canonical #83: "08 sep 2025 - 13:45") ─────────────────

describe('formatDateTimeShort', () => {
  it('formats a local ISO datetime as "DD mmm YYYY - HH:MM" (24h, lowercase 3-letter month)', () => {
    // No trailing Z → parsed as local time, so HH:MM is deterministic.
    expect(formatDateTimeShort('2025-09-08T13:45:00')).toBe('08 sep 2025 - 13:45');
  });

  it('zero-pads the day and uses 24h hours with leading zeros', () => {
    expect(formatDateTimeShort('2025-01-05T09:07:00')).toBe('05 ene 2025 - 09:07');
  });

  it('formats December correctly (dic)', () => {
    expect(formatDateTimeShort('2024-12-31T23:59:00')).toBe('31 dic 2024 - 23:59');
  });

  it('returns the em dash for null', () => {
    expect(formatDateTimeShort(null)).toBe('—');
  });

  it('returns the em dash for undefined', () => {
    expect(formatDateTimeShort(undefined)).toBe('—');
  });

  it('returns the em dash for an empty string', () => {
    expect(formatDateTimeShort('')).toBe('—');
  });

  it('returns the em dash for an invalid date', () => {
    expect(formatDateTimeShort('not-a-date')).toBe('—');
  });
});

// ── formatDateShort (canonical date-only #83: "08 sep 2025") ───────────────────

describe('formatDateShort', () => {
  it('formats a date as "DD mmm YYYY" with no time', () => {
    expect(formatDateShort('2025-09-08T13:45:00')).toBe('08 sep 2025');
  });

  it('handles a plain YYYY-MM-DD date (no time component)', () => {
    // A date-only string is parsed as UTC midnight; format from its UTC parts
    // so the calendar day is preserved regardless of the runner timezone.
    expect(formatDateShort('2025-09-08')).toBe('08 sep 2025');
  });

  it('treats an ISO-Z midnight as date-only (no TZ shift to the previous day)', () => {
    // #83 re-review — prod serializes contract startDate/endDate (and invoice
    // issuedAt/dueAt) as a FULL ISO at UTC midnight, e.g. "2025-09-08T00:00:00.000Z".
    // In AR (UTC-3) the local instant is the prior day at 21:00, which would render
    // "07 sep 2025" if we used local parts. A date-only value must show its literal
    // calendar day regardless of the runner timezone → use UTC parts.
    expect(formatDateShort('2025-09-08T00:00:00.000Z')).toBe('08 sep 2025');
    // Same with the no-millis form.
    expect(formatDateShort('2025-09-08T00:00:00Z')).toBe('08 sep 2025');
  });

  it('still uses LOCAL parts for a real timestamp with a non-midnight time', () => {
    // A timestamp carrying a real wall-clock time is NOT date-only: it must be
    // rendered in the host timezone. No trailing Z → parsed as local, so the
    // calendar day is deterministic across runners.
    expect(formatDateShort('2025-09-08T13:45:00')).toBe('08 sep 2025');
  });

  it('returns the em dash for null', () => {
    expect(formatDateShort(null)).toBe('—');
  });

  it('returns the em dash for an invalid date', () => {
    expect(formatDateShort('not-a-date')).toBe('—');
  });
});

// ── formatRelative (legacy, #44/#48) ──────────────────────────────────────────

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
    // 60 days ago falls back to the canonical short date
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
