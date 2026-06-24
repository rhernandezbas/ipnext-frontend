/**
 * useNe8000AuditFilterUrl — URL-backed filter state for the "Auditoría NE8000" tab.
 *
 * Filter fields (public API, unchanged): username, status, enforcedState, online, page.
 *
 * URL keys are NAMESPACED with the `ne_` prefix (ne_username, ne_online, ne_page, …).
 * This hook shares the query string of /admin/networking/audit with
 * useRadiusLogsFilterUrl; namespacing prevents the two tabs from colliding on the
 * shared keys (username / online / page) — each tab keeps its own filters and never
 * overwrites the other's. All writes use replace: true and PRESERVE params that
 * don't belong to this namespace (i.e. the other tab's filters).
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const NS = 'ne_';
const k = (key: string) => `${NS}${key}`;

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
    username:      searchParams.get(k('username'))      ?? undefined,
    status:        (searchParams.get(k('status'))        ?? '') as Ne8000AuditFilter['status'],
    enforcedState: (searchParams.get(k('enforcedState')) ?? '') as Ne8000AuditFilter['enforcedState'],
    online:        (searchParams.get(k('online'))        ?? '') as Ne8000AuditFilter['online'],
    page:          searchParams.get(k('page')) ? Number(searchParams.get(k('page'))) : undefined,
  };

  const setFilter = useCallback(
    (patch: Partial<Ne8000AuditFilter>) => {
      setSearchParams(
        (prev) => {
          // Start from prev so we PRESERVE the other tab's params (logs_*), then
          // rewrite only this namespace's keys.
          const next = new URLSearchParams(prev);

          const merged: Ne8000AuditFilter = {
            username:      'username'      in patch ? patch.username      : (prev.get(k('username'))      ?? undefined),
            status:        'status'        in patch ? patch.status        : (prev.get(k('status'))        ?? '') as Ne8000AuditFilter['status'],
            enforcedState: 'enforcedState' in patch ? patch.enforcedState : (prev.get(k('enforcedState')) ?? '') as Ne8000AuditFilter['enforcedState'],
            online:        'online'        in patch ? patch.online        : (prev.get(k('online'))        ?? '') as Ne8000AuditFilter['online'],
            page:          'page'          in patch ? patch.page          : (prev.get(k('page')) ? Number(prev.get(k('page'))) : undefined),
          };

          const setOrDelete = (key: string, value?: string) => {
            if (value) next.set(k(key), value);
            else next.delete(k(key));
          };

          setOrDelete('username',      merged.username);
          setOrDelete('status',        merged.status);
          setOrDelete('enforcedState', merged.enforcedState);
          setOrDelete('online',        merged.online);
          setOrDelete('page', merged.page && merged.page > 1 ? String(merged.page) : undefined);

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearFilter = useCallback(
    () => {
      setSearchParams(
        (prev) => {
          // Clear only THIS tab's namespaced keys; leave the other tab's intact.
          const next = new URLSearchParams(prev);
          for (const key of [...next.keys()]) {
            if (key.startsWith(NS)) next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { filter, setFilter, clearFilter };
}
