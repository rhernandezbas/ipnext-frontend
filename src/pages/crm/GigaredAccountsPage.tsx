import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGigaredSummary, useGigaredAllAccounts, MAX_FETCHED_ACCOUNTS } from '@/hooks/useGigared';
import { GigaredNotConfigured } from '@/components/molecules/GigaredNotConfigured/GigaredNotConfigured';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { StatusBadge } from '@/components/atoms/StatusBadge';
import { ActivationHistoryModal } from '@/components/molecules/ActivationHistoryModal/ActivationHistoryModal';
import type { GigaredAccount, GigaredAccountStatus } from '@/types/gigared';
import styles from './GigaredAccountsPage.module.css';

// #61 — client-side pagination over the fetched list.
// PAGE_SIZE matches the partner cap (20) so each page slice feels natural.
//
// #61 fix wave — NOTE: the list is NOT guaranteed to be the full catalogue. The
// fetch loop in useGigaredAllAccounts stops at MAX_FETCHED_ACCOUNTS (200) per
// status, so with more accounts the client-side filter searches a SUBSET. We
// surface that honestly via a cap notice instead of claiming a "fully-fetched"
// list. Server-side LIKE is the real fix when counts grow past the cap.
const PAGE_SIZE = 20;

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

type Row = GigaredAccount & { id: string };

const COLUMNS = [
  { key: 'cic', label: 'CIC' },
  {
    key: 'name',
    label: 'Nombre',
    // #47j Fix 3 — when the account is linked to a Prominense customer,
    // the name links to that customer's view. Uses clientId (#3): the bare
    // Client.id (no -seq suffix) so the link is stable across re-altas.
    // Guard: if clientId is null the name is plain text (no broken link).
    // Path mirrors App.tsx: /admin/customers/view/:id.
    render: (r: Row) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(' ') || '—';
      return r.clientId ? (
        <Link className={styles.nameLink} to={`/admin/customers/view/${r.clientId}`}>
          {name}
        </Link>
      ) : (
        name
      );
    },
  },
  { key: 'email', label: 'Email', render: (r: Row) => r.email ?? '—' },
  {
    key: 'services',
    label: 'Servicios',
    render: (r: Row) =>
      r.services.length === 0 ? (
        <span className={styles.muted}>—</span>
      ) : (
        <span className={styles.chips}>
          {r.services.map((s) => (
            <span key={s.id} className={styles.chip}>{s.name}</span>
          ))}
        </span>
      ),
  },
  {
    key: 'ott',
    label: 'Estado',
    // #62 — human-readable TV state pill derived from ott.status.
    // Mapping (design locked):
    //   enabled  → "Activa"    green  (StatusBadge status="active")
    //   disabled → "Suspendida" gray  (StatusBadge status="inactive")
    //   null/absent → "Sin OTT" gray  (StatusBadge status="inactive")
    // Decision: gray (inactive) for both disabled and null — visually distinct
    // from green "Activa" and text makes state unambiguous. No amber variant
    // added: "inactive" gray is clean and avoids design-system churn.
    render: (r: Row) => {
      if (r.ott?.status === 'enabled') {
        return <StatusBadge status="active" label="Activa" />;
      }
      if (r.ott?.status === 'disabled') {
        return <StatusBadge status="inactive" label="Suspendida" />;
      }
      return <StatusBadge status="inactive" label="Sin OTT" />;
    },
  },
];

export default function GigaredAccountsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<GigaredAccountStatus | ''>('');
  const [page, setPage] = useState(1);
  // #2 — global TV history modal state.
  const [historyOpen, setHistoryOpen] = useState(false);

  // #61 — debounce the search (~300ms) so we don't re-filter on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // #61 — "all status" decision: useGigaredAllAccounts requires a non-empty
  // GigaredAccountStatus. When status='' (Todos), we call the hook for BOTH
  // 'registered' and 'unregistered' and merge. This preserves the existing
  // "all" behavior with no new endpoint and no regressions.
  const registeredQuery = useGigaredAllAccounts('registered', status === '' || status === 'registered');
  const unregisteredQuery = useGigaredAllAccounts('unregistered', status === '' || status === 'unregistered');

  // Pick the right query depending on selected status
  const activeQuery = status === 'registered'
    ? registeredQuery
    : status === 'unregistered'
      ? unregisteredQuery
      : registeredQuery; // used to read error/loading when "all"

  const isLoading =
    status === '' ? (registeredQuery.isLoading || unregisteredQuery.isLoading) : activeQuery.isLoading;
  const isError =
    status === '' ? (registeredQuery.isError || unregisteredQuery.isError) : activeQuery.isError;
  const queryError =
    status === '' ? (registeredQuery.error ?? unregisteredQuery.error) : activeQuery.error;

  const allAccounts: GigaredAccount[] = useMemo(() => {
    if (status === 'registered') return registeredQuery.data ?? [];
    if (status === 'unregistered') return unregisteredQuery.data ?? [];
    // "all" — merge both lists; deduplicate by cic just in case
    const reg = registeredQuery.data ?? [];
    const unreg = unregisteredQuery.data ?? [];
    const seen = new Set<string>();
    const merged: GigaredAccount[] = [];
    for (const a of [...reg, ...unreg]) {
      if (!seen.has(a.cic)) {
        seen.add(a.cic);
        merged.push(a);
      }
    }
    return merged;
  }, [status, registeredQuery.data, unregisteredQuery.data]);

  // #61 fix wave — the fetch loop caps at MAX_FETCHED_ACCOUNTS per status. If any
  // active query returned exactly that many rows it was probably truncated, so the
  // filter is running over a subset. Warn honestly. (Edge: a partner with exactly
  // 200 shows the notice harmlessly — better a false positive than a silent subset.)
  const capHit =
    (registeredQuery.data?.length ?? 0) >= MAX_FETCHED_ACCOUNTS ||
    (unregisteredQuery.data?.length ?? 0) >= MAX_FETCHED_ACCOUNTS;

  // #61 — client-side filter: case-insensitive substring over name, CIC, email.
  const filteredAccounts = useMemo(() => {
    // #61 fix wave — trim so a copy-pasted CIC with stray spaces ("2354 ") still
    // matches; an all-whitespace term collapses to empty and shows everything.
    const term = search.trim().toLowerCase();
    if (!term) return allAccounts;
    return allAccounts.filter((a) => {
      const name = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim().toLowerCase();
      const cic = a.cic.toLowerCase();
      const email = (a.email ?? '').toLowerCase();
      return name.includes(term) || cic.includes(term) || email.includes(term);
    });
  }, [allAccounts, search]);

  // #61 — client-side pagination over the filtered list. Real totalPages always.
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageAccounts = filteredAccounts.slice(pageStart, pageStart + PAGE_SIZE);

  const code = isError ? errorCode(queryError) : null;
  const detail = isError ? errorDetail(queryError) : null;

  const summaryQuery = useGigaredSummary();

  if (code === 'GIGARED_NOT_CONFIGURED') {
    return (
      <div className={styles.page}>
        <Header onHistoryClick={() => setHistoryOpen(true)} />
        <GigaredNotConfigured />
        <ActivationHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
      </div>
    );
  }

  const rows: Row[] = pageAccounts.map((a) => ({ ...a, id: a.cic }));

  return (
    <div className={styles.page}>
      <Header onHistoryClick={() => setHistoryOpen(true)} />
      <ActivationHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <SummaryStrip />

      <div className={styles.filters}>
        <input
          className={styles.input}
          placeholder="Buscar por nombre, CIC o email…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Buscar por nombre, CIC o email"
        />
        <select
          className={styles.select}
          value={status}
          aria-label="Estado"
          onChange={(e) => {
            setStatus(e.target.value as GigaredAccountStatus | '');
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          <option value="registered">Registrados</option>
          <option value="unregistered">Sin registrar</option>
        </select>
      </div>

      {code === 'GIGARED_UNAVAILABLE' ? (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span>{detail ?? 'Gigared no responde en este momento.'}</span>
          <button
            type="button"
            className={styles.btnLink}
            onClick={() => {
              // #61 fix wave — only refetch the queries that are actually enabled
              // for the current status; refetching a disabled query is wasted work.
              if (status === '' || status === 'registered') registeredQuery.refetch();
              if (status === '' || status === 'unregistered') unregisteredQuery.refetch();
            }}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {capHit && (
            <div className={`${styles.banner} ${styles.bannerNotice}`}>
              Mostrando las primeras {MAX_FETCHED_ACCOUNTS} cuentas. El buscador
              filtra sobre ese subconjunto.
            </div>
          )}
          <DataTable
            columns={COLUMNS}
            data={rows}
            loading={isLoading}
            emptyMessage="Sin cuentas para el filtro."
          />
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );

  function SummaryStrip() {
    if (summaryQuery.isLoading || !summaryQuery.data) return null;
    const { accounts: counts, services } = summaryQuery.data;
    return (
      <div className={styles.summary}>
        <div className={styles.counts}>
          <span className={styles.count}><strong>{counts.total}</strong> total</span>
          <span className={styles.count}><strong>{counts.registered}</strong> registrados</span>
          <span className={styles.count}><strong>{counts.unregistered}</strong> sin registrar</span>
        </div>
        {services.length > 0 && (
          <table className={styles.serviceTable}>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td className={styles.serviceName}>{s.name}</td>
                  {/* #47j Fix 4 — "0/102" was opaque. Spell out usage: "En uso
                      {used} de {purchased}", with the remaining cupo as a sub.
                      When nothing is left, warn in a quiet tone. */}
                  <td className={styles.serviceQty}>
                    <span className={styles.serviceUsage}>
                      En uso {s.qtyUsed} de {s.qtyPurchased}
                    </span>
                    {s.qtyAvailable === 0 ? (
                      <span className={styles.serviceNoCupo}>sin cupo disponible</span>
                    ) : (
                      <span className={styles.serviceAvailable}>
                        {s.qtyAvailable} disponibles
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }
}

function Header({ onHistoryClick }: { onHistoryClick?: () => void }) {
  return (
    <div className={styles.header}>
      <span className={styles.breadcrumb}>CRM /</span>
      <h1 className={styles.title}>TV</h1>
      {/* #2 — global TV history: opens the ActivationHistoryModal with no customerId
          so the full cross-client log with filters is shown. */}
      {onHistoryClick && (
        <button type="button" className={styles.btnHistorial} onClick={onHistoryClick}>
          Ver historial
        </button>
      )}
    </div>
  );
}
