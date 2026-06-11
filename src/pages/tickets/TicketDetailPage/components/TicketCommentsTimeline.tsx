import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTicketComments, useAddTicketComment } from '@/hooks/useTicketComments';
import { useAuth } from '@/hooks/useAuth';
import { useCan } from '@/hooks/useMyPermissions';
import type { AddTicketCommentInput, TicketCommentAttachment } from '@/types/ticketComments';
import type { AuthUser } from '@/types/auth';
import styles from './TicketCommentsTimeline.module.css';

interface AttachmentDraft {
  url: string;        // data-URI
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

interface Props {
  ticketId: string;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 3;

// Client-side validation messages (spec — must match the UI copy exactly).
const MSG_TYPE = 'Solo se aceptan imágenes';
const MSG_SIZE = 'La imagen supera el límite de 2MB';
const MSG_MAX = 'Máximo 3 imágenes por comentario';

// D8: attachments are base64 data-URIs, not extension URLs. The extension regex
// of the task fork never matches a data-URI — detect the data: scheme directly.
function isImageUrl(url: string): boolean {
  return url.trim().startsWith('data:image/');
}

// Fix #6: only http(s) URLs are safe to render as a clickable anchor. Anything
// else (javascript:, data:text/html, vbscript:, …) is rendered as plain text.
function isSafeHref(url: string): boolean {
  try {
    const scheme = new URL(url, window.location.origin).protocol;
    return scheme === 'http:' || scheme === 'https:';
  } catch {
    return false;
  }
}

function resolveAuthorName(user: AuthUser | null): string | null {
  if (!user) return null;
  const candidates = [user.displayName, user.username, user.email];
  for (const c of candidates) {
    if (c && c.trim()) return c.trim();
  }
  return null;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
  attachment: Pick<TicketCommentAttachment, 'url' | 'filename'>;
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

  // Fix #6: non-http(s) schemes (javascript:, data:text/html, …) are NOT linkable.
  // Render the filename as inert text so a malicious URL can't execute on click.
  if (!isSafeHref(attachment.url)) {
    return (
      <span className={styles.attachmentLink} title={attachment.filename}>
        <span className={styles.attachmentIcon} aria-hidden="true">📎</span>
        {attachment.filename}
      </span>
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
  addFiles: (files: File[]) => Promise<void>;
  removeAttachment: (idx: number) => void;
  error: string | null;
  onSubmit: () => Promise<void>;
  pending: boolean;
}

function Composer({
  authorName,
  body,
  setBody,
  attachments,
  addFiles,
  removeAttachment,
  error,
  onSubmit,
  pending,
}: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const cd = e.clipboardData;
    // Real browsers (Chrome/Safari) deliver pasted screenshots via
    // clipboardData.items (kind 'file'), often with clipboardData.files EMPTY.
    // jsdom/legacy paths populate clipboardData.files. Read BOTH, then dedup.
    const fromItems = Array.from(cd?.items ?? [])
      .filter((it) => it.kind === 'file')
      .map((it) => it.getAsFile())
      .filter((f): f is File => f != null);
    const fromFiles = Array.from(cd?.files ?? []);

    const seen = new Set<string>();
    const allFiles: File[] = [];
    for (const f of [...fromItems, ...fromFiles]) {
      const key = `${f.name}|${f.size}|${f.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allFiles.push(f);
    }

    // No files at all → plain text paste: let it land in the textarea.
    if (allFiles.length === 0) return;
    e.preventDefault();
    void addFiles(allFiles);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) void addFiles(files);
    e.target.value = ''; // allow re-selecting the same file
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
      <label className={styles.srOnly} htmlFor="ticket-comment-body">Comentario</label>
      <textarea
        id="ticket-comment-body"
        className={styles.composerTextarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onPaste={handlePaste}
        placeholder="Escribí un comentario… (pegá una imagen con Ctrl+V)"
      />

      {attachments.length > 0 && (
        <ul className={styles.pendingRow} aria-label="Imágenes pendientes">
          {attachments.map((a, idx) => (
            <li key={`${a.filename}-${idx}`} className={styles.pendingChip}>
              <img className={styles.pendingThumb} src={a.url} alt="" referrerPolicy="no-referrer" />
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

      {error && (
        <p className={styles.composerError} role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <div className={styles.composerActions}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className={styles.srOnly}
          id="ticket-comment-file"
          aria-label="Adjuntar imagen"
          onChange={handleFileChange}
        />
        <button
          type="button"
          className={styles.btnAttach}
          onClick={() => fileInputRef.current?.click()}
        >
          📎 Adjuntar imagen
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

      <p className={styles.composerHint} aria-live="polite">
        Hasta {MAX_IMAGES} imágenes, {Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB cada una.
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
    attachments: TicketCommentAttachment[];
  };
  isNew: boolean;
  onOpenLightbox: (url: string, filename: string, opener: HTMLElement | null) => void;
}

function CommentItem({ comment, isNew, onOpenLightbox }: CommentItemProps) {
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

export function TicketCommentsTimeline({ ticketId }: Props) {
  const { data: comments, isLoading, isError, refetch } = useTicketComments(ticketId);
  const addComment = useAddTicketComment(ticketId);
  const { user } = useAuth();
  const canWrite = useCan('tickets.write');

  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const [justAddedIds, setJustAddedIds] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{ url: string; alt: string; opener: HTMLElement | null } | null>(null);

  const authorName = resolveAuthorName(user);

  useEffect(() => {
    if (!comments) return;
    const newOnes = new Set<string>();
    for (const c of comments) {
      if (!seenIdsRef.current.has(c.id)) {
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

  // Tracks in-flight encodes so two rapid pastes can't both read a stale
  // attachments.length and blow past the cap (Fix #4). Counts drafts that have
  // been committed-or-promised but not yet reflected in `attachments` state.
  const pendingCountRef = useRef(0);

  async function addFiles(files: File[]) {
    // Clear stale errors at entry. We never null the error at the END of a batch
    // because a concurrent batch may have legitimately set one (rapid pastes).
    setError(null);

    // Fix #5: accumulate every per-file error so a mixed batch (PDF + oversized)
    // surfaces ALL the reasons, not just the last one.
    const messages: string[] = [];
    const pushMsg = (m: string) => {
      if (!messages.includes(m)) messages.push(m);
    };

    const drafts: AttachmentDraft[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        pushMsg(MSG_TYPE);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        pushMsg(MSG_SIZE);
        continue;
      }
      // Fix #4: reserve a slot synchronously against the live committed count
      // (attachments already on screen) + slots reserved by concurrent calls.
      if (attachments.length + pendingCountRef.current >= MAX_IMAGES) {
        pushMsg(MSG_MAX);
        continue;
      }
      pendingCountRef.current += 1;
      try {
        const url = await readAsDataURL(file);
        drafts.push({ url, filename: file.name, mimeType: file.type, sizeBytes: file.size });
      } catch {
        pendingCountRef.current -= 1;
      }
    }

    if (drafts.length > 0) {
      // Release this call's reservations; the committed slots become the chips.
      pendingCountRef.current = Math.max(0, pendingCountRef.current - drafts.length);
      setAttachments((prev) => {
        // Final cap guard inside the updater: never commit beyond MAX_IMAGES,
        // even if reservations and commits interleaved across rapid pastes.
        const room = Math.max(0, MAX_IMAGES - prev.length);
        return [...prev, ...drafts.slice(0, room)];
      });
    }

    // Only SET (never clear) so a concurrent batch's error survives. The
    // entry-level setError(null) already handled the "fresh batch" reset.
    if (messages.length > 0) {
      setError((prev) => {
        if (!prev) return messages.join(' · ');
        // Merge with a concurrent batch's message set, deduped.
        const merged = new Set([...prev.split(' · '), ...messages]);
        return Array.from(merged).join(' · ');
      });
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

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
    const input: AddTicketCommentInput = {
      ticketId,
      body: body.trim(),
      authorName,
      attachments: attachments.map((a) => ({
        url: a.url,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
    };
    await addComment.mutateAsync(input);
    setBody('');
    setAttachments([]);
    setError(null);
  }

  return (
    <section className={styles.section} aria-labelledby="ticket-comments-heading">
      <h2 id="ticket-comments-heading" className={styles.sectionTitle}>
        💬 Conversación
      </h2>

      {isLoading && <p className={styles.loadingText}>Cargando comentarios…</p>}

      {!isLoading && isError && (
        <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>No se pudieron cargar los comentarios.</p>
          <button type="button" className={styles.btnRetry} onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !isError && comments && comments.length === 0 && (
        <div className={styles.emptyState}>
          <p>{canWrite ? 'Sé el primero en comentar.' : 'Sin comentarios aún.'}</p>
        </div>
      )}

      {!isLoading && comments && comments.length > 0 && (
        <div className={styles.timeline} role="list" aria-label="Comentarios del ticket">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isNew={justAddedIds.has(comment.id)}
              onOpenLightbox={handleOpenLightbox}
            />
          ))}
        </div>
      )}

      {canWrite && (
        <Composer
          authorName={authorName}
          body={body}
          setBody={setBody}
          attachments={attachments}
          addFiles={addFiles}
          removeAttachment={removeAttachment}
          error={error}
          onSubmit={handleSubmit}
          pending={addComment.isPending}
        />
      )}

      {lightbox && (
        <Lightbox url={lightbox.url} alt={lightbox.alt} onClose={handleCloseLightbox} />
      )}
    </section>
  );
}
