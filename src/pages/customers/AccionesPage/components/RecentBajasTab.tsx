import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { useRecentBajas } from '@/hooks/useActions';
import { formatDateShort } from '@/utils/formatDate';
import type { RecentBajaDto } from '@/types/actions';
import styles from './RecentBajasTab.module.css';

/**
 * Tab "Bajas recientes" — DataTable (patrón RecaptacionTableView) con el
 * retiro-check AUTO: existe ScheduledTask de un proyecto con
 * allowsEquipmentRetirement. La alarma operativa es "sin orden Y con
 * equipos activos" — exactamente lo que el operador tiene que ver.
 *
 * NOTA: el DTO NO trae fecha de baja (limitación aceptada del mirror) —
 * se muestra el inicio de contrato, no la baja.
 */

const PAGE_SIZE = 25;

/** DataTable exige `id` — usamos el contractId (único por baja). */
type BajaRow = RecentBajaDto & { id: string };

function RetirementBadge({ baja }: { baja: RecentBajaDto }) {
  if (baja.retirementOrder.exists) {
    return <StatusBadge status="active" label="Orden de retiro ✓" />;
  }
  if (baja.activeEquipmentCount > 0) {
    const n = baja.activeEquipmentCount;
    return <StatusBadge status="blocked" label={`Sin orden — ${n} ${n === 1 ? 'equipo' : 'equipos'}`} />;
  }
  return <StatusBadge status="inactive" label="Sin orden" />;
}

const COLUMNS = [
  {
    label: 'Cliente',
    key: 'clientName',
    render: (r: BajaRow) => (
      <Link className={styles.clientLink} to={`/admin/customers/${r.clientId}`}>
        {r.clientName ?? r.clientId}
      </Link>
    ),
  },
  {
    label: 'Dirección',
    key: 'address',
    render: (r: BajaRow) => r.address ?? '—',
  },
  {
    label: 'Inicio de contrato',
    key: 'startDate',
    render: (r: BajaRow) => formatDateShort(r.startDate),
  },
  {
    label: 'Motivo de baja',
    key: 'motivoBaja',
    render: (r: BajaRow) => r.motivoBaja ?? '—',
  },
  {
    label: 'Equipos activos',
    key: 'activeEquipmentCount',
    render: (r: BajaRow) => String(r.activeEquipmentCount),
  },
  {
    label: 'Orden de retiro',
    key: 'retirementOrder',
    render: (r: BajaRow) => <RetirementBadge baja={r} />,
  },
];

export function RecentBajasTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useRecentBajas({ page, pageSize: PAGE_SIZE });

  if (isError) {
    return (
      <p className={styles.error} role="alert">
        No se pudieron cargar las bajas. Reintentá.
      </p>
    );
  }

  const rows: BajaRow[] = (data?.items ?? []).map((b) => ({ ...b, id: b.contractId }));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  // M3 — clamp tras shrink: si el total se achicó y la página actual quedó
  // fuera, volver a la última página real en vez de mostrar una tabla vacía
  // mentirosa. Ajuste de estado durante el render (derived state).
  if (data && data.total > 0 && page > totalPages) {
    setPage(totalPages);
  }

  return (
    <div className={styles.tab}>
      <div className={styles.tableSection}>
        <DataTable<BajaRow>
          columns={COLUMNS}
          data={rows}
          loading={isLoading}
          emptyMessage="No hay bajas recientes."
        />
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
