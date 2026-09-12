import { useState } from 'react';
import { useCan } from '@/hooks/useMyPermissions';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { Select } from '@/components/molecules/Select/Select';
import { useSetSuricataAssignee } from '../hooks/useSuricataTickets';
import styles from './SuricataAssigneeEditor.module.css';

/** The "no assignee" sentinel. The repo `Select` is a plain string-value
 *  combobox, so the empty string doubles as a real, selectable option here —
 *  exactly like the list filters' "Todos" entry. */
const UNASSIGNED = '';

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
 * Single-field immediate commit (no draft/Guardar step) since this is the ONLY
 * editable field in this header, unlike `TicketSidebar`'s batched Asignado+
 * Prioridad+Área form.
 *
 * The control is the repo's own `Select` (WAI-ARIA select-only combobox), NEVER
 * a native `<select>` facing the operator — the same hard repo rule the Fase G
 * list filters already follow (`SuricataTicketList.tsx`). `AE-7` pins it.
 *
 * Gated by `suricata.manage` (UI-7/UI-8), distinct from the `suricata.read`
 * gate on the rest of the detail page — a read-only user sees the assignee
 * as plain text, never an editable control.
 */
export function SuricataAssigneeEditor({ ticketId, assigneeId, assigneeName }: Props) {
  const canManage = useCan('suricata.manage');
  // A failed users fetch used to be indistinguishable from "there is nobody to
  // assign": the control rendered with only "Sin asignar" and no warning.
  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useRbacUsers(canManage);
  const setAssignee = useSetSuricataAssignee();
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return (
      <p className={styles.readOnly}>{assigneeName ? `Asignado: ${assigneeName}` : 'Sin asignar'}</p>
    );
  }

  async function handleChange(value: string) {
    setError(null);
    try {
      // UI-7 — Prominense-only: this mutation NEVER writes to Suricata,
      // only the local `SuricataTicket.assigneeId` column (design D13).
      await setAssignee.mutateAsync({
        ticketId,
        assigneeId: value === UNASSIGNED ? null : value,
      });
    } catch {
      setError('No se pudo guardar la asignación. Intentá de nuevo.');
    }
  }

  const options = [
    { value: UNASSIGNED, label: 'Sin asignar' },
    ...users.map((u) => ({ value: u.id, label: u.name })),
  ];

  return (
    <div className={styles.editor}>
      <div className={styles.field}>
        <Select
          id="suricata-assignee"
          label="Asignado a"
          value={assigneeId ?? UNASSIGNED}
          onChange={(v) => void handleChange(v)}
          options={options}
          disabled={usersLoading || usersError || setAssignee.isPending}
          aria-invalid={usersError || undefined}
        />
      </div>

      {usersError && (
        <span className={styles.error} role="alert">
          No pudimos cargar la lista de usuarios.{' '}
          <button type="button" className={styles.inlineRetry} onClick={() => void refetchUsers()}>
            Reintentar
          </button>
        </span>
      )}
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
