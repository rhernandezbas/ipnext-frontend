/**
 * useTicketsFilterUrl — reads and writes ticket filter state to URL search params.
 *
 * Adapted from useTasksFilterUrl. URL keys: status, priority, assignedTo,
 * q, customerId, from, to. All writes use replace: true.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface TicketFilter {
  status?: string;
  priority?: string;
  assignedTo?: string;
  q?: string;
  customerId?: string;
  from?: string;
  to?: string;
  // #49 — area filter
  areaId?: string;
}

export interface TicketsFilterUrlResult {
  filter: TicketFilter;
  setFilter: (patch: Partial<TicketFilter>) => void;
  clearFilter: () => void;
}

export function useTicketsFilterUrl(): TicketsFilterUrlResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filter: TicketFilter = {
    status:     searchParams.get('status')     ?? undefined,
    priority:   searchParams.get('priority')   ?? undefined,
    assignedTo: searchParams.get('assignedTo') ?? undefined,
    q:          searchParams.get('q')          ?? undefined,
    customerId: searchParams.get('customerId') ?? undefined,
    from:       searchParams.get('from')       ?? undefined,
    to:         searchParams.get('to')         ?? undefined,
    areaId:     searchParams.get('areaId')     ?? undefined,
  };

  const setFilter = useCallback(
    (patch: Partial<TicketFilter>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams();

          // Preserve any non-filter params (like ?create=1 is already cleared on mount)
          const merged: TicketFilter = {
            status:     'status'     in patch ? patch.status     : (prev.get('status')     ?? undefined),
            priority:   'priority'   in patch ? patch.priority   : (prev.get('priority')   ?? undefined),
            assignedTo: 'assignedTo' in patch ? patch.assignedTo : (prev.get('assignedTo') ?? undefined),
            q:          'q'          in patch ? patch.q          : (prev.get('q')          ?? undefined),
            customerId: 'customerId' in patch ? patch.customerId : (prev.get('customerId') ?? undefined),
            from:       'from'       in patch ? patch.from       : (prev.get('from')       ?? undefined),
            to:         'to'         in patch ? patch.to         : (prev.get('to')         ?? undefined),
            areaId:     'areaId'     in patch ? patch.areaId     : (prev.get('areaId')     ?? undefined),
          };

          if (merged.status)     next.set('status',     merged.status);
          if (merged.priority)   next.set('priority',   merged.priority);
          if (merged.assignedTo) next.set('assignedTo', merged.assignedTo);
          if (merged.q)          next.set('q',          merged.q);
          if (merged.customerId) next.set('customerId', merged.customerId);
          if (merged.from)       next.set('from',       merged.from);
          if (merged.to)         next.set('to',         merged.to);
          if (merged.areaId)     next.set('areaId',     merged.areaId);

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const clearFilter = useCallback(
    () => {
      setSearchParams(() => new URLSearchParams(), { replace: true });
    },
    [setSearchParams]
  );

  return { filter, setFilter, clearFilter };
}
