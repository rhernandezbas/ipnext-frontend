import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useAuditEvents } from '@/hooks/useAuditEvents';
import type { AuditEventDto, AuditEventQuery } from '@/types/audit';
import { formatDateTimeShort } from '@/utils/formatDate';
import styles from './ActivityBody.module.css';

const PAGE_SIZE = 25;

const METHOD_OPTIONS = ['all', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/**
 * Presets de entidad (change `noc-alerts-config`, Fase F FE) — la ACK de una
 * alerta NOC queda con `entityType='NocAlert'` (`AcknowledgeAlert` del BE).
 * El input de texto libre de abajo sigue existiendo (cualquier entityType es
 * válido), esto es solo un atajo para no tener que escribirlo a mano.
 */
const ENTITY_PRESETS = [
  { value: '', label: 'Todas' },
  { value: 'NocAlert', label: 'Alertas NOC' },
] as const;

function formatDate(dateStr: string | null): string {
  return formatDateTimeShort(dateStr);
}

/**
 * El ACK de una alerta NOC (`AcknowledgeAlert.ts`) escribe `afterJson.channel`
 * ('panel' | 'telegram:<user>' derivado, ver `actorLogin`). Devuelve el canal
 * si `afterJson` lo trae, o `null` si no aplica (evento de otra entidad, o
 * `afterJson` sin esa forma) — nunca asume la forma sin chequear.
 */
function getAuditChannel(afterJson: unknown): string | null {
  if (afterJson === null || typeof afterJson !== 'object') return null;
  const channel = (afterJson as Record<string, unknown>)['channel'];
  return typeof channel === 'string' && channel.length > 0 ? channel : null;
}

function methodClass(method: string): string {
  switch (method) {
    case 'POST': return styles.methodPost;
    case 'PUT':
    case 'PATCH': return styles.methodPut;
    case 'DELETE': return styles.methodDelete;
    default: return styles.methodOther;
  }
}

function MethodBadge({ method }: { method: string }) {
  return <span className={`${styles.badge} ${methodClass(method)}`}>{method}</span>;
}

function statusClass(code: number): string {
  if (code >= 500) return styles.status5xx;
  if (code >= 400) return styles.status4xx;
  if (code >= 200 && code < 300) return styles.status2xx;
  return styles.statusOther;
}

function StatusBadge({ code }: { code: number }) {
  return <span className={`${styles.badge} ${statusClass(code)}`}>{code}</span>;
}

function prettyJson(value: unknown): string {
  if (value === null || value === undefined) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function DetailDrawer({ event, onClose }: { event: AuditEventDto; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de evento ${event.id}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>{event.action ?? event.method}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <dl className={styles.detailList}>
          <div className={styles.detailField}>
            <dt>Actor</dt>
            <dd>{event.actorLogin}</dd>
          </div>
          <div className={styles.detailField}>
            <dt>Método / Ruta</dt>
            <dd>
              <MethodBadge method={event.method} /> {event.path}
            </dd>
          </div>
          <div className={styles.detailField}>
            <dt>Entidad</dt>
            <dd>
              {event.entityType ?? '—'}
              {event.entityId ? ` #${event.entityId}` : ''}
            </dd>
          </div>
          <div className={styles.detailField}>
            <dt>Estado</dt>
            <dd><StatusBadge code={event.statusCode} /></dd>
          </div>
          {event.errorMessage && (
            <div className={styles.detailField}>
              <dt>Error</dt>
              <dd className={styles.errorText}>{event.errorMessage}</dd>
            </div>
          )}
          <div className={styles.detailField}>
            <dt>IP</dt>
            <dd>{event.ip ?? '—'}</dd>
          </div>
          <div className={styles.detailField}>
            <dt>Fecha</dt>
            <dd>{formatDate(event.createdAt)}</dd>
          </div>
        </dl>

        <div className={styles.diffGrid}>
          <div className={styles.diffCol}>
            <h3 className={styles.diffLabel}>Antes</h3>
            <pre className={styles.json}>{prettyJson(event.beforeJson)}</pre>
          </div>
          <div className={styles.diffCol}>
            <h3 className={styles.diffLabel}>Después</h3>
            <pre className={styles.json}>{prettyJson(event.afterJson)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ActivityBodyProps {
  /** Preseed the entity-type filter (e.g. deep-link from AlertsConfigPage → "Auditoría de alertas"). */
  initialEntityType?: string;
}

export function ActivityBody({ initialEntityType = '' }: ActivityBodyProps = {}) {
  const [method, setMethod] = useState<string>('all');
  const [entityType, setEntityType] = useState(initialEntityType);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEventDto | null>(null);

  const query = useMemo<AuditEventQuery>(() => {
    const q: AuditEventQuery = { page, pageSize: PAGE_SIZE };
    if (method !== 'all') q.method = method;
    if (entityType.trim()) q.entityType = entityType.trim();
    if (from) q.from = from;
    if (to) q.to = to;
    return q;
  }, [method, entityType, from, to, page]);

  const { data, isLoading } = useAuditEvents(query);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function resetToFirstPage(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  const columns = [
    {
      label: 'Actor',
      key: 'actorLogin' as const,
      render: (row: AuditEventDto): ReactNode => (
        <button
          type="button"
          className={styles.rowTrigger}
          onClick={() => setSelected(row)}
        >
          {row.actorLogin}
        </button>
      ),
    },
    {
      label: 'Acción',
      key: 'action' as const,
      render: (row: AuditEventDto): ReactNode => row.action ?? row.method,
    },
    {
      label: 'Entidad',
      key: 'entityType' as const,
      render: (row: AuditEventDto): ReactNode =>
        row.entityType ? `${row.entityType}${row.entityId ? ` #${row.entityId}` : ''}` : '—',
    },
    // Canal (change `noc-alerts-config`, Fase F FE) — solo tiene sentido cuando se está
    // mirando la auditoría de alertas NOC (afterJson.channel viene del ACK de una alerta,
    // 'panel' | 'telegram:<user>'). Mostrarla siempre sería ruido para el resto de entidades
    // (Client, Contract, etc.) que nunca tienen ese campo.
    ...(entityType === 'NocAlert'
      ? [
          {
            label: 'Canal',
            key: 'channel',
            render: (row: AuditEventDto): ReactNode => getAuditChannel(row.afterJson) ?? '—',
          },
        ]
      : []),
    {
      label: 'Método',
      key: 'method' as const,
      render: (row: AuditEventDto): ReactNode => <MethodBadge method={row.method} />,
    },
    {
      label: 'Estado',
      key: 'statusCode' as const,
      render: (row: AuditEventDto): ReactNode => <StatusBadge code={row.statusCode} />,
    },
    {
      label: 'Fecha',
      key: 'createdAt' as const,
      render: (row: AuditEventDto): ReactNode => formatDate(row.createdAt),
    },
  ];

  return (
    <div className={styles.body}>
      <div className={styles.filters}>
        <div className={styles.field}>
          <label htmlFor="audit-method">Método</label>
          <select
            id="audit-method"
            value={method}
            onChange={(e) => resetToFirstPage(setMethod)(e.target.value)}
          >
            {METHOD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 'all' ? 'Todos' : m}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-entity">Entidad</label>
          <input
            id="audit-entity"
            type="text"
            placeholder="Tipo de entidad"
            value={entityType}
            onChange={(e) => resetToFirstPage(setEntityType)(e.target.value)}
          />
          <div className={styles.entityPresets} role="group" aria-label="Atajos de filtro rápido">
            {ENTITY_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`${styles.presetChip} ${entityType === preset.value ? styles.presetChipActive : ''}`}
                aria-pressed={entityType === preset.value}
                onClick={() => resetToFirstPage(setEntityType)(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-from">Desde</label>
          <input
            id="audit-from"
            type="date"
            value={from}
            onChange={(e) => resetToFirstPage(setFrom)(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-to">Hasta</label>
          <input
            id="audit-to"
            type="date"
            value={to}
            onChange={(e) => resetToFirstPage(setTo)(e.target.value)}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage="No hay actividad registrada."
      />

      <div className={styles.pagination}>
        <button
          type="button"
          className={styles.pageBtn}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          Anterior
        </button>
        <span className={styles.pageIndicator}>
          Página {page} de {totalPages}
        </span>
        <button
          type="button"
          className={styles.pageBtn}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Siguiente
        </button>
      </div>

      {selected && <DetailDrawer event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
