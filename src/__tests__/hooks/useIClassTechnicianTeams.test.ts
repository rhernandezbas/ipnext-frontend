import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/iclassTechnicianTeams.api', () => ({
  iclassTechnicianTeamsApi: {
    list: vi.fn(),
    setMapping: vi.fn(),
  },
}));

import { iclassTechnicianTeamsApi } from '@/api/iclassTechnicianTeams.api';
import { useIClassTechnicianTeams, useSetTechnicianTeamMapping } from '@/hooks/useIClassTechnicianTeams';

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

function makeQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// ── WARN-4: invalidateQueries after PATCH ────────────────────────────────────

describe('useSetTechnicianTeamMapping', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('invalida la query iclass-technician-teams en onSuccess tras el PATCH', async () => {
    vi.mocked(iclassTechnicianTeamsApi.setMapping).mockResolvedValue({
      userId: 'u1',
      iclassTeamLogin: 'team-b',
    } as never);

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSetTechnicianTeamMapping(), {
      wrapper: createWrapper(qc),
    });

    await act(() => result.current.mutateAsync({ userId: 'u1', iclassTeamLogin: 'team-b' }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['iclass-technician-teams'],
      });
    });
  });

  it('llama a la API con userId y teamLogin correctos', async () => {
    vi.mocked(iclassTechnicianTeamsApi.setMapping).mockResolvedValue({} as never);

    const { result } = renderHook(() => useSetTechnicianTeamMapping(), {
      wrapper: createWrapper(qc),
    });

    await act(() => result.current.mutateAsync({ userId: 'u99', iclassTeamLogin: null }));

    expect(iclassTechnicianTeamsApi.setMapping).toHaveBeenCalledWith('u99', null);
  });
});

describe('useIClassTechnicianTeams', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
    vi.mocked(iclassTechnicianTeamsApi.list).mockResolvedValue([]);
  });

  it('retorna la lista de mapeos técnico→cuadrilla', async () => {
    vi.mocked(iclassTechnicianTeamsApi.list).mockResolvedValue([
      { userId: 'u1', userName: 'Ana', userLogin: 'ana', iclassTeamLogin: 'team-a', teamName: 'Cuadrilla A', teamActive: true },
    ] as never);

    const { result } = renderHook(() => useIClassTechnicianTeams(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].userId).toBe('u1');
  });
});
