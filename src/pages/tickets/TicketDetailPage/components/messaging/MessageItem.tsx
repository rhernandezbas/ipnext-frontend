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
    // M3 (fix wave) — role="listitem"/aria-label viven acá, en el HIJO
    // DIRECTO del `<div role="list">` del hilo (`TicketMessagingThread`).
    // Antes vivían en el <article> de adentro, con este div genérico
    // interpuesto — por spec ARIA, listitem debe ser hijo directo de list;
    // con un contenedor sin rol en el medio la relación se rompe.
    <div
      data-testid="message-item-row"
      className={rowClassName}
      role="listitem"
      aria-label={ACCESSIBLE_NAME[lane](comment.authorName)}
    >
      <article className={styles.bubble}>
        {lane === 'note' && (
          <div className={styles.noteHeader}>
            <IconNote className={styles.noteIcon} />
            <span>Nota interna</span>
          </div>
        )}

        {/* M1 (fix wave) — etiquetado simétrico: antes SOLO la nota interna
            llevaba texto visible; la respuesta pública se distinguía únicamente
            por color/lado (el texto "al cliente" vivía solo en el aria-label,
            invisible para un operador vidente). "¿Esto lo vio el cliente?" no
            puede responderse por AUSENCIA de etiqueta. */}
        {lane === 'staff' && (
          <div className={styles.staffHeader}>
            <span>Enviado al cliente</span>
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
          // M3 — role="group": un <div> sin rol (generic) no expone
          // aria-label en el árbol de accesibilidad; "group" sí.
          <div className={styles.attachments} role="group" aria-label="Archivos adjuntos">
            {comment.attachments.map((att) => (
              <TicketMessageAttachmentView key={att.id} attachment={att} />
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
