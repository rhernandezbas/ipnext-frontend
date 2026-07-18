import { Link } from 'react-router-dom';
import type { WhatsappInboxClientSummary, WhatsappInboxConversationsSummary } from '@/types/whatsapp';
import { formatDateShort } from '@/utils/formatDate';
import { IconCheck } from '../statusIcons';
import styles from '../ClientContextPanel.module.css';

interface InteractionsSectionProps {
  client: WhatsappInboxClientSummary;
  /**
   * Aditivo (contador de conversaciones) — TOP-LEVEL del contexto
   * (`WhatsappInboxClientContext.conversations`), NO un campo de `client`
   * (ver el tipo). Opcional para no romper los fixtures existentes de este
   * componente (backcompat: deploy FE puede llegar antes que un refetch que
   * traiga el campo nuevo) — se renderiza defensivo con ceros si falta.
   */
  conversations?: WhatsappInboxConversationsSummary;
}

/**
 * Etiqueta del contador de la subsección "Cerrados"/"Cerradas" (F1.5 spec #2).
 * El BE ya trunca el array mostrado (top 2) — si el total real es mayor, se
 * aclara cuántos se están mostrando ("Cerrados: 5 · mostrando 2") en vez de
 * mentir con un número que no coincide con la lista renderizada.
 */
function closedCounterLabel(word: 'Cerrados' | 'Cerradas', total: number, shown: number): string {
  return total > shown ? `${word}: ${total} · mostrando ${shown}` : `${word}: ${total}`;
}

/**
 * Etiqueta del bloque "Conversaciones" (contador de interacciones — cuántas
 * veces el cliente abrió una conversación; abierta + resuelta/cerrada = 1
 * interacción, contrato BE `conversations: {total, open, resolved}` TOP-LEVEL
 * en `GET .../client-context`). Se llama solo con `total > 0` — el caso
 * `total === 0` tiene su propio empty state positivo en el render ("Sin
 * conversaciones previas"), igual que "Sin tickets abiertos". Omite la parte
 * en 0 del detalle (p. ej. total=1/open=1/resolved=0 ⇒ "1 conversación · 1
 * abierta", sin "· 0 resueltas") y usa singular/plural correcto en las 3
 * unidades (conversación/es, abierta/s, resuelta/s).
 */
function conversationsSummaryLabel(total: number, open: number, resolved: number): string {
  const parts: string[] = [];
  if (open > 0) parts.push(`${open} ${open === 1 ? 'abierta' : 'abiertas'}`);
  if (resolved > 0) parts.push(`${resolved} ${resolved === 1 ? 'resuelta' : 'resueltas'}`);
  const detail = parts.length > 0 ? ` · ${parts.join(' · ')}` : '';
  return `${total} ${total === 1 ? 'conversación' : 'conversaciones'}${detail}`;
}

/**
 * InteractionsSection — tickets abiertos / tareas / bitácora (messaging-inbox-v2
 * F1.5, design §5.4). Los límites (3/3/5) ya vienen truncados por el DTO
 * (RICH-3) — este componente solo renderiza lo que recibe, no vuelve a
 * cortar. Empty POSITIVO ("sin tickets abiertos", no cara triste).
 *
 * F1.5 spec #2 (ESTADOS ABIERTO/CERRADO) — cada bloque (tickets, tareas) se
 * agrupa en 2 subsecciones cuando hay cerrados: "Abiertos"/"Abiertas" arriba
 * (el estilo accionable de siempre) y "Cerrados"/"Cerradas" debajo, MUTED.
 * El heading de subsección SOLO aparece si hay cerrados (`closed*Count>0`) —
 * un cliente sin cerrados se ve exactamente como antes de este cambio. La
 * distinción NO depende solo del color: ítems cerrados llevan además un
 * ícono ✓ `aria-hidden` (el nombre accesible vive en el heading "Cerrados",
 * mismo patrón que `statusIcons.tsx`) y un label textual por-ítem —
 * "Cerrado" para tickets, "Cerrada"/"Descartada" para tareas (paridad a11y,
 * fix review adversarial: antes el ticket cerrado no tenía texto por-ítem).
 *
 * Gate de la subsección "Cerrados"/"Cerradas" (fix review adversarial,
 * bug MEDIO): se gatea por el ARRAY (`recentClosed*.length > 0`), NUNCA por
 * el contador — igual que el bloque "Abiertos". Si el BE manda un count y un
 * array inconsistentes (race entre queries), el array manda: nunca se pierde
 * silenciosamente un ítem que sí llegó. El contador que se muestra en el
 * heading se CLAMPEA a `Math.max(count, array.length)` — nunca puede mostrar
 * un número menor a la cantidad de ítems listados.
 */
export function InteractionsSection({ client, conversations }: InteractionsSectionProps) {
  const {
    openTicketsCount,
    recentTickets,
    recentClosedTickets,
    closedTicketsCount,
    openTasksCount,
    recentTasks,
    recentClosedTasks,
    closedTasksCount,
    recentLogs,
    fichaClientId,
  } = client;
  const ficha = `/admin/customers/view/${fichaClientId}`;
  // Fix bug BAJO (review adversarial): guards defensivos — si el BE degrada
  // mal y manda alguno de estos arrays undefined/null en vez de `[]`,
  // `.length`/`.map` no deben tirar TypeError. Mismo criterio para los
  // campos nuevos de cerrados (spec #2).
  const tickets = recentTickets ?? [];
  const closedTickets = recentClosedTickets ?? [];
  // Fix bug MEDIO (review adversarial): gate por ARRAY (no por contador) +
  // contador clampeado — ver comentario del bloque arriba.
  const hasClosedTickets = closedTickets.length > 0;
  const closedTicketsTotal = Math.max(closedTicketsCount ?? 0, closedTickets.length);
  const openTasksTotal = openTasksCount ?? 0;
  const tasks = recentTasks ?? [];
  const closedTasks = recentClosedTasks ?? [];
  const hasClosedTasks = closedTasks.length > 0;
  const closedTasksTotal = Math.max(closedTasksCount ?? 0, closedTasks.length);
  const logs = recentLogs ?? [];
  // Fix backcompat (contador de conversaciones): `conversations` es TOP-LEVEL
  // del contexto, opcional — un deploy FE puede llegar antes que un refetch
  // que traiga el campo nuevo. Ceros por defecto, nunca undefined/NaN.
  const conversationsTotal = conversations?.total ?? 0;
  const conversationsOpen = conversations?.open ?? 0;
  const conversationsResolved = conversations?.resolved ?? 0;

  return (
    // Fix bug MEDIO a11y (review adversarial): sub-sección SIN landmark
    // propio — solo el panel raíz es `<section>` (ver `FinancialSection.tsx`).
    <div className={styles['int-section']}>
      <h3 className={styles['int-title']}>
        Interacciones
      </h3>

      <div className={styles['int-block']}>
        <div className={styles['int-blockHeader']}>
          <span className={openTicketsCount > 0 ? styles['int-ticketsCountOpen'] : styles['int-ticketsCount']}>
            {openTicketsCount} {openTicketsCount === 1 ? 'ticket abierto' : 'tickets abiertos'}
          </span>
          <Link to={ficha} className={styles['int-link']}>
            Ver todos →
          </Link>
        </div>
        {hasClosedTickets && <h4 className={styles['int-subheading']}>Abiertos</h4>}
        {tickets.length === 0 ? (
          <p className={styles['int-empty']}>Sin tickets abiertos</p>
        ) : (
          <ul className={styles['int-list']}>
            {tickets.map((t) => (
              <li key={t.id} className={styles['int-item']}>
                <span className={styles['int-seq']}>#{t.sequenceNumber}</span>
                <span className={styles['int-subject']}>{t.subject}</span>
                <span className={styles['int-status']}>{t.status}</span>
              </li>
            ))}
          </ul>
        )}
        {hasClosedTickets && (
          <div className={styles['int-closedGroup']}>
            <h4 className={[styles['int-subheading'], styles['int-subheadingMuted']].join(' ')}>
              {closedCounterLabel('Cerrados', closedTicketsTotal, closedTickets.length)}
            </h4>
            <ul className={styles['int-list']}>
              {closedTickets.map((t) => (
                <li key={t.id} className={[styles['int-item'], styles['int-itemClosed']].join(' ')}>
                  <IconCheck className={styles['int-closedIcon']} />
                  <span className={styles['int-seq']}>#{t.sequenceNumber}</span>
                  <span className={[styles['int-subject'], styles['int-subjectClosed']].join(' ')}>
                    {t.subject}
                  </span>
                  {/* Fix bug BAJO (review adversarial) — paridad a11y con la
                      tarea cerrada: label textual por-ítem, no solo el ícono
                      aria-hidden (un lector de pantalla que entra al <li> sin
                      pasar por el heading "Cerrados" no sabía que estaba
                      cerrado). */}
                  <span className={styles['int-closedLabel']}>Cerrado</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={styles['int-block']}>
        <div className={styles['int-blockHeader']}>
          {/* Fix bug BAJO (review adversarial): `openTasksCount` era código
              muerto (el tipo lo tenía, nada lo renderizaba). Paridad con el
              bloque de tickets — mismo patrón/estilo (`int-ticketsCount(Open)`). */}
          <span className={openTasksTotal > 0 ? styles['int-ticketsCountOpen'] : styles['int-ticketsCount']}>
            {openTasksTotal} {openTasksTotal === 1 ? 'tarea abierta' : 'tareas abiertas'}
          </span>
          <Link to={ficha} className={styles['int-link']}>
            Ver todas →
          </Link>
        </div>
        {hasClosedTasks && <h4 className={styles['int-subheading']}>Abiertas</h4>}
        {tasks.length === 0 ? (
          <p className={styles['int-empty']}>Sin actividad reciente</p>
        ) : (
          <ul className={styles['int-list']}>
            {tasks.map((t) => (
              <li key={t.id} className={styles['int-item']}>
                <span className={styles['int-seq']}>#{t.sequenceNumber}</span>
                <span className={styles['int-subject']}>{t.title}</span>
              </li>
            ))}
          </ul>
        )}
        {hasClosedTasks && (
          <div className={styles['int-closedGroup']}>
            <h4 className={[styles['int-subheading'], styles['int-subheadingMuted']].join(' ')}>
              {closedCounterLabel('Cerradas', closedTasksTotal, closedTasks.length)}
            </h4>
            <ul className={styles['int-list']}>
              {closedTasks.map((t) => (
                <li key={t.id} className={[styles['int-item'], styles['int-itemClosed']].join(' ')}>
                  <IconCheck className={styles['int-closedIcon']} />
                  <span className={styles['int-seq']}>#{t.sequenceNumber}</span>
                  <span className={[styles['int-subject'], styles['int-subjectClosed']].join(' ')}>{t.title}</span>
                  <span className={styles['int-taskLabel']}>
                    {t.status === 'dismissed' ? 'Descartada' : 'Cerrada'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Conversaciones — contador de interacciones (cuántas veces el
          cliente abrió una conversación; abierta + resuelta/cerrada = 1
          interacción). Mismo patrón visual que tickets/tareas (línea
          prominente con el mismo tratamiento de color), SIN link "Ver
          todos" — no hay vista filtrada por cliente. */}
      <div className={styles['int-block']}>
        {conversationsTotal === 0 ? (
          <p className={styles['int-empty']}>Sin conversaciones previas</p>
        ) : (
          <span
            className={conversationsOpen > 0 ? styles['int-ticketsCountOpen'] : styles['int-ticketsCount']}
          >
            {conversationsSummaryLabel(conversationsTotal, conversationsOpen, conversationsResolved)}
          </span>
        )}
      </div>

      <div className={styles['int-block']}>
        <span className={styles['int-blockTitle']}>Bitácora</span>
        {logs.length === 0 ? (
          <p className={styles['int-empty']}>Sin actividad reciente</p>
        ) : (
          <ul className={styles['int-logList']}>
            {logs.map((log) => (
              <li key={log.id} className={styles['int-logItem']}>
                <span className={styles['int-logTime']}>{formatDateShort(log.timestamp)}</span>
                <span className={styles['int-logType']}>{log.eventType}</span>
                <span className={styles['int-logDesc']}>{log.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
