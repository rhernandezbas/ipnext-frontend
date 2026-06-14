import { useEffect, useState } from 'react';
import {
  useGigaredCustomerAccount,
  useGigaredSummary,
  useGigaredAllAccounts,
  useLinkCic,
  useRegisterAccount,
  useAddTvService,
  useRemoveTvService,
  useSetOtt,
  useCancelTv,
  useCancelTvStatus,
  useChangeTvPassword,
  useTvCredentials,
} from '@/hooks/useGigared';
import { ActivationHistoryModal } from '@/components/molecules/ActivationHistoryModal/ActivationHistoryModal';
import { deterministicTvEmail, deterministicTvPassword } from './deterministicTv';
import { useClientContracts } from '@/hooks/useCustomers';
import { useRemoveContractService } from '@/hooks/useContractServices';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { Can } from '@/components/auth/Can';
import { GigaredNotConfigured } from '@/components/molecules/GigaredNotConfigured/GigaredNotConfigured';
import { formatDateShort } from '@/utils/formatDate';
import { LinkAccountPickerModal } from './LinkAccountPickerModal';
import type { Contract, ContractService } from '@/types/customer';
import type {
  GigaredAccount,
  AddTvServiceResult,
  RemoveTvServiceResult,
  LinkCicResult,
} from '@/types/gigared';
import styles from './GigaredPanel.module.css';

interface GigaredPanelProps {
  customerId: string;
  /** The contract this panel manages. Add/remove pack mutations target THIS id. */
  contractId: string;
  /**
   * The Prominense customer (#47e B). When present, the "Registrar cuenta nueva"
   * form prefills name/email from it. Optional so consumers that lack the data
   * (or read-only contexts) still render.
   */
  customer?: { name: string; email: string; grClienteId?: string | null };
  onClose: () => void;
}

/**
 * Split a local-format display name "APELLIDO NOMBRE(S)" into register fields
 * (#47e B): the FIRST token is the lastName, the rest is the firstName. Empty or
 * single-token names degrade gracefully (lastName only).
 */
function splitName(name: string): { firstName: string; lastName: string } {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: '', lastName: '' };
  const [rawLast, ...rest] = tokens;
  // Local convention is "APELLIDO NOMBRE(S)"; tolerate "APELLIDO, NOMBRE".
  return { lastName: rawLast.replace(/,$/, ''), firstName: rest.join(' ') };
}

/** Read the BE error `code` from a query error, if present. */
function errorCode(err: unknown): string | null {
  const e = err as { response?: { status?: number; data?: { code?: string } } };
  return e?.response?.data?.code ?? null;
}

/** Read the partner-supplied `detail` string from a BE error body, if present. */
function errorDetail(err: unknown): string | null {
  const e = err as { response?: { data?: { detail?: string } } };
  return e?.response?.data?.detail ?? null;
}

/** Read the HTTP status from a query error, if present. */
function errorStatus(err: unknown): number | null {
  const e = err as { response?: { status?: number } };
  return e?.response?.status ?? null;
}

/**
 * #47h — account password rule (FROZEN wire contract): lowercase letters +
 * digits, 8 to 64 chars. Empty is VALID (the BE generates one); only NON-empty
 * text that breaks the pattern is rejected.
 */
const PASSWORD_RE = /^[a-z0-9]{8,64}$/;

/**
 * #47j Fix 2 — the partner's BASE pack. It ships with every Gigared account and
 * cannot be removed, so the panel tags it "Pack base" with no "Quitar". Matched
 * by EXACT name on purpose: if the partner renames it, the guard lifts and the
 * upstream flow decides. Lives here (not a per-call literal) so the rule has one
 * source of truth.
 */
const BASE_PACK_NAME = 'Gigared Play Full';

/**
 * #47i Fix 2 — pick singular/plural for a count. `n` is rendered verbatim before
 * the chosen word ("1 pantalla fija", "2 pantallas fijas").
 */
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A contract OWNS the TV item when its services include an active 'TV' line. */
function ownsTv(c: Contract): boolean {
  return c.services.some((s) => s.name === 'TV' && s.status === 'active');
}

/** The active local 'TV' ContractService line on a contract, if any. */
function localTvLine(c: Contract): ContractService | null {
  return c.services.find((s) => s.name === 'TV' && s.status === 'active') ?? null;
}

/**
 * Gigared TV management panel (#47b). Extracted from the former TvTab — TV is
 * now managed FROM THE CONTRACT, so the panel is scoped to a single
 * `{customerId, contractId}`. Pack add/remove target that contract directly
 * (the BE reconcile creates/inactivates the local ContractService item), so
 * there is no contract picker here.
 *
 * Renders as a modal over the contract card. Three states:
 *   not-configured (banner) / not-linked (link CIC + register) / linked
 *   (pack add/remove + OTT toggle + account info).
 */
export function GigaredPanel({ customerId, contractId, customer, onClose }: GigaredPanelProps) {
  const accountQuery = useGigaredCustomerAccount(customerId);
  const code = accountQuery.isError ? errorCode(accountQuery.error) : null;
  const status = accountQuery.isError ? errorStatus(accountQuery.error) : null;

  // F1 — derive the OWNER contract. A single contract owns the TV item per
  // account: if any contract already holds the active local 'TV' line, ALL
  // mutations target IT regardless of which card opened the panel. On first
  // activation (no owner yet), the opening contract (`contractId`) defines it.
  const contractsQuery = useClientContracts(customerId, true);
  const ownerContract = (contractsQuery.data ?? []).find(ownsTv) ?? null;
  const effectiveContractId = ownerContract?.id ?? contractId;
  // Show the "lives elsewhere" hint only when the owner is a DIFFERENT contract
  // than the one that opened the panel.
  const ownerElsewhere = ownerContract && ownerContract.id !== contractId ? ownerContract : null;

  // #47c Fix 2 — the local 'TV' ContractService line (the #43 item) lives on the
  // owner contract. When present, the panel exposes a "remove local item" action
  // regardless of link state.
  const localLine = ownerContract ? localTvLine(ownerContract) : null;

  // C1 / #10 — cancel state lifted to the PARENT so it survives the linked→unlinked
  // flip. The cancel is now async: POST → 202, then poll until 'done'|'failed'.
  const cancelTv = useCancelTv(customerId);

  // L3 — snapshot the contractId at the moment the baja is FIRST dispatched.
  // Mirror to state so Reintentar always POSTs the ORIGINAL contractId even after
  // the linked→unlinked flip.
  const [frozenContractId, setFrozenContractId] = useState<string | null>(null);

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  // #10 — true after a 202 is received; enables the status poll.
  const [cancelPolling, setCancelPolling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // #10 — poll the async cancel status while the job is running.
  const cancelStatus = useCancelTvStatus(customerId, cancelPolling);

  // When polling reaches a terminal state, keep the outcome modal open.
  // cancelOutcomeVisible: true once the user has POSTed and the modal should show.
  const [cancelOutcomeVisible, setCancelOutcomeVisible] = useState(false);

  // Derive partial: 'done' with failed packs OR status=failed.
  const cancelResult = cancelStatus.data?.result;
  const cancelIsDone = cancelStatus.data?.status === 'done';
  const cancelIsFailed = cancelStatus.data?.status === 'failed';
  const cancelPartial =
    cancelOutcomeVisible &&
    (cancelIsFailed || (cancelIsDone && (cancelResult?.failed?.length ?? 0) > 0));

  async function doCancel(targetContractId: string) {
    setCancelError(null);
    try {
      const outcome = await cancelTv.mutateAsync({ contractId: targetContractId });
      if (outcome.status === 202) {
        // Async: enable the status poll and show the outcome modal.
        setCancelPolling(true);
        setCancelOutcomeVisible(true);
      }
    } catch (err) {
      const detail = errorDetail(err);
      setCancelError(
        detail ? `No se pudo dar de baja: ${detail}` : 'No se pudo dar de baja la TV. Reintentá.',
      );
    }
  }

  async function confirmCancel() {
    if (cancelTv.isPending) return;
    // L3 — freeze the contractId NOW, before the POST.
    const snapshot = frozenContractId ?? effectiveContractId;
    setFrozenContractId(snapshot);
    setCancelConfirmOpen(false);
    await doCancel(snapshot);
  }

  async function handleRetryCancel() {
    if (cancelTv.isPending) return;
    // Reintentar re-POSTs with the frozen contractId.
    await doCancel(frozenContractId ?? effectiveContractId);
  }

  function closeCancelOutcome() {
    setCancelOutcomeVisible(false);
    setCancelPolling(false);
  }

  // #5B — history modal state lives here (parent of LinkedView) so the modal
  // survives re-renders. The customerId for the scoped history is the panel's own.
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  let body: React.ReactNode;
  let showLocalSection = false;
  if (code === 'GIGARED_NOT_CONFIGURED') {
    body = <GigaredNotConfigured />;
  } else if (accountQuery.isLoading) {
    body = <p className={styles.loading}>Cargando…</p>;
  } else if (accountQuery.isError && status === 403) {
    // F3 — explicit permission failure: NOT the transient retry path.
    body = (
      <div className={`${styles.banner} ${styles.bannerError}`}>
        <span>No tenés permiso para gestionar TV.</span>
      </div>
    );
  } else if (accountQuery.isError && !accountQuery.data) {
    body = (
      <div className={`${styles.banner} ${styles.bannerError}`}>
        <span>No se pudo cargar la información de TV. Reintentá en unos segundos.</span>
      </div>
    );
  } else {
    const { linked, account } = accountQuery.data ?? { linked: false, account: null };
    showLocalSection = true;
    body =
      linked && account ? (
        <LinkedView
          customerId={customerId}
          contractId={effectiveContractId}
          account={account}
          grClienteId={customer?.grClienteId ?? null}
          ownerElsewhere={ownerElsewhere}
          onRequestCancel={() => setCancelConfirmOpen(true)}
          cancelPending={cancelTv.isPending}
          cancelError={cancelError}
          cancelOutcomeVisible={cancelOutcomeVisible}
          onOpenHistory={() => setHistoryModalOpen(true)}
        />
      ) : (
        <UnlinkedView
          customerId={customerId}
          effectiveContractId={effectiveContractId}
          customer={customer}
        />
      );
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gigared-panel-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 id="gigared-panel-title" className={styles.panelTitle}>
            TV — Gigared
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className={styles.panelBody}>
          {body}
          {/* #47i Fix 3 — the "Ítem local" remove action lives ONLY in the
              unlinked view. In the linked flow the local 'TV' item inactivates
              on its own when the last pack is removed (BE reconcile), so the
              manual remove would be a footgun. Render it only when NOT linked. */}
          {showLocalSection && !accountQuery.data?.linked && localLine && ownerContract && (
            <LocalItemSection
              customerId={customerId}
              contractId={ownerContract.id}
              line={localLine}
            />
          )}
        </div>
      </div>

      {/* C1 — CANCEL MODALS live in the PARENT, not in LinkedView. This ensures
          they survive the linked→unlinked flip that unmounts LinkedView on success. */}

      {/* Strong confirm */}
      {cancelConfirmOpen && (
        <div
          className={styles.confirmBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tv-cancel-title"
          onMouseDown={(e) => {
            // #65 fix wave L14 — no cerrar por backdrop mientras la baja está en vuelo.
            if (e.target === e.currentTarget && !cancelTv.isPending) setCancelConfirmOpen(false);
          }}
        >
          <div className={styles.dialog}>
            <h2 id="tv-cancel-title" className={styles.cardTitle}>Dar de baja TV</h2>
            <p className={styles.emptyHint}>
              Quita TODOS los packs (libera el cupo del partner), apaga el streaming y
              desactiva el ítem TV del contrato. El cliente quedará sin TV. ¿Confirmás
              la baja?
            </p>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setCancelConfirmOpen(false)}
                disabled={cancelTv.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.btnPrimary} ${styles.btnDanger}`}
                onClick={confirmCancel}
                disabled={cancelTv.isPending}
              >
                {cancelTv.isPending ? 'Procesando…' : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* #5B — TV history modal: scoped to this client's activation events. */}
      <ActivationHistoryModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        customerId={customerId}
      />

      {/* Outcome modal — visible regardless of linked state (survives the flip).
          #10 — async: shows spinner while pending/running, banner when terminal. */}
      {cancelOutcomeVisible && (
        <div
          className={styles.confirmBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tv-cancel-outcome-title"
          onMouseDown={(e) => {
            // Only close when terminal and not mid-retry.
            if (e.target === e.currentTarget && (cancelIsDone || cancelIsFailed) && !cancelTv.isPending) {
              closeCancelOutcome();
            }
          }}
        >
          <div className={styles.dialog}>
            <h2 id="tv-cancel-outcome-title" className={styles.cardTitle}>
              {cancelPartial ? 'Baja de TV — parcial' : 'Baja de TV'}
            </h2>

            {/* Polling in progress (pending / running) — show spinner */}
            {!cancelIsDone && !cancelIsFailed && (
              <p className={styles.emptyHint} aria-live="polite">
                ⏳ Dando de baja TV…
              </p>
            )}

            {/* Terminal: success (done + no failures) */}
            {cancelIsDone && !cancelPartial && (
              <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status">
                <span>✓ La baja de TV se completó correctamente.</span>
              </div>
            )}

            {/* Terminal: partial (done + failures) or failed */}
            {cancelPartial && (
              <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
                <span>
                  <span role="img" aria-label="error">✗</span>{' '}
                  {cancelIsFailed
                    ? 'La baja de TV falló.'
                    : `Baja parcial — ${plural(cancelResult?.failed?.length ?? 0, 'pack falló', 'packs fallaron')}${cancelResult?.failed?.[0] ? `: ${cancelResult.failed[0].detail}` : ''}.`}
                </span>
              </div>
            )}

            {/* Detail list — only when we have a result */}
            {cancelResult && (
              <ul className={styles.cancelSteps}>
                <li>
                  Packs: {plural(cancelResult.removed.length, 'pack quitado', 'packs quitados')} — cupo liberado
                  {cancelResult.failed.length > 0
                    ? ` · ${plural(cancelResult.failed.length, 'pack falló', 'packs fallaron')}`
                    : ''}
                  {cancelResult.failed[0] ? ` (${cancelResult.failed[0].detail})` : ''}.
                </li>
                {/* #67 — pack base irremovible: línea INFORMATIVA. */}
                {(cancelResult.unremovable?.length ?? 0) > 0 && (
                  <li>Pack base: no se puede quitar — se libera al renovar el CIC.</li>
                )}
                {/* #74 — OTT report: after renew, the old CIC is gone; show "reiniciada". */}
                {cancelResult.renew
                  ? <li>Cuenta reiniciada (CIC nuevo) — el acceso anterior queda invalidado.</li>
                  : <li>Streaming (OTT): {cancelResult.ottDisabled ? 'apagado' : 'sigue activo'}.</li>}
                <li>Ítem TV del contrato: {cancelResult.local === 'synced' ? 'desactivado' : 'sin desactivar'}.</li>
                <li>
                  CIC: {cancelResult.renew
                    ? `renovado (${cancelResult.renew.oldCic} → ${cancelResult.renew.newCic}) — cupo reciclado`
                    : 'no se pudo renovar'}.
                </li>
                {cancelResult.localCancelled && (
                  <li>Cuenta liberada — el cliente queda sin TV.</li>
                )}
              </ul>
            )}

            <div className={styles.formActions}>
              {cancelPartial && (cancelIsDone || cancelIsFailed) && (
                <button
                  type="button"
                  className={`${styles.btnPrimary} ${styles.btnDanger}`}
                  onClick={handleRetryCancel}
                  disabled={cancelTv.isPending}
                >
                  {cancelTv.isPending ? 'Reintentando…' : 'Reintentar baja'}
                </button>
              )}
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={closeCancelOutcome}
                disabled={cancelTv.isPending || (!cancelIsDone && !cancelIsFailed)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── #47c Fix 2: local TV item removal ───────────────────────────────────────

/**
 * The local 'TV' ContractService line (#43) on the owner contract. Removing it
 * deletes ONLY the local item via the contract-services endpoint — it does NOT
 * touch Gigared. Gated by `clients.write` (the same permission the contract
 * chips use), NOT `tv.write`. Invalidation of ['client-contracts'] is handled by
 * the useRemoveContractService hook.
 *
 * #47i Fix 3 — only rendered in the UNLINKED view (a stray local item with no
 * Gigared account behind it). The linked flow handles removal via reconcile.
 */
function LocalItemSection({
  customerId,
  contractId,
  line,
}: {
  customerId: string;
  contractId: string;
  line: ContractService;
}) {
  const { can } = useMyPermissions();
  const confirm = useConfirm();
  const remove = useRemoveContractService(customerId);

  if (!can('clients.write')) return null;

  async function handleRemove() {
    const ok = await confirm({
      message: '¿Quitar el ítem TV local de este contrato?',
      tone: 'danger',
      confirmLabel: 'Quitar',
    });
    if (!ok) return;
    await remove.mutateAsync({ contractId, id: line.id });
  }

  return (
    <section className={styles.card}>
      <h4 className={styles.cardTitle}>Ítem local</h4>
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.btnLinkDanger}
          onClick={handleRemove}
          disabled={remove.isPending}
        >
          {remove.isPending ? 'Quitando…' : 'Quitar el ítem TV de este contrato'}
        </button>
      </div>
    </section>
  );
}

// ── State 2: not linked ─────────────────────────────────────────────────────

function UnlinkedView({
  customerId,
  effectiveContractId,
  customer,
}: {
  customerId: string;
  /**
   * #47f — the OWNER contract for the TV reconcile. The link carries THIS id so
   * the BE reconciles the local 'TV' item onto it (first activation defines the
   * owner; falls back to the opener when no contract owns TV yet).
   */
  effectiveContractId: string;
  /** #47e B — the Prominense customer, source of the register prefill. */
  customer?: { name: string; email: string; grClienteId?: string | null };
}) {
  const link = useLinkCic(customerId);
  const register = useRegisterAccount(customerId);

  // #47g-2 — link picker MODAL: paginated registered accounts, filtered to the
  // UNLINKED ones (internalId null/empty). A trigger opens a presentable modal;
  // picking a row selects the account (held as `selectedAccount` for the form
  // summary) and closes. A manual toggle falls back to the free-text CIC input.
  const linkAccountsQuery = useGigaredAllAccounts('registered');
  const unlinkedAccounts = (linkAccountsQuery.data ?? []).filter((a) => !a.internalId);
  const [linkManual, setLinkManual] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<GigaredAccount | null>(null);

  const [cic, setCic] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  // #47f — a 207 on the link (account linked, local reconcile failed). Surfaces
  // the same amber + retry pattern as the add; the retry re-posts the link.
  const [linkSyncNotice, setLinkSyncNotice] = useState(false);

  const prefill = customer ? splitName(customer.name) : { firstName: '', lastName: '' };

  // #65 — alta determinística. Con grClienteId (idGR) prefillamos el correo FICTICIO
  // ({apellido}{idGR}@gmail.com). Sin idGR degradamos al email real del cliente (#47e).
  // #70 rework — la contraseña ya NO se prefillea en el form: la genera el backend a partir
  // del idGR (queda visible en Credenciales). El campo de contraseña fue removido del alta.
  const grId = customer?.grClienteId ?? '';
  const ficticioEmail = grId ? deterministicTvEmail(prefill.lastName, grId) : (customer?.email ?? '');

  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: prefill.firstName,
    lastName: prefill.lastName,
    email: ficticioEmail,
  });
  const [registerError, setRegisterError] = useState<string | null>(null);
  // #109 — modal cuando el pool de CICs está agotado (NO_CIC_AVAILABLE).
  const [noCicModalOpen, setNoCicModalOpen] = useState(false);
  const [registerOk, setRegisterOk] = useState(false);
  // #65 fix wave M7 — true cuando el alta funcionó pero las credenciales NO quedaron guardadas
  // en el slot TV (best-effort). Mostramos un warning sutil para que el operador las anote.
  const [registerCredsWarning, setRegisterCredsWarning] = useState(false);

  // #70 rework — la contraseña del ALTA ya NO se carga en el form: la genera el backend
  // server-side a partir del idGR (clave determinística `ip{idGR}`) y queda visible en
  // "Credenciales". Por eso el form NO tiene campo de contraseña ni la manda en el payload.
  // (El modal "Cambiar contraseña" del #65 es OTRA cosa y sigue libre — no se toca acá.)

  // #65 — el correo del alta es FICTICIO, así que el checkbox "Enviar email de
  // activación" arranca SIEMPRE inactivo (no se manda email). El operador puede
  // activarlo a mano si algún día usa un correo real. Sent ALWAYS explicit en el POST.
  const [sendActivationEmail, setSendActivationEmail] = useState(false);

  async function doLink(cicValue: string) {
    setLinkError(null);
    try {
      // #47f — the link carries the OWNER contractId so the BE reconciles the
      // local 'TV' item onto it. A 207 (local:'failed') surfaces amber + retry.
      const result: LinkCicResult = await link.mutateAsync({
        cic: cicValue,
        contractId: effectiveContractId,
      });
      setLinkSyncNotice(result.local === 'failed');
    } catch (err) {
      const c = errorCode(err);
      const detail = errorDetail(err);
      // #47g-3 — the BE now sends `detail` on every gigared error. Mapped codes
      // keep their precise copy; anything else surfaces the partner detail
      // ("No se pudo vincular: {detail}") with a generic fallback.
      setLinkError(
        c === 'CIC_NOT_FOUND'
          ? 'El CIC no existe en Gigared.'
          : c === 'CIC_ALREADY_LINKED'
            ? 'Ese CIC ya está vinculado a otro cliente.'
            : detail
              ? `No se pudo vincular: ${detail}`
              : 'No se pudo vincular la cuenta. Reintentá.',
      );
    }
  }

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!cic || link.isPending) return;
    await doLink(cic);
  }

  // #47f — the retry re-posts the same link; the BE link+reconcile is idempotent.
  async function handleRetryLinkSync() {
    if (!cic || link.isPending) return;
    await doLink(cic);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (register.isPending) return;
    setRegisterError(null);
    setRegisterOk(false);
    setRegisterCredsWarning(false);
    try {
      // #70 rework — el payload del register NO manda password: la genera el backend
      // server-side a partir del idGR. sendActivationEmail viaja SIEMPRE explícito.
      // #65 — contractId carries the owner contract so the BE impacts login + password
      // on the local TV slot (la clave generada queda en "Credenciales").
      // #109 — cic ya NO se manda: el BE asigna uno aleatorio del pool.
      const result = await register.mutateAsync({
        ...form,
        sendActivationEmail,
        contractId: effectiveContractId,
      });
      // Drop the local form state after submit — never keep PII around.
      setForm({ firstName: '', lastName: '', email: '' });
      setSendActivationEmail(false);
      setRegisterOk(true);
      // M7 — the account exists, but flag if the credentials did not make it to the slot.
      setRegisterCredsWarning(!result?.credentialsPersisted);
    } catch (err) {
      // The partner returns 422 GIGARED_REJECTED with a human `detail` (e.g.
      // "email already in use"). There is no dedicated ACCOUNT_EXISTS code —
      // surface the partner's detail verbatim, with a generic fallback.
      // #109 — NO_CIC_AVAILABLE: 422 cuando el pool de CICs está agotado → modal dedicado.
      const c = errorCode(err);
      const detail = errorDetail(err);
      if (c === 'NO_CIC_AVAILABLE') {
        setNoCicModalOpen(true);
        return;
      }
      // #47g-3 — surface the partner `detail` whenever it comes (422 reject OR
      // 502/503 upstream), with a generic fallback when it does not.
      setRegisterError(
        c === 'GIGARED_REJECTED'
          ? (detail ?? 'Gigared rechazó el registro. Revisá los datos.')
          : detail
            ? `No se pudo registrar: ${detail}`
            : 'No se pudo registrar la cuenta. Reintentá.',
      );
    }
  }

  return (
    <div className={styles.unlinked}>
      <div className={styles.empty}>
        <h3 className={styles.emptyTitle}>Este cliente no tiene una cuenta de TV vinculada</h3>
        <p className={styles.emptyHint}>
          Vinculá una cuenta existente por su CIC o registrá una cuenta nueva en Gigared.
        </p>
        {/* #47c Fix 3 — make it explicit nothing was created. */}
        <p className={styles.emptyHint}>
          Si cerrás sin vincular ni registrar, no se agregó nada a este contrato.
        </p>
      </div>

      <form className={styles.card} onSubmit={handleLink}>
        <h4 className={styles.cardTitle}>Vincular cuenta existente</h4>

        {linkManual ? (
          <>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="tv-link-cic">CIC</label>
              <input
                id="tv-link-cic"
                className={styles.input}
                value={cic}
                onChange={(e) => setCic(e.target.value)}
                placeholder="Número de CIC en Gigared"
              />
            </div>
            <button
              type="button"
              className={styles.btnLink}
              onClick={() => setLinkManual(false)}
            >
              Elegir cuenta de la lista
            </button>
          </>
        ) : selectedAccount ? (
          // A row was picked in the modal — show it as a summary the operator can
          // confirm or change, instead of a buried select value.
          <div className={styles.pickedSummary}>
            <div className={styles.pickedInfo}>
              <span className={styles.pickedName}>
                {[selectedAccount.lastName, selectedAccount.firstName].filter(Boolean).join(' ') ||
                  'Sin nombre'}
              </span>
              <span className={styles.pickedMeta}>
                CIC {selectedAccount.cic}
                {selectedAccount.services.length > 0 &&
                  ` · ${selectedAccount.services.map((s) => s.name).join(' · ')}`}
              </span>
            </div>
            <button
              type="button"
              className={styles.btnLink}
              onClick={() => setPickerOpen(true)}
            >
              Cambiar
            </button>
          </div>
        ) : (
          <>
            <p className={styles.emptyHint}>
              Elegí una cuenta registrada que todavía no esté vinculada.
            </p>
            <div className={styles.linkPickerActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setPickerOpen(true)}
              >
                Elegir cuenta de la lista
              </button>
              <button
                type="button"
                className={styles.btnLink}
                onClick={() => setLinkManual(true)}
              >
                Ingresar CIC manualmente
              </button>
            </div>
          </>
        )}

        {pickerOpen && (
          <LinkAccountPickerModal
            accounts={unlinkedAccounts}
            loading={linkAccountsQuery.isLoading}
            error={linkAccountsQuery.isError}
            onRetry={() => linkAccountsQuery.refetch()}
            onPick={(a) => {
              setSelectedAccount(a);
              setCic(a.cic);
              setLinkError(null);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}

        {linkError && (
          <div className={`${styles.banner} ${styles.bannerError}`}><span>{linkError}</span></div>
        )}
        {linkSyncNotice && (
          <div className={`${styles.banner} ${styles.bannerWarning}`}>
            <span>Cuenta vinculada en Gigared; falló el registro local.</span>
            <button type="button" className={styles.btnLink} onClick={handleRetryLinkSync}>
              Reintentar
            </button>
          </div>
        )}
        <Can permission="tv.link">
          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={!cic || link.isPending}>
              {link.isPending ? 'Vinculando…' : 'Vincular'}
            </button>
          </div>
        </Can>
      </form>

      <div className={styles.card}>
        <button
          type="button"
          className={styles.collapseToggle}
          aria-expanded={registerOpen}
          onClick={() => setRegisterOpen((o) => !o)}
        >
          Registrar cuenta nueva {registerOpen ? '▲' : '▼'}
        </button>

        {registerOpen && (
          <form className={styles.registerForm} onSubmit={handleRegister}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tv-reg-first">Nombre</label>
                <input
                  id="tv-reg-first"
                  className={styles.input}
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tv-reg-last">Apellido</label>
                <input
                  id="tv-reg-last"
                  className={styles.input}
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tv-reg-email">Email</label>
                <input
                  id="tv-reg-email"
                  type="email"
                  className={styles.input}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              {/* #109 — el CIC ya no lo elige el operador: el BE asigna uno aleatorio del pool. */}
              <p className={styles.emptyHint}>
                El CIC se asignará de forma aleatoria.
              </p>

              {/* #70 rework — el ALTA ya NO pide contraseña: la genera el backend
                  automáticamente a partir del idGR. Nota sutil en lugar del campo. */}
              <p className={styles.emptyHint}>
                La contraseña se genera automáticamente. Después se ve en Credenciales.
              </p>
            </div>

            {/* #65 — el correo es FICTICIO, así que el toggle arranca INACTIVO por
                default y no se envía email. Sent ALWAYS explicit. El operador puede
                activarlo si usa un correo real. */}
            <div className={styles.checkboxRow}>
              <label className={styles.checkboxLabel} htmlFor="tv-reg-activation">
                <input
                  id="tv-reg-activation"
                  type="checkbox"
                  className={styles.checkbox}
                  checked={sendActivationEmail}
                  onChange={(e) => setSendActivationEmail(e.target.checked)}
                />
                Enviar email de activación al cliente
              </label>
              <p className={styles.emptyHint}>
                El correo del alta es ficticio: por defecto NO se envía email. Activalo
                solo si cargaste un correo real al que el cliente tenga acceso.
              </p>
            </div>
            {registerError && (
              <div className={`${styles.banner} ${styles.bannerError}`}><span>{registerError}</span></div>
            )}
            {registerOk && (
              <div className={`${styles.banner} ${styles.bannerSuccess}`}>
                <span>
                  Cuenta registrada
                  {sendActivationEmail ? ' — se envió el email de activación.' : '.'}
                </span>
              </div>
            )}
            {/* #65 fix wave M7 — la cuenta existe pero las credenciales no quedaron guardadas. */}
            {registerCredsWarning && (
              <div className={`${styles.banner} ${styles.bannerWarning}`}>
                <span>La clave no quedó guardada en el sistema — anotala.</span>
              </div>
            )}
            <Can permission="tv.register">
              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={register.isPending || !form.firstName || !form.lastName || !form.email}
                >
                  {register.isPending ? 'Registrando…' : 'Registrar'}
                </button>
              </div>
            </Can>
          </form>
        )}
      </div>

      {/* #109 — modal cuando el pool de CICs está agotado */}
      {noCicModalOpen && (
        <div
          className={styles.confirmBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tv-no-cic-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNoCicModalOpen(false);
          }}
        >
          <div className={styles.dialog}>
            <h2 id="tv-no-cic-title" className={styles.cardTitle}>No hay CIC de TV disponible</h2>
            <p className={styles.emptyHint}>
              No hay CIC de TV disponible en el pool. Contactá al administrador para que agregue
              nuevos CICs antes de intentar registrar la cuenta.
            </p>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                aria-label="Cerrar"
                onClick={() => setNoCicModalOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── State 3: linked ─────────────────────────────────────────────────────────

function LinkedView({
  customerId,
  contractId,
  account,
  grClienteId,
  ownerElsewhere,
  onRequestCancel,
  cancelPending,
  cancelError,
  cancelOutcomeVisible,
  onOpenHistory,
}: {
  customerId: string;
  contractId: string;
  account: GigaredAccount;
  /** #65 — GR client id, used to default the change-password modal to a deterministic value. */
  grClienteId: string | null;
  /** F1 — set when the TV item lives in a DIFFERENT contract than the opener. */
  ownerElsewhere: Contract | null;
  /** C1 — triggers the cancel confirm modal in the PARENT (so it survives the flip). */
  onRequestCancel: () => void;
  /** C1 — passed from parent so the button can show a pending/done state. */
  cancelPending: boolean;
  /** C1 — cancel hard-error from the parent (shown inline). */
  cancelError: string | null;
  /** #10 — true once 202 received; hides the "Dar de baja" trigger while polling. */
  cancelOutcomeVisible: boolean;
  /** #5B — opens the per-client TV activation history modal. */
  onOpenHistory: () => void;
}) {
  const confirm = useConfirm();
  const summaryQuery = useGigaredSummary();
  const addService = useAddTvService(customerId);
  const removeService = useRemoveTvService(customerId);
  const setOtt = useSetOtt(customerId);
  const changePassword = useChangeTvPassword(customerId);

  // #65 fix wave H3 — Gigared Play credentials. The password NO LONGER rides on the contracts
  // list; we read login+password from the dedicated, guarded endpoint. Lazy: the query only fires
  // when the operator reveals the password (showTvPassword), so the panel does not pull a secret
  // until it is actually needed. Login falls back to the account-derived GIGA{abonado} while the
  // credentials query is loading or absent.
  const [showTvPassword, setShowTvPassword] = useState(false);
  const credentialsQuery = useTvCredentials(customerId, showTvPassword);
  const loginFallback = account.gigaredId ? `GIGA${account.gigaredId}` : (account.ott?.id ?? null);
  const tvLogin = credentialsQuery.data?.login ?? loginFallback;
  const tvPassword = credentialsQuery.data?.password ?? null;
  // #9 / #81 — the current internal_id (sequential identity). Sourced EAGERLY from
  // account.internalId (the account prop is already loaded when LinkedView mounts) so
  // "ID interno" shows immediately on modal open without waiting for "Mostrar contraseña".
  // The credentials query (lazy, tv.register-gated) only carries a post-re-alta snapshot
  // of the same field — we no longer read it for the display here.
  const tvInternalId = account.internalId;

  // Change-password modal state. Default prefilled with the deterministic value when
  // we know the GR id; the operator may type any CUA-valid password.
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  // #65 fix wave M5 — post-success warning: the partner password DID change, but the local copy
  // could not be saved. We surface a sutil warning (with the password) so the operator writes it down.
  const [pwPersistWarning, setPwPersistWarning] = useState<string | null>(null);
  const newPasswordInvalid = newPassword !== '' && !PASSWORD_RE.test(newPassword);

  function openPwModal() {
    setNewPassword(grClienteId ? deterministicTvPassword(grClienteId) : '');
    setShowNewPassword(false);
    setPwError(null);
    setPwPersistWarning(null);
    setPwModalOpen(true);
  }

  async function confirmChangePassword() {
    if (changePassword.isPending) return;
    if (newPassword === '' || newPasswordInvalid) {
      setPwError('La contraseña debe tener 8 a 64 caracteres, solo minúsculas y números.');
      return;
    }
    setPwError(null);
    try {
      // #65 fix wave H1 — NO cic in the payload; the BE resolves the customer's own account.
      const result = await changePassword.mutateAsync({ contractId, password: newPassword });
      if (result?.persisted) {
        // Fully done — close the modal.
        setPwPersistWarning(null);
        setPwModalOpen(false);
      } else {
        // M5 — the partner password changed but the local copy was not saved. Keep the modal open
        // with a warning so the operator notes the new password down.
        setPwPersistWarning(
          `La contraseña se cambió en Gigared (${newPassword}) pero NO quedó guardada en el sistema — anotala.`,
        );
      }
    } catch (err) {
      const detail = errorDetail(err);
      setPwError(detail ? `No se pudo cambiar la contraseña: ${detail}` : 'No se pudo cambiar la contraseña. Reintentá.');
    }
  }

  const [serviceId, setServiceId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<{ serviceId: string } | null>(null);
  const [ottError, setOttError] = useState<string | null>(null);

  // F4 — the OTT "será habilitado" hint is informational; auto-dismiss it so it
  // does not linger across re-renders. Track a local "show" flag the success
  // sets and a timeout clears.
  const [ottHintVisible, setOttHintVisible] = useState(false);

  // Remove flow: the modal carries the gigared service id; the DELETE targets
  // THIS contract. removeSyncNotice tracks a 207 local-sync failure.
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [removeSyncNotice, setRemoveSyncNotice] = useState<{ serviceId: string } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // #47i Fix 1 — the "Agregar servicio" catalog must EXCLUDE packs the account
  // already holds (match by id), so a just-added pack stops showing as available.
  // The qtyAvailable===0 disable still applies to whatever remains.
  const ownedServiceIds = new Set(account.services.map((s) => s.id));
  const partnerServices = (summaryQuery.data?.services ?? []).filter(
    (ps) => !ownedServiceIds.has(ps.id),
  );
  const hasAddablePacks = partnerServices.length > 0;

  // F4 — when the OTT toggle succeeds, show the hint and auto-dismiss it ~5s
  // later (or when an error supersedes it). Reset cleanly on unmount.
  useEffect(() => {
    if (setOtt.isSuccess && !ottError) {
      setOttHintVisible(true);
      const t = setTimeout(() => setOttHintVisible(false), 5000);
      return () => clearTimeout(t);
    }
    setOttHintVisible(false);
  }, [setOtt.isSuccess, ottError]);

  async function doAdd(svc: string) {
    setAddError(null);
    try {
      const result: AddTvServiceResult = await addService.mutateAsync({ serviceId: svc, contractId });
      if (result.local === 'failed') {
        setSyncNotice({ serviceId: svc });
      } else {
        setSyncNotice(null);
        setServiceId('');
      }
    } catch (err) {
      const c = errorCode(err);
      const detail = errorDetail(err);
      // #47g-3 — mapped codes keep their copy; anything else surfaces the
      // partner detail ("No se pudo agregar: {detail}").
      setAddError(
        c === 'CONTRACT_NOT_FOUND'
          ? 'El contrato elegido no es válido para este cliente.'
          : c === 'TV_CATALOG_MISSING'
            ? 'Falta el servicio "TV" en el catálogo. Configuralo primero.'
            : detail
              ? `No se pudo agregar: ${detail}`
              : 'No se pudo agregar el servicio. Reintentá.',
      );
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId || addService.isPending) return;
    await doAdd(serviceId);
  }

  async function handleRetrySync() {
    if (!syncNotice) return;
    await doAdd(syncNotice.serviceId);
  }

  async function handleToggleOtt(next: boolean) {
    if (setOtt.isPending) return;
    setOttError(null);
    try {
      await setOtt.mutateAsync({ enabled: next });
    } catch (err) {
      // #47g-3 — surface the partner detail when it comes.
      const detail = errorDetail(err);
      setOttError(
        detail
          ? `No se pudo cambiar el OTT: ${detail}`
          : 'No se pudo cambiar el OTT. Reintentá en unos segundos.',
      );
    }
  }

  // #47k ① — Suspender TV: a SOFT confirm (the packs and cupo are kept) before
  // PUT ott { enabled: false }. Reactivar needs no confirm — it just turns it on.
  async function handleSuspend() {
    if (setOtt.isPending) return;
    const ok = await confirm({
      message:
        'El cliente no podrá ver TV hasta reactivarla. Los packs y el cupo se conservan.',
      confirmLabel: 'Suspender TV',
    });
    if (!ok) return;
    await handleToggleOtt(false);
  }

  async function handleReactivate() {
    await handleToggleOtt(true);
  }

  async function doRemove(svcId: string) {
    const result: RemoveTvServiceResult = await removeService.mutateAsync({ serviceId: svcId, contractId });
    if (result.local === 'failed') {
      setRemoveSyncNotice({ serviceId: svcId });
    } else {
      setRemoveSyncNotice(null);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoveError(null);
    try {
      await doRemove(removeTarget.id);
      setRemoveTarget(null);
    } catch (err) {
      // #47g-3 — a hard remove failure (not the 207 local-sync path) surfaces the
      // partner detail with a generic fallback. Keep the confirm dialog open so
      // the operator sees the error in context.
      const detail = errorDetail(err);
      setRemoveError(
        detail
          ? `No se pudo quitar: ${detail}`
          : 'No se pudo quitar el servicio. Reintentá.',
      );
    }
  }

  async function handleRetryRemoveSync() {
    if (!removeSyncNotice) return;
    await doRemove(removeSyncNotice.serviceId);
  }

  // #47j Fix 1 — read the normalized 'enabled' status (was '=== active', which
  // never matched the partner's Spanish value, so the switch sat unchecked).
  const ottEnabled = account.ott?.status === 'enabled';

  return (
    <div className={styles.linked}>
      {ownerElsewhere && (
        <div className={`${styles.banner} ${styles.bannerInfo}`}>
          <span>La TV vive en el contrato {ownerElsewhere.name ?? ownerElsewhere.plan}.</span>
        </div>
      )}
      {/* #5B — history shortcut: shows every alta/baja/reactivación cycle for this
          client (append-only tv_activation_events), unlike ServiceHistoryModal (#73)
          which collapses to 1 TV row and loses the baja date on reactivation. */}
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onOpenHistory}
        >
          Historial TV
        </button>
      </div>
      <section className={styles.card}>
        <h4 className={styles.cardTitle}>Cuenta de TV</h4>
        <dl className={styles.accountGrid}>
          <div><dt className={styles.dt}>CIC</dt><dd className={styles.dd}>{account.cic}</dd></div>
          <div><dt className={styles.dt}>Email</dt><dd className={styles.dd}>{account.email ?? '—'}</dd></div>
          <div>
            <dt className={styles.dt}>Nombre</dt>
            <dd className={styles.dd}>
              {[account.firstName, account.lastName].filter(Boolean).join(' ') || '—'}
            </dd>
          </div>
          <div>
            <dt className={styles.dt}>Alta</dt>
            <dd className={styles.dd}>
              {formatDateShort(account.registrationDate)}
            </dd>
          </div>
        </dl>
      </section>

      {/* #65 — Credenciales Gigared Play: login (GIGA+abonado) + contraseña impactada
          en el alta (visible con toggle), con acción "Cambiar contraseña". */}
      <section className={styles.card}>
        <h4 className={styles.cardTitle}>Credenciales Gigared Play</h4>
        <dl className={styles.accountGrid}>
          <div>
            <dt className={styles.dt}>Login</dt>
            <dd className={styles.dd}>{tvLogin ?? '—'}</dd>
          </div>
          {/* #81 — ID interno: la identidad secuencial del cliente en Gigared.
              Cambia con cada re-alta (seq=0 → UUID del cliente; seq>0 → {clientId}-{seq}).
              Solo visible una vez que el query de credenciales resolvió. */}
          <div>
            <dt className={styles.dt}>ID interno</dt>
            <dd className={styles.dd}>{tvInternalId ?? '—'}</dd>
          </div>
          {/* Doble capa (#65 re-review): el endpoint /tv-credentials exige tv.register —
              la fila de contraseña solo se renderiza (y el fetch solo puede dispararse)
              con ese mismo permiso. */}
          <Can permission="tv.register">
            <div>
              <dt className={styles.dt}>Contraseña</dt>
              <dd className={styles.dd}>
                {/* H3 — the password is fetched lazily from the guarded endpoint on reveal. */}
                <span className={styles.passwordRow}>
                  <span>
                    {!showTvPassword
                      ? '••••••••'
                      : credentialsQuery.isLoading
                        ? 'Cargando…'
                        : credentialsQuery.isError
                          ? 'No disponible'
                          : (tvPassword ?? '—')}
                  </span>
                  <button
                    type="button"
                    className={styles.btnLink}
                    aria-label={showTvPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowTvPassword((s) => !s)}
                  >
                    {showTvPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </span>
              </dd>
            </div>
          </Can>
        </dl>
        <Can permission="tv.register">
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={openPwModal}>
              Cambiar contraseña
            </button>
          </div>
        </Can>
      </section>

      <section className={styles.card}>
        <h4 className={styles.cardTitle}>Servicios</h4>
        {account.services.length === 0 ? (
          <p className={styles.emptyHint}>Sin servicios de TV activos.</p>
        ) : (
          <ul className={styles.serviceList}>
            {account.services.map((s) => (
              <li key={s.id} className={styles.serviceItem}>
                <span>{s.name}</span>
                {/* #47j Fix 2 — "Gigared Play Full" is the partner BASE pack: it
                    cannot be removed, so it shows a subtle "Pack base" tag instead
                    of "Quitar". Match is by EXACT name; if the partner renames it,
                    the "Quitar" reappears and the upstream decides. */}
                {s.name === BASE_PACK_NAME ? (
                  <span className={styles.basePackTag}>Pack base</span>
                ) : (
                  <Can permission="tv.packs">
                    <button
                      type="button"
                      className={styles.btnLinkDanger}
                      onClick={() => setRemoveTarget({ id: s.id, name: s.name })}
                    >
                      Quitar
                    </button>
                  </Can>
                )}
              </li>
            ))}
          </ul>
        )}

        {syncNotice && (
          <div className={`${styles.banner} ${styles.bannerWarning}`}>
            <span>Servicio activado en Gigared; falló el registro local.</span>
            <button type="button" className={styles.btnLink} onClick={handleRetrySync}>
              Reintentar
            </button>
          </div>
        )}

        {removeSyncNotice && (
          <div className={`${styles.banner} ${styles.bannerWarning}`}>
            <span>Servicio dado de baja en Gigared; falló el registro local.</span>
            <button type="button" className={styles.btnLink} onClick={handleRetryRemoveSync}>
              Reintentar
            </button>
          </div>
        )}

        <Can permission="tv.packs">
          {/* #47i Fix 1 — only render the add control when there is a pack the
              account does NOT already have. Otherwise a subtle hint replaces it. */}
          {hasAddablePacks ? (
            <form className={styles.addForm} onSubmit={handleAdd}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tv-add-service">Agregar servicio</label>
                <select
                  id="tv-add-service"
                  className={styles.select}
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                >
                  <option value="">Elegí un servicio…</option>
                  {partnerServices.map((ps) => (
                    <option key={ps.id} value={ps.id} disabled={ps.qtyAvailable === 0}>
                      {ps.name}{ps.qtyAvailable === 0 ? ' (sin cupo)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {addError && (
                <div className={`${styles.banner} ${styles.bannerError}`}><span>{addError}</span></div>
              )}
              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={!serviceId || addService.isPending}
                >
                  {addService.isPending ? 'Agregando…' : 'Agregar'}
                </button>
              </div>
            </form>
          ) : (
            <p className={styles.emptyHint}>Ya tiene todos los packs disponibles.</p>
          )}
        </Can>
      </section>

      <Can permission="tv.ott">
        {/* #47k ① — Suspender / Reactivar TV. The raw OTT checkbox is replaced by
            semantic actions. Enabled → "Suspender TV" (soft confirm). Disabled →
            a prominent SUSPENDIDA badge + "Reactivar TV". The pantallas/devices
            info line stays in both states. */}
        <section className={styles.card}>
          <div className={styles.ottHeader}>
            <div>
              <h4 className={styles.cardTitle}>Streaming (OTT)</h4>
              <p className={styles.cardSubtitle}>La app de TV de Gigared (Gigared Play).</p>
            </div>
            {ottEnabled ? (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleSuspend}
                disabled={setOtt.isPending}
              >
                {setOtt.isPending ? 'Aplicando…' : 'Suspender TV'}
              </button>
            ) : (
              <div className={styles.suspendActions}>
                <span className={styles.suspendedBadge}>TV suspendida</span>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleReactivate}
                  disabled={setOtt.isPending}
                >
                  {setOtt.isPending ? 'Aplicando…' : 'Reactivar TV'}
                </button>
              </div>
            )}
          </div>
          {ottError && (
            <div className={`${styles.banner} ${styles.bannerError}`}><span>{ottError}</span></div>
          )}
          {!ottError && ottHintVisible && (
            <p className={styles.emptyHint}>El cambio será habilitado en los próximos minutos.</p>
          )}
          {account.ott && (
            // #60: solo mostramos las licencias (pantallas fijas/móviles). El contador
            // registeredDevices viene roto upstream — siempre 0 en las 87 cuentas
            // registradas (verificado 2026-06-12) y la API de Gigared no expone lista
            // de dispositivos. El campo sigue llegando en el contrato BE; no lo mostramos.
            <p className={styles.emptyHint}>
              Puede ver en hasta {plural(account.ott.stationaryLicenses, 'pantalla fija', 'pantallas fijas')}{' '}
              y {plural(account.ott.mobileLicenses, 'móvil', 'móviles')}
            </p>
          )}
        </section>
      </Can>

      <Can permission="tv.cancel">
        {/* #47k ② / #64 — Dar de baja TV. A danger action at the foot of the services
            area; the strong confirm opens in the PARENT (C1 lift) so its outcome modal
            survives the linked→unlinked flip. */}
        <section className={styles.cancelSection}>
          {cancelError && (
            <div className={`${styles.banner} ${styles.bannerError}`}><span>{cancelError}</span></div>
          )}
          {!cancelOutcomeVisible && (
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnLinkDanger}
                onClick={onRequestCancel}
                disabled={cancelPending}
              >
                Dar de baja TV
              </button>
            </div>
          )}
        </section>
      </Can>

      {pwModalOpen && (
        <div
          className={styles.confirmBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tv-pw-title"
          onMouseDown={(e) => {
            // #65 fix wave L14 — no cerrar el modal por backdrop mientras el cambio está en vuelo.
            if (e.target === e.currentTarget && !changePassword.isPending) setPwModalOpen(false);
          }}
        >
          <div className={styles.dialog}>
            <h2 id="tv-pw-title" className={styles.cardTitle}>Cambiar contraseña de TV</h2>
            <p className={styles.emptyHint}>
              Se actualiza la contraseña de la cuenta en Gigared y queda impactada acá.
              Solo letras minúsculas y números (8 a 64).
            </p>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="tv-pw-new">Nueva contraseña</label>
              <div className={styles.passwordRow}>
                <input
                  id="tv-pw-new"
                  type={showNewPassword ? 'text' : 'password'}
                  className={styles.input}
                  value={newPassword}
                  autoComplete="new-password"
                  aria-invalid={newPasswordInvalid}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.btnLink}
                  aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowNewPassword((s) => !s)}
                >
                  {showNewPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {newPasswordInvalid && (
                <p className={styles.fieldError}>Solo minúsculas y números, 8 a 64 caracteres.</p>
              )}
            </div>
            {pwError && (
              <div className={`${styles.banner} ${styles.bannerError}`}><span>{pwError}</span></div>
            )}
            {pwPersistWarning && (
              <div className={`${styles.banner} ${styles.bannerWarning}`}><span>{pwPersistWarning}</span></div>
            )}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setPwModalOpen(false)}
                disabled={changePassword.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={confirmChangePassword}
                disabled={changePassword.isPending || newPassword === '' || newPasswordInvalid}
              >
                {changePassword.isPending ? 'Cambiando…' : 'Cambiar contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <div
          className={styles.confirmBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tv-remove-title"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setRemoveTarget(null); setRemoveError(null); } }}
        >
          <div className={styles.dialog}>
            <h2 id="tv-remove-title" className={styles.cardTitle}>Quitar servicio de TV</h2>
            <p className={styles.emptyHint}>
              ¿Quitar "{removeTarget.name}"? Se desactivará en Gigared.
            </p>
            {removeError && (
              <div className={`${styles.banner} ${styles.bannerError}`}><span>{removeError}</span></div>
            )}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => { setRemoveTarget(null); setRemoveError(null); }}
                disabled={removeService.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.btnPrimary} ${styles.btnDanger}`}
                onClick={confirmRemove}
                disabled={removeService.isPending}
              >
                {removeService.isPending ? 'Procesando…' : 'Quitar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
