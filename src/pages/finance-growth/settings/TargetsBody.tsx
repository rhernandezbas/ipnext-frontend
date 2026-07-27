import { useEffect, useState } from 'react';
import { Can } from '@/components/auth/Can';
import { useFinanceTargets, useUpdateFinanceTargets } from '@/hooks/useFinanceGrowth';
import type { FinanceTargetsConfig } from '@/types/financeGrowth';
import styles from './SettingsBody.module.css';

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
// `monthlyNewContractsGoal` es un Int32 en el BE (`FinanceTargetsConfig`,
// columna Prisma `Int`) — validar esta cota EN EL CLIENTE (bloqueante 🔴5)
// para que un valor fuera de rango se explique acá, en vez de desaparecer
// silenciosamente en un 400 que hoy ni siquiera se muestra (ver el bloque
// mutation.isError agregado más abajo).
const INT32_MAX = 2_147_483_647;

interface FormState {
  churnTargetPct: string;
  maxPaybackMonths: string;
  monthlyNewContractsGoal: string;
  inflationBaseYearMonth: string;
}

function toFormState(config: FinanceTargetsConfig): FormState {
  return {
    churnTargetPct: String(config.churnTargetPct),
    maxPaybackMonths: String(config.maxPaybackMonths),
    monthlyNewContractsGoal: String(config.monthlyNewContractsGoal),
    inflationBaseYearMonth: config.inflationBaseYearMonth,
  };
}

function validate(form: FormState): string | null {
  const churn = Number(form.churnTargetPct);
  const payback = Number(form.maxPaybackMonths);
  const goal = Number(form.monthlyNewContractsGoal);
  if ([churn, payback, goal].some((n) => Number.isNaN(n))) return 'Todos los campos numéricos son obligatorios.';
  if (churn < 0 || churn > 100) return 'La meta de churn debe estar entre 0 y 100.';
  if (!Number.isInteger(payback) || payback < 1) return 'El payback máximo debe ser un entero >= 1 mes.';
  if (!Number.isInteger(goal) || goal < 0) return 'La meta de altas mensuales debe ser un entero >= 0.';
  if (goal > INT32_MAX) return `La meta de altas mensuales no puede superar ${INT32_MAX.toLocaleString('es-AR')}.`;
  if (form.inflationBaseYearMonth !== '' && !YEAR_MONTH_RE.test(form.inflationBaseYearMonth)) {
    return 'El mes base de inflación debe estar vacío o tener formato AAAA-MM.';
  }
  return null;
}

export function TargetsBody() {
  const { data, isLoading, isError, refetch } = useFinanceTargets();
  const mutation = useUpdateFinanceTargets();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(toFormState(data));
  }, [data]);

  useEffect(() => {
    if (mutation.isSuccess) setSaved(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo reaccionar al éxito de ESTA mutación
  }, [mutation.isSuccess]);

  if (isLoading) {
    return <div className={styles.editPanel} role="status" aria-label="Cargando metas">Cargando…</div>;
  }

  if (isError) {
    return (
      <div className={styles.errorState} role="alert">
        <p>No se pudieron cargar las metas.</p>
        <button type="button" className={styles.retryBtn} onClick={() => refetch()}>Reintentar</button>
      </div>
    );
  }

  if (!form) return null;

  function handleSubmit() {
    const validationError = validate(form!);
    if (validationError) {
      setError(validationError);
      setSaved(false);
      return;
    }
    setError(null);
    mutation.mutate({
      churnTargetPct: Number(form!.churnTargetPct),
      maxPaybackMonths: Number(form!.maxPaybackMonths),
      monthlyNewContractsGoal: Number(form!.monthlyNewContractsGoal),
      inflationBaseYearMonth: form!.inflationBaseYearMonth,
    });
  }

  return (
    <div className={styles.editPanel}>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      {saved && !error && <p className={styles.feedbackSuccess} role="status">Metas actualizadas.</p>}
      {/* Bloqueante 🔴5 — era el ÚNICO de los 5 bodies de settings SIN este
          bloque: con mutation.isError el botón se re-habilitaba y el DOM no
          agregaba ni un carácter, así que el usuario creía que había
          guardado. Mismo criterio que InflationBody.tsx. */}
      {mutation.isError && !error && (
        <p className={styles.formError} role="alert">No se pudo guardar. Reintentá.</p>
      )}
      <div className={styles.formGrid}>
        <label className={styles.field}>
          Meta de churn (%)
          <input
            type="number"
            min={0}
            max={100}
            value={form.churnTargetPct}
            onChange={(e) => { setSaved(false); setForm({ ...form, churnTargetPct: e.target.value }); }}
          />
        </label>
        <label className={styles.field}>
          Payback máximo (meses)
          <input
            type="number"
            min={1}
            step={1}
            value={form.maxPaybackMonths}
            onChange={(e) => { setSaved(false); setForm({ ...form, maxPaybackMonths: e.target.value }); }}
          />
        </label>
        <label className={styles.field}>
          Meta de altas mensuales
          <input
            type="number"
            min={0}
            step={1}
            value={form.monthlyNewContractsGoal}
            onChange={(e) => { setSaved(false); setForm({ ...form, monthlyNewContractsGoal: e.target.value }); }}
          />
        </label>
        <label className={styles.field}>
          Mes base de inflación (AAAA-MM, vacío = sin configurar)
          <input
            type="text"
            placeholder="2026-01"
            value={form.inflationBaseYearMonth}
            onChange={(e) => { setSaved(false); setForm({ ...form, inflationBaseYearMonth: e.target.value }); }}
          />
        </label>
      </div>
      <Can permission="finance.manage_targets">
        <div className={styles.formActions}>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Can>
    </div>
  );
}
