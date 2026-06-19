import { useState, useMemo, Fragment } from 'react';
import { Can } from '@/components/auth/Can';
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from '@/hooks/usePlans';
import { useConfirm } from '@/context/ConfirmContext';
import type { PlanDto, PlanCategory, CreatePlanDto, UpdatePlanDto } from '@/types/plans';
import styles from './PlansPage.module.css';

// ─── Formatting utils ───────────────────────────────────────────────────────

/** Format kbps to human-readable. >=1000 kbps → Mbps, else kbps. */
function fmtKbps(kbps: number): { value: string; unit: string } {
  if (kbps >= 1000) {
    const mbps = kbps / 1000;
    return { value: Number.isInteger(mbps) ? String(mbps) : mbps.toFixed(1), unit: 'Mbps' };
  }
  return { value: String(kbps), unit: 'kbps' };
}

/** Convert Mbps input string to kbps. Supports sub-Mbps like "0.256" or "256k". */
function mbpsInputToKbps(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const val = parseFloat(trimmed);
  if (isNaN(val) || val <= 0) return null;
  return Math.round(val * 1000);
}

/** Format kbps to Mbps string for input fields. */
function kbpsToMbpsStr(kbps: number): string {
  const mbps = kbps / 1000;
  return Number.isInteger(mbps) ? String(mbps) : mbps.toFixed(3).replace(/0+$/, '');
}

const CAT_LABEL: Record<PlanCategory, string> = {
  Air: 'Air',
  Alta: 'Alta gama',
  Corte: 'Corte',
};

const CAT_STYLE: Record<PlanCategory, string> = {
  Air: styles.catAir,
  Alta: styles.catAlta,
  Corte: styles.catCorte,
};

const CATEGORIES: PlanCategory[] = ['Air', 'Alta', 'Corte'];

function CategoryBadge({ category }: { category: PlanCategory }) {
  return (
    <span className={`${styles.catBadge} ${CAT_STYLE[category]}`}>
      {CAT_LABEL[category]}
    </span>
  );
}

function SpeedCell({ kbps }: { kbps: number }) {
  const { value, unit } = fmtKbps(kbps);
  return (
    <span className={styles.speedValue}>
      {value}<span className={styles.speedUnit}>{unit}</span>
    </span>
  );
}

// ─── KPI helpers ─────────────────────────────────────────────────────────────

interface KpiData {
  total: number;
  rangeMin: number;
  rangeMax: number;
  cutCount: number;
}

function computeKpis(plans: PlanDto[]): KpiData {
  const active = plans.filter(p => p.status === 'active');
  const real = active.filter(p => p.category !== 'Corte').map(p => p.downloadKbps);
  const cut = active.filter(p => p.category === 'Corte');
  return {
    total: active.length,
    rangeMin: real.length ? Math.min(...real) : 0,
    rangeMax: real.length ? Math.max(...real) : 0,
    cutCount: cut.length,
  };
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onSubmit: (data: CreatePlanDto) => void;
  isLoading: boolean;
  apiError: string | null;
}

function CreatePlanModal({ onClose, onSubmit, isLoading, apiError }: CreateModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlanCategory>('Air');
  const [downloadStr, setDownloadStr] = useState('');
  const [uploadStr, setUploadStr] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const downloadKbps = mbpsInputToKbps(downloadStr);
    const uploadKbps = mbpsInputToKbps(uploadStr);
    if (downloadKbps === null || uploadKbps === null) {
      setValidationError('Bajada y Subida deben ser números positivos en Mbps (ej: 30, 0.256).');
      return;
    }
    setValidationError(null);
    onSubmit({ code: code.trim(), name: name.trim(), category, downloadKbps, uploadKbps });
  }

  const error = validationError ?? apiError;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="create-plan-title">
      <div className={styles.modal}>
        <h2 id="create-plan-title" className={styles.modalTitle}>Nuevo plan</h2>
        {error && <div className={styles.formError} role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="plan-code">Código (RADIUS)</label>
            <input
              id="plan-code"
              type="text"
              className={styles.inputMono}
              placeholder="IP-Air-30-10"
              value={code}
              onChange={e => setCode(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="plan-name">Nombre</label>
            <input
              id="plan-name"
              type="text"
              placeholder="IP-Air-30-10"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="plan-category">Categoría</label>
            <select
              id="plan-category"
              value={category}
              onChange={e => setCategory(e.target.value as PlanCategory)}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{CAT_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="plan-down">Bajada (Mbps)</label>
              <input
                id="plan-down"
                type="number"
                step="0.001"
                min="0.001"
                placeholder="30"
                value={downloadStr}
                onChange={e => setDownloadStr(e.target.value)}
                required
              />
              <span className={styles.formHint}>ej: 30 = 30 Mbps, 0.256 = 256 kbps</span>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="plan-up">Subida (Mbps)</label>
              <input
                id="plan-up"
                type="number"
                step="0.001"
                min="0.001"
                placeholder="10"
                value={uploadStr}
                onChange={e => setUploadStr(e.target.value)}
                required
              />
            </div>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
              {isLoading ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

interface EditModalProps {
  plan: PlanDto;
  onClose: () => void;
  onSubmit: (data: UpdatePlanDto) => void;
  isLoading: boolean;
  apiError: string | null;
}

function EditPlanModal({ plan, onClose, onSubmit, isLoading, apiError }: EditModalProps) {
  const [name, setName] = useState(plan.name);
  const [category, setCategory] = useState<PlanCategory>(plan.category);
  const [downloadStr, setDownloadStr] = useState(kbpsToMbpsStr(plan.downloadKbps));
  const [uploadStr, setUploadStr] = useState(kbpsToMbpsStr(plan.uploadKbps));
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const downloadKbps = mbpsInputToKbps(downloadStr);
    const uploadKbps = mbpsInputToKbps(uploadStr);
    if (downloadKbps === null || uploadKbps === null) {
      setValidationError('Bajada y Subida deben ser números positivos en Mbps.');
      return;
    }
    setValidationError(null);
    onSubmit({ name: name.trim(), category, downloadKbps, uploadKbps });
  }

  const error = validationError ?? apiError;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="edit-plan-title">
      <div className={styles.modal}>
        <h2 id="edit-plan-title" className={styles.modalTitle}>Editar plan</h2>
        {error && <div className={styles.formError} role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Código (RADIUS)</label>
            <div className={styles.codeReadonly}>{plan.code}</div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-plan-name">Nombre</label>
            <input
              id="edit-plan-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-plan-category">Categoría</label>
            <select
              id="edit-plan-category"
              value={category}
              onChange={e => setCategory(e.target.value as PlanCategory)}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{CAT_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-plan-down">Bajada (Mbps)</label>
              <input
                id="edit-plan-down"
                type="number"
                step="0.001"
                min="0.001"
                value={downloadStr}
                onChange={e => setDownloadStr(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-plan-up">Subida (Mbps)</label>
              <input
                id="edit-plan-up"
                type="number"
                step="0.001"
                min="0.001"
                value={uploadStr}
                onChange={e => setUploadStr(e.target.value)}
                required
              />
            </div>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
              {isLoading ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

interface PlansTableProps {
  plans: PlanDto[];
  loading: boolean;
  onEdit: (plan: PlanDto) => void;
  onDelete: (plan: PlanDto) => void;
}

function PlansTable({ plans, loading, onEdit, onDelete }: PlansTableProps) {
  if (loading) {
    return (
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Categoría</th>
              <th className={styles.thNum}>Bajada</th>
              <th className={styles.thNum}>Subida</th>
              <th>Rate-limit (RADIUS)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                {[...Array(6)].map((_, j) => (
                  <td key={j}><span className={styles.skeleton} style={{ width: '80%' }}>&nbsp;</span></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Categoría</th>
              <th className={styles.thNum}>Bajada</th>
              <th className={styles.thNum}>Subida</th>
              <th>Rate-limit (RADIUS)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr className={styles.emptyRow}>
              <td colSpan={6}>No se encontraron planes.</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Group by category: Air → Alta → Corte
  const grouped = CATEGORIES.map(cat => ({
    cat,
    items: plans.filter(p => p.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div className={styles.tableCard}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Categoría</th>
            <th className={styles.thNum}>Bajada</th>
            <th className={styles.thNum}>Subida</th>
            <th>Rate-limit (RADIUS)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ cat, items }) => (
            <Fragment key={`grp-${cat}`}>
              <tr className={styles.groupRow}>
                <td colSpan={6}>{CAT_LABEL[cat]}</td>
              </tr>
              {items.map(plan => (
                <tr key={plan.id}>
                  <td><span className={styles.planCode}>{plan.code}</span></td>
                  <td><CategoryBadge category={plan.category} /></td>
                  <td className={styles.tdNum}><SpeedCell kbps={plan.downloadKbps} /></td>
                  <td className={styles.tdNum}><SpeedCell kbps={plan.uploadKbps} /></td>
                  <td><span className={styles.rateLimitChip}>{plan.rateLimit}</span></td>
                  <td className={styles.tdActions}>
                    <Can permission="plan.manage">
                      <button
                        className={styles.btnEdit}
                        onClick={() => onEdit(plan)}
                        aria-label={`Editar ${plan.code}`}
                      >
                        Editar
                      </button>
                      <button
                        className={styles.btnDelete}
                        onClick={() => onDelete(plan)}
                        aria-label={`Eliminar ${plan.code}`}
                      >
                        Eliminar
                      </button>
                    </Can>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Axios error helper ───────────────────────────────────────────────────────

function extractApiError(err: unknown): string {
  if (
    typeof err === 'object' && err !== null &&
    'response' in err
  ) {
    // BE contract:
    //   409 → { code: string; error: string }
    //   422 → { code: 'VALIDATION_ERROR'; details: { message: string; path: string[] }[] }
    const res = (err as {
      response?: {
        status?: number;
        data?: {
          code?: string;
          error?: string;
          message?: string;
          details?: { message: string; path?: string[] }[];
        };
      };
    }).response;
    if (res?.status === 409) {
      return 'Ya existe un plan con ese código. Usá un código diferente.';
    }
    if (res?.status === 422 || res?.status === 400) {
      // Read details[0].message first (BE real contract), fall back to error/message
      const firstDetail = res?.data?.details?.[0]?.message;
      return (
        firstDetail ??
        res?.data?.error ??
        res?.data?.message ??
        'Los datos ingresados no son válidos. Revisá los campos.'
      );
    }
  }
  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PlansPage() {
  const { data: plans = [], isLoading, isError: isPlansError, refetch: refetchPlans } = usePlans();
  const { mutate: createPlan, isPending: isCreating, error: createError, reset: resetCreate } = useCreatePlan();
  const { mutate: updatePlan, isPending: isUpdating, error: updateError, reset: resetUpdate } = useUpdatePlan();
  const { mutate: deletePlan, error: deleteError } = useDeletePlan();

  const confirm = useConfirm();

  const [showCreate, setShowCreate] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanDto | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PlanCategory | 'all'>('all');

  // Filter plans
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const catOk = categoryFilter === 'all' || p.category === categoryFilter;
      const q = query.toLowerCase();
      const queryOk = !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
      return catOk && queryOk;
    });
  }, [plans, query, categoryFilter]);

  const kpis = useMemo(() => computeKpis(plans), [plans]);
  const { value: rangeMinVal, unit: rangeMinUnit } = fmtKbps(kpis.rangeMin);
  const { value: rangeMaxVal } = fmtKbps(kpis.rangeMax);

  function catCount(cat: PlanCategory | 'all') {
    if (cat === 'all') return plans.length;
    return plans.filter(p => p.category === cat).length;
  }

  function handleCreate(data: CreatePlanDto) {
    createPlan(data, {
      onSuccess: () => {
        setShowCreate(false);
        resetCreate();
      },
    });
  }

  function handleUpdate(data: UpdatePlanDto) {
    if (!editingPlan) return;
    updatePlan({ id: editingPlan.id, data }, {
      onSuccess: () => {
        setEditingPlan(null);
        resetUpdate();
      },
    });
  }

  async function handleDelete(plan: PlanDto) {
    const ok = await confirm({
      message: `¿Eliminar el plan "${plan.code}"? Esta acción no se puede deshacer.`,
      tone: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (ok) deletePlan(plan.id);
  }

  const createApiError = createError ? extractApiError(createError) : null;
  const updateApiError = updateError ? extractApiError(updateError) : null;
  const deleteApiError = deleteError ? extractApiError(deleteError) : null;

  return (
    <div className={styles.page}>
      {/* Delete error toast */}
      {deleteApiError && (
        <div role="alert" className={styles.formError}>
          Error al eliminar: {deleteApiError}
        </div>
      )}
      {/* Banner */}
      <div className={styles.banner} role="note">
        <span className={styles.bannerIcon} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </span>
        <p className={styles.bannerText}>
          <span className={styles.bannerBold}>Fuente única de velocidades.</span>{' '}
          Lo que definas acá, el RADIUS lo aplica a{' '}
          <span className={styles.bannerBold}>todos los routers por igual</span>{' '}
          — sin tocar ningún MikroTik. Los perfiles locales quedan legacy.
          Para cambiarle el plan a un cliente, lo elegís en su panel de Internet.
        </p>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Catálogo de Planes</h1>
          <p className={styles.subtitle}>
            Las velocidades que ofrecés, en un solo lugar. El rate-limit del RADIUS se genera solo.
          </p>
        </div>
        <Can permission="plan.manage">
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuevo plan
          </button>
        </Can>
      </div>

      {/* KPIs */}
      <div className={styles.kpis}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Planes activos</div>
          <div className={styles.kpiValue}>{isLoading ? '—' : kpis.total}</div>
          <div className={styles.kpiSub}>en el catálogo</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Rango</div>
          <div className={styles.kpiValue}>
            {isLoading ? '—' : (
              kpis.rangeMin === 0 ? '—' : `${rangeMinVal}–${rangeMaxVal}`
            )}
            {!isLoading && kpis.rangeMin > 0 && (
              <span className={styles.kpiUnit}> {rangeMinUnit}</span>
            )}
          </div>
          <div className={styles.kpiSub}>de bajada</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Perfiles de corte</div>
          <div className={`${styles.kpiValue} ${styles.kpiValueCut}`}>
            {isLoading ? '—' : kpis.cutCount}
          </div>
          <div className={styles.kpiSub}>reducción / baja</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar plan… (ej. Air, Pro, 1000)"
            aria-label="Buscar plan"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className={styles.chips}>
          {(['all', ...CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              className={`${styles.chip} ${categoryFilter === cat ? styles.chipActive : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === 'all' ? 'Todos' : CAT_LABEL[cat]}
              <span className={styles.chipCount}>{catCount(cat)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {isPlansError && (
        <div className={styles.tableCard} role="alert">
          <p>No se pudo cargar el catálogo de planes. Verificá tu conexión e intentá de nuevo.</p>
          <button className={styles.btnSecondary} onClick={() => refetchPlans()}>
            Reintentar
          </button>
        </div>
      )}

      {/* Table */}
      {!isPlansError && (
        <PlansTable
          plans={filteredPlans}
          loading={isLoading}
          onEdit={setEditingPlan}
          onDelete={handleDelete}
        />
      )}

      {/* Modals */}
      {showCreate && (
        <CreatePlanModal
          onClose={() => { setShowCreate(false); resetCreate(); }}
          onSubmit={handleCreate}
          isLoading={isCreating}
          apiError={createApiError}
        />
      )}
      {editingPlan && (
        <EditPlanModal
          plan={editingPlan}
          onClose={() => { setEditingPlan(null); resetUpdate(); }}
          onSubmit={handleUpdate}
          isLoading={isUpdating}
          apiError={updateApiError}
        />
      )}
    </div>
  );
}
