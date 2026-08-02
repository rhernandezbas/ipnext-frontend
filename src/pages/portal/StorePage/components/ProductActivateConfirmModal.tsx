import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import { formatMoney } from '@/utils/formatMoney';
import { toDecimalNumber } from '@/utils/decimal';
import type { StoreProductDto } from '@/types/store';

interface ProductActivateConfirmModalProps {
  open: boolean;
  product: StoreProductDto | null;
  activating: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function buildMessage(product: StoreProductDto | null): string {
  if (!product) return '';
  const price = formatMoney(toDecimalNumber(product.priceArs), 'ARS');
  const installmentsLabel = product.maxInstallments === 1 ? 'cuota' : 'cuotas';
  return `Al activar, los clientes con la app van a ver "${product.title}" a ${price} en hasta ${product.maxInstallments} ${installmentsLabel}. ¿Confirmás la publicación?`;
}

/**
 * ProductActivateConfirmModal (store-admin) — "activar es una acción
 * consciente" (regla dura del proposal, mismo criterio que
 * `PromoPublishConfirmModal`): antes de activar un producto, muestra el
 * resumen EXACTO de lo que va a ver el cliente en la tienda de la app
 * (título, precio, cuotas) — nunca a ciegas. Desactivar/archivar NO llevan
 * esta confirmación (mismo criterio que promos: solo "publicar" pide
 * confirmación explícita, archivar/desarchivar son reversibles y de bajo
 * riesgo).
 */
export function ProductActivateConfirmModal({
  open,
  product,
  activating,
  onConfirm,
  onCancel,
}: ProductActivateConfirmModalProps) {
  return (
    <ConfirmModal
      open={open}
      title="Activar producto"
      message={buildMessage(product)}
      confirmLabel="Activar"
      busy={activating}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
