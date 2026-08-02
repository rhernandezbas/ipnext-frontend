import type { StoreProductStatus } from '@/types/store';
import { PRODUCT_STATUS_LABELS } from '@/utils/productStatus';
import styles from './ProductStatusBadge.module.css';

interface ProductStatusBadgeProps {
  status: StoreProductStatus;
}

/**
 * ProductStatusBadge (store-admin) — pill LOCAL para `StoreProductStatus`,
 * mismo criterio que `PromoStatusBadge`: el TEXTO del estado SIEMPRE se
 * muestra, nunca es solo color (WCAG 1.4.1, regla dura del proposal).
 */
export function ProductStatusBadge({ status }: ProductStatusBadgeProps) {
  return <span className={[styles.pill, styles[status]].join(' ')}>{PRODUCT_STATUS_LABELS[status]}</span>;
}
