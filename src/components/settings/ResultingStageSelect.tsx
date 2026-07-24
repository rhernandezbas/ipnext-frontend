import { useEffect, useId, useRef, useState } from 'react';
import type { WorkflowStage } from '@/types/workflow';
import styles from './ResultingStageSelect.module.css';

/** Immutable business code excluido como destino (dispararía creación de OS en IClass). */
const SEND_TO_ICLASS_CODE = 'send_to_iclass';

export interface ResultingStageOption {
  id: string;
  name: string;
  workflowName: string;
}

interface Props {
  /** Estado resultante actual (id) o `null` si no hay transición. */
  value: string | null;
  /** Nombre hidratado del valor actual (para el trigger cuando el catálogo aún no cargó). */
  valueName: string | null;
  /** Candidatos por workflow (se excluye `send_to_iclass` acá adentro). */
  workflows: { id: string; name: string; stages: WorkflowStage[] }[];
  disabled?: boolean;
  /** Se invoca al elegir un destino (o `null` para "sin transición"). El caller confirma + persiste. */
  onPick: (stageId: string | null) => void;
}

/**
 * bulk-task-stage-transition FE (FE-TRANS-1) — Select PROPIO (NUNCA `<select>` nativo)
 * del ÚNICO estado resultante global. Accesible: trigger `aria-haspopup="listbox"` +
 * `aria-expanded`, listbox `role="listbox"`, opciones `role="option"` con `aria-selected`,
 * cierre por Escape y click-afuera, focus visible. EXCLUYE `send_to_iclass` (decisión 7).
 * Incluye la opción "— Sin transición —" que limpia el destino.
 */
export function ResultingStageSelect({ value, valueName, workflows, disabled = false, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const groups = workflows
    .map((wf) => ({ wf, stages: wf.stages.filter((s) => s.code !== SEND_TO_ICLASS_CODE) }))
    .filter((g) => g.stages.length > 0);

  const triggerLabel = value === null ? '— Sin transición —' : (valueName ?? 'Estado seleccionado');

  function pick(stageId: string | null) {
    setOpen(false);
    if (stageId === value) return;
    onPick(stageId);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.triggerLabel} data-empty={value === null ? 'true' : undefined}>{triggerLabel}</span>
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>

      {open && (
        <ul className={styles.menu} id={listId} role="listbox" aria-label="Estado resultante del envío">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              className={styles.option}
              onClick={() => pick(null)}
            >
              <span className={styles.check} aria-hidden="true">{value === null ? '✓' : ''}</span>
              <span className={styles.optionEmpty}>— Sin transición —</span>
            </button>
          </li>
          {groups.map((g) => (
            <li key={g.wf.id} className={styles.group}>
              <div className={styles.groupLabel} aria-hidden="true">{g.wf.name}</div>
              <ul className={styles.groupList}>
                {[...g.stages].sort((a, b) => a.order - b.order).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={s.id === value}
                      className={styles.option}
                      onClick={() => pick(s.id)}
                    >
                      <span className={styles.check} aria-hidden="true">{s.id === value ? '✓' : ''}</span>
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
