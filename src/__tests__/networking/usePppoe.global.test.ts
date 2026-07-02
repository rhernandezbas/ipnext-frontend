/**
 * Tests — F7: todas las mutaciones globales de PPPoE
 * deben invalidar ['pppoe','unassigned'] al tener éxito.
 *
 * Contexto: el picker de adopción en InternetPanel usa la query
 * unassignedKey() para listar PPPoEs sin contrato. Si crear, dar de baja,
 * renombrar, editar o mover un servicio no invalida esa query, el picker
 * muestra datos stale.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  useCreatePppoeStandalone,
  useDeactivatePppoeGlobal,
  useRenamePppoe,
  useUpdatePppoeGlobal,
  useMovePppoeGlobal,
  unassignedKey,
} from '@/hooks/usePppoe';

// ── mock de la API ─────────────────────────────────────────────────────────────
vi.mock('@/api/pppoe.api', () => ({
  pppoeApi: {
    createStandalone: vi.fn().mockResolvedValue({ id: 'pppoe-new', username: 'u1' }),
    deactivate: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue({ id: 'pppoe-1', username: 'nuevo', status: 'ok' }),
    update: vi.fn().mockResolvedValue({ id: 'pppoe-1', username: 'u1' }),
    move: vi.fn().mockResolvedValue({ id: 'pppoe-1', username: 'u1' }),
  },
}));

// ── helpers ───────────────────────────────────────────────────────────────────
function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('usePppoe — F7: invalidación de unassigned', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(qc, 'invalidateQueries');
  });

  it('useCreatePppoeStandalone invalida pppoe/unassigned en éxito', async () => {
    const { result } = renderHook(() => useCreatePppoeStandalone(), {
      wrapper: makeWrapper(qc),
    });

    await result.current.mutateAsync({
      username: 'usuario-nuevo',
      password: 'pass',
      nasId: 'nas-1',
      plan: 'IP-5M',
    });

    await waitFor(() => {
      expect(qc.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: unassignedKey() }),
      );
    });
  });

  it('useDeactivatePppoeGlobal invalida pppoe/unassigned en éxito', async () => {
    const { result } = renderHook(() => useDeactivatePppoeGlobal(), {
      wrapper: makeWrapper(qc),
    });

    await result.current.mutateAsync({ id: 'pppoe-1' });

    await waitFor(() => {
      expect(qc.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: unassignedKey() }),
      );
    });
  });

  it('useRenamePppoe invalida pppoe/unassigned en éxito', async () => {
    const { result } = renderHook(() => useRenamePppoe(), {
      wrapper: makeWrapper(qc),
    });

    await result.current.mutateAsync({ id: 'pppoe-1', newUsername: 'nuevo-usuario' });

    await waitFor(() => {
      expect(qc.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: unassignedKey() }),
      );
    });
  });

  it('useUpdatePppoeGlobal invalida pppoe/unassigned en éxito', async () => {
    const { result } = renderHook(() => useUpdatePppoeGlobal(), {
      wrapper: makeWrapper(qc),
    });

    await result.current.mutateAsync({ id: 'pppoe-1', body: { profile: 'IP-10M' } });

    await waitFor(() => {
      expect(qc.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: unassignedKey() }),
      );
    });
  });

  it('useMovePppoeGlobal invalida pppoe/unassigned en éxito', async () => {
    const { result } = renderHook(() => useMovePppoeGlobal(), {
      wrapper: makeWrapper(qc),
    });

    await result.current.mutateAsync({ id: 'pppoe-1', nasId: 'nas-2' });

    await waitFor(() => {
      expect(qc.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: unassignedKey() }),
      );
    });
  });

  it('useMovePppoeGlobal invalida pppoe-nas-move-events en éxito (el move propio aparece en el tab Movimientos NAS)', async () => {
    // Sin esta invalidación, el staleTime global (5min) deja el tab
    // "Movimientos NAS" stale: tu propio move no aparece hasta 5' después.
    const { result } = renderHook(() => useMovePppoeGlobal(), {
      wrapper: makeWrapper(qc),
    });

    await result.current.mutateAsync({ id: 'pppoe-1', nasId: 'nas-2' });

    await waitFor(() => {
      expect(qc.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['pppoe-nas-move-events'] }),
      );
    });
  });

  it('useMovePppoeGlobal invalida pppoe-nas-move-events también cuando el move FALLA (onSettled: el intento fallido persiste fila en el BE — failed_no_free_ip/failed_orchestrator — y debe verse en el tab al toque)', async () => {
    const { pppoeApi } = await import('@/api/pppoe.api');
    vi.mocked(pppoeApi.move).mockRejectedValueOnce(new Error('NO_FREE_IP'));

    const { result } = renderHook(() => useMovePppoeGlobal(), {
      wrapper: makeWrapper(qc),
    });

    await expect(
      result.current.mutateAsync({ id: 'pppoe-1', nasId: 'nas-2' }),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(qc.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['pppoe-nas-move-events'] }),
      );
    });
  });
});
