import { useState } from 'react';
import { useCampaign } from '@/hooks/useBulkMessaging';
import { CampaignHeader } from './CampaignHeader';
import { RecipientsTable } from './RecipientsTable';
import { SendCampaignButton } from './SendCampaignButton';
import styles from './CampaignDetail.module.css';

interface CampaignDetailProps {
  campaignId: string;
  onBack: () => void;
}

/**
 * CampaignDetail (F2 apply chunk 3, HIST-2/HIST-3/SEND-1) — se monta cuando
 * `BulkMessagingPage` tiene `?campaign=<id>` en la URL (persistido por el
 * composer al crear, chunk 2, o por un click en `CampaignsTable`, HIST-1).
 * Compone `CampaignHeader` (contadores en vivo) + `SendCampaignButton`
 * (solo `pending`) + `RecipientsTable` (HIST-3).
 *
 * Llama a `useCampaign(campaignId)` (SIN `includeRecipients`) acá TAMBIÉN
 * — la MISMA query key que usa `CampaignHeader` internamente
 * (`['messagingBulk','campaign',id,{}]`) — solo para leer `status`/`total`
 * y decidir si monta `SendCampaignButton`. React Query dedupea por
 * queryKey: NO es un fetch de red extra (un solo request por polling
 * tick), y evita levantar ese estado a un padre común o hacer que
 * `CampaignHeader` deje de ser dueño exclusivo de SU propio render.
 */
export function CampaignDetail({ campaignId, onBack }: CampaignDetailProps) {
  const { data } = useCampaign(campaignId);
  const campaign = data?.campaign;

  // FIX-3c / FIX-5 — el feedback de "envío iniciado" vive ACÁ (no en
  // SendCampaignButton): apenas se envía, la campaña pasa a `running` y el botón
  // se desmonta, llevándose su toast local. Este banner sobrevive porque
  // `CampaignDetail` NO se desmonta con el cambio de estado. Se resetea al
  // cambiar de campaña por el `key={campaignId}` del padre (FIX-4).
  const [justSent, setJustSent] = useState(false);

  return (
    <div className={styles.detail}>
      <button type="button" className={styles.back} onClick={onBack}>
        ← Volver al historial
      </button>

      <CampaignHeader campaignId={campaignId} />

      {justSent && (
        <p className={styles.sentBanner} role="status" aria-live="polite">
          El envío de la campaña se inició correctamente. Seguí el progreso más abajo.
        </p>
      )}

      {campaign && (
        <SendCampaignButton
          campaignId={campaignId}
          status={campaign.status}
          total={campaign.total}
          onSent={() => setJustSent(true)}
        />
      )}

      <RecipientsTable campaignId={campaignId} />
    </div>
  );
}
