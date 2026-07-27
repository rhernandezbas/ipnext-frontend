/**
 * useArToday — el "hoy" argentino tiene que estar VIVO.
 *
 * El mapa de cuadrillas es una pantalla que queda abierta con poll de 60 s. Si
 * `hoy` se congela en un `useMemo(..., [])` del primer render, pasada la
 * medianoche el FE cree que un día que ya es anteayer sigue alcanzado por
 * `technicians.location_read` → pide la jornada y come un 403 que además se
 * presenta como falla técnica.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { previousIsoDay, useArToday } from '@/hooks/useArToday';

afterEach(() => {
  vi.useRealTimers();
  // `previousIsoDay` se testea con el huso del proceso pisado (ver el último
  // caso): sin este restore, el TZ se filtra a los tests que corran después en
  // el mismo worker.
  vi.unstubAllEnvs();
});

describe('useArToday', () => {
  it('arranca en el día argentino actual', () => {
    vi.useFakeTimers();
    // 23:59:00 ART del 26 (ART = UTC-3, sin DST).
    vi.setSystemTime(new Date('2026-07-27T02:59:00.000Z'));

    const { result } = renderHook(() => useArToday());
    expect(result.current).toBe('2026-07-26');
  });

  it('cambia de día solo pasada la medianoche argentina', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T02:59:00.000Z'));

    const { result } = renderHook(() => useArToday());
    expect(result.current).toBe('2026-07-26');

    // 23:59:30 ART — todavía es el 26.
    act(() => {
      vi.setSystemTime(new Date('2026-07-27T02:59:30.000Z'));
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe('2026-07-26');

    // 00:00:30 ART del 27 — el día vivo se movió.
    act(() => {
      vi.setSystemTime(new Date('2026-07-27T03:00:30.000Z'));
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe('2026-07-27');
  });

  it('mantiene la MISMA referencia mientras el día no cambia', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T15:00:00.000Z'));

    const { result } = renderHook(() => useArToday());
    const first = result.current;

    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(result.current).toBe(first);
  });

  it('limpia su intervalo al desmontar', () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useArToday());
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

/**
 * previousIsoDay — de acá sale el `min` del selector de día cuando el usuario NO
 * tiene `technicians.location_audit`. Si se corre un día, o el operador pierde
 * el ayer que sí le corresponde, o se le abre un día histórico que el BE le va a
 * negar con un 403. La aritmética va en UTC sobre el string a propósito: en un
 * host que no sea AR, restar un día con `Date` local puede correrse.
 */
describe('previousIsoDay', () => {
  it('resta un día dentro del mismo mes', () => {
    expect(previousIsoDay('2026-07-26')).toBe('2026-07-25');
  });

  it('cruza el borde de mes', () => {
    expect(previousIsoDay('2026-07-01')).toBe('2026-06-30');
  });

  it('cruza el borde de año', () => {
    expect(previousIsoDay('2026-01-01')).toBe('2025-12-31');
  });

  it('respeta el 29 de febrero de un año bisiesto', () => {
    expect(previousIsoDay('2024-03-01')).toBe('2024-02-29');
  });

  it('en un año NO bisiesto el 1 de marzo cae al 28', () => {
    expect(previousIsoDay('2025-03-01')).toBe('2025-02-28');
  });

  it('un día que no parsea devuelve "" y no una fecha inventada', () => {
    expect(previousIsoDay('')).toBe('');
    expect(previousIsoDay('no-es-fecha')).toBe('');
    expect(previousIsoDay('2026-13-45')).toBe('');
  });

  /**
   * La aritmética UTC no es decoración: los 6 casos de arriba son de CALENDARIO
   * (bordes de mes, de año, bisiesto) y pasan igual con `setDate` local, así que
   * cambiar `setUTCDate` por `setDate` SOBREVIVÍA en verde. El huso del host es
   * lo único que los distingue.
   *
   * Caso: `TZ=Europe/Berlin`, día `2026-10-26`.
   *   `new Date('2026-10-26T00:00:00.000Z')` = 26-oct 01:00 CET en Berlín.
   *   `setDate(getDate() - 1)` → 25-oct 01:00 LOCAL, que todavía es CEST (UTC+2)
   *   porque el fall-back de DST ocurre a las 03:00 de ese mismo día → 24-oct
   *   23:00 UTC → `toISOString()` devuelve "2026-10-24": un día de más.
   *   `setUTCDate` devuelve "2026-10-25", que es la respuesta.
   *
   * De acá sale el `min` del selector cuando el usuario NO puede auditar: correr
   * un día le abre una fecha que el BE le va a negar con un 403 presentado como
   * falla técnica, o le tapa el ayer que sí le corresponde.
   */
  it('la aritmética va en UTC: un huso con DST no puede correr el día', () => {
    // `vi.stubEnv('TZ', …)` cambia el huso del proceso en caliente (Node ≥ 13 le
    // notifica el cambio a V8) y el `afterEach` lo restaura, así que no se
    // contamina el resto del worker.
    vi.stubEnv('TZ', 'Europe/Berlin');
    expect(previousIsoDay('2026-10-26')).toBe('2026-10-25');
    // El día del fall-back propiamente dicho, y el del spring-forward.
    expect(previousIsoDay('2026-10-25')).toBe('2026-10-24');
    expect(previousIsoDay('2026-03-29')).toBe('2026-03-28');

    // Un huso al este del meridiano tampoco corre el día hacia adelante.
    vi.stubEnv('TZ', 'Pacific/Auckland');
    expect(previousIsoDay('2026-04-05')).toBe('2026-04-04');
    expect(previousIsoDay('2026-09-27')).toBe('2026-09-26');
  });
});
