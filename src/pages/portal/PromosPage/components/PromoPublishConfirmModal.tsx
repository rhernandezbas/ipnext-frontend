import { useEffect } from 'react';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import { useAudiencePreview } from '@/hooks/usePromos';
import type { PromoAdminDto } from '@/types/promos';

interface PromoPublishConfirmModalProps {
  open: boolean;
  promo: PromoAdminDto | null;
  /** `useUpdatePromo().isPending` — deshabilita los botones mientras el PATCH está en vuelo. */
  publishing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function buildMessage(
  isPending: boolean,
  isError: boolean,
  data: { segmentCount: number; withAppCount: number } | undefined,
): string {
  if (isError) {
    return 'No se pudo calcular a cuántos clientes les llega esta promoción. Reintentá antes de publicar.';
  }
  if (isPending || !data) {
    return 'Calculando a cuántos clientes con la app les llega esta promoción…';
  }
  if (data.withAppCount === 0) {
    return `Segmento: ${data.segmentCount} cliente(s). Con la app instalada: 0 — nadie con la app entra en este segmento, no la va a ver ningún cliente. ¿Publicar igual?`;
  }
  return `Al publicar, esta promoción va a estar visible en la app para ${data.withAppCount} cliente${data.withAppCount === 1 ? '' : 's'} con la app instalada (de ${data.segmentCount} en el segmento). ¿Confirmás la publicación?`;
}

/**
 * PromoPublishConfirmModal (promos-admin) — "publicar es una acción
 * consecuente" (regla dura del proposal): antes de publicar, muestra el
 * IMPACTO explícito (a cuántos clientes les va a llegar de verdad, no sólo el
 * tamaño del segmento) — mismo patrón que `SendCampaignButton` (informar el
 * total ANTES del confirm, nunca a ciegas). Reusa `ConfirmModal` (shell de
 * a11y compartido) en vez de reimplementar el diálogo — al abrir, dispara
 * `audience-preview` fresco para el segmento de la promo (el preview del form
 * de edición pudo quedar desactualizado si el operador cerró el modal y
 * reabrió esta confirmación después) y mientras resuelve deja los botones
 * `busy` (mismo criterio que "Procesando…" del `ConfirmModal`).
 */
export function PromoPublishConfirmModal({ open, promo, publishing, onConfirm, onCancel }: PromoPublishConfirmModalProps) {
  const { preview, data, isPending, isError, reset } = useAudiencePreview();

  useEffect(() => {
    if (!open || !promo) {
      reset();
      return;
    }
    preview({
      statuses: promo.segment.statuses,
      balanceMin: promo.segment.balanceMin ?? undefined,
      balanceMax: promo.segment.balanceMax ?? undefined,
      networkSiteId: promo.segment.networkSiteId ?? undefined,
      accessPointId: promo.segment.accessPointId ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara solo al abrir/cambiar de promo, no en cada render
  }, [open, promo?.id]);

  return (
    <ConfirmModal
      open={open}
      title="Publicar promoción"
      message={buildMessage(isPending, isError, data)}
      confirmLabel="Publicar"
      busy={publishing || isPending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
