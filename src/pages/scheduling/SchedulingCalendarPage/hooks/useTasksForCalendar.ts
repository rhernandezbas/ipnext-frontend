import { useFilteredTasks } from '@/hooks/useScheduling';
import type { TaskListFilter } from '@/types/scheduling';

/**
 * Calendar data source. The calendar URL state never sends a `status`, so the
 * backend returns ALL general statuses (open + closed + dismissed). Dismissed
 * tasks are "fuera de la vista" (#41): we drop them client-side here. Closed
 * tasks STAY — they are useful history of completed visits.
 *
 * The filter is tolerant: only tasks whose `generalStatus` is EXPLICITLY
 * 'dismissed' are excluded. A missing field (legacy fixture / partial payload)
 * is kept, never silently hidden.
 */
export function useTasksForCalendar(filter: TaskListFilter, from: string, to: string) {
  const query = useFilteredTasks({ ...filter, from, to });

  const data = query.data?.filter(task => task.generalStatus !== 'dismissed');

  return { ...query, data } as typeof query;
}
