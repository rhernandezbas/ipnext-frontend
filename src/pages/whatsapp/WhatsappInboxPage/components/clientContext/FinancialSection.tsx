import type { WhatsappInboxClientSummary, WhatsappInboxInvoice } from '@/types/whatsapp';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { formatDateShort } from '@/utils/formatDate';
import { formatMoney } from '@/utils/formatMoney';
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

// `formatMoney` vive en `@/utils/formatMoney` (extraído de acá): el
// `TemplateSendPanel` (FUENTES) necesita resolver "Monto de deuda" con el
// MISMO formateo que este HERO muestra — una sola fuente de verdad.

/**
 * FinancialSection — HERO del panel (messaging-inbox-v2 F1.5, design §5.2):
 * lo primero que el agente busca. `--badge-late-fg` (NO `--color-danger`,
 * que da ~3.9:1 y falla 4.5:1) para el monto grande; verde `--badge-paid-*`
 * (NUEVO, F3) solo cuando `isDebtor===false && due!=null` — nunca se pinta
 * "al día" si el balance es desconocido (`due==null`).
 *
 * FX1 (combo-balance-honesto fix wave, INBOX-1 de la CLASE): el bloque
 * `balance` está declarado requerido en el tipo, pero el BE puede mandar el
 * `client` sin él (payload parcial / deploy escalonado) — es el MISMO fixture
 * que motivó el `?.` de `useWhatsapp.ts:880`. Aquel fix salvó al cuerpo del
 * hook y dejó a este consumidor tirando `Cannot read properties of undefined
 * (reading 'due')`, o sea el panel entero caído igual. Todas las lecturas del
 * bloque encadenan opcional y caen al estado honesto "Saldo no disponible":
 * el resto de la sección (última factura, próximo vencimiento) sigue siendo
 * información útil para el agente y no tiene por qué morir con el saldo.
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
        {balance?.due == null ? (
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
        {/* FIX [MEDIUM] (mini fix wave, el hermano de FX4 en InfoTab/BalanceCard):
            la marca de frescura afirma un dato fresco ("Actualizado {fecha}") o
            su ausencia ("Sin actualizaciones") — ambas lecturas presuponen que
            HAY un saldo. Con `due==null` ("Saldo no disponible") no hay nada
            que pueda estar fresco o viejo; se omite entera, mismo criterio que
            `relative` en `InfoTab.tsx` (BalanceCard, FX4). */}
        {balance?.due != null && (
          <span className={styles['fin-lastRefreshed']}>
            {balance.lastRefreshedAt ? `Actualizado ${formatDateShort(balance.lastRefreshedAt)}` : 'Sin actualizaciones'}
          </span>
        )}
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
            <span className={styles['fin-invoiceAmount']}>{formatMoney(lastInvoice.amount, balance?.currency ?? null)}</span>
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
