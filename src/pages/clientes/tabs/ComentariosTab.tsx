import { useState } from 'react';
import { useClientComments, useCreateComment } from '../../../hooks/useClients';
import { Button } from '../../../components/atoms/Button/Button';
import styles from './Tab.module.css';

interface Props {
  clientId: string;
}

export function ComentariosTab({ clientId }: Props) {
  const [text, setText] = useState('');
  const { data: comments, isLoading } = useClientComments(clientId);
  const { mutate, isPending } = useCreateComment();

  function handleSubmit() {
    const content = text.trim();
    if (!content) return;
    mutate({ clientId, content, authorName: 'Admin' });
    setText('');
  }

  return (
    <div className={styles.tab}>
      <div className={styles.commentForm}>
        <textarea
          className={styles.commentTextarea}
          placeholder="Escribí un comentario..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={isPending}
        >
          Agregar comentario
        </Button>
      </div>

      {isLoading ? (
        <p className={styles.emptyList}>Cargando...</p>
      ) : !comments || comments.length === 0 ? (
        <p className={styles.emptyList}>Sin comentarios.</p>
      ) : (
        <ul className={styles.commentList}>
          {comments.map((comment) => (
            <li key={comment.id} className={styles.commentItem}>
              <span className={styles.commentAuthor}>{comment.authorName}</span>
              <span className={styles.commentContent}>{comment.content}</span>
              <span className={styles.commentDate}>
                {new Date(comment.createdAt).toLocaleDateString('es-AR')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
