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
import { useArToday } from '@/hooks/useArToday';

afterEach(() => {
  vi.useRealTimers();
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
