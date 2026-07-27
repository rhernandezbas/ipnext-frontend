import { memo, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import { Can } from '@/components/auth/Can';
import { Select } from '@/components/molecules/Select/Select';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import { formatDateTimeShort, formatRelative } from '@/utils/formatDate';
import { useAcknowledgeNocAlert, useNocAlertsList, useNocAlertsStream } from '@/hooks/useNocAlerts';
import { EMPTY_NOC_ALERT_FILTERS } from '@/types/nocAlert';
import type { NocAlertDto, NocAlertFilterState, NocAlertSeverity, NocAlertStatus } from '@/types/nocAlert';
import styles from './AlertsPage.module.css';

/**
 * AlertsPage (Fase C FE, change `noc-alerts-hub`) — panel de alertas NOC.
 * spec.md `noc-alert-realtime`, Requirement "Alerts panel with filters and ACK".
 *
 * Tiempo real: `useNocAlertsStream` mantiene un `EventSource` a
 * `/api/alerts/stream` y parchea la ÚNICA cache entry (`nocAlertsKey`)
 * directamente — este componente solo lee `useNocAlertsList` (que devuelve
 * esa misma cache) y filtra client-side. Fallback: si el stream cae de forma
 * persistente (`mode === 'polling'`), `useNocAlertsList` empieza a pollear
 * cada 15s gateado por pestaña visible (`useDocumentVisible`, dentro del hook).
 *
 * gates: la PAGE completa está detrás de `RequirePermission
 * permission="monitoring.read"` en App.tsx (no acá) — este componente solo
 * gatea la acción de ACK con `<Can permission="monitoring.acknowledge_alert">`
 * (claves verificadas contra `alerts.routes.ts`: `requirePerm('monitoring',
 * 'read'|'acknowledge_alert')`).
 */

const KNOWN_SOURCES = [
  { value: '', label: 'Todas las fuentes' },
  { value: 'grafana', label: 'Grafana' },
  { value: 'fiber-collector', label: 'fiber-collector' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'Todas las severidades' },
  { value: 'critical', label: 'Crítica' },
  { value: 'warning', label: 'Advertencia' },
  { value: 'info', label: 'Info' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'firing', label: 'Activa' },
  { value: 'resolved', label: 'Resuelta' },
];

const SEVERITY_LABEL: Record<NocAlertSeverity, string> = {
  critical: 'Crítica',
  warning: 'Advertencia',
  info: 'Info',
};

const STATUS_LABEL: Record<NocAlertStatus, string> = {
  firing: 'Activa',
  resolved: 'Resuelta',
};

/** Cuánto dura la animación de entrada de una fila nueva (Emil Kowalski —
 *  150-300ms para UI, nunca más largo). Debe coincidir con la duración del
 *  keyframe `alertRowEnter` en AlertsPage.module.css. */
const ROW_ENTER_MS = 280;
/** Cuánto se muestra el feedback de éxito/error del ACK antes de auto-cerrarse. */
const FEEDBACK_TIMEOUT_MS = 4_000;

/** BAJO-1 (2ª review adversarial): referencia ESTABLE para el fallback de
 *  `list.data` — un `?? []` inline crea un array nuevo por render y rompe la
 *  memoización aguas abajo.
 *
 *  3ª review: `Object.freeze` convierte el "nunca se muta" de comentario en
 *  garantía — un `push` sobre esta constante corrompería el fallback de TODOS
 *  los renders futuros, no solo el actual. El tipo `readonly` hace que el
 *  compilador lo haga cumplir ADEMÁS del runtime. */
const EMPTY_ALERTS: readonly NocAlertDto[] = Object.freeze([] as NocAlertDto[]);

/**
 * Resumen indicativo por severidad/tipo (change `noc-alerts-dashboard`).
 * Problema real medido en prod: ~400 alertas activas, 79% info (228 son
 * "ONU recovered"), y apenas 16 críticas ENTERRADAS en el ruido. El resumen
 * existe para que un operario vea en 2 segundos qué está roto, sin scrollear
 * 400 tarjetas.
 *
 * Los contadores del resumen son SIEMPRE los mismos números — count
 * NUNCA se anima en cada tick del SSE (Emil Kowalski: nunca animar algo de
 * alta frecuencia). Se actualiza el texto/número directamente y listo, sin
 * transición visual.
 *
 * A4 (review adversarial): NO llevan `aria-live`/`aria-atomic` — con
 * `aria-atomic` sobre un span que contiene SOLO el número, el lector
 * anunciaba "16" sin contexto, y lo repetía en CADA tick del SSE, ×3 tiles
 * (era el equivalente auditivo de animar algo de alta frecuencia — la misma
 * regla de Emil Kowalski de arriba, aplicada a lectores de pantalla en vez de
 * a los ojos). El `.count` de la lista (`aria-live="polite"` propio, más
 * abajo en `AlertsPage`) ya cubre "algo cambió"; estos números solo se leen
 * al enfocar/activar el tile (son botones reales).
 */
const TOP_TYPES_LIMIT = 6;
/** De MÁS grave a MENOS grave. `computeTypeBreakdown` se apoya en este orden
 *  para sacar la severidad MÁXIMA de un tipo sin volver a ordenar. */
const SEVERITY_ORDER: NocAlertSeverity[] = ['critical', 'warning', 'info'];
/** Rank de gravedad (0 = más grave) — ordena el breakdown por severidad. */
const SEVERITY_RANK: Record<NocAlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

interface TypeBreakdownEntry {
  alertname: string;
  count: number;
  /** Severidad MÁXIMA presente en el tipo (Foco 2, 2ª review adversarial) —
   *  NO la más frecuente. Ver el docblock de `computeTypeBreakdown`. */
  maxSeverity: NocAlertSeverity;
  /** Desglose real por severidad, de más grave a menos, solo con las
   *  presentes. Viaja al `aria-label`/`title` de la fila para que el badge de
   *  MÁXIMA no sobre-represente un tipo mayormente info. */
  severityCounts: Array<{ severity: NocAlertSeverity; count: number }>;
  dominantSource: string;
}

/** Recuento por severidad — SOLO sobre alertas activas (`status === 'firing'`).
 *  Las resueltas no cuentan para "qué está roto ahora mismo". */
function computeSeverityCounts(activeAlerts: NocAlertDto[]): Record<NocAlertSeverity, number> {
  const counts: Record<NocAlertSeverity, number> = { critical: 0, warning: 0, info: 0 };
  for (const a of activeAlerts) counts[a.severity] += 1;
  return counts;
}

/** Top-N tipos de incidencia (`alertname`), rankeados por la severidad MÁXIMA
 *  presente en cada tipo y etiquetados con la fuente DOMINANTE (esa sí, la más
 *  frecuente — no hay una fuente "peor" que justifique otro criterio).
 *
 *  A3 (1ª review adversarial): ordenar por conteo bruto reproduce EXACTAMENTE
 *  el problema que el resumen vino a resolver — con la distribución real de
 *  prod (305 info / 63 warning / 16 critical) los primeros 6 por conteo son
 *  todos tipos info, y un `NAS DOWN` critical con poco volumen queda AFUERA
 *  del panel. Orden: severidad primero (`SEVERITY_RANK`: critical > warning >
 *  info), conteo DESPUÉS dentro de la misma severidad.
 *
 *  Foco 2 (2ª review adversarial): el fix de A3 rankeaba por la severidad
 *  DOMINANTE (la más FRECUENTE del tipo) y eso dejaba el agujero abierto. La
 *  severidad NO está acoplada al `alertname`: el backend la toma del label POR
 *  ALERTA (`GrafanaWebhookSource.ts` — la inferencia por alertname es solo
 *  fallback) y el ingest genérico valida `alertname` y `severity` como campos
 *  independientes, sin coherencia forzada. Un tipo con 20 info + 1 critical
 *  tenía severidad dominante `info` → badge "Info" y séptimo puesto → el
 *  critical desaparecía del panel. Ahora se rankea y se muestra por la
 *  severidad MÁXIMA presente: en un panel NOC sobre-avisar es más seguro que
 *  sub-avisar, y el desglose real ("1 Crítica, 20 Info") viaja en el
 *  `aria-label`/`title` de la fila para no sobre-representar el tipo.
 *
 *  Garantía dura (ahora SÍ es cierta): mientras haya <= `TOP_TYPES_LIMIT`
 *  tipos que contengan AL MENOS UNA alerta critical, TODOS entran al panel sin
 *  importar cuántas info los superen en volumen — ni por conteo ni por mezcla
 *  interna de severidades.
 *
 *  El sort tiene EXACTAMENTE 3 claves, en este orden:
 *    1. `SEVERITY_RANK[maxSeverity]` — critical > warning > info.
 *    2. `count` descendente — empate de severidad máxima → gana el de más volumen.
 *    3. `alertname` alfabético — empate de conteo → determinismo, nada más.
 *  `dominantSource` NO es clave de orden (MEDIO-3, 3ª review adversarial: el
 *  comentario decía que sí y era texto arrastrado de una versión vieja). Su
 *  propio desempate alfabético existe, pero vive ADENTRO del cálculo de la
 *  fuente dominante de cada fila — no influye en qué fila va antes que cuál. */
function computeTypeBreakdown(activeAlerts: NocAlertDto[], limit: number): TypeBreakdownEntry[] {
  const byType = new Map<
    string,
    { count: number; bySeverity: Map<NocAlertSeverity, number>; bySource: Map<string, number> }
  >();

  for (const a of activeAlerts) {
    const entry = byType.get(a.alertname) ?? {
      count: 0,
      bySeverity: new Map<NocAlertSeverity, number>(),
      bySource: new Map<string, number>(),
    };
    entry.count += 1;
    entry.bySeverity.set(a.severity, (entry.bySeverity.get(a.severity) ?? 0) + 1);
    entry.bySource.set(a.source, (entry.bySource.get(a.source) ?? 0) + 1);
    byType.set(a.alertname, entry);
  }

  const rows: TypeBreakdownEntry[] = Array.from(byType.entries()).map(([alertname, v]) => {
    // `SEVERITY_ORDER` va de más grave a menos → la primera presente es la MÁXIMA.
    const severityCounts = SEVERITY_ORDER.filter((severity) => (v.bySeverity.get(severity) ?? 0) > 0).map(
      (severity) => ({ severity, count: v.bySeverity.get(severity)! }),
    );
    const dominantSource = Array.from(v.bySource.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0][0];
    return {
      alertname,
      count: v.count,
      maxSeverity: severityCounts[0]!.severity,
      severityCounts,
      dominantSource,
    };
  });

  return rows
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.maxSeverity] - SEVERITY_RANK[b.maxSeverity] ||
        b.count - a.count ||
        a.alertname.localeCompare(b.alertname),
    )
    .slice(0, limit);
}

/** Nombre accesible de una fila del breakdown: tipo + total de activas +
 *  desglose por severidad. El badge visible muestra solo la MÁXIMA (Foco 2);
 *  el desglose evita que "Crítica" sobre-represente un tipo que es 20 info y
 *  1 critical, sin sacarlo del podio. */
function breakdownRowLabel(row: TypeBreakdownEntry): string {
  const desglose = row.severityCounts.map((s) => `${s.count} ${SEVERITY_LABEL[s.severity]}`).join(', ');
  return `${row.alertname}: ${row.count} activa${row.count === 1 ? '' : 's'} (${desglose}). Filtrar la lista por este tipo.`;
}

/**
 * MEDIO-1 / MEDIO-2 (2ª review) + MEDIO-1 (3ª review) — estado de filtros con
 * MEMORIA y con el enganche del resumen MODELADO EXPLÍCITAMENTE.
 *
 * Los controles del RESUMEN (tiles de severidad y filas del breakdown) cuentan
 * SOLO alertas activas, así que al activarse fuerzan `status: 'firing'` para
 * que la lista muestre EXACTAMENTE lo que el control promete (fix A2). Eso
 * abrió los agujeros que este reducer cierra:
 *
 * - MEDIO-1 (2ª): `aria-pressed` miraba solo `severity`, no la condición
 *   completa. Con el tile presionado, cambiar Estado a mano dejaba el tile
 *   diciendo "presionado" mientras la lista mostraba otra cosa.
 * - MEDIO-2 (2ª): pisar el `status` manual al presionar es defendible (acción
 *   atómica); DESTRUIRLO al des-presionar no. `statusBeforeSummary` guarda lo
 *   que el operario tenía elegido y el des-toggle lo restaura.
 * - MEDIO-1 (3ª): el reducer INFERÍA "hay un control del resumen enganchado"
 *   de `filters.severity !== '' || filters.alertname !== ''`. Una `severity`
 *   puesta A MANO con el <Select> también deja el campo no-vacío, así que el
 *   reducer creía que un tile sostenía el `'firing'` y NUNCA lo restauraba:
 *   quedaba `Estado: Activa` pegado, que el operario nunca puso, y el tile de
 *   esa severidad se veía presionado sin que nadie lo hubiera clickeado.
 *
 * El fix no es otro parche a la condición: `engaged` registra QUÉ controles del
 * resumen están enganchados de verdad. "Campo no vacío" y "control enganchado"
 * dejan de ser lo mismo, que era la confusión de raíz.
 *
 * Invariantes que sostiene:
 * 1. `aria-pressed` de un control === "ese control está en `engaged`", y ese
 *    MISMO predicado decide si el click engancha o desengancha → un botón que
 *    se ve suelto, al clickearlo, se presiona (invariante de la 2ª review).
 * 2. Un control enganchado SIEMPRE implica `filters.status === 'firing'` y el
 *    campo correspondiente seteado: cualquier acción que rompa eso (tocar
 *    Estado o Severidad a mano) lo desengancha en el mismo paso.
 * 3. `statusBeforeSummary` se restaura EXACTAMENTE UNA vez, cuando se suelta
 *    el ÚLTIMO control enganchado — sin importar por qué puerta se suelte
 *    (des-toggle, chip "quitar filtro de tipo", o un <Select> manual que lo
 *    desenganche).
 */
interface SummaryEngagement {
  /** Severidad cuyo TILE está enganchado, o `null`. */
  severity: NocAlertSeverity | null;
  /** `alertname` cuya FILA del breakdown está enganchada, o `null`. */
  alertname: string | null;
}

const NO_ENGAGEMENT: SummaryEngagement = { severity: null, alertname: null };

interface FiltersState {
  filters: NocAlertFilterState;
  engaged: SummaryEngagement;
  statusBeforeSummary: NocAlertFilterState['status'] | null;
}

type FiltersAction =
  | { type: 'patch'; patch: Partial<NocAlertFilterState> }
  | { type: 'reset' }
  | { type: 'toggleSeverity'; severity: NocAlertSeverity }
  | { type: 'toggleAlertname'; alertname: string }
  | { type: 'clearAlertname' };

const INITIAL_FILTERS_STATE: FiltersState = {
  filters: EMPTY_NOC_ALERT_FILTERS,
  engaged: NO_ENGAGEMENT,
  statusBeforeSummary: null,
};

/** El tile está presionado si ESTE tile es el enganchado — no si el filtro
 *  "casualmente" coincide con lo que el tile representa (podría haberlo puesto
 *  el operario a mano, y entonces nadie lo clickeó). */
function isSeverityTilePressed(engaged: SummaryEngagement, severity: NocAlertSeverity): boolean {
  return engaged.severity === severity;
}

/** Hermana del tile, mismo criterio. */
function isAlertnameRowPressed(engaged: SummaryEngagement, alertname: string): boolean {
  return engaged.alertname === alertname;
}

/**
 * Punto ÚNICO donde se decide si hay que devolver el status pisado. Si ya no
 * queda ningún control del resumen enganchado y había algo guardado, se
 * restaura (invariante 3). Si `statusBeforeSummary` es null, el operario tomó
 * el volante del Estado a mano y no se le pisa nada.
 */
function settle(
  filters: NocAlertFilterState,
  engaged: SummaryEngagement,
  statusBeforeSummary: NocAlertFilterState['status'] | null,
): FiltersState {
  const anyEngaged = engaged.severity !== null || engaged.alertname !== null;
  if (!anyEngaged && statusBeforeSummary !== null) {
    return { filters: { ...filters, status: statusBeforeSummary }, engaged, statusBeforeSummary: null };
  }
  return { filters, engaged, statusBeforeSummary };
}

function engage(state: FiltersState, engaged: SummaryEngagement, patch: Partial<NocAlertFilterState>): FiltersState {
  return {
    filters: { ...state.filters, ...patch, status: 'firing' },
    engaged,
    // Si ya había otro control del resumen enganchado, el status "previo" es el
    // de ANTES de ese primero — no el 'firing' que él mismo dejó.
    statusBeforeSummary: state.statusBeforeSummary ?? state.filters.status,
  };
}

function filtersReducer(state: FiltersState, action: FiltersAction): FiltersState {
  switch (action.type) {
    case 'patch': {
      const filters = { ...state.filters, ...action.patch };
      // Tocar Estado a mano invalida el enganche de TODOS los controles del
      // resumen (los dos prometen "activas"), y a partir de ahí el operario
      // maneja esa dimensión: no hay nada pisado que restaurar.
      if ('status' in action.patch) return { filters, engaged: NO_ENGAGEMENT, statusBeforeSummary: null };
      // Tocar Severidad a mano desengancha SOLO el tile (una severidad elegida
      // con el <Select> no es un tile presionado — MEDIO-1 3ª review). Si con
      // eso no queda nada enganchado, `settle` devuelve el status pisado.
      if ('severity' in action.patch) {
        return settle(filters, { ...state.engaged, severity: null }, state.statusBeforeSummary);
      }
      return { ...state, filters };
    }
    case 'reset':
      return INITIAL_FILTERS_STATE;
    case 'toggleSeverity':
      return isSeverityTilePressed(state.engaged, action.severity)
        ? settle({ ...state.filters, severity: '' }, { ...state.engaged, severity: null }, state.statusBeforeSummary)
        : engage(state, { ...state.engaged, severity: action.severity }, { severity: action.severity });
    case 'toggleAlertname':
      return isAlertnameRowPressed(state.engaged, action.alertname)
        ? settle({ ...state.filters, alertname: '' }, { ...state.engaged, alertname: null }, state.statusBeforeSummary)
        : engage(state, { ...state.engaged, alertname: action.alertname }, { alertname: action.alertname });
    // El chip "Quitar filtro de tipo" NO es un toggle: siempre saca el filtro
    // (y desengancha la fila, restaurando el status como cualquier des-toggle).
    case 'clearAlertname':
      return settle(
        { ...state.filters, alertname: '' },
        { ...state.engaged, alertname: null },
        state.statusBeforeSummary,
      );
  }
}

interface AlertsSummaryProps {
  isLoading: boolean;
  isError: boolean;
  /** B13 (review adversarial): distingue "todavía no llegaron datos" (query
   *  en un estado intermedio, ni loading ni error ni data) de "llegaron
   *  datos y no hay activas". Afirmar salud de red ("la red está en orden")
   *  por AUSENCIA de datos es peligroso en un panel NOC. */
  hasData: boolean;
  activeAlerts: NocAlertDto[];
  /** MEDIO-1 (3ª review): el resumen ya NO recibe `filters` — recibe qué
   *  controles SUYOS están enganchados. Derivar "presionado" del filtro hacía
   *  que una severidad puesta a mano con el <Select> presionara un tile
   *  fantasma. Además desacopla el `React.memo`: cambiar `source` en el <Select>
   *  ya no re-renderiza el resumen. */
  engaged: SummaryEngagement;
  onToggleSeverity: (severity: NocAlertSeverity) => void;
  onToggleAlertname: (alertname: string) => void;
}

function AlertsSummarySkeleton() {
  // Puramente visual (aria-hidden): el skeleton de LA LISTA (role="status",
  // "Cargando alertas…") ya cubre el anuncio de carga — duplicar un segundo
  // role="status" acá sería un anuncio redundante para lectores de pantalla.
  return (
    <div className={styles.summarySkeleton} aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.summarySkeletonTile} />
      ))}
    </div>
  );
}

/** M5 (review adversarial): `AlertsSummary` no estaba en `React.memo` y sus
 *  cómputos (`computeSeverityCounts`, el filtro de `unacked`,
 *  `computeTypeBreakdown` — 1 Map + 2 Maps por tipo + sorts) corrían en el
 *  CUERPO del render sobre ~400 items, sin memoizar. Amplificado por
 *  `enteringIds` (2 renders extra por alerta firing). Fix: `useMemo` para los
 *  3 cómputos (hooks ANTES de los early-return de loading/error/empty — regla
 *  de hooks; correr sobre `activeAlerts=[]` en esos estados es gratis) +
 *  `React.memo` en el componente (efectivo solo si los handlers que le llegan
 *  son estables — ver `useCallback` en `AlertsPage`). */
function AlertsSummaryImpl({
  isLoading,
  isError,
  hasData,
  activeAlerts,
  engaged,
  onToggleSeverity,
  onToggleAlertname,
}: AlertsSummaryProps) {
  const severityCounts = useMemo(() => computeSeverityCounts(activeAlerts), [activeAlerts]);
  const unacked = useMemo(() => activeAlerts.filter((a) => !a.acknowledged).length, [activeAlerts]);
  const typeBreakdown = useMemo(() => computeTypeBreakdown(activeAlerts, TOP_TYPES_LIMIT), [activeAlerts]);
  /** ALTO-1 (3ª review adversarial): denominador de la mini-barra = el conteo
   *  MÁXIMO de las filas MOSTRADAS, no el de la primera. Desde el fix A3 la fila
   *  `[0]` es la MÁS GRAVE, no la de más volumen — y como los criticals son
   *  típicamente de bajo volumen (el caso NORMAL: 1 critical + 12 warning + 30
   *  info), dividir por `[0].count` daba anchos de 1200% y 3000% que el
   *  `overflow: hidden` del track aplastaba: las tres barras se veían idénticas
   *  y llenas. El denominador tiene que ser independiente del ORDEN. */
  const maxTypeCount = useMemo(
    () => typeBreakdown.reduce((max, row) => (row.count > max ? row.count : max), 0),
    [typeBreakdown],
  );

  if (isLoading) {
    return <AlertsSummarySkeleton />;
  }

  if (isError) {
    // Texto plano, SIN role="alert": el bloque de error de la lista (debajo)
    // ya tiene ese role — duplicarlo aquí dispararía un segundo anuncio para
    // el mismo problema.
    return <p className={styles.summaryError}>No se pudo calcular el resumen de alertas.</p>;
  }

  if (activeAlerts.length === 0) {
    return (
      <section className={styles.summary} aria-label="Resumen de alertas activas">
        <p className={styles.summaryEmpty}>
          {hasData ? 'Sin alertas activas — la red está en orden.' : 'Sin datos para mostrar.'}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.summary} aria-label="Resumen de alertas activas">
      <div className={styles.summaryHeading}>
        <h2 className={styles.summaryTitle}>Resumen (activas)</h2>
        <span className={styles.summaryHint}>Recuento global de activas — no cambia con los filtros de la lista</span>
      </div>

      <div className={styles.kpiRow} role="group" aria-label="Alertas activas por severidad">
        {SEVERITY_ORDER.map((sev) => (
          <button
            key={sev}
            type="button"
            className={`${styles.kpiTile} ${styles[`kpiTile_${sev}`]}`}
            // MEDIO-1: la condición COMPLETA que el tile representa (esta
            // severidad Y activas), no media condición. Si el operario cambió
            // Estado a mano, el tile ya no es el filtro vigente → suelto.
            aria-pressed={isSeverityTilePressed(engaged, sev)}
            onClick={() => onToggleSeverity(sev)}
          >
            <span className={styles.kpiTop}>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.kpiLabel}>{SEVERITY_LABEL[sev]}</span>
            </span>
            {/* A4 (review adversarial): `aria-live="polite" aria-atomic="true"` acá
                anunciaba "16" pelado (sin contexto) en CADA tick del SSE, ×3 tiles
                — 5 live regions compitiendo por atención en la página (+ `.count`
                de la lista + `role="status"` que tenía el tile de ACK, ya sacado
                más abajo). El `.count` de la lista ya cubre "algo cambió"; estos
                números solo se leen al enfocar/activar el tile (botón real). */}
            <span className={styles.kpiValue}>{severityCounts[sev]}</span>
          </button>
        ))}

        {/* M9 (review adversarial): `role="status"` convertía este <div> en una
            live region que también anunciaba en cada tick, y estaba ahí solo
            para que un test lo encontrara — rompía además el claim de "un solo
            role=status" en éxito. Sin role, el texto visible ("Sin reconocer" +
            número) lo sigue leyendo un lector de pantalla en orden normal; el
            test lo ubica por `data-testid`. */}
        <div className={styles.kpiTileAck} data-testid="kpi-tile-ack">
          <span className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Sin reconocer</span>
          </span>
          <span className={styles.kpiValue}>{unacked}</span>
        </div>
      </div>

      {typeBreakdown.length > 0 && (
        <div className={styles.typeBreakdown}>
          <h3 className={styles.breakdownTitle}>Top incidencias</h3>
          <ul className={styles.breakdownList}>
            {typeBreakdown.map((row) => {
              // Foco 2: el desglose por severidad va al nombre accesible y al
              // title — el badge visible muestra la MÁXIMA, esto cuenta la
              // historia completa ("1 Crítica, 20 Info") sin sacarla del podio.
              const label = breakdownRowLabel(row);
              return (
                <li key={row.alertname}>
                  <button
                    type="button"
                    className={styles.breakdownRow}
                    // MEDIO-1 (hermano del tile): condición COMPLETA — este
                    // tipo Y activas, que es lo que la fila cuenta.
                    aria-pressed={isAlertnameRowPressed(engaged, row.alertname)}
                    aria-label={label}
                    title={label}
                    onClick={() => onToggleAlertname(row.alertname)}
                  >
                    <span className={styles.breakdownMeta}>
                      <span className={styles.breakdownCount}>{row.count}</span>
                      <span className={styles.breakdownName}>{row.alertname}</span>
                      <SeverityBadge severity={row.maxSeverity} />
                      {/* BAJO-3 (3ª review adversarial): el badge muestra la
                          severidad MÁXIMA, así que 200 info + 1 critical se ve
                          "201 · Crítica" con la barra roja llena. El desglose
                          real ya viajaba en el `aria-label` (lector de pantalla,
                          cubierto) y en el `title` — pero el `title` pide HOVER,
                          que en touch NO existe: el operario VIDENTE en tablet
                          no tenía forma de ver que la crítica era 1 de 201. Si
                          el tipo MEZCLA severidades se muestra cuántas son de
                          la máxima ("Crítica ×1"). Sobre-avisar sigue siendo la
                          política — el tipo no se degrada ni se saca del podio —
                          pero la magnitud deja de ser invisible. Un tipo PURO no
                          gana ruido: el indicador no aparece. */}
                      {row.severityCounts.length > 1 && (
                        <span className={styles.breakdownMix}>×{row.severityCounts[0]!.count}</span>
                      )}
                      <span className={styles.breakdownSource}>{row.dominantSource}</span>
                    </span>
                    <span
                      className={`${styles.breakdownBarTrack} ${styles[`breakdownBarTrack_${row.maxSeverity}`]}`}
                    >
                      <span
                        className={`${styles.breakdownBarFill} ${styles[`breakdownBarFill_${row.maxSeverity}`]}`}
                        style={{ width: `${maxTypeCount > 0 ? (row.count / maxTypeCount) * 100 : 0}%` }}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

const AlertsSummary = memo(AlertsSummaryImpl);

function SeverityBadge({ severity }: { severity: NocAlertSeverity }) {
  return (
    <span className={`${styles.badge} ${styles[`badge_${severity}`]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

function StatusBadge({ status }: { status: NocAlertStatus }) {
  return (
    <span className={`${styles.badge} ${styles[`status_${status}`]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function AlertsSkeleton() {
  return (
    <div className={styles.skeletonList} role="status" aria-label="Cargando alertas…">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonBar} style={{ width: '30%' }} />
          <div className={styles.skeletonBar} style={{ width: '70%' }} />
          <div className={styles.skeletonBar} style={{ width: '50%' }} />
        </div>
      ))}
    </div>
  );
}

export default function AlertsPage() {
  const [filterState, dispatchFilters] = useReducer(filtersReducer, INITIAL_FILTERS_STATE);
  const filters = filterState.filters;
  const [ackTarget, setAckTarget] = useState<NocAlertDto | null>(null);
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const ack = useAcknowledgeNocAlert();

  // `onNewFiring` (no "cada frame firing"): el hook ya filtró los re-anuncios
  // del colector contra el estado que la lista tenía, así que acá SOLO llegan
  // altas y resurrecciones. Ver `isNewFiring` en useNocAlerts.ts.
  const streamMode = useNocAlertsStream({
    enabled: true,
    onNewFiring: (alertId) => {
      setEnteringIds((prev) => new Set(prev).add(alertId));
      setTimeout(() => {
        setEnteringIds((prev) => {
          const next = new Set(prev);
          next.delete(alertId);
          return next;
        });
      }, ROW_ENTER_MS + 40);
    },
  });

  const list = useNocAlertsList(streamMode === 'polling');

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), FEEDBACK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [feedback]);

  // B13 (review adversarial): `list.data === undefined` sin loading/error es
  // un estado intermedio real de la query (aún no se pidió/resolvió nada) —
  // distinto de "se pidió, volvió [] " genuino. Se lo pasamos a `AlertsSummary`
  // para que no afirme "la red está en orden" por pura ausencia de datos.
  const hasData = list.data !== undefined;
  // BAJO-1 (2ª review adversarial): `list.data ?? []` creaba un array literal
  // NUEVO en cada render, así que con `data === undefined` el `useMemo` de
  // `activeAlerts` recomputaba y el `React.memo` de `AlertsSummary` no cortaba.
  // El costo medido era nulo (en ese path no hay alertas), pero la constante
  // estable lo vuelve exacto además de barato.
  const alerts = list.data ?? EMPTY_ALERTS;

  // Recuento GLOBAL (change `noc-alerts-dashboard`) — SIEMPRE sobre TODAS las
  // activas, sin aplicar `filters`. Ver comentario de `AlertsSummary`.
  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === 'firing'), [alerts]);

  const filtersActive =
    filters.source !== '' || filters.severity !== '' || filters.status !== '' || filters.alertname !== '';

  const filteredAlerts = useMemo(
    () =>
      alerts.filter(
        (a) =>
          (filters.source === '' || a.source === filters.source) &&
          (filters.severity === '' || a.severity === filters.severity) &&
          (filters.status === '' || a.status === filters.status) &&
          (filters.alertname === '' || a.alertname === filters.alertname),
      ),
    [alerts, filters],
  );

  // A2 (1ª review adversarial): el tile de severidad promete "N activas", pero
  // solo tocaba `filters.severity` — `filters.status` seguía en '' (todos los
  // estados), así que la lista de abajo mostraba MÁS que N. El click también
  // fija `status: 'firing'`, que es EXACTAMENTE lo que el tile cuenta.
  // MEDIO-1/MEDIO-2 (2ª review): la simetría del des-toggle y el estado
  // "presionado" viven en `filtersReducer` — ver su docblock.
  // M5: `dispatch` es estable por definición, así que estos handlers no
  // rompen el `React.memo` de `AlertsSummary` en cada tick del SSE.
  const toggleSeverityFilter = useCallback(
    (severity: NocAlertSeverity) => dispatchFilters({ type: 'toggleSeverity', severity }),
    [],
  );

  const toggleAlertnameFilter = useCallback(
    (alertname: string) => dispatchFilters({ type: 'toggleAlertname', alertname }),
    [],
  );

  function handleConfirmAck() {
    if (!ackTarget) return;
    const target = ackTarget;
    ack.mutate(
      { id: target.id },
      {
        onSuccess: () => {
          setFeedback({ type: 'success', message: `Alerta "${target.alertname}" reconocida.` });
          setAckTarget(null);
        },
        onError: () => {
          setFeedback({ type: 'error', message: 'No se pudo reconocer la alerta. Probá de nuevo.' });
        },
      },
    );
  }

  const streamIndicator =
    streamMode === 'live'
      ? { className: styles.streamLive, label: 'En vivo' }
      : streamMode === 'polling'
        ? { className: styles.streamPolling, label: 'Actualización cada 15s' }
        : { className: styles.streamConnecting, label: 'Conectando…' };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Alertas NOC</h1>
          <span className={`${styles.streamBadge} ${streamIndicator.className}`}>
            <span className={styles.dot} aria-hidden="true" />
            {streamIndicator.label}
          </span>
        </div>
        <div className={styles.headerActions}>
          {/* change `noc-alerts-config`, Fase F FE — entrada a /admin/alerts/config. Visible si
              el usuario puede ver AL MENOS una sección de esa página (flags / umbrales /
              auditoría) — evitar un link muerto que solo lleva a "sin permiso" en todas partes. */}
          <Can permissions={['admin.flags', 'monitoring.manage', 'admin.view_activity_log']} mode="any">
            <Link to="/admin/alerts/config" className={styles.configLink}>
              Configuración
            </Link>
          </Can>
          <button type="button" className={styles.refreshBtn} onClick={() => list.refetch()}>
            Actualizar
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess}
        >
          {feedback.message}
        </div>
      )}

      <AlertsSummary
        isLoading={list.isLoading}
        isError={list.isError}
        hasData={hasData}
        activeAlerts={activeAlerts}
        engaged={filterState.engaged}
        onToggleSeverity={toggleSeverityFilter}
        onToggleAlertname={toggleAlertnameFilter}
      />

      <div className={styles.filters}>
        <Select
          label="Fuente"
          value={filters.source}
          onChange={(v) => dispatchFilters({ type: 'patch', patch: { source: v } })}
          options={KNOWN_SOURCES}
        />
        <Select
          label="Severidad"
          value={filters.severity}
          onChange={(v) =>
            dispatchFilters({ type: 'patch', patch: { severity: v as NocAlertFilterState['severity'] } })
          }
          options={SEVERITY_OPTIONS}
        />
        <Select
          label="Estado"
          value={filters.status}
          onChange={(v) =>
            dispatchFilters({ type: 'patch', patch: { status: v as NocAlertFilterState['status'] } })
          }
          options={STATUS_OPTIONS}
        />
        {/* `alertname` no tiene <Select> propio (no vale la pena un dropdown con
            decenas de valores) — se setea desde los tiles del resumen; este chip
            es la única forma de verlo/quitarlo sin pasar por "Limpiar filtros". */}
        {filters.alertname !== '' && (
          <button
            type="button"
            className={styles.typeChip}
            onClick={() => dispatchFilters({ type: 'clearAlertname' })}
            aria-label={`Quitar filtro de tipo: ${filters.alertname}`}
          >
            Tipo: {filters.alertname}
            <span aria-hidden="true"> ✕</span>
          </button>
        )}
        {filtersActive && (
          <button type="button" className={styles.clearBtn} onClick={() => dispatchFilters({ type: 'reset' })}>
            Limpiar filtros
          </button>
        )}
      </div>

      <p className={styles.count} aria-live="polite">
        {filteredAlerts.length} alerta{filteredAlerts.length === 1 ? '' : 's'} visible
        {filteredAlerts.length === 1 ? '' : 's'}
      </p>

      {list.isLoading ? (
        <AlertsSkeleton />
      ) : list.isError ? (
        <div className={styles.errorState} role="alert">
          <p>No se pudieron cargar las alertas.</p>
          <button type="button" className={styles.retryBtn} onClick={() => list.refetch()}>
            Reintentar
          </button>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className={styles.emptyState}>
          {/* MEDIO-3 (2ª review adversarial): B13 arregló el RESUMEN y dejó la
              LISTA afirmando "No hay alertas activas en este momento." con
              `data === undefined` — o sea, declarando la red sana por AUSENCIA
              de datos, que es exactamente lo que B13 declaró peligroso en un
              panel NOC. `hasData` va PRIMERO: sin datos no se afirma nada, ni
              "no hay alertas" ni "ninguna coincide con los filtros" (esa
              segunda también es una afirmación sobre datos que no llegaron). */}
          {!hasData ? (
            <p>Sin datos para mostrar.</p>
          ) : filtersActive ? (
            <>
              <p>Ninguna alerta coincide con los filtros elegidos.</p>
              <button type="button" className={styles.clearBtn} onClick={() => dispatchFilters({ type: 'reset' })}>
                Limpiar filtros
              </button>
            </>
          ) : (
            <p>No hay alertas activas en este momento.</p>
          )}
        </div>
      ) : (
        <ul className={styles.list} role="list" aria-label="Lista de alertas">
          {filteredAlerts.map((alert) => (
            <li
              key={alert.id}
              className={styles.card}
              data-entering={enteringIds.has(alert.id) || undefined}
            >
              <div className={styles.cardHeader}>
                <SeverityBadge severity={alert.severity} />
                <StatusBadge status={alert.status} />
                <span className={styles.time} title={formatDateTimeShort(alert.startsAt)}>
                  {formatRelative(alert.startsAt)}
                </span>
              </div>
              <p className={styles.alertName}>{alert.alertname}</p>
              <p className={styles.entity}>
                {alert.entityType} · {alert.entityName}
              </p>
              <p className={styles.message}>{alert.message}</p>
              {alert.metricName && (
                <p className={styles.metric}>
                  {alert.metricName}: {alert.metricValue}
                  {alert.metricUnit ?? ''}
                  {alert.threshold !== null ? ` (umbral ${alert.threshold}${alert.metricUnit ?? ''})` : ''}
                </p>
              )}
              <div className={styles.cardFooter}>
                <span className={styles.source}>{alert.source}</span>
                {alert.acknowledged ? (
                  <span className={styles.ackInfo}>
                    Reconocida por {alert.ackBy}
                    {alert.ackAt ? ` · ${formatRelative(alert.ackAt)}` : ''}
                  </span>
                ) : (
                  <Can permission="monitoring.acknowledge_alert">
                    <button
                      type="button"
                      className={styles.ackBtn}
                      onClick={() => setAckTarget(alert)}
                      aria-label={`Reconocer alerta ${alert.alertname}`}
                    >
                      Reconocer
                    </button>
                  </Can>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={!!ackTarget}
        title="Reconocer alerta"
        message={
          ackTarget
            ? `Vas a marcar "${ackTarget.alertname}" (${ackTarget.entityName}) como reconocida. El equipo va a asumir que alguien ya la está atendiendo.`
            : ''
        }
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        busy={ack.isPending}
        onConfirm={handleConfirmAck}
        onCancel={() => setAckTarget(null)}
      />
    </div>
  );
}
