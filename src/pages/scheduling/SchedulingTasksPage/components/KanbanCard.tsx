import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ScheduledTask, TaskPriority } from '@/types/scheduling';
import { PriorityPill, formatAge } from './TasksTableView';
import styles from './KanbanCard.module.css';

function AssigneeAvatar({ name }: { name: string | null }) {
  if (!name) return <span className={styles.noAssignee}>—</span>;
  const initials = name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  return (
    <span className={styles.assigneeAvatar} title={name} aria-label={`Asignado a: ${name}`}>
      {initials}
    </span>
  );
}

interface KanbanCardProps {
  task: ScheduledTask;
  isDragging?: boolean;
}

export function KanbanCard({ task, isDragging = false }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging: isSelfDragging } = useDraggable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  const isGhost = isSelfDragging && !isDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={styles.card}
      data-dragging={isGhost ? 'true' : 'false'}
      data-testid="kanban-card"
      tabIndex={0}
    >
      <span className={styles.cardSeq}>#{task.sequenceNumber}</span>
      <p className={styles.cardTitle}>{task.title}</p>
      {(task.customerName || task.clientName) && (
        <p className={styles.cardCustomer}>{task.customerName ?? task.clientName}</p>
      )}
      <div className={styles.cardMeta}>
        <PriorityPill priority={task.priority as TaskPriority} />
        <AssigneeAvatar name={task.assigneeName} />
        <span className={styles.cardAge}>
          {formatAge(task.createdAt)}
        </span>
      </div>
    </div>
  );
}
