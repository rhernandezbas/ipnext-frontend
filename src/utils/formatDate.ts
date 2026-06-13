/**
 * Shared date formatting utilities for Prominense.
 *
 * Canonical display format (#83):
 *   formatDateTimeShort — "08 sep 2025 - 13:45"  (date + 24h time)
 *   formatDateShort     — "08 sep 2025"          (date only)
 *
 * These are the ONLY formatters that should be used for rendering dates in the
 * UI. They produce a deterministic Spanish format independent of the host ICU
 * data / timezone, and degrade to an em dash ("—") for null / invalid input.
 *
 * Legacy helpers kept for existing call-sites:
 *   formatDateTime — absolute es-AR date+time via Intl (comment timestamps, #77).
 *   formatRelative — relative time in es-AR ("hace 3 días"), falling back to the
 *                    canonical short date when the delta exceeds ~30 days.
 */

/** Spanish 3-letter lowercase month abbreviations, indexed by month (0-11). */
const MONTHS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** Em dash used as the empty / invalid placeholder. */
const EMPTY = '—';

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * True when the input denotes a calendar date with NO meaningful time-of-day,
 * i.e. it must be displayed by its literal day regardless of the host timezone.
 *
 * Two shapes qualify:
 *   - a bare "YYYY-MM-DD" (engine parses it as UTC midnight), and
 *   - a full ISO at UTC midnight "YYYY-MM-DDT00:00:00(.000)?Z" — the shape the
 *     backend actually serializes for date-only fields (contract startDate/endDate,
 *     invoice issuedAt/dueAt). In AR (UTC-3) this instant is the prior day locally,
 *     so using local parts would show the wrong day (#83 re-review).
 *
 * A timestamp carrying a real wall-clock time (any non-midnight, or a midnight
 * with an explicit offset) is NOT date-only and stays in local time.
 */
function isDateOnly(value: string): boolean {
  const v = value.trim();
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) ||
    /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/.test(v)
  );
}

/**
 * Format an ISO/date string as the canonical "DD mmm YYYY - HH:MM" (24h).
 * Returns "—" for null, undefined, empty, or unparseable input.
 *
 * Example: formatDateTimeShort('2025-09-08T13:45:00') → "08 sep 2025 - 13:45"
 */
export function formatDateTimeShort(value: string | null | undefined): string {
  if (!value) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return EMPTY;
  const day = pad2(d.getDate());
  const month = MONTHS_ES[d.getMonth()];
  const year = d.getFullYear();
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${day} ${month} ${year} - ${hh}:${mm}`;
}

/**
 * Format an ISO/date string as the canonical date-only "DD mmm YYYY".
 * Returns "—" for null, undefined, empty, or unparseable input.
 *
 * For a date-only input — a bare "YYYY-MM-DD" OR a full ISO at UTC midnight
 * ("YYYY-MM-DDT00:00:00(.000)?Z", the shape the backend serializes) — the UTC
 * calendar parts are used so the displayed day matches the literal date
 * regardless of the host timezone. A timestamp with a real time-of-day keeps
 * local parts.
 *
 * Example: formatDateShort('2025-09-08')                → "08 sep 2025"
 * Example: formatDateShort('2025-09-08T00:00:00.000Z')  → "08 sep 2025"
 */
export function formatDateShort(value: string | null | undefined): string {
  if (!value) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return EMPTY;
  const dateOnly = isDateOnly(value);
  const day = pad2(dateOnly ? d.getUTCDate() : d.getDate());
  const month = MONTHS_ES[dateOnly ? d.getUTCMonth() : d.getMonth()];
  const year = dateOnly ? d.getUTCFullYear() : d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format an ISO date string as an absolute es-AR date+time.
 * Falls back to the raw string on parse error.
 *
 * Legacy (#77). New call-sites should prefer formatDateTimeShort.
 */
export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Format an ISO date string as a relative time in es-AR
 * ("hace 3 días", "hace 2 horas", etc.).
 * Falls back to the canonical short date when the delta exceeds ~30 days,
 * or to the raw string when the input is not a valid date.
 */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
  const abs = Math.abs(diffMin);
  if (abs < 60) return rtf.format(-diffMin, 'minute');
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(-diffHr, 'hour');
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(-diffDay, 'day');
  return formatDateShort(iso);
}
