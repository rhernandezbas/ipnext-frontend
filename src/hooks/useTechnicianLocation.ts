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
 * Se deshabilita sola si falta el login, el día, o el permiso que ese día exige.
 */
export function useTeamJourney(login: string | null, day: string, todayAr: string) {
  const { can } = useMyPermissions();
  const needsAudit = journeyRequiresAudit(day, todayAr);
  const allowed = needsAudit ? can(PERM_LOCATION_AUDIT) : can(PERM_LOCATION_READ);

  return useQuery({
    queryKey: ['technicians', 'location', 'journey', login, day],
    queryFn: () => technicianLocationApi.journey(login as string, day),
    staleTime: 60_000,
    enabled: Boolean(login) && Boolean(day) && allowed,
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
    enabled: valid && can(PERM_LOCATION_AUDIT),
  });
}
