import { useQuery } from '@tanstack/react-query';
import { getSchedulingArchive } from '@/api/schedulingArchive.api';

export function useSchedulingArchive() {
  return useQuery({
    queryKey: ['scheduling-archive'],
    queryFn: getSchedulingArchive,
    staleTime: 60_000,
  });
}
