/**
 * #46 — bulk-action wire boundary.
 *
 * Pins the EXACT axios call (method · URL · payload) each bulk action emits, and
 * proves the UI never touches the non-existent POST /tickets/:id/close. The dead
 * `closeTicket` fn (tickets.api.ts) MUST be gone — importing it must not resolve.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import axiosClient from '@/api/axios-client';
import * as ticketsApi from '@/api/tickets.api';
import { useAssignTicket, useUpdateTicketStatus, useDeleteTicket } from '@/hooks/useTickets';

vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axiosClient.patch).mockResolvedValue({ data: {} });
  vi.mocked(axiosClient.delete).mockResolvedValue({ data: {} });
});

describe('tickets bulk wire boundary', () => {
  it('Asignar → PATCH /tickets/:id { assigneeId }', async () => {
    const { result } = renderHook(() => useAssignTicket(), { wrapper });
    result.current.mutate({ id: 't1', assigneeId: 'luis' });
    await waitFor(() => expect(axiosClient.patch).toHaveBeenCalled());
    expect(axiosClient.patch).toHaveBeenCalledWith('/tickets/t1', { assigneeId: 'luis' });
  });

  it('Cambiar estado / Cerrar → PATCH /tickets/:id/status { status: <catalog name> }', async () => {
    const { result } = renderHook(() => useUpdateTicketStatus(), { wrapper });
    result.current.mutate({ id: 't1', status: 'Cerrado' });
    await waitFor(() => expect(axiosClient.patch).toHaveBeenCalled());
    expect(axiosClient.patch).toHaveBeenCalledWith('/tickets/t1/status', { status: 'Cerrado' });
  });

  it('Eliminar → DELETE /tickets/:id (soft-close on the BE)', async () => {
    const { result } = renderHook(() => useDeleteTicket(), { wrapper });
    result.current.mutate('t1');
    await waitFor(() => expect(axiosClient.delete).toHaveBeenCalled());
    expect(axiosClient.delete).toHaveBeenCalledWith('/tickets/t1');
  });

  it('never POSTs to /tickets/:id/close and closeTicket is removed', () => {
    expect(axiosClient.post).not.toHaveBeenCalled();
    expect((ticketsApi as Record<string, unknown>).closeTicket).toBeUndefined();
  });
});
