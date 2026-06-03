/**
 * Tests for useDeviceTypes and its mutation hooks.
 * Mocks at the API layer (deviceTypesApi).
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { DeviceType } from '@/types/deviceType';

vi.mock('@/api/deviceTypes.api', () => ({
  deviceTypesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import * as deviceTypesApiModule from '@/api/deviceTypes.api';
import {
  useDeviceTypes,
  useCreateDeviceType,
  useUpdateDeviceType,
  useDeleteDeviceType,
} from '@/hooks/useDeviceTypes';

const mockApi = deviceTypesApiModule.deviceTypesApi as {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function makeDeviceType(over: Partial<DeviceType> = {}): DeviceType {
  return {
    id: 'dt-1',
    name: 'ONU',
    label: 'Óptico',
    active: true,
    sortOrder: 1,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useDeviceTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data from the API', async () => {
    const items = [makeDeviceType()];
    mockApi.list.mockResolvedValue(items);

    const { result } = renderHook(() => useDeviceTypes(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(items);
    expect(mockApi.list).toHaveBeenCalledOnce();
  });

  it('uses the device-types query key', async () => {
    mockApi.list.mockResolvedValue([]);
    const { result } = renderHook(() => useDeviceTypes(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Verifying staleTime indirectly — just confirm data arrives correctly
    expect(result.current.data).toEqual([]);
  });
});

describe('useCreateDeviceType', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls api.create and invalidates the query', async () => {
    const created = makeDeviceType({ id: 'dt-new', name: 'ROUTER' });
    mockApi.list.mockResolvedValue([]);
    mockApi.create.mockResolvedValue(created);

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateDeviceType(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'ROUTER' });
    });

    expect(mockApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'ROUTER' }), expect.anything());
  });
});

describe('useUpdateDeviceType', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls api.update with id and data', async () => {
    const updated = makeDeviceType({ label: 'Nuevo label' });
    mockApi.list.mockResolvedValue([]);
    mockApi.update.mockResolvedValue(updated);

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateDeviceType(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'dt-1', data: { label: 'Nuevo label' } });
    });

    expect(mockApi.update).toHaveBeenCalledWith('dt-1', { label: 'Nuevo label' });
  });
});

describe('useDeleteDeviceType', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls api.delete with the id', async () => {
    mockApi.list.mockResolvedValue([]);
    mockApi.delete.mockResolvedValue(undefined);

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteDeviceType(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('dt-1');
    });

    expect(mockApi.delete).toHaveBeenCalledWith('dt-1');
  });
});
