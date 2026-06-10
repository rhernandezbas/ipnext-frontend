import type { NetworkSite } from '@/types/networkSite';

export interface IClassReadiness {
  ready: boolean;
  missing: string[];
}

/**
 * Determines if a NetworkSite has all the data required by SendTaskToIClass
 * (address + city, both non-blank after trimming).
 *
 * Pure function — no side effects, no imports from React or infrastructure.
 */
export function iclassReadiness(site: Pick<NetworkSite, 'address' | 'city'>): IClassReadiness {
  const missing: string[] = [];
  if (!site.address?.trim()) missing.push('Dirección');
  if (!site.city?.trim()) missing.push('Ciudad');
  return { ready: missing.length === 0, missing };
}
