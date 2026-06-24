/**
 * useRadiusLogsFilterUrl — URL-backed filter state for the "Logs RADIUS" tab.
 *
 * Filter fields (public API, unchanged): username, nasId, vlanId, eventType,
 * online, from, to, page.
 *
 * URL keys are NAMESPACED with the `logs_` prefix (logs_username, logs_online,
 * logs_page, …). This hook shares the query string of /admin/networking/audit
 * with useNe8000AuditFilterUrl; namespacing prevents the two tabs from colliding
 * on the shared keys (username / online / page) — each tab keeps its own filters
 * and never overwrites the other's. All writes use replace: true and PRESERVE
 * params that don't belong to this namespace (i.e. the other tab's filters).
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const NS = 'logs_';
const k = (key: string) => `${NS}${key}`;

export interface RadiusLogsFilter {
  username?: string;
  nasId?: string;
  vlanId?: string;
  eventType?: 'start' | 'stop' | 'interim' | '';
  online?: '' | 'true' | 'false';
  from?: string;
  to?: string;
  page?: number;
}

export interface RadiusLogsFilterUrlResult {
  filter: RadiusLogsFilter;
  setFilter: (patch: Partial<RadiusLogsFilter>) => void;
  clearFilter: () => void;
}

export function useRadiusLogsFilterUrl(): RadiusLogsFilterUrlResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filter: RadiusLogsFilter = {
    username:  searchParams.get(k('username'))  ?? undefined,
    nasId:     searchParams.get(k('nasId'))     ?? undefined,
    vlanId:    searchParams.get(k('vlanId'))    ?? undefined,
    eventType: (searchParams.get(k('eventType')) ?? '') as RadiusLogsFilter['eventType'],
    online:    (searchParams.get(k('online'))   ?? '')  as RadiusLogsFilter['online'],
    from:      searchParams.get(k('from'))      ?? undefined,
    to:        searchParams.get(k('to'))        ?? undefined,
    page:      searchParams.get(k('page')) ? Number(searchParams.get(k('page'))) : undefined,
  };

  const setFilter = useCallback(
    (patch: Partial<RadiusLogsFilter>) => {
      setSearchParams(
        (prev) => {
          // Start from prev so we PRESERVE the other tab's params (ne_*), then
          // rewrite only this namespace's keys.
          const next = new URLSearchParams(prev);

          const merged: RadiusLogsFilter = {
            username:  'username'  in patch ? patch.username  : (prev.get(k('username'))  ?? undefined),
            nasId:     'nasId'     in patch ? patch.nasId     : (prev.get(k('nasId'))     ?? undefined),
            vlanId:    'vlanId'    in patch ? patch.vlanId    : (prev.get(k('vlanId'))    ?? undefined),
            eventType: 'eventType' in patch ? patch.eventType : (prev.get(k('eventType')) ?? '') as RadiusLogsFilter['eventType'],
            online:    'online'    in patch ? patch.online    : (prev.get(k('online'))    ?? '') as RadiusLogsFilter['online'],
            from:      'from'      in patch ? patch.from      : (prev.get(k('from'))      ?? undefined),
            to:        'to'        in patch ? patch.to        : (prev.get(k('to'))        ?? undefined),
            page:      'page'      in patch ? patch.page      : (prev.get(k('page')) ? Number(prev.get(k('page'))) : undefined),
          };

          const setOrDelete = (key: string, value?: string) => {
            if (value) next.set(k(key), value);
            else next.delete(k(key));
          };

          setOrDelete('username',  merged.username);
          setOrDelete('nasId',     merged.nasId);
          setOrDelete('vlanId',    merged.vlanId);
          setOrDelete('eventType', merged.eventType);
          setOrDelete('online',    merged.online);
          setOrDelete('from',      merged.from);
          setOrDelete('to',        merged.to);
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
