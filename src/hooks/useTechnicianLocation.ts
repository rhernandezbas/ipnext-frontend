import { useQuery } from '@tanstack/react-query';
import { technicianLocationApi } from '@/api/technicianLocation.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { SuspiciousClosuresQuery } from '@/types/technicianLocation';

/**
 * Hooks del módulo de ubicación/auditoría de cuadrillas (`iclass-gps-audit`).
 *
 * Permisos (claves EXACTAS del `/me`, punto en el recurso + guion bajo en la acción):
 *   `technicians.location_read`  → mapa en vivo + jornada de HOY/AYER
 *   `technicians.location_audit` → auditoría por OS, pre-filtro y jornada HISTÓRICA
 *
 * Todo query va con `enabled` atado al permiso: sin eso, un usuario de despacho
 * dispara 403 en loop contra endpoints que jamás va a poder leer.
 */

export const TECHNICIANS_LIVE_QUERY_KEY = ['technicians', 'location', 'live'] as const;

export const PERM_LOCATION_READ = 'technicians.location_read';
export const PERM_LOCATION_AUDIT = 'technicians.location_audit';

/**
 * Días hacia atrás que alcanza el permiso OPERATIVO. Espejo de
 * `OPERATIONAL_JOURNEY_DAYS` en `technicianLocation.routes.ts` del backend.
 */
export const OPERATIONAL_JOURNEY_DAYS = 1;

/**
 * Meses que el rastro PROPIO se conserva. Espejo de `DEFAULT_RETENTION_MONTHS` en
 * `IngestTeamLocations.ts` del backend.
 *
 * OJO: esto NO es un límite de permiso, y confundirlo con uno ya nos costó una nota
 * falsa. Son dos cosas independientes:
 *
 *  · el GATE (`OPERATIONAL_JOURNEY_DAYS`) decide qué permiso exige un día. No mira
 *    la antigüedad más allá de eso: con `technicians.location_audit` cualquier día
 *    pasado pasa el gate y el BE responde 200.
 *  · la RETENCIÓN decide hasta dónde existe el dato. `IngestTeamLocations` corre
 *    `repo.purgeOlderThan(now - 12 meses)` en CADA ingest y
 *    `PrismaTeamLocationRepository.purgeOlderThan` hace `deleteMany`: borrado DURO.
 *    `GetTeamDailyJourney` lee esa misma tabla y no tiene fallback a IClass (que
 *    retiene ~30 días rolling).
 *
 * Resultado: más atrás de la ventana el BE contesta 200 con `pointCount: 0`, y ese
 * vacío es INDISTINGUIBLE de "la cuadrilla no registró nada". Por eso el FE lo tiene
 * que poder nombrar.
 */
export const JOURNEY_RETENTION_MONTHS = 12;

const MS_PER_DAY = 86_400_000;

/**
 * ¿La jornada de `day` exige `technicians.location_audit`?
 *
 * El backend sirve hoy/ayer con el permiso operativo y cualquier día anterior con
 * el de auditoría — porque `/live` entrega el roster completo y, sin ese corte, un
 * usuario de despacho podía iterar 365 días por persona y reconstruir los horarios
 * de entrada y salida de cada empleado durante un año.
 *
 * Fail-closed: un `day` que no parsea se trata como histórico.
 *
 * @param day      día pedido, "yyyy-MM-dd" (calendario argentino)
 * @param todayAr  hoy en calendario argentino, "yyyy-MM-dd" (usar `toArIsoDate(new Date())`)
 */
export function journeyRequiresAudit(day: string, todayAr: string): boolean {
  const asked = Date.parse(`${day}T00:00:00.000Z`);
  const today = Date.parse(`${todayAr}T00:00:00.000Z`);
  if (Number.isNaN(asked) || Number.isNaN(today)) return true;
  const daysBack = Math.round((today - asked) / MS_PER_DAY);
  return daysBack > OPERATIONAL_JOURNEY_DAYS;
}

/**
 * ¿`day` cae DESPUÉS de hoy?
 *
 * Espejo del `400 day no puede ser una fecha futura` de
 * `technicianLocation.routes.ts`. `journeyRequiresAudit` no lo cubre: para un
 * día futuro `daysBack` es negativo, así que devuelve `false` y el query salía,
 * comía el 400 y la pantalla mostraba "No se pudo cargar la jornada" con un
 * Reintentar que no podía funcionar NUNCA — el mismo patrón que el manejo del
 * 403 vino a matar.
 *
 * Un día que no parsea devuelve `false` a propósito: de ese caso ya se ocupa el
 * fail-closed de `journeyRequiresAudit`, y marcarlo como "futuro" pintaría el
 * mensaje equivocado.
 */
export function isFutureDay(day: string, todayAr: string): boolean {
  const asked = Date.parse(`${day}T00:00:00.000Z`);
  const today = Date.parse(`${todayAr}T00:00:00.000Z`);
  if (Number.isNaN(asked) || Number.isNaN(today)) return false;
  return asked > today;
}

/**
 * ¿`day` quedó ATRÁS del horizonte de retención, o sea el dato ya se borró?
 *
 * NO es una guarda: el query sale igual y el BE responde 200. Sirve sólo para que el
 * panel pueda decir POR QUÉ está vacío. Un día purgado vuelve con `pointCount: 0`
 * exactamente igual que un día sin actividad, y ofrecer ahí "la app pudo estar
 * cerrada o el teléfono sin señal" son dos hipótesis sobre la CONDUCTA de una
 * persona para un hueco que produjo una política de borrado.
 *
 * Dos decisiones deliberadas:
 *
 *  · **Fail-OPEN.** Un día que no parsea devuelve `false`. Afirmar "el dato se borró"
 *    sobre un día que no se pudo ubicar en el calendario sería inventar una causa —
 *    justo el defecto que esto viene a matar. Mismo criterio que `isFutureDay`.
 *  · **El día del corte NO cuenta como purgado.** El cutoff del BE lleva hora, así que
 *    ese día está purgado A MEDIAS. Se compara `<` estricto para no afirmar de más.
 *
 * @param day      día pedido, "yyyy-MM-dd" (calendario argentino)
 * @param todayAr  hoy en calendario argentino, "yyyy-MM-dd"
 */
export function isBeyondJourneyRetention(day: string, todayAr: string): boolean {
  const asked = Date.parse(`${day}T00:00:00.000Z`);
  const today = Date.parse(`${todayAr}T00:00:00.000Z`);
  if (Number.isNaN(asked) || Number.isNaN(today)) return false;

  const ref = new Date(today);
  const month = ref.getUTCMonth() - JOURNEY_RETENTION_MONTHS;
  const targetYear = ref.getUTCFullYear() + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;

  /**
   * El día se acota al último día REAL del mes destino antes de armar la fecha
   * (hallazgo 4.4 del BE, de este lado). Restarle 12 meses a un 29 de febrero da
   * "29 de febrero" de un año no bisiesto, que JS normaliza al 1 de marzo: un corte
   * en el FUTURO del pretendido, que declararía "ya se borró" días que el BE
   * todavía tiene y sirve.
   */
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const cutoff = Date.UTC(
    targetYear,
    targetMonth,
    Math.min(ref.getUTCDate(), lastDayOfTargetMonth),
  );

  return asked < cutoff;
}

/**
 * Estado en vivo de todas las cuadrillas.
 * `refetchInterval` de 60 s: es un tablero de despacho, no una foto.
 */
export function useTeamsLive() {
  const { can } = useMyPermissions();
  return useQuery({
    queryKey: TECHNICIANS_LIVE_QUERY_KEY,
    queryFn: technicianLocationApi.live,
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: can(PERM_LOCATION_READ),
  });
}

/**
 * Jornada de una cuadrilla en un día argentino.
 *
 * Se deshabilita sola si falta el login, el día, el permiso que ese día exige, o
 * si el día es futuro. Las dos últimas guardas son la misma idea: no salir a
 * comerse un rechazo que ya sabemos que va a llegar (403 y 400 respectivamente).
 * Un error de request se presenta como falla técnica con botón de reintento, y
 * ninguno de los dos casos se arregla reintentando.
 */
export function useTeamJourney(login: string | null, day: string, todayAr: string) {
  const { can } = useMyPermissions();
  const needsAudit = journeyRequiresAudit(day, todayAr);
  const allowed = needsAudit ? can(PERM_LOCATION_AUDIT) : can(PERM_LOCATION_READ);

  return useQuery({
    queryKey: ['technicians', 'location', 'journey', login, day],
    queryFn: () => technicianLocationApi.journey(login as string, day),
    staleTime: 60_000,
    enabled: Boolean(login) && Boolean(day) && !isFutureDay(day, todayAr) && allowed,
  });
}

/** Veredicto de presencia para UNA orden de servicio. */
export function useServiceOrderPresenceAudit(code: string | null) {
  const { can } = useMyPermissions();
  return useQuery({
    queryKey: ['technicians', 'location', 'audit', 'service-order', code],
    queryFn: () => technicianLocationApi.auditServiceOrder(code as string),
    staleTime: 5 * 60_000,
    enabled: Boolean(code) && can(PERM_LOCATION_AUDIT),
  });
}

/**
 * Pre-filtro temporal de cierres. Devuelve CANDIDATOS a revisar y el umbral que
 * aplicó el servidor.
 *
 * `enabled` incluye `valid`: el barrido corre un `getServiceOrderHistory` por orden
 * EN SERIE contra IClass — pedirlo con un rango inválido es plata tirada y presión
 * innecesaria sobre una API que también atiende el closure loop.
 *
 * ── `retry: false` — por qué esta query se sale del default global ────────────
 * `main.tsx` pone `retry: 1` para todo, que es lo correcto para una request barata
 * que puede haber pegado contra un blip de red. Ésta no es barata: son decenas de
 * llamadas en serie contra IClass. Medido en producción con el default viejo de 7
 * días, el 504 se reintentaba y daba OTRO 504: ~2 minutos de spinner para terminar
 * en error, y un segundo barrido lanzado sobre IClass mientras el primero podía
 * seguir corriendo del lado del servidor.
 *
 * Reintentar automáticamente un timeout de una operación cara sólo duplica la
 * espera y la carga. El reintento acá lo decide una persona (el botón "Reintentar"
 * del panel), que puede achicar el rango antes de volver a pedir.
 */
export function useSuspiciousClosures(query: SuspiciousClosuresQuery, valid: boolean) {
  const { can } = useMyPermissions();
  return useQuery({
    queryKey: [
      'technicians',
      'location',
      'audit',
      'suspicious-closures',
      query.from,
      query.to,
      query.thresholdMinutes ?? null,
    ],
    queryFn: () => technicianLocationApi.suspiciousClosures(query),
    staleTime: 5 * 60_000,
    retry: false,
    enabled: valid && can(PERM_LOCATION_AUDIT),
  });
}
