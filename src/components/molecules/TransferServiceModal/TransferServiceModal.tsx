/**
 * TransferServiceModal — modal genérico de transferencia de servicios entre
 * clientes (service-transfer W4, EPIC Titularidad & bajas F1).
 *
 * Tres variantes sobre el mismo esqueleto de dos pasos:
 *   - tv        → solo confirmación (el BE aliasa el CIC y severa el origen).
 *   - pppoe     → modo recreate (default recomendado) / as-is (motivo OBLIGATORIO);
 *                 recreate muestra un subform prefilleado del PPPoE actual.
 *   - equipment → checkboxes de ítems (default TODOS marcados).
 *
 * Paso 1: cliente destino (CustomerPicker, excluye al origen) + contrato destino
 * + campos de la variante. Paso 2: confirmación explícita de-quién-a-quién.
 * Resultado visible SIN auto-cerrar (patrón MoveNasModal): un 207 parcial NUNCA
 * se muestra como éxito plano — se detalla qué quedó pendiente y, en TV, el
 * retry re-dispara el MISMO request (el BE es resumible e idempotente).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CustomerPicker } from '@/components/molecules/CustomerPicker/CustomerPicker';
import { useClientContracts } from '@/hooks/useCustomers';
import { useTransferTv } from '@/hooks/useGigared';
import { useTransferPppoe } from '@/hooks/usePppoe';
import { useTransferEquipment } from '@/hooks/useServiceInventory';
import type { PppoeServiceDto, IpTypePreference } from '@/types/pppoe';
import type { ServiceInstalledItem, TransferEquipmentResult } from '@/types/serviceInventory';
import type { TransferTvResult } from '@/types/gigared';
import type { TransferPppoeResult, CreatePppoeBody } from '@/api/pppoe.api';
import styles from './TransferServiceModal.module.css';

// ── Variantes ────────────────────────────────────────────────────────────────

export type TransferServiceVariant =
  | { kind: 'tv' }
  | { kind: 'pppoe'; pppoe: PppoeServiceDto; nasServers: { id: string; name: string }[] }
  | { kind: 'equipment'; items: ServiceInstalledItem[] };

interface TransferServiceModalProps {
  variant: TransferServiceVariant;
  /** Cliente ORIGEN (dueño actual del servicio). Se excluye del picker. */
  sourceClientId: string;
  /** Nombre del cliente origen para la confirmación de-quién-a-quién. */
  sourceClientName?: string | null;
  /** Contrato ORIGEN del servicio. */
  sourceContractId: string;
  onClose: () => void;
}

const DIALOG_TITLE_ID = 'transfer-service-modal-title';

const SERVICE_LABELS: Record<TransferServiceVariant['kind'], string> = {
  tv: 'TV',
  pppoe: 'Internet (PPPoE)',
  equipment: 'equipos',
};

/** Estado del contrato destino → etiqueta corta del <option>. */
const CONTRACT_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  late: 'Moroso',
  blocked: 'Bloqueado',
  inactive: 'Inactivo',
  baja: 'Baja',
};

/** Sentinel del selector de Router para recreate sin NAS (pre-provisión). */
const NO_ROUTER_VALUE = '__no_router__';

// ── Lectura tipada de errores axios (patrón errorCode/errorDetail GigaredPanel) ──

interface ApiErrorInfo {
  status: number | null;
  code: string | null;
  message: string | null;
  detail: string | null;
}

function apiErrorInfo(err: unknown): ApiErrorInfo {
  const e = err as {
    response?: { status?: number; data?: { code?: string; error?: string; message?: string; detail?: string } };
  };
  return {
    status: e?.response?.status ?? null,
    code: e?.response?.data?.code ?? null,
    message: e?.response?.data?.error ?? e?.response?.data?.message ?? null,
    detail: e?.response?.data?.detail ?? null,
  };
}

function mapTvError(err: unknown): string {
  const { code, message, detail } = apiErrorInfo(err);
  switch (code) {
    case 'TV_ALREADY_LINKED':
      return 'El cliente destino ya tiene otra cuenta de TV vinculada. Desvinculala primero o elegí otro cliente.';
    case 'TV_NOT_LINKED':
      return 'Este cliente no tiene una cuenta de TV vinculada para transferir.';
    case 'CLIENT_NOT_FOUND':
    case 'CONTRACT_NOT_FOUND':
      return 'El cliente o contrato destino no es válido. Revisá la selección.';
    case 'GIGARED_REJECTED': {
      // FIX 7 — sin `detail`, el `error`/`message` del BE va antes que el genérico.
      const why = detail ?? message;
      return why ? `Gigared rechazó la transferencia: ${why}` : 'Gigared rechazó la transferencia.';
    }
    case 'GIGARED_UNAVAILABLE':
      return 'Gigared no está disponible en este momento. Reintentá en unos minutos.';
    case 'VALIDATION_ERROR':
      return message ?? 'Datos inválidos. Revisá la selección.';
    default:
      return message ?? 'No se pudo transferir la TV. Reintentá.';
  }
}

function mapPppoeError(err: unknown): string {
  const { code, message } = apiErrorInfo(err);
  switch (code) {
    case 'PPPOE_ALREADY_ASSOCIATED':
      return 'El contrato destino es el mismo al que ya está asociado este PPPoE. Elegí otro contrato.';
    case 'PPPOE_CONTRACT_ALREADY_HAS_SERVICE':
      return 'El contrato destino ya tiene un servicio PPPoE activo. Dalo de baja primero o elegí otro contrato.';
    case 'PPPOE_USERNAME_TAKEN':
      return 'Ese usuario PPPoE ya existe (en este u otro router). Usá otro nombre.';
    case 'PPPOE_TRANSFER_PENDING_RESIDUE':
      // El mensaje del BE trae el id de la fila pending y CÓMO recuperar — se muestra tal cual.
      return message ?? 'Un intento previo dejó un PPPoE pendiente en el destino. Revisá la ficha del contrato destino.';
    case 'VALIDATION_ERROR':
      return message ?? 'Datos inválidos. Revisá el formulario.';
    default:
      return message ?? 'No se pudo transferir el PPPoE. Reintentá.';
  }
}

function mapEquipmentError(err: unknown): string {
  const { code, message } = apiErrorInfo(err);
  if (code === 'VALIDATION_ERROR') return message ?? 'Datos inválidos. Revisá la selección.';
  return message ?? 'No se pudieron transferir los equipos. Reintentá.';
}

/** 207/parcial de TV — derivado de los flags del body (mismo criterio que el BE). */
function isTvPartial(r: TransferTvResult): boolean {
  return !r.severed || r.localSource === 'failed' || r.localTarget === 'failed' || !r.targetCleared;
}

// ── Componente ───────────────────────────────────────────────────────────────

export function TransferServiceModal({
  variant,
  sourceClientId,
  sourceClientName,
  sourceContractId,
  onClose,
}: TransferServiceModalProps) {
  const serviceLabel = SERVICE_LABELS[variant.kind];
  const sourceName = sourceClientName?.trim() || 'este cliente';

  // ── Paso 1: destino ──
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [targetContractId, setTargetContractId] = useState('');
  const contractsQuery = useClientContracts(target?.id ?? '', !!target);
  const targetContracts = contractsQuery.data ?? [];

  // ── Variante PPPoE ──
  const pppoe = variant.kind === 'pppoe' ? variant.pppoe : null;
  const [mode, setMode] = useState<'recreate' | 'as-is'>('recreate');
  const [reason, setReason] = useState('');
  const [newPppoe, setNewPppoe] = useState({
    username: pppoe?.username ?? '',
    password: '',
    nasId: pppoe?.nasId ?? NO_ROUTER_VALUE,
    profile: pppoe?.profile ?? '',
    remoteAddress: '',
  });
  const [ipType, setIpType] = useState<IpTypePreference>(pppoe?.ipTypePreference ?? 'cgnat');
  const isNoRouter = newPppoe.nasId === NO_ROUTER_VALUE;
  const sameUsername =
    !!pppoe && newPppoe.username.trim().toLowerCase() === pppoe.username.trim().toLowerCase();

  // ── Variante equipos ──
  const items = variant.kind === 'equipment' ? variant.items : [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(items.map((it) => it.id)),
  );

  // ── Paso / resultado / error ──
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [error, setError] = useState<string | null>(null);
  const [tvResult, setTvResult] = useState<TransferTvResult | null>(null);
  const [pppoeResult, setPppoeResult] = useState<TransferPppoeResult | null>(null);
  const [equipResult, setEquipResult] = useState<TransferEquipmentResult | null>(null);
  const hasResult = tvResult !== null || pppoeResult !== null || equipResult !== null;

  const transferTv = useTransferTv(sourceClientId);
  const transferPppoe = useTransferPppoe(sourceContractId, sourceClientId);
  const transferEquipment = useTransferEquipment(sourceContractId, sourceClientId);
  const isPending = transferTv.isPending || transferPppoe.isPending || transferEquipment.isPending;

  // Focus + Escape (patrón ServiceHistoryModal).
  // FIX 5 — Escape NO cierra mid-flight (paridad con el guard del backdrop). Va
  // por ref para no re-correr el effect de focus/overflow en cada isPending.
  const isPendingRef = useRef(isPending);
  isPendingRef.current = isPending;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPendingRef.current) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  // ── Validación del paso 1 ──
  const targetOk = !!target && targetContractId !== '';
  let variantOk = true;
  if (variant.kind === 'pppoe') {
    variantOk =
      mode === 'as-is'
        ? reason.trim().length > 0
        : newPppoe.username.trim() !== '' &&
          !sameUsername &&
          newPppoe.password !== '' &&
          newPppoe.profile.trim() !== '';
  } else if (variant.kind === 'equipment') {
    variantOk = selectedIds.size > 0;
  }
  const canContinue = targetOk && variantOk;

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Submit (también lo usa el Reintentar del 207 de TV: MISMO request) ──
  async function doTransfer() {
    if (!target || isPending) return;
    setError(null);
    try {
      if (variant.kind === 'tv') {
        const r = await transferTv.mutateAsync({
          targetCustomerId: target.id,
          targetContractId,
          sourceContractId,
        });
        setTvResult(r.data);
      } else if (variant.kind === 'pppoe' && pppoe) {
        const body =
          mode === 'as-is'
            ? {
                id: pppoe.id,
                targetClientId: target.id,
                targetContractId,
                mode,
                reason: reason.trim(),
              }
            : {
                id: pppoe.id,
                targetClientId: target.id,
                targetContractId,
                mode,
                newPppoe: {
                  username: newPppoe.username.trim(),
                  password: newPppoe.password,
                  ...(isNoRouter
                    ? {}
                    : {
                        nasId: newPppoe.nasId,
                        ...(newPppoe.remoteAddress.trim() !== ''
                          ? { remoteAddress: newPppoe.remoteAddress.trim() }
                          : {}),
                      }),
                  profile: newPppoe.profile.trim(),
                  ipTypePreference: ipType,
                } satisfies CreatePppoeBody,
              };
        const r = await transferPppoe.mutateAsync(body);
        setPppoeResult(r);
      } else if (variant.kind === 'equipment') {
        const r = await transferEquipment.mutateAsync({
          targetContractId,
          targetClientId: target.id,
          itemIds: items.filter((it) => selectedIds.has(it.id)).map((it) => it.id),
        });
        setEquipResult(r);
      }
    } catch (err) {
      setError(
        variant.kind === 'tv'
          ? mapTvError(err)
          : variant.kind === 'pppoe'
            ? mapPppoeError(err)
            : mapEquipmentError(err),
      );
    }
  }

  // ── Render de secciones ──

  const activeItems = items;

  const formStep = (
    <>
      <div className={styles.field}>
        {/* FIX 6 — label asociado al input de búsqueda del picker (htmlFor + id). */}
        <label className={styles.fieldLabel} htmlFor="transfer-target-client">
          Cliente destino
        </label>
        <CustomerPicker
          id="transfer-target-client"
          value={target?.id ?? null}
          valueName={target?.name ?? null}
          excludeId={sourceClientId}
          onChange={(id, name) => {
            setTarget(id && name ? { id, name } : null);
            setTargetContractId('');
          }}
        />
      </div>

      {target && (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="transfer-target-contract">
            Contrato destino
          </label>
          {contractsQuery.isLoading ? (
            <p className={styles.hint}>Cargando contratos…</p>
          ) : targetContracts.length === 0 ? (
            <p className={styles.hint}>El cliente destino no tiene contratos.</p>
          ) : (
            <select
              id="transfer-target-contract"
              className={styles.select}
              value={targetContractId}
              onChange={(e) => setTargetContractId(e.target.value)}
            >
              <option value="">Elegí un contrato…</option>
              {targetContracts.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === sourceContractId}>
                  {(c.name ?? c.plan) +
                    ' — ' +
                    (c.address ?? 'sin dirección') +
                    ' · ' +
                    (CONTRACT_STATUS_LABELS[c.status] ?? c.status) +
                    (c.id === sourceContractId ? ' (contrato origen)' : '')}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {variant.kind === 'pppoe' && pppoe && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Modo de transferencia</legend>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="transfer-pppoe-mode"
              value="recreate"
              checked={mode === 'recreate'}
              onChange={() => setMode('recreate')}
            />
            <span>
              <span className={styles.radioTitle}>Recrear (recomendado)</span>
              <span className={styles.radioHint}>
                Crea el PPPoE nuevo en el destino PRIMERO y borra el viejo después. Si algo
                falla, el servicio actual queda intacto. El cliente reconfigura su CPE con
                las credenciales nuevas.
              </span>
            </span>
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="transfer-pppoe-mode"
              value="as-is"
              checked={mode === 'as-is'}
              onChange={() => setMode('as-is')}
            />
            <span>
              <span className={styles.radioTitle}>Transferir tal cual</span>
              <span className={styles.radioHint}>
                Solo cambia el contrato — no toca RADIUS ni al cliente. Usalo únicamente si
                no podés recrear (ej. sin acceso a la antena). Queda marcado como pendiente
                de regularizar.
              </span>
            </span>
          </label>

          {mode === 'as-is' ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="transfer-asis-reason">
                Motivo <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="transfer-asis-reason"
                className={styles.textarea}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: sin acceso a la antena del cliente…"
              />
            </div>
          ) : (
            <div className={styles.subform}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="transfer-new-username">
                  Usuario nuevo <span aria-hidden="true">*</span>
                </label>
                <input
                  id="transfer-new-username"
                  className={styles.input}
                  value={newPppoe.username}
                  autoComplete="off"
                  onChange={(e) => setNewPppoe((f) => ({ ...f, username: e.target.value }))}
                />
                {sameUsername && (
                  <p className={styles.fieldError}>
                    Debe ser distinto al usuario actual ({pppoe.username}): el viejo sigue vivo
                    mientras se crea el nuevo.
                  </p>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="transfer-new-password">
                  Contraseña <span aria-hidden="true">*</span>
                </label>
                <input
                  id="transfer-new-password"
                  type="password"
                  className={styles.input}
                  value={newPppoe.password}
                  autoComplete="new-password"
                  onChange={(e) => setNewPppoe((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="transfer-new-nas">
                  Router <span aria-hidden="true">*</span>
                </label>
                <select
                  id="transfer-new-nas"
                  className={styles.select}
                  value={newPppoe.nasId}
                  onChange={(e) =>
                    setNewPppoe((f) => ({
                      ...f,
                      nasId: e.target.value,
                      ...(e.target.value === NO_ROUTER_VALUE ? { remoteAddress: '' } : {}),
                    }))
                  }
                >
                  <option value={NO_ROUTER_VALUE}>Sin router — auto-instalación</option>
                  {variant.nasServers.map((nas) => (
                    <option key={nas.id} value={nas.id}>
                      {nas.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="transfer-new-profile">
                  Plan <span aria-hidden="true">*</span>
                </label>
                <input
                  id="transfer-new-profile"
                  className={styles.input}
                  value={newPppoe.profile}
                  onChange={(e) => setNewPppoe((f) => ({ ...f, profile: e.target.value }))}
                  placeholder="Código del plan"
                />
              </div>
              {!isNoRouter && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="transfer-new-ip">
                    IP remota
                  </label>
                  <input
                    id="transfer-new-ip"
                    className={styles.input}
                    value={newPppoe.remoteAddress}
                    onChange={(e) => setNewPppoe((f) => ({ ...f, remoteAddress: e.target.value }))}
                    placeholder="Vacía = asignación automática del pool"
                  />
                </div>
              )}
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Tipo de IP</span>
                <div className={styles.ipTypeToggle} role="group" aria-label="Tipo de IP">
                  <button
                    type="button"
                    className={`${styles.ipTypeBtn} ${ipType === 'cgnat' ? styles.ipTypeBtnActive : ''}`}
                    aria-pressed={ipType === 'cgnat'}
                    onClick={() => setIpType('cgnat')}
                  >
                    Privada
                  </button>
                  <button
                    type="button"
                    className={`${styles.ipTypeBtn} ${ipType === 'public' ? styles.ipTypeBtnActive : ''}`}
                    aria-pressed={ipType === 'public'}
                    onClick={() => setIpType('public')}
                  >
                    Pública
                  </button>
                </div>
              </div>
            </div>
          )}
        </fieldset>
      )}

      {variant.kind === 'equipment' && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Equipos a transferir</legend>
          {activeItems.length === 0 ? (
            <p className={styles.hint}>Sin equipos activos para transferir.</p>
          ) : (
            <ul className={styles.itemList}>
              {activeItems.map((it) => (
                <li key={it.id}>
                  <label className={styles.itemRow}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(it.id)}
                      onChange={() => toggleItem(it.id)}
                      aria-label={`${it.type} ${it.serialNumber ?? it.mac ?? it.id}`}
                    />
                    <span className={styles.itemType}>{it.type}</span>
                    <span className={styles.itemMeta}>
                      SN: {it.serialNumber ?? '—'} · MAC: {it.mac ?? '—'}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.btnSecondary} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!canContinue}
          onClick={() => setStep('confirm')}
        >
          Continuar
        </button>
      </div>
    </>
  );

  const targetContract = targetContracts.find((c) => c.id === targetContractId) ?? null;

  const confirmStep = (
    <>
      <p className={styles.confirmHeading}>
        Transferir {serviceLabel} de <strong>{sourceName}</strong> a{' '}
        <strong>{target?.name ?? ''}</strong>
      </p>
      <ul className={styles.summary}>
        <li>
          Contrato destino:{' '}
          {targetContract ? (targetContract.name ?? targetContract.plan) : targetContractId}
        </li>
        {variant.kind === 'pppoe' && pppoe && (
          <>
            <li>
              Modo: {mode === 'recreate' ? 'Recrear (recomendado)' : 'Tal cual — pendiente de regularizar'}
            </li>
            {mode === 'recreate' ? (
              <li>
                PPPoE: {pppoe.username} → {newPppoe.username.trim()}
              </li>
            ) : (
              <li>Motivo: {reason.trim()}</li>
            )}
          </>
        )}
        {variant.kind === 'equipment' && (
          <li>
            {selectedIds.size === 1 ? '1 equipo seleccionado' : `${selectedIds.size} equipos seleccionados`}
          </li>
        )}
      </ul>
      {error && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>{error}</span>
        </div>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => { setError(null); setStep('form'); }}
          disabled={isPending}
        >
          Volver
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={doTransfer}
          disabled={isPending}
        >
          {isPending ? 'Transfiriendo…' : 'Transferir'}
        </button>
      </div>
    </>
  );

  // ── Resultado ──

  function stepState(ok: boolean, failLabel = 'pendiente'): string {
    return ok ? 'OK' : failLabel;
  }

  const resultView = (
    <>
      {tvResult && !isTvPartial(tvResult) && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status">
          <span>
            TV transferida a {target?.name ?? 'el cliente destino'}. CIC {tvResult.cic}.
          </span>
        </div>
      )}
      {tvResult && isTvPartial(tvResult) && (
        <div className={`${styles.banner} ${styles.bannerWarning}`} role="alert">
          <div>
            <p className={styles.partialTitle}>Transferencia parcial</p>
            <ul className={styles.partialList}>
              <li>Vínculo en Gigared (CIC {tvResult.cic}): OK</li>
              <li>Corte del vínculo en el origen: {stepState(tvResult.severed)}</li>
              <li>
                Registro local del origen: {stepState(tvResult.localSource === 'synced', 'falló')}
              </li>
              <li>
                Registro local del destino: {stepState(tvResult.localTarget === 'synced', 'falló')}
              </li>
              <li>
                Limpieza de baja previa en el destino: {stepState(tvResult.targetCleared)}
              </li>
            </ul>
            <p className={styles.partialHint}>
              La operación es reanudable e idempotente: Reintentar re-ejecuta el mismo pedido
              y completa SOLO lo pendiente.
            </p>
          </div>
        </div>
      )}

      {pppoeResult && !pppoeResult.partial && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status">
          <span>
            {pppoeResult.mode === 'recreate'
              ? `PPPoE recreado en el contrato destino: ${pppoeResult.oldUsername} → ${pppoeResult.newUsername ?? ''}. El viejo fue dado de baja.`
              : `PPPoE ${pppoeResult.oldUsername} transferido tal cual — queda pendiente de regularizar (recrearlo cuando haya acceso).`}
          </span>
        </div>
      )}
      {pppoeResult && pppoeResult.partial && (
        <div className={`${styles.banner} ${styles.bannerWarning}`} role="alert">
          <div>
            <p className={styles.partialTitle}>Transferencia parcial</p>
            <p>
              El PPPoE nuevo ({pppoeResult.newUsername ?? '—'}) quedó ACTIVO en el destino,
              pero el viejo ({pppoeResult.oldUsername}) quedó pendiente de borrar. Dalo de
              baja desde la ficha del contrato origen para completar la limpieza.
            </p>
          </div>
        </div>
      )}

      {equipResult && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status">
          <div>
            <p>
              {equipResult.moved === 1
                ? 'Se movió 1 equipo al contrato destino.'
                : `Se movieron ${equipResult.moved} equipos al contrato destino.`}
            </p>
            {/* FIX 3 — el lote del BE es ATÓMICO: assetMoved:false = ítem sin asset
                vinculado en el ledger (equipos legacy, caso común) — informativo
                neutro, NUNCA una alarma de fallo. */}
            {equipResult.items.some((it) => !it.assetMoved) && (
              <p className={styles.hint}>
                Sin asset vinculado en el ledger (informativo):{' '}
                {equipResult.items.filter((it) => !it.assetMoved).map((it) => it.type).join(', ')}.
              </p>
            )}
          </div>
        </div>
      )}

      {/* FIX 1 — un retry que falla DURO (p.ej. 503) setea `error` estando en el
          resultView: el banner tiene que verse acá también, no solo en confirmStep. */}
      {error && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className={styles.actions}>
        {tvResult && isTvPartial(tvResult) && (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={doTransfer}
            disabled={isPending}
          >
            {isPending ? 'Reintentando…' : 'Reintentar'}
          </button>
        )}
        <button type="button" className={styles.btnSecondary} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </>
  );

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE_ID}
      >
        <div className={styles.header}>
          <h2 id={DIALOG_TITLE_ID} className={styles.title}>
            Transferir {serviceLabel} a otro cliente
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className={styles.body}>
          {hasResult ? resultView : step === 'form' ? formStep : confirmStep}
        </div>
      </div>
    </div>,
    document.body,
  );
}
