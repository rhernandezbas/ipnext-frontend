import { useEffect, useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Can } from '@/components/auth/Can';
import { formatMoney } from '@/utils/formatMoney';
import { useFinanceTechnologyCosts, useUpdateFinanceTechnologyCost } from '@/hooks/useFinanceGrowth';
import type { FinanceTechnologyCost } from '@/types/financeGrowth';
import styles from './SettingsBody.module.css';

interface Row extends FinanceTechnologyCost {
  id: string;
}

const money = (v: number) => formatMoney(v, 'ARS');

function maybeMoney(v: number, configured: boolean) {
  if (!configured) return <span className={styles.unconfigured}>sin configurar</span>;
  return money(v);
}

interface FormState {
  costoVentaArs: string;
  costoInstalacionArs: string;
  costoMensualServicioArs: string;
  comisionVentaPct: string;
}

function toFormState(row: FinanceTechnologyCost): FormState {
  return {
    costoVentaArs: String(row.costoVentaArs),
    costoInstalacionArs: String(row.costoInstalacionArs),
    costoMensualServicioArs: String(row.costoMensualServicioArs),
    comisionVentaPct: String(row.comisionVentaPct),
  };
}

function validate(form: FormState): string | null {
  const venta = Number(form.costoVentaArs);
  const instalacion = Number(form.costoInstalacionArs);
  const mensual = Number(form.costoMensualServicioArs);
  const comision = Number(form.comisionVentaPct);
  if ([venta, instalacion, mensual, comision].some((n) => Number.isNaN(n))) {
    return 'Todos los campos deben ser numéricos.';
  }
  if (venta < 0 || instalacion < 0 || mensual < 0 || comision < 0) {
    return 'Ningún costo puede ser negativo.';
  }
  if (comision > 100) {
    return 'La comisión no puede superar 100%.';
  }
  return null;
}

interface EditPanelProps {
  row: FinanceTechnologyCost;
  onClose: () => void;
}

function EditPanel({ row, onClose }: EditPanelProps) {
  const [form, setForm] = useState<FormState>(toFormState(row));
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateFinanceTechnologyCost();

  useEffect(() => {
    if (mutation.isSuccess) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cerrar sólo cuando la mutación termina bien
  }, [mutation.isSuccess]);

  function handleSubmit() {
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    mutation.mutate({
      technologyName: row.technologyName,
      payload: {
        costoVentaArs: Number(form.costoVentaArs),
        costoInstalacionArs: Number(form.costoInstalacionArs),
        costoMensualServicioArs: Number(form.costoMensualServicioArs),
        comisionVentaPct: Number(form.comisionVentaPct),
      },
    });
  }

  return (
    <div className={styles.editPanel}>
      <h3 className={styles.editTitle}>Editar costos — {row.technologyName}</h3>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <div className={styles.formGrid}>
        <label className={styles.field}>
          Costo de venta (ARS)
          <input
            type="number"
            min={0}
            value={form.costoVentaArs}
            onChange={(e) => setForm((f) => ({ ...f, costoVentaArs: e.target.value }))}
          />
        </label>
        <label className={styles.field}>
          Costo de instalación (ARS)
          <input
            type="number"
            min={0}
            value={form.costoInstalacionArs}
            onChange={(e) => setForm((f) => ({ ...f, costoInstalacionArs: e.target.value }))}
          />
        </label>
        <label className={styles.field}>
          Costo mensual de servicio (ARS)
          <input
            type="number"
            min={0}
            value={form.costoMensualServicioArs}
            onChange={(e) => setForm((f) => ({ ...f, costoMensualServicioArs: e.target.value }))}
          />
        </label>
        <label className={styles.field}>
          Comisión de venta (%)
          <input
            type="number"
            min={0}
            max={100}
            value={form.comisionVentaPct}
            onChange={(e) => setForm((f) => ({ ...f, comisionVentaPct: e.target.value }))}
          />
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

export function TechnologyCostsBody() {
  const { data, isLoading, isError, refetch } = useFinanceTechnologyCosts();
  const [editing, setEditing] = useState<FinanceTechnologyCost | null>(null);

  if (isError) {
    return (
      <div className={styles.errorState} role="alert">
        <p>No se pudieron cargar los costos por tecnología.</p>
        <button type="button" className={styles.retryBtn} onClick={() => refetch()}>Reintentar</button>
      </div>
    );
  }

  const rows: Row[] = (data?.technologies ?? []).map((t) => ({ ...t, id: t.technologyName }));

  return (
    <div>
      <DataTable<Row>
        columns={[
          { label: 'Tecnología', key: 'technologyName' },
          { label: 'Costo de venta', key: 'costoVentaArs', render: (r) => maybeMoney(r.costoVentaArs, r.updatedAt !== null) },
          { label: 'Costo de instalación', key: 'costoInstalacionArs', render: (r) => maybeMoney(r.costoInstalacionArs, r.updatedAt !== null) },
          { label: 'Costo mensual', key: 'costoMensualServicioArs', render: (r) => maybeMoney(r.costoMensualServicioArs, r.updatedAt !== null) },
          { label: 'Comisión', key: 'comisionVentaPct', render: (r) => (r.updatedAt !== null ? `${r.comisionVentaPct}%` : <span className={styles.unconfigured}>sin configurar</span>) },
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
        emptyMessage="No hay tecnologías en el catálogo."
      />
      {editing && (
        <Can permission="finance.manage_costs">
          <EditPanel row={editing} onClose={() => setEditing(null)} />
        </Can>
      )}
    </div>
  );
}
