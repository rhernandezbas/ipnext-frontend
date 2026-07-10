/**
 * useActions — hooks del worklist de Acciones (actions-worklist F2).
 *
 *  UACT-1 useOwnershipCases: pasa el query al api y expone data (key ['actions','ownership',query])
 *  UACT-2 useRecentBajas: pasa el query al api (key ['actions','bajas',query])
 *  UACT-3 useUpdateOwnershipCase: mutateAsync({id, body}) → api(id, body)
 *  UACT-4 useUpdateOwnershipCase: invalida ['actions'] en onSettled (éxito Y error)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/actions.api', () => ({
  listOwnershipCases: vi.fn(),
  listRecentBajas: vi.fn(),
  updateOwnershipCase: vi.fn(),
}));

import { listOwnershipCases, listRecentBajas, updateOwnershipCase } from '@/api/actions.api';
import {
  useOwnershipCases,
  useRecentBajas,
  useUpdateOwnershipCase,
  ownershipCasesKey,
  recentBajasKey,
  ACTIONS_ROOT,
} from '@/hooks/useActions';

const emptyPage = { items: [], total: 0, page: 1, pageSize: 25 };

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UACT-1: useOwnershipCases', () => {
  it('llama al api con el query y expone data bajo la key correcta', async () => {
    vi.mocked(listOwnershipCases).mockResolvedValue({ ...emptyPage, total: 7 });
    const { qc, wrapper } = makeWrapper();
    const query = { status: 'pending' as const, page: 2, pageSize: 25 };

    const { result } = renderHook(() => useOwnershipCases(query), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listOwnershipCases).toHaveBeenCalledWith(query);
    expect(result.current.data?.total).toBe(7);
    // La data vive bajo ['actions','ownership',query] — invalidable por la raíz.
    expect(qc.getQueryData(ownershipCasesKey(query))).toEqual({ ...emptyPage, total: 7 });
  });
});

describe('UACT-2: useRecentBajas', () => {
  it('llama al api con el query y cachea bajo ["actions","bajas",query]', async () => {
    vi.mocked(listRecentBajas).mockResolvedValue(emptyPage);
    const { qc, wrapper } = makeWrapper();
    const query = { page: 1, pageSize: 25 };

    const { result } = renderHook(() => useRecentBajas(query), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listRecentBajas).toHaveBeenCalledWith(query);
    expect(qc.getQueryData(recentBajasKey(query))).toEqual(emptyPage);
  });
});

describe('UACT-3/4: useUpdateOwnershipCase', () => {
  it('pasa {id, body} al api tal cual', async () => {
    vi.mocked(updateOwnershipCase).mockResolvedValue({ id: 'case-1' } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateOwnershipCase(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'case-1', body: { targetContractId: 'ct-9' } });
    });

    expect(updateOwnershipCase).toHaveBeenCalledWith('case-1', { targetContractId: 'ct-9' });
  });

  it('invalida la raíz ["actions"] en éxito', async () => {
    vi.mocked(updateOwnershipCase).mockResolvedValue({ id: 'case-1' } as never);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateOwnershipCase(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'case-1', body: { equipmentReviewed: true } });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ACTIONS_ROOT });
  });

  it('invalida ["actions"] TAMBIÉN en error (onSettled — el estado real puede haber cambiado)', async () => {
    vi.mocked(updateOwnershipCase).mockRejectedValue(new Error('422'));
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateOwnershipCase(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'case-1', body: { status: 'pending' } }),
      ).rejects.toThrow();
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ACTIONS_ROOT });
  });
});
