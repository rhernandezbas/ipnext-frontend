/**
 * useNe8000AuditFilterUrl — URL-backed filter state for Ne8000AuditPage.
 * Filter keys: username, status, enforcedState, online.
 * All writes use replace: true.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface Ne8000AuditFilter {
  username?: string;
  status?: 'enabled' | 'disabled' | '';
  enforcedState?: 'active' | 'reduced' | 'blocked' | '';
  online?: '' | 'true' | 'false';
  page?: number;
}

export interface Ne8000AuditFilterUrlResult {
  filter: Ne8000AuditFilter;
  setFilter: (patch: Partial<Ne8000AuditFilter>) => void;
  clearFilter: () => void;
}

export function useNe8000AuditFilterUrl(): Ne8000AuditFilterUrlResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filter: Ne8000AuditFilter = {
    username:      searchParams.get('username')      ?? undefined,
    status:        (searchParams.get('status')        ?? '') as Ne8000AuditFilter['status'],
    enforcedState: (searchParams.get('enforcedState') ?? '') as Ne8000AuditFilter['enforcedState'],
    online:        (searchParams.get('online')        ?? '') as Ne8000AuditFilter['online'],
    page:          searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
  };

  const setFilter = useCallback(
    (patch: Partial<Ne8000AuditFilter>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams();

          const merged: Ne8000AuditFilter = {
            username:      'username'      in patch ? patch.username      : (prev.get('username')      ?? undefined),
            status:        'status'        in patch ? patch.status        : (prev.get('status')        ?? '') as Ne8000AuditFilter['status'],
            enforcedState: 'enforcedState' in patch ? patch.enforcedState : (prev.get('enforcedState') ?? '') as Ne8000AuditFilter['enforcedState'],
            online:        'online'        in patch ? patch.online        : (prev.get('online')        ?? '') as Ne8000AuditFilter['online'],
            page:          'page'          in patch ? patch.page          : (prev.get('page') ? Number(prev.get('page')) : undefined),
          };

          if (merged.username)      next.set('username',      merged.username);
          if (merged.status)        next.set('status',        merged.status);
          if (merged.enforcedState) next.set('enforcedState', merged.enforcedState);
          if (merged.online)        next.set('online',        merged.online);
          if (merged.page && merged.page > 1) next.set('page', String(merged.page));

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearFilter = useCallback(
    () => setSearchParams(() => new URLSearchParams(), { replace: true }),
    [setSearchParams],
  );

  return { filter, setFilter, clearFilter };
}
