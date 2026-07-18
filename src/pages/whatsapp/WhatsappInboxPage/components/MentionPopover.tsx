import type { WhatsappAssignee } from '@/types/whatsapp';
import styles from './MentionPopover.module.css';

interface MentionPopoverProps {
  /** Agentes YA filtrados por lo tipeado tras el "@" (el filtro vive en `Composer`). */
  users: WhatsappAssignee[];
  /** Índice de la opción activa (gobernado por el teclado del textarea en `Composer`). */
  activeIndex: number;
  /** id del `<ul role="listbox">` — el textarea lo referencia con `aria-controls`. */
  listboxId: string;
  /** id por opción — el textarea apunta a la activa con `aria-activedescendant`. */
  optionId: (index: number) => string;
  /** Elegir un agente (mousedown para ganarle al click-afuera) → inserta el token. */
  onSelect: (user: WhatsappAssignee) => void;
  /** Hover sobre una opción → sincroniza el activo (paridad mouse/teclado). */
  onHover: (index: number) => void;
}

/**
 * MentionPopover (Ola 6 — @menciones en la nota interna) — popover
 * PRESENTACIONAL sobre el composer con la lista de agentes mencionables. El
 * foco NUNCA sale del textarea (patrón WAI-ARIA "combobox con listbox popup y
 * aria-activedescendant"): `Composer` maneja el filtro (lo tipeado tras el
 * "@"), el teclado (↑/↓ mueven `activeIndex`, Enter elige, Esc cierra) y el
 * anclaje del `aria-activedescendant` en el textarea. Este componente sólo
 * pinta las opciones y resalta la activa — mismo reparto que
 * `CannedResponsePicker`, pero SIN input propio (el "input" es el textarea).
 *
 * `onMouseDown` (no `onClick`) para elegir: el mousedown del click-afuera
 * dispara ANTES del click; elegir en mousedown gana esa carrera (mismo criterio
 * que `CannedResponsePicker`).
 */
export function MentionPopover({ users, activeIndex, listboxId, optionId, onSelect, onHover }: MentionPopoverProps) {
  return (
    <div className={styles.popover} data-testid="mention-popover">
      {users.length === 0 ? (
        <p className={styles.notice} role="status">
          Sin coincidencias.
        </p>
      ) : (
        <ul id={listboxId} role="listbox" className={styles.listbox} aria-label="Agentes para mencionar">
          {users.map((user, idx) => (
            <li
              key={user.id}
              id={optionId(idx)}
              role="option"
              aria-selected={idx === activeIndex}
              className={styles.option}
              data-active={idx === activeIndex || undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(user);
              }}
              onMouseEnter={() => onHover(idx)}
            >
              <span className={styles.optionName}>{user.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
