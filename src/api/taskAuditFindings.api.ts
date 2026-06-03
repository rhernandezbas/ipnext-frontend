import axiosClient from './axios-client';
import type { AuditFinding } from '@/types/taskAudit';

/** AI installation-audit findings for a task ([] when never audited). */
export const listTaskAuditFindings = (taskId: string) =>
  axiosClient.get<AuditFinding[]>(`/scheduling/${taskId}/audit-findings`).then(r => r.data);
