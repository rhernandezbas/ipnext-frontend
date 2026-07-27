import { useEffect, useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Can } from '@/components/auth/Can';
import { formatMoney } from '@/utils/formatMoney';
import { useFinancePlanPrices, useUpdateFinancePlanPrice } from '@/hooks/useFinanceGrowth';
import type { FinancePlanPrice } from '@/types/financeGrowth';
import styles from './SettingsBody.module.css';

interface Row extends FinancePlanPrice {
  id: string;
}

const money = (v: number) => formatMoney(v, 'ARS');

interface EditPanelProps {
  row: FinancePlanPrice;
  onClose: () => void;
}

function EditPanel({ row, onClose }: EditPanelProps) {
  const [value, setValue] = useState(String(row.estimatedMonthlyPrice));
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateFinancePlanPrice();

  useEffect(() => {
    if (mutation.isSuccess) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cerrar sólo al terminar bien
  }, [mutation.isSuccess]);

  function handleSubmit() {
    const price = Number(value);
    if (Number.isNaN(price)) {
      setError('El precio debe ser numérico.');
      return;
    }
    if (price < 0) {
      setError('El precio no puede ser negativo.');
      return;
    }
    setError(null);
    mutation.mutate({ planCode: row.planCode, payload: { estimatedMonthlyPrice: price } });
  }

  return (
    <div className={styles.editPanel}>
      <h3 className={styles.editTitle}>Editar precio — {row.planName}</h3>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <div className={styles.formGrid}>
        <label className={styles.field}>
          Precio mensual estimado (ARS)
          <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
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

export function PlanPricesBody() {
  const { data, isLoading, isError, refetch } = useFinancePlanPrices();
  const [editing, setEditing] = useState<FinancePlanPrice | null>(null);

  if (isError) {
    return (
      <div className={styles.errorState} role="alert">
        <p>No se pudieron cargar los precios por plan.</p>
        <button type="button" className={styles.retryBtn} onClick={() => refetch()}>Reintentar</button>
      </div>
    );
  }

  const rows: Row[] = (data?.plans ?? []).map((p) => ({ ...p, id: p.planCode }));

  return (
    <div>
      <DataTable<Row>
        columns={[
          { label: 'Código', key: 'planCode', sortable: true },
          { label: 'Plan', key: 'planName' },
          {
            label: 'Precio mensual',
            key: 'estimatedMonthlyPrice',
            render: (r) =>
              r.updatedAt !== null ? money(r.estimatedMonthlyPrice) : <span className={styles.unconfigured}>sin configurar</span>,
          },
          {
            label: '',
            key: 'id',
            render: (r) => (
              <Can permission="finance.manage_costs">
                <button type="button" className={styles.linkBtn} onClick={() => setEditing(r)}>
                  Editar
                </button>
              </Can>
            ),
          },
        ]}
        data={rows}
        loading={isLoading}
        emptyMessage="No hay planes en el catálogo."
      />
      {editing && (
        <Can permission="finance.manage_costs">
          <EditPanel row={editing} onClose={() => setEditing(null)} />
        </Can>
      )}
    </div>
  );
}
