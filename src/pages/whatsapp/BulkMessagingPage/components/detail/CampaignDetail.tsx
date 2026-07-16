import { useState } from 'react';
import { useCampaign } from '@/hooks/useBulkMessaging';
import { CampaignHeader } from './CampaignHeader';
import { RecipientsTable } from './RecipientsTable';
import { SendCampaignButton } from './SendCampaignButton';
import styles from './CampaignDetail.module.css';

interface CampaignDetailProps {
  campaignId: string;
  onBack: () => void;
  /**
   * Fix Wave (MEDIUM-2, review adversarial) — true si el tab "Historial" de
   * `BulkMessagingPage` está ACTIVO. Gatea el poll del detalle (propagado a
   * `useCampaign` acá + `CampaignHeader`/`RecipientsTable`): con
   * `Tabs mountMode="all"` este componente queda montado detrás de "Nueva
   * campaña", y no tiene sentido pollear un detalle oculto. Default `true`
   * (standalone/tests que no lo pasan se comportan como siempre).
   */
  active?: boolean;
}

/**
 * CampaignDetail (F2 apply chunk 3, HIST-2/HIST-3/SEND-1) — se monta cuando
 * `BulkMessagingPage` tiene `?campaign=<id>` en la URL (persistido por el
 * composer al crear, chunk 2, o por un click en `CampaignsTable`, HIST-1).
 * Compone `CampaignHeader` (contadores en vivo) + `SendCampaignButton`
 * (solo `pending`) + `RecipientsTable` (HIST-3).
 *
 * Llama a `useCampaign(campaignId, {}, active)` (SIN `includeRecipients`)
 * acá TAMBIÉN — la MISMA query key que usa `CampaignHeader` internamente
 * (`['messagingBulk','campaign',id,{}]`) — solo para leer `status`/`total`
 * y decidir si monta `SendCampaignButton`. React Query dedupea por
 * queryKey: NO es un fetch de red extra (un solo request por polling
 * tick), y evita levantar ese estado a un padre común o hacer que
 * `CampaignHeader` deje de ser dueño exclusivo de SU propio render.
 */
export function CampaignDetail({ campaignId, onBack, active = true }: CampaignDetailProps) {
  const { data } = useCampaign(campaignId, {}, active);
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

      <CampaignHeader campaignId={campaignId} active={active} />

      {/* Scope adicional (root cause confirmado con el usuario 2026-07-16): el
          "bug" del POST /send que nunca salía era UX, no código — el operador
          creaba la campaña (el modal de creación YA muestra el resumen de
          impacto y se SIENTE como una confirmación de envío), aterrizaba acá
          con status "pending" y creía que ya estaba enviada. Nunca clickeaba
          "Enviar campaña". Este banner deja el estado y el próximo paso
          explícitos — ícono SVG aria-hidden (nunca solo-color), role="status"
          para que un lector de pantalla lo anuncie sin ser un alert. */}
      {campaign?.status === 'pending' && (
        <div className={styles.pendingBanner} role="status">
          <svg className={styles.pendingIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.25" />
            <path d="M8 4.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className={styles.pendingText}>
            Esta campaña todavía <strong>no se envió</strong>. Cuando estés listo, apretá «Enviar campaña».
          </p>
        </div>
      )}

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

      <RecipientsTable campaignId={campaignId} active={active} />
    </div>
  );
}
