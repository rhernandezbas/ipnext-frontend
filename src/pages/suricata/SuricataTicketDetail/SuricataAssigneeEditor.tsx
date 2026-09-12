import { useState } from 'react';
import { useCan } from '@/hooks/useMyPermissions';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useSetSuricataAssignee } from '../hooks/useSuricataTickets';
import styles from './SuricataAssigneeEditor.module.css';

interface Props {
  ticketId: string;
  assigneeId: string | null;
  assigneeName: string | null;
}

/**
 * SuricataAssigneeEditor — Fase I, task I.2, spec `suricata-tickets-ui` UI-7,
 * design D13. `useSetSuricataAssignee` (Fase G) already implements the
 * `PATCH /tickets/:id/assignee` wire contract but was flagged as unwired
 * ("deviation documentada de esa fase") — this component is that wiring.
 * Molde `TicketSidebar`'s assignee `<select>`, simplified to a single-field
 * immediate commit (no draft/Guardar step) since this is the ONLY editable
 * field in this header, unlike `TicketSidebar`'s batched Asignado+
 * Prioridad+Área form.
 *
 * Gated by `suricata.manage` (UI-7/UI-8), distinct from the `suricata.read`
 * gate on the rest of the detail page — a read-only user sees the assignee
 * as plain text, never an editable control.
 */
export function SuricataAssigneeEditor({ ticketId, assigneeId, assigneeName }: Props) {
  const canManage = useCan('suricata.manage');
  const { data: users = [], isLoading: usersLoading } = useRbacUsers(canManage);
  const setAssignee = useSetSuricataAssignee();
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return (
      <p className={styles.readOnly}>{assigneeName ? `Asignado: ${assigneeName}` : 'Sin asignar'}</p>
    );
  }

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setError(null);
    try {
      // UI-7 — Prominense-only: this mutation NEVER writes to Suricata,
      // only the local `SuricataTicket.assigneeId` column (design D13).
      await setAssignee.mutateAsync({ ticketId, assigneeId: value === '' ? null : value });
    } catch {
      setError('No se pudo guardar la asignación. Intentá de nuevo.');
    }
  }

  return (
    <div className={styles.editor}>
      <label className={styles.label} htmlFor="suricata-assignee">
        Asignado a
      </label>
      <select
        id="suricata-assignee"
        className={styles.select}
        value={assigneeId ?? ''}
        onChange={(e) => void handleChange(e)}
        disabled={usersLoading || setAssignee.isPending}
      >
        <option value="">Sin asignar</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      {setAssignee.isPending && (
        <span className={styles.savingHint} role="status">
          Guardando…
        </span>
      )}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
