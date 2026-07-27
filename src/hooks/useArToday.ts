import { useEffect, useState } from 'react';
import { toArIsoDate } from '@/utils/formatDate';

/** Cadencia del chequeo. Mismo orden de magnitud que el poll del mapa (60 s). */
const TICK_MS = 60_000;

/**
 * El día calendario ARGENTINO de hoy ("yyyy-MM-dd"), VIVO.
 *
 * ── Por qué no alcanza `useMemo(() => toArIsoDate(new Date()), [])` ───────────
 * El mapa de cuadrillas es un tablero de despacho: queda abierto durante toda la
 * jornada con un poll de 60 s. Congelar "hoy" en el primer render hace que,
 * pasada la medianoche, el FE siga creyendo que anteayer es "ayer" → habilita la
 * jornada de un día que ya exige `technicians.location_audit`, pide, y come un
 * 403 que además se presenta como falla técnica.
 *
 * El `setState` sólo dispara re-render cuando el string CAMBIA (React bailea con
 * el mismo valor primitivo), así que el tick de 60 s no cuesta renders.
 */
export function useArToday(): string {
  const [today, setToday] = useState(() => toArIsoDate(new Date()));

  useEffect(() => {
    const id = setInterval(() => {
      setToday((prev) => {
        const now = toArIsoDate(new Date());
        return now === prev ? prev : now;
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  return today;
}

/**
 * El día anterior a un "yyyy-MM-dd", sin pasar por husos horarios: la aritmética
 * va en UTC sobre el string, así que no puede correrse un día en un host que no
 * sea AR. Devuelve `''` si el día de entrada no parsea.
 */
export function previousIsoDay(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
