import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { TaskDetailsTab } from './TaskDetailsTab';
import { TaskCommentsTimeline } from './TaskCommentsTimeline';
import { ComingSoonPanel } from './ComingSoonPanel';
import { TaskInventorySuggestions } from './TaskInventorySuggestions';
import { TaskMaterialConsumptions } from './TaskMaterialConsumptions';
import { TaskAuditFeed } from './TaskAuditFeed';
import { TaskActivityFeed } from './TaskActivityFeed';
import { Can } from '@/components/auth/Can';
import { useReturnsByTask } from '@/hooks/useReturns';
import { useServiceInstalledItems } from '@/hooks/useServiceInventory';
import { useRetireEquipment } from '@/hooks/useRetireEquipment';
import { RetireEquipmentModal } from './RetireEquipmentModal';
import type { TaskDetailsTabProps } from './TaskDetailsTab';
import type { ReturnSuggestionStatus } from '@/types/returns';
import styles from './TaskTabs.module.css';

export interface TaskTabsProps {
  detailsProps: TaskDetailsTabProps;
  commentsTaskId: string;
  reviewedByInventory: boolean;
  onInventoryToggle: (next: boolean) => void;
  /** Originating ticket id — from the enriched GET /scheduling/:id DTO
   *  (tickets-actions-be). Optional so existing callers + degraded mode work. */
  ticketId?: number | null;
  /** Snapshot of the originating ticket's subject. */
  ticketSubject?: string | null;
  /** ISO datetime when inventory review was done (F3 traceability). Optional for back-compat. */
  reviewedByInventoryAt?: string | null;
  /** Name of the user who marked the task as reviewed (F3 traceability). Optional for back-compat. */
  reviewedByInventoryUserName?: string | null;
  /** Contract id — threaded to InventoryPanel for precise cache invalidation (AD-12bis). Optional for back-compat. */
  contractId?: string | null;
  /**
   * IClass OS code — present when the task went through IClass closure.
   * Used to gate the by-task returns fetch: only tasks with an OS code can have
   * staged returns. Optional for back-compat with tasks that pre-date W4.
   */
  iclassOrderCode?: string | null;
  /**
   * Whether the task's project has manual equipment retirement enabled (#39).
   * When true + contractId present + inventory.write permission: shows "Retirar equipos" button.
   * Optional for back-compat with tasks from projects that pre-date #39.
   */
  projectAllowsRetirement?: boolean;
}

const TAB_IDS = {
  detalles: 'detalles',
  comentarios: 'comentarios',
  auditoriaIa: 'auditoria-ia',
  relacionado: 'relacionado',
  inventory: 'inventory',
  registroTrabajo: 'registro-trabajo',
  actividad: 'actividad',
} as const;

interface InventoryPanelProps {
  taskId: string;
  reviewedByInventory: boolean;
  onInventoryToggle: (next: boolean) => void;
  reviewedByInventoryAt?: string | null;
  reviewedByInventoryUserName?: string | null;
  contractId?: string | null;
  /** Gate for the by-task returns fetch. Truthy when the task has an IClass OS. */
  iclassOrderCode?: string | null;
  /** When true + contractId + inventory.write: shows the "Retirar equipos" button (#39). */
  projectAllowsRetirement?: boolean;
  /** Callback to surface success/error toasts to the parent page. */
  onToast?: (msg: string, type?: 'success' | 'error') => void;
}

const RETURN_STATUS_CONFIG: Record<ReturnSuggestionStatus, { label: string; variant: 'amber' | 'green' | 'gray' }> = {
  pending: { label: 'Devolución pendiente', variant: 'amber' },
  needs_review: { label: 'Devolución en revisión', variant: 'amber' },
  confirmed: { label: 'Devolución confirmada', variant: 'green' },
  discarded: { label: 'Devolución descartada', variant: 'gray' },
};

/** Relacionado tab content — shows the originating ticket when the task was
 *  created from one, otherwise an empty state. BE-graceful: when ticketId is
 *  absent (BE not deployed / standalone task), only the empty state renders. */
function RelacionadoPanel({ ticketId, ticketSubject }: { ticketId?: number | null; ticketSubject?: string | null }) {
  if (!ticketId) {
    return (
      <div className={styles.relEmptyState}>
        Esta tarea no está vinculada a ningún ticket.
      </div>
    );
  }
  return (
    <div className={styles.relCard}>
      <p className={styles.relCardTitle}>Creada desde ticket</p>
      <p className={styles.relCardRef}>
        <a href={`/admin/tickets/${ticketId}`} className={styles.relLink}>
          #{ticketId}
        </a>
        {ticketSubject ? ` — ${ticketSubject}` : ''}
      </p>
    </div>
  );
}

/** Maps retire error codes to human-readable Spanish messages. */
function mapRetireError(err: unknown): string {
  const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
  switch (code) {
    case 'PROJECT_NOT_RETIREMENT': return 'Proyecto no habilitado para retiro de equipos.';
    case 'TASK_HAS_NO_CONTRACT':   return 'La tarea no tiene un contrato asignado.';
    case 'EQUIPMENT_NOT_ON_CONTRACT': return 'El equipo no pertenece a este contrato.';
    case 'RETIRE_ALREADY_DONE':    return 'Ese equipo ya fue retirado al depósito.';
    default: return 'Error al retirar equipos. Intentá de nuevo.';
  }
}

function InventoryPanel({
  taskId,
  reviewedByInventory,
  onInventoryToggle,
  reviewedByInventoryAt,
  reviewedByInventoryUserName,
  contractId,
  iclassOrderCode,
  projectAllowsRetirement,
  onToast,
}: InventoryPanelProps) {
  const [retireOpen, setRetireOpen] = useState(false);
  const [retireMsg, setRetireMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Gate: only fetch returns when the task has an IClass OS (went through closure).
  // Tasks without an OS code can never have staged returns (W4 only stages on
  // RETIRO closure). This avoids a gratuitous 200-empty-array fetch on every task.
  const returnsEnabled = !!iclassOrderCode;
  const { data: taskReturns } = useReturnsByTask(taskId, returnsEnabled);

  // Retire feature: fetch active contract items for the picker (#39).
  // Enabled only when both gates (projectAllowsRetirement + contractId) are set.
  const retireGate = !!projectAllowsRetirement && !!contractId;
  const { data: installedItems = [] } = useServiceInstalledItems(
    contractId ?? undefined,
    retireGate,
  );
  const retire = useRetireEquipment(contractId);

  function showRetireMsg(text: string, type: 'success' | 'error') {
    setRetireMsg({ text, type });
    onToast?.(text, type);
    setTimeout(() => setRetireMsg(null), 5000);
  }

  async function handleRetireConfirm(itemIds: string[]) {
    try {
      const result = await retire.mutateAsync({ taskId, itemIds });
      setRetireOpen(false);
      const n = result.retired.length;
      showRetireMsg(`${n} equipo${n !== 1 ? 's' : ''} retirado${n !== 1 ? 's' : ''} al depósito`, 'success');
    } catch (err) {
      setRetireOpen(false);
      showRetireMsg(mapRetireError(err), 'error');
    }
  }
  // Format the review badge text when reviewed
  const reviewBadge = (() => {
    if (!reviewedByInventory) return null;
    const user = reviewedByInventoryUserName ?? '—';
    const dateStr = reviewedByInventoryAt
      ? new Date(reviewedByInventoryAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null;
    return dateStr ? `✓ Revisado · ${user} · ${dateStr}` : '✓ Revisado';
  })();

  return (
    <div className={styles.inventoryPanel}>
      {/* Retire equipment button — gated by projectAllowsRetirement + contractId + inventory.write */}
      {retireGate && (
        <Can permission="inventory.write">
          <div className={styles.retireRow}>
            <button
              type="button"
              className={styles.retireBtn}
              onClick={() => setRetireOpen(true)}
              disabled={retire.isPending}
            >
              Retirar equipos
            </button>
          </div>
          <RetireEquipmentModal
            open={retireOpen}
            items={installedItems}
            isPending={retire.isPending}
            onConfirm={handleRetireConfirm}
            onCancel={() => setRetireOpen(false)}
          />
        </Can>
      )}
      {/* Inline feedback after retire action */}
      {retireMsg && (
        <div
          className={retireMsg.type === 'success' ? styles.retireMsgSuccess : styles.retireMsgError}
          role="status"
          aria-live="polite"
          data-testid="retire-feedback"
        >
          {retireMsg.text}
        </div>
      )}
      <div className={styles.inventoryToggleRow}>
        {reviewedByInventory && reviewBadge ? (
          <div className={styles.inventoryReviewBadge} data-testid="inventory-review-badge">
            {reviewBadge}
            {/* Badge stays visible to everyone; only inventory.write can untoggle. */}
            <Can permission="inventory.write">
              <button
                type="button"
                className={styles.inventoryToggleBtn}
                onClick={() => onInventoryToggle(false)}
              >
                Desmarcar
              </button>
            </Can>
          </div>
        ) : (
          <Can permission="inventory.write">
            <label className={styles.inventoryToggleLabel}>
              <input
                type="checkbox"
                className={styles.inventoryCheckbox}
                checked={reviewedByInventory}
                onChange={(e) => onInventoryToggle(e.target.checked)}
              />
              <span>Revisado por inventario</span>
            </label>
          </Can>
        )}
      </div>
      {/* Return status pills — rendered only when the task has an OS (iclassOrderCode)
          AND the BE returned at least one return suggestion for this task.
          Each unique status in the result gets one pill (there can be multiple
          returns with different statuses). Zero noise when no suggestions exist. */}
      {taskReturns && taskReturns.length > 0 && (
        <div className={styles.returnPillRow} data-testid="return-pill-row">
          {[...new Set(taskReturns.map(r => r.status))].map(status => {
            const cfg = RETURN_STATUS_CONFIG[status];
            return (
              <span
                key={status}
                className={`${styles.returnPill} ${styles[`returnPill${cfg.variant}`]}`}
                data-testid={`return-pill-${status}`}
              >
                {cfg.label}
              </span>
            );
          })}
          <Link
            to="/admin/inventory/returns"
            className={styles.returnLink}
            data-testid="return-link"
          >
            Ver en Devoluciones
          </Link>
        </div>
      )}
      <TaskInventorySuggestions taskId={taskId} contractId={contractId ?? undefined} />
      <TaskMaterialConsumptions taskId={taskId} />
    </div>
  );
}

export function TaskTabs({
  detailsProps,
  commentsTaskId,
  reviewedByInventory,
  onInventoryToggle,
  ticketId,
  ticketSubject,
  reviewedByInventoryAt,
  reviewedByInventoryUserName,
  contractId,
  iclassOrderCode,
  projectAllowsRetirement,
}: TaskTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(TAB_IDS.detalles);
  const [mountedIds, setMountedIds] = useState<Set<string>>(
    new Set([TAB_IDS.detalles]),
  );

  function handleTabChange(id: string) {
    setActiveTab(id);
    setMountedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  const tabs = [
    {
      id: TAB_IDS.detalles,
      label: 'Detalles',
      content: <TaskDetailsTab {...detailsProps} />,
    },
    {
      id: TAB_IDS.comentarios,
      label: 'Comentarios',
      content: <TaskCommentsTimeline taskId={commentsTaskId} />,
    },
    {
      id: TAB_IDS.auditoriaIa,
      label: 'Auditoría IA',
      content: (
        <Can
          permission="scheduling.read"
          fallback={<div className={styles.relEmptyState}>Sin permiso para ver la auditoría.</div>}
        >
          <TaskAuditFeed taskId={commentsTaskId} />
        </Can>
      ),
    },
    {
      id: TAB_IDS.relacionado,
      label: 'Relacionado',
      content: <RelacionadoPanel ticketId={ticketId} ticketSubject={ticketSubject} />,
    },
    {
      id: TAB_IDS.inventory,
      label: 'Inventory',
      content: (
        <InventoryPanel
          taskId={commentsTaskId}
          reviewedByInventory={reviewedByInventory}
          onInventoryToggle={onInventoryToggle}
          reviewedByInventoryAt={reviewedByInventoryAt}
          reviewedByInventoryUserName={reviewedByInventoryUserName}
          contractId={contractId}
          iclassOrderCode={iclassOrderCode}
          projectAllowsRetirement={projectAllowsRetirement}
        />
      ),
    },
    {
      id: TAB_IDS.registroTrabajo,
      label: 'Registro de trabajo',
      content: (
        <ComingSoonPanel
          title="Registro de trabajo"
          description="Registrá el tiempo y las actividades de trabajo. Próximamente."
        />
      ),
    },
    {
      id: TAB_IDS.actividad,
      label: 'Actividad',
      content: (
        <Can permission="scheduling.read" fallback={<p>Sin permiso para ver la actividad.</p>}>
          <TaskActivityFeed taskId={commentsTaskId} />
        </Can>
      ),
    },
  ];

  return (
    <div className={styles.root}>
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        mountMode="lazy"
        mountedIds={mountedIds}
        size="compact"
      />
    </div>
  );
}
