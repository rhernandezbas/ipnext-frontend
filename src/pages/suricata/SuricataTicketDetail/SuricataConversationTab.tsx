import { formatDateTime } from '@/utils/formatDate';
import { getSuricataAttachmentContentUrl } from '../api/suricataClient';
import type { SuricataAttachmentDto, SuricataMessageDto } from '../api/suricataClient';
import { SuricataReplyComposer } from './SuricataReplyComposer';
import styles from './SuricataConversationTab.module.css';

interface Props {
  ticketId: string;
  /** Ordered oldest → newest, per `SuricataTicketDetailDto`'s contract. */
  messages: SuricataMessageDto[];
  attachments: SuricataAttachmentDto[];
  /** Fase I — recipient/ticket context the reply composer's confirm modal
   *  shows verbatim (design D10: "mostrando el texto final" + destinatario). */
  customerName: string | null;
  customerPhone: string | null;
  ticketSubject: string;
  ticketExternalId: string;
}

type Lane = 'client' | 'staff' | 'system';

/**
 * suricata-tickets-mirror (Fase H, task H.2, spec UI-3) — the approved mockup
 * sketches 3 lanes (cliente/bot/staff), but the REAL BE contract
 * (`SuricataMessageAuthorKind`, `domain/entities/suricata.ts`) only has
 * `'customer' | 'agent' | 'system' | 'unknown'` — there is no dedicated `bot`
 * value on the wire. Deviation (flagged in the apply report): lanes are
 * derived from the 4 real values instead of inventing a `bot` detection that
 * the DTO does not support — `'system'`/`'unknown'` fall to a neutral lane
 * rather than guessing whether they came from a human or the bot.
 */
function deriveLane(authorKind: SuricataMessageDto['authorKind']): Lane {
  if (authorKind === 'customer') return 'client';
  if (authorKind === 'agent') return 'staff';
  return 'system';
}

const LANE_LABEL: Record<Lane, string> = {
  client: 'Mensaje del cliente',
  staff: 'Respuesta del agente',
  system: 'Mensaje del sistema',
};

function AttachmentView({ ticketId, attachment }: { ticketId: string; attachment: SuricataAttachmentDto }) {
  const isAudio = attachment.mimeType.startsWith('audio/');

  // UI-3 — an audio attachment renders inline and playable, NEVER a bare
  // download link. A NOT-yet-`stored` attachment has no bytes to proxy yet
  // (D7.b: migration runs async, can also land in `failed`) — an honest
  // placeholder beats a broken `<audio>` element with a 404 src.
  if (isAudio && attachment.status === 'stored') {
    return (
      <figure className={styles.audioFigure}>
        <audio
          data-testid="suricata-attachment-audio"
          className={styles.audioPlayer}
          controls
          preload="metadata"
          src={getSuricataAttachmentContentUrl(ticketId, attachment.id)}
        >
          Tu navegador no puede reproducir este audio.
        </audio>
        <figcaption className={styles.attachmentCaption}>{attachment.fileName}</figcaption>
      </figure>
    );
  }

  if (isAudio) {
    return (
      <span className={styles.attachmentPending}>
        {attachment.fileName} — audio {attachment.status === 'failed' ? 'no disponible' : 'sincronizándose'}
      </span>
    );
  }

  return <span className={styles.attachmentFile}>{attachment.fileName}</span>;
}

/**
 * SuricataConversationTab — UI-3: ordered message timeline, mirror-only
 * (zero live Suricata calls, UI-2). Molde `TicketMessagingThread`/`MessageItem`
 * (lanes + `role="list"`/`role="listitem"` + accessible names). Fase I adds
 * `SuricataReplyComposer` at the FOOT of this tab (design D13.a) — rendered
 * unconditionally so it survives regardless of whether the ticket has any
 * mirrored messages yet.
 */
export function SuricataConversationTab({
  ticketId,
  messages,
  attachments,
  customerName,
  customerPhone,
  ticketSubject,
  ticketExternalId,
}: Props) {
  // `SuricataAttachmentDto.messageId` is NULLABLE on the wire: the mirror can
  // store an attachment it could not tie to a specific thread message. Rendering
  // only `messageId === message.id` therefore DROPPED those rows entirely — with
  // no trace that they exist. For audio that is lost evidence (UI-3 treats voice
  // notes as first-class content), so orphans get their own section instead of
  // being filtered into nothing.
  const orphanAttachments = attachments.filter((a) => a.messageId === null);

  return (
    <div className={styles.tab}>
      {messages.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Sin mensajes en este ticket todavía.</p>
        </div>
      ) : (
        <div className={styles.timeline} role="list" aria-label="Conversación del ticket">
          {messages.map((message) => {
            const lane = deriveLane(message.authorKind);
            const messageAttachments = attachments.filter((a) => a.messageId === message.id);
            return (
              <div
                key={message.id}
                data-testid="suricata-message-row"
                className={`${styles.row} ${styles[lane]}`}
                role="listitem"
                aria-label={`${LANE_LABEL[lane]} de ${message.author}`}
              >
                <article className={styles.bubble}>
                  <div className={styles.meta}>
                    <span className={styles.sender}>{message.author}</span>
                    <time className={styles.time} dateTime={message.sentAt}>
                      {formatDateTime(message.sentAt)}
                    </time>
                  </div>

                  {message.body && <p className={styles.body}>{message.body}</p>}

                  {messageAttachments.length > 0 && (
                    <div className={styles.attachments} role="group" aria-label="Archivos adjuntos">
                      {messageAttachments.map((att) => (
                        <AttachmentView key={att.id} ticketId={ticketId} attachment={att} />
                      ))}
                    </div>
                  )}
                </article>
              </div>
            );
          })}
        </div>
      )}

      {orphanAttachments.length > 0 && (
        <section
          className={styles.orphanSection}
          role="group"
          aria-label="Adjuntos sin mensaje asociado"
        >
          <h3 className={styles.orphanTitle}>Adjuntos sin mensaje asociado</h3>
          <p className={styles.orphanHint}>
            El mirror guardó estos archivos pero no pudo vincularlos a un mensaje puntual del hilo.
          </p>
          <div className={styles.attachments}>
            {orphanAttachments.map((att) => (
              <AttachmentView key={att.id} ticketId={ticketId} attachment={att} />
            ))}
          </div>
        </section>
      )}

      <SuricataReplyComposer
        ticketId={ticketId}
        customerName={customerName}
        customerPhone={customerPhone}
        ticketSubject={ticketSubject}
        ticketExternalId={ticketExternalId}
      />
    </div>
  );
}
