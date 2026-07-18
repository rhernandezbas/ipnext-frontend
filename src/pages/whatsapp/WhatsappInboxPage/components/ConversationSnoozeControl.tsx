import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/atoms/Button/Button';
import { formatDateTimeShort } from '@/utils/formatDate';
import { SNOOZE_DURATIONS, computeSnoozedUntil, isFutureSnooze } from './snoozeDurations';
import type { SnoozeDurationId } from './snoozeDurations';
import { IconClock, IconRotateCcw } from './statusIcons';
import styles from './ConversationSnoozeControl.module.css';

interface ConversationSnoozeControlProps {
  /** `snoozedUntil` ISO de la conversación (o `null`). Una fecha pasada = snooze vencido → se trata como no pospuesta. */
  snoozedUntil: string | null;
  /** Posponer: recibe el `snoozedUntil` ISO (futuro) ya calculado — el padre lo reenvía a `useSnoozeConversation(id).snooze`. */
  onSnooze: (snoozedUntil: string) => void;
  /**
   * Reactivar una pospuesta. NO hay endpoint de "des-posponer" en el BE
   * (`POST /snooze` exige fecha futura), así que el padre (`WhatsappInboxPage`)
   * implementa "Reactivar" como REABRIR la conversación (`setStatus('open')`) —
   * decisión documentada: reabrir la saca de `view=snoozed` y la devuelve al
   * inbox abierto.
   */
  onReactivate: () => void;
  isPending?: boolean;
}

/**
 * ConversationSnoozeControl (Ola 6 — snooze) — vive en el header del thread,
 * junto a `ConversationStatusToggle`. Dos caras:
 *
 * - NO pospuesta: botón "Posponer" con un mini-menú de duraciones (1h / 3h /
 *   Mañana / 1 semana). Patrón WAI-ARIA "menu button": `aria-haspopup="menu"` +
 *   `aria-expanded`; el menú es `role="menu"` con `role="menuitem"`; teclado
 *   ↑/↓ mueven el foco, Enter/click eligen, Esc cierra y devuelve el foco al
 *   trigger; click-afuera cierra.
 * - Pospuesta (`snoozedUntil` futuro): "Pospuesta hasta {fecha}" + "Reactivar".
 *
 * Presentacional puro: el cálculo del ISO vive en `snoozeDurations` y la
 * mutation en `WhatsappInboxPage` (mismo contrato que `ConversationStatusToggle`).
 */
export function ConversationSnoozeControl({
  snoozedUntil,
  onSnooze,
  onReactivate,
  isPending = false,
}: ConversationSnoozeControlProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const snoozed = isFutureSnooze(snoozedUntil);

  // Al abrir, el foco entra al primer ítem (patrón menu button).
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  // Click afuera cierra (el menú no es modal).
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  function closeAndReturnFocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(id: SnoozeDurationId) {
    onSnooze(computeSnoozedUntil(id));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const count = SNOOZE_DURATIONS.length;
    const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        itemRefs.current[(currentIndex + 1 + count) % count]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        itemRefs.current[(currentIndex - 1 + count) % count]?.focus();
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        closeAndReturnFocus();
        break;
      default:
        break;
    }
  }

  if (snoozed) {
    return (
      <div className={styles.wrapper}>
        <span className={styles.snoozedLabel}>
          Pospuesta hasta {formatDateTimeShort(snoozedUntil)}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={isPending}
          onClick={onReactivate}
          aria-label="Reactivar conversación pospuesta"
        >
          <IconRotateCcw className={styles.icon} />
          Reactivar
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {/* Trigger nativo (no el atom `Button`, que no reenvía `ref`): necesito
          el ref para devolverle el foco al cerrar el menú (Esc/elegir). El look
          "secondary sm" lo da el CSS module (`.trigger`). */}
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Posponer conversación"
      >
        <IconClock className={styles.icon} />
        Posponer
      </button>

      {open && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- el onKeyDown captura ↑/↓/Esc del menú (los ítems son botones nativos, ya focuseables); el rol lo da el <ul role="menu">.
        <div className={styles.menu} onKeyDown={handleMenuKeyDown}>
          <ul role="menu" className={styles.menuList} aria-label="Posponer hasta">
            {SNOOZE_DURATIONS.map((d, idx) => (
              <li key={d.id} role="none">
                <button
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => choose(d.id)}
                >
                  {d.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
