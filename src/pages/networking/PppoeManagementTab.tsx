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
import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  useBulkChangePppoePlan,
  useBulkChangePppoePlanBatch,
  useListPppoeIds,
  GLOBAL_LIST_KEY,
} from '@/hooks/usePppoe';
import type { BulkChangePlanResult } from '@/api/pppoe.api';
import { runPppoeBulkBatches, BULK_BATCH_SIZE } from '@/utils/pppoeBulkBatches';
import type { PppoeBulkBatchProgress, PppoeBulkBatchCut, PppoeBulkBatchCancelled } from '@/utils/pppoeBulkBatches';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { Can } from '@/components/auth/Can';
import { KebabMenu } from '@/components/atoms/KebabMenu/KebabMenu';
import type { PppoeServiceListItem, InternetServiceStatus } from '@/types/internetService';
import { INTERNET_STATUS_LABELS as STATUS_LABELS } from '@/types/internetService';
import type { PppoeServiceDto, IpTypePreference } from '@/types/pppoe';
import type { UpdatePppoeBody } from '@/api/pppoe.api';
import { isPppoeMovePublicIpError, mapPppoeMoveError } from '@/utils/mapPppoeMoveError';
import styles from './PppoeManagementTab.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

// W1 → v2 (pppoe-bulk-select-filter): YA NO es un tope duro de selección.
// Fix pppoe-bulk-batch-timeout: dejó de ser también el tamaño de lote (ver
// BULK_BATCH_SIZE en pppoeBulkBatches.ts, ahora 25) — un lote de 200 con el
// throttle serial del BE tarda 2-4min y el proxy corta la conexión antes de
// que la respuesta vuelva. BULK_SELECTION_CAP sigue existiendo SOLO para
// gatear el checkbox de confirmación explícita ("Entiendo que voy a cambiar
// el plan de N servicios") por encima de este umbral, y sigue alineado al
// guard del BE MAX_BULK_IDS=200 (BulkChangePppoePlan, sin tocar) — un request
// individual nunca puede superar 200 ids, independientemente del tamaño de lote.
const BULK_SELECTION_CAP = 200;

const STATUS_OPTIONS: InternetServiceStatus[] = ['active', 'reduced', 'blocked', 'baja', 'inactive'];

/**
 * Sentinel del selector NAS del modal de crear para la pre-provisión SIN router
 * (pppoe-preprovision): el submit va sin `nasId` y el watcher adopta el servicio
 * cuando el cliente conecta. No colisiona con ids reales de NAS.
 */
const NO_ROUTER_VALUE = '__no_router__';

/**
 * Query param (namespace del tab PPPoE) del filtro rápido "Pendientes".
 * Round-trip en URL: recargar/compartir el link restaura el filtro.
 */
const PENDING_FILTER_PARAM = 'pppoe_pending';

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
    plan: string;
    ipTypePreference: IpTypePreference;
    /** Ausente = pre-provisión sin router (auto-instalación). */
    nasId?: string;
    framedIp?: string;
    ipMode?: 'fixed' | 'pool';
  }) => Promise<void>;
  isPending: boolean;
}

function CreatePppoeModal({ nasOptions, planOptions, onClose, onCreate, isPending }: CreateModalProps) {
  // S5.4: sin regresión — el flujo con router sigue preseleccionando el primer NAS.
  const [nasId, setNasId] = useState(nasOptions[0]?.id ?? '');
  const [plan, setPlan] = useState(planOptions[0]?.code ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ipMode, setIpMode] = useState<'pool' | 'fixed'>('pool');
  const [framedIp, setFramedIp] = useState('');
  // S5.1: tipo de IP OBLIGATORIO sin preselección — decisión consciente del operador.
  const [ipType, setIpType] = useState<IpTypePreference | null>(null);
  // F2: error inline para feedback cuando la mutación rechaza
  const [error, setError] = useState<string | null>(null);

  /** Pre-provisión sin router: los campos de IP no aplican (los asigna la adopción). */
  const isNoRouter = nasId === NO_ROUTER_VALUE;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ipType) return;
    setError(null);
    try {
      await onCreate({
        username,
        password,
        plan,
        ipTypePreference: ipType,
        // S5.2: sin router el body va SIN nasId/ipMode/framedIp (pre-provisión).
        ...(isNoRouter
          ? {}
          : {
              nasId,
              ipMode,
              ...(ipMode === 'fixed' && framedIp ? { framedIp } : {}),
            }),
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
              <select
                id="create-nas"
                value={nasId}
                onChange={e => {
                  const value = e.target.value;
                  // W1: cruzar el límite router↔"Sin router" (en cualquier
                  // dirección) invalida el modo/IP elegidos — una IP fija
                  // tipeada para el pool de un router viejo NO debe viajar
                  // en el submit hacia otro router (espejo del InternetPanel).
                  const crossesSentinel =
                    (value === NO_ROUTER_VALUE) !== (nasId === NO_ROUTER_VALUE);
                  if (crossesSentinel) {
                    setIpMode('pool');
                    setFramedIp('');
                  }
                  setNasId(value);
                }}
                required
                aria-label="NAS"
                aria-describedby={isNoRouter ? 'create-no-router-hint' : undefined}
              >
                {/* S5.2: primera opción — pre-provisión / auto-instalación */}
                <option value={NO_ROUTER_VALUE}>Sin router — auto-instalación</option>
                {nasOptions.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
              {isNoRouter && (
                <p id="create-no-router-hint" className={styles.noRouterHint}>
                  El sistema asigna el NAS y la IP fija automáticamente cuando el cliente se conecta por primera vez.
                </p>
              )}
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
          {/* S5.1: Tipo de IP — obligatorio, sin preselección */}
          <div className={styles.formGroup}>
            <span className={styles.ipTypeLabel}>
              Tipo de IP <span aria-hidden="true">*</span>
            </span>
            <div
              className={styles.ipTypeToggle}
              role="group"
              aria-label="Tipo de IP"
              aria-describedby={!ipType ? 'create-iptype-hint' : undefined}
            >
              <button
                type="button"
                className={`${styles.ipTypeBtn} ${ipType === 'cgnat' ? styles.ipTypeBtnActive : ''}`}
                onClick={() => setIpType('cgnat')}
                disabled={isPending}
                aria-pressed={ipType === 'cgnat'}
              >
                Privada
              </button>
              <button
                type="button"
                className={`${styles.ipTypeBtn} ${ipType === 'public' ? styles.ipTypeBtnActive : ''}`}
                onClick={() => setIpType('public')}
                disabled={isPending}
                aria-pressed={ipType === 'public'}
              >
                Pública
              </button>
            </div>
            {!ipType && (
              <p id="create-iptype-hint" className={styles.ipTypeHint}>
                Elegí el tipo de IP
              </p>
            )}
          </div>
          {/* S5.2: sin router los campos de IP se ocultan (no aplican) */}
          {!isNoRouter && (
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
          )}
          <div className={styles.modalNote}>
            El contrato se puede asociar después desde la ficha del cliente.
          </div>
          {error && (
            <div className={styles.partialAlert} role="alert">{error}</div>
          )}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            {/* W5: el hint del tipo de IP también describe el submit deshabilitado —
                un SR parado en el botón sabe por qué no puede enviar. */}
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isPending || !ipType}
              aria-describedby={!ipType ? 'create-iptype-hint' : undefined}
            >
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
// Modal: Mover a otro NAS (radius-aware, pppoe-move-nas W1 — REQ-FE-1)
// ─────────────────────────────────────────────────────────────────────────────
interface MoveNasModalProps {
  item: PppoeServiceListItem;
  nasOptions: { id: string; name: string }[];
  onClose: () => void;
  /** Devuelve el DTO actualizado (con la IP nueva) para mostrarla (S9.2). */
  onMove: (nasId: string, force?: boolean) => Promise<PppoeServiceDto>;
  isPending: boolean;
}

function MoveNasModal({ item, nasOptions, onClose, onMove, isPending }: MoveNasModalProps) {
  const [nasId, setNasId] = useState('');
  // F2: error inline (mapeado por código del wire contract)
  const [error, setError] = useState<string | null>(null);
  // S9.3: el BE respondió 409 PPPOE_MOVE_PUBLIC_IP → pedir confirmación explícita
  const [publicIpWarning, setPublicIpWarning] = useState(false);
  // S9.2: DTO post-move para mostrar la IP nueva (el modal NO se cierra solo)
  const [moved, setMoved] = useState<PppoeServiceDto | null>(null);

  async function doMove(force: boolean) {
    setError(null);
    try {
      const dto = await onMove(nasId, force || undefined);
      setPublicIpWarning(false);
      setMoved(dto);
    } catch (err) {
      if (!force && isPppoeMovePublicIpError(err)) {
        // Paso 1 del flujo force: NUNCA reintentar solo — decide el operador.
        setPublicIpWarning(true);
      } else {
        setError(mapPppoeMoveError(err));
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Con el warning force visible, Enter en el select re-dispararía el POST
    // sin force (redundante). El único camino es "Sí, mover igual" o Cancelar.
    if (publicIpWarning) return;
    if (!nasId) return;
    await doMove(false);
  }

  function handleNasChange(value: string) {
    setNasId(value);
    // Cambiar el destino invalida el warning de IP pública (vuelve al paso 1).
    setPublicIpWarning(false);
    setError(null);
  }

  const availableNas = nasOptions.filter(n => n.id !== item.nasId);
  const movedNasName = moved ? (nasOptions.find(n => n.id === moved.nasId)?.name ?? moved.nasId) : null;

  // S3: pendiente de instalación (pre-provisión sin router) — no hay sesión que
  // desconectar ni IP que reemplazar: el copy del move es el de una ASIGNACIÓN.
  const isPendingInstall = item.nasId == null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="move-modal-title">
        <h2 className={styles.modalTitle} id="move-modal-title">Mover NAS — {item.username}</h2>

        {moved ? (
          // ── Resultado (S9.2): IP nueva visible, cierre explícito ──
          <>
            <div className={styles.successAlert} role="status">
              {isPendingInstall ? (
                // S3: adopción manual del pendiente — no había sesión.
                <>
                  <strong>PPPoE asignado a {movedNasName}.</strong>{' '}
                  IP fija asignada: <code className={styles.mono}>{moved.remoteAddress ?? '—'}</code>.
                  El cliente queda listo para conectarse con este router.
                </>
              ) : (
                <>
                  <strong>PPPoE movido a {movedNasName}.</strong>{' '}
                  IP nueva asignada: <code className={styles.mono}>{moved.remoteAddress ?? '—'}</code>.
                  La sesión fue desconectada; el cliente reconecta con la IP nueva.
                </>
              )}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* S9.1: aviso honesto ANTES de confirmar. S3: para el pendiente no
                hay sesión que desconectar — variante de asignación. */}
            <div className={styles.renameWarning}>
              {isPendingInstall ? (
                <>
                  <strong>Atención:</strong> Se asignará al router elegido con IP fija de su pool.
                </>
              ) : (
                <>
                  <strong>Atención:</strong> Se asignará una IP nueva del pool del NAS destino
                  y se desconectará la sesión del cliente para que reconecte con la IP nueva.
                </>
              )}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="move-nas">NAS destino</label>
              <select id="move-nas" value={nasId} onChange={e => handleNasChange(e.target.value)} required aria-label="NAS destino">
                <option value="">Seleccionar NAS…</option>
                {availableNas.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
            {publicIpWarning && (
              /* S9.3 paso 2: warning fuerte + confirmación explícita.
                 Copy HONESTO: el guard del BE es FAIL-CLOSED — el 409
                 PPPOE_MOVE_PUBLIC_IP salta para TODA IP no clasificada
                 positivamente como CGNAT (pública O de un pool sin cargar). */
              <div className={styles.publicIpWarning} role="alert">
                <strong>Este servicio tiene una IP pública fija o no clasificada como CGNAT.</strong>{' '}
                Moverlo la reemplazará por una IP CGNAT del pool del NAS destino
                (si era pública, se libera). ¿Continuar?
              </div>
            )}
            {error && (
              <div className={styles.partialAlert} role="alert">{error}</div>
            )}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
              {publicIpWarning ? (
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={isPending}
                  onClick={() => doMove(true)}
                >
                  {isPending ? 'Moviendo…' : 'Sí, mover igual'}
                </button>
              ) : (
                <button type="submit" className={styles.btnPrimary} disabled={isPending || !nasId}>
                  {isPending ? 'Moviendo…' : 'Mover'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// W2: extrae el mensaje/code real del BE de un error axios (ej. 422
// BULK_TOO_LARGE, PLAN_NOT_FOUND) en vez del genérico err.message de axios
// ("Request failed with status code 422"). Cae al fallback si el error no
// trae el shape de respuesta axios (ej. error de red).
// ─────────────────────────────────────────────────────────────────────────────
function bulkErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data;
  return data?.error ?? data?.code ?? fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Bulk cambio de plan
// ─────────────────────────────────────────────────────────────────────────────
interface BulkChangePlanModalProps {
  selectedCount: number;
  planOptions: { code: string; name: string }[];
  onClose: () => void;
  onConfirm: (profile: string, reason?: string) => Promise<void>;
  isPending: boolean;
  result: BulkChangePlanResult | null;
  /** Progreso del lote en vuelo — solo hay valor durante un envío en lotes (>BULK_BATCH_SIZE). */
  progress: PppoeBulkBatchProgress | null;
  /** Corte por rechazo de lote entero — null = no hubo corte (o no aplica, N<=BULK_BATCH_SIZE). */
  cut: PppoeBulkBatchCut | null;
  /**
   * Fix pppoe-bulk-batch-timeout: ids del lote que rechazó por transporte
   * (causa del `cut`). Estado DESCONOCIDO en el servidor — nunca "0 aplicados".
   * Vacío cuando `cut` es null.
   */
  unconfirmed: string[];
  /**
   * Ola 2 (pedido del usuario 2026-07-02): la corrida se detuvo porque el
   * operador clickeó "Cortar". Distinto de `cut` (rechazo de TRANSPORTE) —
   * puede convivir con `cut` cuando el lote en vuelo rechazó justo mientras
   * se pedía cortar (ver runPppoeBulkBatches). null = no se pidió cortar.
   */
  cancelled: PppoeBulkBatchCancelled | null;
  /**
   * true = esta corrida usa el orquestador de lotes (selección > BULK_BATCH_SIZE)
   * y por lo tanto habilita "Cortar" + "Continuar en segundo plano". El camino
   * directo (<=BULK_BATCH_SIZE, un solo request) queda INTACTO: "Cancelar"
   * disabled durante el envío, sin botones nuevos (no hay nada que cortar ni
   * segundo plano que valga la pena para un solo request corto).
   */
  isBatching: boolean;
  /** true entre el click en "Cortar" y el fin de la corrida (label "Cortando…"). */
  isCancelling: boolean;
  /** Ola 2: handler del botón "Cortar" (real, siempre visible/habilitado mientras corre un batch). */
  onCancelRun: () => void;
  /** Ola 2: handler de "Continuar en segundo plano" — cierra el modal SIN abortar la corrida. */
  onBackground: () => void;
}

function BulkChangePlanModal({
  selectedCount,
  planOptions,
  onClose,
  onConfirm,
  isPending,
  result,
  progress,
  cut,
  unconfirmed,
  cancelled,
  isBatching,
  isCancelling,
  onCancelRun,
  onBackground,
}: BulkChangePlanModalProps) {
  const [profile, setProfile] = useState(planOptions[0]?.code ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Decisión 6 (design.md): N>200 exige un checkbox de confirmación explícito
  // proporcional al blast radius — gatea el botón de confirmar. N<=200: flujo intacto.
  const requiresConfirmCheckbox = selectedCount > BULK_SELECTION_CAP;
  const [confirmChecked, setConfirmChecked] = useState(false);
  const canConfirm = Boolean(profile) && (!requiresConfirmCheckbox || confirmChecked);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canConfirm) return;
    setError(null);
    try {
      await onConfirm(profile, reason || undefined);
    } catch (err) {
      setError(bulkErrorMessage(err, 'No se pudo cambiar el plan.'));
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="bulk-modal-title">
        <h2 className={styles.modalTitle} id="bulk-modal-title">
          Cambiar plan — {selectedCount} servicio{selectedCount !== 1 ? 's' : ''}
        </h2>

        {/* Resumen post-bulk (o parcial, si hubo corte por lote entero) */}
        {result !== null ? (
          <div>
            {cut && (
              // Fix pppoe-bulk-batch-timeout: un rechazo de lote por transporte
              // (timeout de proxy) NO significa que el BE no haya aplicado el
              // lote — puede haber seguido procesando en background y
              // terminado igual (confirmado en prod). El mensaje ya NO afirma
              // "se aplicaron N" para el lote cortado: informa que no hubo
              // respuesta, que pudo aplicarse igual, y usa "confirmados" (no
              // "aplicados") para los conteos ya verificados hasta el corte.
              <div className={styles.partialAlert} role="alert">
                El lote {cut.cutAtBatch}/{cut.totalBatches} no obtuvo respuesta del servidor — sus cambios PUEDEN haberse aplicado igual.
                {' '}Confirmados hasta el corte: {result.ok.length} ok, {result.failed.length} fallidos.
                {' '}Los servicios sin confirmación{unconfirmed.length > 0 ? ` (${unconfirmed.length})` : ''} y los no enviados quedan seleccionados: verificá la lista y reintentá (re-aplicar el mismo plan es inofensivo).
                {cancelled && (
                  // Ola 2: cut+cancelled combinados — el cut es el mensaje
                  // primario (más grave, estado desconocido); esto solo suma
                  // la nota de que además hubo un corte manual del operador.
                  ' Además, cortaste la corrida manualmente: no se envió ningún lote después de este punto.'
                )}
              </div>
            )}
            {!cut && cancelled && (
              // Ola 2: cancelación PURA del operador (sin rechazo de
              // transporte) — el lote `cancelled.atBatch` nunca se mandó, así
              // que no hay nada "unconfirmed": todo lo enviado antes resolvió
              // de verdad (ok/failed reales).
              <div className={styles.partialAlert} role="alert">
                Corrida cortada en el lote {cancelled.atBatch} de {cancelled.totalBatches}.
                {' '}Confirmados: {result.ok.length} ok, {result.failed.length} fallidos.
                {' '}Los servicios no enviados quedan seleccionados.
              </div>
            )}
            {result.ok.length > 0 && (
              <div className={styles.bulkSuccess} role="status">
                {result.ok.length} exitoso{result.ok.length !== 1 ? 's' : ''}
              </div>
            )}
            {result.failed.length > 0 && (
              <div className={styles.partialAlert} role="alert">
                <strong>{result.failed.length} error{result.failed.length !== 1 ? 'es' : ''}:</strong>
                <ul className={styles.bulkFailedList}>
                  {result.failed.map(f => (
                    <li key={f.id}>
                      <span className={styles.bulkFailedUser}>{f.username || f.id}</span>
                      {' — '}
                      <span>{f.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnPrimary} onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="bulk-plan">Plan</label>
              <select
                id="bulk-plan"
                aria-label="Plan"
                value={profile}
                onChange={e => setProfile(e.target.value)}
                required
              >
                {planOptions.map(p => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="bulk-reason">
                Motivo <span className={styles.muted}>(opcional)</span>
              </label>
              <input
                id="bulk-reason"
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="ej. promo verano, recategorización"
                aria-label="Motivo"
              />
            </div>
            {requiresConfirmCheckbox && (
              <div className={styles.formGroup}>
                <label htmlFor="bulk-confirm-check" className={styles.checkboxLabel}>
                  <input
                    id="bulk-confirm-check"
                    type="checkbox"
                    checked={confirmChecked}
                    onChange={e => setConfirmChecked(e.target.checked)}
                  />
                  Entiendo que voy a cambiar el plan de {selectedCount} servicios
                </label>
              </div>
            )}
            {isPending && progress && (
              <div className={styles.batchProgress} role="status" aria-live="polite">
                Lote {progress.batchIndex}/{progress.totalBatches} — {progress.totalIds} servicios
              </div>
            )}
            {error && (
              <div className={styles.partialAlert} role="alert">{error}</div>
            )}
            <div className={styles.modalActions}>
              {/* Ola 2 (pedido del usuario 2026-07-02): la corrida ya NO
                  bloquea al operador. Camino directo (<=BULK_BATCH_SIZE,
                  isBatching=false) queda INTACTO: "Cancelar" disabled durante
                  el envío (un solo request corto, nada que cortar en el medio
                  ni segundo plano que valga la pena). Camino en lotes
                  (isBatching=true) reemplaza "Cancelar" por "Continuar en
                  segundo plano" (habilitado — cierra el modal SIN abortar la
                  corrida) + "Cortar" (real, siempre visible/habilitado hasta
                  que se clickea). */}
              {isPending && isBatching ? (
                <>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={onBackground}
                  >
                    Continuar en segundo plano
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={onCancelRun}
                    disabled={isCancelling}
                    title={isCancelling ? undefined : 'Corta la corrida antes del próximo lote — el lote en vuelo ya no se puede interrumpir.'}
                  >
                    {isCancelling ? 'Cortando… (termina el lote en vuelo)' : 'Cortar'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={onClose}
                  disabled={isPending}
                  title={isPending ? 'No se puede cerrar durante el envío' : undefined}
                  aria-label={isPending ? 'Cancelar — no se puede cerrar durante el envío' : undefined}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={isPending || !canConfirm}
              >
                {isPending ? 'Cambiando…' : 'Confirmar cambio'}
              </button>
            </div>
          </form>
        )}
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

  // ── S5.3: filtro rápido "Pendientes" (nasId null = pre-provisión sin instalar).
  // Vive en la URL (param namespaced del tab) para round-trip: recargar o
  // compartir el link restaura el filtro. Los writes preservan los params ajenos.
  // NOTA wire: el GET /pppoe no expone un param de pendientes — el filtro es
  // client-side sobre la página cargada (los pendientes derivan de nas null).
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingOnly = searchParams.get(PENDING_FILTER_PARAM) === '1';

  function togglePendingFilter() {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (next.get(PENDING_FILTER_PARAM) === '1') next.delete(PENDING_FILTER_PARAM);
        else next.set(PENDING_FILTER_PARAM, '1');
        return next;
      },
      { replace: true },
    );
    // C1: mismo invariante anti-TOCTOU que handleSearch/handleNas/handleStatus —
    // el chip cambia el subconjunto VISIBLE, así que la selección previa queda
    // apuntando a filas potencialmente ocultas: se limpia y se avanza la
    // generación para descartar cualquier fetch de ids que esté en vuelo.
    setSelected(new Set());
    filterGenerationRef.current += 1;
  }

  // ── F2: error state para kebab actions (deactivate/suspend/reactivate)
  const [actionError, setActionError] = useState<string | null>(null);

  // ── modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<PppoeServiceListItem | null>(null);
  const [renamingItem, setRenamingItem] = useState<PppoeServiceListItem | null>(null);
  const [movingItem, setMovingItem] = useState<PppoeServiceListItem | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // ── 5.4: selección múltiple (gateada por canManage)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── v2 (pppoe-bulk-select-filter): >200 ya NO bloquea — se informa que se
  // enviará en lotes. Fix pppoe-bulk-batch-timeout: el aviso (y la partición
  // real) pasan a atarse a BULK_BATCH_SIZE (25), NO a BULK_SELECTION_CAP
  // (200) — un lote de 200 tarda demasiado y el proxy lo corta.
  const requiresBatching = selected.size > BULK_BATCH_SIZE;
  const totalBatches = requiresBatching ? Math.ceil(selected.size / BULK_BATCH_SIZE) : 0;

  // ── 5.7: resultado del bulk (null = aún no ejecutado; agregado cross-lote si hubo batching)
  const [bulkResult, setBulkResult] = useState<BulkChangePlanResult | null>(null);
  // ── progreso del lote en vuelo (solo aplica cuando se batchea, N>BULK_BATCH_SIZE)
  const [batchProgress, setBatchProgress] = useState<PppoeBulkBatchProgress | null>(null);
  // ── corte por rechazo de lote entero (red/500/401) — null = no hubo corte
  const [batchCut, setBatchCut] = useState<PppoeBulkBatchCut | null>(null);
  // ── fix pppoe-bulk-batch-timeout: ids del lote que rechazó por transporte
  // (causa del corte) — estado DESCONOCIDO en el servidor, nunca "0 aplicados".
  const [batchUnconfirmed, setBatchUnconfirmed] = useState<string[]>([]);
  // ── estado "corriendo" que abarca TODOS los lotes (no solo el último bulkMutation.isPending)
  // Fix re-review F1(b): mientras `isBulkRunning` es true, la selección queda
  // CONGELADA — checkboxes de fila, checkbox de header, "Limpiar" y
  // "Seleccionar los N del filtro" quedan disabled (ver JSX abajo). Antes, si
  // el operador tocaba la selección durante una corrida en segundo plano
  // (modal cerrado), `selected` cambiaba a mitad de camino: el chip de
  // progreso (gateado por `requiresBatching`, reactivo a `selected.size`)
  // podía desaparecer con la corrida todavía viva, y el conteo final del
  // banner post-corrida (que resta contra `selected.size`) quedaba corrupto.
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  // ── ola 2 (pedido del usuario 2026-07-02): cancelación real + segundo plano.
  // `cancelRequestedRef` es el flag que `runPppoeBulkBatches` chequea (vía
  // `shouldCancel`) ANTES de mandar cada lote — un ref porque el chequeo debe
  // ver el valor MÁS RECIENTE sin esperar un re-render. `isCancelling` es el
  // espejo en estado (para pintar "Cortando…" en la UI).
  const cancelRequestedRef = useRef(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // ── ola 2: corte por cancelación del operador (distinto de `batchCut`,
  // que es rechazo de TRANSPORTE) — null = no se pidió cortar.
  const [batchCancelled, setBatchCancelled] = useState<PppoeBulkBatchCancelled | null>(null);

  // ── 3.3: "Seleccionar los N del filtro" — congela el set con los ids del filtro vigente
  const [selectFilterError, setSelectFilterError] = useState<string | null>(null);

  // ── F1: token de secuencia anti-TOCTOU. Se incrementa en el mismo tick que
  // handleSearch/handleNas/handleStatus limpian la selección (ver más abajo).
  // handleSelectAllFiltered captura el valor vigente ANTES del await del fetch;
  // si cambió al resolver, el filtro que originó el request ya no es el vigente
  // (el onChange correspondiente ya limpió `selected`) y el resultado se
  // descarta en silencio — evita repoblar la selección con ids del filtro viejo.
  const filterGenerationRef = useRef(0);

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
  const bulkMutation = useBulkChangePppoePlan();
  // W4: variante SIN invalidación por lote — usada exclusivamente por el
  // camino de envío en lotes (N>200); ver handleBulkConfirm más abajo.
  const batchMutation = useBulkChangePppoePlanBatch();
  const listIdsMutation = useListPppoeIds();
  const queryClient = useQueryClient();

  // ── derived
  const items = listData?.data ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // S5.3: con el chip "Pendientes" activo solo se muestran las filas sin NAS
  // (pendientes de instalación). El filtro es sobre la página cargada.
  const visibleItems = pendingOnly ? items.filter(it => it.nasId == null) : items;

  // Filter plans: enabled + not Corte category
  const activePlans = plans.filter(p => p.status === 'enabled' && p.category !== 'Corte');

  const nasOptions = nasServers.map(n => ({ id: n.id, name: n.name }));

  // ── 3.3: filtro activo = al menos uno de {search, nasId, status}. `includeUnassigned`
  // NO cuenta (es un toggle de scope, no un filtro de narrowing) — alineado con el BE.
  // Nit R2(a): search.trim() — espacios-solos NO cuentan como filtro activo (el
  // BE trimea y devolvería 400 FILTER_REQUIRED si search=' ' fuera el único filtro).
  const hasActiveFilter = Boolean(search.trim() || nasId || status);

  // Reset page on filter change (también limpia la selección — invariante anti-TOCTOU: la
  // selección congelada vía "Seleccionar los N del filtro" también se limpia acá).
  // F1: cada cambio de filtro también avanza filterGenerationRef, en el MISMO tick
  // que limpia `selected` — ver handleSelectAllFiltered.
  // Fix re-review F1(b): la limpieza es CONDICIONAL — durante una corrida
  // (`isBulkRunning`) la selección es el set de reintento y NO se toca (los
  // filtros siguen habilitados a propósito para que el operador navegue);
  // el bump del ref sigue incondicional (inofensivo: "Seleccionar los N del
  // filtro" está disabled durante la corrida, no hay fetch stale posible).
  function handleSearch(v: string) {
    setSearchRaw(v);
    setPage(1);
    if (!isBulkRunning) setSelected(new Set());
    filterGenerationRef.current += 1;
  }
  function handleNas(v: string) {
    setNasId(v);
    setPage(1);
    if (!isBulkRunning) setSelected(new Set());
    filterGenerationRef.current += 1;
  }
  function handleStatus(v: string) {
    setStatus(v as InternetServiceStatus | '');
    setPage(1);
    if (!isBulkRunning) setSelected(new Set());
    filterGenerationRef.current += 1;
  }

  // ── 5.4: handlers de selección (gateados por canManage) ──
  // Sobre las filas VISIBLES: con el chip "Pendientes" activo, "seleccionar la
  // página" selecciona solo lo que el operador está viendo.
  const currentPageIds = visibleItems.map(it => it.id);
  const allPageSelected =
    currentPageIds.length > 0 && currentPageIds.every(id => selected.has(id));

  function handleToggleRow(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleTogglePage() {
    if (allPageSelected) {
      // Deseleccionar los de esta página
      setSelected(prev => {
        const next = new Set(prev);
        currentPageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      // Seleccionar todos los de esta página
      setSelected(prev => {
        const next = new Set(prev);
        currentPageIds.forEach(id => next.add(id));
        return next;
      });
    }
  }

  function handleClearSelection() {
    setSelected(new Set());
  }

  // ── 3.3: "Seleccionar los N del filtro" — resuelve los ids del filtro vigente
  // y los CONGELA en la selección (anti-TOCTOU: cambiar el filtro después limpia,
  // ver handleSearch/handleNas/handleStatus). NO re-resuelve el filtro al ejecutar.
  //
  // F1: race anti-TOCTOU — si el filtro cambia MIENTRAS este fetch está en
  // vuelo, el onChange correspondiente ya limpió `selected` y avanzó
  // filterGenerationRef. Sin este guard, el `setSelected(new Set(ids))` de
  // abajo resolvería DESPUÉS y repoblaría la selección con ids del filtro
  // VIEJO, pisando la limpieza. Se captura la generación ANTES del await y
  // solo se aplica el resultado si sigue siendo la vigente al resolver.
  async function handleSelectAllFiltered() {
    setSelectFilterError(null);
    const requestGeneration = filterGenerationRef.current;
    try {
      const { ids } = await listIdsMutation.mutateAsync({
        includeUnassigned: true,
        search: search || undefined,
        nasId: nasId || undefined,
        status: status || undefined,
      });
      if (filterGenerationRef.current !== requestGeneration) {
        // El filtro cambió mientras el fetch estaba en vuelo — descartar en
        // silencio; la selección ya fue limpiada por el onChange que disparó
        // el cambio de generación.
        return;
      }
      setSelected(new Set(ids));
    } catch (err) {
      // Nit R2(b): bulkErrorMessage lee response.data.error/code del BE en vez
      // del err.message genérico de axios ("Request failed with status code 400").
      setSelectFilterError(bulkErrorMessage(err, 'No se pudo obtener los ids del filtro.'));
    }
  }

  function applyOkToSelection(okIds: string[]) {
    const okSet = new Set(okIds);
    setSelected(prev => {
      const next = new Set(prev);
      okSet.forEach(id => next.delete(id));
      return next;
    });
  }

  // ── 5.6: handler del bulk ──
  // Fix pppoe-bulk-batch-timeout: el umbral directo-vs-lotes pasa de
  // BULK_SELECTION_CAP (200) a BULK_BATCH_SIZE (25) — un lote de 200 con el
  // throttle serial del BE tarda 2-4min y el proxy corta la conexión antes de
  // que vuelva la respuesta. N<=BULK_BATCH_SIZE: flujo INTACTO (un solo
  // request; un rechazo propaga el error hacia el modal, igual que el change
  // padre — bulkErrorMessage lo muestra inline). N>BULK_BATCH_SIZE (incluido
  // el rango 26-200, que antes iba directo): envío secuencial en lotes de
  // BULK_BATCH_SIZE vía runPppoeBulkBatches — un rechazo de LOTE ENTERO por
  // transporte corta y agrega el parcial CONFIRMADO, exponiendo el lote
  // rechazado como `unconfirmed` (estado desconocido, NUNCA "0 aplicados" —
  // el BE puede haber seguido procesando en background); los `failed`
  // ítem-por-ítem (best-effort) nunca cortan.
  // W4: el camino de lotes usa `batchMutation` (SIN invalidación por request —
  // ver useBulkChangePppoePlanBatch) para no disparar hasta N refetches a mitad
  // de la corrida; se invalida GLOBAL_LIST_KEY UNA sola vez al terminar, ya sea
  // que la corrida haya completado todos los lotes o se haya cortado.
  async function handleBulkConfirm(profile: string, reason?: string) {
    const ids = Array.from(selected);
    setBatchProgress(null);
    setBatchCut(null);
    setBatchUnconfirmed([]);
    setBatchCancelled(null);
    setIsCancelling(false);
    cancelRequestedRef.current = false;
    setIsBulkRunning(true);
    try {
      if (ids.length <= BULK_BATCH_SIZE) {
        // Camino directo (ola 2 — "Intactos"): un solo request corto, sin
        // orquestador de lotes — no hay nada que cortar a mitad de camino ni
        // segundo plano que valga la pena. Comportamiento SIN CAMBIOS.
        const result = await bulkMutation.mutateAsync({ ids, profile, reason });
        setBulkResult(result);
        applyOkToSelection(result.ok);
        return;
      }
      const result = await runPppoeBulkBatches(
        ids,
        batchIds => batchMutation.mutateAsync({ ids: batchIds, profile, reason }),
        {
          batchSize: BULK_BATCH_SIZE,
          onProgress: setBatchProgress,
          // Ola 2: chequeado por el orquestador ANTES de mandar cada lote.
          shouldCancel: () => cancelRequestedRef.current,
        },
      );
      setBulkResult({ ok: result.ok, failed: result.failed });
      setBatchCut(result.cut);
      setBatchUnconfirmed(result.unconfirmed);
      setBatchCancelled(result.cancelled);
      applyOkToSelection(result.ok);
      // Invalidación única de la corrida completa (completa, cortada O
      // cancelada) — el camino N<=BULK_BATCH_SIZE arriba ya invalida solo por
      // su propio onSuccess.
      queryClient.invalidateQueries({ queryKey: GLOBAL_LIST_KEY });
    } finally {
      setIsBulkRunning(false);
      setIsCancelling(false);
    }
  }

  function handleOpenBulkModal() {
    setBulkResult(null);
    setBatchProgress(null);
    setBatchCut(null);
    setBatchUnconfirmed([]);
    setBatchCancelled(null);
    setIsCancelling(false);
    cancelRequestedRef.current = false;
    setShowBulkModal(true);
  }

  function handleCloseBulkModal() {
    setShowBulkModal(false);
    setBulkResult(null);
    setBatchProgress(null);
    setBatchCut(null);
    setBatchUnconfirmed([]);
    setBatchCancelled(null);
    setIsCancelling(false);
    cancelRequestedRef.current = false;
  }

  // ── ola 2: "Cortar" real — setea el flag chequeado por `shouldCancel`
  // ANTES del próximo lote. El lote YA en vuelo no se aborta (no hay AbortController
  // sobre la mutation) — termina de resolver y sus ok/failed se agregan igual.
  function handleCancelRun() {
    cancelRequestedRef.current = true;
    setIsCancelling(true);
  }

  // ── ola 2: "Continuar en segundo plano" — cierra SOLO el modal. Todo el
  // estado de la corrida (batchProgress/batchCut/bulkResult/etc.) vive en este
  // componente, no en el modal, así que la corrida sigue sin tocar nada más.
  function handleBackgroundContinue() {
    setShowBulkModal(false);
  }

  // ── ola 2: "Ver detalle" del banner post-corrida — reabre el modal; como
  // `bulkResult` ya está poblado, el modal renderiza directo la vista de resultado.
  function handleReopenBulkModal() {
    setShowBulkModal(true);
  }

  // ── action handlers — F2: await + try/catch con feedback visible
  async function handleDeactivate(item: PppoeServiceListItem) {
    // S3: el pendiente nunca se instaló en un router — "se eliminará del
    // router" sería mentira; se elimina la pre-provisión.
    const ok = await confirm({
      message: item.nasId == null
        ? `¿Dar de baja "${item.username}"? Se eliminará la pre-provisión (todavía no está instalado).`
        : `¿Dar de baja "${item.username}"? Se eliminará del router.`,
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
            placeholder="Buscar usuario, cliente, IP, MAC…"
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

        {/* S5.3: filtro rápido de pendientes de instalación (round-trip en URL) */}
        <button
          type="button"
          className={styles.chipPending}
          onClick={togglePendingFilter}
          aria-pressed={pendingOnly}
          title="Mostrar solo los PPPoE pendientes de instalación (pre-provisión sin router)"
        >
          Pendientes
        </button>

        <span className={styles.toolbarRight}>
          {/* C1: con el chip ON el total del server MIENTE (incluye no-pendientes):
              el contador refleja lo que realmente se ve. */}
          {pendingOnly
            ? `${visibleItems.length} pendiente${visibleItems.length === 1 ? '' : 's'} en esta página`
            : total > 0 ? `${total} servicio${total === 1 ? '' : 's'}` : ''}
          {isFetching && !isLoading ? ' · actualizando…' : ''}
        </span>

        {/* ── 3.3: "Seleccionar los N del filtro" — solo con filtro activo + canManage.
            C1: con el chip ON se OCULTA — los pendientes son un subconjunto
            client-side y el endpoint de ids del filtro ignora pendingOnly:
            congelaría cientos de no-pendientes invisibles. ── */}
        {canManage && hasActiveFilter && !pendingOnly && (
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleSelectAllFiltered}
            disabled={listIdsMutation.isPending || isBulkRunning}
            title={isBulkRunning ? 'Hay un cambio de plan en curso' : undefined}
          >
            {listIdsMutation.isPending ? 'Buscando…' : `Seleccionar los ${total} del filtro`}
          </button>
        )}

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

      {/* ── 3.3: error inline del fetch de ids del filtro ── */}
      {selectFilterError && (
        <div className={styles.errorPanel} role="alert">
          {selectFilterError}
          <button className={styles.btnRetry} onClick={() => setSelectFilterError(null)}>×</button>
        </div>
      )}

      {/* ── 5.5: Toolbar contextual de selección (solo visible con selección + canManage) ── */}
      {canManage && selected.size > 0 && (
        <div className={styles.selectionToolbar} role="toolbar" aria-label="Acciones sobre la selección">
          <span className={`${styles.selectionCount}${requiresBatching ? ` ${styles.selectionCountBatches}` : ''}`}>
            {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
            {requiresBatching ? ` — se enviará en ${totalBatches} lotes de ${BULK_BATCH_SIZE}` : ''}
          </span>
          <div className={styles.selectionActions}>
            {/* v2: >200 ya NO bloquea — el envío en lotes lo resuelve (design.md Decisión 6) */}
            {/* Ola 2: mientras hay una corrida en curso (incluso en segundo
                plano, con el modal cerrado) no se puede abrir OTRO bulk. */}
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleOpenBulkModal}
              disabled={isBulkRunning}
              title={isBulkRunning ? 'Hay un cambio de plan en curso — esperá a que termine o cortalo.' : undefined}
            >
              Cambiar plan
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleClearSelection}
              disabled={isBulkRunning}
              title={isBulkRunning ? 'Hay un cambio de plan en curso' : undefined}
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      {/* ── Ola 2: chip de progreso en segundo plano (modal cerrado, corrida en
          lotes en curso). El camino directo (<=BULK_BATCH_SIZE) nunca reporta
          `batchProgress` (no pasa por el orquestador), así que no dispara
          este chip — no lo necesita (un solo request corto).
          Fix re-review F1(a): la condición YA NO incluye `requiresBatching`
          (reactivo a `selected.size`) — con la corrida en background, tocar
          la selección (Limpiar / descheckear filas) podía volverlo `false` y
          hacer desaparecer el chip (y el botón Cortar) con la corrida todavía
          en curso. `batchProgress` por sí solo alcanza: solo lo puebla el
          camino de lotes (ver handleBulkConfirm). Complementado por F1(b):
          la selección queda congelada (disabled) mientras `isBulkRunning`,
          así que `requiresBatching` tampoco cambia en la práctica — doble
          cinturón de seguridad. ── */}
      {isBulkRunning && !showBulkModal && batchProgress && (
        <div className={styles.bulkChip} role="status">
          {/* Fix re-review F3: el contenedor ya tiene role="status" (implica
              una live region con aria-live="polite" por default) — un
              aria-live="polite" explícito ACÁ duplicaba el anuncio para
              lectores de pantalla. Una sola live region. */}
          <span>
            Cambiando plan: lote {batchProgress.batchIndex}/{batchProgress.totalBatches}
          </span>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleCancelRun}
            disabled={isCancelling}
          >
            {isCancelling ? 'Cortando…' : 'Cortar'}
          </button>
        </div>
      )}

      {/* ── Ola 2: banner de resumen cuando la corrida terminó (completa,
          cortada o cancelada) con el modal cerrado — límite conocido: si el
          operador navega FUERA de este tab durante la corrida, las mutaciones
          ya disparadas completan igual, pero este resumen se pierde (el
          estado vive en este componente, no sobrevive al desmontaje). ── */}
      {!isBulkRunning && !showBulkModal && bulkResult !== null && (
        <div className={styles.bulkBanner} role="status">
          <span>
            Cambio de plan {batchCut || batchCancelled ? 'cortado' : 'terminado'}: {bulkResult.ok.length} confirmado{bulkResult.ok.length !== 1 ? 's' : ''} ok, {bulkResult.failed.length} fallido{bulkResult.failed.length !== 1 ? 's' : ''}
            {Math.max(0, selected.size - bulkResult.failed.length) > 0
              ? `, ${Math.max(0, selected.size - bulkResult.failed.length)} sin confirmación/no enviados`
              : ''}
          </span>
          <div className={styles.selectionActions}>
            <button type="button" className={styles.btnSecondary} onClick={handleReopenBulkModal}>
              Ver detalle
            </button>
            <button type="button" className={styles.btnSecondary} onClick={handleCloseBulkModal}>
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {/* 5.4: columna de selección — solo con pppoe.manage */}
              {canManage && (
                <th className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={handleTogglePage}
                    aria-label="Seleccionar todos de esta página"
                    title={isBulkRunning ? 'Hay un cambio de plan en curso' : 'Seleccionar todos de esta página'}
                    disabled={isBulkRunning}
                  />
                </th>
              )}
              <th>Usuario</th>
              <th>Cliente</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>IP</th>
              {/* 5.2b: columna MAC */}
              <th>MAC</th>
              <th>NAS</th>
              {/* F1: columna Contraseña solo visible con pppoe.manage */}
              {canManage && <th>Contraseña</th>}
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {isError ? (
              <tr>
                <td colSpan={canManage ? 10 : 7}>
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
                <td colSpan={canManage ? 10 : 7}>
                  <div role="status" className={styles.skeleton} aria-label="Cargando…" />
                </td>
              </tr>
            ) : visibleItems.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 10 : 7}>
                  <div className={styles.empty}>
                    <IconPppoe className={styles.emptyIcon} />
                    {/* W4: NAS filtrado + chip = vacío GARANTIZADO (los
                        pendientes no tienen NAS) — copy específico, no el
                        engañoso "cambiá de página". */}
                    <h3 className={styles.emptyTitle}>
                      {pendingOnly && nasId
                        ? 'Los pendientes no tienen router asignado.'
                        : pendingOnly && items.length > 0
                          ? 'No hay PPPoE pendientes de instalación en esta página.'
                          : 'No se encontraron servicios PPPoE.'}
                    </h3>
                    <p>
                      {pendingOnly && nasId
                        ? 'Quitá el filtro de router para verlos.'
                        : pendingOnly && items.length > 0
                          ? 'Cambiá de página o desactivá el filtro "Pendientes".'
                          : 'Probá ajustando los filtros o creá un servicio nuevo.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : visibleItems.map(item => (
              <tr
                key={item.id}
                className={`${styles.bodyRow}${selected.has(item.id) ? ` ${styles.rowSelected}` : ''}`}
              >
                {/* 5.4: checkbox de fila — solo con canManage */}
                {canManage && (
                  <td className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => handleToggleRow(item.id)}
                      aria-label={`Seleccionar ${item.username}`}
                      title={isBulkRunning ? 'Hay un cambio de plan en curso' : undefined}
                      disabled={isBulkRunning}
                    />
                  </td>
                )}

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

                {/* IP — W2: el pendiente (nasId null) persiste ipMode 'fixed'
                    (design D3) pero la IP recién existe cuando la adopción
                    asigna el NAS: "—" limpio, sin el artefacto "— fija". */}
                <td className={styles.mono}>
                  {item.remoteAddress ?? '—'}
                  {item.ipMode === 'fixed' && item.nasId != null && (
                    <span className={styles.badgeFixed}>fija</span>
                  )}
                </td>

                {/* 5.2b: MAC (callerId) — mismo tratamiento tipográfico que IP */}
                <td className={styles.mono}>
                  {item.callerId != null
                    ? item.callerId
                    : (
                      <span aria-label="Sin dato" className={styles.muted}>—</span>
                    )
                  }
                </td>

                {/* NAS — null = pendiente de instalación (pre-provisión sin router) */}
                <td className={styles.muted}>
                  {item.nasId == null ? (
                    <span className={styles.pendingNasCell}>
                      {/* Mismo patrón a11y que NoData de GestionRedPage: el lector anuncia "Sin NAS asignado" */}
                      <span role="img" aria-label="Sin NAS asignado">—</span>
                      <span className={styles.badgePendingInstall}>Pendiente de instalación</span>
                    </span>
                  ) : (
                    item.nasName ?? item.nasId
                  )}
                </td>

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
          // NO auto-cierra: el modal muestra la IP nueva del DTO (S9.2) y el
          // operador cierra. La fila se refresca por la invalidación del hook.
          onMove={(targetNasId, force) =>
            moveMutation.mutateAsync({ id: movingItem.id, nasId: targetNasId, force })
          }
          isPending={moveMutation.isPending}
        />
      )}

      {/* ── 5.6: Modal bulk cambio de plan ── */}
      {showBulkModal && (
        <BulkChangePlanModal
          selectedCount={selected.size}
          planOptions={activePlans.map(p => ({ code: p.code, name: p.name }))}
          onClose={handleCloseBulkModal}
          onConfirm={handleBulkConfirm}
          isPending={isBulkRunning}
          result={bulkResult}
          progress={batchProgress}
          cut={batchCut}
          unconfirmed={batchUnconfirmed}
          cancelled={batchCancelled}
          isBatching={requiresBatching}
          isCancelling={isCancelling}
          onCancelRun={handleCancelRun}
          onBackground={handleBackgroundContinue}
        />
      )}
    </div>
  );
}
