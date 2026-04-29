import { useQuery } from '@tanstack/react-query';
import * as api from '@/api/dashboard.api';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
    staleTime: 60_000,
  });
}

export function useDashboardShortcuts() {
  return useQuery({
    queryKey: ['dashboard-shortcuts'],
    queryFn: api.getDashboardShortcuts,
    staleTime: 300_000,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: api.getRecentActivity,
    staleTime: 30_000,
  });
}
