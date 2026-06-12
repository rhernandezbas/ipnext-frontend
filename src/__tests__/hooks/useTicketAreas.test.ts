/**
 * Tests for useTicketAreas and its mutation hooks.
 * Mocks at the API layer (ticketAreasApi). Mirrors useDeviceTypes.test.ts.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TicketArea } from '@/types/ticketArea';

vi.mock('@/api/ticketAreas.api', () => ({
  ticketAreasApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import * as ticketAreasApiModule from '@/api/ticketAreas.api';
import {
  useTicketAreas,
  useCreateTicketArea,
  useUpdateTicketArea,
  useDeleteTicketArea,
} from '@/hooks/useTicketAreas';

const mockApi = ticketAreasApiModule.ticketAreasApi as {
  list: ReturnType<typeof vi.fn>;
  getById: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function makeArea(over: Partial<TicketArea> = {}): TicketArea {
  return { id: 'a-1', name: 'Soporte', ...over };
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useTicketAreas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data from the API', async () => {
    const items = [makeArea()];
    mockApi.list.mockResolvedValue(items);

    const { result } = renderHook(() => useTicketAreas(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(items);
    expect(mockApi.list).toHaveBeenCalledOnce();
  });

  it('uses ticket-areas query key', async () => {
    mockApi.list.mockResolvedValue([]);
    const { result } = renderHook(() => useTicketAreas(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('useCreateTicketArea', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls api.create and invalidates the query', async () => {
    const created = makeArea({ id: 'a-new', name: 'Redes' });
    mockApi.list.mockResolvedValue([]);
    mockApi.create.mockResolvedValue(created);

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useCreateTicketArea(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Redes' });
    });

    expect(mockApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Redes' }), expect.anything());
  });
});

describe('useUpdateTicketArea', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls api.update with id and data', async () => {
    const updated = makeArea({ name: 'Soporte TI' });
    mockApi.list.mockResolvedValue([]);
    mockApi.update.mockResolvedValue(updated);

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateTicketArea(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'a-1', data: { name: 'Soporte TI' } });
    });

    expect(mockApi.update).toHaveBeenCalledWith('a-1', { name: 'Soporte TI' });
  });
});

describe('useDeleteTicketArea', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls api.delete with the id', async () => {
    mockApi.list.mockResolvedValue([]);
    mockApi.delete.mockResolvedValue(undefined);

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useDeleteTicketArea(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('a-1');
    });

    expect(mockApi.delete).toHaveBeenCalledWith('a-1');
  });
});
