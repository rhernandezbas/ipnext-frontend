import type { NasServer, NasType } from '@/types/nas';

/**
 * Estado del cutover a RADIUS. Un NAS `mikrotik_radius` rutea sus cortes por el
 * orchestrator (camino RADIUS); cualquier otro type es "legacy" (camino MK-directo).
 */
export interface CutoverStats {
  total: number;
  radius: number;
  legacy: number;
  /** % de NAS en RADIUS (0-100, redondeado). */
  pct: number;
}

export function isRadius(type: NasType): boolean {
  return type === 'mikrotik_radius';
}

export function cutoverStats(nasServers: NasServer[]): CutoverStats {
  const total = nasServers.length;
  const radius = nasServers.filter(n => isRadius(n.type)).length;
  const legacy = total - radius;
  const pct = total === 0 ? 0 : Math.round((radius / total) * 100);
  return { total, radius, legacy, pct };
}

/** El `type` al que flipear (toggle del cutover): legacy⇄RADIUS. */
export function nextCutoverType(current: NasType): NasType {
  return isRadius(current) ? 'mikrotik_api' : 'mikrotik_radius';
}
