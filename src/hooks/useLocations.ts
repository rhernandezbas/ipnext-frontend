import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Ubicacion } from '@/types/location';
import * as api from '@/api/locations.api';

export function useLocations() {
  return useQuery({ queryKey: ['ubicaciones'], queryFn: api.getUbicaciones });
}

export function useCreateUbicacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createUbicacion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ubicaciones'] }),
  });
}

export function useUpdateUbicacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Ubicacion> }) =>
      api.updateUbicacion(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ubicaciones'] }),
  });
}

export function useDeleteUbicacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteUbicacion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ubicaciones'] }),
  });
}
