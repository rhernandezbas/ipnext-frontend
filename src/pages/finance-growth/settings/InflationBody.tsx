import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Can } from '@/components/auth/Can';
import { useFinanceInflation, useUpdateFinanceInflation } from '@/hooks/useFinanceGrowth';
import { getDefaultYearMonthRange, formatYearMonthLabel } from '@/utils/financeGrowthDates';
import type { FinanceInflationEntry } from '@/types/financeGrowth';
import styles from './SettingsBody.module.css';

interface Row {
  id: string;
  yearMonth: string;
  entry: FinanceInflationEntry | null;
}

function monthsInRange(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const months: string[] = [];
  let y = fy;
  let m = fm;
  while (y * 12 + m <= ty * 12 + tm) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return months;
}

interface EditPanelProps {
  yearMonth: string;
  initial: FinanceInflationEntry | null;
  onClose: () => void;
}

function EditPanel({ yearMonth, initial, onClose }: EditPanelProps) {
  const [rate, setRate] = useState(initial ? String(initial.monthlyRatePct) : '');
  const [source, setSource] = useState(initial?.source ?? '');
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateFinanceInflation();

  useEffect(() => {
    if (mutation.isSuccess) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cerrar sólo al terminar bien
  }, [mutation.isSuccess]);

  function handleSubmit() {
    const rateNum = Number(rate);
    if (Number.isNaN(rateNum)) {
      setError('La variación mensual debe ser numérica.');
      return;
    }
    if (rateNum <= -100) {
      setError('La variación mensual no puede ser <= -100% (rompería el encadenamiento).');
      return;
    }
    setError(null);
    mutation.mutate({ yearMonth, payload: { monthlyRatePct: rateNum, source } });
  }

  return (
    <div className={styles.editPanel}>
      <h3 className={styles.editTitle}>Cargar IPC — {formatYearMonthLabel(yearMonth)}</h3>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <div className={styles.formGrid}>
        <label className={styles.field}>
          Variación mensual (%)
          <input type="number" step="0.001" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label className={styles.field}>
          Fuente (opcional)
          <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="INDEC" />
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

export function InflationBody() {
  const range = useMemo(() => getDefaultYearMonthRange(12), []);
  const { data, isLoading, isError, refetch } = useFinanceInflation(range);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);

  if (isError) {
    return (
      <div className={styles.errorState} role="alert">
        <p>No se pudo cargar el índice de inflación.</p>
        <button type="button" className={styles.retryBtn} onClick={() => refetch()}>Reintentar</button>
      </div>
    );
  }

  const byMonth = new Map((data?.index ?? []).map((e) => [e.yearMonth, e]));
  const rows: Row[] = monthsInRange(range.from, range.to).map((yearMonth) => ({
    id: yearMonth,
    yearMonth,
    entry: byMonth.get(yearMonth) ?? null,
  }));

  return (
    <div>
      <p className={styles.unconfigured}>
        Un mes sin fila acá trunca la serie "real" del resumen para ese mes (nunca se asume 0%).
      </p>
      <DataTable<Row>
        columns={[
          { label: 'Mes', key: 'yearMonth', render: (r) => formatYearMonthLabel(r.yearMonth) },
          {
            label: 'Variación mensual',
            key: 'monthlyRatePct',
            render: (r) => (r.entry ? `${r.entry.monthlyRatePct}%` : <span className={styles.unconfigured}>sin cargar</span>),
          },
          { label: 'Fuente', key: 'source', render: (r) => r.entry?.source ?? '—' },
          {
            label: '',
            key: 'actions',
            render: (r) => (
              <Can permission="finance.manage_inflation">
                <button type="button" className={styles.linkBtn} onClick={() => setEditingMonth(r.yearMonth)}>
                  {r.entry ? 'Editar' : 'Cargar'}
                </button>
              </Can>
            ),
          },
        ]}
        data={rows}
        loading={isLoading}
        emptyMessage="Sin meses en el rango."
      />
      {editingMonth && (
        <Can permission="finance.manage_inflation">
          <EditPanel
            yearMonth={editingMonth}
            initial={byMonth.get(editingMonth) ?? null}
            onClose={() => setEditingMonth(null)}
          />
        </Can>
      )}
    </div>
  );
}
