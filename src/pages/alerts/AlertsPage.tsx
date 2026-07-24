import { useEffect, useMemo, useState } from 'react';
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

  const alerts = list.data ?? [];

  const filtersActive = filters.source !== '' || filters.severity !== '' || filters.status !== '';

  const filteredAlerts = useMemo(
    () =>
      alerts.filter(
        (a) =>
          (filters.source === '' || a.source === filters.source) &&
          (filters.severity === '' || a.severity === filters.severity) &&
          (filters.status === '' || a.status === filters.status),
      ),
    [alerts, filters],
  );

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
        <ul className={styles.list}>
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
