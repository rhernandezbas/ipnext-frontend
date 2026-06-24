import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllPppoe } from '@/hooks/useInternetServices';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { StatusBadge } from '@/components/atoms/StatusBadge';
import { Button } from '@/components/atoms/Button';
import { InternetActivationHistoryModal } from '@/components/molecules/InternetActivationHistoryModal/InternetActivationHistoryModal';
import { formatDateTimeShort } from '@/utils/formatDate';
import type {
  PppoeServiceListItem,
  InternetServiceStatus,
} from '@/types/internetService';
import { INTERNET_STATUS_LABELS } from '@/types/internetService';
import styles from './InternetServicesPage.module.css';

// Paginación SERVER-SIDE: a diferencia de la página de TV (cap del partner +
// filtro client-side), el endpoint GET /api/pppoe ya devuelve { data, total,
// page, limit }. Mandamos search/status/nasId/page/limit al BE.
const PAGE_SIZE = 20;

// Catálogo de estado = el status de NEGOCIO computed del PppoeService (NO el de
// Contract, NO el enum RADIUS crudo). Contrato BE: active|reduced|blocked|baja|inactive.
const STATUS_OPTIONS: InternetServiceStatus[] = ['active', 'reduced', 'blocked', 'baja', 'inactive'];

type Row = PppoeServiceListItem & {
  /** id ya viene del item; lo mantenemos para la firma del DataTable. */
  id: string;
};

/**
 * Mapea el estado de negocio al variant visual del StatusBadge. El label SIEMPRE
 * es texto humano (a11y: el color nunca es el único portador del significado).
 * StatusBadge expone variants: active|late|blocked|inactive|baja.
 * Mapeo: active→active (verde), reduced→late (ámbar, el único intermedio del badge),
 * blocked→blocked (rojo), baja→baja, inactive→inactive (gris).
 */
function statusVariant(status: string): 'active' | 'inactive' | 'blocked' | 'baja' | 'late' {
  switch (status) {
    case 'active':
      return 'active';
    case 'reduced':
      // "Reducido" reusa el variant 'late' por color (ámbar) — único intermedio del badge.
      return 'late';
    case 'blocked':
      return 'blocked';
    case 'baja':
      return 'baja';
    case 'inactive':
    default:
      return 'inactive';
  }
}

function statusLabel(status: string): string {
  return INTERNET_STATUS_LABELS[status as InternetServiceStatus] ?? status;
}

export default function InternetServicesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InternetServiceStatus | ''>('');
  const [page, setPage] = useState(1);
  // Modal de historial por fila.
  const [historyClient, setHistoryClient] = useState<{ clientId: string; customerName: string | null } | null>(
    null,
  );

  // Debounce del buscador (~300ms): no re-disparar el query en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filter = useMemo(
    () => ({ search, status, page, limit: PAGE_SIZE }),
    [search, status, page],
  );

  const { data, isLoading, isError } = useAllPppoe(filter);

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns = useMemo(
    () => [
      {
        key: 'customerName',
        label: 'Cliente',
        render: (r: Row) => {
          const name = r.customerName ?? '—';
          return r.clientId ? (
            <Link className={styles.nameLink} to={`/admin/customers/view/${r.clientId}`}>
              {name}
            </Link>
          ) : (
            <span className={styles.muted}>{name}</span>
          );
        },
      },
      {
        key: 'username',
        label: 'Usuario PPPoE',
        render: (r: Row) => <span className={styles.mono}>{r.username}</span>,
      },
      {
        key: 'profile',
        label: 'Plan',
        render: (r: Row) => r.profile ?? <span className={styles.muted}>—</span>,
      },
      {
        key: 'status',
        label: 'Estado',
        render: (r: Row) => <StatusBadge status={statusVariant(r.status)} label={statusLabel(r.status)} />,
      },
      {
        key: 'createdBy',
        label: 'Creado por',
        render: (r: Row) => r.createdBy ?? <span className={styles.muted}>—</span>,
      },
      {
        key: 'createdAt',
        label: 'Fecha',
        render: (r: Row) => formatDateTimeShort(r.createdAt),
      },
      {
        key: 'actions',
        label: '',
        render: (r: Row) => (
          <Button
            variant="ghost"
            size="sm"
            disabled={!r.clientId}
            onClick={() =>
              r.clientId && setHistoryClient({ clientId: r.clientId, customerName: r.customerName })
            }
            title={r.clientId ? 'Ver historial de Internet' : 'Sin cliente asociado'}
          >
            Ver historial
          </Button>
        ),
      },
    ],
    [],
  );

  const rows: Row[] = items.map((it) => ({ ...it, id: it.id }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.breadcrumb}>Clientes /</span>
        <h1 className={styles.title}>Servicios de Internet</h1>
      </div>

      <div className={styles.filters}>
        <input
          className={styles.input}
          placeholder="Buscar por cliente o usuario PPPoE…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Buscar por cliente o usuario PPPoE"
        />
        <select
          className={styles.select}
          value={status}
          aria-label="Estado"
          onChange={(e) => {
            setStatus(e.target.value as InternetServiceStatus | '');
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {INTERNET_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {isError ? (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          Error al cargar los servicios de Internet. Intentá de nuevo en unos minutos.
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            loading={isLoading}
            emptyMessage="Sin servicios de Internet para el filtro."
          />
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {historyClient && (
        <InternetActivationHistoryModal
          open
          clientId={historyClient.clientId}
          customerName={historyClient.customerName}
          onClose={() => setHistoryClient(null)}
        />
      )}
    </div>
  );
}
