/**
 * InternetActivationHistoryModal — espejo de ActivationHistoryModal (TV) para
 * el historial de servicios de Internet.
 *
 * Dos modos (igual que el de TV):
 *   - Per-cliente (clientId provisto): muestra SOLO los eventos de ese cliente.
 *     Columnas: Fecha · Tipo · Operador · Motivo. Sin barra de filtros.
 *   - Global (sin clientId): muestra TODAS las altas del sistema con su operador,
 *     con barra de filtros (desde/hasta/operador). Columnas:
 *     Fecha · Tipo · Cliente · Operador · Motivo.
 *
 * Ambos modos consumen el MISMO hook useInternetActivationHistory: el filtro ya
 * soporta clientId? opcional. En global se cablean from/to/actorId; en per-cliente
 * solo clientId. El motivo abre ReasonViewModal en los dos modos.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  useInternetActivationHistory,
  usePppoeActivationOperators,
} from '@/hooks/useInternetServices';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { ReasonViewModal } from '@/components/molecules/ReasonViewModal/ReasonViewModal';
import { formatDateTimeShort, arDayStartUtc, arDayEndUtc } from '@/utils/formatDate';
import { exportToCsv } from '@/utils/exportToCsv';
import type { CsvColumn } from '@/utils/exportToCsv';
import type {
  InternetServiceEvent,
  InternetActivationHistoryFilter,
  PlanChangeDirection,
} from '@/types/internetService';
import { SERVICE_EVENT_TYPES } from '@/types/serviceEvents';
import styles from './InternetActivationHistoryModal.module.css';

export interface InternetActivationHistoryModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Cuando se provee, el modal muestra SOLO los eventos de ese cliente
   * (modo per-cliente). Cuando se omite, muestra el historial global de todas
   * las altas del sistema con barra de filtros (modo global).
   */
  clientId?: string;
  /** Etiqueta opcional del cliente para el subtítulo (solo per-cliente). */
  customerName?: string | null;
}

type Row = InternetServiceEvent & { id: string };

const DIALOG_TITLE_ID = 'internet-activation-history-modal-title';

// ── Badge de tipo de evento ─────────────────────────────────────────────────
//
// El BE graba eventType en INGLÉS desde los use cases. Mapeamos cada valor REAL
// a etiqueta español + un badge con color sensato (REUSO de los 3 badges que ya
// existen — no inventamos color nuevo):
//   activated/restored → verde (alta/restaurado)   → badgeAlta
//   deactivated/blocked → rojo (baja/bloqueado)     → badgeBaja
//   reactivated/modified/reduced → ámbar (cambio)   → badgeReactivacion
// Un valor DESCONOCIDO muestra el string crudo capitalizado (default robusto),
// NO "Reactivación".

type BadgeStyle = 'badgeAlta' | 'badgeBaja' | 'badgeReactivacion';

const EVENT_TYPE_LABELS: Record<InternetServiceEvent['eventType'], { label: string; style: BadgeStyle }> = {
  activated: { label: 'Alta', style: 'badgeAlta' },
  restored: { label: 'Restaurado', style: 'badgeAlta' },
  deactivated: { label: 'Baja', style: 'badgeBaja' },
  blocked: { label: 'Bloqueado', style: 'badgeBaja' },
  reactivated: { label: 'Reactivación', style: 'badgeReactivacion' },
  modified: { label: 'Modificado', style: 'badgeReactivacion' },
  reduced: { label: 'Reducido', style: 'badgeReactivacion' },
};

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function EventTypeBadge({ type }: { type: InternetServiceEvent['eventType'] }) {
  const known = EVENT_TYPE_LABELS[type];
  if (known) {
    return <span className={styles[known.style]}>{known.label}</span>;
  }
  // Default robusto: string crudo capitalizado con badge neutro (ámbar), NO "Reactivación".
  return <span className={styles.badgeReactivacion}>{capitalize(String(type))}</span>;
}

// ── Detalle inline de un evento 'modified' (plan / ip / password / status) ───
//
// internet-history-plan-direction: el BE computa direction/oldPlan/newPlan para
// cambios de PLAN. Mostramos el TEXTO "viejo → nuevo" para cualquier 'modified'
// con ambos planes (incluye cambios laterales / enforcement / legacy sin dirección);
// el badge ↑/↓ aparece solo cuando hay una dirección comercial (up/down).
//
// pppoe-change-audit: el BE ahora también emite 'modified' para cambios de IP,
// contraseña y estado. changeKind discrimina cuál:
//   'ip'       → "IP: {oldValue} → {newValue}"
//   'password' → "Contraseña cambiada" (NUNCA el valor, por seguridad)
//   'status'   → "Estado: {label(oldValue)} → {label(newValue)}"
//   null/ausente → cambio de plan → render oldPlan → newPlan (path INTACTO).

// Estado crudo del secret PPPoE → etiqueta español. Fallback al valor crudo para
// no inventar copy ante un estado desconocido.
const STATUS_CHANGE_LABELS: Record<string, string> = {
  // Vocabulario REAL del secret PPPoE (input.status del PATCH = enabled|disabled; terminated = baja).
  enabled: 'Activo',
  disabled: 'Suspendido',
  terminated: 'Dado de baja',
};

function statusChangeLabel(raw: string | null | undefined): string {
  if (!raw) return '';
  return STATUS_CHANGE_LABELS[raw] ?? raw;
}

function PlanChangeInfo({ event }: { event: InternetServiceEvent }) {
  if (event.eventType !== 'modified') return null;

  // service-transfer W4 — transferencias entre clientes: 'transfer-out' (origen)
  // / 'transfer-in' (destino). oldValue/newValue = nombres snapshot de los
  // clientes. El badge ámbar marca el PPPoE movido "tal cual" (as-is) — la marca
  // viaja en notes (hoy solo en el historial por contrato; acá es defensivo).
  if (event.changeKind === 'transfer-out' || event.changeKind === 'transfer-in') {
    const pendingRegularize = !!event.notes?.includes('pendiente de regularizar');
    return (
      <div className={styles.planChangeInfo}>
        <span className={styles.planChangeText}>
          {event.changeKind === 'transfer-out'
            ? `⇄ Transferido a ${event.newValue ?? '—'}`
            : `⇄ Recibido por transferencia de ${event.oldValue ?? '—'}`}
        </span>
        {pendingRegularize && (
          <span className={styles.asIsBadge}>Tal cual — pendiente de regularizar</span>
        )}
      </div>
    );
  }

  // pppoe-change-audit — ramas por changeKind (ip / password / status). Un valor
  // null/ausente cae al render de cambio de plan de más abajo (path original).
  if (event.changeKind === 'ip') {
    return (
      <div className={styles.planChangeInfo}>
        <span className={styles.planChangeText}>
          IP: {event.oldValue ?? '—'} → {event.newValue ?? '—'}
        </span>
      </div>
    );
  }
  if (event.changeKind === 'password') {
    return (
      <div className={styles.planChangeInfo}>
        <span className={styles.planChangeText}>Contraseña cambiada</span>
      </div>
    );
  }
  if (event.changeKind === 'status') {
    return (
      <div className={styles.planChangeInfo}>
        <span className={styles.planChangeText}>
          Estado: {statusChangeLabel(event.oldValue)} → {statusChangeLabel(event.newValue)}
        </span>
      </div>
    );
  }

  // changeKind null/ausente → cambio de plan (render original, sin tocar).
  if (!event.oldPlan || !event.newPlan) return null;
  const isUpgrade = event.direction === 'upgrade';
  const isDowngrade = event.direction === 'downgrade';
  return (
    <div className={styles.planChangeInfo}>
      {(isUpgrade || isDowngrade) && (
        <span
          className={isUpgrade ? styles.directionUp : styles.directionDown}
          aria-label={isUpgrade ? 'Upgrade' : 'Downgrade'}
        >
          {isUpgrade ? '↑' : '↓'}
        </span>
      )}
      <span className={styles.planChangeText}>
        {event.oldPlan} → {event.newPlan}
      </span>
    </div>
  );
}

// ── Columna de cliente (solo modo global, cruza clientes) ────────────────────

function customerColumn() {
  return {
    key: 'customer',
    label: 'Cliente',
    render: (r: Row) => {
      const name = r.customerName ?? '—';
      return r.clientId ? (
        <Link className={styles.nameLink} to={`/admin/customers/view/${r.clientId}`}>
          {name}
        </Link>
      ) : (
        <span>{name}</span>
      );
    },
  };
}

// ── Columnas comunes ─────────────────────────────────────────────────────────

function buildColumns(
  onViewReason: (reason: string) => void,
  opts: { showCustomer?: boolean } = {},
) {
  const base = [
    {
      key: 'createdAt',
      label: 'Fecha/hora',
      render: (r: Row) => formatDateTimeShort(r.createdAt),
    },
    {
      key: 'eventType',
      label: 'Tipo',
      render: (r: Row) => (
        <>
          <EventTypeBadge type={r.eventType} />
          <PlanChangeInfo event={r} />
        </>
      ),
    },
    // En modo global insertamos la columna Cliente entre Tipo y Operador.
    ...(opts.showCustomer ? [customerColumn()] : []),
    {
      key: 'actorName',
      label: 'Operador',
      render: (r: Row) => r.actorName,
    },
    {
      key: 'reason',
      label: 'Motivo',
      render: (r: Row) =>
        r.reason ? (
          <button
            type="button"
            className={styles.reasonLink}
            aria-label="Ver motivo"
            onClick={() => onViewReason(r.reason!)}
          >
            ver
          </button>
        ) : (
          '—'
        ),
    },
  ];
  return base;
}

// ── Cuerpo per-cliente ───────────────────────────────────────────────────────

function PerClientBody({ clientId, open }: { clientId: string; open: boolean }) {
  const { data, isLoading, isError } = useInternetActivationHistory({ clientId }, open);
  const [activeReason, setActiveReason] = useState<string | null>(null);
  const rows: Row[] = (data ?? []).map((e) => ({ ...e, id: e.id }));
  const columns = buildColumns(setActiveReason);
  return (
    <>
      {isError && (
        <div className={styles.bannerError}>Error al cargar el historial de Internet.</div>
      )}
      <div className={styles.body}>
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          emptyMessage="Sin eventos para este cliente."
        />
      </div>
      {activeReason !== null && (
        <ReasonViewModal open reason={activeReason} onClose={() => setActiveReason(null)} />
      )}
    </>
  );
}

// ── Cuerpo global (con filtros) ──────────────────────────────────────────────

// Columnas del CSV: Fecha · Tipo · Cliente · Operador · Motivo.
// Motivo en el CSV es el texto real (no el botón "ver").
const CSV_COLUMNS: CsvColumn<Row>[] = [
  {
    label: 'Fecha',
    value: (r) => formatDateTimeShort(r.createdAt),
  },
  {
    label: 'Tipo',
    value: (r) => EVENT_TYPE_LABELS[r.eventType]?.label ?? capitalize(String(r.eventType)),
  },
  {
    label: 'Cliente',
    value: (r) => r.customerName ?? '—',
  },
  {
    label: 'Operador',
    value: (r) => r.actorName ?? '—',
  },
  {
    label: 'Motivo',
    value: (r) => r.reason ?? '—',
  },
];

function GlobalBody({ open }: { open: boolean }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actorId, setActorId] = useState('');
  const [eventType, setEventType] = useState('');
  const [direction, setDirection] = useState('');
  const [activeReason, setActiveReason] = useState<string | null>(null);

  // Operadores que realmente generaron eventos de Internet (endpoint pppoe-scoped,
  // gate pppoe.read). Reemplaza el viejo useRbacUsers (que pedía admin/rbac y dejaba
  // el select vacío para usuarios pppoe.read-only). `open` ata el fetch al modal.
  const { data: ops, isLoading: operatorsLoading } = usePppoeActivationOperators(open);
  const operators = (ops ?? []).map((o) => ({ id: o.actorId, name: o.actorName }));

  // W1 — el <input type="date"> da "YYYY-MM-DD". Si lo mandáramos crudo, el BE
  // haría new Date('2026-06-01') = medianoche UTC = 21:00 AR del día ANTERIOR,
  // corriendo los bordes del rango 3h. AR es UTC-3 fijo: convertimos al instante
  // AR correcto (inicio/fin de día AR) en ISO con Z antes de mandarlo.
  const filter: InternetActivationHistoryFilter = {};
  if (from) filter.from = arDayStartUtc(from).toISOString();
  if (to) filter.to = arDayEndUtc(to).toISOString();
  if (actorId) filter.actorId = actorId;
  // internet-history-plan-direction: filtro por tópico (eventType) y por
  // dirección de cambio de plan (upgrade/downgrade) — server-side, independientes.
  if (eventType) filter.eventType = eventType as InternetServiceEvent['eventType'];
  if (direction) filter.direction = direction as PlanChangeDirection;

  const { data, isLoading, isError } = useInternetActivationHistory(filter, open);

  const rows: Row[] = (data ?? []).map((e) => ({ ...e, id: e.id }));
  const columns = buildColumns(setActiveReason, { showCustomer: true });

  return (
    <>
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="iahm-from" className={styles.filterLabel}>
            Desde
          </label>
          <input
            id="iahm-from"
            type="date"
            className={styles.input}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Desde"
          />
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="iahm-to" className={styles.filterLabel}>
            Hasta
          </label>
          <input
            id="iahm-to"
            type="date"
            className={styles.input}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Hasta"
          />
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="iahm-actor" className={styles.filterLabel}>
            Operador
          </label>
          <select
            id="iahm-actor"
            className={styles.input}
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            disabled={operatorsLoading}
          >
            <option value="">Todos</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="iahm-event-type" className={styles.filterLabel}>
            Tópico
          </label>
          <select
            id="iahm-event-type"
            className={styles.input}
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            aria-label="Tópico"
          >
            <option value="">Todos</option>
            {SERVICE_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t].label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="iahm-direction" className={styles.filterLabel}>
            Dirección
          </label>
          <select
            id="iahm-direction"
            className={styles.input}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            aria-label="Dirección"
          >
            <option value="">Todos</option>
            <option value="upgrade">↑ Upgrade</option>
            <option value="downgrade">↓ Downgrade</option>
          </select>
        </div>
        {/*
          Siempre habilitado: no lo deshabilitamos durante el loading ni con 0
          filas. exportToCsv hace early-return si rows está vacío (no baja un
          archivo vacío), así evitamos un botón que parpadea disabled mientras
          carga la tabla.
        */}
        <button
          type="button"
          className={styles.exportBtn}
          onClick={() => exportToCsv(rows, CSV_COLUMNS, 'historial-internet.csv')}
          aria-label="Exportar CSV"
        >
          Exportar CSV
        </button>
      </div>

      {isError && (
        <div className={styles.bannerError}>Error al cargar el historial de Internet.</div>
      )}

      <div className={styles.body}>
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          emptyMessage="Sin eventos para el filtro."
        />
      </div>
      {activeReason !== null && (
        <ReasonViewModal open reason={activeReason} onClose={() => setActiveReason(null)} />
      )}
    </>
  );
}

// ── Shell del modal ──────────────────────────────────────────────────────────

export function InternetActivationHistoryModal({
  open,
  onClose,
  clientId,
  customerName,
}: InternetActivationHistoryModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={DIALOG_TITLE_ID}>
        <div className={styles.header}>
          <div>
            <h2 id={DIALOG_TITLE_ID} className={styles.title}>
              Historial de Internet
            </h2>
            {clientId && customerName && <p className={styles.subtitle}>{customerName}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {clientId ? (
          <PerClientBody clientId={clientId} open={open} />
        ) : (
          <GlobalBody open={open} />
        )}
      </div>
    </div>,
    document.body,
  );
}
