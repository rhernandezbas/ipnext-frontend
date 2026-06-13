/**
 * #79 — Pure helpers for the tickets list "Timer" (SLA) column.
 *
 * The timer shows minutes elapsed since the ticket's createdAt, colored by two
 * operator-configurable thresholds (warnMinutes / dangerMinutes):
 *   - ok     (green)  : elapsed < warnMinutes
 *   - warn   (amber)  : warnMinutes <= elapsed < dangerMinutes
 *   - danger (red)    : elapsed >= dangerMinutes
 *   - closed (gray)   : the ticket is closed — the SLA no longer runs, so the
 *                       timer freezes in a neutral color regardless of elapsed.
 *
 * All functions are pure (no clock, no DOM); the column passes in the elapsed
 * minutes and the closed flag computed from live data.
 */

export type SlaTimerLevel = 'ok' | 'warn' | 'danger' | 'closed';

export interface SlaThresholds {
  warnMinutes: number;
  dangerMinutes: number;
}

const LEVEL_COLOR: Record<SlaTimerLevel, string> = {
  ok: '#22c55e',     // green-500
  warn: '#f59e0b',   // amber-500
  danger: '#dc2626', // red-600
  closed: '#94a3b8', // slate-400 (neutral; SLA frozen)
};

/** Resolve the SLA level from elapsed minutes + thresholds. Closed wins always. */
export function slaTimerLevel(elapsedMinutes: number, t: SlaThresholds, isClosed: boolean): SlaTimerLevel {
  if (isClosed) return 'closed';
  if (elapsedMinutes >= t.dangerMinutes) return 'danger';
  if (elapsedMinutes >= t.warnMinutes) return 'warn';
  return 'ok';
}

/** Map an SLA level to its pill color. */
export function slaTimerColor(level: SlaTimerLevel): string {
  return LEVEL_COLOR[level];
}

/** Human-readable elapsed time: "{n} min" under an hour, "{h}h {m}m" beyond. */
export function formatElapsed(elapsedMinutes: number): string {
  if (!Number.isFinite(elapsedMinutes)) return '—';
  const total = Math.max(0, Math.floor(elapsedMinutes));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m}m`;
}

/** Minutes elapsed between an ISO timestamp and `now` (default: current time).
 *  Returns NaN when the timestamp is missing or unparseable. */
export function elapsedMinutesSince(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return NaN;
  const start = Date.parse(iso);
  if (Number.isNaN(start)) return NaN;
  return Math.floor((now - start) / 60_000);
}
