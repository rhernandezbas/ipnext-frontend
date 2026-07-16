import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { CampaignComposer } from './BulkMessagingPage/components/composer/CampaignComposer';
import { CampaignsTable } from './BulkMessagingPage/components/history/CampaignsTable';
import { CampaignDetail } from './BulkMessagingPage/components/detail/CampaignDetail';
import styles from './BulkMessagingPage.module.css';

type BulkMessagingTabId = 'new' | 'history';

/**
 * BulkMessagingPage (F2 — apply chunk 3) — container + Tabs "Nueva
 * campaña"/"Historial". El tab "Historial" ahora es real: muestra
 * `CampaignsTable` (HIST-1) o, si hay `?campaign=<id>` en la URL,
 * `CampaignDetail` (HIST-2/HIST-3/SEND-1) — el mismo query param que el
 * composer (chunk 2) ya persistía al crear una campaña.
 *
 * `Tabs` usa `mountMode="all"` (default) — AMBOS tabs se montan siempre
 * (solo se oculta con CSS), así que `CampaignsTable`/`CampaignDetail`
 * fetchean apenas se monta la página, sin esperar el click en "Historial"
 * — mismo comportamiento ya establecido para `CampaignComposer` (BMP-4). El
 * fetch on-mount inicial NO cambia con el Fix Wave de abajo.
 *
 * MEDIUM-2 (Fix Wave, review adversarial) — con `mountMode="all"`,
 * `CampaignsTable`/`CampaignDetail` quedan MONTADOS incluso cuando el tab
 * activo es "Nueva campaña" — sin gating, seguían polleando cada 30s/5s en
 * segundo plano detrás de un tab que el operador ni está mirando. Se les
 * propaga `active={activeTab === 'history'}`: ambos combinan ese flag con
 * `useDocumentVisible` en el gate del poll (`useCampaigns`/`useCampaign`,
 * `src/hooks/useBulkMessaging.ts`) — el fetch inicial al montar sigue
 * ocurriendo igual, solo el POLLING se apaga mientras el tab no está activo.
 *
 * El tab inicial se deriva del `?campaign=<id>` de la URL: si al MONTAR ya
 * hay un id (reload/bookmark de un detalle, o llegada desde otra vista), el
 * tab activo arranca en "Historial" para mostrar el detalle — no en "Nueva
 * campaña" (default sin id). El flujo de creación cambia de tab explícito
 * vía `handleCampaignCreated`.
 */
export default function BulkMessagingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign');
  const [activeTab, setActiveTab] = useState<BulkMessagingTabId>(campaignId ? 'history' : 'new');
  // MEDIUM-2 (Fix Wave) — gate de poll compartido por CampaignsTable/CampaignDetail.
  const isHistoryActive = activeTab === 'history';

  function handleCampaignCreated(newCampaignId: string) {
    setSearchParams({ campaign: newCampaignId });
    setActiveTab('history');
  }

  function handleViewDetail(id: string) {
    setSearchParams({ campaign: id });
  }

  function handleBackToHistory() {
    setSearchParams({});
  }

  const tabs = [
    {
      id: 'new',
      label: 'Nueva campaña',
      content: <CampaignComposer onCampaignCreated={handleCampaignCreated} />,
    },
    {
      id: 'history',
      label: 'Historial',
      content: campaignId ? (
        // FIX-4 — key={campaignId}: al pasar de una campaña a otra por cambio de
        // ?campaign= (sin remount), RecipientsTable conservaba page/statusFilter
        // de la anterior (lección `inbox-key-por-conversacion`). El key fuerza el
        // reset del estado local del detalle al cambiar de campaña.
        <CampaignDetail
          key={campaignId}
          campaignId={campaignId}
          onBack={handleBackToHistory}
          active={isHistoryActive}
        />
      ) : (
        <CampaignsTable onViewDetail={handleViewDetail} active={isHistoryActive} />
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>WhatsApp /</span>
          <h1 className={styles.title}>Envío masivo</h1>
        </div>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as BulkMessagingTabId)}
      />
    </div>
  );
}
