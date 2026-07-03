import { useState, useRef } from 'react';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useAssignableOperators } from '@/hooks/useAssignableOperators';
import { useRecaptacionLeads, useIngestChurned, useAssignBulk, useAssignLead } from '@/hooks/useRecaptacion';
import { RECAPTURE_STATUS_LABELS, RECAPTURE_TECHNOLOGY_CATALOG } from '@/types/recaptacion';
import type { RecaptureLeadDto, RecaptureLeadStatus, RecaptureLeadSource } from '@/types/recaptacion';
import { RecaptacionTableView } from './RecaptacionPage/components/RecaptacionTableView';
import { LeadDetailDrawer } from './RecaptacionPage/components/LeadDetailDrawer';
import { ImportCsvModal } from './RecaptacionPage/components/ImportCsvModal';
import { BulkAssignToolbar } from './RecaptacionPage/components/BulkAssignToolbar';
import { useRecaptacionFilterUrl } from './RecaptacionPage/hooks/useRecaptacionFilterUrl';
import styles from './RecaptacionPage.module.css';

// ── Source tabs ───────────────────────────────────────────────────────────────

const SOURCE_TABS: Array<{ source: RecaptureLeadSource; label: string }> = [
  { source: 'churned_client', label: 'Bajas' },
  { source: 'csv',            label: 'CSV' },
];

// ── Page component ───────────────────────────────────────────────────────────

const LIMIT = 25;

/** Filter options for the status select in the FilterBar */
const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  ...Object.entries(RECAPTURE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

/** Filter options for the technology select — catalog values + "Todas". */
const TECHNOLOGY_OPTIONS = [
  { value: '', label: 'Todas las tecnologías' },
  ...RECAPTURE_TECHNOLOGY_CATALOG.map((t) => ({ value: t, label: t })),
];

export default function RecaptacionPage() {
  const { can } = useMyPermissions();
  // Admin assignment capability: drives the entire admin-only surface on this
  // page (multi-select, bulk toolbar, ingest, CSV, assignment filter).
  const canAssign = can('recapture.assign');

  const [page, setPage] = useState(1);
  const { filter, setFilter, clearFilter } = useRecaptacionFilterUrl();
  const [selectedLead, setSelectedLead] = useState<RecaptureLeadDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Id of the lead whose inline single-assign is in flight (disables that row's select).
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; variant: 'success' | 'error' } | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Source tab: default to 'churned_client' when not set in URL
  const activeSource: RecaptureLeadSource = filter.source ?? 'churned_client';

  const ingestChurned = useIngestChurned();
  const assignBulk = useAssignBulk();
  // Single-assign from the inline column — same hook the detail drawer uses.
  const assignLead = useAssignLead();
  // Operator pool — single source of truth shared by ALL three assignee selects
  // (inline column, bulk toolbar, LeadDetailDrawer). Restricted to ACTIVE users
  // WITH ≥1 role and NONE technical (`tecnico`); gated by `canAssign` so a plain
  // agent (who lacks the admin/rbac permission GET /admin/rbac/users requires)
  // never fires it. A lead already assigned to someone outside this pool keeps
  // showing their name via the InlineAssignSelect phantom option (intentional).
  const { operators } = useAssignableOperators(canAssign);

  const query = {
    status:     (filter.status || undefined) as RecaptureLeadStatus | undefined,
    source:     activeSource,
    assigneeId: filter.assigneeId,
    unassigned: filter.unassigned,
    technology: filter.technology,
    page,
    limit: LIMIT,
  };

  // The list refreshes itself: useAssignLead / useAssignBulk / filters all
  // invalidate the ['recaptacion'] query, so an explicit reload button is moot.
  const { data, isLoading } = useRecaptacionLeads(query);

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  const hasActiveFilters =
    !!filter.status || !!filter.assigneeId || !!filter.unassigned || !!filter.technology;

  function showToast(msg: string, variant: 'success' | 'error' = 'success') {
    setToast({ msg, variant });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  async function handleIngestChurned() {
    const { created, skipped } = await ingestChurned.mutateAsync();
    showToast(`${created} leads creados, ${skipped} ya existían.`);
  }

  async function handleBulkAssign(operatorId: string | null) {
    const requested = selectedIds.length;
    try {
      const { assigned } = await assignBulk.mutateAsync({ leadIds: selectedIds, operatorId });
      const noun = operatorId === null ? 'desasignados' : 'asignados';
      const msg = assigned === requested
        ? `${assigned} leads ${noun} correctamente.`
        : `${assigned} de ${requested} leads ${noun}.`;
      showToast(msg);
      // Only clear on success; on error keep the selection so the admin can retry.
      setSelectedIds([]);
    } catch {
      showToast('No se pudo completar la asignación. Intentá nuevamente.', 'error');
    }
  }

  // Single-assign from the inline column. Mirrors handleBulkAssign: try/catch +
  // toast. `assigningId` drives the per-row pending state in the table.
  async function handleAssignSingle(leadId: string, operatorId: string | null) {
    setAssigningId(leadId);
    try {
      await assignLead.mutateAsync({ leadId, operatorId });
      showToast(operatorId === null ? 'Lead desasignado.' : 'Lead asignado correctamente.');
    } catch {
      showToast('No se pudo asignar el lead. Intentá nuevamente.', 'error');
    } finally {
      setAssigningId(null);
    }
  }

  function handleFilterChange(key: string, value: string) {
    setPage(1);
    setSelectedIds([]); // selection is scoped to the current view
    if (key === 'status') {
      setFilter({ status: (value as RecaptureLeadStatus) || undefined });
    } else if (key === 'unassigned') {
      setFilter({ unassigned: value === 'true' ? true : undefined });
    } else if (key === 'technology') {
      setFilter({ technology: value || undefined });
    }
  }

  function handleSearch(_value: string) {
    // The recaptacion API doesn't support full-text search; no-op for now.
  }

  // Filters: status is shown to everyone; the assignment filter is admin-only.
  const filters = [
    {
      key: 'status',
      label: 'Estado',
      options: STATUS_OPTIONS,
    },
    {
      key: 'technology',
      label: 'Tecnología',
      options: TECHNOLOGY_OPTIONS,
    },
    ...(canAssign
      ? [{
          key: 'unassigned',
          label: 'Asignación',
          options: [
            { value: '', label: 'Todos' },
            { value: 'true', label: 'Sin asignar' },
          ],
        }]
      : []),
  ];

  return (
    <div className={styles.page}>
      {/* Header row */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>CRM /</span>
          <h1 className={styles.title}>Recaptación</h1>
        </div>
        <div className={styles.headerRight}>
          <Can permission="recapture.assign">
            <Button
              variant="secondary"
              loading={ingestChurned.isPending}
              onClick={() => void handleIngestChurned()}
            >
              Ingestar bajas
            </Button>
            <Button
              variant="secondary"
              onClick={() => setImportModalOpen(true)}
            >
              Importar CSV
            </Button>
          </Can>
        </div>
      </div>

      {/* Source tabs — Bajas vs CSV */}
      <div className={styles.sourceTabs}>
        {SOURCE_TABS.map(({ source, label }) => (
          <button
            key={source}
            type="button"
            aria-pressed={activeSource === source}
            className={activeSource === source ? styles.sourceTabActive : styles.sourceTab}
            onClick={() => { setPage(1); setSelectedIds([]); setFilter({ source }); }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* FilterBar — status select (all) + assignment filter (admin only) */}
      <FilterBar
        onSearch={handleSearch}
        searchPlaceholder="Buscar lead…"
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Bulk-assign toolbar — admin only, when at least one lead is selected.
          When nothing is selected, a subtle hint surfaces BOTH assign paths. */}
      {canAssign && selectedIds.length > 0 ? (
        <BulkAssignToolbar
          count={selectedIds.length}
          operators={operators}
          pending={assignBulk.isPending}
          onAssign={(operatorId) => void handleBulkAssign(operatorId)}
          onClear={() => setSelectedIds([])}
        />
      ) : canAssign ? (
        <p className={styles.assignHint} role="note">
          Marcá leads con los checkbox para asignarlos en lote, o asignalos uno por uno
          desde la columna <strong>Asignado</strong>.
        </p>
      ) : null}

      {/* Table + pagination */}
      <div className={styles.tableSection}>
        <RecaptacionTableView
          leads={data?.data ?? []}
          loading={isLoading}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={() => { setPage(1); setSelectedIds([]); clearFilter(); }}
          onRowClick={(lead) => setSelectedLead(lead)}
          selectable={canAssign}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          canAssign={canAssign}
          operators={operators}
          onAssign={(leadId, operatorId) => void handleAssignSingle(leadId, operatorId)}
          assigningId={assigningId}
        />
        {(data?.data?.length ?? 0) > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => { setSelectedIds([]); setPage(p); }}
          />
        )}
      </div>

      {/* Lead detail drawer */}
      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}

      {/* Import CSV modal */}
      <ImportCsvModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={({ created, errors }) => {
          const msg = errors.length > 0
            ? `${created} leads importados. ${errors.length} errores.`
            : `${created} leads importados correctamente.`;
          showToast(msg);
        }}
      />

      {/* Toast */}
      {toast && (
        <div
          className={toast.variant === 'error' ? styles.toastError : styles.toastSuccess}
          role={toast.variant === 'error' ? 'alert' : 'status'}
          aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
