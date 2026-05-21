/**
 * useTasksFilterUrl — reads and writes filter + view state to URL search params.
 *
 * Read: derived on every render from searchParams (no local state).
 * Write: setFilter merges a patch; setView is immediate. Text inputs should
 *        debounce calls to setFilter externally (300ms) before calling.
 * All writes use replace: true to avoid polluting history stack (AD-10).
 *
 * stageIds are stored as repeated ?stageIds[]=a&stageIds[]=b bracket notation.
 * Express 4 + qs parses this to req.query.stageIds = ['a', 'b'].
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TaskListFilter, TasksView, TaskPriority } from '@/types/scheduling';

const VALID_PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];
function parsePriority(raw: string | null): TaskPriority | undefined {
  if (!raw) return undefined;
  return (VALID_PRIORITIES as string[]).includes(raw) ? (raw as TaskPriority) : undefined;
}

export interface TasksFilterUrlResult {
  filter: TaskListFilter;
  view: TasksView;
  setFilter: (patch: Partial<TaskListFilter>) => void;
  setView: (v: TasksView) => void;
  clearFilter: () => void;
}

export function useTasksFilterUrl(): TasksFilterUrlResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filter: TaskListFilter = {
    projectId:  searchParams.get('projectId') ?? undefined,
    stageIds:   searchParams.getAll('stageIds[]').filter(Boolean),
    partnerId:  searchParams.get('partnerId') ?? undefined,
    assigneeId: searchParams.get('assigneeId') ?? undefined,
    priority:   parsePriority(searchParams.get('priority')),
    q:          searchParams.get('q') ?? undefined,
  };

  const view = (searchParams.get('view') ?? 'table') as TasksView;

  const setFilter = useCallback(
    (patch: Partial<TaskListFilter>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams();

          // Preserve view
          const currentView = prev.get('view');
          if (currentView) next.set('view', currentView);

          // Merge current filter with patch
          const merged: TaskListFilter = {
            projectId:  patch.projectId  !== undefined ? patch.projectId  : (prev.get('projectId') ?? undefined),
            stageIds:   patch.stageIds   !== undefined ? patch.stageIds   : prev.getAll('stageIds[]').filter(Boolean),
            partnerId:  patch.partnerId  !== undefined ? patch.partnerId  : (prev.get('partnerId') ?? undefined),
            assigneeId: patch.assigneeId !== undefined ? patch.assigneeId : (prev.get('assigneeId') ?? undefined),
            priority:   patch.priority   !== undefined ? patch.priority   : parsePriority(prev.get('priority')),
            q:          patch.q          !== undefined ? patch.q          : (prev.get('q') ?? undefined),
          };

          if (merged.projectId)  next.set('projectId', merged.projectId);
          if (merged.stageIds?.length) {
            merged.stageIds.forEach(id => next.append('stageIds[]', id));
          }
          if (merged.partnerId)  next.set('partnerId', merged.partnerId);
          if (merged.assigneeId) next.set('assigneeId', merged.assigneeId);
          if (merged.priority)   next.set('priority', merged.priority);
          if (merged.q)          next.set('q', merged.q);

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setView = useCallback(
    (v: TasksView) => {
      setSearchParams((prev) => { prev.set('view', v); return prev; }, { replace: true });
    },
    [setSearchParams]
  );

  const clearFilter = useCallback(
    () => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams();
          const v = prev.get('view');
          if (v) next.set('view', v);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { filter, view, setFilter, setView, clearFilter };
}
