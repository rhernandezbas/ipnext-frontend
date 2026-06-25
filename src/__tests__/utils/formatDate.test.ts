import { describe, it, expect } from 'vitest';
import {
  formatDateTime,
  formatRelative,
  formatDateTimeShort,
  formatDateShort,
} from '@/utils/formatDate';

// All wall-clock assertions use UTC ISO inputs (trailing "Z") with the expected
// Argentina-time output. Argentina is a fixed UTC-3 (no DST since 2009), so the
// results are deterministic regardless of the test runner's host timezone — that
// is the whole point of the fix (bug 2026-06-25): timestamps must render in AR
// time, not in the viewer's machine timezone.

// ── formatDateTime (legacy, #77) ──────────────────────────────────────────────

describe('formatDateTime', () => {
  it('formats a valid ISO string to es-AR locale — contains expected parts', () => {
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

// ── formatDateTimeShort (canonical #83: "08 sep 2025 - 13:45", in AR time) ─────

describe('formatDateTimeShort', () => {
  it('formats a UTC datetime as "DD mmm YYYY - HH:MM" (24h) in Argentina time', () => {
    // 16:45Z → 13:45 AR (UTC-3).
    expect(formatDateTimeShort('2025-09-08T16:45:00Z')).toBe('08 sep 2025 - 13:45');
  });

  it('zero-pads the day and uses 24h hours with leading zeros (AR time)', () => {
    // 12:07Z → 09:07 AR.
    expect(formatDateTimeShort('2025-01-05T12:07:00Z')).toBe('05 ene 2025 - 09:07');
  });

  it('formats December correctly (dic) crossing the year boundary back to AR', () => {
    // 02:59Z on Jan 1 → 23:59 AR on Dec 31 of the prior year.
    expect(formatDateTimeShort('2025-01-01T02:59:00Z')).toBe('31 dic 2024 - 23:59');
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

  // BUG 2026-06-25 — wall-clock timestamps MUST render in Argentina time (UTC-3),
  // deterministically, regardless of the host/browser timezone. The "Errores de
  // auth" tab showed "25 jun 2026 - 02:07" (raw UTC) when the real AR time was
  // 23:07 of the 24th.
  it('renders a UTC timestamp in Argentina time (UTC-3), crossing the day boundary back', () => {
    // 02:07Z → 23:07 AR of the PREVIOUS day. The exact reported bug.
    expect(formatDateTimeShort('2026-06-25T02:07:00.000Z')).toBe('24 jun 2026 - 23:07');
  });

  it('renders AR time independent of the host timezone (Z input, mid-day)', () => {
    // 16:30Z → 13:30 AR, same day.
    expect(formatDateTimeShort('2025-09-08T16:30:00Z')).toBe('08 sep 2025 - 13:30');
  });
});

// ── formatDateShort (canonical date-only #83: "08 sep 2025") ───────────────────

describe('formatDateShort', () => {
  it('formats a real timestamp by its Argentina calendar day', () => {
    // 16:45Z → 13:45 AR, still Sep 8.
    expect(formatDateShort('2025-09-08T16:45:00Z')).toBe('08 sep 2025');
  });

  it('handles a plain YYYY-MM-DD date (no time component)', () => {
    // A date-only string is parsed as UTC midnight; format from its UTC parts
    // so the calendar day is preserved regardless of the runner timezone.
    expect(formatDateShort('2025-09-08')).toBe('08 sep 2025');
  });

  it('treats an ISO-Z midnight as date-only (no TZ shift to the previous day)', () => {
    // #83 re-review — prod serializes contract startDate/endDate (and invoice
    // issuedAt/dueAt) as a FULL ISO at UTC midnight, e.g. "2025-09-08T00:00:00.000Z".
    // A date-only value must show its literal calendar day regardless of timezone
    // → use UTC parts (NOT shifted to "07 sep" by the AR offset).
    expect(formatDateShort('2025-09-08T00:00:00.000Z')).toBe('08 sep 2025');
    // Same with the no-millis form.
    expect(formatDateShort('2025-09-08T00:00:00Z')).toBe('08 sep 2025');
  });

  it('treats UTC-midnight serializer variants (+00:00, lowercase z) as date-only', () => {
    // Hardening: a date-only field could be serialized with an explicit +00:00
    // offset or a lowercase z instead of "Z". These must still show the literal
    // day, NOT shift to the prior day on a non-AR host.
    expect(formatDateShort('2025-09-08T00:00:00.000+00:00')).toBe('08 sep 2025');
    expect(formatDateShort('2025-09-08T00:00:00+00:00')).toBe('08 sep 2025');
    expect(formatDateShort('2025-09-08T00:00:00z')).toBe('08 sep 2025');
  });

  it('uses the AR calendar day for a real timestamp near midnight (crosses the day)', () => {
    // 02:00Z is NOT date-only (non-midnight after the AR shift): in AR it is
    // 23:00 of the PRIOR day, so the date-only render must be the prior day.
    expect(formatDateShort('2025-09-08T02:00:00Z')).toBe('07 sep 2025');
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
