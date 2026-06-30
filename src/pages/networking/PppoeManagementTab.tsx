/**
 * PppoeManagementTab — Tab de gestión global de servicios PPPoE.
 *
 * Phases 6 & 7 del cambio pppoe-full-mgmt-fe.
 *
 * Tabla server-side paginada de TODOS los PPPoE (incluyendo huérfanos).
 * Filtros: búsqueda (debounced), NAS, estado.
 * Acciones por fila (gated pppoe.manage): editar, renombrar, mover NAS,
 * suspender/reactivar, baja, revelar contraseña.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAllPppoe } from '@/hooks/useInternetServices';
import { useNasServers } from '@/hooks/useNas';
import { usePlans } from '@/hooks/usePlans';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import {
  useCreatePppoeStandalone,
  useRenamePppoe,
  useUpdatePppoeGlobal,
  useMovePppoeGlobal,
  useDeactivatePppoeGlobal,
  usePppoeCredentials,
} from '@/hooks/usePppoe';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { Can } from '@/components/auth/Can';
import { KebabMenu } from '@/components/atoms/KebabMenu/KebabMenu';
import type { PppoeServiceListItem, InternetServiceStatus } from '@/types/internetService';
import { INTERNET_STATUS_LABELS as STATUS_LABELS } from '@/types/internetService';
import type { UpdatePppoeBody } from '@/api/pppoe.api';
import styles from './PppoeManagementTab.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

const STATUS_OPTIONS: InternetServiceStatus[] = ['active', 'reduced', 'blocked', 'baja', 'inactive'];

// ── Inline icons ──────────────────────────────────────────────────────────────
type IcoProps = { className?: string };

const IconSearch = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const IconPlus = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconWarning = ({ className }: IcoProps) => (
  <svg className={`${styles.warnIco} ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Sin contrato asociado">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);

const IconEye = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const IconPppoe = ({ className }: IcoProps) => (
  <svg className={`${styles.ico} ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3v4M17 3v4M7 7h10a2 2 0 0 1 2 2v2a6 6 0 0 1-12 0V9a2 2 0 0 1 2-2z" />
    <path d="M12 15v6M9 21h6" />
  </svg>
);

// ── Debounce ──────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Status badge mapping ───────────────────────────────────────────────────────
function PppoeStatusBadge({ status }: { status: string }) {
  const s = status as InternetServiceStatus;
  const variantMap: Record<string, 'active' | 'blocked' | 'inactive' | 'baja' | 'late'> = {
    active: 'active',
    reduced: 'late',   // F3: ámbar, no verde — alineado con InternetServicesPage
    blocked: 'blocked',
    baja: 'baja',
    inactive: 'inactive',
  };
  const labelMap: Record<string, string> = {
    active: 'Activo',
    reduced: 'Reducido',
    blocked: 'Bloqueado',
    baja: 'Baja',
    inactive: 'Inactivo',
  };
  const variant = variantMap[s] ?? 'inactive';
  const label = labelMap[s] ?? s;
  return <StatusBadge status={variant} label={label} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: credentials reveal (lazy per-row)
// ─────────────────────────────────────────────────────────────────────────────
function CredentialsCell({ pppoeId }: { pppoeId: string }) {
  const [revealed, setRevealed] = useState(false);
  const { data, isLoading } = usePppoeCredentials(pppoeId, revealed);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {revealed && data ? (
        <span className={styles.credentialPwd}>{data.password}</span>
      ) : null}
      <button
        className={styles.eyeBtn}
        onClick={() => setRevealed(r => !r)}
        aria-label={revealed ? 'Ocultar contraseña' : 'Revelar contraseña'}
        disabled={isLoading}
        title={revealed ? 'Ocultar contraseña' : 'Revelar contraseña'}
      >
        <IconEye />
      </button>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Crear PPPoE standalone
// ─────────────────────────────────────────────────────────────────────────────
interface CreateModalProps {
  nasOptions: { id: string; name: string }[];
  planOptions: { code: string; name: string }[];
  onClose: () => void;
  onCreate: (body: {
    username: string;
    password: string;
    nasId: string;
    plan: string;
    framedIp?: string;
    ipMode?: 'fixed' | 'pool';
  }) => Promise<void>;
  isPending: boolean;
}

function CreatePppoeModal({ nasOptions, planOptions, onClose, onCreate, isPending }: CreateModalProps) {
  const [nasId, setNasId] = useState(nasOptions[0]?.id ?? '');
  const [plan, setPlan] = useState(planOptions[0]?.code ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ipMode, setIpMode] = useState<'pool' | 'fixed'>('pool');
  const [framedIp, setFramedIp] = useState('');
  // F2: error inline para feedback cuando la mutación rechaza
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onCreate({
        username,
        password,
        nasId,
        plan,
        ipMode,
        ...(ipMode === 'fixed' && framedIp ? { framedIp } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el PPPoE.');
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-modal-title">
        <h2 className={styles.modalTitle} id="create-modal-title">Crear PPPoE</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="create-nas">NAS</label>
              <select id="create-nas" value={nasId} onChange={e => setNasId(e.target.value)} required aria-label="NAS">
                {nasOptions.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="create-plan">Plan</label>
              <select id="create-plan" value={plan} onChange={e => setPlan(e.target.value)} required aria-label="Plan">
                {planOptions.map(p => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="create-user">Usuario</label>
              <input
                id="create-user"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="off"
                aria-label="Usuario"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="create-pass">Contraseña</label>
              <input
                id="create-pass"
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                aria-label="Contraseña"
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="create-ipmode">Modo IP</label>
              <select id="create-ipmode" value={ipMode} onChange={e => setIpMode(e.target.value as 'pool' | 'fixed')} aria-label="Modo IP">
                <option value="pool">Pool (dinámica)</option>
                <option value="fixed">Fija</option>
              </select>
            </div>
            {ipMode === 'fixed' && (
              <div className={styles.formGroup}>
                <label htmlFor="create-ip">IP fija</label>
                <input
                  id="create-ip"
                  type="text"
                  value={framedIp}
                  onChange={e => setFramedIp(e.target.value)}
                  placeholder="ej. 10.0.0.100"
                  aria-label="IP fija"
                />
              </div>
            )}
          </div>
          <div className={styles.modalNote}>
            El contrato se puede asociar después desde la ficha del cliente.
          </div>
          {error && (
            <div className={styles.partialAlert} role="alert">{error}</div>
          )}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={isPending}>
              {isPending ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Editar PPPoE
// ─────────────────────────────────────────────────────────────────────────────
interface EditModalProps {
  item: PppoeServiceListItem;
  planOptions: { code: string; name: string }[];
  onClose: () => void;
  onSave: (body: UpdatePppoeBody) => Promise<void>;
  isPending: boolean;
}

function EditPppoeModal({ item, planOptions, onClose, onSave, isPending }: EditModalProps) {
  // F5: calcular el status inicial una sola vez para comparación posterior
  const initialStatus: 'enabled' | 'disabled' =
    item.status === 'blocked' || item.status === 'baja' || item.status === 'inactive'
      ? 'disabled'
      : 'enabled';

  const [profile, setProfile] = useState(item.profile ?? '');
  const [password, setPassword] = useState('');
  const [remoteAddress, setRemoteAddress] = useState(item.remoteAddress ?? '');
  const [status, setStatus] = useState<'enabled' | 'disabled'>(initialStatus);
  // F2: error inline
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body: UpdatePppoeBody = {};
    if (profile) body.profile = profile;
    if (password) body.password = password;
    if (item.ipMode === 'fixed' && remoteAddress) body.remoteAddress = remoteAddress;
    // F5: incluir status SOLO si el operador lo cambió respecto al inicial
    if (status !== initialStatus) body.status = status;
    try {
      await onSave(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar los cambios.');
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
        <h2 className={styles.modalTitle} id="edit-modal-title">Editar PPPoE — {item.username}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-plan">Plan</label>
              <select id="edit-plan" value={profile} onChange={e => setProfile(e.target.value)} aria-label="Plan">
                <option value="">Sin cambio</option>
                {/* F11: si el plan actual no está en activePlans (ej: plan Corte/disabled),
                    mostrarlo como opción deshabilitada para que el select no quede vacío */}
                {item.profile && !planOptions.some(p => p.code === item.profile) && (
                  <option value={item.profile} disabled>{item.profile} (actual — plan no disponible)</option>
                )}
                {planOptions.map(p => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-status">Estado</label>
              <select id="edit-status" value={status} onChange={e => setStatus(e.target.value as 'enabled' | 'disabled')} aria-label="Estado">
                <option value="enabled">Habilitado</option>
                <option value="disabled">Suspendido</option>
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-pass">Nueva contraseña <span className={styles.muted}>(dejar vacío para no cambiar)</span></label>
            <input
              id="edit-pass"
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="(sin cambio)"
              aria-label="Nueva contraseña"
            />
          </div>
          {item.ipMode === 'fixed' && (
            <div className={styles.formGroup}>
              <label htmlFor="edit-ip">IP fija</label>
              <input
                id="edit-ip"
                type="text"
                value={remoteAddress}
                onChange={e => setRemoteAddress(e.target.value)}
                placeholder="ej. 10.0.0.100"
                aria-label="IP fija"
              />
            </div>
          )}
          {error && (
            <div className={styles.partialAlert} role="alert">{error}</div>
          )}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Renombrar (recrea secret RADIUS)
// ─────────────────────────────────────────────────────────────────────────────
interface RenameModalProps {
  item: PppoeServiceListItem;
  onClose: () => void;
  onRename: (newUsername: string) => Promise<{ status: 'ok' | 'partial'; message?: string } | null>;
  isPending: boolean;
}

function RenameModal({ item, onClose, onRename, isPending }: RenameModalProps) {
  const [newUsername, setNewUsername] = useState('');
  const [partialMsg, setPartialMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPartialMsg(null);
    try {
      const result = await onRename(newUsername);
      // F4: tratar partial SIEMPRE como advertencia, con mensaje default si no vino
      if (result?.status === 'ok') {
        onClose();
      } else if (result?.status === 'partial') {
        setPartialMsg(result.message ?? 'Rename parcial: el secret nuevo fue creado pero el viejo no pudo eliminarse. Revisá el RADIUS.');
      } else {
        // null o status desconocido: no cerrar el modal — respuesta inesperada del servidor
        setPartialMsg('Respuesta inesperada del servidor. Verificá el estado del secret en el RADIUS.');
      }
    } catch (err) {
      // F2: mostrar error si la mutación rechaza
      setPartialMsg(err instanceof Error ? err.message : 'No se pudo renombrar el usuario PPPoE.');
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="rename-modal-title">
        <h2 className={styles.modalTitle} id="rename-modal-title">Cambiar usuario PPPoE</h2>
        <div className={styles.renameWarning}>
          <strong>Atención:</strong> Esto recrea el secret en el RADIUS y desconecta al cliente.
          Hay que reconfigurar el CPE con el nuevo usuario.
        </div>
        {partialMsg && (
          <div className={styles.partialAlert} role="alert">
            {partialMsg}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="rename-user">Usuario actual: <code>{item.username}</code></label>
            <input
              id="rename-user"
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="Nuevo nombre de usuario"
              required
              autoFocus
              aria-label="Nuevo usuario"
            />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={isPending || !newUsername}>
              {isPending ? 'Renombrando…' : 'Renombrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Mover a otro NAS
// ─────────────────────────────────────────────────────────────────────────────
interface MoveNasModalProps {
  item: PppoeServiceListItem;
  nasOptions: { id: string; name: string }[];
  onClose: () => void;
  onMove: (nasId: string) => Promise<void>;
  isPending: boolean;
}

function MoveNasModal({ item, nasOptions, onClose, onMove, isPending }: MoveNasModalProps) {
  const [nasId, setNasId] = useState('');
  // F2: error inline
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nasId) return;
    setError(null);
    try {
      await onMove(nasId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover el PPPoE al nuevo NAS.');
    }
  }

  const availableNas = nasOptions.filter(n => n.id !== item.nasId);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="move-modal-title">
        <h2 className={styles.modalTitle} id="move-modal-title">Mover NAS — {item.username}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="move-nas">NAS destino</label>
            <select id="move-nas" value={nasId} onChange={e => setNasId(e.target.value)} required aria-label="NAS destino">
              <option value="">Seleccionar NAS…</option>
              {availableNas.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>
          {error && (
            <div className={styles.partialAlert} role="alert">{error}</div>
          )}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={isPending || !nasId}>
              {isPending ? 'Moviendo…' : 'Mover'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function PppoeManagementTab() {
  // ── filters
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [nasId, setNasId] = useState('');
  const [status, setStatus] = useState<InternetServiceStatus | ''>('');
  const [page, setPage] = useState(1);

  // ── F2: error state para kebab actions (deactivate/suspend/reactivate)
  const [actionError, setActionError] = useState<string | null>(null);

  // ── modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<PppoeServiceListItem | null>(null);
  const [renamingItem, setRenamingItem] = useState<PppoeServiceListItem | null>(null);
  const [movingItem, setMovingItem] = useState<PppoeServiceListItem | null>(null);

  // ── data
  const { data: listData, isLoading, isError, isFetching, refetch } = useAllPppoe({
    includeUnassigned: true,
    search: search || undefined,
    nasId: nasId || undefined,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const { data: nasServers = [] } = useNasServers();
  const { data: plans = [] } = usePlans();

  const { can } = useMyPermissions();
  const canManage = can('pppoe.manage');
  const confirm = useConfirm();

  // ── mutations
  const createMutation = useCreatePppoeStandalone();
  const renameMutation = useRenamePppoe();
  const updateMutation = useUpdatePppoeGlobal();
  const moveMutation = useMovePppoeGlobal();
  const deactivateMutation = useDeactivatePppoeGlobal();

  // ── derived
  const items = listData?.data ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Filter plans: enabled + not Corte category
  const activePlans = plans.filter(p => p.status === 'enabled' && p.category !== 'Corte');

  const nasOptions = nasServers.map(n => ({ id: n.id, name: n.name }));

  // Reset page on filter change
  function handleSearch(v: string) { setSearchRaw(v); setPage(1); }
  function handleNas(v: string) { setNasId(v); setPage(1); }
  function handleStatus(v: string) { setStatus(v as InternetServiceStatus | ''); setPage(1); }

  // ── action handlers — F2: await + try/catch con feedback visible
  async function handleDeactivate(item: PppoeServiceListItem) {
    const ok = await confirm({
      message: `¿Dar de baja "${item.username}"? Se eliminará del router.`,
      tone: 'danger',
      confirmLabel: 'Dar de baja',
    });
    if (!ok) return;
    setActionError(null);
    try {
      await deactivateMutation.mutateAsync({ id: item.id });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo dar de baja el servicio PPPoE.');
    }
  }

  async function handleSuspend(item: PppoeServiceListItem) {
    const ok = await confirm({
      message: `¿Suspender "${item.username}"?`,
      confirmLabel: 'Suspender',
    });
    if (!ok) return;
    setActionError(null);
    try {
      await updateMutation.mutateAsync({ id: item.id, body: { status: 'disabled' } });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo suspender el servicio PPPoE.');
    }
  }

  async function handleReactivate(item: PppoeServiceListItem) {
    const ok = await confirm({
      message: `¿Reactivar "${item.username}"?`,
      confirmLabel: 'Reactivar',
    });
    if (!ok) return;
    setActionError(null);
    try {
      await updateMutation.mutateAsync({ id: item.id, body: { status: 'enabled' } });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo reactivar el servicio PPPoE.');
    }
  }

  function buildRowActions(item: PppoeServiceListItem) {
    // F8: item en baja no ofrece Suspender ni Reactivar
    if (item.status === 'baja') {
      return [
        { label: 'Editar', onClick: () => setEditingItem(item) },
        { label: 'Cambiar usuario', onClick: () => setRenamingItem(item) },
        { label: 'Mover NAS', onClick: () => setMovingItem(item) },
        { label: 'Baja', onClick: () => handleDeactivate(item) },
      ];
    }
    const isSuspended = item.status === 'blocked' || item.status === 'inactive';
    return [
      { label: 'Editar', onClick: () => setEditingItem(item) },
      { label: 'Cambiar usuario', onClick: () => setRenamingItem(item) },
      { label: 'Mover NAS', onClick: () => setMovingItem(item) },
      ...(isSuspended
        ? [{ label: 'Reactivar', onClick: () => handleReactivate(item) }]
        : [{ label: 'Suspender', onClick: () => handleSuspend(item) }]
      ),
      { label: 'Baja', onClick: () => handleDeactivate(item) },
    ];
  }

  return (
    <div className={styles.tab}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.filter}>
          <IconSearch />
          <input
            placeholder="Buscar usuario, cliente…"
            value={searchRaw}
            onChange={e => handleSearch(e.target.value)}
            aria-label="Buscar PPPoE"
          />
        </div>

        <select
          className={styles.routerSelect}
          aria-label="Filtrar por NAS"
          value={nasId}
          onChange={e => handleNas(e.target.value)}
        >
          <option value="">Todos los NAS</option>
          {nasServers.map(n => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>

        <select
          className={styles.routerSelect}
          aria-label="Filtrar por estado"
          value={status}
          onChange={e => handleStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <span className={styles.toolbarRight}>
          {total > 0 ? `${total} servicio${total === 1 ? '' : 's'}` : ''}
          {isFetching && !isLoading ? ' · actualizando…' : ''}
        </span>

        <Can permission="pppoe.manage">
          <button
            className={styles.btnPrimary}
            onClick={() => setShowCreate(true)}
          >
            <IconPlus />Crear PPPoE
          </button>
        </Can>
      </div>

      {/* ── F2: error banner para acciones kebab (deactivate/suspend/reactivate) ── */}
      {actionError && (
        <div className={styles.errorPanel} role="alert">
          {actionError}
          <button className={styles.btnRetry} onClick={() => setActionError(null)}>×</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Cliente</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>IP</th>
              <th>NAS</th>
              {/* F1: columna Contraseña solo visible con pppoe.manage */}
              {canManage && <th>Contraseña</th>}
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {isError ? (
              <tr>
                <td colSpan={canManage ? 8 : 6}>
                  <div className={styles.errorPanel} role="alert">
                    No se pudo cargar los servicios PPPoE.
                    <button className={styles.btnRetry} onClick={() => refetch()}>
                      Reintentar
                    </button>
                  </div>
                </td>
              </tr>
            ) : isLoading ? (
              <tr>
                <td colSpan={canManage ? 8 : 6}>
                  <div role="status" className={styles.skeleton} aria-label="Cargando…" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 6}>
                  <div className={styles.empty}>
                    <IconPppoe className={styles.emptyIcon} />
                    <h3 className={styles.emptyTitle}>No se encontraron servicios PPPoE.</h3>
                    <p>Probá ajustando los filtros o creá un servicio nuevo.</p>
                  </div>
                </td>
              </tr>
            ) : items.map(item => (
              <tr key={item.id} className={styles.bodyRow}>
                {/* Username */}
                <td className={`${styles.nm} ${styles.mono}`}>{item.username}</td>

                {/* Cliente */}
                <td>
                  <span className={styles.clientCell}>
                    {/* F9: "Sin contrato" se decide por contractId, no clientId */}
                    {item.contractId == null ? (
                      <>
                        <IconWarning />
                        <span className={styles.orphanText}>Sin contrato</span>
                      </>
                    ) : item.clientId ? (
                      <Link
                        className={styles.clientLink}
                        to={`/admin/customers/view/${item.clientId}`}
                      >
                        {item.customerName ?? item.clientId}
                      </Link>
                    ) : (
                      <span className={styles.muted}>{item.customerName ?? '—'}</span>
                    )}
                  </span>
                </td>

                {/* Plan */}
                <td className={styles.muted}>{item.profile ?? '—'}</td>

                {/* Estado */}
                <td><PppoeStatusBadge status={item.status} /></td>

                {/* IP */}
                <td className={styles.mono}>
                  {item.remoteAddress ?? '—'}
                  {item.ipMode === 'fixed' && (
                    <span className={styles.badgeFixed}>fija</span>
                  )}
                </td>

                {/* NAS */}
                <td className={styles.muted}>{item.nasName ?? item.nasId}</td>

                {/* Credenciales — F1: solo visible con pppoe.manage */}
                {canManage && (
                  <td>
                    <CredentialsCell pppoeId={item.id} />
                  </td>
                )}

                {/* Acciones */}
                {canManage && (
                  <td className={styles.actionsCell}>
                    <KebabMenu items={buildRowActions(item)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {/* ── Modals ── */}
      {showCreate && (
        <CreatePppoeModal
          nasOptions={nasOptions}
          planOptions={activePlans.map(p => ({ code: p.code, name: p.name }))}
          onClose={() => setShowCreate(false)}
          onCreate={async body => {
            await createMutation.mutateAsync(body);
            setShowCreate(false);
          }}
          isPending={createMutation.isPending}
        />
      )}

      {editingItem && (
        <EditPppoeModal
          item={editingItem}
          planOptions={activePlans.map(p => ({ code: p.code, name: p.name }))}
          onClose={() => setEditingItem(null)}
          onSave={async body => {
            await updateMutation.mutateAsync({ id: editingItem.id, body });
            setEditingItem(null);
          }}
          isPending={updateMutation.isPending}
        />
      )}

      {renamingItem && (
        <RenameModal
          item={renamingItem}
          onClose={() => setRenamingItem(null)}
          onRename={async newUsername => {
            const result = await renameMutation.mutateAsync({ id: renamingItem.id, newUsername });
            return result;
          }}
          isPending={renameMutation.isPending}
        />
      )}

      {movingItem && (
        <MoveNasModal
          item={movingItem}
          nasOptions={nasOptions}
          onClose={() => setMovingItem(null)}
          onMove={async targetNasId => {
            await moveMutation.mutateAsync({ id: movingItem.id, nasId: targetNasId });
            setMovingItem(null);
          }}
          isPending={moveMutation.isPending}
        />
      )}
    </div>
  );
}
