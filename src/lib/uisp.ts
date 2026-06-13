/**
 * Pure utility functions for UISP data rendering.
 * Extracted as pure functions for easy unit testing (no mocks needed).
 */
import { formatDateTimeShort } from '@/utils/formatDate';

/** Signal quality tier for airMax devices */
export type SignalTier = 'excellent' | 'good' | 'fair' | 'critical' | 'none';

/**
 * Categorizes signal strength (dBm) into airMax tiers:
 * - excellent: > -60 dBm (green)
 * - good:    -60 to -70 dBm
 * - fair:    -70 to -80 dBm (amber)
 * - critical: < -80 dBm (red)
 * - none: null signal
 *
 * Note: signal is negative, so -55 > -65 > -75 > -85.
 */
export function categorizeSignal(signal: number | null): SignalTier {
  if (signal === null) return 'none';
  if (signal > -60) return 'excellent';
  if (signal > -70) return 'good';
  if (signal > -80) return 'fair';
  return 'critical';
}

/**
 * Humanizes uptime from a string of seconds (BigInt serialized).
 * Returns e.g. "12d 3h", "45m", "< 1m", or "—" when null.
 */
export function humanizeUptime(uptimeSeconds: string | null): string {
  if (uptimeSeconds === null) return '—';
  const secs = Number(uptimeSeconds);
  if (isNaN(secs) || secs < 0) return '—';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '< 1m';
}

/**
 * Formats a datetime string for display.
 * Returns '—' when null.
 */
export function formatSyncDate(dateStr: string | null): string {
  return formatDateTimeShort(dateStr);
}
