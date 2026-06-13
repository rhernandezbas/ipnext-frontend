/**
 * Shared date formatting utilities for Prominense.
 *
 * formatDateTime — absolute es-AR date+time (used in comment timestamps).
 * formatRelative — relative time in es-AR ("hace 3 días"), falling back to
 *                  an absolute toLocaleDateString when the delta exceeds ~30 days.
 */

/**
 * Format an ISO date string as an absolute es-AR date+time.
 * Falls back to the raw string on parse error.
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
 * Falls back to toLocaleDateString es-AR when the delta exceeds ~30 days,
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
  return new Date(iso).toLocaleDateString('es-AR');
}
