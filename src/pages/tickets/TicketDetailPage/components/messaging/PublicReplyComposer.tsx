import { useRef, useState } from 'react';
import { useSendStaffTicketReply } from '@/hooks/useTicketMessages';
import { useConfirm } from '@/context/ConfirmContext';
import {
  classifyTicketMessageFile,
  TICKET_MESSAGE_MAX_ATTACHMENTS,
  TICKET_MESSAGE_MAX_TOTAL_BATCH_BYTES,
  TICKET_MESSAGE_MAX_BODY_LEN,
  TICKET_MESSAGE_IMAGE_MIME_TYPES,
  TICKET_MESSAGE_AUDIO_MIME_TYPES,
  TICKET_MESSAGE_VIDEO_MIME_TYPES,
} from '@/types/ticketMessages';
import { mapTicketMessageError } from '@/utils/mapTicketMessageError';
import { Button } from '@/components/atoms/Button';
import { IconSend, IconPaperclip, IconClose, IconMic, IconVideoCam } from '../messagingIcons';
import styles from './PublicReplyComposer.module.css';

interface AttachmentDraft {
  file: File;
  kind: 'image' | 'audio' | 'video';
  /** Data-URI para preview local (solo imágenes) — nunca lo que se envía (se envía `file`). */
  previewUrl: string | null;
}

interface Props {
  ticketId: string;
  authorName: string | null;
}

const ACCEPT = [
  ...TICKET_MESSAGE_IMAGE_MIME_TYPES,
  ...TICKET_MESSAGE_AUDIO_MIME_TYPES,
  ...TICKET_MESSAGE_VIDEO_MIME_TYPES,
].join(',');

const MSG_UNSUPPORTED = 'Formato no soportado. Solo imagen, audio o video de los tipos permitidos.';
const MSG_TOO_MANY = `Máximo ${TICKET_MESSAGE_MAX_ATTACHMENTS} adjuntos por respuesta.`;
const MSG_BATCH_TOO_LARGE = `El tamaño combinado de los adjuntos supera el límite de ${Math.floor(TICKET_MESSAGE_MAX_TOTAL_BATCH_BYTES / (1024 * 1024))}MB por envío.`;

function tooLargeMessage(filename: string, kind: 'image' | 'audio' | 'video', maxBytes: number): string {
  const mb = Math.floor(maxBytes / (1024 * 1024));
  const kindEs = kind === 'image' ? 'imagen' : kind === 'audio' ? 'audio' : 'video';
  return `"${filename}" supera el límite de ${mb}MB para adjuntos de ${kindEs}.`;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * PublicReplyComposer — "Responder al cliente" (ticket-messaging-ui, golden
 * rule). Camino DISTINTO de `NoteComposer`: propio estado, propio submit,
 * propia mutación (`useSendStaffTicketReply` → POST /:ticketId/messages,
 * SIEMPRE `visibility: public` — la ruta lo fija, este cliente ni lo manda).
 * Envía los `File` REALES (multipart), no data-URI — la preview local de
 * imagen es solo cosmética (nunca lo que viaja al servidor).
 */
export function PublicReplyComposer({ ticketId, authorName }: Props) {
  const sendReply = useSendStaffTicketReply(ticketId);
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // H2 (fix wave) — reservas SÍNCRONAS de cupo/bytes en vuelo. `addFiles`
  // acepta archivos leyendo `attachments` del closure/render (stale); sin
  // esto, dos llamadas rápidas (dos selecciones antes de que la primera
  // commitee a `attachments`) ven el MISMO `attachments.length` de partida y
  // ambas aceptan hasta el cap completo — el total combinado se pasa, el BE
  // tira 422 y se pierde el envío entero. Mismo patrón que
  // `NoteComposer.pendingCountRef`.
  const pendingCountRef = useRef(0);
  const pendingBytesRef = useRef(0);

  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  // H1 (fix wave) — cuántas lecturas de `readAsDataURL` siguen en vuelo.
  // `addFiles` acepta el archivo sincrónicamente pero recién lo agrega a
  // `attachments` cuando la lectura async resuelve; sin este contador, un
  // submit disparado ENTRE esos dos momentos manda el mensaje sin el adjunto
  // — el operador ve "Respuesta enviada al cliente." con el archivo perdido
  // en silencio. Bloquea el submit mientras `pendingReads > 0`.
  const [pendingReads, setPendingReads] = useState(0);

  const bodyTooLong = body.length > TICKET_MESSAGE_MAX_BODY_LEN;

  function addFiles(files: File[]) {
    setError(null);
    const messages: string[] = [];
    const pushMsg = (m: string) => {
      if (!messages.includes(m)) messages.push(m);
    };

    // H2 — arranca desde attachments YA commiteados + lo que otra llamada de
    // addFiles en vuelo ya reservó (pendingCountRef/pendingBytesRef), no solo
    // desde el `attachments.length` de este render.
    let countSoFar = attachments.length + pendingCountRef.current;
    let batchBytesSoFar = attachments.reduce((sum, a) => sum + a.file.size, 0) + pendingBytesRef.current;
    const accepted: Array<{ file: File; kind: 'image' | 'audio' | 'video' }> = [];

    for (const file of files) {
      const classified = classifyTicketMessageFile(file.type);
      if (!classified) {
        pushMsg(MSG_UNSUPPORTED);
        continue;
      }
      if (file.size > classified.maxBytes) {
        pushMsg(tooLargeMessage(file.name, classified.kind, classified.maxBytes));
        continue;
      }
      if (countSoFar >= TICKET_MESSAGE_MAX_ATTACHMENTS) {
        pushMsg(MSG_TOO_MANY);
        continue;
      }
      if (batchBytesSoFar + file.size > TICKET_MESSAGE_MAX_TOTAL_BATCH_BYTES) {
        pushMsg(MSG_BATCH_TOO_LARGE);
        continue;
      }
      countSoFar += 1;
      batchBytesSoFar += file.size;
      accepted.push({ file, kind: classified.kind });
    }

    if (accepted.length > 0) {
      // Reservar YA (sincrónico, antes del primer `await`) — así una segunda
      // llamada a addFiles en el mismo tick ve esta reserva vía
      // pendingCountRef/pendingBytesRef, aunque `attachments` (state) todavía
      // no haya commiteado nada.
      const acceptedBytes = accepted.reduce((sum, a) => sum + a.file.size, 0);
      pendingCountRef.current += accepted.length;
      pendingBytesRef.current += acceptedBytes;
      setPendingReads((n) => n + accepted.length);
      void (async () => {
        try {
          const drafts: AttachmentDraft[] = await Promise.all(
            accepted.map(async (a) => ({
              file: a.file,
              kind: a.kind,
              previewUrl: a.kind === 'image' ? await readAsDataURL(a.file).catch(() => null) : null,
            })),
          );
          setAttachments((prev) => [...prev, ...drafts]);
        } finally {
          // Liberar la reserva DESPUÉS de haber commiteado a `attachments`
          // (mismo tick, sin `await` entre medio) — nunca queda una ventana
          // donde ni la reserva ni el state cuenten el batch.
          pendingCountRef.current = Math.max(0, pendingCountRef.current - accepted.length);
          pendingBytesRef.current = Math.max(0, pendingBytesRef.current - acceptedBytes);
          setPendingReads((n) => Math.max(0, n - accepted.length));
        }
      })();
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addFiles(files);
    e.target.value = '';
  }

  // L2 (fix wave) — `NoteComposer` soporta pegar (Ctrl+V) un screenshot;
  // este composer no tenía NADA — el operador pegaba una imagen en la caja
  // PÚBLICA y no pasaba nada, silencio total (ni error, ni chip). Mismo
  // handler que `NoteComposer.handlePaste`, reusando `addFiles` (que ya
  // valida contra el allowlist image/audio/video, no solo imagen).
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
    addFiles(allFiles);
  }

  const canSubmit =
    !!authorName &&
    (body.trim().length > 0 || attachments.length > 0) &&
    !bodyTooLong &&
    !sendReply.isPending &&
    pendingReads === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // H1 — guard explícito además de `canSubmit`/`disabled`: un Enter en el
    // textarea también dispara `onSubmit` del form, así que el bloqueo no
    // puede depender solo de que el botón esté deshabilitado.
    if (!canSubmit || !authorName || pendingReads > 0) return;

    // H4 (fix wave, HIGH) — confirmación EXPLÍCITA antes de mandar algo
    // irreversible: el cliente lo ve en su teléfono y acá no hay editar ni
    // borrar. Mismo `useConfirm` que ya usa el repo para acciones
    // irreversibles (ver `TicketDetailPage.handleDelete`). La nota interna
    // (`NoteComposer`) NO pasa por acá — queda sin fricción a propósito.
    const confirmed = await confirm({
      title: 'Enviar al cliente',
      message: 'Esto se envía al cliente ahora mismo y no se puede editar ni borrar después. ¿Confirmás el envío?',
      confirmLabel: 'Enviar al cliente',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

    setError(null);
    setFeedback(null);
    try {
      await sendReply.mutateAsync({
        ticketId,
        body: body.trim(),
        authorName,
        files: attachments.map((a) => a.file),
      });
      setBody('');
      setAttachments([]);
      setFeedback('Respuesta enviada al cliente.');
    } catch (err) {
      setError(mapTicketMessageError(err));
    }
  }

  return (
    <form className={styles.card} onSubmit={(e) => void handleSubmit(e)} aria-label="Responder al cliente">
      <header className={styles.header}>
        <IconSend className={styles.headerIcon} />
        <div>
          <span className={styles.headerTitle}>Responder al cliente</span>
          <span className={styles.headerHint}>Lo va a ver el cliente en su app.</span>
        </div>
      </header>

      <label className={styles.srOnly} htmlFor="ticket-reply-body">Respuesta al cliente</label>
      <textarea
        id="ticket-reply-body"
        className={styles.textarea}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          // M4 (fix wave) — el feedback de éxito quedaba pegado para siempre
          // (solo se limpiaba en el PRÓXIMO submit); el operador arrancaba un
          // draft nuevo con "Respuesta enviada al cliente." todavía debajo,
          // que se lee como si ESTE draft ya hubiera salido.
          if (feedback) setFeedback(null);
        }}
        onPaste={handlePaste}
        placeholder="Escribí tu respuesta para el cliente… (pegá una imagen/audio/video con Ctrl+V)"
      />
      {/* M2 (fix wave) — SIN aria-live: era "polite" y anunciaba el número en
          CADA tecla tipeada, ruido total para un lector de pantalla. */}
      <p className={bodyTooLong ? styles.counterOver : styles.counter}>
        {body.length} / {TICKET_MESSAGE_MAX_BODY_LEN}
        {bodyTooLong && ' — superaste el largo máximo permitido.'}
      </p>

      {pendingReads > 0 && (
        <p className={styles.pendingReadsHint} role="status">
          Cargando {pendingReads === 1 ? 'adjunto' : `${pendingReads} adjuntos`}…
        </p>
      )}

      {attachments.length > 0 && (
        <ul className={styles.pendingRow} aria-label="Adjuntos pendientes">
          {attachments.map((a, idx) => (
            <li key={`${a.file.name}-${idx}`} className={styles.pendingChip}>
              {a.kind === 'image' && a.previewUrl ? (
                <img className={styles.pendingThumb} src={a.previewUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className={styles.pendingKindIcon} aria-hidden="true">
                  {a.kind === 'audio' ? <IconMic /> : <IconVideoCam />}
                </span>
              )}
              <span className={styles.pendingFilename}>{a.file.name}</span>
              <button
                type="button"
                className={styles.pendingRemove}
                onClick={() => removeAttachment(idx)}
                aria-label={`Quitar adjunto ${a.file.name}`}
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
          accept={ACCEPT}
          multiple
          className={styles.srOnly}
          id="ticket-reply-file"
          aria-label="Adjuntar archivo"
          onChange={handleFileChange}
        />
        <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
          <IconPaperclip className={styles.paperclipIcon} />
          Adjuntar
        </Button>

        <span className={styles.spacer} />

        {authorName === null ? (
          <span className={styles.loginPrompt}>Iniciá sesión para responder</span>
        ) : (
          <Button type="submit" variant="primary" size="md" disabled={!canSubmit} loading={sendReply.isPending}>
            <IconSend className={styles.submitIcon} />
            Enviar al cliente
          </Button>
        )}
      </div>

      <p className={styles.hint}>
        Hasta {TICKET_MESSAGE_MAX_ATTACHMENTS} adjuntos (imagen, audio o video), {Math.floor(TICKET_MESSAGE_MAX_TOTAL_BATCH_BYTES / (1024 * 1024))}MB combinados como máximo.
      </p>
    </form>
  );
}
