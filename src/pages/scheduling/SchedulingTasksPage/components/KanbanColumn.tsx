import { useDroppable } from '@dnd-kit/core';
import type { ScheduledTask } from '@/types/scheduling';
import type { WorkflowStage } from '@/types/workflow';
import { KanbanCard } from './KanbanCard';
import styles from './KanbanColumn.module.css';

interface KanbanColumnProps {
  stage: WorkflowStage;
  tasks: ScheduledTask[];
}

export function KanbanColumn({ stage, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      className={styles.column}
      role="group"
      aria-label={`${stage.name} — ${tasks.length} tarea${tasks.length !== 1 ? 's' : ''}`}
    >
      {/* Column header with category stripe */}
      <div className={styles.columnHeader} data-category={stage.category}>
        <span className={styles.columnName}>{stage.name}</span>
        <span className={styles.columnCount}>{tasks.length}</span>
      </div>

      {/* Column body — droppable area */}
      <div
        ref={setNodeRef}
        className={styles.columnBody}
        data-drag-over={isOver ? 'true' : 'false'}
      >
        {tasks.length === 0 ? (
          <p className={styles.columnEmpty}>Sin tareas en este estado</p>
        ) : (
          [...tasks]
            .sort((a, b) => {
              const aTime = new Date(a.createdAt).getTime();
              const bTime = new Date(b.createdAt).getTime();
              return bTime - aTime; // newest first (REQ-KANBAN-6)
            })
            .map(task => (
              <KanbanCard key={task.id} task={task} />
            ))
        )}
      </div>
    </div>
  );
}
