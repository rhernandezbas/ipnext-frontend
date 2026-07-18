import { useEffect, useId, useRef, useState } from 'react';
import { useConfirm } from '@/context/ConfirmContext';
import {
  useUploadNewsAttachments,
  useAddNewsLinkAttachment,
  useDeleteNewsAttachment,
} from '@/hooks/useNews';
import {
  validateNewsFiles,
  NEWS_ATTACHMENT_ACCEPT,
  NEWS_ATTACHMENT_MAX_COUNT,
} from '@/utils/validateNewsAttachment';
import { mapNewsAttachmentError } from '@/utils/mapNewsError';
import { formatFileSize } from '@/utils/formatFileSize';
import type { NewsAttachment } from '@/types/news';
import styles from './NewsAttachmentsManager.module.css';

// ── Inline icons (SVG, never emoji — design-system rule) ──────────────────────

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

function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

interface Feedback {
  text: string;
  tone: 'error' | 'success';
}

interface NewsAttachmentsManagerProps {
  postId: string;
  initialAttachments: NewsAttachment[];
}

/**
 * NewsAttachmentsManager (N2-FE) — attachment editor rendered inside the
 * create/edit modal (edit mode, where the post already has an id). Uploads
 * images/pdf/.md (multipart field `files`), adds links (JSON `kind:'link'`),
 * lists the current attachments and deletes them (confirm). Keeps a LOCAL list
 * seeded from `initialAttachments` and updated from each mutation's response —
 * so the UI is live WITHOUT an extra GET; the mutations also invalidate the
 * ['news'] root so the board/drawer refetch fresh attachments on close.
 *
 * Only reachable from the news.manage-gated modal entry points, so it isn't
 * re-gated here (parent-gated).
 */
export function NewsAttachmentsManager({ postId, initialAttachments }: NewsAttachmentsManagerProps) {
  const [items, setItems] = useState<NewsAttachment[]>(initialAttachments);
  const [linkUrl, setLinkUrl] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const upload = useUploadNewsAttachments();
  const addLink = useAddNewsLinkAttachment();
  const remove = useDeleteNewsAttachment();
  const confirm = useConfirm();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const linkId = useId();

  const feedbackTimer = useRef<number | null>(null);
  function showFeedback(text: string, tone: Feedback['tone']) {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    setFeedback({ text, tone });
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 5000);
  }
  useEffect(
    () => () => {
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    },
    [],
  );

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-picking the same file
    if (files.length === 0) return;

    const invalid = validateNewsFiles(files, items.length);
    if (invalid) {
      showFeedback(invalid.message, 'error');
      return;
    }
    try {
      const created = await upload.mutateAsync({ id: postId, files });
      setItems((prev) => [...prev, ...created]);
      showFeedback(
        `${created.length} adjunto${created.length !== 1 ? 's' : ''} subido${created.length !== 1 ? 's' : ''}.`,
        'success',
      );
    } catch (err) {
      showFeedback(mapNewsAttachmentError(err), 'error');
    }
  }

  async function handleAddLink() {
    const url = linkUrl.trim();
    if (!url || addLink.isPending) return;
    if (items.length >= NEWS_ATTACHMENT_MAX_COUNT) {
      showFeedback(`Máximo ${NEWS_ATTACHMENT_MAX_COUNT} adjuntos por noticia.`, 'error');
      return;
    }
    try {
      const created = await addLink.mutateAsync({ id: postId, data: { url } });
      setItems((prev) => [...prev, created]);
      setLinkUrl('');
      showFeedback('Enlace agregado.', 'success');
    } catch (err) {
      showFeedback(mapNewsAttachmentError(err), 'error');
    }
  }

  async function handleDelete(a: NewsAttachment) {
    const name = a.filename ?? (a.kind === 'link' ? a.url ?? 'el enlace' : 'el archivo');
    const ok = await confirm({
      title: 'Eliminar adjunto',
      message: `¿Eliminar "${name}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    setDeletingId(a.id);
    try {
      await remove.mutateAsync(a.id);
      setItems((prev) => prev.filter((x) => x.id !== a.id));
    } catch {
      showFeedback('No se pudo eliminar el adjunto. Intentá de nuevo.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className={styles.section} aria-label="Adjuntos">
      <div className={styles.dropzone}>
        <button
          type="button"
          className={styles.uploadBtn}
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending || items.length >= NEWS_ATTACHMENT_MAX_COUNT}
        >
          <IconUpload />
          {upload.isPending ? 'Subiendo…' : 'Agregar archivos'}
        </button>
        <p className={styles.hint}>
          Imágenes (jpg, png, webp, gif), PDF o .md — hasta 10 MB c/u, {NEWS_ATTACHMENT_MAX_COUNT} máx.
        </p>
        <input
          ref={inputRef}
          data-testid="news-file-input"
          className={styles.srOnly}
          type="file"
          multiple
          accept={NEWS_ATTACHMENT_ACCEPT}
          aria-label="Agregar archivos adjuntos"
          onChange={(e) => void handleFiles(e)}
        />
      </div>

      <div className={styles.linkBlock}>
        <label htmlFor={linkId} className={styles.label}>
          Agregar un enlace
        </label>
        <div className={styles.linkRow}>
          <input
            id={linkId}
            type="url"
            className={styles.input}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddLink();
              }
            }}
            placeholder="https://…"
          />
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => void handleAddLink()}
            disabled={!linkUrl.trim() || addLink.isPending}
          >
            Agregar enlace
          </button>
        </div>
      </div>

      {feedback && (
        <p
          className={feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {feedback.text}
        </p>
      )}

      {items.length > 0 && (
        <ul className={styles.list} aria-label="Adjuntos actuales">
          {items.map((a) => {
            const isLink = a.kind === 'link';
            const name = a.filename ?? (isLink ? a.url ?? 'Enlace' : 'Archivo');
            const size = formatFileSize(a.sizeBytes);
            return (
              <li key={a.id} className={styles.item}>
                {a.kind === 'image' && a.fileUrl ? (
                  <img className={styles.thumb} src={a.fileUrl} alt={name} loading="lazy" />
                ) : (
                  <span className={styles.itemIcon} aria-hidden="true">
                    {isLink ? <IconLink /> : <IconFile />}
                  </span>
                )}
                <span className={styles.itemName}>{name}</span>
                {size && <span className={styles.itemSize}>{size}</span>}
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => void handleDelete(a)}
                  disabled={deletingId === a.id}
                  aria-label={`Eliminar ${name}`}
                  title="Eliminar adjunto"
                >
                  <IconTrash />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
