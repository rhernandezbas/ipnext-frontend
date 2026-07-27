/**
 * useTeamJourney — el query NO sale cuando ya se sabe que el BE va a rechazarlo.
 *
 * El backend responde 400 a un día futuro y 403 a un día histórico sin
 * `technicians.location_audit`. Ambos llegan al FE como error de una request que
 * nunca debió salir: el 403 ya estaba cubierto por el gate de permiso, el 400 se
 * escapaba porque `journeyRequiresAudit` devuelve `false` para un día futuro
 * (daysBack negativo). Un query que sale para comer un 400 pinta "No se pudo
 * cargar la jornada" + un Reintentar que jamás va a funcionar.
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
import { useTeamJourney } from '@/hooks/useTechnicianLocation';

const TODAY = '2026-07-26';

function mockPerms(perms: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: perms,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const list = Array.isArray(p) ? p : [p];
      return list.some((x) => perms.includes(x));
    },
  } as UseMyPermissionsResult);
}

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

let qc: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockPerms(['technicians.location_read', 'technicians.location_audit']);
  vi.mocked(technicianLocationApi.journey).mockResolvedValue({} as never);
});

describe('useTeamJourney', () => {
  it('pide la jornada de hoy', async () => {
    renderHook(() => useTeamJourney('IPNXDENIC', TODAY, TODAY), { wrapper: wrapper(qc) });
    await waitFor(() => expect(technicianLocationApi.journey).toHaveBeenCalledWith('IPNXDENIC', TODAY));
  });

  it('NO pide un día futuro: el BE responde 400 y el reintento sería humo', async () => {
    const { result } = renderHook(() => useTeamJourney('IPNXDENIC', '2026-07-27', TODAY), {
      wrapper: wrapper(qc),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(technicianLocationApi.journey).not.toHaveBeenCalled();
  });

  it('NO pide un día histórico sin el permiso de auditoría (403 seguro)', async () => {
    mockPerms(['technicians.location_read']);
    const { result } = renderHook(() => useTeamJourney('IPNXDENIC', '2020-01-01', TODAY), {
      wrapper: wrapper(qc),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(technicianLocationApi.journey).not.toHaveBeenCalled();
  });

  it('NO pide nada con el selector de día vacío', async () => {
    const { result } = renderHook(() => useTeamJourney('IPNXDENIC', '', TODAY), {
      wrapper: wrapper(qc),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(technicianLocationApi.journey).not.toHaveBeenCalled();
  });
});
