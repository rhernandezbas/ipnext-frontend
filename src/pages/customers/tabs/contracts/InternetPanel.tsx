import { useState } from 'react';
import { Can } from '@/components/auth/Can';
import { ServiceRemovalReasonModal } from '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal';
import {
  useContractPppoe,
  useCreatePppoe,
  useUpdatePppoe,
  useMovePppoe,
  useDeactivatePppoe,
} from '@/hooks/usePppoe';
import { useUpdateContractService } from '@/hooks/useContractServices';
import { useNasServers } from '@/hooks/useNas';
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

/** The active local 'INTERNET' ContractService line on this contract, if any. */
function localInternetLine(services: ContractService[]): ContractService | null {
  return services.find((s) => s.name === 'INTERNET' && s.status === 'active') ?? null;
}

/**
 * PPPoE management panel for the INTERNET service of a contract.
 * Opened from ContractCard when the operator clicks the INTERNET chip or
 * picks Internet from the service picker.
 */
export function InternetPanel({ contractId, clientId, contractServices, onClose }: InternetPanelProps) {
  const pppoeQuery = useContractPppoe(contractId);
  const { data: nasServers = [] } = useNasServers();
  // Resultado terminal de la baja: 'full' (corte + historial) | 'partial' (corte OK, historial no).
  const [bajaOutcome, setBajaOutcome] = useState<null | 'full' | 'partial'>(null);

  // Resolve the local INTERNET ContractService so we can update its status on baja.
  const internetLine = localInternetLine(contractServices);

  const activePppoe = (pppoeQuery.data ?? []).find((p) => p.status === 'active') ?? null;

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
        internetLine={internetLine}
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
        <CreatePppoeForm
          contractId={contractId}
          clientId={clientId}
          nasServers={nasServers}
        />
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

// ── Crear PPPoE ──────────────────────────────────────────────────────────────

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    } catch (err) {
      const status = errorStatus(err);
      if (status === 409) {
        setError('Ese usuario PPPoE ya existe (en este u otro router). Usá otro nombre.');
      } else {
        setError('No se pudo cargar el PPPoE. Revisá los datos e intentá de nuevo.');
      }
    }
  }

  return (
    <section className={styles.card}>
      <h4 className={styles.cardTitle}>Cargar PPPoE</h4>
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
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="pppoe-remote-address">
              IP remota
            </label>
            <input
              id="pppoe-remote-address"
              className={styles.input}
              value={form.remoteAddress}
              onChange={(e) => setForm((f) => ({ ...f, remoteAddress: e.target.value }))}
              disabled={create.isPending}
              placeholder="Opcional"
            />
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
    </section>
  );
}

// ── PPPoE activo ──────────────────────────────────────────────────────────────

function ActivePppoeView({
  contractId,
  clientId,
  pppoe,
  internetLine,
  nasServers,
  onBaja,
}: {
  contractId: string;
  clientId: string | number;
  pppoe: PppoeServiceDto;
  internetLine: ContractService | null;
  nasServers: { id: string; name: string }[];
  onBaja: (outcome: 'full' | 'partial') => void;
}) {
  const update = useUpdatePppoe(contractId, clientId);
  const move = useMovePppoe(contractId, clientId);
  const deactivate = useDeactivatePppoe(contractId, clientId);
  const updateService = useUpdateContractService(String(clientId));

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
    // 1) Corte real en el router (DELETE /pppoe/:id).
    try {
      await deactivate.mutateAsync(pppoe.id);
    } catch (err) {
      const status = errorStatus(err);
      if (status === 404) {
        // El PPPoE ya no estaba en el router → idempotente, seguimos a registrar el historial.
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
    // 2) Registra la baja + motivo en el historial (PATCH ContractService INTERNET).
    //    Si no hay línea INTERNET o el PATCH falla, el corte YA se hizo → 'partial' (no mentimos).
    let historyOk = false;
    if (internetLine) {
      try {
        await updateService.mutateAsync({
          contractId,
          id: internetLine.id,
          payload: { status: 'inactive', reason },
        });
        historyOk = true;
      } catch {
        historyOk = false;
      }
    }
    onBaja(historyOk ? 'full' : 'partial');
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
            </dl>
            <div className={styles.badgeRow}>
              {pppoe.status === 'active' ? (
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
              disabled={deactivate.isPending || updateService.isPending}
            >
              {deactivate.isPending || updateService.isPending ? 'Dando de baja…' : 'Dar de baja PPPoE'}
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
    </div>
  );
}
