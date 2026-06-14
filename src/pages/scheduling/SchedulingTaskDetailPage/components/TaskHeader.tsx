import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScheduledTask, TaskGeneralStatus } from '@/types/scheduling';
import type { WorkflowStage } from '@/types/workflow';
import type { TaskPriority } from '@/types/taskPriority';
import { StageSelect } from '@/components/molecules/StageSelect/StageSelect';
import { PrioritySelect } from '@/components/molecules/PrioritySelect/PrioritySelect';
import { Can } from '@/components/auth/Can';
import { IClassStatusBadge } from '@/components/molecules/IClassStatusBadge/IClassStatusBadge';
import { CloseIClassOSModal } from '@/components/molecules/CloseIClassOSModal/CloseIClassOSModal';
import { useCan } from '@/hooks/useMyPermissions';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
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
  /** Set the task's general status (#41) — close / dismiss / reopen. The detail
   *  page wires this to useSetTaskGeneralStatus (dismiss goes through a confirm). */
  onSetStatus: (status: TaskGeneralStatus) => void;
  /** When true the "Eliminar" action is shown in the kebab menu. */
  isAdmin: boolean;
  isSaving: boolean;
}

export function TaskHeader({
  task,
  stages,
  priorities = [],
  onTitleSave,
  onStageMove,
  onPriorityChange,
  onDelete,
  onSetStatus,
  isAdmin,
  isSaving,
}: TaskHeaderProps) {
  const navigate = useNavigate();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [kebabOpen, setKebabOpen] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [closeOSOpen, setCloseOSOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const kebabRef = useRef<HTMLButtonElement>(null);

  // Feature flag + permission for Close OS button — both must be true to show
  const canCloseOS = useCan('scheduling.iclass_close');
  const { data: closeOSFlag } = useFeatureFlag('iclass-close-action');
  const showCloseOSBtn = canCloseOS && (closeOSFlag?.enabled ?? false) && !!task.iclassOrderCode;

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
        {task.generalStatus !== 'open' && (
          <span
            className={styles.closedBadge}
            data-testid="task-status-badge"
            data-status={task.generalStatus}
            aria-label={task.generalStatus === 'closed' ? 'Tarea cerrada' : 'Tarea descartada'}
          >
            {task.generalStatus === 'closed' ? 'Cerrada' : 'Descartada'}
          </span>
        )}
        <Can permission="iclass.read">
          <IClassStatusBadge iclassStatus={task.iclassStatus} />
        </Can>
        {showCloseOSBtn && (
          <button
            className={styles.closeOSBtn}
            onClick={() => setCloseOSOpen(true)}
            data-testid="close-iclass-os-btn"
            title="Cerrar / Validar OS en IClass"
          >
            Cerrar OS
          </button>
        )}
        {titleError && <span className={styles.titleError} role="alert">{titleError}</span>}
      </div>

      <div className={styles.controls}>
        <Can permission="scheduling.move_stage">
          <div className={styles.stagePillWrapper}>
            <StageSelect task={task} stages={stages} onMove={onStageMove} disabled={isSaving} />
          </div>
        </Can>

        <PrioritySelect
          value={task.priority}
          priorities={priorities}
          onChange={onPriorityChange}
          disabled={isSaving}
        />

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
              {/* General-status actions (#41) — gated by scheduling.write. The
                  available actions depend on the current status. */}
              <Can permission="scheduling.write">
                {task.generalStatus !== 'open' && (
                  <li>
                    <button
                      role="menuitem"
                      className={styles.kebabItem}
                      onClick={() => { setKebabOpen(false); onSetStatus('open'); }}
                      data-testid="kebab-reopen"
                    >
                      Reabrir tarea
                    </button>
                  </li>
                )}
                {task.generalStatus !== 'closed' && (
                  <li>
                    <button
                      role="menuitem"
                      className={styles.kebabItem}
                      onClick={() => { setKebabOpen(false); onSetStatus('closed'); }}
                      data-testid="kebab-close"
                    >
                      Cerrar tarea
                    </button>
                  </li>
                )}
                {task.generalStatus !== 'dismissed' && (
                  <li>
                    <button
                      role="menuitem"
                      className={`${styles.kebabItem} ${styles.kebabItemDanger}`}
                      onClick={() => { setKebabOpen(false); onSetStatus('dismissed'); }}
                      data-testid="kebab-dismiss"
                    >
                      Descartar tarea
                    </button>
                  </li>
                )}
              </Can>
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

      {/* Close OS modal — gating is handled inside CloseIClassOSModal */}
      <CloseIClassOSModal
        taskId={task.id}
        open={closeOSOpen}
        onClose={() => setCloseOSOpen(false)}
      />
    </header>
  );
}
