import { useState, type FormEvent } from 'react';
import { Button } from '@/components/atoms/Button/Button';
import { Input } from '@/components/atoms/Input/Input';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Select } from '@/components/molecules/Select/Select';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { VerdictCard } from '@/components/technicians/VerdictCard';
import {
  useServiceOrderPresenceAudit,
  useSuspiciousClosures,
} from '@/hooks/useTechnicianLocation';
import { useArToday } from '@/hooks/useArToday';
import type { SuspiciousClosure } from '@/types/technicianLocation';
import { formatDurationMinutes, formatMinutes } from '@/utils/formatGeo';
import styles from './TechniciansAuditPage.module.css';

/**
 * Auditoría de presencia (permiso `technicians.location_audit`).
 *
 * ── Lo que esta pantalla NO hace ──────────────────────────────────────────────
 * No dictamina incumplimientos. Produce EVIDENCIA sobre dónde estuvo el
 * dispositivo que reporta la ubicación, con sus límites a la vista. La
 * distinción no es cosmética: un falso positivo de "no fue" acusa a una persona
 * real de algo que sí hizo.
 *
 * ── El pre-filtro es una cola de trabajo, no un veredicto ─────────────────────
 * El listado marca órdenes cuyo tramo viaje→cierre duró menos que un umbral,
 * calculado SÓLO con el histórico de estados (órdenes de magnitud más barato que
 * el cruce GPS). Sirve para priorizar qué mirar. Rotularlo "incumplimientos"
 * convertiría un heurístico temporal en una acusación.
 *
 * ── Por qué el umbral que se muestra es el del servidor ───────────────────────
 * Hubo un bug real (hallazgo 3.6) donde la ruta validaba el `thresholdMinutes`
 * pedido y después lo descartaba: un auditor pedía 30, recibía resultados
 * calculados con 5 y concluía "no hay más casos". Acá se muestra SIEMPRE
 * `meta.thresholdMinutes` — el que efectivamente se aplicó.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Cota del barrido. Espejo EXACTO de MAX_AUDIT_RANGE_DAYS del backend — si divergen,
 * el auditor se come un 400 que el cliente podía haber evitado.
 *
 * Era 30. Medido contra producción:
 *
 *   7 días → 504, y React Query reintenta: ~2 min de spinner y después error
 *   3 días → 200 OK en 60-90 s
 *   1 día  → 200 OK, rápido
 *
 * El backend consulta el histórico de CADA orden contra IClass en serie (~16 OS/día,
 * ~1,5 s por orden), así que el costo es lineal en el rango. 3 es el mayor valor con
 * evidencia medida de responder: permitir 30 era ofrecer 27 rangos que no responden.
 */
const MAX_RANGE_DAYS = 3;

/**
 * A partir de este span el barrido deja de ser instantáneo y hay que avisarlo ANTES.
 * Un spinner mudo de 90 s se lee como "se colgó" y el auditor recarga — disparando
 * otro barrido en serie contra la misma IClass que atiende el closure loop.
 */
const SLOW_RANGE_DAYS = 2;

/** Techo medido del barrido en el rango máximo permitido. */
const SLOW_RANGE_SECONDS = 90;

const THRESHOLD_OPTIONS = [
  { value: '2', label: '2 minutos' },
  { value: '5', label: '5 minutos' },
  { value: '10', label: '10 minutos' },
  { value: '15', label: '15 minutos' },
  { value: '30', label: '30 minutos' },
];

interface CandidateRow extends SuspiciousClosure {
  id: string;
}

const CANDIDATE_COLUMNS = [
  { label: 'Orden', key: 'serviceOrderCode' },
  {
    label: 'Duración de ejecución',
    key: 'executionMinutes',
    sortable: true,
    render: (row: CandidateRow) => formatDurationMinutes(row.executionMinutes),
  },
  {
    label: 'Cuadrilla',
    key: 'teamTechnicianName',
    render: (row: CandidateRow) => row.teamTechnicianName ?? row.teamLogin ?? '—',
  },
  {
    label: 'Tipo de orden',
    key: 'soTypeDescription',
    render: (row: CandidateRow) => row.soTypeDescription ?? '—',
  },
  {
    label: 'Resultado registrado',
    key: 'resultCodeName',
    render: (row: CandidateRow) => row.resultCodeName ?? '—',
  },
];

/** Diferencia en días entre dos "yyyy-MM-dd". `NaN` si alguno no parsea. */
function rangeDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return (b - a) / MS_PER_DAY;
}

export default function TechniciansAuditPage() {
  const [activeTab, setActiveTab] = useState<'order' | 'candidates'>('order');

  // ── Auditoría por orden ────────────────────────────────────────────────────
  const [codeDraft, setCodeDraft] = useState('');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const auditQuery = useServiceOrderPresenceAudit(submittedCode);

  function handleAuditSubmit(e: FormEvent) {
    e.preventDefault();
    const code = codeDraft.trim();
    // Sin código no se dispara nada: un GET con code vacío es un 400 garantizado.
    if (!code) return;
    // Reauditar el MISMO código tiene que volver a consultar: `setSubmittedCode`
    // con el valor ya cargado no cambia el estado ni la query key, así que el
    // botón quedaba mudo justo cuando el auditor quiere confirmar un resultado.
    if (code === submittedCode) {
      auditQuery.refetch();
      return;
    }
    setSubmittedCode(code);
  }

  // ── Pre-filtro de cierres ──────────────────────────────────────────────────
  /** VIVO: la pantalla puede quedar abierta y cruzar la medianoche argentina. */
  const todayAr = useArToday();

  // Semilla del rango: HOY, un solo día. Se calcula UNA vez a propósito (es el valor
  // inicial de un campo editable): recalcularlo pisaría lo que el auditor haya elegido.
  //
  // Antes la semilla era `hoy - 7 días`. Abrir la pestaña disparaba, sin que nadie
  // eligiera nada, el único rango que en producción NUNCA respondía: 504, reintento de
  // React Query, otro 504, ~2 minutos de spinner. El default tiene que ser el rango que
  // sabemos que responde rápido; ampliarlo es una decisión explícita del auditor.
  const [from, setFrom] = useState(todayAr);
  const [to, setTo] = useState(todayAr);
  const [threshold, setThreshold] = useState('5');

  const span = rangeDays(from, to);
  let rangeError: string | null = null;
  if (Number.isNaN(span)) rangeError = 'Ingresá ambas fechas con un formato válido.';
  else if (span < 0) rangeError = 'La fecha "desde" no puede ser posterior a la fecha "hasta".';
  else if (span > MAX_RANGE_DAYS)
    rangeError =
      `El rango no puede superar los ${MAX_RANGE_DAYS} días (pediste ${Math.round(span)}). ` +
      `Por encima de eso el barrido no llega a responder. Partí el período en tramos.`;

  /** Rango válido pero caro: hay que avisar el costo antes de que el spinner arranque. */
  const isSlowRange = rangeError === null && span >= SLOW_RANGE_DAYS;
  const spanDays = Number.isFinite(span) ? Math.round(span) : 0;

  const suspiciousQuery = useSuspiciousClosures(
    { from, to, thresholdMinutes: Number(threshold) },
    rangeError === null && activeTab === 'candidates',
  );

  const candidates: CandidateRow[] = (suspiciousQuery.data?.candidates ?? []).map((c) => ({
    ...c,
    id: c.serviceOrderCode,
  }));

  // ── Panel: auditar una orden ───────────────────────────────────────────────
  const orderPanel = (
    <div className={styles.panel}>
      {/* h2 explícito: sin él la jerarquía saltaba del h1 de la página al h3 del
          VerdictCard, y un lector de pantalla pierde el nivel intermedio. */}
      <h2 className={styles.panelTitle}>Auditoría por orden de servicio</h2>

      <form className={styles.searchRow} onSubmit={handleAuditSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="audit-code">
            Código de la orden de servicio
          </label>
          <Input
            id="audit-code"
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
            placeholder="Ej: 4905"
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="primary" size="md">
          Auditar orden
        </Button>
      </form>

      {!submittedCode && !auditQuery.isLoading && (
        <p className={styles.empty} data-testid="audit-empty">
          Ingresá el código de una orden cerrada para ver dónde estuvo el dispositivo de la
          cuadrilla durante la ventana real de trabajo. La ventana sale del histórico de estados
          de la orden, no de la fecha agendada.
        </p>
      )}

      {auditQuery.isLoading && (
        <div className={styles.skeleton} data-testid="audit-skeleton">
          <span className={styles.skeletonBlock} aria-hidden="true" />
          <p className={styles.srOnly} role="status">
            Auditando la orden…
          </p>
        </div>
      )}

      {!auditQuery.isLoading && auditQuery.isError && (
        <div className={styles.errorBanner} role="alert">
          <p className={styles.errorText}>
            No se pudo auditar la orden. Puede ser un problema con IClass — no interpretes el
            fallo como un resultado.
          </p>
          <Button variant="secondary" size="sm" onClick={() => auditQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!auditQuery.isLoading && !auditQuery.isError && auditQuery.data && (
        <VerdictCard report={auditQuery.data} />
      )}
    </div>
  );

  // ── Panel: candidatos a revisar ────────────────────────────────────────────
  const candidatesPanel = (
    <div className={styles.panel} data-testid="candidates-panel">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Candidatos a revisar</h2>
        <p className={styles.panelIntro}>
          Órdenes cuyo tramo de ejecución (viaje → cierre) duró menos que el umbral, según el
          histórico de estados. Es una cola de priorización: <strong>no es un veredicto</strong> y
          no cruza ningún dato de GPS. Para saber dónde estuvo el dispositivo, auditá la orden en
          la otra pestaña.
        </p>
      </div>

      <div className={styles.filters}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="range-from">
            Desde
          </label>
          <input
            id="range-from"
            className={styles.dateInput}
            type="date"
            value={from}
            max={todayAr}
            onChange={(e) => setFrom(e.target.value)}
            aria-invalid={rangeError !== null || undefined}
            aria-describedby={rangeError ? 'range-error' : undefined}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="range-to">
            Hasta
          </label>
          <input
            id="range-to"
            className={styles.dateInput}
            type="date"
            value={to}
            max={todayAr}
            onChange={(e) => setTo(e.target.value)}
            aria-invalid={rangeError !== null || undefined}
            aria-describedby={rangeError ? 'range-error' : undefined}
          />
        </div>

        <div className={styles.field}>
          <Select
            label="Umbral de ejecución"
            options={THRESHOLD_OPTIONS}
            value={threshold}
            onChange={setThreshold}
          />
        </div>
      </div>

      {/*
        El costo está escrito en la pantalla, no en la cabeza de quien la programó.
        Se ve ANTES de tocar las fechas: el auditor decide con el número a la vista,
        no descubre los 90 segundos mirando un spinner.
      */}
      <p className={styles.costHint} data-testid="range-cost-hint">
        El barrido consulta el histórico de cada orden contra IClass <strong>en serie</strong>, así
        que el tiempo crece con el rango: un día responde en segundos y {MAX_RANGE_DAYS} días —el
        máximo— tardó hasta {SLOW_RANGE_SECONDS} s medidos en producción.
      </p>

      {rangeError && (
        <p className={styles.rangeError} id="range-error" data-testid="range-error" role="alert">
          {rangeError}
        </p>
      )}

      {isSlowRange && (
        <p
          className={styles.slowRangeWarning}
          data-testid="slow-range-warning"
          role="status"
          aria-live="polite"
        >
          Pediste {spanDays} días: puede tardar hasta {SLOW_RANGE_SECONDS} s. No recargues la
          página mientras corre — recargar dispara otro barrido contra IClass sin cancelar el que
          ya está en curso.
        </p>
      )}

      {!rangeError && suspiciousQuery.data && (
        <p className={styles.appliedThreshold} data-testid="applied-threshold" aria-live="polite">
          Umbral aplicado por el servidor: {formatMinutes(suspiciousQuery.data.thresholdMinutes)}.
          Los resultados de abajo se calcularon con ese valor.
        </p>
      )}

      {suspiciousQuery.isLoading && (
        <div className={styles.skeleton} data-testid="candidates-skeleton">
          <span className={styles.skeletonRow} aria-hidden="true" />
          <span className={styles.skeletonRow} aria-hidden="true" />
          <span className={styles.skeletonRow} aria-hidden="true" />
          {/*
            El anuncio del lector de pantalla dice cuánto puede tardar cuando el rango
            es caro. "Buscando candidatos…" durante 90 s no distingue "trabajando" de
            "colgado", y quien no ve la pantalla no tiene ni el spinner como pista.
          */}
          <p className={styles.srOnly} role="status">
            {isSlowRange
              ? `Barrido de ${spanDays} días en curso. Puede tardar hasta ${SLOW_RANGE_SECONDS} s.`
              : 'Buscando candidatos…'}
          </p>
        </div>
      )}

      {!suspiciousQuery.isLoading && suspiciousQuery.isError && (
        <div className={styles.errorBanner} role="alert">
          <p className={styles.errorText}>
            No se pudo completar el barrido de cierres. El resultado quedó incompleto — no lo
            leas como "no hay candidatos".
          </p>
          <Button variant="secondary" size="sm" onClick={() => suspiciousQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!suspiciousQuery.isLoading &&
        !suspiciousQuery.isError &&
        suspiciousQuery.data &&
        candidates.length === 0 && (
          <p className={styles.empty} data-testid="candidates-empty">
            Ninguna orden del rango quedó por debajo del umbral. Probá con un umbral mayor o con
            otro rango de fechas.
          </p>
        )}

      {/*
        La salvedad va PEGADA a la tabla, no sólo en el intro del panel. Lo que
        se scrollea, se recorta y se manda por WhatsApp es la tabla: nombre y
        apellido con "2m 16s" al lado, ordenado de más corto a más largo. Si la
        explicación legítima queda arriba de todo, el recorte la pierde y la
        lista sola se lee como un ranking de sospechosos.
      */}
      {!suspiciousQuery.isLoading && !suspiciousQuery.isError && candidates.length > 0 && (
        <div className={styles.tableBlock} data-testid="candidates-table-block">
          <p className={styles.tableCaveat} data-testid="candidates-caveat">
            Una ejecución corta puede tener explicación legítima: la cuadrilla ya estaba en el
            lugar por otra orden, el cliente canceló en la puerta, o el trabajo ya estaba hecho.
            Esta lista dice cuánto duró el tramo viaje → cierre según el histórico de estados —
            nada más.
          </p>
          <DataTable<CandidateRow> columns={CANDIDATE_COLUMNS} data={candidates} />
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Auditoría de presencia</h1>
        <p className={styles.subtitle}>
          La evidencia indica dónde estuvo el dispositivo que reporta la ubicación durante la
          ventana de trabajo de la orden. No establece quién lo operaba ni constituye una
          imputación.
        </p>
      </header>

      <Tabs
        mountMode="lazy"
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as 'order' | 'candidates')}
        tabs={[
          { id: 'order', label: 'Auditar una orden', content: orderPanel },
          { id: 'candidates', label: 'Candidatos a revisar', content: candidatesPanel },
        ]}
      />
    </div>
  );
}
