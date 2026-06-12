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
} from '@/hooks/useGigared';
import { useClientContracts } from '@/hooks/useCustomers';
import { useRemoveContractService, useAddContractService } from '@/hooks/useContractServices';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { Can } from '@/components/auth/Can';
import { GigaredNotConfigured } from '@/components/molecules/GigaredNotConfigured/GigaredNotConfigured';
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
  customer?: { name: string; email: string };
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
          ownerElsewhere={ownerElsewhere}
        />
      ) : (
        <UnlinkedView
          customerId={customerId}
          contractId={contractId}
          effectiveContractId={effectiveContractId}
          customer={customer}
          hasLocalTv={!!localLine}
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
  contractId,
  effectiveContractId,
  customer,
  hasLocalTv,
}: {
  customerId: string;
  /** The contract that opened the panel — target for the local-only add. */
  contractId: string;
  /**
   * #47f — the OWNER contract for the TV reconcile. The link carries THIS id so
   * the BE reconciles the local 'TV' item onto it (first activation defines the
   * owner; falls back to the opener when no contract owns TV yet).
   */
  effectiveContractId: string;
  /** #47e B — the Prominense customer, source of the register prefill. */
  customer?: { name: string; email: string };
  /** True when a local 'TV' item already exists (then the add action is moot). */
  hasLocalTv: boolean;
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

  // #47e B — register CIC picker: paginated UNREGISTERED accounts (Gigared
  // requires an existing, unregistered CIC). Manual toggle falls back to a
  // free-text input.
  const regCicQuery = useGigaredAllAccounts('unregistered');
  const unregisteredAccounts = regCicQuery.data ?? [];
  const [regCicManual, setRegCicManual] = useState(false);

  const prefill = customer ? splitName(customer.name) : { firstName: '', lastName: '' };

  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: prefill.firstName,
    lastName: prefill.lastName,
    email: customer?.email ?? '',
    cic: '',
  });
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerOk, setRegisterOk] = useState(false);

  // #47h — optional account password. Empty is valid (BE generates one); only a
  // non-empty value that breaks ^[a-z0-9]{8,64}$ blocks the submit. The toggle
  // flips the input between password (hidden) and text (shown).
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordInvalid = password !== '' && !PASSWORD_RE.test(password);

  // Gigared form 1:1 — activation email toggle. Default CHECKED; the BE generates
  // a password and the customer sets it from the email. Sent ALWAYS explicit on
  // the POST. When UNCHECKED with no password, the customer would be locked out:
  // warn (do not block — the operator may set the password out-of-band later).
  const [sendActivationEmail, setSendActivationEmail] = useState(true);
  const noLoginWarning = !sendActivationEmail && password === '';

  // #47c Fix 3 — escape hatch: add ONLY the local TV item (no Gigared). Reuses
  // the #43 add endpoint with the 'TV' catalog entry, like the picker's plain
  // path. Gated by clients.write (the contract-item permission via <Can>).
  const { data: catalog = [] } = useServiceCatalog(true);
  const addLocal = useAddContractService(customerId);
  const tvCatalogId = catalog.find((c) => c.name === 'TV')?.id ?? null;
  const [addLocalError, setAddLocalError] = useState<string | null>(null);

  async function handleAddLocal() {
    if (!tvCatalogId || addLocal.isPending) return;
    setAddLocalError(null);
    try {
      await addLocal.mutateAsync({ contractId, payload: { serviceCatalogId: tvCatalogId } });
    } catch {
      setAddLocalError('No se pudo agregar el ítem local. Reintentá.');
    }
  }

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
    // #47h — block the submit while a non-empty password breaks the rule. Empty
    // is fine: the field is simply omitted from the payload.
    if (passwordInvalid) return;
    setRegisterError(null);
    setRegisterOk(false);
    try {
      // Send password ONLY when present; empty → omit it so the BE generates one.
      // sendActivationEmail travels ALWAYS explicit (Gigared form 1:1).
      await register.mutateAsync(
        password
          ? { ...form, password, sendActivationEmail }
          : { ...form, sendActivationEmail },
      );
      // Drop the local form state after submit — never keep PII around.
      setForm({ firstName: '', lastName: '', email: '', cic: '' });
      setPassword('');
      setShowPassword(false);
      setSendActivationEmail(true);
      setRegisterOk(true);
    } catch (err) {
      // The partner returns 422 GIGARED_REJECTED with a human `detail` (e.g.
      // "email already in use"). There is no dedicated ACCOUNT_EXISTS code —
      // surface the partner's detail verbatim, with a generic fallback.
      const c = errorCode(err);
      const detail = errorDetail(err);
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
        {/* #47c Fix 3 — make it explicit nothing was created. If the operator
            picked TV but does not want Gigared, offer the local-only item. */}
        <p className={styles.emptyHint}>
          Si cerrás sin vincular ni registrar, no se agregó nada a este contrato.
        </p>
        {!hasLocalTv && tvCatalogId && (
          <Can permission="clients.write">
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleAddLocal}
                disabled={addLocal.isPending}
              >
                {addLocal.isPending ? 'Agregando…' : 'Agregar solo el ítem local (sin Gigared)'}
              </button>
            </div>
          </Can>
        )}
        {addLocalError && (
          <div className={`${styles.banner} ${styles.bannerError}`}><span>{addLocalError}</span></div>
        )}
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
        <Can permission="tv.write">
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
              <div className={styles.field}>
                {regCicManual ? (
                  <>
                    <label className={styles.fieldLabel} htmlFor="tv-reg-cic">CIC</label>
                    <input
                      id="tv-reg-cic"
                      className={styles.input}
                      value={form.cic}
                      onChange={(e) => setForm((f) => ({ ...f, cic: e.target.value }))}
                    />
                    <button
                      type="button"
                      className={styles.btnLink}
                      onClick={() => setRegCicManual(false)}
                    >
                      Elegir de la lista
                    </button>
                  </>
                ) : (
                  <>
                    <label className={styles.fieldLabel} htmlFor="tv-reg-cic-select">
                      CIC disponible
                    </label>
                    <select
                      id="tv-reg-cic-select"
                      className={styles.select}
                      value={form.cic}
                      onChange={(e) => setForm((f) => ({ ...f, cic: e.target.value }))}
                    >
                      <option value="">Elegí un CIC…</option>
                      {unregisteredAccounts.map((a) => (
                        <option key={a.cic} value={a.cic}>
                          CIC {a.cic}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.btnLink}
                      onClick={() => setRegCicManual(true)}
                    >
                      Ingresar otro CIC manualmente
                    </button>
                  </>
                )}
              </div>

              {/* #47h — optional account password. Helper is ALWAYS visible; live
                  validation flags a non-empty value that breaks the rule. */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tv-reg-password">
                  Contraseña (opcional)
                </label>
                <div className={styles.passwordRow}>
                  <input
                    id="tv-reg-password"
                    type={showPassword ? 'text' : 'password'}
                    className={styles.input}
                    value={password}
                    autoComplete="new-password"
                    aria-invalid={passwordInvalid}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.btnLink}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <p className={passwordInvalid ? styles.fieldError : styles.emptyHint}>
                  Solo letras minúsculas y números (8 a 64). Si la dejás vacía, se
                  genera una automáticamente y el cliente la define desde el email
                  de activación.
                </p>
              </div>
            </div>

            {/* Gigared form 1:1 — activation email toggle. Default checked; sent
                ALWAYS explicit. Unchecked + empty password → non-blocking warning. */}
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
                El cliente recibe un email para activar su cuenta y definir su contraseña.
              </p>
            </div>
            {noLoginWarning && (
              <div className={`${styles.banner} ${styles.bannerWarning}`}>
                <span>
                  Sin email de activación y sin contraseña, el cliente no podrá ingresar.
                </span>
              </div>
            )}
            {registerError && (
              <div className={`${styles.banner} ${styles.bannerError}`}><span>{registerError}</span></div>
            )}
            {registerOk && (
              <div className={`${styles.banner} ${styles.bannerSuccess}`}>
                <span>Cuenta registrada — se envió el email de activación.</span>
              </div>
            )}
            <Can permission="tv.write">
              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={register.isPending || passwordInvalid || !form.firstName || !form.lastName || !form.email || !form.cic}
                >
                  {register.isPending ? 'Registrando…' : 'Registrar'}
                </button>
              </div>
            </Can>
          </form>
        )}
      </div>
    </div>
  );
}

// ── State 3: linked ─────────────────────────────────────────────────────────

function LinkedView({
  customerId,
  contractId,
  account,
  ownerElsewhere,
}: {
  customerId: string;
  contractId: string;
  account: GigaredAccount;
  /** F1 — set when the TV item lives in a DIFFERENT contract than the opener. */
  ownerElsewhere: Contract | null;
}) {
  const summaryQuery = useGigaredSummary();
  const addService = useAddTvService(customerId);
  const removeService = useRemoveTvService(customerId);
  const setOtt = useSetOtt(customerId);

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
              {account.registrationDate
                ? new Date(account.registrationDate).toLocaleDateString('es-AR')
                : '—'}
            </dd>
          </div>
        </dl>
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
                  <Can permission="tv.write">
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

        <Can permission="tv.write">
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

      <Can permission="tv.write">
        {/* #47i Fix 2 — human OTT copy. "OTT" alone meant nothing to operators:
            give it a name, one line of what it is, and a legible usage line. */}
        <section className={styles.card}>
          <div className={styles.ottHeader}>
            <div>
              <h4 className={styles.cardTitle}>Streaming (OTT)</h4>
              <p className={styles.cardSubtitle}>La app de TV de Gigared (Gigared Play).</p>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={ottEnabled}
                disabled={setOtt.isPending}
                onChange={(e) => handleToggleOtt(e.target.checked)}
                aria-label="OTT"
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
            {setOtt.isPending && <span className={styles.pending}>Aplicando…</span>}
          </div>
          {ottError && (
            <div className={`${styles.banner} ${styles.bannerError}`}><span>{ottError}</span></div>
          )}
          {!ottError && ottHintVisible && (
            <p className={styles.emptyHint}>El cambio será habilitado en los próximos minutos.</p>
          )}
          {account.ott && (
            <p className={styles.emptyHint}>
              Puede ver en hasta {plural(account.ott.stationaryLicenses, 'pantalla fija', 'pantallas fijas')}{' '}
              y {plural(account.ott.mobileLicenses, 'móvil', 'móviles')} ·{' '}
              {plural(account.ott.registeredDevices, 'dispositivo registrado', 'dispositivos registrados')}
            </p>
          )}
        </section>
      </Can>

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
