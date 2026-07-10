import { useId, useState, useEffect } from 'react';
import { Can } from '@/components/auth/Can';
import { ServiceRemovalReasonModal } from '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal';
import { TransferServiceModal } from '@/components/molecules/TransferServiceModal/TransferServiceModal';
import {
  useContractPppoe,
  useCreatePppoe,
  useUpdatePppoe,
  useMovePppoe,
  useDeactivatePppoe,
  useDeassociatePppoe,
  useUnassignedPppoe,
  useAssociatePppoe,
  usePppoeCredentials,
  useEnforcePppoeForContract,
  usePppoeCallerId,
} from '@/hooks/usePppoe';
import type { EnforcementAction } from '@/types/pppoe';
import { usePlans } from '@/hooks/usePlans';
import { isEligiblePlan } from '@/utils/plans';

import { useNasServers, useNextFreeIp } from '@/hooks/useNas';
import { mapPppoeMoveError } from '@/utils/mapPppoeMoveError';
import type { IpType } from '@/api/nas.api';
import type { ContractService } from '@/types/customer';
import type { PppoeServiceDto } from '@/types/pppoe';
import styles from './InternetPanel.module.css';

interface InternetPanelProps {
  contractId: string;
  clientId: string | number;
  /**
   * service-transfer W4 — nombre del cliente para la confirmación de-quién-a-quién
   * del modal de transferencia. Opcional: sin él, el modal degrada a "este cliente".
   */
  customerName?: string | null;
  contractServices: ContractService[];
  onClose: () => void;
}

/** Read the HTTP status from an axios error, if present. */
function errorStatus(err: unknown): number | null {
  const e = err as { response?: { status?: number } };
  return e?.response?.status ?? null;
}

/**
 * PPPoE management panel for the INTERNET service of a contract.
 * Opened from ContractCard when the operator clicks the INTERNET chip or
 * picks Internet from the service picker.
 */
export function InternetPanel({ contractId, clientId, customerName, contractServices: _contractServices, onClose }: InternetPanelProps) {
  const pppoeQuery = useContractPppoe(contractId);
  const { data: nasServers = [] } = useNasServers();
  // Resultado terminal de la baja: 'full' (corte + historial) | 'partial' (corte OK, historial no).
  const [bajaOutcome, setBajaOutcome] = useState<null | 'full' | 'partial'>(null);

  // service-transfer W4 — el modal de transferencia vive ACÁ (parent) con un
  // SNAPSHOT del DTO: al completarse, la invalidación de ['contract-pppoe'] deja
  // el contrato sin PPPoE activo y ActivePppoeView se desmonta — el resultado
  // del transfer debe sobrevivir ese flip (mismo racional que el C1 de TV).
  const [transferPppoe, setTransferPppoe] = useState<PppoeServiceDto | null>(null);

  const activePppoe = (pppoeQuery.data ?? []).find((p) => p.status === 'enabled') ?? null;

  let body: React.ReactNode;

  if (bajaOutcome) {
    body = (
      <div className={styles.section}>
        <div
          className={`${styles.banner} ${bajaOutcome === 'full' ? styles.bannerSuccess : styles.bannerWarning}`}
          role="status"
        >
          <span>
            {bajaOutcome === 'full'
              ? 'Servicio de internet dado de baja: PPPoE cortado en el router y baja registrada en el historial.'
              : 'PPPoE cortado en el router. No se pudo registrar el motivo en el historial — registralo a mano desde el historial del contrato.'}
          </span>
        </div>
        <div className={styles.formActions}>
          <button type="button" className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    );
  } else if (pppoeQuery.isLoading) {
    body = <p className={styles.loading}>Cargando…</p>;
  } else if (pppoeQuery.isError) {
    body = (
      <div className={`${styles.banner} ${styles.bannerError}`}>
        <span>No se pudo cargar el PPPoE. Reintentá en unos segundos.</span>
      </div>
    );
  } else if (activePppoe) {
    body = (
      <ActivePppoeView
        contractId={contractId}
        clientId={clientId}
        pppoe={activePppoe}
        nasServers={nasServers}
        onBaja={setBajaOutcome}
        onRequestTransfer={setTransferPppoe}
      />
    );
  } else {
    body = (
      <Can
        permission="pppoe.manage"
        fallback={
          <div className={`${styles.banner} ${styles.bannerWarning}`}>
            <span>Sin PPPoE activo. No tenés permiso para cargar uno.</span>
          </div>
        }
      >
        <div className={styles.section}>
          <CollapsibleSection title="Asociar PPPoE existente">
            <AssociatePppoeSection contractId={contractId} clientId={clientId} />
          </CollapsibleSection>
          <CollapsibleSection title="Cargar PPPoE">
            <CreatePppoeForm
              contractId={contractId}
              clientId={clientId}
              nasServers={nasServers}
            />
          </CollapsibleSection>
        </div>
      </Can>
    );
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="internet-panel-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 id="internet-panel-title" className={styles.panelTitle}>
            Internet — PPPoE
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className={styles.panelBody}>
          {body}
        </div>
      </div>

      {/* service-transfer W4 — transferir el PPPoE a otro cliente. En el parent
          (con snapshot del DTO) para sobrevivir el flip post-transfer. */}
      {transferPppoe && (
        <TransferServiceModal
          variant={{ kind: 'pppoe', pppoe: transferPppoe, nasServers }}
          sourceClientId={String(clientId)}
          sourceClientName={customerName ?? null}
          sourceContractId={contractId}
          onClose={() => setTransferPppoe(null)}
        />
      )}
    </div>
  );
}

// ── Sección colapsable (disclosure) ─────────────────────────────────────────

/** Chevron SVG — rota 180° vía CSS cuando la sección está abierta. Sin emojis. */
function ChevronIcon() {
  return (
    <svg
      className={styles.collapseChevron}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * Sección colapsable (patrón disclosure/accordion).
 *
 * - Header = `<button>` real con `aria-expanded` + `aria-controls` (a11y de disclosure).
 * - Toggle por click / Enter / Space (gratis al ser un `<button>`).
 * - Por defecto COLAPSADA (`defaultOpen=false`).
 * - El cuerpo SIEMPRE se monta (transición de altura via grid-template-rows);
 *   `inert` cuando está cerrado lo saca del foco y del árbol de accesibilidad,
 *   sin desmontar el contenido — el estado de los forms internos se conserva.
 */
function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  // `inert` saca el contenido colapsado del tab-order y del árbol de accesibilidad,
  // pero lo deja en el DOM para que la transición de altura funcione. @types/react
  // 18.2 todavía no tipa `inert`, así que lo inyectamos por un record sin tipar.
  const inertProps: Record<string, string> = open ? {} : { inert: '' };

  return (
    <section className={styles.collapse}>
      <h4 className={styles.collapseHeading}>
        <button
          type="button"
          className={styles.collapseHeader}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={styles.collapseTitle}>{title}</span>
          <ChevronIcon />
        </button>
      </h4>
      <div
        id={bodyId}
        className={`${styles.collapseRegion} ${open ? styles.collapseRegionOpen : ''}`}
        {...inertProps}
      >
        <div className={styles.collapseInner}>{children}</div>
      </div>
    </section>
  );
}

// ── Crear PPPoE ──────────────────────────────────────────────────────────────

/**
 * Sentinel del selector de Router para la pre-provisión SIN router
 * (pppoe-preprovision): el submit va sin `nasId` y el watcher adopta el
 * servicio cuando el cliente conecta por primera vez. No colisiona con ids
 * reales de NAS (cuids/uuids).
 */
const NO_ROUTER_VALUE = '__no_router__';

/** Returns a human-readable error hint for next-free-ip failures. */
function ipFetchHint(err: unknown): string {
  const status = errorStatus(err);
  if (status === 404) return 'Sin pool configurado para ese tipo de IP.';
  if (status === 422) return 'Pool lleno — asigná la IP manualmente.';
  if (status === 502) return 'Router no disponible. Asigná la IP manualmente.';
  return 'No se pudo obtener la IP. Asigná manualmente.';
}

function CreatePppoeForm({
  contractId,
  clientId,
  nasServers,
}: {
  contractId: string;
  clientId: string | number;
  nasServers: { id: string; name: string }[];
}) {
  const create = useCreatePppoe(contractId, clientId);
  const plansQuery = usePlans();
  const allPlans = plansQuery.data ?? [];
  const eligiblePlans = allPlans.filter(isEligiblePlan);

  const [form, setForm] = useState({
    username: '',
    password: '',
    nasId: '',
    profile: '',
    remoteAddress: '',
  });
  const [ipType, setIpType] = useState<IpType | null>(null);
  /**
   * ipAutoFilled: true when the current value of remoteAddress was placed by the
   * auto-assign logic (not typed by the operator). Using state so the
   * "auto-asignada" hint and "cambiar" button re-render correctly.
   */
  const [ipAutoFilled, setIpAutoFilled] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /** Pre-provisión sin router: no hay IP remota que sugerir ni enviar. */
  const isNoRouter = form.nasId === NO_ROUTER_VALUE;

  const ipQuery = useNextFreeIp(isNoRouter ? null : (form.nasId || null), ipType);

  /**
   * Single effect that runs whenever the selection (nasId, ipType) OR the query
   * result (data, isSuccess) changes.
   *
   * Logic:
   * - If data is ready AND the field is empty or was previously auto-filled → fill + mark.
   * - If the query is not successful (includes the moment after nasId/ipType change
   *   before the new fetch completes) → clear the auto-fill flag.
   *
   * `form.remoteAddress` and `ipAutoFilled` are read at effect time (stable snapshot)
   * so they're listed in deps. The guard conditions prevent infinite loops:
   * `setIpAutoFilled(false)` only fires when `ipAutoFilled` is already true, and
   * the fill branch only updates `remoteAddress` and/or `ipAutoFilled` to a new value.
   */
  useEffect(() => {
    if (ipQuery.isSuccess && ipQuery.data?.ip) {
      if (!form.remoteAddress || ipAutoFilled) {
        setForm((f) => ({ ...f, remoteAddress: ipQuery.data.ip }));
        setIpAutoFilled(true);
      }
    } else if (!ipQuery.isSuccess && ipAutoFilled) {
      setIpAutoFilled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ipQuery.data, ipQuery.isSuccess, form.nasId, ipType]);

  function handleRemoteAddressChange(val: string) {
    setIpAutoFilled(false);
    setForm((f) => ({ ...f, remoteAddress: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (create.isPending) return;
    // S5.1: el tipo de IP es una decisión consciente del operador — sin tipo no hay submit.
    if (!ipType) return;
    setError(null);
    setSuccess(false);
    try {
      await create.mutateAsync({
        username: form.username.trim(),
        password: form.password,
        profile: form.profile.trim() || undefined,
        ipTypePreference: ipType,
        // S5.2: sin router el body va SIN nasId ni remoteAddress (pre-provisión).
        ...(isNoRouter
          ? {}
          : {
              nasId: form.nasId,
              remoteAddress: form.remoteAddress.trim() || undefined,
            }),
      });
      setSuccess(true);
      setForm({ username: '', password: '', nasId: '', profile: '', remoteAddress: '' });
      setIpType(null);
      setIpAutoFilled(false);
    } catch (err) {
      const status = errorStatus(err);
      if (status === 409) {
        setError('Ese usuario PPPoE ya existe (en este u otro router). Usá otro nombre.');
      } else {
        setError('No se pudo cargar el PPPoE. Revisá los datos e intentá de nuevo.');
      }
    }
  }

  const showAutoHint = ipAutoFilled && ipQuery.isSuccess && !!form.remoteAddress;
  const showIpFetching = ipQuery.isFetching;
  const showIpError = ipQuery.isError && !ipQuery.isFetching;

  return (
    <div className={styles.collapseContent}>
      <form onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="pppoe-username">
              Usuario <span aria-hidden="true">*</span>
            </label>
            <input
              id="pppoe-username"
              className={styles.input}
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
              disabled={create.isPending}
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="pppoe-password">
              Contraseña <span aria-hidden="true">*</span>
            </label>
            <input
              id="pppoe-password"
              type="password"
              className={styles.input}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              disabled={create.isPending}
              autoComplete="new-password"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="pppoe-nas">
              Router <span aria-hidden="true">*</span>
            </label>
            <select
              id="pppoe-nas"
              className={styles.select}
              value={form.nasId}
              onChange={(e) => {
                const value = e.target.value;
                // Sin router no hay IP remota: se limpia para que un valor viejo
                // (tipeado o auto-asignado) no reaparezca al volver a un router.
                setForm((f) => ({
                  ...f,
                  nasId: value,
                  ...(value === NO_ROUTER_VALUE ? { remoteAddress: '' } : {}),
                }));
                if (value === NO_ROUTER_VALUE) setIpAutoFilled(false);
              }}
              required
              disabled={create.isPending}
              aria-describedby={isNoRouter ? 'pppoe-no-router-hint' : undefined}
            >
              <option value="">Elegí un router…</option>
              {/* S5.2: primera opción del selector — pre-provisión / auto-instalación */}
              <option value={NO_ROUTER_VALUE}>Sin router — auto-instalación</option>
              {nasServers.map((nas) => (
                <option key={nas.id} value={nas.id}>
                  {nas.name}
                </option>
              ))}
            </select>
            {isNoRouter && (
              <p id="pppoe-no-router-hint" className={styles.fieldHint}>
                El sistema asigna el NAS y la IP fija automáticamente cuando el cliente se conecta por primera vez.
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="pppoe-profile">
              Plan <span aria-hidden="true">*</span>
            </label>
            {plansQuery.isLoading ? (
              <select
                id="pppoe-profile"
                className={styles.select}
                disabled
              >
                <option disabled>Cargando planes…</option>
              </select>
            ) : plansQuery.isError || eligiblePlans.length === 0 ? (
              <>
                <input
                  id="pppoe-profile"
                  className={styles.input}
                  value={form.profile}
                  onChange={(e) => setForm((f) => ({ ...f, profile: e.target.value }))}
                  disabled={create.isPending}
                  required
                  placeholder="Ingresá el código del plan"
                />
                <p className={styles.fieldHint}>No se pudieron cargar los planes — ingresá el código del plan manualmente</p>
              </>
            ) : (
              <select
                id="pppoe-profile"
                className={styles.select}
                value={form.profile}
                onChange={(e) => setForm((f) => ({ ...f, profile: e.target.value }))}
                required
                disabled={create.isPending}
              >
                <option value="">Elegí un plan…</option>
                {eligiblePlans.map((plan) => (
                  <option key={plan.id} value={plan.code}>
                    {plan.name ? `${plan.name} — ${plan.rateLimit}` : `${plan.code} — ${plan.rateLimit}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tipo de IP — toggle Privada / Pública. S5.1: OBLIGATORIO, sin
              preselección; el hint accesible gatea el submit hasta que el
              operador decida conscientemente. */}
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Tipo de IP <span aria-hidden="true">*</span>
            </span>
            <div
              className={styles.ipTypeToggle}
              role="group"
              aria-label="Tipo de IP"
              aria-describedby={!ipType ? 'pppoe-iptype-hint' : undefined}
            >
              <button
                type="button"
                className={`${styles.ipTypeBtn} ${ipType === 'cgnat' ? styles.ipTypeBtnActive : ''}`}
                onClick={() => setIpType('cgnat')}
                disabled={create.isPending}
                aria-pressed={ipType === 'cgnat'}
              >
                Privada
              </button>
              <button
                type="button"
                className={`${styles.ipTypeBtn} ${ipType === 'public' ? styles.ipTypeBtnActive : ''}`}
                onClick={() => setIpType('public')}
                disabled={create.isPending}
                aria-pressed={ipType === 'public'}
              >
                Pública
              </button>
            </div>
            {!ipType && (
              <p id="pppoe-iptype-hint" className={styles.fieldHint}>
                Elegí el tipo de IP
              </p>
            )}
          </div>

          {/* IP remota — con feedback de auto-asignación. Oculta en pre-provisión
              sin router (S5.2): no aplica, la IP la asigna la adopción automática. */}
          {!isNoRouter && (
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="pppoe-remote-address">
              IP remota
            </label>
            <p className={styles.fieldHint}>Dejá la IP vacía para asignación automática del pool del router.</p>
            <div className={styles.ipRow}>
              <input
                id="pppoe-remote-address"
                className={styles.input}
                value={form.remoteAddress}
                onChange={(e) => handleRemoteAddressChange(e.target.value)}
                disabled={create.isPending}
                placeholder={showIpFetching ? 'Buscando IP…' : 'Opcional'}
                aria-describedby={showIpError ? 'ip-fetch-error' : undefined}
              />
              {showAutoHint && !showIpFetching && (
                <button
                  type="button"
                  className={styles.btnCambiar}
                  onClick={() => { setIpAutoFilled(true); void ipQuery.refetch(); }}
                  disabled={create.isPending || ipQuery.isFetching}
                  title="Obtener otra IP libre"
                >
                  cambiar
                </button>
              )}
            </div>
            {showIpFetching && (
              <span className={styles.ipHint}>Buscando IP…</span>
            )}
            {showAutoHint && !showIpFetching && (
              <span className={styles.ipHint}>auto-asignada</span>
            )}
            {showIpError && (
              <span id="ip-fetch-error" className={styles.ipHintError}>
                {ipFetchHint(ipQuery.error)}
              </span>
            )}
          </div>
          )}
        </div>
        {error && (
          <div className={`${styles.banner} ${styles.bannerError}`} style={{ marginTop: 'var(--space-4)' }}>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className={`${styles.banner} ${styles.bannerSuccess}`} style={{ marginTop: 'var(--space-4)' }}>
            <span>PPPoE creado correctamente.</span>
          </div>
        )}
        <div className={styles.formActions} style={{ marginTop: 'var(--space-4)' }}>
          {/* W5: el hint del tipo de IP también describe el submit deshabilitado —
              un SR parado en el botón sabe por qué no puede enviar. */}
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={
              create.isPending ||
              !form.username.trim() ||
              !form.password ||
              !form.nasId ||
              !form.profile ||
              // S5.1: sin tipo de IP elegido no hay submit (decisión consciente).
              !ipType
            }
            aria-describedby={!ipType ? 'pppoe-iptype-hint' : undefined}
          >
            {create.isPending ? 'Creando…' : 'Crear PPPoE'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── PPPoE activo ──────────────────────────────────────────────────────────────

/**
 * SpeedControl — inline control para cambiar el plan/velocidad del PPPoE.
 * Se renderiza FUERA del form de Editar para no pisar password/IP al cambiar plan.
 * Degradación: si usePlans() retorna vacío o error, muestra el perfil actual como texto.
 * Gateado por pppoe.manage (el padre <Can> lo envuelve).
 *
 * Flujo: click "Aplicar" → modal de motivo → confirmar(reason) → onApply(profile, reason).
 */
function SpeedControl({
  pppoeId,
  currentProfile,
  onApply,
  isPending,
}: {
  pppoeId: string;
  currentProfile: string | null;
  onApply: (profile: string, reason: string) => Promise<unknown>;
  isPending: boolean;
}) {
  const plansQuery = usePlans();
  const allPlans = plansQuery.data ?? [];
  const eligiblePlans = allPlans.filter(isEligiblePlan);

  const [selected, setSelected] = useState<string>(currentProfile ?? '');
  const [speedError, setSpeedError] = useState<string | null>(null);
  const [speedSuccess, setSpeedSuccess] = useState(false);
  const [speedModalOpen, setSpeedModalOpen] = useState(false);

  // Keep selection in sync when pppoe.profile changes from outside (e.g. after a successful apply)
  const [lastApplied, setLastApplied] = useState<string>(currentProfile ?? '');
  if (currentProfile !== lastApplied) {
    setLastApplied(currentProfile ?? '');
    setSelected(currentProfile ?? '');
  }

  const unchanged = selected === (currentProfile ?? '');
  const applyDisabled = unchanged || isPending;

  // The plan label shown in the modal title (name + rate or just code)
  const selectedPlan = eligiblePlans.find((p) => p.code === selected);
  const planLabel = selectedPlan
    ? (selectedPlan.name ? `${selectedPlan.name} — ${selectedPlan.rateLimit}` : `${selectedPlan.code} — ${selectedPlan.rateLimit}`)
    : selected;

  async function handleConfirmApply(reason: string) {
    setSpeedModalOpen(false);
    setSpeedError(null);
    setSpeedSuccess(false);
    try {
      await onApply(selected, reason);
      setSpeedSuccess(true);
    } catch {
      setSpeedError('No se pudo cambiar la velocidad. Reintentá.');
    }
  }

  // Graceful degradation: no eligible plans or query error → read-only text
  if (plansQuery.isError || eligiblePlans.length === 0) {
    return (
      <div className={styles.speedControl}>
        <span className={styles.fieldLabel}>Velocidad</span>
        <span
          className={styles.speedProfileReadonly}
          data-testid="speed-profile-readonly"
        >
          {currentProfile ?? '—'}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className={styles.speedControl}>
        {speedError && (
          <div className={`${styles.banner} ${styles.bannerError}`} role="alert" style={{ marginBottom: 'var(--space-2)' }}>
            <span>{speedError}</span>
          </div>
        )}
        {speedSuccess && (
          <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status" style={{ marginBottom: 'var(--space-2)' }}>
            <span>Velocidad cambiada correctamente.</span>
          </div>
        )}
        <div className={styles.speedRow}>
          <label className={styles.fieldLabel} htmlFor={`speed-select-${pppoeId}`}>
            Velocidad
          </label>
          <div className={styles.speedInputRow}>
            <select
              id={`speed-select-${pppoeId}`}
              className={styles.select}
              value={selected}
              onChange={(e) => { setSpeedError(null); setSpeedSuccess(false); setSelected(e.target.value); }}
              disabled={isPending}
            >
              {eligiblePlans.map((plan) => (
                <option key={plan.id} value={plan.code}>
                  {plan.name ? `${plan.name} — ${plan.rateLimit}` : `${plan.code} — ${plan.rateLimit}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => { if (!applyDisabled) { setSpeedError(null); setSpeedSuccess(false); setSpeedModalOpen(true); } }}
              disabled={applyDisabled}
            >
              {isPending ? 'Aplicando…' : 'Aplicar'}
            </button>
          </div>
        </div>
      </div>
      <ServiceRemovalReasonModal
        open={speedModalOpen}
        serviceName="Internet (PPPoE)"
        title={`Cambiar velocidad a ${planLabel}`}
        confirmLabel="Aplicar"
        tone="primary"
        placeholder="Ej: Upgrade de plan, ajuste comercial, pedido del cliente…"
        onConfirm={handleConfirmApply}
        onCancel={() => setSpeedModalOpen(false)}
      />
    </>
  );
}

function ActivePppoeView({
  contractId,
  clientId,
  pppoe,
  nasServers,
  onBaja,
  onRequestTransfer,
}: {
  contractId: string;
  clientId: string | number;
  pppoe: PppoeServiceDto;
  nasServers: { id: string; name: string }[];
  onBaja: (outcome: 'full' | 'partial') => void;
  /** service-transfer W4 — abre el modal de transferencia en el PARENT (snapshot del DTO). */
  onRequestTransfer: (pppoe: PppoeServiceDto) => void;
}) {
  const update = useUpdatePppoe(contractId, clientId);
  const move = useMovePppoe(contractId, clientId);
  const deactivate = useDeactivatePppoe(contractId, clientId);
  const deassociate = useDeassociatePppoe(contractId, clientId);
  const enforceForContract = useEnforcePppoeForContract(contractId, clientId);
  const callerIdQuery = usePppoeCallerId(pppoe.id);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    password: '',
    remoteAddress: pppoe.remoteAddress ?? '',
    // nasId null = pendiente de instalación → el select arranca sin router.
    nasId: pppoe.nasId ?? '',
  });
  const [editError, setEditError] = useState<string | null>(null);

  /** Pendiente de instalación: pre-provisión sin NAS aún no adoptada por el watcher. */
  const isPendingInstall = pppoe.nasId === null;

  // ── Auto-asignación de IP en el form de Editar ─────────────────────────────
  const [editIpType, setEditIpType] = useState<IpType | null>(null);
  /**
   * editIpAutoFilled: true cuando remoteAddress fue puesto por auto-asignación
   * (no tipeo manual). Previene que el useEffect pise ediciones manuales.
   */
  const [editIpAutoFilled, setEditIpAutoFilled] = useState(false);

  const editIpQuery = useNextFreeIp(editing ? editForm.nasId : null, editIpType);

  /**
   * Mismo patrón que CreatePppoeForm: fill solo si la IP está vacía o fue
   * auto-asignada previamente; resetear el flag si el query deja de ser success.
   */
  useEffect(() => {
    if (editIpQuery.isSuccess && editIpQuery.data?.ip) {
      if (!editForm.remoteAddress || editIpAutoFilled) {
        setEditForm((f) => ({ ...f, remoteAddress: editIpQuery.data.ip }));
        setEditIpAutoFilled(true);
      }
    } else if (!editIpQuery.isSuccess && editIpAutoFilled) {
      setEditIpAutoFilled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editIpQuery.data, editIpQuery.isSuccess, editForm.nasId, editIpType]);

  const [bajaModalOpen, setBajaModalOpen] = useState(false);
  const [bajaError, setBajaError] = useState<string | null>(null);

  const [deassociateReasonOpen, setDeassociateReasonOpen] = useState(false);
  const [deassociateError, setDeassociateError] = useState<string | null>(null);

  const [enforceModal, setEnforceModal] = useState<EnforcementAction | null>(null);
  const [enforceError, setEnforceError] = useState<string | null>(null);

  function nasName(id: string | null): string {
    if (!id) return '—';
    return nasServers.find((n) => n.id === id)?.name ?? id;
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (update.isPending || move.isPending) return;
    setEditError(null);
    try {
      // Con nasId null (pendiente), elegir un router acá = adopción manual (move).
      const nasChanged = editForm.nasId !== (pppoe.nasId ?? '');
      if (nasChanged && editForm.nasId) {
        try {
          await move.mutateAsync({ id: pppoe.id, nasId: editForm.nasId });
        } catch (err) {
          // W3: los errores tipados del move (pool lleno 422, NO_POOL 404,
          // guard de IP pública 409, etc.) llegan mapeados — no el genérico.
          setEditError(mapPppoeMoveError(err));
          return;
        }
      }
      const updateBody: { password?: string; remoteAddress?: string } = {};
      if (editForm.password) updateBody.password = editForm.password;
      if (editForm.remoteAddress !== (pppoe.remoteAddress ?? '')) updateBody.remoteAddress = editForm.remoteAddress.trim() || undefined;
      const hasChanges = Object.keys(updateBody).length > 0;
      if (hasChanges) {
        await update.mutateAsync({ id: pppoe.id, body: updateBody });
      }
      setEditing(false);
      setEditForm((f) => ({ ...f, password: '' }));
    } catch {
      setEditError('No se pudo guardar los cambios. Reintentá.');
    }
  }

  async function handleBaja(reason: string) {
    setBajaModalOpen(false);
    setBajaError(null);
    // Corte real en el router (DELETE /pppoe/:id) — el BE registra el motivo en el historial.
    try {
      await deactivate.mutateAsync({ id: pppoe.id, reason });
    } catch (err) {
      const status = errorStatus(err);
      if (status === 404) {
        // El PPPoE ya no estaba en el router → idempotente, consideramos éxito.
      } else if (status === 502) {
        setBajaError(
          'El router está caído, el corte no se pudo completar. Intentá de nuevo cuando el router esté disponible.',
        );
        return;
      } else {
        setBajaError('No se pudo dar de baja el PPPoE. Reintentá.');
        return;
      }
    }
    onBaja('full');
  }

  async function handleDeassociate(reason: string) {
    setDeassociateReasonOpen(false);
    setDeassociateError(null);
    try {
      await deassociate.mutateAsync({ pppoeId: pppoe.id, reason });
    } catch (err) {
      // 404 = el PPPoE ya no estaba asociado → idempotente, éxito silencioso.
      if (errorStatus(err) !== 404) {
        setDeassociateError('No se pudo desasociar el PPPoE. Reintentá.');
      }
    }
  }

  async function handleEnforce(action: EnforcementAction, reason: string) {
    setEnforceModal(null);
    setEnforceError(null);
    try {
      await enforceForContract.mutateAsync({ id: pppoe.id, action, reason });
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      // Wire contract pppoe-preprovision: enforce sobre un pendiente → 409 tipado.
      if (e?.response?.status === 409 && e.response.data?.code === 'PPPOE_PENDING_INSTALL') {
        setEnforceError(
          'Este servicio está pendiente de instalación: no se puede operar el corte hasta que el cliente se conecte y el sistema le asigne un router.',
        );
      } else {
        setEnforceError('No se pudo aplicar el cambio. Revisá la conexión con el router e intentá de nuevo.');
      }
    }
  }

  const isPending = update.isPending || move.isPending;

  return (
    <div className={styles.section}>
      {/* ── Detalle: badge + data grid ──────────────────────────────────── */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h4 className={styles.cardTitle}>PPPoE activo</h4>
          {/* Badges prominentes en el header de la card */}
          <div className={styles.badgeRow}>
            {pppoe.status === 'enabled' ? (
              <span className={styles.badgeActive}>Activo</span>
            ) : (
              <span className={styles.badgeInactive}>Desactivado</span>
            )}
            {/* S5.3: pre-provisión sin NAS aún no adoptada — familia warning */}
            {isPendingInstall && (
              <span className={styles.badgePending}>Pendiente de instalación</span>
            )}
            {pppoe.enforcedState === 'reduced' && (
              <span className={styles.badgeReduced}>Reducido</span>
            )}
            {pppoe.enforcedState === 'blocked' && (
              <span className={styles.badgeInactive}>Bloqueado</span>
            )}
          </div>
        </div>

        <dl className={styles.detailGrid}>
          <div>
            <dt className={styles.dt}>Usuario</dt>
            <dd className={styles.dd}>{pppoe.username}</dd>
          </div>
          <div>
            <dt className={styles.dt}>Perfil</dt>
            <dd className={styles.dd}>{pppoe.profile ?? '—'}</dd>
          </div>
          <div>
            <dt className={styles.dt}>Router</dt>
            <dd className={styles.dd}>{nasName(pppoe.nasId)}</dd>
          </div>
          <div>
            <dt className={styles.dt}>IP remota</dt>
            <dd className={styles.dd}>
              {/* W2: el pendiente persiste ipMode 'fixed' (design D3) pero la IP
                  recién existe cuando la adopción asigna el NAS — "—" limpio,
                  sin el artefacto "— fija". */}
              {isPendingInstall ? (
                '—'
              ) : pppoe.ipMode === 'fixed' ? (
                <>
                  {pppoe.remoteAddress ?? '—'}
                  {' '}
                  <span className={styles.badgeFixed}>fija</span>
                </>
              ) : (
                <>
                  {'Automática (pool)'}
                  {pppoe.remoteAddress && (
                    <span className={styles.ipHint}>{` (actual: ${pppoe.remoteAddress})`}</span>
                  )}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt className={styles.dt}>Caller-ID (MAC)</dt>
            <dd className={styles.dd}>
              {callerIdQuery.isLoading
                ? '…'
                : callerIdQuery.isError
                  ? <span className={styles.ipHint}>—</span>
                  : callerIdQuery.data?.callerId
                    ? callerIdQuery.data.callerId
                    : <span className={styles.ipHint}>— sin sesión activa</span>}
            </dd>
          </div>
          {/* Doble capa: el endpoint /credentials exige pppoe.manage */}
          <Can permission="pppoe.manage">
            <div>
              <dt className={styles.dt}>Contraseña</dt>
              <dd className={styles.dd}>
                <RevealCredentials pppoeId={pppoe.id} />
              </dd>
            </div>
          </Can>
        </dl>
      </section>

      {/* ── Grupo: Modificar ─────────────────────────────────────────────── */}
      <Can permission="pppoe.manage">
        <section className={styles.actionGroup}>
          <h5 className={styles.actionGroupTitle}>Modificar</h5>

          {/* Editar: password / IP remota (+ auto-asignación) / router */}
          <div className={styles.actionGroupItem}>
            {!editing ? (
              <button
                type="button"
                className={styles.btnEdit}
                onClick={() => {
                  setEditError(null);
                  setEditIpType(null);
                  setEditIpAutoFilled(false);
                  setEditForm({
                    password: '',
                    remoteAddress: pppoe.remoteAddress ?? '',
                    nasId: pppoe.nasId ?? '',
                  });
                  setEditing(true);
                }}
              >
                <PencilIcon />
                Editar
              </button>
            ) : (
              <form onSubmit={handleEdit} className={styles.editForm}>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="pppoe-edit-password">
                      Nueva contraseña
                    </label>
                    <input
                      id="pppoe-edit-password"
                      type="password"
                      className={styles.input}
                      value={editForm.password}
                      onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                      disabled={isPending}
                      placeholder="Dejar vacío para no cambiar"
                      autoComplete="new-password"
                    />
                  </div>

                  {/* Tipo de IP — toggle Privada / Pública (igual al form de crear) */}
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>Tipo de IP</span>
                    <div className={styles.ipTypeToggle} role="group" aria-label="Tipo de IP">
                      <button
                        type="button"
                        className={`${styles.ipTypeBtn} ${editIpType === 'cgnat' ? styles.ipTypeBtnActive : ''}`}
                        onClick={() => { setEditIpType('cgnat'); setEditIpAutoFilled(false); }}
                        disabled={isPending}
                        aria-pressed={editIpType === 'cgnat'}
                      >
                        Privada
                      </button>
                      <button
                        type="button"
                        className={`${styles.ipTypeBtn} ${editIpType === 'public' ? styles.ipTypeBtnActive : ''}`}
                        onClick={() => { setEditIpType('public'); setEditIpAutoFilled(false); }}
                        disabled={isPending}
                        aria-pressed={editIpType === 'public'}
                      >
                        Pública
                      </button>
                    </div>
                  </div>

                  {/* IP remota — con feedback de auto-asignación */}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="pppoe-edit-remote">
                      IP remota
                    </label>
                    <div className={styles.ipRow}>
                      <input
                        id="pppoe-edit-remote"
                        className={styles.input}
                        value={editForm.remoteAddress}
                        onChange={(e) => {
                          setEditIpAutoFilled(false);
                          setEditForm((f) => ({ ...f, remoteAddress: e.target.value }));
                        }}
                        disabled={isPending}
                        placeholder={editIpQuery.isFetching ? 'Buscando IP…' : 'Opcional'}
                        aria-describedby={editIpQuery.isError && !editIpQuery.isFetching ? 'edit-ip-fetch-error' : undefined}
                      />
                      <button
                        type="button"
                        className={styles.btnCambiar}
                        onClick={() => {
                          setEditIpAutoFilled(true);
                          // Si la data ya está disponible (mismo nasId/tipo), úsala directamente;
                          // de lo contrario, refetch la trae y el useEffect la aplica.
                          if (editIpQuery.isSuccess && editIpQuery.data?.ip) {
                            setEditForm((f) => ({ ...f, remoteAddress: editIpQuery.data.ip }));
                          } else {
                            void editIpQuery.refetch();
                          }
                        }}
                        disabled={isPending || !editIpType || editIpQuery.isFetching}
                        aria-label="Auto-asignar IP"
                      >
                        Auto-asignar IP
                      </button>
                    </div>
                    {editIpQuery.isFetching && (
                      <span className={styles.ipHint}>Buscando IP…</span>
                    )}
                    {editIpAutoFilled && editIpQuery.isSuccess && !editIpQuery.isFetching && (
                      <span className={styles.ipHint}>auto-asignada</span>
                    )}
                    {editIpQuery.isError && !editIpQuery.isFetching && (
                      <span id="edit-ip-fetch-error" className={styles.ipHintError}>
                        {ipFetchHint(editIpQuery.error)}
                      </span>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="pppoe-edit-nas">
                      Router
                    </label>
                    <select
                      id="pppoe-edit-nas"
                      className={styles.select}
                      value={editForm.nasId}
                      onChange={(e) => setEditForm((f) => ({ ...f, nasId: e.target.value }))}
                      disabled={isPending}
                    >
                      {/* Pendiente de instalación: sin NAS todavía — elegir uno acá = adopción manual */}
                      {isPendingInstall && (
                        <option value="">Sin router (pendiente de instalación)</option>
                      )}
                      {nasServers.map((nas) => (
                        <option key={nas.id} value={nas.id}>
                          {nas.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {editError && (
                  <div className={`${styles.banner} ${styles.bannerError}`} style={{ marginTop: 'var(--space-4)' }}>
                    <span>{editError}</span>
                  </div>
                )}
                <div className={styles.formActions} style={{ marginTop: 'var(--space-4)' }}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => { setEditing(false); setEditError(null); setEditIpType(null); setEditIpAutoFilled(false); }}
                    disabled={isPending}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={isPending}
                  >
                    {isPending ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Cambiar velocidad */}
          <div className={styles.actionGroupItem}>
            <SpeedControl
              pppoeId={pppoe.id}
              currentProfile={pppoe.profile ?? null}
              onApply={(profile, reason) => update.mutateAsync({ id: pppoe.id, body: { profile, reason } })}
              isPending={update.isPending}
            />
          </div>
        </section>
      </Can>

      {/* ── Grupo: Control de servicio ───────────────────────────────────── */}
      <Can permission="pppoe.cut">
        <section className={styles.actionGroup}>
          <h5 className={styles.actionGroupTitle}>Control de servicio</h5>
          {enforceError && (
            <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
              <span>{enforceError}</span>
            </div>
          )}
          <div className={styles.actionGroupActions}>
            {pppoe.enforcedState === 'active' && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => { setEnforceError(null); setEnforceModal('reduce'); }}
                disabled={enforceForContract.isPending}
              >
                Reducir
              </button>
            )}
            {(pppoe.enforcedState === 'active' || pppoe.enforcedState === 'reduced') && (
              <button
                type="button"
                className={styles.btnWarning}
                onClick={() => { setEnforceError(null); setEnforceModal('block'); }}
                disabled={enforceForContract.isPending}
              >
                Cortar
              </button>
            )}
            {(pppoe.enforcedState === 'reduced' || pppoe.enforcedState === 'blocked') && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => { setEnforceError(null); setEnforceModal('restore'); }}
                disabled={enforceForContract.isPending}
              >
                Restaurar
              </button>
            )}
          </div>
        </section>
      </Can>

      {/* ── Grupo: Ciclo de vida ─────────────────────────────────────────── */}
      {/* service-transfer W4: pppoe.transfer también habilita la sección (su único
          item visible sería "Transferir a otro cliente"). */}
      <Can permissions={['pppoe.manage', 'pppoe.cut', 'pppoe.transfer']} mode="any">
      <section className={styles.actionGroup}>
        <h5 className={styles.actionGroupTitle}>Ciclo de vida</h5>

        {/* Desasociar — pppoe.manage */}
        <Can permission="pppoe.manage">
          <div className={styles.lifecycleItem}>
            {deassociateError && (
              <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
                <span>{deassociateError}</span>
              </div>
            )}
            <button
              type="button"
              className={styles.btnLinkDanger}
              onClick={() => setDeassociateReasonOpen(true)}
              disabled={deassociate.isPending}
            >
              {deassociate.isPending ? 'Desasociando…' : 'Desasociar'}
            </button>
            <span className={styles.lifecycleHint}>
              Quita el PPPoE del contrato y lo devuelve al inventario de huérfanos.
            </span>
          </div>
        </Can>

        {/* Transferir a otro cliente — pppoe.transfer (service-transfer W4) */}
        <Can permission="pppoe.transfer">
          <div className={styles.lifecycleItem}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => onRequestTransfer(pppoe)}
            >
              Transferir a otro cliente
            </button>
            <span className={styles.lifecycleHint}>
              Mueve este PPPoE a un contrato de otro cliente (cambio de titularidad).
              Recomendado: recrearlo en el destino.
            </span>
          </div>
        </Can>

        {/* Dar de baja — pppoe.cut */}
        <Can permission="pppoe.cut">
          <div className={styles.lifecycleItem}>
            {bajaError && (
              <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
                <span>{bajaError}</span>
              </div>
            )}
            <button
              type="button"
              className={styles.btnLinkDanger}
              onClick={() => { setBajaError(null); setBajaModalOpen(true); }}
              disabled={deactivate.isPending}
            >
              {deactivate.isPending ? 'Dando de baja…' : 'Dar de baja PPPoE'}
            </button>
            <span className={styles.lifecycleHint}>
              Borra el usuario del RADIUS, libera la IP y registra la baja en el historial. Esta acción es irreversible.
            </span>
          </div>
        </Can>
      </section>
      </Can>

      {/* Modales de motivo */}
      <ServiceRemovalReasonModal
        open={bajaModalOpen}
        serviceName="Internet (PPPoE)"
        onConfirm={handleBaja}
        onCancel={() => setBajaModalOpen(false)}
      />
      <ServiceRemovalReasonModal
        open={deassociateReasonOpen}
        serviceName="Internet (PPPoE) — Desasociar"
        onConfirm={handleDeassociate}
        onCancel={() => setDeassociateReasonOpen(false)}
      />
      <ServiceRemovalReasonModal
        open={enforceModal === 'reduce'}
        serviceName="Internet (PPPoE)"
        title="Reducir servicio: Internet (PPPoE)"
        confirmLabel="Reducir"
        onConfirm={(reason) => handleEnforce('reduce', reason)}
        onCancel={() => setEnforceModal(null)}
      />
      <ServiceRemovalReasonModal
        open={enforceModal === 'block'}
        serviceName="Internet (PPPoE)"
        title="Cortar servicio: Internet (PPPoE)"
        confirmLabel="Cortar"
        onConfirm={(reason) => handleEnforce('block', reason)}
        onCancel={() => setEnforceModal(null)}
      />
      <ServiceRemovalReasonModal
        open={enforceModal === 'restore'}
        serviceName="Internet (PPPoE)"
        title="Restaurar servicio: Internet (PPPoE)"
        confirmLabel="Restaurar"
        onConfirm={(reason) => handleEnforce('restore', reason)}
        onCancel={() => setEnforceModal(null)}
      />
    </div>
  );
}

// ── Revelar credenciales ────────────────────────────────────────────────────────

/** Eye icon (open). Heroicons-style inline SVG — sin librería de iconos ni emojis. */
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Pencil / edit icon. Heroicons-style inline SVG — sin librería de iconos ni emojis. */
function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

/** Eye-off icon (slashed). */
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

/**
 * Revela el password de un PPPoE BAJO DEMANDA (espejo de la UX de credenciales de TV).
 * El query es lazy (`enabled` atado a `show`): el secreto NUNCA se pide eager, solo
 * al click en el ojo. Toggle show/hide + copiar al portapapeles (nice-to-have).
 */
function RevealCredentials({ pppoeId }: { pppoeId: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const credentialsQuery = usePppoeCredentials(pppoeId, show);
  const password = credentialsQuery.data?.password ?? null;

  async function handleCopy() {
    if (!password) return;
    try {
      await navigator.clipboard?.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin clipboard (contexto inseguro / permiso denegado) → no rompemos el flujo.
    }
  }

  return (
    <span className={styles.passwordRow}>
      <button
        type="button"
        className={styles.btnIcon}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={show}
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
      <span className={styles.passwordValue}>
        {!show
          ? '••••••••'
          : credentialsQuery.isLoading
            ? 'Cargando…'
            : credentialsQuery.isError
              ? 'No disponible'
              : (password ?? '—')}
      </span>
      {show && credentialsQuery.isSuccess && password && (
        copied ? (
          <span className={styles.copyHint} role="status">Copiada</span>
        ) : (
          <button type="button" className={styles.btnLink} onClick={handleCopy}>
            Copiar
          </button>
        )
      )}
    </span>
  );
}

// ── Asociar PPPoE existente (adopción de inventario) ────────────────────────────

/**
 * Sección "Asociar PPPoE existente": lista los huérfanos del router (ingest sin
 * contrato), filtra por usuario, y asocia el elegido al contrato. En éxito,
 * la invalidación del hook refetchea el PPPoE del contrato → el panel muestra el activo.
 */
function AssociatePppoeSection({
  contractId,
  clientId,
}: {
  contractId: string;
  clientId: string | number;
}) {
  const unassignedQuery = useUnassignedPppoe(true);
  const associate = useAssociatePppoe(contractId, clientId);

  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const all = unassignedQuery.data ?? [];
  const term = filter.trim().toLowerCase();
  const visible = term
    ? all.filter((p) => p.username.toLowerCase().includes(term))
    : all;

  async function handleAssociate(id: string) {
    if (associate.isPending) return;
    setError(null);
    setPendingId(id);
    try {
      await associate.mutateAsync({ id });
      // En éxito el hook invalida ['contract-pppoe'] → el panel re-renderiza con el activo.
    } catch (err) {
      const status = errorStatus(err);
      if (status === 409) {
        setError('Ese PPPoE ya está asociado a otro contrato. Refrescá la lista y elegí otro.');
      } else {
        setError('No se pudo asociar el PPPoE. Reintentá en unos segundos.');
      }
    } finally {
      setPendingId(null);
    }
  }

  let listBody: React.ReactNode;
  if (unassignedQuery.isLoading) {
    listBody = <p className={styles.loading}>Cargando PPPoE sin asignar…</p>;
  } else if (unassignedQuery.isError) {
    listBody = (
      <div className={`${styles.banner} ${styles.bannerError}`}>
        <span>No se pudo cargar la lista. Reintentá en unos segundos.</span>
      </div>
    );
  } else if (all.length === 0) {
    listBody = (
      <p className={styles.emptyHint}>
        No hay PPPoE sin asignar — corré el ingest del router para traer el inventario.
      </p>
    );
  } else if (visible.length === 0) {
    listBody = (
      <p className={styles.emptyHint}>Ningún PPPoE coincide con «{filter.trim()}».</p>
    );
  } else {
    listBody = (
      <ul className={styles.unassignedList}>
        {visible.map((p) => (
          <li key={p.id} className={styles.unassignedItem}>
            <span className={styles.unassignedInfo}>
              <span className={styles.unassignedUser}>{p.username}</span>
              <span className={styles.unassignedMeta}>
                {p.profile ? `${p.profile} · ` : ''}{p.remoteAddress ?? 'sin IP'}
              </span>
            </span>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => handleAssociate(p.id)}
              disabled={associate.isPending}
            >
              {associate.isPending && pendingId === p.id ? 'Asociando…' : 'Asociar'}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={styles.collapseContent}>
      <div className={styles.searchRow}>
        <label className={styles.fieldLabel} htmlFor="pppoe-adopt-filter">
          Buscar por usuario
        </label>
        <input
          id="pppoe-adopt-filter"
          className={styles.input}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar la lista…"
          autoComplete="off"
          disabled={unassignedQuery.isLoading || all.length === 0}
        />
      </div>
      {error && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>{error}</span>
        </div>
      )}
      {listBody}
    </div>
  );
}
