import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NasServer, RadiusConfig } from '@/types/nas';
import * as api from '@/api/nas.api';
import type { IpType } from '@/api/nas.api';

export function useNasServers() {
  return useQuery({ queryKey: ['nas-servers'], queryFn: api.getNasServers });
}

export function useCreateNasServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<NasServer, 'id'>) => api.createNasServer(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nas-servers'] }),
  });
}

export function useUpdateNasServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NasServer> }) =>
      api.updateNasServer(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nas-servers'] }),
  });
}

export function useDeleteNasServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNasServer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nas-servers'] }),
  });
}

export function useRadiusConfig() {
  return useQuery({ queryKey: ['radius-config'], queryFn: api.getRadiusConfig });
}

export function useUpdateRadiusConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<RadiusConfig>) => api.updateRadiusConfig(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['radius-config'] }),
  });
}

/**
 * Obtiene la siguiente IP libre de un pool del router (NAS) según el tipo.
 * enabled: solo cuando nasId y type estén presentes.
 * Expone `refetch` para el botón "cambiar".
 */
export function useNextFreeIp(nasId: string | null, type: IpType | null) {
  return useQuery<{ ip: string }>({
    queryKey: ['nas-next-free-ip', nasId, type],
    queryFn: () => api.getNextFreeIp(nasId as string, type as IpType),
    enabled: !!nasId && !!type,
    // No cache entre selecciones distintas — cada asignación debe ser fresca.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
