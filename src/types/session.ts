export interface SessionDto {
  id: string;
  rbacUserId: string;
  actorLogin: string;
  ip: string | null;
  userAgent: string | null;
  loginAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface SessionPage {
  items: SessionDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SessionQuery {
  rbacUserId?: string;
  page?: number;
  pageSize?: number;
}
