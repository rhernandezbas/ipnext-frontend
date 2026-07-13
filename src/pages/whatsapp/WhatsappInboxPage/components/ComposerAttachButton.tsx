import { useRef } from 'react';
import { IconPaperclip } from './mediaIcons';
import { SUPPORTED_MIME_TYPES } from '@/utils/validateAttachment';
import styles from './Composer.attachments.module.css';

interface ComposerAttachButtonProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  count: number;
  max: number;
  /**
   * Bug CRÍTICO #3 (post-review-adversarial): expone el botón visible al
   * padre (`Composer`) para poder enfocarlo cuando se quita el ÚLTIMO
   * adjunto del tray (`ComposerAttachmentTray.onEmptied`) — sin destino
   * quedaba el foco perdido en `document.body`.
   */
  buttonRef?: (el: HTMLButtonElement | null) => void;
}

/**
 * Allowlist WhatsApp — filtro de CONVENIENCIA del picker (NO seguridad), la
 * validación real es `validateAttachment.ts` (client) + el BE (415/413)
 * (design §5.1). Importada de `validateAttachment.ts` (bug MEDIO #8, fix
 * cero-drift) — antes era una lista duplicada acá que podía divergir de la
 * que de verdad valida.
 */
const ACCEPT = SUPPORTED_MIME_TYPES.join(',');

/**
 * ComposerAttachButton (messaging-inbox-v2-media F1.5 fase A, Tanda 2 —
 * ENVIAR, design §5.1) — botón "clip" que dispara un `<input type=file
 * multiple accept>` oculto (molde `TaskPhotosGallery`). Presentacional puro.
 */
export function ComposerAttachButton({ onFiles, disabled = false, count, max, buttonRef }: ComposerAttachButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Bug CRÍTICO #4 (post-review-adversarial): `count`/`max` llegaban como
  // props MUERTAS (prefijadas `_count`/`_max`, nunca leídas) — el botón se
  // podía seguir clickeando aun con el tope de MAX_FILES ya alcanzado (el
  // picker se abría igual; `useComposerAttachments.add` los recortaba en
  // silencio salvo por el `feedback`, que tampoco se renderizaba). Ahora el
  // botón se autodeshabilita al llegar al tope.
  const atCapacity = count >= max;

  function openPicker() {
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // re-permite elegir el mismo archivo otra vez
    if (files.length > 0) onFiles(files);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.attachBtn}
        onClick={openPicker}
        disabled={disabled || atCapacity}
        aria-label={atCapacity ? `Adjuntar archivos (máximo ${max} alcanzado)` : 'Adjuntar archivos'}
      >
        <IconPaperclip />
      </button>
      <label className={styles.srOnly} htmlFor="whatsapp-composer-attach-input">
        Adjuntar archivos
      </label>
      <input
        ref={inputRef}
        id="whatsapp-composer-attach-input"
        data-testid="composer-attach-input"
        className={styles.srOnly}
        type="file"
        multiple
        accept={ACCEPT}
        onChange={handleChange}
      />
    </>
  );
}
