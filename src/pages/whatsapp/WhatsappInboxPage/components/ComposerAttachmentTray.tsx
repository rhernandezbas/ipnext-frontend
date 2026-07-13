import { useEffect, useRef } from 'react';
import { AttachmentPreviewItem } from './AttachmentPreviewItem';
import type { DraftAttachment } from '@/types/whatsapp';
import styles from './Composer.attachments.module.css';

interface ComposerAttachmentTrayProps {
  drafts: DraftAttachment[];
  onRemove: (id: string) => void;
  /**
   * Bug CRÍTICO #3 (post-review-adversarial): se dispara cuando se quita el
   * ÚLTIMO adjunto — el tray se desmonta entero (`drafts.length===0` → esta
   * función retorna `null`), así que no hay ningún chip acá adentro al que
   * devolverle el foco. El padre (`Composer`) decide el destino final (el
   * botón "adjuntar").
   */
  onEmptied?: () => void;
}

/**
 * ComposerAttachmentTray (messaging-inbox-v2-media F1.5 fase A, Tanda 2 —
 * ENVIAR, design §5.2) — grid horizontal scrollable de chips, visible solo
 * si hay drafts (gateado por el padre, `Composer.tsx`).
 *
 * Foco tras quitar (bug CRÍTICO #3): sin manejo explícito, quitar un chip con
 * teclado dejaba el foco en `document.body` (el nodo removido del DOM se
 * lleva el foco con él, y nada lo reclama). Se trackea el ÍNDICE del item
 * quitado (antes de que `onRemove` actualice el array del padre) y, tras el
 * re-render con un draft menos, se re-enfoca el remove-button que ahora
 * ocupa ese índice (el chip "siguiente" recorrido hacia esa posición) — o,
 * si no queda ninguno, se avisa vía `onEmptied`.
 */
export function ComposerAttachmentTray({ drafts, onRemove, onEmptied }: ComposerAttachmentTrayProps) {
  const itemRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const removedIndexRef = useRef<number | null>(null);
  const prevIdsRef = useRef<string[]>(drafts.map((d) => d.id));

  useEffect(() => {
    const prevIds = prevIdsRef.current;
    const currIds = drafts.map((d) => d.id);

    if (currIds.length < prevIds.length && removedIndexRef.current !== null) {
      const idx = Math.min(removedIndexRef.current, currIds.length - 1);
      if (idx >= 0) {
        itemRefs.current.get(currIds[idx]!)?.focus();
      } else {
        onEmptied?.();
      }
    }

    removedIndexRef.current = null;
    prevIdsRef.current = currIds;
  }, [drafts, onEmptied]);

  function handleRemove(id: string) {
    removedIndexRef.current = drafts.findIndex((d) => d.id === id);
    onRemove(id);
  }

  if (drafts.length === 0) return null;

  return (
    <>
      {/* Bug MEDIO #12: región aria-live SEPARADA del `aria-label` del `<ul>`
          (que no es hijo válido de un `<ul>` — solo `<li>`) — un cambio de
          `aria-label` no siempre se anuncia por su cuenta; esto lo garantiza
          vía contenido de TEXTO en una región `polite`. */}
      <span className={styles.srOnly} role="status" aria-live="polite">
        {`${drafts.length} archivo${drafts.length === 1 ? '' : 's'} adjunto${drafts.length === 1 ? '' : 's'}`}
      </span>
      <ul className={styles.tray} role="list" aria-label={`Archivos adjuntos (${drafts.length})`}>
        {drafts.map((draft, i) => (
          <AttachmentPreviewItem
            key={draft.id}
            draft={draft}
            onRemove={handleRemove}
            removeButtonRef={(el) => itemRefs.current.set(draft.id, el)}
            style={{ '--i': i } as React.CSSProperties}
          />
        ))}
      </ul>
    </>
  );
}
