import { useQuery } from '@tanstack/react-query';
import { getNe8000Audit } from '@/api/networkAudit.api';
import type { Ne8000AuditParams } from '@/api/networkAudit.api';

export function useNe8000Audit(params: Ne8000AuditParams) {
  return useQuery({
    queryKey: ['ne8000-audit', params],
    queryFn: () => getNe8000Audit(params),
  });
}
