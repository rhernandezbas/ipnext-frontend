import { useClientComments } from '../../../hooks/useClients';
import styles from './Tab.module.css';

interface Props {
  clientId: string;
}

export function ActividadTab({ clientId }: Props) {
  const { data: comments, isLoading } = useClientComments(clientId);

  if (isLoading) return <div className={styles.tab}>Cargando...</div>;

  if (!comments || comments.length === 0) {
    return (
      <div className={styles.tab}>
        <p className={styles.emptyList}>Sin actividad registrada.</p>
      </div>
    );
  }

  return (
    <div className={styles.tab}>
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
    </div>
  );
}
