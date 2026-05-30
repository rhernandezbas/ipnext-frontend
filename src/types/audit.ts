export interface AuditEventDto {
  id: string;
  actorId: string | null;
  actorLogin: string;
  method: string;
  path: string;
  action: string | null;
  entityType: string | null;
  entityId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  statusCode: number;
  errorMessage: string | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditEventPage {
  items: AuditEventDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditEventQuery {
  actorId?: string;
  entityType?: string;
  method?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
