import type { WhatsappInboxClientSummary, WhatsappInboxInvoice } from '@/types/whatsapp';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { formatDateShort } from '@/utils/formatDate';
import styles from '../ClientContextPanel.module.css';

interface FinancialSectionProps {
  client: WhatsappInboxClientSummary;
  isRefreshingBalance?: boolean;
}

const INVOICE_STATUS_BADGE: Record<WhatsappInboxInvoice['status'], 'active' | 'inactive' | 'late'> = {
  pagada: 'active',
  pendiente: 'inactive',
  vencida: 'late',
};

const INVOICE_STATUS_LABEL: Record<WhatsappInboxInvoice['status'], string> = {
  pagada: 'Pagada',
  pendiente: 'Pendiente',
  vencida: 'Vencida',
};

const ISO_4217_CODE = /^[A-Z]{3}$/;

/**
 * ARS money, consistente con `BillingTab.tsx` ("$ 1.234,56").
 *
 * Fix bug BAJO (review adversarial): `currency ?? 'ARS'` solo cubría
 * `null`/`undefined` — un `""` o un código no-ISO (mirror del BE desalineado)
 * llegaba crudo a `Intl.NumberFormat`, que tira `RangeError: Invalid currency
 * code` y rompe el render del HERO entero. Se valida el shape (3 letras
 * mayúsculas) antes de confiar en el valor; cualquier otra cosa cae a ARS.
 */
function formatMoney(amount: number, currency: string | null): string {
  const safeCurrency = currency && ISO_4217_CODE.test(currency) ? currency : 'ARS';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: safeCurrency }).format(amount);
}

/**
 * FinancialSection — HERO del panel (messaging-inbox-v2 F1.5, design §5.2):
 * lo primero que el agente busca. `--badge-late-fg` (NO `--color-danger`,
 * que da ~3.9:1 y falla 4.5:1) para el monto grande; verde `--badge-paid-*`
 * (NUEVO, F3) solo cuando `isDebtor===false && due!=null` — nunca se pinta
 * "al día" si el balance es desconocido (`due==null`).
 */
export function FinancialSection({ client, isRefreshingBalance }: FinancialSectionProps) {
  const { balance, lastInvoice, nextDueDate } = client;

  return (
    // Fix bug MEDIO a11y (review adversarial): 4 landmarks `region` anidados
    // en un panel de 320px era ruido para lectores de pantalla — solo el
    // panel RAÍZ (`ClientContextPanel`) es `<section>`; las sub-secciones
    // bajan a `<div>` conservando el `<h3>` (jerarquía visual/semántica sin
    // landmark propio).
    <div className={styles['fin-section']}>
      <h3 className={styles['fin-title']}>
        Financiero
      </h3>

      <div
        className={[styles['fin-hero'], isRefreshingBalance ? styles['fin-hero--refreshing'] : '']
          .filter(Boolean)
          .join(' ')}
      >
        {balance.due == null ? (
          <>
            <span className={styles['fin-unknown']}>—</span>
            <span className={styles['fin-unknownLabel']}>Saldo no disponible</span>
          </>
        ) : balance.isDebtor ? (
          <>
            <span className={styles['fin-badgeDebt']}>Debe</span>
            <span className={styles['fin-amountDebt']}>{formatMoney(balance.due, balance.currency)}</span>
          </>
        ) : (
          <>
            <span className={styles['fin-badgePaid']}>Al día</span>
            <span className={styles['fin-amountPaid']}>{formatMoney(balance.due, balance.currency)}</span>
          </>
        )}
      </div>

      <div className={styles['fin-meta']}>
        <span className={styles['fin-lastRefreshed']}>
          {balance.lastRefreshedAt ? `Actualizado ${formatDateShort(balance.lastRefreshedAt)}` : 'Sin actualizaciones'}
        </span>
        {isRefreshingBalance && <span className={styles['fin-refreshingPill']}>actualizando…</span>}
      </div>

      <div className={styles['fin-invoice']}>
        {lastInvoice ? (
          <>
            <span className={styles['fin-invoiceNumber']}>{lastInvoice.number}</span>
            <StatusBadge
              status={INVOICE_STATUS_BADGE[lastInvoice.status]}
              label={INVOICE_STATUS_LABEL[lastInvoice.status]}
            />
            <span className={styles['fin-invoiceAmount']}>{formatMoney(lastInvoice.amount, balance.currency)}</span>
          </>
        ) : (
          <span className={styles['fin-invoiceEmpty']}>Sin facturas registradas</span>
        )}
      </div>

      <div className={styles['fin-nextDue']}>
        <span className={styles['fin-nextDueLabel']}>Próximo vencimiento</span>
        <span className={styles['fin-nextDueValue']}>
          {nextDueDate ? formatDateShort(nextDueDate) : 'Sin vencimientos'}
        </span>
      </div>
    </div>
  );
}
