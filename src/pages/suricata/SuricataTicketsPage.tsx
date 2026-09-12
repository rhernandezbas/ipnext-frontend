import { SuricataKpiStrip } from './SuricataKpiStrip';
import { SuricataTicketList } from './SuricataTicketList';
import styles from './SuricataTicketsPage.module.css';

/**
 * suricata-tickets-mirror (Fase G, tasks G.3/G.4/G.5) — "Tickets Suricata"
 * panel entry point. Route-level `RequirePermission` (App.tsx) already gates
 * `suricata.read` before this component ever mounts (same convention as
 * `/admin/alerts`, `/admin/tickets`, etc.) — this component only composes the
 * KPI strip and the filterable list. Detail tabs (Fase H) and the reply
 * action (Fase I) are out of scope here.
 */
export default function SuricataTicketsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tickets Suricata</h1>
      </div>
      <SuricataKpiStrip />
      <SuricataTicketList />
    </div>
  );
}
