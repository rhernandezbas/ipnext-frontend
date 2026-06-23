import { useQuery } from '@tanstack/react-query';
import { getRadiusEvents } from '@/api/networkAudit.api';
import type { RadiusEventsParams } from '@/api/networkAudit.api';

export function useRadiusEvents(params: RadiusEventsParams) {
  return useQuery({
    queryKey: ['radius-events', params],
    queryFn: () => getRadiusEvents(params),
  });
}
