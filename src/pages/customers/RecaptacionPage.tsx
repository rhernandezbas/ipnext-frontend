import { useState, useRef } from 'react';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useRecaptacionLeads, useIngestChurned, useAssignBulk } from '@/hooks/useRecaptacion';
import { RECAPTURE_STATUS_LABELS } from '@/types/recaptacion';
import type { RecaptureLeadDto, RecaptureLeadStatus, RecaptureLeadSource } from '@/types/recaptacion';
import { RecaptacionTableView } from './RecaptacionPage/components/RecaptacionTableView';
import { LeadDetailDrawer } from './RecaptacionPage/components/LeadDetailDrawer';
import { ImportCsvModal } from './RecaptacionPage/components/ImportCsvModal';
import { BulkAssignToolbar } from './RecaptacionPage/components/BulkAssignToolbar';
import { useRecaptacionFilterUrl } from './RecaptacionPage/hooks/useRecaptacionFilterUrl';
import styles from './RecaptacionPage.module.css';

// ── SVG icons ────────────────────────────────────────────────────────────────

function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

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

export default function RecaptacionPage() {
  const { can } = useMyPermissions();
  // Admin assignment capability: drives the entire admin-only surface on this
  // page (multi-select, bulk toolbar, ingest, CSV, assignment filter).
  const canAssign = can('recapture.assign');

  const [page, setPage] = useState(1);
  const { filter, setFilter, clearFilter } = useRecaptacionFilterUrl();
  const [selectedLead, setSelectedLead] = useState<RecaptureLeadDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; variant: 'success' | 'error' } | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Source tab: default to 'churned_client' when not set in URL
  const activeSource: RecaptureLeadSource = filter.source ?? 'churned_client';

  const ingestChurned = useIngestChurned();
  const assignBulk = useAssignBulk();
  // Operator candidates for bulk assign — same pool as the single-assign select.
  // These are RbacUsers (the BE validates `operatorId` against `RbacUser`, NOT
  // the `Admin` table). Gated by `canAssign` so a plain agent — who lacks the
  // admin/rbac permission GET /admin/rbac/users requires — never fires it.
  const { data: rbacUsers = [] } = useRbacUsers(canAssign);
  const operators = rbacUsers.map((u) => ({ id: u.id, name: u.name }));

  const query = {
    status:     (filter.status || undefined) as RecaptureLeadStatus | undefined,
    source:     activeSource,
    assigneeId: filter.assigneeId,
    unassigned: filter.unassigned,
    page,
    limit: LIMIT,
  };

  const { data, isLoading, refetch } = useRecaptacionLeads(query);

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  const hasActiveFilters =
    !!filter.status || !!filter.assigneeId || !!filter.unassigned;

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

  function handleFilterChange(key: string, value: string) {
    setPage(1);
    setSelectedIds([]); // selection is scoped to the current view
    if (key === 'status') {
      setFilter({ status: (value as RecaptureLeadStatus) || undefined });
    } else if (key === 'unassigned') {
      setFilter({ unassigned: value === 'true' ? true : undefined });
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
          <Button
            variant="icon"
            title="Recargar"
            onClick={() => void refetch()}
            aria-label="Recargar"
          >
            <IconRefresh />
          </Button>
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

      {/* Bulk-assign toolbar — admin only, when at least one lead is selected */}
      {canAssign && selectedIds.length > 0 && (
        <BulkAssignToolbar
          count={selectedIds.length}
          operators={operators}
          pending={assignBulk.isPending}
          onAssign={(operatorId) => void handleBulkAssign(operatorId)}
          onClear={() => setSelectedIds([])}
        />
      )}

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
