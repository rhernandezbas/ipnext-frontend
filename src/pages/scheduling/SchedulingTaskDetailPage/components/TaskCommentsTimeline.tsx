import { useState } from 'react';
import { useTaskComments, useAddTaskComment, useDeleteTaskComment } from '@/hooks/useTaskComments';
import type { AddTaskCommentInput } from '@/types/taskComments';
import styles from './TaskCommentsTimeline.module.css';

interface AttachmentDraft {
  url: string;
  filename: string;
}

interface Props {
  taskId: string;
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

export function TaskCommentsTimeline({ taskId }: Props) {
  const { data: comments, isLoading } = useTaskComments(taskId);
  const addComment = useAddTaskComment(taskId);
  const deleteComment = useDeleteTaskComment(taskId);

  const [body, setBody] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);

  function addAttachmentRow() {
    setAttachments(prev => [...prev, { url: '', filename: '' }]);
  }

  function removeAttachmentRow(idx: number) {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }

  function updateAttachment(idx: number, field: keyof AttachmentDraft, value: string) {
    setAttachments(prev =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedBody = body.trim();
    const trimmedAuthor = authorName.trim();
    if (!trimmedBody || !trimmedAuthor) return;

    const validAttachments = attachments.filter(a => a.url.trim() && a.filename.trim());

    const input: AddTaskCommentInput = {
      taskId,
      body: trimmedBody,
      authorName: trimmedAuthor,
      attachments: validAttachments.map(a => ({ url: a.url.trim(), filename: a.filename.trim() })),
    };

    await addComment.mutateAsync(input);
    setBody('');
    setAuthorName('');
    setAttachments([]);
  }

  return (
    <section className={styles.section} aria-labelledby="comments-heading">
      <h2 id="comments-heading" className={styles.sectionTitle}>
        💬 Comentarios
      </h2>

      {isLoading && <p className={styles.loadingText}>Cargando comentarios...</p>}

      {!isLoading && comments && comments.length === 0 && (
        <div className={styles.emptyState}>
          <p>Sin comentarios aún. Sé el primero en comentar.</p>
        </div>
      )}

      {!isLoading && comments && comments.length > 0 && (
        <div className={styles.timeline} role="list" aria-label="Comentarios de la tarea">
          {comments.map(comment => (
            <article
              key={comment.id}
              className={styles.commentCard}
              role="listitem"
              aria-label={`Comentario de ${comment.authorName}`}
            >
              <div className={styles.commentHeader}>
                <span className={styles.authorName}>{comment.authorName}</span>
                <div className={styles.commentMeta}>
                  <time className={styles.commentDate} dateTime={comment.createdAt}>
                    {formatDate(comment.createdAt)}
                  </time>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => void deleteComment.mutateAsync(comment.id)}
                    disabled={deleteComment.isPending}
                    aria-label={`Eliminar comentario de ${comment.authorName}`}
                    title="Eliminar comentario"
                  >
                    ×
                  </button>
                </div>
              </div>

              <p className={styles.commentBody}>{comment.body}</p>

              {comment.attachments.length > 0 && (
                <div className={styles.attachments} aria-label="Archivos adjuntos">
                  {comment.attachments.map(att => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.attachmentLink}
                      title={att.filename}
                    >
                      <span className={styles.attachmentIcon}>📎</span>
                      {att.filename}
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Add comment form */}
      <form className={styles.form} onSubmit={e => void handleSubmit(e)} aria-label="Agregar comentario">
        <div className={styles.formRow}>
          <label className={styles.label} htmlFor="comment-author">
            Nombre del autor
          </label>
          <input
            id="comment-author"
            type="text"
            className={styles.inputField}
            value={authorName}
            onChange={e => setAuthorName(e.target.value)}
            placeholder="Tu nombre..."
            aria-label="Nombre del autor"
            required
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.label} htmlFor="comment-body">
            Comentario
          </label>
          <textarea
            id="comment-body"
            className={styles.textarea}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Escribí un comentario..."
            aria-label="Cuerpo del comentario"
            required
          />
        </div>

        {/* Attachment rows */}
        <div className={styles.attachmentRows}>
          <div className={styles.attachmentRowLabel}>
            <span>Adjuntos (opcional)</span>
          </div>
          {attachments.map((att, idx) => (
            <div key={idx} className={styles.attachmentInputRow}>
              <input
                type="url"
                className={styles.inputField}
                placeholder="URL del archivo"
                value={att.url}
                onChange={e => updateAttachment(idx, 'url', e.target.value)}
                aria-label={`URL del adjunto ${idx + 1}`}
              />
              <input
                type="text"
                className={styles.inputField}
                placeholder="Nombre del archivo"
                value={att.filename}
                onChange={e => updateAttachment(idx, 'filename', e.target.value)}
                aria-label={`Nombre del adjunto ${idx + 1}`}
              />
              <button
                type="button"
                className={styles.btnRemoveAttachment}
                onClick={() => removeAttachmentRow(idx)}
                aria-label={`Quitar adjunto ${idx + 1}`}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.btnAddAttachment}
            onClick={addAttachmentRow}
          >
            + Agregar adjunto
          </button>
        </div>

        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.btnSubmit}
            disabled={!body.trim() || !authorName.trim() || addComment.isPending}
            aria-label="Agregar comentario"
          >
            {addComment.isPending ? 'Guardando...' : 'Agregar comentario'}
          </button>
        </div>
      </form>
    </section>
  );
}
