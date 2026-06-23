/**
 * useRadiusLogsFilterUrl — URL-backed filter state for RadiusLogsPage.
 * Filter keys: username, nasId, vlanId, eventType, online, from, to.
 * All writes use replace: true.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

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
    username:  searchParams.get('username')  ?? undefined,
    nasId:     searchParams.get('nasId')     ?? undefined,
    vlanId:    searchParams.get('vlanId')    ?? undefined,
    eventType: (searchParams.get('eventType') ?? '') as RadiusLogsFilter['eventType'],
    online:    (searchParams.get('online')   ?? '')  as RadiusLogsFilter['online'],
    from:      searchParams.get('from')      ?? undefined,
    to:        searchParams.get('to')        ?? undefined,
    page:      searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
  };

  const setFilter = useCallback(
    (patch: Partial<RadiusLogsFilter>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams();

          const merged: RadiusLogsFilter = {
            username:  'username'  in patch ? patch.username  : (prev.get('username')  ?? undefined),
            nasId:     'nasId'     in patch ? patch.nasId     : (prev.get('nasId')     ?? undefined),
            vlanId:    'vlanId'    in patch ? patch.vlanId    : (prev.get('vlanId')    ?? undefined),
            eventType: 'eventType' in patch ? patch.eventType : (prev.get('eventType') ?? '') as RadiusLogsFilter['eventType'],
            online:    'online'    in patch ? patch.online    : (prev.get('online')    ?? '') as RadiusLogsFilter['online'],
            from:      'from'      in patch ? patch.from      : (prev.get('from')      ?? undefined),
            to:        'to'        in patch ? patch.to        : (prev.get('to')        ?? undefined),
            page:      'page'      in patch ? patch.page      : (prev.get('page') ? Number(prev.get('page')) : undefined),
          };

          if (merged.username)  next.set('username',  merged.username);
          if (merged.nasId)     next.set('nasId',     merged.nasId);
          if (merged.vlanId)    next.set('vlanId',    merged.vlanId);
          if (merged.eventType) next.set('eventType', merged.eventType);
          if (merged.online)    next.set('online',    merged.online);
          if (merged.from)      next.set('from',      merged.from);
          if (merged.to)        next.set('to',        merged.to);
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
