/**
 * useSuspiciousClosures — un barrido que agotó el timeout NO se reintenta solo.
 *
 * Medido contra producción: con el default de 7 días el endpoint devolvía 504, el
 * `retry: 1` global de `main.tsx` disparaba OTRO barrido idéntico, ése también moría
 * en 504, y el auditor esperaba ~2 MINUTOS de spinner para terminar en un error.
 *
 * Reintentar acá es peor que inútil en las dos direcciones:
 *  · para el usuario, duplica la espera antes de darle la mala noticia;
 *  · para IClass, larga un segundo barrido en serie mientras el primero puede seguir
 *    corriendo del lado del servidor — sobre la misma API que atiende el closure loop
 *    y la creación de OS.
 *
 * El reintento acá lo decide una persona (el botón "Reintentar" del panel), que ya
 * sabe lo que cuesta y puede achicar el rango antes de volver a pedir.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/technicianLocation.api', () => ({
  technicianLocationApi: {
    live: vi.fn(),
    journey: vi.fn(),
    auditServiceOrder: vi.fn(),
    suspiciousClosures: vi.fn(),
  },
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(() => true),
}));

import { technicianLocationApi } from '@/api/technicianLocation.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { useSuspiciousClosures } from '@/hooks/useTechnicianLocation';

const QUERY = { from: '2026-07-26', to: '2026-07-26', thresholdMinutes: 5 };

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

let qc: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  // MISMO default que `main.tsx`. Si el test lo pusiera en `false`, no probaría nada:
  // pasaría con o sin el override del hook.
  qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: ['technicians.location_audit'],
    isLoading: false,
    isError: false,
    can: () => true,
  } as unknown as UseMyPermissionsResult);
});

describe('useSuspiciousClosures', () => {
  it('un barrido que falla NO se reintenta: una sola pasada contra IClass', async () => {
    vi.mocked(technicianLocationApi.suspiciousClosures).mockRejectedValue(
      new Error('504 Gateway Timeout'),
    );

    const { result } = renderHook(() => useSuspiciousClosures(QUERY, true), {
      wrapper: wrapper(qc),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(technicianLocationApi.suspiciousClosures).toHaveBeenCalledTimes(1);
  });

  it('el camino feliz sigue pidiendo el barrido con el rango dado', async () => {
    vi.mocked(technicianLocationApi.suspiciousClosures).mockResolvedValue({
      candidates: [],
      thresholdMinutes: 5,
    });

    renderHook(() => useSuspiciousClosures(QUERY, true), { wrapper: wrapper(qc) });

    await waitFor(() =>
      expect(technicianLocationApi.suspiciousClosures).toHaveBeenCalledWith(QUERY),
    );
  });

  it('con el rango inválido no sale ninguna request', () => {
    renderHook(() => useSuspiciousClosures(QUERY, false), { wrapper: wrapper(qc) });
    expect(technicianLocationApi.suspiciousClosures).not.toHaveBeenCalled();
  });
});
