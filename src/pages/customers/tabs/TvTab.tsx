import { useMemo, useState } from 'react';
import {
  useGigaredCustomerAccount,
  useGigaredSummary,
  useLinkCic,
  useRegisterAccount,
  useAddTvService,
  useRemoveTvService,
  useSetOtt,
} from '@/hooks/useGigared';
import { useClientContracts } from '@/hooks/useCustomers';
import { Can } from '@/components/auth/Can';
import { GigaredNotConfigured } from '@/components/molecules/GigaredNotConfigured/GigaredNotConfigured';
import type { GigaredAccount, AddTvServiceResult, RemoveTvServiceResult } from '@/types/gigared';
import type { Contract } from '@/types/customer';
import styles from './TvTab.module.css';

interface TvTabProps {
  customerId: string;
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

/** Contracts whose service lines include an active "TV" line — the DELETE target. */
function tvContracts(contracts: Contract[]): Contract[] {
  return contracts.filter((c) => (c.services ?? []).some((s) => s.name === 'TV'));
}

export function TvTab({ customerId }: TvTabProps) {
  const accountQuery = useGigaredCustomerAccount(customerId);
  const code = accountQuery.isError ? errorCode(accountQuery.error) : null;

  if (code === 'GIGARED_NOT_CONFIGURED') {
    return (
      <div className={styles.tab}>
        <GigaredNotConfigured />
      </div>
    );
  }

  if (accountQuery.isLoading) {
    return <div className={styles.tab}><p className={styles.loading}>Cargando…</p></div>;
  }

  if (accountQuery.isError && !accountQuery.data) {
    return (
      <div className={styles.tab}>
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span>No se pudo cargar la información de TV. Reintentá en unos segundos.</span>
        </div>
      </div>
    );
  }

  const { linked, account } = accountQuery.data ?? { linked: false, account: null };

  return (
    <div className={styles.tab}>
      {linked && account ? (
        <LinkedView customerId={customerId} account={account} />
      ) : (
        <UnlinkedView customerId={customerId} />
      )}
    </div>
  );
}

// ── State 2: not linked ─────────────────────────────────────────────────────

function UnlinkedView({ customerId }: { customerId: string }) {
  const link = useLinkCic(customerId);
  const register = useRegisterAccount(customerId);

  const [cic, setCic] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', cic: '' });
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerOk, setRegisterOk] = useState(false);

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
      </div>

      <form className={styles.card} onSubmit={handleLink}>
        <h4 className={styles.cardTitle}>Vincular cuenta existente</h4>
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
                <label className={styles.fieldLabel} htmlFor="tv-reg-cic">CIC</label>
                <input
                  id="tv-reg-cic"
                  className={styles.input}
                  value={form.cic}
                  onChange={(e) => setForm((f) => ({ ...f, cic: e.target.value }))}
                />
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

function LinkedView({ customerId, account }: { customerId: string; account: GigaredAccount }) {
  const summaryQuery = useGigaredSummary();
  const contractsQuery = useClientContracts(customerId, true);
  const addService = useAddTvService(customerId);
  const removeService = useRemoveTvService(customerId);
  const setOtt = useSetOtt(customerId);

  const [serviceId, setServiceId] = useState('');
  const [contractId, setContractId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<{ serviceId: string; contractId: string } | null>(null);
  const [ottError, setOttError] = useState<string | null>(null);

  // Remove flow: the modal carries the gigared service id and the contractId
  // it will DELETE against. removeSyncNotice tracks a 207 local-sync failure.
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [removeContractId, setRemoveContractId] = useState('');
  const [removeSyncNotice, setRemoveSyncNotice] =
    useState<{ serviceId: string; contractId: string } | null>(null);

  const partnerServices = summaryQuery.data?.services ?? [];
  const contracts = contractsQuery.data ?? [];

  // Contracts that actually carry a TV service line — the only valid DELETE
  // targets. NEVER the add-form state and NEVER an arbitrary contracts[0].
  const eligibleContracts = useMemo(() => tvContracts(contracts), [contracts]);

  async function doAdd(svc: string, ct: string) {
    setAddError(null);
    try {
      const result: AddTvServiceResult = await addService.mutateAsync({ serviceId: svc, contractId: ct });
      if (result.local === 'failed') {
        setSyncNotice({ serviceId: svc, contractId: ct });
      } else {
        setSyncNotice(null);
        setServiceId('');
        setContractId('');
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
    if (!serviceId || !contractId || addService.isPending) return;
    await doAdd(serviceId, contractId);
  }

  async function handleRetrySync() {
    if (!syncNotice) return;
    await doAdd(syncNotice.serviceId, syncNotice.contractId);
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

  function openRemove(svc: { id: string; name: string }) {
    // Default the DELETE to the FIRST contract that carries a TV service.
    setRemoveContractId(eligibleContracts[0]?.id ?? '');
    setRemoveTarget(svc);
  }

  async function doRemove(svcId: string, ct: string) {
    const result: RemoveTvServiceResult = await removeService.mutateAsync({ serviceId: svcId, contractId: ct });
    if (result.local === 'failed') {
      setRemoveSyncNotice({ serviceId: svcId, contractId: ct });
    } else {
      setRemoveSyncNotice(null);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    await doRemove(removeTarget.id, removeContractId);
    setRemoveTarget(null);
  }

  async function handleRetryRemoveSync() {
    if (!removeSyncNotice) return;
    await doRemove(removeSyncNotice.serviceId, removeSyncNotice.contractId);
  }

  const ottEnabled = account.ott?.status === 'active';

  return (
    <div className={styles.linked}>
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
                    onClick={() => openRemove({ id: s.id, name: s.name })}
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
            <div className={styles.formGrid}>
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
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tv-add-contract">Contrato</label>
                <select
                  id="tv-add-contract"
                  className={styles.select}
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                >
                  <option value="">Elegí un contrato…</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name ?? c.plan}</option>
                  ))}
                </select>
              </div>
            </div>
            {addError && (
              <div className={`${styles.banner} ${styles.bannerError}`}><span>{addError}</span></div>
            )}
            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={!serviceId || !contractId || addService.isPending}
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
          {!ottError && setOtt.isSuccess && (
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
          className={styles.backdrop}
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
            {eligibleContracts.length > 1 && (
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tv-remove-contract">Contrato</label>
                <select
                  id="tv-remove-contract"
                  className={styles.select}
                  value={removeContractId}
                  onChange={(e) => setRemoveContractId(e.target.value)}
                >
                  {eligibleContracts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name ?? c.plan}</option>
                  ))}
                </select>
              </div>
            )}
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
