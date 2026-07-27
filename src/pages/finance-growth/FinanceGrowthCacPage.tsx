import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceCac, useFinanceTechnologyCosts } from '@/hooks/useFinanceGrowth';
import { Can } from '@/components/auth/Can';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Select } from '@/components/molecules/Select/Select';
import { MaybeValue } from '@/components/atoms/MaybeValue/MaybeValue';
import { formatMoney } from '@/utils/formatMoney';
import { getDefaultYearMonthRange, formatYearMonthLabel } from '@/utils/financeGrowthDates';
import type { AttributionConfidence, FinanceCacAlta } from '@/types/financeGrowth';
import styles from './FinanceGrowthListPage.module.css';

/**
 * finance-growth-dashboard (Fase 5, item 5.5) — CAC/payback por tecnología y
 * mes. `costConfigured`/`costIsZero` (fix-wave-4 🟡7) son la señal central:
 * una tecnología sin costos cargados NO es "CAC $0" (todo rentable) — es
 * "no sé" (`MaybeValue`, jamás `?? 0`). `lossMaking` se resalta por fila con
 * un badge, no solo color (regla de a11y del brief).
 *
 * DESVIACIÓN DOCUMENTADA (gap #2 del brief): el mes se elige con un
 * `<input type="text">` validado por regex `YYYY-MM`, NO un `<input
 * type="month">` nativo (prohibido) ni un `Combobox` de calendario dedicado
 * (no existe ese átomo en el design system — mismo criterio que
 * `InflationBody.tsx`, ya aceptado en la tanda anterior). Ver el reporte de
 * la fase para la justificación completa.
 */

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const money = (v: number) => formatMoney(v, 'ARS');

interface Row extends FinanceCacAlta {
  id: string;
}

function confidenceLabel(c: AttributionConfidence): string {
  if (c === 'exact') return 'exacta';
  if (c === 'estimated') return 'estimada';
  return 'estimada (partes iguales)';
}

/**
 * Bloqueante 🔴2 — `cacArs === null` (tecnología sin costos cargados) hace
 * que el BE emita `lossMaking: false` POR CONSTRUCCIÓN para todas las filas
 * (mismo bug de fondo que `costIsZero` ya cerró del lado del BE, en versión
 * badge). Sin este 3er estado, `LossMakingBadge` pintaba "Dentro del
 * umbral" — un veredicto TRANQUILIZADOR y FALSO: no es que la fila esté
 * bien, es que no se pudo evaluar nada.
 */
function LossMakingBadge({ lossMaking, cacArs }: { lossMaking: boolean; cacArs: number | null }) {
  if (cacArs === null) {
    return (
      <span
        className={[styles.badge, styles.badgeWarning].join(' ')}
        title="No se puede evaluar sin costos cargados para esta tecnología — no es 'dentro del umbral', es 'no evaluable'"
      >
        No evaluable
      </span>
    );
  }
  if (lossMaking) {
    return <span className={[styles.badge, styles.badgeDanger].join(' ')}>Pierde plata</span>;
  }
  return <span className={[styles.badge, styles.badgeNeutral].join(' ')}>Dentro del umbral</span>;
}

export default function FinanceGrowthCacPage() {
  const defaultMonth = useMemo(() => getDefaultYearMonthRange(1).to, []);
  const techCosts = useFinanceTechnologyCosts();
  const [technology, setTechnology] = useState('');
  const [yearMonthInput, setYearMonthInput] = useState(defaultMonth);
  const [committedYearMonth, setCommittedYearMonth] = useState(defaultMonth);

  useEffect(() => {
    if (!technology && techCosts.data?.technologies.length) {
      setTechnology(techCosts.data.technologies[0].technologyName);
    }
  }, [technology, techCosts.data]);

  const yearMonthValid = YEAR_MONTH_RE.test(yearMonthInput);

  function handleYearMonthChange(value: string) {
    setYearMonthInput(value);
    if (YEAR_MONTH_RE.test(value)) {
      setCommittedYearMonth(value);
    }
  }

  const cac = useFinanceCac({ technology, yearMonth: committedYearMonth });

  const techOptions = (techCosts.data?.technologies ?? []).map((t) => ({
    value: t.technologyName,
    label: t.technologyName,
  }));

  const rows: Row[] = (cac.data?.altasDelMes ?? []).map((a) => ({ ...a, id: a.contractId }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className={styles.breadcrumb}>Crecimiento Financiero /</span>
          <h1 className={styles.title}>CAC y payback</h1>
        </div>
      </div>
      <p className={styles.subtitle}>
        Costo de adquisición y meses de repago de las altas del mes, por tecnología.
      </p>

      <div className={styles.controlsRow}>
        <Select
          label="Tecnología"
          options={techOptions}
          value={technology}
          onChange={setTechnology}
          placeholder={techCosts.isLoading ? 'Cargando…' : 'Elegí una tecnología'}
          disabled={techCosts.isLoading || techOptions.length === 0}
        />
        <label className={styles.controlField}>
          Mes (AAAA-MM)
          <input
            type="text"
            inputMode="numeric"
            placeholder="2026-07"
            value={yearMonthInput}
            aria-invalid={!yearMonthValid}
            aria-describedby={!yearMonthValid ? 'cac-yearmonth-error' : undefined}
            onChange={(e) => handleYearMonthChange(e.target.value)}
          />
        </label>
        {!yearMonthValid && (
          <span id="cac-yearmonth-error" role="alert" className={styles.fieldError}>
            Formato inválido — usá AAAA-MM (ej. 2026-07).
          </span>
        )}
      </div>

      {/* Bloqueante 🔴4 — sin esta rama, un error del catálogo de
          tecnologías dejaba la pantalla EN BLANCO: con technology==='' el
          query de CAC queda `enabled:false` (`isLoading` nunca pasa a
          `true`), y el banner de abajo exige `techCosts.data` (que con un
          error nunca llega) — ni skeleton, ni error, ni empty, sólo el
          header y el Select vacío. */}
      {techCosts.isError && (
        <div className={styles.errorState} role="alert">
          <p>No se pudo cargar el catálogo de tecnologías.</p>
          <button type="button" className={styles.retryBtn} onClick={() => techCosts.refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {techCosts.data && techOptions.length === 0 && (
        <div className={styles.warningBanner} role="status">
          No hay tecnologías en el catálogo todavía — no se puede calcular CAC sin al menos una.
        </div>
      )}

      {cac.isLoading && technology && yearMonthValid && (
        <div className={styles.skeletonGrid} role="status" aria-label="Cargando CAC">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.skeletonBar} aria-hidden="true" />
          ))}
        </div>
      )}

      {cac.isError && (
        <div className={styles.errorState} role="alert">
          <p>No se pudo cargar el CAC de esta tecnología/mes.</p>
          <button type="button" className={styles.retryBtn} onClick={() => cac.refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {cac.data && (
        <>
          {!cac.data.costConfigured && (
            <div className={styles.warningBanner} role="status">
              <strong>Costos sin configurar</strong> para {cac.data.technology}: el CAC se muestra como “sin dato”,
              NUNCA como $0 — eso implicaría que la tecnología es gratis.{' '}
              <Can permission="finance.manage_costs">
                <Link to="/admin/finance-growth/settings#technology-costs">Cargar costos</Link>
              </Can>
            </div>
          )}

          {cac.data.costConfigured && cac.data.costIsZero && (
            <div className={styles.infoBanner} role="status">
              El costo cargado para {cac.data.technology} es $0 — es una configuración EXPLÍCITA, no una ausencia de
              dato. Si no fue intencional, corregilo en Configuración.
            </div>
          )}

          {cac.data.altasDelMesSinTecnologia > 0 && (
            <div className={styles.warningBanner} role="status">
              Hay {cac.data.altasDelMesSinTecnologia} alta(s) del mes sin tecnología clasificada — no están incluidas
              en esta tabla porque no se pueden atribuir a ninguna fila.
            </div>
          )}

          <div className={styles.kpiRow}>
            <div className={styles.kpiTile}>
              <span className={styles.kpiLabel}>Costo de venta</span>
              <span className={styles.kpiValue}>
                <MaybeValue
                  value={cac.data.costoVentaArs}
                  format={money}
                  label="Costo de venta"
                  unknownReason="tecnología sin costos cargados"
                />
              </span>
            </div>
            <div className={styles.kpiTile}>
              <span className={styles.kpiLabel}>Costo de instalación</span>
              <span className={styles.kpiValue}>
                <MaybeValue
                  value={cac.data.costoInstalacionArs}
                  format={money}
                  label="Costo de instalación"
                  unknownReason="tecnología sin costos cargados"
                />
              </span>
            </div>
            <div className={styles.kpiTile}>
              <span className={styles.kpiLabel}>CAC total</span>
              <span className={styles.kpiValue}>
                <MaybeValue
                  value={cac.data.cacArs}
                  format={money}
                  label="CAC total"
                  unknownReason="tecnología sin costos cargados"
                />
              </span>
            </div>
            <div className={styles.kpiTile}>
              <span className={styles.kpiLabel}>Umbral de payback</span>
              <span className={styles.kpiValue}>{cac.data.maxPaybackMonths} meses</span>
            </div>
          </div>

          <DataTable<Row>
            columns={[
              { label: 'Cliente', key: 'customerName', render: (r) => r.customerName ?? r.clientId },
              { label: 'MRR atribuido', key: 'mrrAtribuidoArs', render: (r) => money(r.mrrAtribuidoArs) },
              { label: 'Confianza', key: 'attributionConfidence', render: (r) => confidenceLabel(r.attributionConfidence) },
              {
                label: 'Payback',
                key: 'paybackMonths',
                render: (r) => (
                  <MaybeValue
                    value={r.paybackMonths}
                    format={(v) => `${v.toFixed(1)} meses`}
                    label="Payback"
                    unknownReason="sin cobranza atribuida este mes o sin costo cargado"
                  />
                ),
              },
              {
                label: 'Estado',
                key: 'lossMaking',
                render: (r) => <LossMakingBadge lossMaking={r.lossMaking} cacArs={cac.data!.cacArs} />,
              },
            ]}
            data={rows}
            loading={false}
            emptyMessage={`No hay altas de ${cac.data.technology} en ${formatYearMonthLabel(committedYearMonth)}.`}
          />
        </>
      )}
    </div>
  );
}
