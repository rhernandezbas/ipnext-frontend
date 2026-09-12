import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { useSuricataTicketDetail } from './hooks/useSuricataTickets';
import { SuricataConversationTab } from './SuricataTicketDetail/SuricataConversationTab';
import { SuricataAiAnalysisTab } from './SuricataTicketDetail/SuricataAiAnalysisTab';
import { SuricataClientDataTab } from './SuricataTicketDetail/SuricataClientDataTab';
import type { SuricataBotState } from './api/suricataClient';
import styles from './SuricataTicketDetailPage.module.css';

/**
 * suricata-tickets-mirror (Fase G, `SuricataTicketList.tsx`) already owns this
 * map, but that file is Fase G's committed scope ("NO los toques, seguí
 * encima") — duplicated here on purpose rather than editing a prior phase.
 */
const BOT_STATE_LABEL: Record<SuricataBotState, string> = {
  sin_analizar: 'Bot: sin revisar',
  resuelto_bot: 'Bot: resuelto solo',
  requiere_humano: 'Bot: necesitó humano',
  stale: 'Bot: desactualizado',
};

const TAB_IDS = {
  conversacion: 'conversacion',
  analisis: 'analisis',
  cliente: 'cliente',
} as const;

/**
 * SuricataTicketDetailPage — Fase H, task H.1, spec UI-2. RBAC gating
 * (`suricata.read`) lives at the route level (App.tsx `RequirePermission`,
 * same convention as `SuricataTicketsPage`). Single fetch
 * (`useSuricataTicketDetail`) feeds all 3 tabs — `mountMode="all"` keeps that
 * property trivially true (no tab ever issues its own request), matching
 * UI-2's "switching tabs MUST NOT trigger any live Suricata call".
 */
export default function SuricataTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ticketId = id ?? '';
  const { data: ticket, isLoading, isError, error, refetch } = useSuricataTicketDetail(ticketId);
  const [activeTab, setActiveTab] = useState<string>(TAB_IDS.conversacion);

  if (isLoading) {
    return (
      <div className={styles.skeleton} role="status" aria-label="Cargando ticket">
        Cargando ticket…
      </div>
    );
  }

  if (isError) {
    const notFound = axios.isAxiosError(error) && error.response?.status === 404;
    if (notFound) {
      return (
        <div className={styles.notFound}>
          <Link to="/admin/suricata-tickets" className={styles.backLink}>
            ‹ Volver a la lista
          </Link>
          <p>Ticket no encontrado.</p>
        </div>
      );
    }
    return (
      <div className={styles.errorBox} role="alert">
        <span>No pudimos cargar el ticket.</span>
        <button type="button" className={styles.retryBtn} onClick={() => void refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!ticket) return null;

  const tabs = [
    {
      id: TAB_IDS.conversacion,
      label: 'Conversación',
      content: (
        <SuricataConversationTab ticketId={ticket.id} messages={ticket.messages} attachments={ticket.attachments} />
      ),
    },
    {
      id: TAB_IDS.analisis,
      label: 'Análisis IA',
      content: <SuricataAiAnalysisTab verdicts={ticket.verdicts} />,
    },
    {
      id: TAB_IDS.cliente,
      label: 'Datos del cliente',
      content: <SuricataClientDataTab ticket={ticket} />,
    },
  ];

  return (
    <div className={styles.page}>
      <Link to="/admin/suricata-tickets" className={styles.backLink}>
        ‹ Volver a la lista
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>{ticket.customerName ?? ticket.subject}</h1>
        <p className={styles.subtitle}>
          #{ticket.externalId} · {ticket.subject}
        </p>
        <div className={styles.badges}>
          <span className={styles.badge}>{ticket.status}</span>
          {ticket.areaName && <span className={`${styles.badge} ${styles.badgeArea}`}>{ticket.areaName}</span>}
          <span className={styles.badge} data-bot={ticket.botState}>
            {BOT_STATE_LABEL[ticket.botState]}
          </span>
        </div>
        <p className={styles.assignee}>
          {ticket.assigneeName ? `Asignado: ${ticket.assigneeName}` : 'Sin asignar'}
        </p>
      </header>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} mountMode="all" />
    </div>
  );
}
