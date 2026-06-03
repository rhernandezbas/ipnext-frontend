import { useInfiniteQuery } from '@tanstack/react-query';
import { getTaskActivity } from '@/api/taskActivity.api';

/**
 * Keyset-paginated activity feed for a task. Each page carries `nextCursor`;
 * `fetchNextPage` loads older entries. Newest-first.
 */
export function useTaskActivity(taskId: string) {
  return useInfiniteQuery({
    queryKey: ['task-activity', taskId] as const,
    queryFn: ({ pageParam }) => getTaskActivity(taskId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: !!taskId,
  });
}
