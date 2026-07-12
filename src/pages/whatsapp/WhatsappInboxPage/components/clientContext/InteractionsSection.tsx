import { Link } from 'react-router-dom';
import type { WhatsappInboxClientSummary } from '@/types/whatsapp';
import { formatDateShort } from '@/utils/formatDate';
import styles from '../ClientContextPanel.module.css';

interface InteractionsSectionProps {
  client: WhatsappInboxClientSummary;
}

/**
 * InteractionsSection — tickets abiertos / tareas / bitácora (messaging-inbox-v2
 * F1.5, design §5.4). Los límites (3/3/5) ya vienen truncados por el DTO
 * (RICH-3) — este componente solo renderiza lo que recibe, no vuelve a
 * cortar. Empty POSITIVO ("sin tickets abiertos", no cara triste).
 */
export function InteractionsSection({ client }: InteractionsSectionProps) {
  const { openTicketsCount, recentTickets, recentTasks, recentLogs, fichaClientId } = client;
  const ficha = `/admin/customers/view/${fichaClientId}`;
  // Fix bug BAJO (review adversarial): guards defensivos — si el BE degrada
  // mal y manda alguno de estos arrays undefined/null en vez de `[]`,
  // `.length`/`.map` no deben tirar TypeError.
  const tickets = recentTickets ?? [];
  const tasks = recentTasks ?? [];
  const logs = recentLogs ?? [];

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
      </div>

      <div className={styles['int-block']}>
        <div className={styles['int-blockHeader']}>
          <span className={styles['int-blockTitle']}>Tareas</span>
          <Link to={ficha} className={styles['int-link']}>
            Ver todas →
          </Link>
        </div>
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
