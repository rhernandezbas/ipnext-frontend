import { useFilteredTasks } from '@/hooks/useScheduling';
import type { TaskListFilter } from '@/types/scheduling';

export function useTasksForCalendar(filter: TaskListFilter, from: string, to: string) {
  return useFilteredTasks({ ...filter, from, to });
}
