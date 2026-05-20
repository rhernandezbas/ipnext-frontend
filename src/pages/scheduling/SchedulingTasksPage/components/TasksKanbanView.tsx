import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjects } from '@/hooks/useProjects';
import { useWorkflow } from '@/hooks/useWorkflows';
import * as api from '@/api/scheduling.api';
import type { ScheduledTask } from '@/types/scheduling';
import type { TaskListFilter } from '@/types/scheduling';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import styles from './TasksKanbanView.module.css';

interface TasksKanbanViewProps {
  tasks: ScheduledTask[];
  filter: TaskListFilter;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    if (!result[k]) result[k] = [];
    result[k].push(item);
  }
  return result;
}

export function TasksKanbanView({ tasks, filter }: TasksKanbanViewProps) {
  const [activeTask, setActiveTask] = useState<ScheduledTask | null>(null);
  const qc = useQueryClient();

  const { data: projects = [] } = useProjects();
  const selectedProject = projects.find(p => p.id === filter.projectId);
  const { data: workflow, isLoading: workflowLoading } = useWorkflow(selectedProject?.workflowId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Filter-keyed mutation for optimistic UI (AD-4)
  const moveMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      api.moveTaskToStage(id, stageId),

    onMutate: async ({ id, stageId }) => {
      await qc.cancelQueries({ queryKey: ['scheduling-tasks', filter] });
      const snapshot = qc.getQueryData<ScheduledTask[]>(['scheduling-tasks', filter]);
      qc.setQueryData<ScheduledTask[]>(
        ['scheduling-tasks', filter],
        (prev) => prev?.map(t => t.id === id ? { ...t, stageId } : t) ?? [],
      );
      return { snapshot };
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        qc.setQueryData(['scheduling-tasks', filter], context.snapshot);
      }
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['scheduling-tasks', filter] });
    },
  });

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over || active.id === over.id) return;
    moveMutation.mutate({ id: String(active.id), stageId: String(over.id) });
  }

  // Empty state: no project selected (REQ-KANBAN-1, AD-2)
  if (!filter.projectId) {
    return (
      <div className={styles.emptyPrompt}>
        <p>Seleccioná un proyecto para ver el Flujo de Trabajo</p>
      </div>
    );
  }

  if (workflowLoading) {
    return <div className={styles.loading}>Cargando flujo de trabajo…</div>;
  }

  if (!workflow) {
    return (
      <div className={styles.emptyPrompt}>
        <p>Este proyecto no tiene un flujo de trabajo asignado.</p>
      </div>
    );
  }

  const stages = [...workflow.stages].sort((a, b) => a.order - b.order);
  const tasksByStage = groupBy(tasks, t => t.stageId);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.board} role="region" aria-label="Flujo de Trabajo">
        {stages.map(stage => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            tasks={tasksByStage[stage.id] ?? []}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && <KanbanCard task={activeTask} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
