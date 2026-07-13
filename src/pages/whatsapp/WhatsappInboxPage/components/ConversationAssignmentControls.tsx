import type { ChangeEvent } from 'react';
import type { WhatsappArea, WhatsappAssignee } from '@/types/whatsapp';
import styles from './ConversationAssignmentControls.module.css';

interface ConversationAssignmentControlsProps {
  assignee: WhatsappAssignee | null;
  area: WhatsappArea | null;
  /** Catálogo de agentes asignables (`useAssignableUsers`). */
  users: WhatsappAssignee[];
  /** Catálogo de áreas, compartido con Tickets (`useMessagingAreas`). */
  areas: WhatsappArea[];
  onAssigneeChange?: (next: WhatsappAssignee | null) => void;
  onAreaChange?: (next: WhatsappArea | null) => void;
  isAssigneePending?: boolean;
  isAreaPending?: boolean;
}

const NONE_VALUE = '';

/**
 * ConversationAssignmentControls — dropdowns "Asignar a"/"Área" del header
 * del thread (messaging-inbox-assignment F1.5-C2 — ASIGNACIÓN). `<select>`
 * NATIVO por select (mismo criterio que `TicketSidebar.tsx`, la única otra
 * superficie assignee/area del repo — consistencia de patrón, teclado/ARIA
 * gratis del browser), pero con touch target ≥44px (A11Y-1) y `<label>`
 * visible (el `TicketSidebar` original solo tiene `aria-label`; acá el
 * espacio del header es MÁS chico, así que el label visible ayuda a que el
 * agente no confunda "Asignar a" con "Área" de un vistazo).
 *
 * Opción fantasma (mismo criterio que `useAssignableOperators.ts`): si el
 * `assignee`/`area` actual NO está en el catálogo fetcheado (agente
 * desactivado, área borrada), se agrega como opción extra al FRENTE de la
 * lista — así el select sigue mostrando el nombre real en vez de quedar en
 * blanco o saltar a "Sin asignar" mintiendo el estado real.
 *
 * `onAssigneeChange`/`onAreaChange` reciben el objeto COMPLETO elegido (no
 * solo el id) — el caller (`WhatsappInboxPage`) lo reenvía tal cual a
 * `useSetConversationAssignee(id).setAssignee`/`useSetConversationArea(id).setArea`,
 * que lo necesita completo para pintar el optimista con nombre/color
 * correctos (ver `useWhatsapp.ts`).
 */
export function ConversationAssignmentControls({
  assignee,
  area,
  users,
  areas,
  onAssigneeChange,
  onAreaChange,
  isAssigneePending = false,
  isAreaPending = false,
}: ConversationAssignmentControlsProps) {
  const assigneeOptions: WhatsappAssignee[] =
    assignee && !users.some((u) => u.id === assignee.id) ? [assignee, ...users] : users;

  const areaOptions: WhatsappArea[] = area && !areas.some((a) => a.id === area.id) ? [area, ...areas] : areas;

  function handleAssigneeChange(e: ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const next = id ? assigneeOptions.find((u) => u.id === id) ?? null : null;
    onAssigneeChange?.(next);
  }

  function handleAreaChange(e: ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const next = id ? areaOptions.find((a) => a.id === id) ?? null : null;
    onAreaChange?.(next);
  }

  return (
    <div className={styles.controls}>
      <div className={styles.field}>
        <label htmlFor="wa-assignee-select" className={styles.label}>Asignar a</label>
        <select
          id="wa-assignee-select"
          className={styles.select}
          value={assignee?.id ?? NONE_VALUE}
          onChange={handleAssigneeChange}
          disabled={isAssigneePending}
        >
          <option value={NONE_VALUE}>Sin asignar</option>
          {assigneeOptions.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="wa-area-select" className={styles.label}>Área</label>
        {area && (
          <span className={styles.swatch} style={{ backgroundColor: area.color }} aria-hidden="true" />
        )}
        <select
          id="wa-area-select"
          className={styles.select}
          value={area?.id ?? NONE_VALUE}
          onChange={handleAreaChange}
          disabled={isAreaPending}
        >
          <option value={NONE_VALUE}>Sin área</option>
          {areaOptions.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
