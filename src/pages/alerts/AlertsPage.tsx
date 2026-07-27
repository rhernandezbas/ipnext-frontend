import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Can } from '@/components/auth/Can';
import { Select } from '@/components/molecules/Select/Select';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import { formatDateTimeShort, formatRelative } from '@/utils/formatDate';
import { useAcknowledgeNocAlert, useNocAlertsList, useNocAlertsStream } from '@/hooks/useNocAlerts';
import { EMPTY_NOC_ALERT_FILTERS } from '@/types/nocAlert';
import type { NocAlertDto, NocAlertFilterState, NocAlertSeverity, NocAlertStatus } from '@/types/nocAlert';
import styles from './AlertsPage.module.css';

/**
 * AlertsPage (Fase C FE, change `noc-alerts-hub`) — panel de alertas NOC.
 * spec.md `noc-alert-realtime`, Requirement "Alerts panel with filters and ACK".
 *
 * Tiempo real: `useNocAlertsStream` mantiene un `EventSource` a
 * `/api/alerts/stream` y parchea la ÚNICA cache entry (`nocAlertsKey`)
 * directamente — este componente solo lee `useNocAlertsList` (que devuelve
 * esa misma cache) y filtra client-side. Fallback: si el stream cae de forma
 * persistente (`mode === 'polling'`), `useNocAlertsList` empieza a pollear
 * cada 15s gateado por pestaña visible (`useDocumentVisible`, dentro del hook).
 *
 * gates: la PAGE completa está detrás de `RequirePermission
 * permission="monitoring.read"` en App.tsx (no acá) — este componente solo
 * gatea la acción de ACK con `<Can permission="monitoring.acknowledge_alert">`
 * (claves verificadas contra `alerts.routes.ts`: `requirePerm('monitoring',
 * 'read'|'acknowledge_alert')`).
 */

const KNOWN_SOURCES = [
  { value: '', label: 'Todas las fuentes' },
  { value: 'grafana', label: 'Grafana' },
  { value: 'fiber-collector', label: 'fiber-collector' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'Todas las severidades' },
  { value: 'critical', label: 'Crítica' },
  { value: 'warning', label: 'Advertencia' },
  { value: 'info', label: 'Info' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'firing', label: 'Activa' },
  { value: 'resolved', label: 'Resuelta' },
];

const SEVERITY_LABEL: Record<NocAlertSeverity, string> = {
  critical: 'Crítica',
  warning: 'Advertencia',
  info: 'Info',
};

const STATUS_LABEL: Record<NocAlertStatus, string> = {
  firing: 'Activa',
  resolved: 'Resuelta',
};

/** Cuánto dura la animación de entrada de una fila nueva (Emil Kowalski —
 *  150-300ms para UI, nunca más largo). Debe coincidir con la duración del
 *  keyframe `alertRowEnter` en AlertsPage.module.css. */
const ROW_ENTER_MS = 280;
/** Cuánto se muestra el feedback de éxito/error del ACK antes de auto-cerrarse. */
const FEEDBACK_TIMEOUT_MS = 4_000;

/**
 * Resumen indicativo por severidad/tipo (change `noc-alerts-dashboard`).
 * Problema real medido en prod: ~400 alertas activas, 79% info (228 son
 * "ONU recovered"), y apenas 16 críticas ENTERRADAS en el ruido. El resumen
 * existe para que un operario vea en 2 segundos qué está roto, sin scrollear
 * 400 tarjetas.
 *
 * Los contadores del resumen son SIEMPRE los mismos números — count
 * NUNCA se anima en cada tick del SSE (Emil Kowalski: nunca animar algo de
 * alta frecuencia). Se actualiza el texto/número directamente y listo, sin
 * transición visual.
 *
 * A4 (review adversarial): NO llevan `aria-live`/`aria-atomic` — con
 * `aria-atomic` sobre un span que contiene SOLO el número, el lector
 * anunciaba "16" sin contexto, y lo repetía en CADA tick del SSE, ×3 tiles
 * (era el equivalente auditivo de animar algo de alta frecuencia — la misma
 * regla de Emil Kowalski de arriba, aplicada a lectores de pantalla en vez de
 * a los ojos). El `.count` de la lista (`aria-live="polite"` propio, más
 * abajo en `AlertsPage`) ya cubre "algo cambió"; estos números solo se leen
 * al enfocar/activar el tile (son botones reales).
 */
const TOP_TYPES_LIMIT = 6;
const SEVERITY_ORDER: NocAlertSeverity[] = ['critical', 'warning', 'info'];
/** Rank para desempatar severidad DOMINANTE de un tipo — a igualdad de
 *  frecuencia, gana la más grave (un solo empate 2 critical/2 warning para
 *  el operario significa "hay un critical ahí adentro", no una moneda al aire). */
const SEVERITY_RANK: Record<NocAlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

interface TypeBreakdownEntry {
  alertname: string;
  count: number;
  dominantSeverity: NocAlertSeverity;
  dominantSource: string;
}

/** Recuento por severidad — SOLO sobre alertas activas (`status === 'firing'`).
 *  Las resueltas no cuentan para "qué está roto ahora mismo". */
function computeSeverityCounts(activeAlerts: NocAlertDto[]): Record<NocAlertSeverity, number> {
  const counts: Record<NocAlertSeverity, number> = { critical: 0, warning: 0, info: 0 };
  for (const a of activeAlerts) counts[a.severity] += 1;
  return counts;
}

/** Top-N tipos de incidencia (`alertname`), con la severidad y fuente
 *  DOMINANTE (la más frecuente dentro de ese tipo).
 *
 *  A3 (review adversarial): ordenar por conteo bruto reproduce EXACTAMENTE el
 *  problema que el resumen vino a resolver — con la distribución real de
 *  prod (305 info / 63 warning / 16 critical) los primeros 6 por conteo son
 *  todos tipos info, y un `NAS DOWN` critical con poco volumen queda AFUERA
 *  del panel. Orden real: severidad DOMINANTE primero (`SEVERITY_RANK`:
 *  critical > warning > info), conteo DESPUÉS dentro de la misma severidad.
 *  Garantía dura: mientras haya <= `TOP_TYPES_LIMIT` tipos de severidad
 *  critical, TODOS entran al panel sin importar cuántas alertas info los
 *  superen en volumen — nunca puede quedar un critical afuera por conteo.
 *  Empate de severidad DOMINANTE de un mismo tipo → gana la más grave (ver
 *  `SEVERITY_RANK`); empate de fuente dominante → alfabético, solo por
 *  determinismo (no hay una fuente "peor"); empate final de nombre →
 *  alfabético, mismo criterio. */
function computeTypeBreakdown(activeAlerts: NocAlertDto[], limit: number): TypeBreakdownEntry[] {
  const byType = new Map<
    string,
    { count: number; bySeverity: Map<NocAlertSeverity, number>; bySource: Map<string, number> }
  >();

  for (const a of activeAlerts) {
    const entry = byType.get(a.alertname) ?? {
      count: 0,
      bySeverity: new Map<NocAlertSeverity, number>(),
      bySource: new Map<string, number>(),
    };
    entry.count += 1;
    entry.bySeverity.set(a.severity, (entry.bySeverity.get(a.severity) ?? 0) + 1);
    entry.bySource.set(a.source, (entry.bySource.get(a.source) ?? 0) + 1);
    byType.set(a.alertname, entry);
  }

  const rows: TypeBreakdownEntry[] = Array.from(byType.entries()).map(([alertname, v]) => {
    const dominantSeverity = Array.from(v.bySeverity.entries()).sort(
      (a, b) => b[1] - a[1] || SEVERITY_RANK[a[0]] - SEVERITY_RANK[b[0]],
    )[0][0];
    const dominantSource = Array.from(v.bySource.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0][0];
    return { alertname, count: v.count, dominantSeverity, dominantSource };
  });

  return rows
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.dominantSeverity] - SEVERITY_RANK[b.dominantSeverity] ||
        b.count - a.count ||
        a.alertname.localeCompare(b.alertname),
    )
    .slice(0, limit);
}

interface AlertsSummaryProps {
  isLoading: boolean;
  isError: boolean;
  /** B13 (review adversarial): distingue "todavía no llegaron datos" (query
   *  en un estado intermedio, ni loading ni error ni data) de "llegaron
   *  datos y no hay activas". Afirmar salud de red ("la red está en orden")
   *  por AUSENCIA de datos es peligroso en un panel NOC. */
  hasData: boolean;
  activeAlerts: NocAlertDto[];
  filters: NocAlertFilterState;
  onToggleSeverity: (severity: NocAlertSeverity) => void;
  onToggleAlertname: (alertname: string) => void;
}

function AlertsSummarySkeleton() {
  // Puramente visual (aria-hidden): el skeleton de LA LISTA (role="status",
  // "Cargando alertas…") ya cubre el anuncio de carga — duplicar un segundo
  // role="status" acá sería un anuncio redundante para lectores de pantalla.
  return (
    <div className={styles.summarySkeleton} aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.summarySkeletonTile} />
      ))}
    </div>
  );
}

/** M5 (review adversarial): `AlertsSummary` no estaba en `React.memo` y sus
 *  cómputos (`computeSeverityCounts`, el filtro de `unacked`,
 *  `computeTypeBreakdown` — 1 Map + 2 Maps por tipo + sorts) corrían en el
 *  CUERPO del render sobre ~400 items, sin memoizar. Amplificado por
 *  `enteringIds` (2 renders extra por alerta firing). Fix: `useMemo` para los
 *  3 cómputos (hooks ANTES de los early-return de loading/error/empty — regla
 *  de hooks; correr sobre `activeAlerts=[]` en esos estados es gratis) +
 *  `React.memo` en el componente (efectivo solo si los handlers que le llegan
 *  son estables — ver `useCallback` en `AlertsPage`). */
function AlertsSummaryImpl({
  isLoading,
  isError,
  hasData,
  activeAlerts,
  filters,
  onToggleSeverity,
  onToggleAlertname,
}: AlertsSummaryProps) {
  const severityCounts = useMemo(() => computeSeverityCounts(activeAlerts), [activeAlerts]);
  const unacked = useMemo(() => activeAlerts.filter((a) => !a.acknowledged).length, [activeAlerts]);
  const typeBreakdown = useMemo(() => computeTypeBreakdown(activeAlerts, TOP_TYPES_LIMIT), [activeAlerts]);
  const maxTypeCount = typeBreakdown[0]?.count ?? 0;

  if (isLoading) {
    return <AlertsSummarySkeleton />;
  }

  if (isError) {
    // Texto plano, SIN role="alert": el bloque de error de la lista (debajo)
    // ya tiene ese role — duplicarlo aquí dispararía un segundo anuncio para
    // el mismo problema.
    return <p className={styles.summaryError}>No se pudo calcular el resumen de alertas.</p>;
  }

  if (activeAlerts.length === 0) {
    return (
      <section className={styles.summary} aria-label="Resumen de alertas activas">
        <p className={styles.summaryEmpty}>
          {hasData ? 'Sin alertas activas — la red está en orden.' : 'Sin datos para mostrar.'}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.summary} aria-label="Resumen de alertas activas">
      <div className={styles.summaryHeading}>
        <h2 className={styles.summaryTitle}>Resumen (activas)</h2>
        <span className={styles.summaryHint}>Recuento global de activas — no cambia con los filtros de la lista</span>
      </div>

      <div className={styles.kpiRow} role="group" aria-label="Alertas activas por severidad">
        {SEVERITY_ORDER.map((sev) => (
          <button
            key={sev}
            type="button"
            className={`${styles.kpiTile} ${styles[`kpiTile_${sev}`]}`}
            aria-pressed={filters.severity === sev}
            onClick={() => onToggleSeverity(sev)}
          >
            <span className={styles.kpiTop}>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.kpiLabel}>{SEVERITY_LABEL[sev]}</span>
            </span>
            {/* A4 (review adversarial): `aria-live="polite" aria-atomic="true"` acá
                anunciaba "16" pelado (sin contexto) en CADA tick del SSE, ×3 tiles
                — 5 live regions compitiendo por atención en la página (+ `.count`
                de la lista + `role="status"` que tenía el tile de ACK, ya sacado
                más abajo). El `.count` de la lista ya cubre "algo cambió"; estos
                números solo se leen al enfocar/activar el tile (botón real). */}
            <span className={styles.kpiValue}>{severityCounts[sev]}</span>
          </button>
        ))}

        {/* M9 (review adversarial): `role="status"` convertía este <div> en una
            live region que también anunciaba en cada tick, y estaba ahí solo
            para que un test lo encontrara — rompía además el claim de "un solo
            role=status" en éxito. Sin role, el texto visible ("Sin reconocer" +
            número) lo sigue leyendo un lector de pantalla en orden normal; el
            test lo ubica por `data-testid`. */}
        <div className={styles.kpiTileAck} data-testid="kpi-tile-ack">
          <span className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Sin reconocer</span>
          </span>
          <span className={styles.kpiValue}>{unacked}</span>
        </div>
      </div>

      {typeBreakdown.length > 0 && (
        <div className={styles.typeBreakdown}>
          <h3 className={styles.breakdownTitle}>Top incidencias</h3>
          <ul className={styles.breakdownList}>
            {typeBreakdown.map((row) => (
              <li key={row.alertname}>
                <button
                  type="button"
                  className={styles.breakdownRow}
                  aria-pressed={filters.alertname === row.alertname}
                  onClick={() => onToggleAlertname(row.alertname)}
                >
                  <span className={styles.breakdownMeta}>
                    <span className={styles.breakdownCount}>{row.count}</span>
                    <span className={styles.breakdownName}>{row.alertname}</span>
                    <SeverityBadge severity={row.dominantSeverity} />
                    <span className={styles.breakdownSource}>{row.dominantSource}</span>
                  </span>
                  <span
                    className={`${styles.breakdownBarTrack} ${styles[`breakdownBarTrack_${row.dominantSeverity}`]}`}
                  >
                    <span
                      className={`${styles.breakdownBarFill} ${styles[`breakdownBarFill_${row.dominantSeverity}`]}`}
                      style={{ width: `${maxTypeCount > 0 ? (row.count / maxTypeCount) * 100 : 0}%` }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const AlertsSummary = memo(AlertsSummaryImpl);

function SeverityBadge({ severity }: { severity: NocAlertSeverity }) {
  return (
    <span className={`${styles.badge} ${styles[`badge_${severity}`]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

function StatusBadge({ status }: { status: NocAlertStatus }) {
  return (
    <span className={`${styles.badge} ${styles[`status_${status}`]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function AlertsSkeleton() {
  return (
    <div className={styles.skeletonList} role="status" aria-label="Cargando alertas…">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonBar} style={{ width: '30%' }} />
          <div className={styles.skeletonBar} style={{ width: '70%' }} />
          <div className={styles.skeletonBar} style={{ width: '50%' }} />
        </div>
      ))}
    </div>
  );
}

export default function AlertsPage() {
  const [filters, setFilters] = useState<NocAlertFilterState>(EMPTY_NOC_ALERT_FILTERS);
  const [ackTarget, setAckTarget] = useState<NocAlertDto | null>(null);
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const ack = useAcknowledgeNocAlert();

  const streamMode = useNocAlertsStream({
    enabled: true,
    onFiring: (alertId) => {
      setEnteringIds((prev) => new Set(prev).add(alertId));
      setTimeout(() => {
        setEnteringIds((prev) => {
          const next = new Set(prev);
          next.delete(alertId);
          return next;
        });
      }, ROW_ENTER_MS + 40);
    },
  });

  const list = useNocAlertsList(streamMode === 'polling');

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), FEEDBACK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [feedback]);

  // B13 (review adversarial): `list.data === undefined` sin loading/error es
  // un estado intermedio real de la query (aún no se pidió/resolvió nada) —
  // distinto de "se pidió, volvió [] " genuino. Se lo pasamos a `AlertsSummary`
  // para que no afirme "la red está en orden" por pura ausencia de datos.
  const hasData = list.data !== undefined;
  const alerts = list.data ?? [];

  // Recuento GLOBAL (change `noc-alerts-dashboard`) — SIEMPRE sobre TODAS las
  // activas, sin aplicar `filters`. Ver comentario de `AlertsSummary`.
  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === 'firing'), [alerts]);

  const filtersActive =
    filters.source !== '' || filters.severity !== '' || filters.status !== '' || filters.alertname !== '';

  const filteredAlerts = useMemo(
    () =>
      alerts.filter(
        (a) =>
          (filters.source === '' || a.source === filters.source) &&
          (filters.severity === '' || a.severity === filters.severity) &&
          (filters.status === '' || a.status === filters.status) &&
          (filters.alertname === '' || a.alertname === filters.alertname),
      ),
    [alerts, filters],
  );

  // A2 (review adversarial): el tile de severidad promete "N activas", pero
  // solo tocaba `filters.severity` — `filters.status` seguía en '' (todos los
  // estados), así que la lista de abajo mostraba MÁS que N (activas +
  // resueltas del mismo tipo). Fix: el click también fija `status: 'firing'`
  // — es EXACTAMENTE lo que el tile cuenta. Al des-togglear (mismo tile de
  // nuevo) se limpia junto con la severidad — el click del tile es una acción
  // atómica ("filtrar por esta severidad activa" / "no filtrar"), no dos
  // filtros independientes.
  const toggleSeverityFilter = useCallback((severity: NocAlertSeverity) => {
    setFilters((f) =>
      f.severity === severity ? { ...f, severity: '', status: '' } : { ...f, severity, status: 'firing' },
    );
  }, []);

  // M5: useCallback (identidad estable) — condición necesaria para que el
  // `React.memo` de `AlertsSummary` evite recómputos en cada render de
  // `AlertsPage` (ej. cada tick del SSE que solo toca `enteringIds`).
  const toggleAlertnameFilter = useCallback((alertname: string) => {
    setFilters((f) => ({ ...f, alertname: f.alertname === alertname ? '' : alertname }));
  }, []);

  function handleConfirmAck() {
    if (!ackTarget) return;
    const target = ackTarget;
    ack.mutate(
      { id: target.id },
      {
        onSuccess: () => {
          setFeedback({ type: 'success', message: `Alerta "${target.alertname}" reconocida.` });
          setAckTarget(null);
        },
        onError: () => {
          setFeedback({ type: 'error', message: 'No se pudo reconocer la alerta. Probá de nuevo.' });
        },
      },
    );
  }

  const streamIndicator =
    streamMode === 'live'
      ? { className: styles.streamLive, label: 'En vivo' }
      : streamMode === 'polling'
        ? { className: styles.streamPolling, label: 'Actualización cada 15s' }
        : { className: styles.streamConnecting, label: 'Conectando…' };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Alertas NOC</h1>
          <span className={`${styles.streamBadge} ${streamIndicator.className}`}>
            <span className={styles.dot} aria-hidden="true" />
            {streamIndicator.label}
          </span>
        </div>
        <div className={styles.headerActions}>
          {/* change `noc-alerts-config`, Fase F FE — entrada a /admin/alerts/config. Visible si
              el usuario puede ver AL MENOS una sección de esa página (flags / umbrales /
              auditoría) — evitar un link muerto que solo lleva a "sin permiso" en todas partes. */}
          <Can permissions={['admin.flags', 'monitoring.manage', 'admin.view_activity_log']} mode="any">
            <Link to="/admin/alerts/config" className={styles.configLink}>
              Configuración
            </Link>
          </Can>
          <button type="button" className={styles.refreshBtn} onClick={() => list.refetch()}>
            Actualizar
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess}
        >
          {feedback.message}
        </div>
      )}

      <AlertsSummary
        isLoading={list.isLoading}
        isError={list.isError}
        hasData={hasData}
        activeAlerts={activeAlerts}
        filters={filters}
        onToggleSeverity={toggleSeverityFilter}
        onToggleAlertname={toggleAlertnameFilter}
      />

      <div className={styles.filters}>
        <Select label="Fuente" value={filters.source} onChange={(v) => setFilters((f) => ({ ...f, source: v }))} options={KNOWN_SOURCES} />
        <Select
          label="Severidad"
          value={filters.severity}
          onChange={(v) => setFilters((f) => ({ ...f, severity: v as NocAlertFilterState['severity'] }))}
          options={SEVERITY_OPTIONS}
        />
        <Select
          label="Estado"
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v as NocAlertFilterState['status'] }))}
          options={STATUS_OPTIONS}
        />
        {/* `alertname` no tiene <Select> propio (no vale la pena un dropdown con
            decenas de valores) — se setea desde los tiles del resumen; este chip
            es la única forma de verlo/quitarlo sin pasar por "Limpiar filtros". */}
        {filters.alertname !== '' && (
          <button
            type="button"
            className={styles.typeChip}
            onClick={() => setFilters((f) => ({ ...f, alertname: '' }))}
            aria-label={`Quitar filtro de tipo: ${filters.alertname}`}
          >
            Tipo: {filters.alertname}
            <span aria-hidden="true"> ✕</span>
          </button>
        )}
        {filtersActive && (
          <button type="button" className={styles.clearBtn} onClick={() => setFilters(EMPTY_NOC_ALERT_FILTERS)}>
            Limpiar filtros
          </button>
        )}
      </div>

      <p className={styles.count} aria-live="polite">
        {filteredAlerts.length} alerta{filteredAlerts.length === 1 ? '' : 's'} visible
        {filteredAlerts.length === 1 ? '' : 's'}
      </p>

      {list.isLoading ? (
        <AlertsSkeleton />
      ) : list.isError ? (
        <div className={styles.errorState} role="alert">
          <p>No se pudieron cargar las alertas.</p>
          <button type="button" className={styles.retryBtn} onClick={() => list.refetch()}>
            Reintentar
          </button>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className={styles.emptyState}>
          {filtersActive ? (
            <>
              <p>Ninguna alerta coincide con los filtros elegidos.</p>
              <button type="button" className={styles.clearBtn} onClick={() => setFilters(EMPTY_NOC_ALERT_FILTERS)}>
                Limpiar filtros
              </button>
            </>
          ) : (
            <p>No hay alertas activas en este momento.</p>
          )}
        </div>
      ) : (
        <ul className={styles.list} role="list" aria-label="Lista de alertas">
          {filteredAlerts.map((alert) => (
            <li
              key={alert.id}
              className={styles.card}
              data-entering={enteringIds.has(alert.id) || undefined}
            >
              <div className={styles.cardHeader}>
                <SeverityBadge severity={alert.severity} />
                <StatusBadge status={alert.status} />
                <span className={styles.time} title={formatDateTimeShort(alert.startsAt)}>
                  {formatRelative(alert.startsAt)}
                </span>
              </div>
              <p className={styles.alertName}>{alert.alertname}</p>
              <p className={styles.entity}>
                {alert.entityType} · {alert.entityName}
              </p>
              <p className={styles.message}>{alert.message}</p>
              {alert.metricName && (
                <p className={styles.metric}>
                  {alert.metricName}: {alert.metricValue}
                  {alert.metricUnit ?? ''}
                  {alert.threshold !== null ? ` (umbral ${alert.threshold}${alert.metricUnit ?? ''})` : ''}
                </p>
              )}
              <div className={styles.cardFooter}>
                <span className={styles.source}>{alert.source}</span>
                {alert.acknowledged ? (
                  <span className={styles.ackInfo}>
                    Reconocida por {alert.ackBy}
                    {alert.ackAt ? ` · ${formatRelative(alert.ackAt)}` : ''}
                  </span>
                ) : (
                  <Can permission="monitoring.acknowledge_alert">
                    <button
                      type="button"
                      className={styles.ackBtn}
                      onClick={() => setAckTarget(alert)}
                      aria-label={`Reconocer alerta ${alert.alertname}`}
                    >
                      Reconocer
                    </button>
                  </Can>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={!!ackTarget}
        title="Reconocer alerta"
        message={
          ackTarget
            ? `Vas a marcar "${ackTarget.alertname}" (${ackTarget.entityName}) como reconocida. El equipo va a asumir que alguien ya la está atendiendo.`
            : ''
        }
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        busy={ack.isPending}
        onConfirm={handleConfirmAck}
        onCancel={() => setAckTarget(null)}
      />
    </div>
  );
}
