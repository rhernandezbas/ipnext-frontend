import { useEffect, useMemo, useState } from 'react';
import { useGigaredSummary, useGigaredAccounts } from '@/hooks/useGigared';
import { GigaredNotConfigured } from '@/components/molecules/GigaredNotConfigured/GigaredNotConfigured';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import type { GigaredAccount, GigaredAccountStatus, ListAccountsFilter } from '@/types/gigared';
import styles from './GigaredAccountsPage.module.css';

// The partner API caps pagination_limit at 20 — verified live 2026-06-11
// (>20 returns 400 "La paginación tiene un límite de 20 cuentas").
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
    render: (r: Row) => [r.firstName, r.lastName].filter(Boolean).join(' ') || '—',
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
    label: 'OTT',
    render: (r: Row) => (r.ott?.status === 'active' ? 'Activo' : '—'),
  },
];

export default function GigaredAccountsPage() {
  const [emailInput, setEmailInput] = useState('');
  const [email, setEmail] = useState('');
  const [accountIdInput, setAccountIdInput] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState<GigaredAccountStatus | ''>('');
  const [page, setPage] = useState(1);

  // Debounce the email filter (400ms) so we don't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setEmail(emailInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [emailInput]);

  // Debounce the CIC / internal-id filter → maps to `account_id` on the wire.
  useEffect(() => {
    const t = setTimeout(() => {
      setAccountId(accountIdInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [accountIdInput]);

  const filters: ListAccountsFilter = useMemo(
    () => ({
      ...(email ? { email } : {}),
      ...(accountId ? { accountId } : {}),
      ...(status ? { status } : {}),
      paginationLimit: PAGE_SIZE,
      paginationOffset: (page - 1) * PAGE_SIZE,
    }),
    [email, accountId, status, page],
  );

  const summaryQuery = useGigaredSummary();
  const accountsQuery = useGigaredAccounts(filters);

  const code = accountsQuery.isError ? errorCode(accountsQuery.error) : null;
  const detail = accountsQuery.isError ? errorDetail(accountsQuery.error) : null;

  if (code === 'GIGARED_NOT_CONFIGURED') {
    return (
      <div className={styles.page}>
        <Header />
        <GigaredNotConfigured />
      </div>
    );
  }

  const accounts = accountsQuery.data?.accounts ?? [];
  const rows: Row[] = accounts.map((a) => ({ ...a, id: a.cic }));

  // Bug #47g-1 — REAL totalPages from the summary the page already has. The
  // partner list endpoint gives no total, but the summary does. Without a free
  // -text filter the count maps cleanly: status=registered → registered,
  // status=unregistered → unregistered, no status → total. An email/account_id
  // filter narrows the set in a way the summary can't predict, so there we fall
  // back to the hasNext heuristic (a full page implies one more page).
  const hasTextFilter = !!email || !!accountId;
  const summaryCount = summaryQuery.data
    ? status === 'registered'
      ? summaryQuery.data.accounts.registered
      : status === 'unregistered'
        ? summaryQuery.data.accounts.unregistered
        : summaryQuery.data.accounts.total
    : null;
  const hasNext = accounts.length === PAGE_SIZE;
  const totalPages =
    !hasTextFilter && summaryCount !== null
      ? Math.max(1, Math.ceil(summaryCount / PAGE_SIZE))
      : hasNext
        ? page + 1
        : page;

  return (
    <div className={styles.page}>
      <Header />

      <SummaryStrip />

      <div className={styles.filters}>
        <input
          className={styles.input}
          placeholder="Filtrar por email…"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          aria-label="Filtrar por email"
        />
        <input
          className={styles.input}
          placeholder="CIC o ID interno…"
          value={accountIdInput}
          onChange={(e) => setAccountIdInput(e.target.value)}
          aria-label="CIC o ID interno"
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
          <button type="button" className={styles.btnLink} onClick={() => accountsQuery.refetch()}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <DataTable
            columns={COLUMNS}
            data={rows}
            loading={accountsQuery.isLoading}
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
                  <td className={styles.serviceQty}>
                    {s.qtyAvailable}/{s.qtyPurchased}
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

function Header() {
  return (
    <div className={styles.header}>
      <span className={styles.breadcrumb}>CRM /</span>
      <h1 className={styles.title}>TV</h1>
    </div>
  );
}
