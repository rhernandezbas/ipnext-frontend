import axiosClient from './axios-client';
import type { AuditEventPage, AuditEventQuery } from '@/types/audit';

const BASE = '/admin/audit-events';

export const auditEventsApi = {
  list: (query: AuditEventQuery = {}): Promise<AuditEventPage> =>
    axiosClient
      .get<AuditEventPage>(BASE, { params: query })
      .then(r => r.data),
};
