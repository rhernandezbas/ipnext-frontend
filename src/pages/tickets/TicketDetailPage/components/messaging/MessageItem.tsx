import { IconNote } from '../messagingIcons';
import { TicketMessageAttachmentView } from './TicketMessageAttachmentView';
import type { TicketComment } from '@/types/ticketComments';
import { formatDateTime } from '@/utils/formatDate';
import styles from './MessageItem.module.css';

interface Props {
  comment: TicketComment;
  isNew: boolean;
}

type Lane = 'note' | 'client' | 'staff';

/**
 * La regla de oro de esta UI: la visibilidad la determina la RUTA que la creó
 * (POST /comments = interna, POST /messages = pública), NUNCA un campo que el
 * front reinterprete. Acá solo LEEMOS lo que el BE ya decidió (`visibility`/
 * `authorKind`) para elegir la lane visual — no hay ninguna lógica que
 * "adivine" visibilidad a partir del contenido.
 *
 * Metadata ausente (fixtures legacy pre-messaging, antes de que estos campos
 * existieran) cae al lado SEGURO: 'note' — nunca se etiqueta como "enviado al
 * cliente" un comentario cuya visibilidad real se desconoce.
 */
function deriveLane(comment: TicketComment): Lane {
  const visibility = comment.visibility ?? 'internal';
  if (visibility === 'internal') return 'note';
  const authorKind = comment.authorKind ?? 'staff';
  return authorKind === 'client' ? 'client' : 'staff';
}

const ACCESSIBLE_NAME: Record<Lane, (author: string) => string> = {
  note: (author) => `Nota interna de ${author}`,
  staff: (author) => `Respuesta al cliente de ${author}`,
  client: (author) => `Mensaje de ${author}`,
};

/**
 * MessageItem — una entrada del hilo, en una de 3 lanes visuales
 * (ticket-messaging-ui, golden rule). Mismo grid de color/lado que
 * `MessageBubble` del inbox de WhatsApp (tokens ya verificados WCAG 2.1):
 * nota interna = ancho completo + `--color-note-*` + label de TEXTO "Nota
 * interna"; respuesta pública del staff = burbuja outbound (derecha, azul);
 * mensaje del cliente = burbuja inbound (izquierda, gris). El nombre
 * accesible del `listitem` distingue las 3 lanes en TEXTO, para lectores de
 * pantalla, más allá del color/lado.
 */
export function MessageItem({ comment, isNew }: Props) {
  const lane = deriveLane(comment);
  const rowClassName = [styles.row, styles[lane], isNew ? styles.enter : ''].filter(Boolean).join(' ');

  return (
    <div data-testid="message-item-row" className={rowClassName}>
      <article
        className={styles.bubble}
        role="listitem"
        aria-label={ACCESSIBLE_NAME[lane](comment.authorName)}
      >
        {lane === 'note' && (
          <div className={styles.noteHeader}>
            <IconNote className={styles.noteIcon} />
            <span>Nota interna</span>
          </div>
        )}

        <div className={styles.meta}>
          <span className={styles.sender}>{comment.authorName}</span>
          <time className={styles.time} dateTime={comment.createdAt}>
            {formatDateTime(comment.createdAt)}
          </time>
        </div>

        {comment.body && <p className={styles.body}>{comment.body}</p>}

        {comment.attachments.length > 0 && (
          <div className={styles.attachments} aria-label="Archivos adjuntos">
            {comment.attachments.map((att) => (
              <TicketMessageAttachmentView key={att.id} attachment={att} />
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
