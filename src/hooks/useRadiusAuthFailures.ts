import { useQuery } from '@tanstack/react-query';
import { getRadiusAuthFailures } from '@/api/networkAudit.api';
import type { RadiusAuthFailuresParams } from '@/api/networkAudit.api';

export function useRadiusAuthFailures(params: RadiusAuthFailuresParams) {
  return useQuery({
    queryKey: ['radius-auth-failures', params],
    queryFn: () => getRadiusAuthFailures(params),
  });
}
