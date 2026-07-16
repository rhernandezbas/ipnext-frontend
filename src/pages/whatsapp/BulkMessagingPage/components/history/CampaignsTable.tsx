import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { useCampaigns } from '@/hooks/useBulkMessaging';
import { formatDateTimeShort } from '@/utils/formatDate';
import { CampaignStatusPill } from './CampaignStatusPill';
import type { CampaignSummaryDto } from '@/types/messagingBulk';
import styles from './CampaignsTable.module.css';

const LIMIT = 20;

interface CampaignsTableProps {
  onViewDetail: (campaignId: string) => void;
  /**
   * Fix Wave (HIGH-1/MEDIUM-2, review adversarial) — true si el tab
   * "Historial" está ACTIVO en `BulkMessagingPage`. Gatea el poll de 30s:
   * con `Tabs mountMode="all"` esta tabla queda montada detrás de "Nueva
   * campaña" y no tiene sentido pollearla oculta. Default `true` (standalone/
   * tests que no lo pasan se comportan como siempre se comportaron).
   */
  active?: boolean;
}

/**
 * CampaignsTable (F2 apply chunk 3, HIST-1) — tab "Historial" de
 * `BulkMessagingPage`. Paginado SERVER-SIDE real (`useCampaigns`, chunk 1),
 * molde `ContractsListPage` (early-return en error, `DataTable` cubre
 * loading/empty, `Pagination` server-side).
 *
 * "Ver detalle" tiene DOS entradas: el nombre (celda clickeable, molde
 * `ContractsListPage.clientName`) y la acción del kebab de `DataTable`. NO
 * se agregó un `onRowClick` a `DataTable` — es un organism compartido por
 * ~40 páginas y ampliar su superficie para este chunk no vale el
 * blast-radius; el nombre clickeable cubre el mismo caso de uso.
 *
 * HIGH-1 (Fix Wave) — `CampaignsTable` es el ÚNICO caller que activa el poll
 * de 30s de `useCampaigns` (`poll:true`), combinado con `active` (MEDIUM-2):
 * `useCampaigns({...}, true, active)`. Cualquier otro caller (ej.
 * `WhatsappInboxPage` para el dropdown de filtro) sigue sin pollear.
 */
export function CampaignsTable({ onViewDetail, active = true }: CampaignsTableProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useCampaigns({ page, limit: LIMIT }, true, active);

  if (isError) {
    return (
      <p className={styles.error} role="alert">
        No se pudo cargar el historial de campañas. Intentá nuevamente.
      </p>
    );
  }

  const columns = [
    {
      label: 'Nombre',
      key: 'name',
      render: (row: CampaignSummaryDto) => (
        <button type="button" className={styles.nameLink} onClick={() => onViewDetail(row.id)}>
          {row.name}
        </button>
      ),
    },
    {
      label: 'Template',
      key: 'templateName',
      render: (row: CampaignSummaryDto) => row.templateName ?? '—',
    },
    {
      label: 'Estado',
      key: 'status',
      render: (row: CampaignSummaryDto) => <CampaignStatusPill status={row.status} />,
    },
    { label: 'Total', key: 'total' },
    {
      label: 'Enviados / Fallidos / Omitidos',
      key: 'sentCount',
      render: (row: CampaignSummaryDto) => `${row.sentCount} / ${row.failedCount} / ${row.skippedCount}`,
    },
    {
      label: 'Creada',
      key: 'createdAt',
      render: (row: CampaignSummaryDto) => formatDateTimeShort(row.createdAt),
    },
  ];

  const actions = [{ label: 'Ver detalle', onClick: (row: CampaignSummaryDto) => onViewDetail(row.id) }];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.limit || LIMIT))) : 1;

  return (
    <div className={styles.wrapper}>
      <DataTable<CampaignSummaryDto>
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        actions={actions}
        emptyMessage="Todavía no se creó ninguna campaña."
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
