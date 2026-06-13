import { useState, useMemo, type ReactNode } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useConfirm } from '@/context/ConfirmContext';
import { useActiveSessions, useRevokeSession, useSessionHistory } from '@/hooks/useSessions';
import type { SessionDto, SessionQuery } from '@/types/session';
import { formatDateTimeShort } from '@/utils/formatDate';
import styles from './SessionsBody.module.css';

const PAGE_SIZE = 25;

function formatDate(dateStr: string | null): string {
  return formatDateTimeShort(dateStr);
}

export function SessionsBody() {
  const [page, setPage] = useState(1);
  const confirm = useConfirm();
  const revokeSession = useRevokeSession();

  const query = useMemo<SessionQuery>(() => ({ page, pageSize: PAGE_SIZE }), [page]);

  const { data, isLoading } = useActiveSessions(query);
  const { data: historyData, isLoading: historyLoading } = useSessionHistory();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const historyItems = historyData?.data ?? [];

  async function handleForceLogout(session: SessionDto) {
    const ok = await confirm({
      title: 'Forzar logout',
      message: `¿Forzar el cierre de esta sesión de ${session.actorLogin}?`,
      tone: 'danger',
      confirmLabel: 'Forzar logout',
    });
    if (!ok) return;
    revokeSession.mutate(session.id);
  }

  const activeColumns = [
    {
      label: 'Actor',
      key: 'actorLogin' as const,
      render: (row: SessionDto): ReactNode => row.actorLogin,
    },
    {
      label: 'IP',
      key: 'ip' as const,
      render: (row: SessionDto): ReactNode => row.ip ?? '—',
    },
    {
      label: 'Navegador',
      key: 'userAgent' as const,
      render: (row: SessionDto): ReactNode => (
        <span className={styles.userAgent} title={row.userAgent ?? undefined}>
          {row.userAgent ?? '—'}
        </span>
      ),
    },
    {
      label: 'Inicio',
      key: 'loginAt' as const,
      render: (row: SessionDto): ReactNode => formatDate(row.loginAt),
    },
    {
      label: 'Última actividad',
      key: 'lastSeenAt' as const,
      render: (row: SessionDto): ReactNode => formatDate(row.lastSeenAt),
    },
    {
      label: '',
      key: 'actions' as const,
      render: (row: SessionDto): ReactNode => (
        <button
          type="button"
          className={styles.revokeBtn}
          onClick={() => handleForceLogout(row)}
          disabled={revokeSession.isPending}
        >
          Forzar logout
        </button>
      ),
    },
  ];

  const historyColumns = [
    {
      label: 'Actor',
      key: 'actorLogin' as const,
      render: (row: SessionDto): ReactNode => row.actorLogin,
    },
    {
      label: 'IP',
      key: 'ip' as const,
      render: (row: SessionDto): ReactNode => row.ip ?? '—',
    },
    {
      label: 'Navegador',
      key: 'userAgent' as const,
      render: (row: SessionDto): ReactNode => (
        <span className={styles.userAgent} title={row.userAgent ?? undefined}>
          {row.userAgent ?? '—'}
        </span>
      ),
    },
    {
      label: 'Inicio',
      key: 'loginAt' as const,
      render: (row: SessionDto): ReactNode => formatDate(row.loginAt),
    },
    {
      label: 'Revocada',
      key: 'revokedAt' as const,
      render: (row: SessionDto): ReactNode => formatDate(row.revokedAt),
    },
  ];

  return (
    <div className={styles.body}>
      <section data-testid="active-sessions-section" className={styles.section}>
        <h2 className={styles.sectionHeading}>Sesiones activas</h2>
        <DataTable
          columns={activeColumns}
          data={items}
          loading={isLoading}
          emptyMessage="No hay sesiones activas."
        />

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </button>
          <span className={styles.pageIndicator}>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Siguiente
          </button>
        </div>
      </section>

      <section data-testid="history-section" className={styles.section}>
        <h2 className={styles.sectionHeading}>Historial</h2>
        {historyLoading ? (
          <div className={styles.loadingIndicator} aria-label="Cargando historial">
            Cargando…
          </div>
        ) : (
          <DataTable
            columns={historyColumns}
            data={historyItems}
            loading={false}
            emptyMessage="No hay sesiones en el historial."
          />
        )}
      </section>
    </div>
  );
}
