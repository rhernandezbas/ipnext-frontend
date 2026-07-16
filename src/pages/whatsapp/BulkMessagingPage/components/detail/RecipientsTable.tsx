import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { useCampaign } from '@/hooks/useBulkMessaging';
import { formatDateTimeShort } from '@/utils/formatDate';
import type { CampaignRecipientDto, CampaignRecipientStatusDto } from '@/types/messagingBulk';
import styles from './RecipientsTable.module.css';

const LIMIT = 20;

const STATUS_LABELS: Record<CampaignRecipientStatusDto, string> = {
  queued: 'En cola',
  sent: 'Enviado',
  delivered: 'Entregado',
  'opted-out': 'Opt-out',
  skipped: 'Omitido',
  failed: 'Fallido',
};

const STATUS_OPTIONS: { value: CampaignRecipientStatusDto | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'queued', label: STATUS_LABELS.queued },
  { value: 'sent', label: STATUS_LABELS.sent },
  { value: 'delivered', label: STATUS_LABELS.delivered },
  { value: 'opted-out', label: STATUS_LABELS['opted-out'] },
  { value: 'skipped', label: STATUS_LABELS.skipped },
  { value: 'failed', label: STATUS_LABELS.failed },
];

interface RecipientsTableProps {
  campaignId: string;
  /** Fix Wave (MEDIUM-2) — propagado a `useCampaign`; gatea el poll cuando el tab "Historial" no está activo. Default `true`. */
  active?: boolean;
}

/**
 * RecipientsTable (F2 apply chunk 3, HIST-3) — paginado server-side de
 * destinatarios, `useCampaign(id, {includeRecipients,page,limit,status})`
 * (chunk 1; el polling ~5s mientras running ya vive ahí, MBH-5).
 *
 * MEDIUM-3 (Fix Wave, review adversarial) — esta es la variante PESADA de
 * `useCampaign` (`includeRecipients:true`). `campaignPollInterval` la trata
 * distinto: pollea SOLO en `running` (5s); en `pending`/`paused` NO pollea —
 * los recipients de una campaña que todavía no arrancó o está pausada son
 * INMUTABLES, así que no hay nada nuevo que traer. La key LIVIANA del header
 * (`CampaignHeader`, sin `includeRecipients`) es la que detecta la
 * transición a `running` con SU propio poll de 30s; recién ahí esta tabla
 * arranca su poll de 5s.
 *
 * OJO (hallazgo verificado contra el BE real — `domain/entities/campaign.ts`
 * `CampaignRecipientStatus` + `application/dto/messaging-bulk.dto.ts`
 * `toRecipientStatusDto`): el filtro de acá usa los valores del DTO de wire
 * (lo que se VE en la tabla, `'opted-out'` con guion). La traducción al
 * valor de dominio que el BE espera en el query param (`'opted_out'`, único
 * valor que difiere) vive en `messagingBulk.api.ts`
 * (`toDomainRecipientStatus`) — NO acá, para no duplicar el conocimiento
 * del contrato en dos capas.
 */
export function RecipientsTable({ campaignId, active = true }: RecipientsTableProps) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CampaignRecipientStatusDto | ''>('');

  const { data, isLoading, isError } = useCampaign(
    campaignId,
    {
      includeRecipients: true,
      page,
      limit: LIMIT,
      status: statusFilter || undefined,
    },
    active,
  );

  function handleStatusChange(value: string) {
    setStatusFilter(value as CampaignRecipientStatusDto | '');
    setPage(1);
  }

  const columns = [
    { label: 'Teléfono', key: 'phoneE164' },
    {
      label: 'Estado',
      key: 'status',
      render: (row: CampaignRecipientDto) => STATUS_LABELS[row.status] ?? row.status,
    },
    {
      label: 'Error',
      key: 'error',
      render: (row: CampaignRecipientDto) => row.error ?? '—',
    },
    {
      label: 'Enviado',
      key: 'sentAt',
      // `formatDateTimeShort` ya devuelve '—' para null/undefined (utils/formatDate.ts).
      render: (row: CampaignRecipientDto) => formatDateTimeShort(row.sentAt),
    },
  ];

  const recipients = data?.recipients;
  const totalPages = recipients ? Math.max(1, Math.ceil(recipients.total / (recipients.limit || LIMIT))) : 1;

  return (
    <div className={styles.wrapper}>
      <div className={styles.filterRow}>
        <label htmlFor="recipients-status-filter" className={styles.filterLabel}>
          Filtrar por estado
        </label>
        <select
          id="recipients-status-filter"
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {isError ? (
        <p className={styles.error} role="alert">
          No se pudieron cargar los destinatarios. Intentá nuevamente.
        </p>
      ) : (
        <>
          <DataTable<CampaignRecipientDto>
            columns={columns}
            data={recipients?.data ?? []}
            loading={isLoading}
            emptyMessage="No hay destinatarios para este filtro."
          />
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
