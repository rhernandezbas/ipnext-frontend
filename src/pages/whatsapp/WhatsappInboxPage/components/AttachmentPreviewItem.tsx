import { FileTypeIcon, IconAlert } from './mediaIcons';
import { formatFileSize } from '@/utils/formatFileSize';
import type { DraftAttachment } from '@/types/whatsapp';
import styles from './Composer.attachments.module.css';

interface AttachmentPreviewItemProps {
  draft: DraftAttachment;
  onRemove: (id: string) => void;
  /**
   * Bug CRÍTICO #3 (post-review-adversarial): expone el botón "quitar" al
   * padre (`ComposerAttachmentTray`) para que pueda re-enfocarlo (o enfocar
   * el del chip vecino) tras una remoción — sin esto, quitar un chip con
   * teclado dejaba el foco perdido en `document.body`.
   */
  removeButtonRef?: (el: HTMLButtonElement | null) => void;
  /** Bug ALTO #7 — `--i` para el stagger de entrada (mismo patrón `MediaAttachments`, Tanda 1). */
  style?: React.CSSProperties;
}

/**
 * AttachmentPreviewItem (messaging-inbox-v2-media F1.5 fase A, Tanda 2 —
 * ENVIAR, design §5.2/§11 FE-3) — un chip del tray. `image` → thumbnail
 * `<img>`; `video`/`audio`/`file` → tile ícono+nombre+tamaño (barato,
 * robusto — nunca poster-frame de video). Error de validación (type/size):
 * borde danger + `IconAlert` + texto, `role="alert"` (el color NUNCA es la
 * única señal).
 */
export function AttachmentPreviewItem({ draft, onRemove, removeButtonRef, style }: AttachmentPreviewItemProps) {
  const { file, fileType, previewUrl, error } = draft;
  const sizeText = formatFileSize(file.size);

  const itemClassName = [styles.previewItem, error ? styles.errored : ''].filter(Boolean).join(' ');

  return (
    <li className={itemClassName} style={style}>
      {fileType === 'image' && previewUrl ? (
        <img className={styles.thumb} src={previewUrl} alt={file.name} />
      ) : (
        <div className={styles.tile}>
          <FileTypeIcon contentType={file.type} />
          <p className={styles.tileName}>{file.name}</p>
          {sizeText && <p className={styles.tileSize}>{sizeText}</p>}
        </div>
      )}

      <button
        ref={removeButtonRef}
        type="button"
        className={styles.removeBtn}
        onClick={() => onRemove(draft.id)}
        aria-label={`Quitar ${file.name}`}
      >
        ×
      </button>

      {error && (
        <p className={styles.errorBanner} role="alert">
          <IconAlert />
          {error.message}
        </p>
      )}
    </li>
  );
}
