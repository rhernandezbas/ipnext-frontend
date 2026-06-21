import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zonesApi } from '@/api/zones.api';
import type { CreateZoneInput, UpdateZoneInput } from '@/api/zones.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';

export const ZONES_QUERY_KEY = ['zones'] as const;

export function useZones() {
  const { can } = useMyPermissions();
  return useQuery({
    queryKey: ZONES_QUERY_KEY,
    queryFn: zonesApi.list,
    staleTime: 60_000,
    // Only fetch when user has zones.read permission so we don't 403-spam
    enabled: can('zones.read'),
  });
}

export function useCreateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateZoneInput) => zonesApi.create(input),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ZONES_QUERY_KEY });
    },
  });
}

export function useUpdateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateZoneInput }) =>
      zonesApi.update(id, patch),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ZONES_QUERY_KEY });
    },
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => zonesApi.remove(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ZONES_QUERY_KEY });
    },
  });
}
