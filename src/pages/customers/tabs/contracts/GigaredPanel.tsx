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
import type { Contract, ContractService } from '@/types/customer';
import type { GigaredAccount, AddTvServiceResult, RemoveTvServiceResult } from '@/types/gigared';
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

/** Picker label: "APELLIDO NOMBRE — CIC 000… (pack, pack)". */
function accountLabel(a: GigaredAccount): string {
  const name = [a.lastName, a.firstName].filter(Boolean).join(' ') || 'Sin nombre';
  const packs = a.services.map((s) => s.name).join(', ');
  return packs
    ? `${name} — CIC ${a.cic} (${packs})`
    : `${name} — CIC ${a.cic}`;
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
          {showLocalSection && localLine && ownerContract && (
            <LocalItemSection
              customerId={customerId}
              contractId={ownerContract.id}
              line={localLine}
              linked={!!accountQuery.data?.linked}
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
 */
function LocalItemSection({
  customerId,
  contractId,
  line,
  linked,
}: {
  customerId: string;
  contractId: string;
  line: ContractService;
  linked: boolean;
}) {
  const { can } = useMyPermissions();
  const confirm = useConfirm();
  const remove = useRemoveContractService(customerId);

  if (!can('clients.write')) return null;

  async function handleRemove() {
    const ok = await confirm({
      message: linked
        ? '¿Quitar el ítem TV local de este contrato? No toca la cuenta Gigared — solo elimina el ítem del contrato.'
        : '¿Quitar el ítem TV local de este contrato?',
      tone: 'danger',
      confirmLabel: 'Quitar',
    });
    if (!ok) return;
    await remove.mutateAsync({ contractId, id: line.id });
  }

  return (
    <section className={styles.card}>
      <h4 className={styles.cardTitle}>Ítem local</h4>
      {linked && (
        <p className={styles.emptyHint}>
          Esto no toca Gigared: solo elimina el ítem TV del contrato.
        </p>
      )}
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
  customer,
  hasLocalTv,
}: {
  customerId: string;
  /** The contract that opened the panel — target for the local-only add. */
  contractId: string;
  /** #47e B — the Prominense customer, source of the register prefill. */
  customer?: { name: string; email: string };
  /** True when a local 'TV' item already exists (then the add action is moot). */
  hasLocalTv: boolean;
}) {
  const link = useLinkCic(customerId);
  const register = useRegisterAccount(customerId);

  // #47e A — link picker: paginated registered accounts, filtered to the
  // UNLINKED ones (internalId null/empty). The operator picks a CIC instead of
  // typing it; a manual toggle falls back to the free-text input.
  const linkAccountsQuery = useGigaredAllAccounts('registered');
  const unlinkedAccounts = (linkAccountsQuery.data ?? []).filter((a) => !a.internalId);
  const [pickerQuery, setPickerQuery] = useState('');
  const [linkManual, setLinkManual] = useState(false);

  const filteredAccounts = unlinkedAccounts.filter((a) => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return true;
    const name = [a.lastName, a.firstName].filter(Boolean).join(' ').toLowerCase();
    return name.includes(q) || a.cic.toLowerCase().includes(q);
  });

  const [cic, setCic] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

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

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!cic || link.isPending) return;
    setLinkError(null);
    try {
      await link.mutateAsync({ cic });
    } catch (err) {
      const c = errorCode(err);
      setLinkError(
        c === 'CIC_NOT_FOUND'
          ? 'El CIC no existe en Gigared.'
          : c === 'CIC_ALREADY_LINKED'
            ? 'Ese CIC ya está vinculado a otro cliente.'
            : 'No se pudo vincular la cuenta. Reintentá.',
      );
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (register.isPending) return;
    setRegisterError(null);
    setRegisterOk(false);
    try {
      await register.mutateAsync({ ...form });
      // Drop the local form state after submit — never keep PII around.
      setForm({ firstName: '', lastName: '', email: '', cic: '' });
      setRegisterOk(true);
    } catch (err) {
      // The partner returns 422 GIGARED_REJECTED with a human `detail` (e.g.
      // "email already in use"). There is no dedicated ACCOUNT_EXISTS code —
      // surface the partner's detail verbatim, with a generic fallback.
      const c = errorCode(err);
      const detail = errorDetail(err);
      setRegisterError(
        c === 'GIGARED_REJECTED'
          ? (detail ?? 'Gigared rechazó el registro. Revisá los datos.')
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
              Elegir de la lista
            </button>
          </>
        ) : linkAccountsQuery.isLoading ? (
          <p className={styles.emptyHint}>Cargando cuentas disponibles…</p>
        ) : linkAccountsQuery.isError ? (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <span>No se pudieron cargar las cuentas.</span>
            <button
              type="button"
              className={styles.btnLink}
              onClick={() => linkAccountsQuery.refetch()}
            >
              Reintentar
            </button>
          </div>
        ) : unlinkedAccounts.length === 0 ? (
          <>
            <p className={styles.emptyHint}>
              No quedan cuentas disponibles para vincular.
            </p>
            <button
              type="button"
              className={styles.btnLink}
              onClick={() => setLinkManual(true)}
            >
              Ingresar CIC manualmente
            </button>
          </>
        ) : (
          <>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="tv-link-search">Buscar cuenta</label>
              <input
                id="tv-link-search"
                className={styles.input}
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Nombre o CIC…"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="tv-link-picker">Elegí una cuenta</label>
              <select
                id="tv-link-picker"
                className={styles.select}
                value={cic}
                onChange={(e) => setCic(e.target.value)}
                size={Math.min(Math.max(filteredAccounts.length + 1, 2), 6)}
              >
                {/* Placeholder evita el mismatch visual: sin esto el browser resalta la
                    primera opción aunque el estado siga vacío. */}
                <option value="">— Elegí una cuenta —</option>
                {filteredAccounts.map((a) => (
                  <option key={a.cic} value={a.cic}>
                    {accountLabel(a)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={styles.btnLink}
              onClick={() => setLinkManual(true)}
            >
              Ingresar CIC manualmente
            </button>
          </>
        )}

        {linkError && (
          <div className={`${styles.banner} ${styles.bannerError}`}><span>{linkError}</span></div>
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
            </div>
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
                  disabled={register.isPending || !form.firstName || !form.lastName || !form.email || !form.cic}
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

  const partnerServices = summaryQuery.data?.services ?? [];

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
      setAddError(
        c === 'CONTRACT_NOT_FOUND'
          ? 'El contrato elegido no es válido para este cliente.'
          : c === 'TV_CATALOG_MISSING'
            ? 'Falta el servicio "TV" en el catálogo. Configuralo primero.'
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
    } catch {
      setOttError('No se pudo cambiar el OTT. Reintentá en unos segundos.');
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
    await doRemove(removeTarget.id);
    setRemoveTarget(null);
  }

  async function handleRetryRemoveSync() {
    if (!removeSyncNotice) return;
    await doRemove(removeSyncNotice.serviceId);
  }

  const ottEnabled = account.ott?.status === 'active';

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
                <Can permission="tv.write">
                  <button
                    type="button"
                    className={styles.btnLinkDanger}
                    onClick={() => setRemoveTarget({ id: s.id, name: s.name })}
                  >
                    Quitar
                  </button>
                </Can>
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
        </Can>
      </section>

      <Can permission="tv.write">
        <section className={styles.card}>
          <div className={styles.toggleRow}>
            <span className={styles.fieldLabel}>OTT</span>
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
              Dispositivos registrados: {account.ott.registeredDevices} · Licencias fijas{' '}
              {account.ott.stationaryLicenses} · móviles {account.ott.mobileLicenses}
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
          onMouseDown={(e) => { if (e.target === e.currentTarget) setRemoveTarget(null); }}
        >
          <div className={styles.dialog}>
            <h2 id="tv-remove-title" className={styles.cardTitle}>Quitar servicio de TV</h2>
            <p className={styles.emptyHint}>
              ¿Quitar "{removeTarget.name}"? Se desactivará en Gigared.
            </p>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setRemoveTarget(null)}
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
