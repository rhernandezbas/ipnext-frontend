import { useRef, useState } from 'react';
import { useAddTicketComment } from '@/hooks/useTicketComments';
import type { AddTicketCommentInput } from '@/types/ticketComments';
import { Button } from '@/components/atoms/Button';
import { IconNote, IconClose } from '../messagingIcons';
import styles from './NoteComposer.module.css';

interface AttachmentDraft {
  url: string; // data-URI
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

interface Props {
  ticketId: string;
  authorName: string | null;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 3;

// Client-side validation messages (spec — deben matchear la copy EXACTA, mismo
// contrato que la nota interna legacy — #44, FROZEN).
const MSG_TYPE = 'Solo se aceptan imágenes';
const MSG_SIZE = 'La imagen supera el límite de 2MB';
const MSG_MAX = 'Máximo 3 imágenes por comentario';

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * NoteComposer — "Nota interna" (ticket-messaging-ui, golden rule). Camino
 * DISTINTO de `PublicReplyComposer`: propio estado, propio submit, propia
 * mutación (`useAddTicketComment` → POST /:ticketId/comments, SIEMPRE
 * `visibility: internal`). Cero estado compartido con el composer público —
 * no hay riesgo de que un adjunto/texto tipeado acá "se filtre" al otro
 * formulario. Contrato de validación de adjuntos FROZEN (#44): solo imagen,
 * máx 3, 2MB c/u, data-URI — sin cambios de comportamiento respecto al
 * composer legacy, solo la copy que lo identifica sin ambigüedad.
 */
export function NoteComposer({ ticketId, authorName }: Props) {
  const addComment = useAddTicketComment(ticketId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const pendingCountRef = useRef(0);

  async function addFiles(files: File[]) {
    setError(null);
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
      pendingCountRef.current = Math.max(0, pendingCountRef.current - drafts.length);
      setAttachments((prev) => {
        const room = Math.max(0, MAX_IMAGES - prev.length);
        return [...prev, ...drafts.slice(0, room)];
      });
    }

    if (messages.length > 0) {
      setError((prev) => {
        if (!prev) return messages.join(' · ');
        const merged = new Set([...prev.split(' · '), ...messages]);
        return Array.from(merged).join(' · ');
      });
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const cd = e.clipboardData;
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

    if (allFiles.length === 0) return;
    e.preventDefault();
    void addFiles(allFiles);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) void addFiles(files);
    e.target.value = '';
  }

  const canSubmit = !!authorName && (body.trim().length > 0 || attachments.length > 0) && !addComment.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !authorName) return;
    setFeedback(null);
    const input: AddTicketCommentInput = {
      ticketId,
      body: body.trim(),
      authorName,
      attachments: attachments.map((a) => ({ url: a.url, filename: a.filename, mimeType: a.mimeType, sizeBytes: a.sizeBytes })),
    };
    try {
      await addComment.mutateAsync(input);
      setBody('');
      setAttachments([]);
      setError(null);
      setFeedback('Nota interna agregada.');
    } catch {
      setError('No se pudo agregar la nota interna. Intentá de nuevo.');
    }
  }

  return (
    <form className={styles.card} onSubmit={(e) => void handleSubmit(e)} aria-label="Agregar nota interna">
      <header className={styles.header}>
        <IconNote className={styles.headerIcon} />
        <div>
          <span className={styles.headerTitle}>Nota interna</span>
          <span className={styles.headerHint}>El cliente NUNCA la ve — solo el equipo.</span>
        </div>
      </header>

      <label className={styles.srOnly} htmlFor="ticket-note-body">Nota interna</label>
      <textarea
        id="ticket-note-body"
        className={styles.textarea}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          // M4 (fix wave) — mismo fix que PublicReplyComposer: el feedback de
          // éxito no puede sobrevivir al inicio de un draft nuevo.
          if (feedback) setFeedback(null);
        }}
        onPaste={handlePaste}
        placeholder="Escribí una nota interna… (pegá una imagen con Ctrl+V)"
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
                <IconClose />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className={styles.error} role="alert" aria-live="polite">
          {error}
        </p>
      )}
      {feedback && (
        <p className={styles.success} role="status" aria-live="polite">
          {feedback}
        </p>
      )}

      <div className={styles.actions}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className={styles.srOnly}
          id="ticket-note-file"
          aria-label="Adjuntar imagen"
          onChange={handleFileChange}
        />
        <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
          Adjuntar imagen
        </Button>

        <span className={styles.spacer} />

        {authorName === null ? (
          <span className={styles.loginPrompt}>Iniciá sesión para comentar</span>
        ) : (
          <Button type="submit" variant="secondary" size="md" disabled={!canSubmit} loading={addComment.isPending} className={styles.submitBtn}>
            Agregar nota interna
          </Button>
        )}
      </div>

      {/* M2 (fix wave) — SIN aria-live: texto ESTÁTICO que nunca cambia, el
          aria-live era puro ruido sin ningún beneficio. */}
      <p className={styles.hint}>
        Hasta {MAX_IMAGES} imágenes, {Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB cada una.
      </p>
    </form>
  );
}
