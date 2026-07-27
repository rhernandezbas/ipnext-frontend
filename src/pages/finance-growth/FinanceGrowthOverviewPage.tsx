import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceOverview, useFinanceSyncStatus, useRunFinanceSync } from '@/hooks/useFinanceGrowth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { Can } from '@/components/auth/Can';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import { MaybeValue } from '@/components/atoms/MaybeValue/MaybeValue';
import { formatMoney } from '@/utils/formatMoney';
import { getDefaultYearMonthRange, formatYearMonthLabel } from '@/utils/financeGrowthDates';
import type { FinanceOverviewMonth } from '@/types/financeGrowth';
import styles from './FinanceGrowthOverviewPage.module.css';

const pct = (v: number) => `${v.toFixed(1)}%`;
const money = (v: number) => formatMoney(v, 'ARS');

type MoneyBasis = 'nominal' | 'real';

/**
 * Distingue el `503 SCHEDULER_NOT_RUNNING` (kill-switch operativo apagado,
 * ver design.md `POST /sync/run`) de cualquier otro error transitorio de
 * `POST /sync/run`. Antes de esta distinción (bloqueante 🔴3), CUALQUIER
 * error mostraba "Reintentá en unos segundos" — un consejo FALSO cuando la
 * causa es el kill-switch: reintentar nunca va a funcionar hasta que un
 * admin lo reactive. Mismo criterio que `mapResyncError` en
 * `GestionRealSyncBody.tsx`.
 */
function mapRunSyncError(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { code?: string } } };
  if (e?.response?.status === 503 && e?.response?.data?.code === 'SCHEDULER_NOT_RUNNING') {
    return 'La ingesta de cobranza está apagada (kill-switch) — reintentar no va a funcionar hasta que un administrador la reactive.';
  }
  return 'No se pudo disparar la sincronización. Reintentá en unos segundos.';
}

function OverviewSkeleton() {
  return (
    <div className={styles.skeletonGrid} role="status" aria-label="Cargando resumen financiero">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.skeletonTile} aria-hidden="true" />
      ))}
    </div>
  );
}

function SyncControls() {
  const { can } = useMyPermissions();
  const { data: status } = useFinanceSyncStatus({ pollingMs: 15_000 });
  const runSync = useRunFinanceSync();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!can('finance.sync')) return null;

  const running = status?.delta.pendingPages ?? false;
  const degraded = status?.pacing.degraded ?? false;
  // Bloqueante 🔴3 — `pacing.enabled === false` (kill-switch apagado) es un
  // estado DISTINTO de `degraded`: degraded mide backoff por fallas hacia
  // GR, enabled mide si el operador apagó la ingesta a propósito. Antes de
  // este campo (regresión de fix-wave-2 R3), el panel sólo miraba `degraded`
  // y pintaba "Sincronización al día" en VERDE con la ingesta apagada.
  const pacingEnabled = status?.pacing.enabled ?? true;

  return (
    <div className={styles.syncBox}>
      {status && (
        <span className={styles.syncStatus} aria-live="polite">
          {!pacingEnabled && <span className={styles.syncDisabled}>● Ingesta apagada</span>}
          {pacingEnabled && degraded && <span className={styles.syncDegraded}>● Ritmo degradado</span>}
          {pacingEnabled && !degraded && <span className={styles.syncOk}>● Sincronización al día</span>}
          {status.delta.coveredThroughDate && (
            <span className={styles.syncMeta}> — cobranza cubierta hasta {status.delta.coveredThroughDate}</span>
          )}
        </span>
      )}
      <button
        type="button"
        className={styles.syncBtn}
        disabled={running || !pacingEnabled}
        title={
          !pacingEnabled
            ? 'La ingesta de cobranza está apagada (kill-switch) — no se puede sincronizar hasta que un administrador la reactive'
            : running
              ? 'Ya hay una sincronización en curso'
              : 'Fuerza al carril de cobranza reciente a correr ahora'
        }
        onClick={() => setConfirmOpen(true)}
      >
        {running ? 'Sincronizando…' : 'Sincronizar ahora'}
      </button>
      {runSync.isSuccess && <p className={styles.feedbackSuccess} role="status">Sincronización disparada. Los números se actualizan en unos minutos.</p>}
      {runSync.isError && <p className={styles.feedbackError} role="alert">{mapRunSyncError(runSync.error)}</p>}
      <ConfirmModal
        open={confirmOpen}
        title="Sincronizar cobranza ahora"
        message="Esto fuerza al carril de cobranza RECIENTE (hoy) a correr en el próximo turno disponible, salteando la espera automática de unos minutos. NO acelera el backfill histórico, que sigue su propio ritmo. Es una operación de bajo riesgo pero consume presupuesto de requests contra Gestión Real."
        confirmLabel="Sí, sincronizar"
        tone="default"
        busy={runSync.isPending}
        onConfirm={() => {
          runSync.mutate();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function BridgeRow({ label, value, tone }: { label: string; value: number; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className={styles.bridgeRow}>
      <span className={styles.bridgeLabel}>{label}</span>
      <span className={[styles.bridgeValue, tone ? styles[`bridge_${tone}`] : ''].join(' ')}>
        {money(value)}
      </span>
    </div>
  );
}

export default function FinanceGrowthOverviewPage() {
  const range = useMemo(() => getDefaultYearMonthRange(6), []);
  const [basis, setBasis] = useState<MoneyBasis>('nominal');
  const overview = useFinanceOverview(range);

  const lastMonth: FinanceOverviewMonth | undefined = overview.data?.months.at(-1);
  const missingReal = overview.data?.realSeriesMissingMonths ?? [];
  // Bloqueante 🔴1 — con el 100% de los contratos activos sin precio
  // resoluble, el MRR contratado (y todo lo que se deriva de él, como el
  // churn de ingresos) NO es "cero medido" — es DESCONOCIDO. `mrrFinalArs`
  // llega en 0 por construcción (Decision 1b: un contrato sin precio
  // contribuye 0 al MRR, nunca silenciosamente) pero mostrarlo como "$0,00"
  // sin este contexto es indistinguible de "la base realmente vale cero".
  const allUnpriced = lastMonth?.unpricedContractsPct === 100;
  // Fase 1 del ingest de recibos está en modo DARK (backfill en curso) ⇒
  // `revenueTotalArs === 0` significa "todavía no se ingirió cobranza para
  // este mes", NUNCA "nadie pagó". ARPU y el bridge de MRR no dependen de
  // cash, pero ARPU (Capa B, atribución) y la lectura intuitiva de "Churn
  // ingresos" sí — de ahí el banner dedicado más abajo.
  const noRevenueIngested = lastMonth?.revenueTotalArs === 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className={styles.breadcrumb}>Crecimiento Financiero /</span>
          <h1 className={styles.title}>Resumen</h1>
        </div>
        <SyncControls />
      </div>

      {overview.isLoading && <OverviewSkeleton />}

      {overview.isError && (
        <div className={styles.errorState} role="alert">
          <p>No se pudo cargar el resumen financiero.</p>
          <button type="button" className={styles.retryBtn} onClick={() => overview.refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {overview.data && (
        <>
          <p className={styles.disclaimer}>
            Basado en <strong>cobranza real</strong> (plata efectivamente cobrada) — esto NO es facturación
            emitida. El desfasaje de pago entre meses es esperable y no se corrige.
          </p>

          {overview.data.monthsWithoutSnapshot.length > 0 && (
            <div className={styles.warningBanner} role="status">
              <strong>Todavía no se calculó</strong> el snapshot mensual de:{' '}
              {overview.data.monthsWithoutSnapshot.map(formatYearMonthLabel).join(', ')}. No son meses en cero —
              son meses sin computar todavía (el job nocturno o el backfill histórico no llegaron ahí).
            </div>
          )}

          {overview.data.months.length === 0 ? (
            <div className={styles.emptyState}>
              <p>
                Todavía no se calculó ningún mes para el rango {formatYearMonthLabel(range.from)} –{' '}
                {formatYearMonthLabel(range.to)}. Esto es esperable hoy: el motor de métricas corre de noche y el
                backfill histórico de precios/planes está pendiente.
              </p>
              <Can permission="finance.manage_costs">
                <Link to="/admin/finance-growth/settings#plan-prices" className={styles.emptyCta}>
                  Cargar precios de plan
                </Link>
              </Can>
            </div>
          ) : (
            lastMonth && (
              <>
                <div className={styles.toggleRow} role="group" aria-label="Serie nominal o ajustada por inflación">
                  <button
                    type="button"
                    className={styles.toggleBtn}
                    aria-pressed={basis === 'nominal'}
                    onClick={() => setBasis('nominal')}
                  >
                    Nominal
                  </button>
                  <button
                    type="button"
                    className={styles.toggleBtn}
                    aria-pressed={basis === 'real'}
                    onClick={() => setBasis('real')}
                  >
                    Real (ajustada por inflación)
                  </button>
                </div>

                {basis === 'real' && missingReal.length > 0 && (
                  <p className={styles.warningBanner} role="status">
                    La serie real no pudo calcularse para: {missingReal.map(formatYearMonthLabel).join(', ')}{' '}
                    (falta el IPC de esos meses en Configuración). Esos meses se muestran como <strong>—</strong>,
                    nunca como el valor nominal disfrazado de real.
                  </p>
                )}

                {/* Bloqueante 🔴1(b) — estos dos banners van ARRIBA de los KPIs
                    a propósito: antes estaban debajo (línea original 228) y el
                    usuario leía "$0,00" en el MRR ANTES de enterarse de que el
                    100% de los contratos no tiene precio cargado. */}
                {lastMonth.unpricedContractsActive > 0 && (
                  <div className={styles.warningBanner} role="status">
                    <strong>Faltan precios:</strong> {lastMonth.unpricedContractsActive} contratos activos (
                    {pct(lastMonth.unpricedContractsPct)}) no tienen un precio de plan resoluble — su MRR cuenta
                    como $0 en el bridge, eso NO significa que no crecieron.
                    {allUnpriced && (
                      <>
                        {' '}
                        Con el <strong>100%</strong> de los contratos sin precio, el MRR contratado de abajo no es
                        cero medido — es <strong>desconocido</strong>.
                      </>
                    )}{' '}
                    <Can permission="finance.manage_costs">
                      <Link to="/admin/finance-growth/settings#plan-prices">Cargar precios de plan</Link>
                    </Can>
                  </div>
                )}

                {noRevenueIngested && (
                  <div className={styles.warningBanner} role="status">
                    <strong>Cobranza no ingerida todavía:</strong> el ingest de recibos (Fase 1) todavía no cargó
                    cobranza real para {formatYearMonthLabel(lastMonth.yearMonth)} ({money(lastMonth.revenueTotalArs)}
                    ). El <strong>ARPU</strong> y el <strong>Churn de ingresos</strong> de abajo pueden mostrar $0 sin
                    que signifique "nadie paga" — significa que el backfill histórico todavía no llegó a este mes.
                  </div>
                )}

                <div className={styles.kpiRow}>
                  <div className={styles.kpiTile}>
                    <span className={styles.kpiLabel}>Contratos activos</span>
                    <span className={styles.kpiValue}>{lastMonth.contractsActive}</span>
                  </div>
                  <div className={styles.kpiTile}>
                    <span className={styles.kpiLabel}>MRR contratado ({basis === 'nominal' ? 'nominal' : 'real'})</span>
                    <span className={styles.kpiValue}>
                      <MaybeValue
                        value={allUnpriced ? null : basis === 'nominal' ? lastMonth.mrrFinalArs : lastMonth.mrrFinalRealArs}
                        format={money}
                        label={basis === 'nominal' ? 'MRR contratado' : 'MRR real'}
                        unknownReason={
                          allUnpriced
                            ? 'el 100% de los contratos activos no tiene un precio de plan resoluble — el MRR no es cero, es desconocido'
                            : 'falta el IPC de este mes'
                        }
                      />
                    </span>
                  </div>
                  <div className={styles.kpiTile}>
                    <span className={styles.kpiLabel}>ARPU (internet)</span>
                    <span className={styles.kpiValue}>{money(lastMonth.arpuArs)}</span>
                  </div>
                  <div className={styles.kpiTile}>
                    <span className={styles.kpiLabel}>Churn contratos</span>
                    <span className={styles.kpiValue}>{pct(lastMonth.churnContractsPct)}</span>
                  </div>
                  <div className={styles.kpiTile}>
                    <span className={styles.kpiLabel}>Churn ingresos</span>
                    <span className={styles.kpiValue}>
                      <MaybeValue
                        value={allUnpriced ? null : lastMonth.churnRevenuePct}
                        format={pct}
                        label="Churn de ingresos"
                        unknownReason={
                          allUnpriced
                            ? 'el 100% de los contratos activos no tiene un precio de plan resoluble — el churn de ingresos no es medible, no es comparable con el churn de contratos'
                            : 'no había contratos activos al inicio del mes para comparar'
                        }
                      />
                    </span>
                  </div>
                  <div className={styles.kpiTile}>
                    <span className={styles.kpiLabel}>Tasa de cobranza</span>
                    <span className={styles.kpiValue}>
                      <MaybeValue
                        value={lastMonth.collectionRatePct}
                        format={pct}
                        label="Tasa de cobranza"
                        unknownReason="no hay MRR contratado del mes para comparar"
                      />
                    </span>
                  </div>
                  <div className={styles.kpiTile}>
                    <span className={styles.kpiLabel}>Cobranza real (cash collected)</span>
                    <span className={styles.kpiValue}>{money(lastMonth.revenueTotalArs)}</span>
                  </div>
                </div>

                {lastMonth.bridgeResidualArs !== 0 && (
                  <div className={styles.errorBanner} role="alert">
                    El bridge de MRR de {formatYearMonthLabel(lastMonth.yearMonth)} no cierra: queda un residuo de{' '}
                    {money(lastMonth.bridgeResidualArs)} sin explicar (eventos con precio irresoluble en algún
                    extremo). Los números de abajo siguen siendo reales, pero no suman entre sí exactamente.
                  </div>
                )}

                <section className={styles.bridgeCard} aria-label="Bridge de MRR contratado del mes">
                  <h2 className={styles.sectionTitle}>Bridge de MRR — {formatYearMonthLabel(lastMonth.yearMonth)}</h2>
                  <BridgeRow label="MRR inicial" value={lastMonth.mrrInicialArs} tone="neutral" />
                  <BridgeRow label="+ Altas" value={lastMonth.mrrNewArs} tone="up" />
                  <BridgeRow label="+ Upgrades" value={lastMonth.mrrUpgradeArs} tone="up" />
                  <BridgeRow label="− Downgrades" value={-lastMonth.mrrDowngradeArs} tone="down" />
                  <BridgeRow label="− Bajas" value={-lastMonth.mrrChurnArs} tone="down" />
                  <BridgeRow label="= MRR final" value={lastMonth.mrrFinalArs} tone="neutral" />
                  {lastMonth.enforcementPlanChangeEventsExcluded > 0 && (
                    <p className={styles.bridgeNote}>
                      {lastMonth.enforcementPlanChangeEventsExcluded} evento(s) de corte por mora excluidos del
                      bridge (nunca se cuentan como cambio comercial real).
                    </p>
                  )}
                </section>

                <p className={styles.unclassifiedNote}>
                  Cobranza sin clasificar este mes: {money(lastMonth.unclassifiedAmountArs)} —{' '}
                  <Can permission="finance.manage_costs">
                    <Link to="/admin/finance-growth/settings#invoice-types">revisar tipos de comprobante</Link>
                  </Can>
                </p>
              </>
            )
          )}
        </>
      )}
    </div>
  );
}
