/**
 * Hooks de transferencia (service-transfer W4) — invalidación de AMBOS clientes.
 *
 * Cubre:
 *  HTS-1  useTransferTv: payload correcto + invalida account/client-contracts de origen Y destino
 *  HTS-2  useTransferPppoe: payload correcto + invalida contract-pppoe/client-contracts de ambos
 *  HTS-3  useTransferEquipment: payload correcto + invalida service-inventory/client-equipment de ambos
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/gigared.api', () => ({
  gigaredApi: { transferTv: vi.fn() },
}));
vi.mock('@/api/pppoe.api', () => ({
  pppoeApi: { transfer: vi.fn() },
}));
vi.mock('@/api/serviceInventory.api', () => ({
  transferInstalledItems: vi.fn(),
}));

import { gigaredApi } from '@/api/gigared.api';
import { pppoeApi } from '@/api/pppoe.api';
import * as inventoryApi from '@/api/serviceInventory.api';
import { useTransferTv, accountKey } from '@/hooks/useGigared';
import { useTransferPppoe } from '@/hooks/usePppoe';
import { useTransferEquipment } from '@/hooks/useServiceInventory';

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

describe('HTS-1: useTransferTv', () => {
  const result = {
    status: 200,
    data: { cic: '0000000009', severed: true, localSource: 'synced', localTarget: 'synced', targetCleared: true },
  };

  it('llama al endpoint con el body pineado', async () => {
    vi.mocked(gigaredApi.transferTv).mockResolvedValue(result as never);
    const { wrapper } = makeWrapper();
    const { result: hook } = renderHook(() => useTransferTv('src-client'), { wrapper });

    await act(async () => {
      await hook.current.mutateAsync({
        targetCustomerId: 'tgt-client',
        targetContractId: 'ct-t1',
        sourceContractId: 'ct-s1',
      });
    });

    expect(gigaredApi.transferTv).toHaveBeenCalledWith('src-client', {
      targetCustomerId: 'tgt-client',
      targetContractId: 'ct-t1',
      sourceContractId: 'ct-s1',
    });
  });

  it('invalida cuenta TV y contratos de AMBOS clientes', async () => {
    vi.mocked(gigaredApi.transferTv).mockResolvedValue(result as never);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result: hook } = renderHook(() => useTransferTv('src-client'), { wrapper });

    await act(async () => {
      await hook.current.mutateAsync({ targetCustomerId: 'tgt-client', targetContractId: 'ct-t1' });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: accountKey('src-client') });
    expect(spy).toHaveBeenCalledWith({ queryKey: accountKey('tgt-client') });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-contracts', 'src-client'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-contracts', 'tgt-client'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['gigared', 'summary'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contract-service-history'] });
  });

  it('invalida también en error (el estado pudo cambiar parcialmente)', async () => {
    vi.mocked(gigaredApi.transferTv).mockRejectedValue(new Error('boom'));
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result: hook } = renderHook(() => useTransferTv('src-client'), { wrapper });

    await act(async () => {
      await hook.current.mutateAsync({ targetCustomerId: 'tgt-client', targetContractId: 'ct-t1' }).catch(() => undefined);
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: accountKey('src-client') });
    expect(spy).toHaveBeenCalledWith({ queryKey: accountKey('tgt-client') });
  });
});

describe('HTS-2: useTransferPppoe', () => {
  const result = {
    mode: 'recreate',
    oldContractId: 'ct-s1',
    newContractId: 'ct-t1',
    oldUsername: 'juan.old',
    newUsername: 'maria.nueva',
  };

  it('llama al endpoint con el body pineado (sin targetClientId en el wire)', async () => {
    vi.mocked(pppoeApi.transfer).mockResolvedValue(result as never);
    const { wrapper } = makeWrapper();
    const { result: hook } = renderHook(() => useTransferPppoe('ct-s1', 'src-client'), { wrapper });

    await act(async () => {
      await hook.current.mutateAsync({
        id: 'pppoe-1',
        targetClientId: 'tgt-client',
        targetContractId: 'ct-t1',
        mode: 'as-is',
        reason: 'Sin acceso',
      });
    });

    expect(pppoeApi.transfer).toHaveBeenCalledWith('pppoe-1', {
      targetContractId: 'ct-t1',
      mode: 'as-is',
      reason: 'Sin acceso',
    });
  });

  it('invalida contract-pppoe y client-contracts de AMBOS lados', async () => {
    vi.mocked(pppoeApi.transfer).mockResolvedValue(result as never);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result: hook } = renderHook(() => useTransferPppoe('ct-s1', 'src-client'), { wrapper });

    await act(async () => {
      await hook.current.mutateAsync({
        id: 'pppoe-1',
        targetClientId: 'tgt-client',
        targetContractId: 'ct-t1',
        mode: 'recreate',
        newPppoe: { username: 'maria.nueva', password: 'x', ipTypePreference: 'cgnat' },
      });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['contract-pppoe', 'ct-s1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contract-pppoe', 'ct-t1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-contracts', 'src-client'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-contracts', 'tgt-client'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contract-service-history'] });
  });
});

describe('HTS-3: useTransferEquipment', () => {
  const result = { moved: 1, items: [{ id: 'item-1', type: 'ANTENA', assetMoved: true }] };

  it('llama al endpoint con el body pineado (sin targetClientId en el wire)', async () => {
    vi.mocked(inventoryApi.transferInstalledItems).mockResolvedValue(result as never);
    const { wrapper } = makeWrapper();
    const { result: hook } = renderHook(() => useTransferEquipment('ct-s1', 'src-client'), { wrapper });

    await act(async () => {
      await hook.current.mutateAsync({
        targetContractId: 'ct-t1',
        targetClientId: 'tgt-client',
        itemIds: ['item-1'],
      });
    });

    expect(inventoryApi.transferInstalledItems).toHaveBeenCalledWith('ct-s1', {
      targetContractId: 'ct-t1',
      itemIds: ['item-1'],
    });
  });

  it('invalida inventario y equipos de AMBOS lados', async () => {
    vi.mocked(inventoryApi.transferInstalledItems).mockResolvedValue(result as never);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result: hook } = renderHook(() => useTransferEquipment('ct-s1', 'src-client'), { wrapper });

    await act(async () => {
      await hook.current.mutateAsync({
        targetContractId: 'ct-t1',
        targetClientId: 'tgt-client',
        itemIds: ['item-1'],
      });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['service-inventory', 'ct-s1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['service-inventory', 'ct-t1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-equipment', 'src-client'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-equipment', 'tgt-client'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contract-service-history'] });
  });
});
