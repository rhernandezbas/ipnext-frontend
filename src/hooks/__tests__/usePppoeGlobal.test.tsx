/**
 * Tests — Phase 5: API + hooks globales de PPPoE.
 *
 * Verifica:
 *   - useAllPppoe pasa includeUnassigned al filter
 *   - useCreatePppoeStandalone llama createStandalone e invalida ['pppoe','list']
 *   - useRenamePppoe llama rename(id, newUsername) e invalida ['pppoe','list']
 *   - useUpdatePppoeGlobal llama update e invalida ['pppoe','list']
 *   - useMovePppoeGlobal llama move e invalida ['pppoe','list']
 *   - useDeactivatePppoeGlobal llama deactivate e invalida ['pppoe','list']
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── mock pppoeApi ─────────────────────────────────────────────────────────────
vi.mock('@/api/pppoe.api', () => ({
  pppoeApi: {
    list: vi.fn(),
    createStandalone: vi.fn(),
    rename: vi.fn(),
    update: vi.fn(),
    move: vi.fn(),
    deactivate: vi.fn(),
    credentials: vi.fn(),
    activationHistory: vi.fn(),
    activationOperators: vi.fn(),
    preview: vi.fn(),
    startBulk: vi.fn(),
    getBatch: vi.fn(),
    enforce: vi.fn(),
    listByContract: vi.fn(),
    create: vi.fn(),
    listUnassigned: vi.fn(),
    associate: vi.fn(),
    deassociate: vi.fn(),
    getCallerId: vi.fn(),
  },
}));

import { pppoeApi } from '@/api/pppoe.api';
import { useAllPppoe } from '@/hooks/useInternetServices';
import {
  useCreatePppoeStandalone,
  useRenamePppoe,
  useUpdatePppoeGlobal,
  useMovePppoeGlobal,
  useDeactivatePppoeGlobal,
} from '@/hooks/usePppoe';
import type { PppoeServiceListResult } from '@/types/internetService';
import type { PppoeServiceDto } from '@/types/pppoe';

// ── fixtures ──────────────────────────────────────────────────────────────────
const MOCK_LIST: PppoeServiceListResult = { data: [], total: 42, page: 1, limit: 25 };

const MOCK_DTO: PppoeServiceDto = {
  id: 'pppoe-1',
  username: 'cliente01',
  profile: 'IP-5M',
  remoteAddress: '10.0.0.1',
  status: 'active',
  enforcedState: 'active',
  nasId: 'nas-1',
  contractId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ipMode: 'pool',
  ipTypePreference: 'cgnat',
};

// ── wrapper factory ───────────────────────────────────────────────────────────
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function wrapperWithSpy(qc: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => vi.clearAllMocks());

// ── useAllPppoe + includeUnassigned ───────────────────────────────────────────
describe('useAllPppoe — includeUnassigned', () => {
  it('pasa includeUnassigned: true al filter cuando se especifica', async () => {
    vi.mocked(pppoeApi.list).mockResolvedValue(MOCK_LIST);

    const { result } = renderHook(
      () => useAllPppoe({ includeUnassigned: true, limit: 1 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(pppoeApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ includeUnassigned: true, limit: 1 }),
    );
  });

  it('retorna el total del resultado paginado', async () => {
    vi.mocked(pppoeApi.list).mockResolvedValue(MOCK_LIST);

    const { result } = renderHook(
      () => useAllPppoe({ includeUnassigned: true, limit: 1 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(42);
  });

  it('no pasa includeUnassigned cuando el filtro no lo incluye', async () => {
    vi.mocked(pppoeApi.list).mockResolvedValue(MOCK_LIST);

    const { result } = renderHook(
      () => useAllPppoe({ status: 'active' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callArg = vi.mocked(pppoeApi.list).mock.calls[0][0];
    expect(callArg).not.toHaveProperty('includeUnassigned');
  });
});

// ── useCreatePppoeStandalone ──────────────────────────────────────────────────
describe('useCreatePppoeStandalone', () => {
  it('llama a pppoeApi.createStandalone con el body correcto', async () => {
    vi.mocked(pppoeApi.createStandalone).mockResolvedValue(MOCK_DTO);

    const { result } = renderHook(() => useCreatePppoeStandalone(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        username: 'nuevo01',
        password: 'pass123',
        nasId: 'nas-1',
        plan: 'IP-5M',
        ipTypePreference: 'cgnat',
      });
    });

    expect(pppoeApi.createStandalone).toHaveBeenCalledWith({
      username: 'nuevo01',
      password: 'pass123',
      nasId: 'nas-1',
      plan: 'IP-5M',
      ipTypePreference: 'cgnat',
    });
  });

  it('invalida la query key ["pppoe","list"] en éxito', async () => {
    vi.mocked(pppoeApi.createStandalone).mockResolvedValue(MOCK_DTO);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreatePppoeStandalone(), {
      wrapper: wrapperWithSpy(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        username: 'x', password: 'y', nasId: 'n', plan: 'p', ipTypePreference: 'cgnat',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['pppoe', 'list'] }),
    );
  });
});

// ── useRenamePppoe ────────────────────────────────────────────────────────────
describe('useRenamePppoe', () => {
  it('llama a pppoeApi.rename con id y newUsername', async () => {
    vi.mocked(pppoeApi.rename).mockResolvedValue({ id: 'pppoe-1', username: 'nuevo01', status: 'ok' });

    const { result } = renderHook(() => useRenamePppoe(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1', newUsername: 'nuevo01' });
    });

    expect(pppoeApi.rename).toHaveBeenCalledWith('pppoe-1', 'nuevo01');
  });

  it('invalida ["pppoe","list"] en éxito', async () => {
    vi.mocked(pppoeApi.rename).mockResolvedValue({ id: 'pppoe-1', username: 'nuevo01', status: 'ok' });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useRenamePppoe(), { wrapper: wrapperWithSpy(qc) });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1', newUsername: 'nuevo01' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['pppoe', 'list'] }),
    );
  });

  it('propaga resultado partial sin lanzar error', async () => {
    const partialResult = { id: 'pppoe-1', username: 'nuevo01', status: 'partial' as const, message: 'El secret viejo no pudo eliminarse' };
    vi.mocked(pppoeApi.rename).mockResolvedValue(partialResult);

    const { result } = renderHook(() => useRenamePppoe(), { wrapper });

    let out: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      out = await result.current.mutateAsync({ id: 'pppoe-1', newUsername: 'nuevo01' });
    });

    expect(out?.status).toBe('partial');
    expect(out?.message).toBeTruthy();
  });
});

// ── useUpdatePppoeGlobal ──────────────────────────────────────────────────────
describe('useUpdatePppoeGlobal', () => {
  it('llama a pppoeApi.update con id y body', async () => {
    vi.mocked(pppoeApi.update).mockResolvedValue(MOCK_DTO);

    const { result } = renderHook(() => useUpdatePppoeGlobal(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1', body: { profile: 'IP-10M' } });
    });

    expect(pppoeApi.update).toHaveBeenCalledWith('pppoe-1', { profile: 'IP-10M' });
  });

  it('invalida ["pppoe","list"] en éxito', async () => {
    vi.mocked(pppoeApi.update).mockResolvedValue(MOCK_DTO);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdatePppoeGlobal(), { wrapper: wrapperWithSpy(qc) });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1', body: { profile: 'IP-10M' } });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['pppoe', 'list'] }),
    );
  });
});

// ── useMovePppoeGlobal ────────────────────────────────────────────────────────
describe('useMovePppoeGlobal', () => {
  it('llama a pppoeApi.move con id y nasId (sin force en el primer intento)', async () => {
    vi.mocked(pppoeApi.move).mockResolvedValue(MOCK_DTO);

    const { result } = renderHook(() => useMovePppoeGlobal(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1', nasId: 'nas-2' });
    });

    // pppoe-move-nas W1: move acepta force opcional; sin force viaja undefined
    // (el api client OMITE la clave del body — cubierto en pppoeNasMove.api.test).
    expect(pppoeApi.move).toHaveBeenCalledWith('pppoe-1', 'nas-2', undefined);
  });

  it('pasa force: true a pppoeApi.move en el reintento forzado (S9.3)', async () => {
    vi.mocked(pppoeApi.move).mockResolvedValue(MOCK_DTO);

    const { result } = renderHook(() => useMovePppoeGlobal(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1', nasId: 'nas-2', force: true });
    });

    expect(pppoeApi.move).toHaveBeenCalledWith('pppoe-1', 'nas-2', true);
  });

  it('invalida ["pppoe","list"] en éxito', async () => {
    vi.mocked(pppoeApi.move).mockResolvedValue(MOCK_DTO);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useMovePppoeGlobal(), { wrapper: wrapperWithSpy(qc) });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1', nasId: 'nas-2' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['pppoe', 'list'] }),
    );
  });
});

// ── useDeactivatePppoeGlobal ──────────────────────────────────────────────────
describe('useDeactivatePppoeGlobal', () => {
  it('llama a pppoeApi.deactivate con id y reason', async () => {
    vi.mocked(pppoeApi.deactivate).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeactivatePppoeGlobal(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1', reason: 'baja voluntaria' });
    });

    expect(pppoeApi.deactivate).toHaveBeenCalledWith('pppoe-1', 'baja voluntaria');
  });

  it('llama a pppoeApi.deactivate sin reason cuando no se pasa', async () => {
    vi.mocked(pppoeApi.deactivate).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeactivatePppoeGlobal(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1' });
    });

    expect(pppoeApi.deactivate).toHaveBeenCalledWith('pppoe-1', undefined);
  });

  it('invalida ["pppoe","list"] en éxito', async () => {
    vi.mocked(pppoeApi.deactivate).mockResolvedValue(undefined);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDeactivatePppoeGlobal(), { wrapper: wrapperWithSpy(qc) });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['pppoe', 'list'] }),
    );
  });
});
