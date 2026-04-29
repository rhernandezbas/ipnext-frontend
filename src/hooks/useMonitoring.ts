import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/monitoring.api';

export function useMonitoringStats() {
  return useQuery({
    queryKey: ['monitoring', 'stats'],
    queryFn: api.getMonitoringStats,
    staleTime: 30_000,
  });
}

export function useMonitoringDevices() {
  return useQuery({
    queryKey: ['monitoring', 'devices'],
    queryFn: api.getMonitoringDevices,
    staleTime: 30_000,
  });
}

export function useMonitoringAlerts() {
  return useQuery({
    queryKey: ['monitoring', 'alerts'],
    queryFn: api.getMonitoringAlerts,
    staleTime: 30_000,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.acknowledgeAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitoring'] }),
  });
}
