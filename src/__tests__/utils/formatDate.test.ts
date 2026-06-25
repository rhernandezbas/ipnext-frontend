import { describe, it, expect } from 'vitest';
import {
  formatDateTime,
  formatRelative,
  formatDateTimeShort,
  formatDateShort,
  formatTimeShort,
  toArIsoDate,
  arHour,
  arDayStartUtc,
  arDayEndUtc,
  formatDateLong,
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

// ── formatTimeShort (Fase 2a: "HH:MM" 24h, in AR time) ─────────────────────────

describe('formatTimeShort', () => {
  it('formats a UTC instant as HH:MM in Argentina time', () => {
    // 16:45Z → 13:45 AR.
    expect(formatTimeShort('2025-09-08T16:45:00Z')).toBe('13:45');
  });

  it('zero-pads hours and minutes', () => {
    // 12:07Z → 09:07 AR.
    expect(formatTimeShort('2025-01-05T12:07:00Z')).toBe('09:07');
  });

  it('renders the late-evening AR hour for a next-UTC-day instant', () => {
    // 01:30Z (Jun 2) → 22:30 AR (Jun 1). The calendar-bucketing scenario.
    expect(formatTimeShort('2026-06-02T01:30:00Z')).toBe('22:30');
  });

  it('accepts a Date instance', () => {
    expect(formatTimeShort(new Date('2025-09-08T16:45:00Z'))).toBe('13:45');
  });

  it('returns the em dash for null / undefined / empty / invalid', () => {
    expect(formatTimeShort(null)).toBe('—');
    expect(formatTimeShort(undefined)).toBe('—');
    expect(formatTimeShort('')).toBe('—');
    expect(formatTimeShort('not-a-date')).toBe('—');
  });
});

// ── toArIsoDate (Fase 2a: "YYYY-MM-DD" of the AR calendar day) ─────────────────

describe('toArIsoDate', () => {
  it('returns the AR calendar day of a mid-day UTC instant', () => {
    // 16:45Z → 13:45 AR, still Sep 8.
    expect(toArIsoDate('2025-09-08T16:45:00Z')).toBe('2025-09-08');
  });

  it('buckets a 22:30 AR task (= next UTC day) into the AR day, not the UTC day', () => {
    // 01:30Z Jun 2 = 22:30 AR Jun 1 → bucket = Jun 1 (the bug condition).
    expect(toArIsoDate('2026-06-02T01:30:00Z')).toBe('2026-06-01');
  });

  it('buckets an early-morning UTC instant that is still the prior AR day', () => {
    // 02:00Z Sep 8 = 23:00 AR Sep 7 → bucket = Sep 7.
    expect(toArIsoDate('2025-09-08T02:00:00Z')).toBe('2025-09-07');
  });

  it('accepts a Date instance', () => {
    expect(toArIsoDate(new Date('2026-06-02T01:30:00Z'))).toBe('2026-06-01');
  });

  it('returns an empty string for null / undefined / empty / invalid', () => {
    expect(toArIsoDate(null)).toBe('');
    expect(toArIsoDate(undefined)).toBe('');
    expect(toArIsoDate('')).toBe('');
    expect(toArIsoDate('not-a-date')).toBe('');
  });
});

// ── arHour (Fase 2a: hour-of-day 0-23 in AR time) ─────────────────────────────

describe('arHour', () => {
  it('returns the AR wall-clock hour of a UTC instant', () => {
    // 16:45Z → 13:xx AR.
    expect(arHour('2025-09-08T16:45:00Z')).toBe(13);
  });

  it('returns 22 for a 22:30 AR task stored as next-UTC-day 01:30', () => {
    expect(arHour('2026-06-02T01:30:00Z')).toBe(22);
  });

  it('returns 0 for AR midnight (03:00 UTC)', () => {
    expect(arHour('2026-06-01T03:00:00Z')).toBe(0);
  });

  it('returns NaN for invalid input', () => {
    expect(Number.isNaN(arHour('not-a-date'))).toBe(true);
    expect(Number.isNaN(arHour(null))).toBe(true);
  });
});

// ── arDayStartUtc / arDayEndUtc (Fase 2a: AR day → UTC instant boundaries) ─────

describe('arDayStartUtc / arDayEndUtc', () => {
  it('maps AR day start (00:00 ART) to 03:00 UTC of the same date', () => {
    expect(arDayStartUtc('2026-06-01').toISOString()).toBe('2026-06-01T03:00:00.000Z');
  });

  it('maps AR day end (23:59:59.999 ART) to 02:59 UTC of the NEXT date', () => {
    expect(arDayEndUtc('2026-06-01').toISOString()).toBe('2026-06-02T02:59:59.999Z');
  });

  it('a 22:30 AR task (01:30 UTC Jun 2) falls inside [start, end] of AR Jun 1', () => {
    const task = new Date('2026-06-02T01:30:00Z').getTime();
    expect(task).toBeGreaterThanOrEqual(arDayStartUtc('2026-06-01').getTime());
    expect(task).toBeLessThanOrEqual(arDayEndUtc('2026-06-01').getTime());
  });
});

// ── formatDateLong (Fase 2a: long es-AR header date, in AR time) ───────────────

describe('formatDateLong', () => {
  it('formats a mid-day UTC instant as a long es-AR date in AR time', () => {
    const result = formatDateLong('2026-06-01T15:00:00Z'); // 12:00 ART Jun 1 (Monday)
    expect(result).toMatch(/lunes/i);
    expect(result).toMatch(/1/);
    expect(result).toMatch(/junio/i);
    expect(result).toMatch(/2026/);
  });

  it('uses the AR calendar day for an instant that is the prior AR day', () => {
    // 02:00Z Jun 1 = 23:00 AR May 31 → must read "mayo" / "31", NOT June 1.
    const result = formatDateLong('2026-06-01T02:00:00Z');
    expect(result).toMatch(/mayo/i);
    expect(result).toMatch(/31/);
  });

  it('returns the em dash for null / invalid', () => {
    expect(formatDateLong(null)).toBe('—');
    expect(formatDateLong('not-a-date')).toBe('—');
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
