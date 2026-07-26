import { useState } from 'react';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import { AssistantRiskChip } from './AssistantRiskChip';
import type { AssistantAction } from '@/types/assistant';
import styles from './AssistantActionsEditor.module.css';

interface AssistantActionsEditorProps {
  actions: AssistantAction[];
  enabledKeys: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}

/**
 * ai-assistant-multiagent (ACT-1/ACT-2) — qué puede HACER el agente.
 *
 * Habilitar una acción `red` (marcar una conversación como resuelta) exige **doble
 * confirmación con el impacto explícito**, no un tilde suelto. Si el pedido del cliente
 * seguía vivo, esa acción entierra el reclamo y nadie se entera — el costo de un click
 * distraído es un cliente sin respuesta.
 *
 * Apagarla, en cambio, NO pide confirmación: quitar una capacidad peligrosa siempre debe ser
 * más fácil que darla.
 */
export function AssistantActionsEditor({
  actions,
  enabledKeys,
  onChange,
  disabled = false,
}: AssistantActionsEditorProps) {
  const [pendingRed, setPendingRed] = useState<AssistantAction | null>(null);

  const toggle = (action: AssistantAction, next: boolean) => {
    if (next && action.riskLevel === 'red') {
      setPendingRed(action);
      return;
    }
    onChange(next ? [...enabledKeys, action.key] : enabledKeys.filter(k => k !== action.key));
  };

  const confirmRed = () => {
    if (pendingRed) onChange([...enabledKeys, pendingRed.key]);
    setPendingRed(null);
  };

  return (
    <div className={styles.wrapper}>
      <ul className={styles.list}>
        {actions.map(action => {
          const checked = enabledKeys.includes(action.key);
          const inputId = `assistant-action-${action.key}`;

          return (
            <li key={action.key} className={styles.item}>
              <input
                id={inputId}
                type="checkbox"
                className={styles.checkbox}
                checked={checked}
                disabled={disabled}
                onChange={e => toggle(action, e.target.checked)}
              />
              <label htmlFor={inputId} className={styles.label}>
                <span className={styles.actionLabel}>{action.label}</span>
                <AssistantRiskChip level={action.riskLevel} />
              </label>
            </li>
          );
        })}
      </ul>

      {pendingRed && (
        <ConfirmModal
          open
          // `danger` no es sólo el color: pone el foco inicial en CANCELAR, así un
          // Enter apurado no habilita una acción irreversible sin haber leído.
          tone="danger"
          title="Habilitar una acción de alto riesgo"
          message={
            `Vas a permitir que el asistente pueda "${pendingRed.label}" por su cuenta, sin que ` +
            'lo revise una persona. Si el pedido del cliente seguía abierto, el reclamo queda ' +
            'enterrado y nadie se entera. Sólo habilitala si ya corriste una evaluación y ' +
            'estás conforme con los resultados.'
          }
          confirmLabel="Sí, habilitar"
          cancelLabel="Cancelar"
          onConfirm={confirmRed}
          onCancel={() => setPendingRed(null)}
        />
      )}
    </div>
  );
}
