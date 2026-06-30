import { useQuery } from '@tanstack/react-query';
import { getRadiusAuthFailures } from '@/api/networkAudit.api';
import type { RadiusAuthFailuresParams } from '@/api/networkAudit.api';
import type { RelativeRange } from '@/types/networkAudit';

/** Intervalo del auto-refresh (ms). Sólo aplica con el toggle en ON. */
export const AUTO_REFRESH_INTERVAL_MS = 30_000;

/** Ancho de cada preset relativo en milisegundos. */
export const RELATIVE_RANGE_MS: Record<RelativeRange, number> = {
  '5m': 5 * 60_000,
  '1h': 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
};

/** Keys válidas de preset, derivadas de la FUENTE ÚNICA `RELATIVE_RANGE_MS`. */
const RELATIVE_RANGE_KEYS = Object.keys(RELATIVE_RANGE_MS) as RelativeRange[];

/**
 * Type-guard: ¿`v` es uno de los presets relativos válidos (`5m|1h|24h|7d`)?
 * El set de keys se deriva de `RELATIVE_RANGE_MS`, así que agregar un preset al
 * map lo habilita acá automáticamente (sin duplicar la lista). Lo usa el
 * filter-hook para DESCARTAR basura de la URL (`?auth_range=5min`) antes de que
 * llegue a la queryFn y reviente con RangeError (`new Date(NaN).toISOString()`).
 */
export function isRelativeRange(v: string | null | undefined): v is RelativeRange {
  return v != null && (RELATIVE_RANGE_KEYS as string[]).includes(v);
}

export interface UseRadiusAuthFailuresOptions extends RadiusAuthFailuresParams {
  /**
   * Preset de rango RELATIVO. Si está seteado, el hook IGNORA `from`/`to` y calcula
   * `from = now - RELATIVE_RANGE_MS[preset]` recién en la queryFn (ventana deslizante).
   */
  relativeRange?: RelativeRange;
  /** Si true, refetch cada AUTO_REFRESH_INTERVAL_MS (sólo con la pestaña visible). */
  autoRefresh?: boolean;
}

export function useRadiusAuthFailures(options: UseRadiusAuthFailuresOptions) {
  const { relativeRange, autoRefresh, ...params } = options;

  return useQuery({
    // El queryKey lleva el PRESET (no el `from` calculado) → estable en el tiempo:
    // el auto-refresh desliza la ventana sin invalidar el cache (sin refetch-storm).
    // `autoRefresh` NO va en el key: es comportamiento, no un filtro de datos.
    queryKey: ['radius-auth-failures', { ...params, relativeRange }],
    queryFn: () => {
      // Guard defensivo: si llegara un preset fuera de RELATIVE_RANGE_MS (valor
      // raro por otra vía), `ms` es undefined → caemos al modo absoluto en lugar
      // de tirar RangeError por `new Date(NaN).toISOString()`.
      const ms = relativeRange ? RELATIVE_RANGE_MS[relativeRange] : undefined;
      const effectiveParams: RadiusAuthFailuresParams = ms
        ? {
            ...params,
            from: new Date(Date.now() - ms).toISOString(),
            to: undefined,
          }
        : params;
      return getRadiusAuthFailures(effectiveParams);
    },
    // refetchIntervalInBackground se deja en false (default) → sólo refresca con la
    // pestaña visible.
    refetchInterval: autoRefresh ? AUTO_REFRESH_INTERVAL_MS : false,
  });
}
