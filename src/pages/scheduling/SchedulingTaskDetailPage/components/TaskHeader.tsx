import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScheduledTask, TaskStageCategory } from '@/types/scheduling';
import type { WorkflowStage } from '@/types/workflow';
import type { TaskPriority } from '@/types/taskPriority';
import styles from './TaskHeader.module.css';

interface TaskHeaderProps {
  task: ScheduledTask;
  stages: WorkflowStage[];
  /** Editable priority catalog — drives the priority dropdown options. */
  priorities?: TaskPriority[];
  onTitleSave: (title: string) => Promise<void>;
  onStageMove: (stageId: string) => Promise<void>;
  onPriorityChange: (priority: string) => Promise<void>;
  onDelete: () => void;
  /** Called when the user requests closing (or re-opening) the task. */
  onClose: () => void;
  /** When true the "Eliminar" action is shown in the kebab menu. */
  isAdmin: boolean;
  isSaving: boolean;
}

const STAGE_CATEGORY_CLASS: Record<TaskStageCategory, string> = {
  nuevo: 'categoryNuevo',
  enProgreso: 'categoryEnProgreso',
  hecho: 'categoryHecho',
  cancelado: 'categoryCancelado',
};

export function TaskHeader({
  task,
  stages,
  priorities = [],
  onTitleSave,
  onStageMove,
  onPriorityChange,
  onDelete,
  onClose,
  isAdmin,
  isSaving,
}: TaskHeaderProps) {
  const navigate = useNavigate();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [kebabOpen, setKebabOpen] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const kebabRef = useRef<HTMLButtonElement>(null);

  // Sync title if task changes externally
  useEffect(() => {
    if (!editingTitle) setTitleValue(task.title);
  }, [task.title, editingTitle]);

  useEffect(() => {
    if (editingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTitle]);

  // Close kebab on outside click
  useEffect(() => {
    if (!kebabOpen) return;
    const handler = (e: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.closest('[data-kebab-wrapper]')?.contains(e.target as Node)) {
        setKebabOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [kebabOpen]);

  const handleTitleClick = () => {
    setTitleError(null);
    setEditingTitle(true);
  };

  const commitTitle = async () => {
    const trimmed = titleValue.trim();
    if (!trimmed) {
      setTitleValue(task.title);
      setEditingTitle(false);
      return;
    }
    if (trimmed === task.title) {
      setEditingTitle(false);
      return;
    }
    try {
      await onTitleSave(trimmed);
      setEditingTitle(false);
      setTitleError(null);
    } catch {
      setTitleError('Error al guardar el título');
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void commitTitle();
    } else if (e.key === 'Escape') {
      setTitleValue(task.title);
      setEditingTitle(false);
      setTitleError(null);
    }
  };

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void onStageMove(e.target.value);
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void onPriorityChange(e.target.value);
  };

  const currentStage = stages.find(s => s.id === task.stageId);
  const categoryClass = currentStage
    ? styles[STAGE_CATEGORY_CLASS[currentStage.category]]
    : undefined;

  return (
    <header className={styles.header} role="banner">
      <div className={styles.breadcrumbs}>
        <button
          className={styles.backBtn}
          onClick={() => navigate('/admin/scheduling/projects')}
          aria-label="Volver a Scheduling"
        >
          ◀
        </button>
        <span className={styles.breadcrumbText}>Scheduling / Tarea #{task.sequenceNumber}</span>
      </div>

      <div className={styles.titleRow}>
        {editingTitle ? (
          <input
            ref={inputRef}
            className={styles.titleInput}
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            onBlur={() => void commitTitle()}
            aria-label="Editar título"
          />
        ) : (
          <h1
            className={styles.title}
            onClick={handleTitleClick}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleTitleClick(); }}
            aria-label={`Título: ${task.title}. Haz clic para editar`}
          >
            {task.title}
          </h1>
        )}
        {task.isClosed && (
          <span className={styles.closedBadge} data-testid="task-closed-badge" aria-label="Tarea cerrada">
            Cerrada
          </span>
        )}
        {titleError && <span className={styles.titleError} role="alert">{titleError}</span>}
      </div>

      <div className={styles.controls}>
        <div className={styles.stagePillWrapper}>
          <span
            className={`${styles.stagePill} ${categoryClass ?? ''}`}
            data-testid="stage-pill"
          >
            {currentStage?.name ?? 'Sin estado'}
          </span>
          <select
            data-testid="stage-selector"
            className={styles.stageSelect}
            value={task.stageId ?? ''}
            onChange={handleStageChange}
            disabled={isSaving}
            aria-label="Cambiar estado"
          >
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <select
          className={styles.prioritySelect}
          value={task.priority}
          onChange={handlePriorityChange}
          disabled={isSaving}
          aria-label="Cambiar prioridad"
        >
          {priorities.length === 0 && <option value={task.priority}>{task.priority}</option>}
          {priorities.map(p => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>

        <div className={styles.kebabWrapper} data-kebab-wrapper="">
          <button
            ref={kebabRef}
            className={styles.kebabBtn}
            onClick={() => setKebabOpen(o => !o)}
            aria-label="Acciones de tarea"
            aria-haspopup="menu"
            aria-expanded={kebabOpen}
            data-testid="kebab-menu"
          >
            ⋮
          </button>
          {kebabOpen && (
            <ul className={styles.kebabMenu} role="menu">
              <li>
                <button
                  role="menuitem"
                  className={styles.kebabItem}
                  onClick={() => { setKebabOpen(false); onClose(); }}
                  data-testid="kebab-close"
                >
                  {task.isClosed ? 'Reabrir tarea' : 'Cerrar tarea'}
                </button>
              </li>
              {isAdmin && (
                <li>
                  <button
                    role="menuitem"
                    className={`${styles.kebabItem} ${styles.kebabItemDanger}`}
                    onClick={() => { setKebabOpen(false); onDelete(); }}
                    data-testid="kebab-delete"
                  >
                    Eliminar tarea
                  </button>
                </li>
              )}
              <li>
                <button
                  role="menuitem"
                  className={styles.kebabItem}
                  disabled
                  title="Próximamente"
                  aria-disabled="true"
                >
                  Duplicar tarea
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}
