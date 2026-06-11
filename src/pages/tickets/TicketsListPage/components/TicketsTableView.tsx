import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useAssignTicket, useUpdateTicketStatus, useDeleteTicket } from '@/hooks/useTickets';
import { mapWithConcurrency } from '@/utils/mapWithConcurrency';
import type { Ticket } from '@/types/ticket';
import styles from './TicketsTableView.module.css';

/** Bulk requests run at most 5 in flight — mirrors the BE/tasks limit. */
const BULK_CONCURRENCY = 5;

/** #26 — closed/cerrado get a stark black & white pill so they stand out. The
 *  same slugs resolve the canonical "closed" catalog name for bulk Cerrar. */
const CLOSED_SLUGS = ['cerrado', 'closed'];

const PRIORITY_COLOR: Record<string, string> = {
  low: '#64748b', medium: '#2563eb', high: '#f59e0b', critical: '#dc2626',
};

/** Status pill — catalog color for open states, black & white for closed. */
function TicketStatusPill({ status }: { status: string }) {
  const { data: statuses = [] } = useTicketStatuses();
  const closed = CLOSED_SLUGS.includes(status.toLowerCase());
  const color = statuses.find(s => s.name === status)?.color ?? '#94a3b8';
  return (
    <span
      className={styles.statusPill}
      style={closed ? undefined : { backgroundColor: color }}
      data-variant={closed ? 'closed' : 'open'}
      aria-label={`Estado: ${status}`}
    >
      {status}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  return (
    <span
      className={styles.priorityPill}
      style={{ backgroundColor: PRIORITY_COLOR[priority] ?? '#94a3b8', color: '#fff' }}
      aria-label={`Prioridad: ${priority}`}
    >
      {priority}
    </span>
  );
}

/** Per-action toast copy: `done` = success past-participle, `failVerb` =
 *  infinitive for the partial-failure line ("X de N no se pudieron {failVerb}"). */
interface BulkCopy { done: string; failVerb: string; }
const BULK_COPY = {
  assign: { done: 'asignados', failVerb: 'asignar' },
  status: { done: 'actualizados', failVerb: 'actualizar' },
  close:  { done: 'cerrados', failVerb: 'cerrar' },
  delete: { done: 'eliminados', failVerb: 'eliminar' },
} satisfies Record<string, BulkCopy>;

// ── BulkActionBar (inline, AD-6) ─────────────────────────────────────────────

type PickerKind = null | 'assign' | 'status';

interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
  /** Each handler runs the N-request bulk and returns the ids that FAILED. */
  onAssign: (ids: string[], assigneeId: string) => Promise<void>;
  onChangeStatus: (ids: string[], status: string) => Promise<void>;
  onClose: (ids: string[]) => Promise<void>;
  onDelete: (ids: string[]) => Promise<void>;
  assignees: Array<{ id: string; name: string }>;
  statuses: Array<{ id: string; name: string }>;
}

function BulkActionBar({
  selectedIds, onClear, onAssign, onChangeStatus, onClose, onDelete, assignees, statuses,
}: BulkActionBarProps) {
  const [picker, setPicker] = useState<PickerKind>(null);
  const [pickerValue, setPickerValue] = useState('');
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  if (selectedIds.length === 0) return null;

  const count = selectedIds.length;
  const noun = `ticket${count !== 1 ? 's' : ''}`;

  function openPicker(kind: Exclude<PickerKind, null>) {
    setPickerValue('');
    setPicker(kind);
  }

  async function handleConfirmPicker() {
    if (!pickerValue) return;
    setBusy(true);
    try {
      if (picker === 'assign') await onAssign(selectedIds, pickerValue);
      else if (picker === 'status') await onChangeStatus(selectedIds, pickerValue);
      setPicker(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    setBusy(true);
    try {
      await onClose(selectedIds);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      message: `¿Eliminar ${count} ${noun}? El ticket se cierra y conserva el historial (no se borra).`,
      tone: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await onDelete(selectedIds);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.bulkBar} data-testid="ticket-bulk-bar">
        <span className={styles.bulkLabel}>Acciones masivas</span>
        <span className={styles.bulkCount}>{count} {noun} seleccionado{count !== 1 ? 's' : ''}</span>

        <Can permission="tickets.write">
          <button type="button" className={styles.bulkBtn} disabled={busy} onClick={() => openPicker('assign')}>
            Asignar
          </button>
        </Can>
        <Can permission="tickets.write">
          <button type="button" className={styles.bulkBtn} disabled={busy} onClick={() => openPicker('status')}>
            Cambiar estado
          </button>
        </Can>
        <Can permission="tickets.close">
          <button type="button" className={styles.bulkBtn} disabled={busy} onClick={() => void handleClose()}>
            Cerrar
          </button>
        </Can>
        <Can permission="tickets.delete">
          <button type="button" className={styles.bulkDeleteBtn} disabled={busy} onClick={() => void handleDelete()}>
            Eliminar
          </button>
        </Can>

        <button type="button" className={styles.bulkClear} onClick={onClear} aria-label="Limpiar selección">
          Limpiar
        </button>
      </div>

      {picker && (
        <div className={styles.dialogOverlay} role="dialog" aria-modal="true" aria-labelledby="ticket-bulk-picker-title">
          <div className={styles.dialog}>
            <h2 id="ticket-bulk-picker-title" className={styles.dialogTitle}>
              {picker === 'assign'
                ? `Asignar ${count} ${noun}`
                : `Cambiar estado de ${count} ${noun}`}
            </h2>
            <label className={styles.dialogLabel}>
              {picker === 'assign' ? 'Asignar a' : 'Nuevo estado'}
              <select
                value={pickerValue}
                onChange={e => setPickerValue(e.target.value)}
                className={styles.dialogSelect}
                autoFocus
              >
                <option value="">Seleccionar…</option>
                {picker === 'assign'
                  ? assignees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)
                  : statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </label>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setPicker(null)} disabled={busy}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void handleConfirmPicker()}
                disabled={busy || !pickerValue}
              >
                {picker === 'assign' ? 'Asignar' : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── TicketsTableView ─────────────────────────────────────────────────────────

interface TicketsTableViewProps {
  tickets: Ticket[];
  loading?: boolean;
  /** Columns to render, in order. When undefined, the canonical order is used. */
  visibleColumnKeys?: string[];
  /** True when any filter is active — switches the empty state from the
   *  create-CTA copy to the "sin resultados / Limpiar filtros" copy. */
  hasActiveFilters?: boolean;
  /** Clears all filters — wired to the empty-state "Limpiar filtros" action. */
  onClearFilters?: () => void;
}

const ALL_COLUMNS: Array<{ label: string; key: string; sortable?: boolean; render?: (t: Ticket) => React.ReactNode }> = [
  { label: 'ID', key: 'id',
    render: (t) => <Link to={`/admin/tickets/${t.id}`} className={styles.idLink}>#{t.sequenceNumber}</Link> },
  { label: 'Tema', key: 'subject', sortable: true,
    render: (t) => <Link to={`/admin/tickets/${t.id}`} className={styles.titleLink}>{t.subject}</Link> },
  { label: 'Cliente/Cliente Potencial', key: 'customerName', sortable: true },
  { label: 'Tipo', key: 'type' },
  { label: 'Reporter', key: 'reporter' },
  { label: 'Prioridad', key: 'priority', sortable: true, render: (t) => <PriorityPill priority={t.priority} /> },
  { label: 'Estado', key: 'status', sortable: true, render: (t) => <TicketStatusPill status={t.status} /> },
  { label: 'Asignado a', key: 'assigneeName' },
  { label: 'Creado de fecha y hora', key: 'createdAt', sortable: true },
];

export function TicketsTableView({
  tickets, loading = false, visibleColumnKeys, hasActiveFilters = false, onClearFilters,
}: TicketsTableViewProps) {
  const { data: statuses = [] } = useTicketStatuses();
  const { data: users = [] } = useRbacUsers();
  const assignTicket = useAssignTicket();
  const updateStatus = useUpdateTicketStatus();
  const deleteTicket = useDeleteTicket();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  /**
   * Run a bulk action as N requests (concurrency 5). On full success: toast the
   * count with the action-specific verb (asignados/actualizados/cerrados/
   * eliminados) and clear the selection. On partial failure: toast
   * "X de N no se pudieron {verbo}" and narrow the selection to ONLY the failed
   * ids so the operator can retry. mapWithConcurrency captures the per-item
   * rejections for us.
   */
  async function runBulk(
    ids: string[],
    fn: (id: string) => Promise<unknown>,
    copy: BulkCopy,
  ) {
    const { failedItems } = await mapWithConcurrency(ids, BULK_CONCURRENCY, fn);
    if (failedItems.length === 0) {
      showToast(`${ids.length} tickets ${copy.done}`);
      setSelectedIds([]);
    } else {
      showToast(`${failedItems.length} de ${ids.length} no se pudieron ${copy.failVerb}`);
      setSelectedIds(failedItems);
    }
  }

  /** Canonical closed status name from the catalog (e.g. "Cerrado"), falling
   *  back to 'cerrado' when the catalog has no closed entry. */
  function closedStatusName(): string {
    const entry = statuses.find(s => CLOSED_SLUGS.includes(s.name.toLowerCase()));
    return entry?.name ?? 'cerrado';
  }

  const columns = visibleColumnKeys
    ? visibleColumnKeys.map(k => ALL_COLUMNS.find(c => c.key === k)).filter((c): c is typeof ALL_COLUMNS[number] => !!c)
    : ALL_COLUMNS;

  // Differentiated empty states (not the generic DataTable emptyMessage) so the
  // "no results" case can carry a "Limpiar filtros" action.
  if (!loading && tickets.length === 0) {
    return (
      <div className={styles.empty} data-testid="ticket-empty-state">
        {hasActiveFilters ? (
          <>
            <p className={styles.emptyTitle}>Sin resultados para los filtros</p>
            <p className={styles.emptyHint}>Ajustá o limpiá los filtros para ver más tickets.</p>
            <button type="button" className={styles.btnPrimary} onClick={onClearFilters}>
              Limpiar filtros
            </button>
          </>
        ) : (
          <>
            <p className={styles.emptyTitle}>No hay tickets todavía</p>
            <p className={styles.emptyHint}>Creá el primer ticket para empezar a dar soporte.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <BulkActionBar
        selectedIds={selectedIds}
        onClear={() => setSelectedIds([])}
        assignees={users}
        statuses={statuses}
        onAssign={(ids, assigneeId) => runBulk(ids, id => assignTicket.mutateAsync({ id, assigneeId }), BULK_COPY.assign)}
        onChangeStatus={(ids, status) => runBulk(ids, id => updateStatus.mutateAsync({ id, status }), BULK_COPY.status)}
        onClose={(ids) => { const status = closedStatusName(); return runBulk(ids, id => updateStatus.mutateAsync({ id, status }), BULK_COPY.close); }}
        onDelete={(ids) => runBulk(ids, id => deleteTicket.mutateAsync(id), BULK_COPY.delete)}
      />

      <DataTable<Ticket>
        columns={columns}
        data={tickets}
        loading={loading}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyMessage="No hay tickets."
      />

      {toast && (
        <div className={styles.toast} role="status" aria-live="polite" aria-atomic="true">
          {toast}
        </div>
      )}
    </div>
  );
}
