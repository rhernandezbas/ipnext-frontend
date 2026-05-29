import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTaskComments, useAddTaskComment, useDeleteTaskComment } from '@/hooks/useTaskComments';
import { useAuth } from '@/hooks/useAuth';
import type { AddTaskCommentInput, TaskCommentAttachment } from '@/types/taskComments';
import type { AuthUser } from '@/types/auth';
import styles from './TaskCommentsTimeline.module.css';

interface AttachmentDraft {
  url: string;
  filename: string;
}

interface Props {
  taskId: string;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i;

function isImageUrl(url: string): boolean {
  return IMAGE_EXT.test(url.trim());
}

function resolveAuthorName(user: AuthUser | null): string | null {
  if (!user) return null;
  const candidates = [user.displayName, user.username, user.email];
  for (const c of candidates) {
    if (c && c.trim()) return c.trim();
  }
  return null;
}

function deriveFilenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    // fall through
  }
  // Best effort: strip query string and take last path segment
  const noQuery = url.split('?')[0] ?? url;
  const last = noQuery.split('/').filter(Boolean).pop();
  return last ?? 'archivo';
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

interface LightboxProps {
  url: string;
  alt: string;
  onClose: () => void;
}

function Lightbox({ url, alt, onClose }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className={styles.lightboxOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Vista ampliada de ${alt}`}
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        className={styles.lightboxClose}
        onClick={onClose}
        aria-label="Cerrar vista ampliada"
      >
        ×
      </button>
      <img
        className={styles.lightboxImage}
        src={url}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        referrerPolicy="no-referrer"
      />
    </div>,
    document.body,
  );
}

// ── Attachment thumbnail (with onError fallback) ──────────────────────────────

interface AttachmentThumbProps {
  attachment: Pick<TaskCommentAttachment, 'url' | 'filename'>;
  onOpen: (url: string, filename: string, opener: HTMLElement | null) => void;
}

function AttachmentThumb({ attachment, onOpen }: AttachmentThumbProps) {
  const [broken, setBroken] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const showImage = isImageUrl(attachment.url) && !broken;

  if (showImage) {
    return (
      <button
        ref={btnRef}
        type="button"
        className={styles.thumb}
        onClick={() => onOpen(attachment.url, attachment.filename, btnRef.current)}
        aria-label={`Ver ${attachment.filename} en grande`}
      >
        <img
          src={attachment.url}
          alt={attachment.filename}
          onError={() => setBroken(true)}
          referrerPolicy="no-referrer"
        />
      </button>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.attachmentLink}
      title={attachment.filename}
    >
      <span className={styles.attachmentIcon} aria-hidden="true">📎</span>
      {attachment.filename}
    </a>
  );
}

// ── Composer ──────────────────────────────────────────────────────────────────

interface ComposerProps {
  authorName: string | null;
  body: string;
  setBody: (v: string) => void;
  attachments: AttachmentDraft[];
  setAttachments: (next: AttachmentDraft[]) => void;
  onSubmit: () => Promise<void>;
  pending: boolean;
}

function Composer({
  authorName,
  body,
  setBody,
  attachments,
  setAttachments,
  onSubmit,
  pending,
}: ComposerProps) {
  const [showUrlRow, setShowUrlRow] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [filenameDraft, setFilenameDraft] = useState('');

  function addAttachment() {
    const u = urlDraft.trim();
    if (!u) return;
    const name = filenameDraft.trim() || deriveFilenameFromUrl(u);
    setAttachments([...attachments, { url: u, filename: name }]);
    setUrlDraft('');
    setFilenameDraft('');
    setShowUrlRow(false);
  }

  function removeAttachment(idx: number) {
    setAttachments(attachments.filter((_, i) => i !== idx));
  }

  const canSubmit =
    !!authorName && (body.trim().length > 0 || attachments.length > 0) && !pending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await onSubmit();
  }

  return (
    <form className={styles.composer} onSubmit={(e) => void handleSubmit(e)} aria-label="Agregar comentario">
      <label className={styles.srOnly} htmlFor="comment-body">Comentario</label>
      <textarea
        id="comment-body"
        className={styles.composerTextarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Escribí un comentario…"
      />

      {attachments.length > 0 && (
        <ul className={styles.pendingRow} aria-label="Adjuntos pendientes">
          {attachments.map((a, idx) => (
            <li key={`${a.url}-${idx}`} className={styles.pendingChip}>
              {isImageUrl(a.url) ? (
                <img
                  className={styles.pendingThumb}
                  src={a.url}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className={styles.attachmentIcon} aria-hidden="true">📎</span>
              )}
              <span className={styles.pendingFilename}>{a.filename}</span>
              <button
                type="button"
                className={styles.pendingRemove}
                onClick={() => removeAttachment(idx)}
                aria-label={`Quitar adjunto ${a.filename}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {showUrlRow && (
        <div className={styles.urlRow}>
          <input
            type="url"
            className={styles.composerInput}
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://…"
            aria-label="URL del adjunto"
          />
          <input
            type="text"
            className={styles.composerInput}
            value={filenameDraft}
            onChange={(e) => setFilenameDraft(e.target.value)}
            placeholder="Nombre (opcional)"
            aria-label="Nombre del adjunto (opcional)"
          />
          <button
            type="button"
            className={styles.btnAddDraft}
            onClick={addAttachment}
            disabled={!urlDraft.trim()}
            aria-label="Agregar adjunto al borrador"
          >
            Agregar
          </button>
        </div>
      )}

      <div className={styles.composerActions}>
        <button
          type="button"
          className={styles.btnAttachToggle}
          onClick={() => setShowUrlRow((v) => !v)}
          aria-expanded={showUrlRow}
          aria-label="Adjuntar URL"
        >
          📎 Adjuntar URL
        </button>

        <span className={styles.spacer} />

        {authorName === null ? (
          <span className={styles.loginPrompt}>Iniciá sesión para comentar</span>
        ) : (
          <button
            type="submit"
            className={styles.btnSubmit}
            disabled={!canSubmit}
            aria-label="Agregar comentario"
          >
            {pending ? 'Guardando…' : 'Comentar'}
          </button>
        )}
      </div>

      <p className={styles.composerHint}>
        Los adjuntos se agregan por URL. Aún no soportamos subida de archivos.
      </p>
    </form>
  );
}

// ── Comment item ──────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: {
    id: string;
    authorName: string;
    body: string;
    createdAt: string;
    attachments: TaskCommentAttachment[];
  };
  onDelete: (id: string) => void;
  deletePending: boolean;
  isNew: boolean;
  onOpenLightbox: (url: string, filename: string, opener: HTMLElement | null) => void;
}

function CommentItem({ comment, onDelete, deletePending, isNew, onOpenLightbox }: CommentItemProps) {
  const hue = hueOf(comment.authorName);
  const avatarStyle = { ['--avatar-hue' as string]: String(hue) } as React.CSSProperties;

  return (
    <article
      className={[styles.commentItem, isNew ? styles.justAdded : ''].join(' ')}
      role="listitem"
      aria-label={`Comentario de ${comment.authorName}`}
    >
      <div className={styles.commentAvatar} aria-hidden="true" style={avatarStyle}>
        {initialsOf(comment.authorName)}
      </div>

      <div className={styles.commentMain}>
        <header className={styles.commentHeader}>
          <span className={styles.authorName}>{comment.authorName}</span>
          <time className={styles.commentDate} dateTime={comment.createdAt}>
            {formatDate(comment.createdAt)}
          </time>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => onDelete(comment.id)}
            disabled={deletePending}
            aria-label={`Eliminar comentario de ${comment.authorName}`}
            title="Eliminar comentario"
          >
            ×
          </button>
        </header>

        {comment.body && <p className={styles.commentBody}>{comment.body}</p>}

        {comment.attachments.length > 0 && (
          <div className={styles.thumbsRow} aria-label="Archivos adjuntos">
            {comment.attachments.map((att) => (
              <AttachmentThumb key={att.id} attachment={att} onOpen={onOpenLightbox} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function TaskCommentsTimeline({ taskId }: Props) {
  const { data: comments, isLoading } = useTaskComments(taskId);
  const addComment = useAddTaskComment(taskId);
  const deleteComment = useDeleteTaskComment(taskId);
  const { user } = useAuth();

  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const [justAddedIds, setJustAddedIds] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{ url: string; alt: string; opener: HTMLElement | null } | null>(null);

  const authorName = resolveAuthorName(user);

  useEffect(() => {
    if (!comments) return;
    const newOnes = new Set<string>();
    for (const c of comments) {
      if (!seenIdsRef.current.has(c.id)) {
        // mark as new only after first render to avoid initial-load animation
        if (seenIdsRef.current.size > 0) newOnes.add(c.id);
        seenIdsRef.current.add(c.id);
      }
    }
    if (newOnes.size > 0) {
      setJustAddedIds(newOnes);
      const t = setTimeout(() => setJustAddedIds(new Set()), 600);
      return () => clearTimeout(t);
    }
  }, [comments]);

  function handleOpenLightbox(url: string, alt: string, opener: HTMLElement | null) {
    setLightbox({ url, alt, opener });
  }

  function handleCloseLightbox() {
    const opener = lightbox?.opener;
    setLightbox(null);
    if (opener) {
      setTimeout(() => opener.focus(), 0);
    }
  }

  async function handleSubmit() {
    if (!authorName) return;
    const input: AddTaskCommentInput = {
      taskId,
      body: body.trim(),
      authorName,
      attachments: attachments.map((a) => ({ url: a.url, filename: a.filename })),
    };
    await addComment.mutateAsync(input);
    setBody('');
    setAttachments([]);
  }

  return (
    <section className={styles.section} aria-labelledby="comments-heading">
      <h2 id="comments-heading" className={styles.sectionTitle}>
        💬 Comentarios
      </h2>

      {isLoading && <p className={styles.loadingText}>Cargando comentarios…</p>}

      {!isLoading && comments && comments.length === 0 && (
        <div className={styles.emptyState}>
          <p>Sin comentarios aún. Sé el primero en comentar.</p>
        </div>
      )}

      {!isLoading && comments && comments.length > 0 && (
        <div className={styles.timeline} role="list" aria-label="Comentarios de la tarea">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onDelete={(id) => void deleteComment.mutateAsync(id)}
              deletePending={deleteComment.isPending}
              isNew={justAddedIds.has(comment.id)}
              onOpenLightbox={handleOpenLightbox}
            />
          ))}
        </div>
      )}

      <Composer
        authorName={authorName}
        body={body}
        setBody={setBody}
        attachments={attachments}
        setAttachments={setAttachments}
        onSubmit={handleSubmit}
        pending={addComment.isPending}
      />

      {lightbox && (
        <Lightbox url={lightbox.url} alt={lightbox.alt} onClose={handleCloseLightbox} />
      )}
    </section>
  );
}
