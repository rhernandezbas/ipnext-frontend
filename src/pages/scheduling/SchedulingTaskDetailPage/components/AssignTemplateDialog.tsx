import { useState } from 'react';
import { useTaskTemplates } from '@/hooks/useTaskTemplates';
import { useAssignTemplateToTask } from '@/hooks/useScheduling';
import styles from './AssignTemplateDialog.module.css';

interface AssignTemplateDialogProps {
  taskId: string;
  hasExistingItems: boolean;
  onClose: () => void;
}

export function AssignTemplateDialog({ taskId, hasExistingItems, onClose }: AssignTemplateDialogProps) {
  const { data: templates = [], isLoading } = useTaskTemplates();
  const assignMutation = useAssignTemplateToTask(taskId);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(!hasExistingItems);

  async function handleConfirm() {
    if (!selected) return;
    if (hasExistingItems && !confirmed) {
      setConfirmed(true);
      return;
    }
    await assignMutation.mutateAsync(selected);
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.dialog}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-dialog-title"
      >
        <h3 id="assign-dialog-title" className={styles.title}>Cargar lista de verificación</h3>

        {hasExistingItems && !confirmed && (
          <div className={styles.warning}>
            Esto reemplazará tu lista actual. ¿Continuás?
          </div>
        )}

        {isLoading ? (
          <p className={styles.loading}>Cargando plantillas...</p>
        ) : templates.length === 0 ? (
          <p className={styles.empty}>No hay plantillas disponibles.</p>
        ) : (
          <ul className={styles.list} role="listbox" aria-label="Seleccionar plantilla">
            {templates.map(tpl => (
              <li
                key={tpl.id}
                className={`${styles.listItem} ${selected === tpl.id ? styles.listItemSelected : ''}`}
                onClick={() => setSelected(tpl.id)}
                role="option"
                aria-selected={selected === tpl.id}
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(tpl.id); }}
              >
                <span className={styles.tplName}>{tpl.name}</span>
                {tpl.items && tpl.items.length > 0 && (
                  <span className={styles.tplCount}>{tpl.items.length} pasos</span>
                )}
                {tpl.description && (
                  <span className={styles.tplDesc}>{tpl.description}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onClose}
            disabled={assignMutation.isPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void handleConfirm()}
            disabled={!selected || assignMutation.isPending}
            aria-label="Confirmar selección"
          >
            {assignMutation.isPending
              ? 'Cargando...'
              : hasExistingItems && !confirmed
                ? 'Sí, reemplazar'
                : 'Cargar'}
          </button>
        </div>
      </div>
    </div>
  );
}
