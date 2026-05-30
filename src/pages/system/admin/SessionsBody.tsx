import { useState, useMemo, type ReactNode } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useConfirm } from '@/context/ConfirmContext';
import { useActiveSessions, useRevokeSession } from '@/hooks/useSessions';
import type { SessionDto, SessionQuery } from '@/types/session';
import styles from './SessionsBody.module.css';

const PAGE_SIZE = 25;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SessionsBody() {
  const [page, setPage] = useState(1);
  const confirm = useConfirm();
  const revokeSession = useRevokeSession();

  const query = useMemo<SessionQuery>(() => ({ page, pageSize: PAGE_SIZE }), [page]);

  const { data, isLoading } = useActiveSessions(query);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

  const columns = [
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

  return (
    <div className={styles.body}>
      <DataTable
        columns={columns}
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
    </div>
  );
}
