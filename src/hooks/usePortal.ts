import { useQuery } from '@tanstack/react-query';
import type { PortalConfig, PortalUser } from '@/types/portal';
import * as api from '@/api/portal.api';

export function usePortalConfig() {
  return useQuery<PortalConfig>({ queryKey: ['portal-config'], queryFn: api.getPortalConfig });
}

export function usePortalUsers() {
  return useQuery<PortalUser[]>({ queryKey: ['portal-users'], queryFn: api.getPortalUsers });
}
