import { usePendingReturns, useConfirmReturn, useDiscardReturn } from '@/hooks/useReturns';
import type { ReturnSuggestion } from '@/types/returns';
import styles from './InventoryReturnsPendingPage.module.css';

/**
 * "Devoluciones pendientes" (EPIC #38, Wave 4). The depot/ops review surface for
 * equipment returns staged automatically when a RETIRO service order closes.
 *
 * Staging never touches stock. Each row is an operator decision:
 *  - `pending`      → the serial matched an installed asset → one click to return
 *    it to the depot (resolution 'return').
 *  - `needs_review` → no installed asset matched → the operator creates it at the
 *    depot, links it to an existing asset, or discards the noise.
 *
 * On confirm/discard the row leaves the list (the hooks invalidate the query).
 * In production there are 0 pending returns initially, so the empty state is the
 * primary UX: it explains where these rows come from.
 */
export default function InventoryReturnsPendingPage() {
  const { data, isLoading, isError } = usePendingReturns();
  const confirm = useConfirmReturn();
  const discard = useDiscardReturn();

  const rows = data ?? [];
  const busy = confirm.isPending || discard.isPending;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.breadcrumb}>Inventario</p>
        <h1 className={styles.title}>Devoluciones pendientes</h1>
        <p className={styles.subtitle}>
          Equipos detectados al cerrar un retiro, a la espera de tu confirmación para volver al
          depósito.
        </p>
      </header>

      {isError && (
        <p className={styles.errorBanner} role="alert">
          No pudimos cargar las devoluciones pendientes. Reintentá en unos segundos.
        </p>
      )}

      <section className={styles.section} aria-labelledby="returns-heading">
        <div className={styles.sectionHead}>
          <h2 id="returns-heading" className={styles.sectionTitle}>
            En revisión
          </h2>
          {rows.length > 0 && <span className={styles.count}>{rows.length}</span>}
        </div>

        {isLoading ? (
          <p className={styles.loading}>Cargando devoluciones…</p>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className={styles.list}>
            {rows.map(row => (
              <ReturnRow
                key={row.id}
                suggestion={row}
                busy={busy}
                onConfirm={(resolution) => confirm.mutate({ id: row.id, input: { resolution } })}
                onDiscard={() => discard.mutate(row.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReturnRow({
  suggestion,
  busy,
  onConfirm,
  onDiscard,
}: {
  suggestion: ReturnSuggestion;
  busy: boolean;
  onConfirm: (resolution: 'return' | 'create' | 'link') => void;
  onDiscard: () => void;
}) {
  const matched = suggestion.status === 'pending' && suggestion.matchedAssetId !== null;

  return (
    <li className={styles.row} aria-label={suggestion.serialNumber ?? undefined}>
      <div className={styles.rowMain}>
        <span className={styles.serial}>{suggestion.serialNumber}</span>
        <span className={styles.meta}>
          {suggestion.deviceType ?? 'Tipo sin identificar'}
          {suggestion.mac && <span className={styles.mac}> · {suggestion.mac}</span>}
        </span>
      </div>

      <div className={styles.rowSide}>
        {matched ? (
          <>
            <span className={styles.matchPill}>Match encontrado</span>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy}
              onClick={() => onConfirm('return')}
            >
              Confirmar devolución
            </button>
          </>
        ) : (
          <>
            <span className={styles.reviewPill}>Sin match — revisar</span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busy}
                onClick={() => onConfirm('create')}
              >
                Crear en depósito
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busy}
                onClick={() => onConfirm('link')}
              >
                Vincular a equipo
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={busy}
                onClick={onDiscard}
              >
                Descartar
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <ReturnIcon />
      </span>
      <p className={styles.emptyTitle}>No hay devoluciones pendientes</p>
      <p className={styles.emptyBody}>
        Cuando se cierra un retiro en una tarea, los equipos detectados aparecen acá para que
        confirmes su vuelta al depósito. Por ahora no quedó ninguno en revisión.
      </p>
    </div>
  );
}

function ReturnIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="28"
      height="28"
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 5 5v1a5 5 0 0 1-5 5H8" />
    </svg>
  );
}
