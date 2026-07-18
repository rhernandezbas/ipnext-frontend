import { useQuery } from '@tanstack/react-query';
import * as api from '@/api/messagingReports.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import type { ReportsDateRange } from '@/types/messagingReports';

/**
 * useMessagingReports (Ola 3 dashboard) — los 3 hooks del dashboard de Informes
 * en un solo archivo (convención del repo: un `useX` por dominio, molde
 * `useWhatsapp.ts`).
 *
 * El RANGO viaja en el queryKey: cambiar de preset/rango genera una key nueva y
 * dispara el refetch automático (LOAD- on range change). `overview` pollea los
 * `current*` en vivo cada 30s con la pestaña visible (`useDocumentVisible`) —
 * `traffic`/`resolutions` son históricos y NO pollean (cambian lento; el
 * refetch por cambio de rango alcanza).
 */

const ROOT = ['messaging', 'reports'] as const;

export const reportsOverviewKey = (range: ReportsDateRange) => [...ROOT, 'overview', range] as const;
export const reportsTrafficKey = (range: ReportsDateRange) => [...ROOT, 'traffic', range] as const;
export const reportsResolutionsKey = (range: ReportsDateRange) => [...ROOT, 'resolutions', range] as const;

const hasRange = (range: ReportsDateRange) => !!range.from && !!range.to;

export function useReportsOverview(range: ReportsDateRange) {
  const visible = useDocumentVisible();
  return useQuery({
    queryKey: reportsOverviewKey(range),
    queryFn: () => api.getReportsOverview(range),
    enabled: hasRange(range),
    refetchInterval: visible ? 30_000 : false,
  });
}

export function useReportsTraffic(range: ReportsDateRange) {
  return useQuery({
    queryKey: reportsTrafficKey(range),
    queryFn: () => api.getReportsTraffic(range),
    enabled: hasRange(range),
    refetchInterval: false,
  });
}

export function useReportsResolutions(range: ReportsDateRange) {
  return useQuery({
    queryKey: reportsResolutionsKey(range),
    queryFn: () => api.getReportsResolutions(range),
    enabled: hasRange(range),
    refetchInterval: false,
  });
}
