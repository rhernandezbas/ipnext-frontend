import { useQuery } from '@tanstack/react-query';
import { listTaskAuditFindings } from '@/api/taskAuditFindings.api';

export function useTaskAuditFindings(taskId: string) {
  return useQuery({
    queryKey: ['task-audit-findings', taskId],
    queryFn: () => listTaskAuditFindings(taskId),
    enabled: !!taskId,
  });
}
