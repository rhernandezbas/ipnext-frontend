import { useEffect, useRef, useState } from 'react';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import { useSendCampaign } from '@/hooks/useBulkMessaging';
import type { CampaignStatusDto } from '@/types/messagingBulk';
import styles from './SendCampaignButton.module.css';

interface SendCampaignButtonProps {
  campaignId: string;
  status: CampaignStatusDto;
  total: number;
  /** Se llama tras un envío aceptado (202) — el caller decide qué hacer además del toast local. */
  onSent?: () => void;
}

type ConfirmStep = 'idle' | 'first' | 'second';
const TOAST_DURATION_MS = 4000;

/**
 * SendCampaignButton (F2 apply chunk 3, SEND-1) — visible SOLO si
 * `status === 'pending'` (guard interno, además de que `CampaignDetail` ya
 * lo monta condicionalmente). Doble-confirm (decisión LOCKED): 2
 * `ConfirmModal` secuenciales — el 1ro informa el total, el 2do (tone
 * danger) tiene la advertencia MÁS fuerte ("irreversible" + costo) — evita
 * que un click accidental dispare un envío real.
 *
 * 409 CAMPAIGN_SEND_IN_PROGRESS (lock GLOBAL — puede ser OTRA campaña
 * enviándose, FIX-15) se muestra con wording explícito de "otra campaña",
 * NUNCA "tu campaña" — el lock es del sistema entero, no de esta campaña.
 * Otros errores (red/500) caen silenciosos, mismo criterio ya establecido
 * en `CampaignComposer` para errores sin superficie propia — el botón
 * queda disponible para reintentar.
 */
export function SendCampaignButton({ campaignId, status, total, onSent }: SendCampaignButtonProps) {
  const [step, setStep] = useState<ConfirmStep>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { send, isPending, isError, conflict, reset } = useSendCampaign();

  // FIX-8b — limpiar el timer del toast al desmontar (el botón se desmonta
  // apenas la campaña pasa a `running`), sin fugas.
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  if (status !== 'pending') return null;

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  function openConfirm() {
    reset();
    setStep('first');
  }

  function cancel() {
    setStep('idle');
  }

  function confirmFirst() {
    setStep('second');
  }

  function confirmSecond() {
    send(campaignId, {
      onSuccess: () => {
        setStep('idle');
        showToast('Campaña enviada — el envío está en curso.');
        onSent?.();
      },
      onError: () => {
        setStep('idle');
      },
    });
  }

  const totalLabel = `${total} destinatario${total === 1 ? '' : 's'}`;

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.sendButton} onClick={openConfirm}>
        Enviar campaña
      </button>

      {conflict && (
        <p className={styles.conflict} role="alert">
          Ya hay una campaña enviándose — es una a la vez en todo el sistema. Reintentá cuando termine.
        </p>
      )}

      {isError && !conflict && (
        <p className={styles.sendError} role="alert">
          No se pudo enviar la campaña. Revisá tu conexión y reintentá en unos segundos.
        </p>
      )}

      {toast && (
        <p className={styles.toast} role="alert" aria-live="assertive">
          {toast}
        </p>
      )}

      <ConfirmModal
        open={step === 'first'}
        title="Enviar campaña"
        message={`Vas a enviar esta campaña a ${totalLabel}. Revisá el segmento y el template antes de continuar.`}
        confirmLabel="Continuar"
        onConfirm={confirmFirst}
        onCancel={cancel}
      />

      <ConfirmModal
        open={step === 'second'}
        title="Confirmación final"
        message={`Vas a enviar a ${totalLabel}. Es IRREVERSIBLE y tiene costo. ¿Confirmás el envío?`}
        confirmLabel="Sí, enviar ahora"
        tone="danger"
        busy={isPending}
        onConfirm={confirmSecond}
        onCancel={cancel}
      />
    </div>
  );
}
