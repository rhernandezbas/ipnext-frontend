import { useEffect, useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Select } from '@/components/molecules/Select/Select';
import { Can } from '@/components/auth/Can';
import { useFinanceInvoiceTypes, usePatchFinanceInvoiceType } from '@/hooks/useFinanceGrowth';
import type { FinanceInvoiceType, InvoiceTypeBucket } from '@/types/financeGrowth';
import styles from './SettingsBody.module.css';

interface Row extends FinanceInvoiceType {
  id: string;
}

const BUCKET_OPTIONS = [
  { value: 'revenue', label: 'Revenue (suma a la cobranza)' },
  { value: 'contra', label: 'Contra (resta / nota de crédito)' },
  { value: 'excluded', label: 'Excluido (no cuenta)' },
];

function BucketBadge({ bucket }: { bucket: InvoiceTypeBucket }) {
  if (bucket === 'unclassified') {
    return <span className={styles.badgeUnclassified}>● Sin clasificar</span>;
  }
  return <span>{bucket}</span>;
}

interface EditPanelProps {
  row: FinanceInvoiceType;
  onClose: () => void;
}

function EditPanel({ row, onClose }: EditPanelProps) {
  const [bucket, setBucket] = useState<string>(row.bucket === 'unclassified' ? '' : row.bucket);
  const [error, setError] = useState<string | null>(null);
  const mutation = usePatchFinanceInvoiceType();

  useEffect(() => {
    if (mutation.isSuccess) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cerrar sólo al terminar bien
  }, [mutation.isSuccess]);

  function handleSubmit() {
    if (bucket !== 'revenue' && bucket !== 'contra' && bucket !== 'excluded') {
      setError('Elegí un bucket válido (nunca "sin clasificar" — ese es sólo el default de sistema).');
      return;
    }
    setError(null);
    mutation.mutate({ grType: row.grType, payload: { bucket } });
  }

  return (
    <div className={styles.editPanel}>
      <h3 className={styles.editTitle}>Reclasificar — {row.grType}</h3>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <div className={styles.formGrid}>
        <Select
          label="Nuevo bucket"
          value={bucket}
          onChange={setBucket}
          options={BUCKET_OPTIONS}
          placeholder="Elegí un bucket…"
        />
      </div>
      <div className={styles.formActions}>
        <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </button>
        <button type="button" className={styles.btnPrimary} onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {mutation.isError && <p role="alert" className={styles.formError}>No se pudo guardar. Reintentá.</p>}
    </div>
  );
}

export function InvoiceTypesBody() {
  const { data, isLoading, isError, refetch } = useFinanceInvoiceTypes();
  const [editing, setEditing] = useState<FinanceInvoiceType | null>(null);

  if (isError) {
    return (
      <div className={styles.errorState} role="alert">
        <p>No se pudo cargar el catálogo de tipos de comprobante.</p>
        <button type="button" className={styles.retryBtn} onClick={() => refetch()}>Reintentar</button>
      </div>
    );
  }

  const rows: Row[] = (data?.types ?? []).map((t) => ({ ...t, id: t.grType }));

  return (
    <div>
      <DataTable<Row>
        columns={[
          { label: 'Tipo GR', key: 'grType', sortable: true },
          { label: 'Bucket', key: 'bucket', render: (r) => <BucketBadge bucket={r.bucket} /> },
          { label: 'Etiqueta', key: 'label', render: (r) => r.label ?? '—' },
          {
            label: '',
            key: 'actions',
            render: (r) => (
              <Can permission="finance.manage_costs">
                <button type="button" className={styles.linkBtn} onClick={() => setEditing(r)}>
                  Reclasificar
                </button>
              </Can>
            ),
          },
        ]}
        data={rows}
        loading={isLoading}
        emptyMessage="Todavía no se sincronizó ningún tipo de comprobante."
      />
      {editing && (
        <Can permission="finance.manage_costs">
          <EditPanel row={editing} onClose={() => setEditing(null)} />
        </Can>
      )}
    </div>
  );
}
