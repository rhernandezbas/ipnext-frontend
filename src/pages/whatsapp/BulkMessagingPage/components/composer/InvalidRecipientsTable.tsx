import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { Skeleton } from '@/pages/whatsapp/WhatsappInboxPage/components/Skeleton';
import { RECIPIENT_REASON_LABELS } from './recipientReasonLabels';
import type { ExcludedRecipientDto } from '@/types/messagingBulk';
import styles from './InvalidRecipientsTable.module.css';

interface InvalidRecipientsTableProps {
  data: ExcludedRecipientDto[];
  isLoading: boolean;
  isError: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** `ExcludedRecipientDto` no trae `id` — `DataTable<T>` lo exige para keys. */
type ExcludedRow = ExcludedRecipientDto & { id: string };

/**
 * Id ESTABLE por fila (M2, review adversarial) — `clientId ?? phone` NO
 * alcanza: dos excluidos crudos (`clientId:null`, típico de CSV) pueden
 * compartir el MISMO teléfono (familia que comparte número, o el número
 * repetido dos veces en el CSV) → id idéntico → key duplicada de React.
 * El `#${index}` sólo necesita ser único DENTRO de la página renderizada
 * (esta tabla es read-only y paginada, nunca reordena localmente), no
 * global — no rompe nada usarlo como desempate.
 *
 * NOTA CSV-injection (aceptado, sin superficie en este flujo) — `name`
 * llega TAL CUAL del CSV/BE y se renderiza como texto plano en la tabla, no
 * se re-exporta a ningún lado hoy. Si en el futuro estos nombres se
 * re-exportan a CSV/Excel, sanitizar (prefijo `'` a valores que arrancan
 * con `=`, `+`, `-`, `@`).
 */
export function excludedRowId(r: ExcludedRecipientDto, index: number): string {
  return r.clientId ?? `${r.phone}#${index}`;
}

const SOURCE_LABELS: Record<string, string> = {
  segment: 'Segmento',
  manual: 'Manual',
  csv: 'CSV',
};

/**
 * InvalidRecipientsTable (bulk-csv-recipients FE, CSV-FE-7/CSV-FE-8) — vista
 * "Excluidos (N)" del `PreviewModal`: PAGINADA (`view=excluded`), nombre +
 * teléfono + motivo en es-AR + fuente. El flag `status:'baja'` (cliente
 * vinculado que además está de baja — no-excluyente, D7) se señala con
 * `StatusBadge` + TEXTO, nunca solo color.
 *
 * Componente MODULAR y aislado a propósito (D12/coordinación con el
 * Rediseño Change C, que corre DESPUÉS sobre estas piezas).
 */
export function InvalidRecipientsTable({ data, isLoading, isError, page, totalPages, onPageChange }: InvalidRecipientsTableProps) {
  if (isLoading) {
    return (
      <div className={styles.loading} aria-busy="true">
        <p role="status" className={styles.srOnlyStatus}>Cargando excluidos…</p>
        <Skeleton height={20} />
        <Skeleton height={20} width="70%" />
        <Skeleton height={20} width="50%" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className={styles.error} role="alert">
        No se pudieron cargar los excluidos. Reintentá.
      </p>
    );
  }

  if (data.length === 0) {
    return (
      <p className={styles.emptyResult} role="status">
        Sin excluidos.
      </p>
    );
  }

  const rows: ExcludedRow[] = data.map((r, index) => ({ ...r, id: excludedRowId(r, index) }));

  const columns = [
    { label: 'Nombre', key: 'name' },
    { label: 'Teléfono', key: 'phone' },
    {
      label: 'Motivo',
      key: 'reason',
      render: (row: ExcludedRow) => (
        <span className={styles.reasonCell}>
          {RECIPIENT_REASON_LABELS[row.reason]}
          {row.status === 'baja' && <StatusBadge status="baja" label="Cliente de baja" />}
        </span>
      ),
    },
    {
      label: 'Fuente',
      key: 'source',
      render: (row: ExcludedRow) => (row.source ? (SOURCE_LABELS[row.source] ?? row.source) : '—'),
    },
  ];

  return (
    <>
      <DataTable<ExcludedRow>
        columns={columns}
        data={rows}
        loading={false}
        emptyMessage="Sin excluidos."
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
}
