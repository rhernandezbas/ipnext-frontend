/**
 * Guard: no-browser-tz
 *
 * Prevents the class of bug where dates are formatted or bucketed using the
 * HOST/BROWSER timezone instead of Argentina time (America/Argentina/Buenos_Aires,
 * UTC-3, no DST). The backend serialises UTC ISO strings; reading them with
 * getHours()/toLocaleString() without timeZone shows UTC on a UTC server/CI
 * instead of the intended AR wall-clock time.
 *
 * History:
 *   Fase 1: formatDate.ts AR-fixed helpers replaced ad-hoc Date getters.
 *   Fase 2a: SchedulingCalendar bucketing replaced with toArIsoDate / arHour.
 *   This guard: catch regressions automatically so the bug cannot sneak back in.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * HOW TO FIX A VIOLATION
 * ────────────────────────────────────────────────────────────────────────────
 * Display  →  formatDateTimeShort / formatDateShort / formatTimeShort / formatDateLong
 *              from src/utils/formatDate.ts
 * Bucketing →  toArIsoDate(value)  or  arHour(value)
 * Intl      →  new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', … })
 *
 * IF THE USAGE IS LEGITIMATELY HOST-LOCAL (wall-day marker / datetime-local input):
 *   Add the file path (relative to src/) to ALLOWLIST below WITH a justification
 *   comment explaining WHY local parts are correct there.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_ROOT = join(__dirname, '..', '..');

// ─── Allowlist ────────────────────────────────────────────────────────────────
// Paths are relative to src/ (forward-slash, no leading slash).
// EVERY entry must have a justification comment.
const ALLOWLIST = new Set<string>([
  // ── Canonical AR-fixed formatters ──────────────────────────────────────────
  // All public functions here use arParts() / Intl with explicit timeZone:AR_TZ.
  // wallDayIso() intentionally reads host-local parts because its input is always
  // a wall-day marker (produced by `new Date(y,m,d)` or `new Date(dateStr + 'T00:00:00')`);
  // its JSDoc explains the invariant. Comments also reference getHours/getDate.
  'utils/formatDate.ts',

  // ── Calendar URL state ─────────────────────────────────────────────────────
  // All Date objects here are "wall-day markers": created via
  //   `new Date(`${param}T00:00:00`)` (parsed as local midnight of the chosen day)
  //   or todayArMarker() (which reads toArIsoDate first, then anchors to local midnight).
  // Host-local Y/M/D parts therefore equal the intended AR calendar day.
  // See intendedDayIso() JSDoc for the full invariant.
  // addDays / addMonths / getWeekStart do arithmetic on these markers (not display).
  // computePeriodLabel formats the marker for the nav header — local parts are correct
  // because the marker was anchored to the AR day when constructed.
  'pages/scheduling/SchedulingCalendarPage/hooks/useCalendarUrlState.ts',

  // ── Calendar page ──────────────────────────────────────────────────────────
  // toLocalInputString() builds a "YYYY-MM-DDTHH:mm" value for <input datetime-local>.
  // The datetime-local input protocol requires host-local format; local parts are
  // the correct inverse of how the browser interprets datetime-local input strings.
  // Slot-click handlers construct `new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour)`
  // from a wall-day marker to seed the modal prefill (still a host-local wall-day).
  // Props passed to CalendarMonthView / CalendarWeekView (year, month) are extracted
  // from the wall-day marker and forwarded; no display rendering happens here.
  'pages/scheduling/SchedulingCalendarPage/index.tsx',

  // ── Calendar month view ────────────────────────────────────────────────────
  // Builds the calendar grid layout (leading blank cells, days-in-month) from
  // `new Date(year, month, 1)` and `new Date(year, month + 1, 0)` — both wall-day
  // markers produced from the props already derived from the URL state marker.
  // getDay() and getDate() here read calendar geometry, not real UTC instants.
  'pages/scheduling/SchedulingCalendarPage/components/CalendarMonthView.tsx',

  // ── Calendar week view ─────────────────────────────────────────────────────
  // addDays() does date arithmetic (`result.setDate(result.getDate() + n)`) on
  // wall-day markers passed in as props. No backend UTC timestamps involved.
  'pages/scheduling/SchedulingCalendarPage/components/CalendarWeekView.tsx',

  // ── CreateTaskModal ────────────────────────────────────────────────────────
  // toLocalInputString() mirrors the startDate <input datetime-local> into endDate.
  // `startDate` is itself a local datetime-local string; `new Date(startDate)` is
  // parsed as local (no timezone suffix), so host-local getters are the correct
  // inverse to produce another local datetime-local string.
  'pages/scheduling/SchedulingTasksPage/components/CreateTaskModal.tsx',

  // ── DatosForm ─────────────────────────────────────────────────────────────
  // toLocalInputString() converts an incoming ISO (from the backend) into the local
  // "YYYY-MM-DDTHH:mm" format that <input datetime-local> expects. The datetime-local
  // round-trip requires host-local parts: the browser renders the input in local time
  // and submits it in local format, so reading/writing with local getters is correct.
  'pages/scheduling/SchedulingTaskDetailPage/components/DatosForm.tsx',

  // ── StatsTab (customers) ───────────────────────────────────────────────────
  // generateMockData() builds mock chart labels (e.g. "25/06") from a fixed base
  // date `new Date(2026, 0, 1)` — a local-midnight wall-day marker with no backend
  // timestamps involved. Labels are hardcoded relative offsets; timezone doesn't
  // affect their correctness because the source is a synthetic constant, not a real
  // UTC instant from the API.
  'pages/customers/tabs/StatsTab.tsx',

  // ── HardwarePage ───────────────────────────────────────────────────────────
  // isWarrantyExpiringSoon() calls `in90Days.setDate(in90Days.getDate() + 90)` for
  // a boolean comparison (expiry <= now+90d), not display. Both boundaries use the
  // same host clock, so the ±1-day drift at timezone boundaries is inconsequential
  // for a "warranty expiring soon" alert. This is arithmetic, not rendering.
  'pages/networking/HardwarePage.tsx',
]);

// ─── Detection patterns ───────────────────────────────────────────────────────

/**
 * Date-only locale methods: these have no Number equivalent, so any occurrence
 * (outside a comment) is a Date call. Flag if the same line lacks `timeZone`.
 */
const DATE_ONLY_LOCALE_METHODS: RegExp[] = [
  /\.toLocaleTimeString\(/,
  /\.toLocaleDateString\(/,
];

/**
 * .toLocaleString() is shared between Date and Number. Only flag when `new Date`
 * appears on the same line — number usages (e.g. `amount.toLocaleString('es-AR')`)
 * never co-occur with `new Date` on the same line, so this avoids false positives.
 */
const DATE_TO_LOCALE_STRING = /new Date[^;{]*\.toLocaleString\(/;

/**
 * Host-local Date getters. Safe ONLY on wall-day markers or for pure arithmetic
 * (see ALLOWLIST). Prohibited for display or bucketing of real backend UTC instants
 * — use arParts / arHour / toArIsoDate from formatDate.ts instead.
 */
const LOCAL_GETTERS: RegExp[] = [
  /\.getHours\(\)/,
  /\.getDate\(\)/,
  /\.getMonth\(\)/,
  /\.getFullYear\(\)/,
  /\.getDay\(\)/,
  /\.getMinutes\(\)/,
];

// ─── File collector ───────────────────────────────────────────────────────────

/**
 * Recursively collect all .ts / .tsx files under `dir`, skipping:
 *   - __tests__  (test files may legitimately assert on local Date values)
 *   - node_modules
 *   - This guard itself (already excluded by __tests__ skip, belt-and-suspenders)
 */
function collectSrcFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      results.push(...collectSrcFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

// ─── Guard ────────────────────────────────────────────────────────────────────

describe('no-browser-tz guard — prohibit host-local date formatting outside the allowlist', () => {
  const violations: string[] = [];

  const files = collectSrcFiles(SRC_ROOT);

  for (const absPath of files) {
    // Normalise to forward-slash relative path (src-relative)
    const rel = relative(SRC_ROOT, absPath).replace(/\\/g, '/');
    if (ALLOWLIST.has(rel)) continue;

    const content = readFileSync(absPath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      // Skip blank lines and pure comment lines (// … or * … in JSDoc blocks)
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;

      const loc = `${rel}:${idx + 1}`;

      // ── toLocaleTimeString / toLocaleDateString (always Date methods) ──────
      for (const pat of DATE_ONLY_LOCALE_METHODS) {
        if (pat.test(line) && !line.includes('timeZone')) {
          violations.push(
            `${loc}\n    ↳ ${trimmed}\n    Fix: use formatTimeShort / formatDateShort (formatDate.ts) with AR_TZ`,
          );
        }
      }

      // ── toLocaleString on a Date (same-line new Date heuristic) ─────────────
      if (DATE_TO_LOCALE_STRING.test(line) && !line.includes('timeZone')) {
        violations.push(
          `${loc}\n    ↳ ${trimmed}\n    Fix: use formatDateTimeShort / formatDateShort (formatDate.ts) with AR_TZ`,
        );
      }

      // ── Host-local Date getters ──────────────────────────────────────────────
      for (const pat of LOCAL_GETTERS) {
        if (pat.test(line)) {
          violations.push(
            `${loc}\n    ↳ ${trimmed}\n    Fix: use arHour / toArIsoDate / arParts via formatDate.ts, or add to ALLOWLIST with justification`,
          );
          break; // one report per line (multiple getter matches → deduplicate)
        }
      }
    });
  }

  it('finds no browser-timezone Date usages outside the allowlist', () => {
    if (violations.length === 0) return;

    const header = [
      '',
      `═══════════════════════════════════════════════════════════════════`,
      `  no-browser-tz: ${violations.length} violation(s) found`,
      `═══════════════════════════════════════════════════════════════════`,
      `  These usages format or bucket dates in the HOST timezone, which`,
      `  renders UTC on a UTC server instead of Argentina time (UTC-3).`,
      ``,
      `  Canonical fixes (src/utils/formatDate.ts):`,
      `    display  → formatDateTimeShort / formatDateShort / formatTimeShort`,
      `    bucket   → toArIsoDate(value)  /  arHour(value)`,
      `    Intl     → new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', … })`,
      ``,
      `  If the usage is legitimately host-local (wall-day marker / datetime-local`,
      `  round-trip), add the file to ALLOWLIST in this guard WITH a justification.`,
      `═══════════════════════════════════════════════════════════════════`,
      '',
    ].join('\n');

    throw new Error(header + violations.join('\n\n') + '\n');
  });
});
