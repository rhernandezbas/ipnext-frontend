import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/radius.api';

export function useRadiusSessions() {
  return useQuery({ queryKey: ['radius-sessions'], queryFn: api.getRadiusSessions });
}

export function useDisconnectSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.disconnectSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['radius-sessions'] }),
  });
}
