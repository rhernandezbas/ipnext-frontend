/**
 * useRecaptacionFilterUrl — URL-backed filter state for RecaptacionPage.
 * Mirrors useTicketsFilterUrl. URL keys: status, assigneeId, unassigned.
 * All writes use replace: true.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RecaptureLeadStatus, RecaptureLeadSource } from '@/types/recaptacion';

export interface RecaptacionFilter {
  status?: RecaptureLeadStatus | '';
  source?: RecaptureLeadSource;
  assigneeId?: string;
  unassigned?: boolean;
}

export interface RecaptacionFilterUrlResult {
  filter: RecaptacionFilter;
  setFilter: (patch: Partial<RecaptacionFilter>) => void;
  clearFilter: () => void;
}

export function useRecaptacionFilterUrl(): RecaptacionFilterUrlResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filter: RecaptacionFilter = {
    status:     (searchParams.get('status') ?? undefined) as RecaptureLeadStatus | '' | undefined,
    source:     (searchParams.get('source') ?? undefined) as RecaptureLeadSource | undefined,
    assigneeId: searchParams.get('assigneeId') ?? undefined,
    unassigned: searchParams.get('unassigned') === 'true' ? true : undefined,
  };

  const setFilter = useCallback(
    (patch: Partial<RecaptacionFilter>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams();

          const merged: RecaptacionFilter = {
            status:     'status'     in patch ? patch.status     : (prev.get('status')     ?? undefined) as RecaptureLeadStatus | '' | undefined,
            source:     'source'     in patch ? patch.source     : (prev.get('source')     ?? undefined) as RecaptureLeadSource | undefined,
            assigneeId: 'assigneeId' in patch ? patch.assigneeId : (prev.get('assigneeId') ?? undefined),
            unassigned: 'unassigned' in patch ? patch.unassigned : (prev.get('unassigned') === 'true' ? true : undefined),
          };

          if (merged.status)     next.set('status',     merged.status);
          if (merged.source)     next.set('source',     merged.source);
          if (merged.assigneeId) next.set('assigneeId', merged.assigneeId);
          if (merged.unassigned) next.set('unassigned', 'true');

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
