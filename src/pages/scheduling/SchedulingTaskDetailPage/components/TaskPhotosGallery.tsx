import { useEffect, useRef, useState } from 'react';
import {
  useTaskAttachments,
  useUploadTaskAttachments,
  useDeleteTaskAttachment,
} from '@/hooks/useTaskAttachments';
import { useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { mapUploadError } from '@/utils/mapUploadError';
import { ImageLightbox } from '@/components/media/ImageLightbox';
import type { TaskAttachment } from '@/types/taskAttachments';
import styles from './TaskPhotosGallery.module.css';

interface Props {
  taskId: string;
}

/** jpg / png / webp only — mirrors the BE's UNSUPPORTED_ATTACHMENT_TYPE guard. */
const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_PHOTOS = 15;

// ── Inline icons (SVG, never emojis — design-system rule) ─────────────────────

function IconUpload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// ── Thumbnail tile ────────────────────────────────────────────────────────────

interface TileProps {
  attachment: TaskAttachment;
  canManage: boolean;
  deletingId: string | null;
  onOpen: (att: TaskAttachment, opener: HTMLElement | null) => void;
  onDelete: (att: TaskAttachment) => void;
}

function Tile({ attachment, canManage, deletingId, onOpen, onDelete }: TileProps) {
  const [broken, setBroken] = useState(false);
  const openRef = useRef<HTMLButtonElement | null>(null);
  const isDeleting = deletingId === attachment.id;

  return (
    <li className={styles.tile}>
      <button
        ref={openRef}
        type="button"
        className={styles.tileOpen}
        onClick={() => onOpen(attachment, openRef.current)}
        aria-label={`Ver ${attachment.filename} en grande`}
      >
        {broken ? (
          <span className={styles.brokenThumb} aria-hidden="true">?</span>
        ) : (
          <img
            src={attachment.thumbUrl}
            alt={attachment.filename}
            loading="lazy"
            onError={() => setBroken(true)}
          />
        )}
      </button>

      {canManage && (
        <button
          type="button"
          className={styles.tileDelete}
          onClick={() => onDelete(attachment)}
          disabled={isDeleting}
          aria-label={`Eliminar ${attachment.filename}`}
          title="Eliminar foto"
        >
          <IconTrash />
        </button>
      )}
    </li>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export function TaskPhotosGallery({ taskId }: Props) {
  const { data: attachments, isLoading, isError } = useTaskAttachments(taskId);
  const upload = useUploadTaskAttachments();
  const remove = useDeleteTaskAttachment(taskId);
  const confirm = useConfirm();
  const canManage = useCan('scheduling.write');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; alt: string; opener: HTMLElement | null } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  const count = attachments?.length ?? 0;

  // Hold the auto-dismiss timer so a re-fire cancels the previous one and an
  // unmount clears it (no setState-after-unmount / stale dismissal).
  const feedbackTimer = useRef<number | null>(null);
  function showFeedback(text: string, tone: 'error' | 'success') {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    setFeedback({ text, tone });
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 5000);
  }
  useEffect(() => () => {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
  }, []);

  function openPicker() {
    fileInputRef.current?.click();
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Reset the input so picking the same file again re-fires onChange.
    e.target.value = '';
    if (files.length === 0) return;

    if (count + files.length > MAX_PHOTOS) {
      showFeedback(`Máximo ${MAX_PHOTOS} fotos por tarea. Quitá algunas e intentá de nuevo.`, 'error');
      return;
    }

    try {
      await upload.mutateAsync({ taskId, files });
      showFeedback(`${files.length} foto${files.length !== 1 ? 's' : ''} subida${files.length !== 1 ? 's' : ''}.`, 'success');
    } catch (err) {
      showFeedback(mapUploadError(err, MAX_PHOTOS), 'error');
    }
  }

  function handleOpenLightbox(att: TaskAttachment, opener: HTMLElement | null) {
    setLightbox({ url: att.fileUrl, alt: att.filename, opener });
  }

  function handleCloseLightbox() {
    const opener = lightbox?.opener;
    setLightbox(null);
    if (opener) window.setTimeout(() => opener.focus(), 0);
  }

  async function handleDelete(att: TaskAttachment) {
    const ok = await confirm({
      title: 'Eliminar foto',
      message: `¿Eliminar "${att.filename}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    setDeletingId(att.id);
    try {
      await remove.mutateAsync(att.id);
    } catch {
      showFeedback('No se pudo eliminar la foto. Intentá de nuevo.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="task-photos-heading">
      <header className={styles.header}>
        <h2 id="task-photos-heading" className={styles.heading}>
          Fotos{count > 0 && <span className={styles.count}> · {count}</span>}
        </h2>
        {canManage && (
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={openPicker}
            disabled={upload.isPending}
            aria-label={upload.isPending ? 'Subiendo fotos' : 'Agregar fotos'}
          >
            <IconUpload />
            {upload.isPending ? 'Subiendo…' : 'Agregar fotos'}
          </button>
        )}
        {canManage && (
          <input
            ref={fileInputRef}
            data-testid="gallery-file-input"
            type="file"
            multiple
            accept={ACCEPT}
            className={styles.srOnly}
            onChange={(e) => void handleFiles(e)}
          />
        )}
      </header>

      {feedback && (
        <p
          className={feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess}
          role="status"
          aria-live="polite"
        >
          {feedback.text}
        </p>
      )}

      {isLoading && <p className={styles.muted}>Cargando fotos…</p>}

      {isError && !isLoading && (
        <p className={styles.feedbackError} role="status">
          No se pudieron cargar las fotos. Recargá la página.
        </p>
      )}

      {!isLoading && !isError && count === 0 && (
        <div className={styles.emptyState}>
          <p>Sin fotos todavía.</p>
          {canManage && <p className={styles.muted}>Subí fotos del trabajo (jpg, png o webp, hasta {MAX_PHOTOS}).</p>}
        </div>
      )}

      {!isLoading && !isError && count > 0 && (
        <ul className={styles.grid} aria-label="Fotos de la tarea">
          {attachments!.map((att) => (
            <Tile
              key={att.id}
              attachment={att}
              canManage={canManage}
              deletingId={deletingId}
              onOpen={handleOpenLightbox}
              onDelete={(a) => void handleDelete(a)}
            />
          ))}
        </ul>
      )}

      {lightbox && (
        <ImageLightbox url={lightbox.url} alt={lightbox.alt} onClose={handleCloseLightbox} />
      )}
    </section>
  );
}
