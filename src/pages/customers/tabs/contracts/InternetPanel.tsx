import { useId, useState, useEffect } from 'react';
import { Can } from '@/components/auth/Can';
import { ServiceRemovalReasonModal } from '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal';
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
} from '@/hooks/usePppoe';

import { useNasServers, useNextFreeIp } from '@/hooks/useNas';
import type { IpType } from '@/api/nas.api';
import type { ContractService } from '@/types/customer';
import type { PppoeServiceDto } from '@/types/pppoe';
import styles from './InternetPanel.module.css';

interface InternetPanelProps {
  contractId: string;
  clientId: string | number;
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
export function InternetPanel({ contractId, clientId, contractServices: _contractServices, onClose }: InternetPanelProps) {
  const pppoeQuery = useContractPppoe(contractId);
  const { data: nasServers = [] } = useNasServers();
  // Resultado terminal de la baja: 'full' (corte + historial) | 'partial' (corte OK, historial no).
  const [bajaOutcome, setBajaOutcome] = useState<null | 'full' | 'partial'>(null);

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

  const ipQuery = useNextFreeIp(form.nasId || null, ipType);

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
    setError(null);
    setSuccess(false);
    try {
      await create.mutateAsync({
        username: form.username.trim(),
        password: form.password,
        nasId: form.nasId,
        profile: form.profile.trim() || undefined,
        remoteAddress: form.remoteAddress.trim() || undefined,
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
              onChange={(e) => setForm((f) => ({ ...f, nasId: e.target.value }))}
              required
              disabled={create.isPending}
            >
              <option value="">Elegí un router…</option>
              {nasServers.map((nas) => (
                <option key={nas.id} value={nas.id}>
                  {nas.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="pppoe-profile">
              Perfil
            </label>
            <input
              id="pppoe-profile"
              className={styles.input}
              value={form.profile}
              onChange={(e) => setForm((f) => ({ ...f, profile: e.target.value }))}
              disabled={create.isPending}
              placeholder="Opcional"
            />
          </div>

          {/* Tipo de IP — toggle Privada / Pública */}
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Tipo de IP</span>
            <div className={styles.ipTypeToggle} role="group" aria-label="Tipo de IP">
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
          </div>

          {/* IP remota — con feedback de auto-asignación */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="pppoe-remote-address">
              IP remota
            </label>
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
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={
              create.isPending ||
              !form.username.trim() ||
              !form.password ||
              !form.nasId
            }
          >
            {create.isPending ? 'Creando…' : 'Crear PPPoE'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── PPPoE activo ──────────────────────────────────────────────────────────────

function ActivePppoeView({
  contractId,
  clientId,
  pppoe,
  nasServers,
  onBaja,
}: {
  contractId: string;
  clientId: string | number;
  pppoe: PppoeServiceDto;
  nasServers: { id: string; name: string }[];
  onBaja: (outcome: 'full' | 'partial') => void;
}) {
  const update = useUpdatePppoe(contractId, clientId);
  const move = useMovePppoe(contractId, clientId);
  const deactivate = useDeactivatePppoe(contractId, clientId);
  const deassociate = useDeassociatePppoe(contractId, clientId);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    profile: pppoe.profile ?? '',
    password: '',
    remoteAddress: pppoe.remoteAddress ?? '',
    nasId: pppoe.nasId,
  });
  const [editError, setEditError] = useState<string | null>(null);

  const [bajaModalOpen, setBajaModalOpen] = useState(false);
  const [bajaError, setBajaError] = useState<string | null>(null);

  const [deassociateReasonOpen, setDeassociateReasonOpen] = useState(false);

  function nasName(id: string): string {
    return nasServers.find((n) => n.id === id)?.name ?? id;
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (update.isPending || move.isPending) return;
    setEditError(null);
    try {
      const nasChanged = editForm.nasId !== pppoe.nasId;
      if (nasChanged) {
        await move.mutateAsync({ id: pppoe.id, nasId: editForm.nasId });
      }
      const updateBody: { profile?: string; password?: string; remoteAddress?: string } = {};
      if (editForm.profile !== (pppoe.profile ?? '')) updateBody.profile = editForm.profile.trim() || undefined;
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
    await deassociate.mutateAsync({ pppoeId: pppoe.id, reason });
  }

  const isPending = update.isPending || move.isPending;

  return (
    <div className={styles.section}>
      {/* Detalle */}
      <section className={styles.card}>
        <div className={styles.actionRow}>
          <h4 className={styles.cardTitle}>PPPoE activo</h4>
          <Can permission="pppoe.manage">
            {!editing && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setEditError(null);
                  setEditForm({
                    profile: pppoe.profile ?? '',
                    password: '',
                    remoteAddress: pppoe.remoteAddress ?? '',
                    nasId: pppoe.nasId,
                  });
                  setEditing(true);
                }}
              >
                Editar
              </button>
            )}
          </Can>
        </div>

        {!editing ? (
          <>
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
                <dd className={styles.dd}>{pppoe.remoteAddress ?? '—'}</dd>
              </div>
              {/* Doble capa: el endpoint /credentials exige pppoe.manage — la fila de
                  contraseña solo se renderiza (y el fetch lazy solo se dispara) con ese permiso. */}
              <Can permission="pppoe.manage">
                <div>
                  <dt className={styles.dt}>Contraseña</dt>
                  <dd className={styles.dd}>
                    <RevealCredentials pppoeId={pppoe.id} />
                  </dd>
                </div>
              </Can>
            </dl>
            <div className={styles.badgeRow}>
              {pppoe.status === 'enabled' ? (
                <span className={styles.badgeActive}>Activo</span>
              ) : (
                <span className={styles.badgeInactive}>Desactivado</span>
              )}
              {pppoe.enforcedState === 'reduced' && (
                <span className={styles.badgeReduced}>Reducido</span>
              )}
              {pppoe.enforcedState === 'blocked' && (
                <span className={styles.badgeInactive}>Bloqueado</span>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleEdit}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="pppoe-edit-profile">
                  Perfil
                </label>
                <input
                  id="pppoe-edit-profile"
                  className={styles.input}
                  value={editForm.profile}
                  onChange={(e) => setEditForm((f) => ({ ...f, profile: e.target.value }))}
                  disabled={isPending}
                  placeholder="Opcional"
                />
              </div>
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
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="pppoe-edit-remote">
                  IP remota
                </label>
                <input
                  id="pppoe-edit-remote"
                  className={styles.input}
                  value={editForm.remoteAddress}
                  onChange={(e) => setEditForm((f) => ({ ...f, remoteAddress: e.target.value }))}
                  disabled={isPending}
                  placeholder="Opcional"
                />
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
                onClick={() => { setEditing(false); setEditError(null); }}
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
      </section>

      {/* Desasociar PPPoE (sin dar de baja — vuelve al inventario de huérfanos) */}
      <Can permission="pppoe.manage">
        <section className={styles.bajaSection}>
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.btnLinkDanger}
              onClick={() => setDeassociateReasonOpen(true)}
              disabled={deassociate.isPending}
            >
              {deassociate.isPending ? 'Desasociando…' : 'Desasociar'}
            </button>
          </div>
        </section>
      </Can>

      {/* Dar de baja */}
      <Can permission="pppoe.cut">
        <section className={styles.bajaSection}>
          {bajaError && (
            <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
              <span>{bajaError}</span>
            </div>
          )}
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.btnLinkDanger}
              onClick={() => { setBajaError(null); setBajaModalOpen(true); }}
              disabled={deactivate.isPending}
            >
              {deactivate.isPending ? 'Dando de baja…' : 'Dar de baja PPPoE'}
            </button>
          </div>
        </section>
      </Can>

      {/* Modal de motivo de baja */}
      <ServiceRemovalReasonModal
        open={bajaModalOpen}
        serviceName="Internet (PPPoE)"
        onConfirm={handleBaja}
        onCancel={() => setBajaModalOpen(false)}
      />

      {/* Modal de motivo para desasociar */}
      <ServiceRemovalReasonModal
        open={deassociateReasonOpen}
        serviceName="Internet (PPPoE) — Desasociar"
        onConfirm={handleDeassociate}
        onCancel={() => setDeassociateReasonOpen(false)}
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
