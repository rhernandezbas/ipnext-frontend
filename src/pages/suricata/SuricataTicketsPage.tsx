import { Can } from '@/components/auth/Can';
import { SuricataKpiStrip } from './SuricataKpiStrip';
import { SuricataTicketList } from './SuricataTicketList';
import { useTriggerSuricataSync } from './hooks/useSuricataTickets';
import styles from './SuricataTicketsPage.module.css';

/**
 * suricata-tickets-mirror (fix wave, 2026-09-13) — "Sincronizar ahora": reusa
 * el MISMO scheduler que corre cada 15 min (`POST /api/suricata/sync`), nunca
 * dispara una sesión Playwright aparte. `suricata.manage` (no `read`): es una
 * acción operativa, mismo gate que la asignación interna.
 */
function SyncNowButton() {
  const sync = useTriggerSuricataSync();
  const result = sync.data;

  const feedback = sync.isError
    ? 'No se pudo sincronizar. Reintentá en unos segundos.'
    : result?.skipped
      ? 'Sincronización deshabilitada o ya en curso.'
      : result?.outcome
        ? `Listo: ${result.ticketsUpserted ?? 0} ticket(s) actualizados.`
        : null;

  return (
    <Can permission="suricata.manage">
      <div className={styles.syncAction}>
        <button
          type="button"
          className={styles.btnSync}
          disabled={sync.isPending}
          onClick={() => sync.mutate()}
        >
          {sync.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
        {feedback && (
          <span className={sync.isError ? styles.syncFeedbackError : styles.syncFeedback} role="status">
            {feedback}
          </span>
        )}
      </div>
    </Can>
  );
}

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
        <SyncNowButton />
      </div>
      <SuricataKpiStrip />
      <SuricataTicketList />
    </div>
  );
}
