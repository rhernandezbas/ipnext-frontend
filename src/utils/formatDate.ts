/**
 * Shared date formatting utilities for Prominense.
 *
 * Canonical display format (#83):
 *   formatDateTimeShort — "08 sep 2025 - 13:45"  (date + 24h time)
 *   formatDateShort     — "08 sep 2025"          (date only)
 *
 * These are the ONLY formatters that should be used for rendering dates in the
 * UI. They produce a deterministic Spanish format and render wall-clock
 * timestamps in Argentina time (America/Argentina/Buenos_Aires, UTC-3, no DST),
 * INDEPENDENT of the host/browser timezone — so every operator sees the same AR
 * time regardless of their machine clock. They degrade to an em dash ("—") for
 * null / invalid input.
 *
 * Why AR-fixed and not host-local (bug 2026-06-25): the backend serializes real
 * timestamps as UTC ISO with a trailing "Z" (Prisma `.toISOString()`). Reading
 * them with Date.getHours()/getDate() rendered them in whatever timezone the
 * viewer's machine happened to be in (a UTC environment showed raw UTC, e.g.
 * "25 jun - 02:07" instead of the AR "24 jun - 23:07"). Formatting via Intl with
 * an explicit timeZone removes that dependency.
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

/** IANA zone for Argentina (fixed UTC-3, no DST since 2009). */
const AR_TZ = 'America/Argentina/Buenos_Aires';

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Numeric calendar parts of an instant, evaluated in Argentina time, regardless
 * of the host timezone. Uses a fixed-locale Intl formatter (Latin digits) and
 * formatToParts to read NUMERIC fields, then the caller maps the month index to
 * MONTHS_ES — keeping the Spanish output deterministic across host ICU locales.
 */
const AR_PARTS_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: AR_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

interface CalendarParts {
  day: number;
  month: number; // 1-12
  year: number;
  hour: number;  // 0-23
  minute: number;
}

function arParts(d: Date): CalendarParts {
  const parts = AR_PARTS_FMT.formatToParts(d);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: Number(get('day')),
    month: Number(get('month')),
    year: Number(get('year')),
    // hour12:false can emit "24" for midnight on some ICU builds → normalize to 0.
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  };
}

/**
 * True when the input denotes a calendar date with NO meaningful time-of-day,
 * i.e. it must be displayed by its literal day regardless of timezone.
 *
 * Qualifying shapes:
 *   - a bare "YYYY-MM-DD" (engine parses it as UTC midnight), and
 *   - a full ISO at UTC midnight, in ANY UTC spelling:
 *     "YYYY-MM-DDT00:00:00(.0+)?(Z|+00:00)" (also lowercase "z"). This is the
 *     shape the backend serializes for date-only fields (contract startDate/
 *     endDate, invoice issuedAt/dueAt). In AR (UTC-3) this instant is the prior
 *     day locally, so using AR parts would show the wrong day (#83 re-review).
 *
 * A timestamp carrying a real wall-clock time (any non-midnight, or a non-UTC
 * offset) is NOT date-only and is rendered in Argentina time.
 */
function isDateOnly(value: string): boolean {
  const v = value.trim();
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) ||
    /^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?(Z|\+00:00)$/i.test(v)
  );
}

/**
 * Format an ISO/date string as the canonical "DD mmm YYYY - HH:MM" (24h),
 * in Argentina time. Returns "—" for null, undefined, empty, or unparseable input.
 *
 * Example: formatDateTimeShort('2025-09-08T16:45:00Z') → "08 sep 2025 - 13:45"
 */
export function formatDateTimeShort(value: string | null | undefined): string {
  if (!value) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return EMPTY;
  const p = arParts(d);
  return `${pad2(p.day)} ${MONTHS_ES[p.month - 1]} ${p.year} - ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * Format an ISO/date string as the canonical date-only "DD mmm YYYY".
 * Returns "—" for null, undefined, empty, or unparseable input.
 *
 * For a date-only input — a bare "YYYY-MM-DD" OR a full ISO at UTC midnight
 * ("YYYY-MM-DDT00:00:00(.000)?Z", the shape the backend serializes) — the UTC
 * calendar parts are used so the displayed day matches the literal date
 * regardless of timezone. A timestamp with a real time-of-day uses its
 * Argentina calendar day.
 *
 * Example: formatDateShort('2025-09-08')                → "08 sep 2025"
 * Example: formatDateShort('2025-09-08T00:00:00.000Z')  → "08 sep 2025"
 */
export function formatDateShort(value: string | null | undefined): string {
  if (!value) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return EMPTY;
  if (isDateOnly(value)) {
    // Literal calendar day, timezone-independent → UTC parts.
    return `${pad2(d.getUTCDate())} ${MONTHS_ES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  // Real wall-clock timestamp → Argentina calendar day.
  const p = arParts(d);
  return `${pad2(p.day)} ${MONTHS_ES[p.month - 1]} ${p.year}`;
}

/**
 * Format an ISO date string as an absolute es-AR date+time, in Argentina time.
 * Falls back to the raw string on parse error.
 *
 * Legacy (#77). New call-sites should prefer formatDateTimeShort.
 */
export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: AR_TZ,
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
