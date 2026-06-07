/**
 * #28 follow-up — tickets FE↔BE wire contract.
 *
 * The legacy mock contract diverged from the real backend in every write path:
 *  - useAssignTicket PATCHed /tickets/:id/assign (route does NOT exist in the
 *    BE → 404) with `assignedTo: Number(uuid)` = NaN. The real route is
 *    PATCH /tickets/:id with `{ assigneeId }`.
 *  - createTicket sent `message` + `assignedTo:number`, but POST /tickets
 *    requires `description` (400 without it) and reads `assigneeId:string`.
 *
 * These tests pin the REAL backend contract at the axios boundary.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import axiosClient from '@/api/axios-client';
import { createTicket } from '@/api/tickets.api';
import { useAssignTicket } from '@/hooks/useTickets';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axiosClient.patch).mockResolvedValue({ data: {} });
  vi.mocked(axiosClient.post).mockResolvedValue({ data: {} });
});

describe('useAssignTicket — real BE route', () => {
  it('PATCHes /tickets/:id with { assigneeId } (NOT /assign, NOT assignedTo)', async () => {
    const { result } = renderHook(() => useAssignTicket(), { wrapper });

    result.current.mutate({ id: '17', assigneeId: 'luis-uuid' });

    await waitFor(() => expect(axiosClient.patch).toHaveBeenCalled());
    expect(axiosClient.patch).toHaveBeenCalledWith('/tickets/17', { assigneeId: 'luis-uuid' });
  });

  it('unassign sends assigneeId: null', async () => {
    const { result } = renderHook(() => useAssignTicket(), { wrapper });

    result.current.mutate({ id: '17', assigneeId: null });

    await waitFor(() => expect(axiosClient.patch).toHaveBeenCalled());
    expect(axiosClient.patch).toHaveBeenCalledWith('/tickets/17', { assigneeId: null });
  });
});

describe('createTicket — real BE body (description + assigneeId)', () => {
  it('modal payload (CreateTicketData) posts description and assigneeId', async () => {
    await createTicket({
      subject: 'Sin señal',
      description: 'El cliente no tiene servicio.',
      priority: 'high',
      customerId: 'cust-1',
      assigneeId: 'luis-uuid',
    });

    expect(axiosClient.post).toHaveBeenCalledWith('/tickets', {
      subject: 'Sin señal',
      description: 'El cliente no tiene servicio.',
      priority: 'high',
      customerId: 'cust-1',
      assigneeId: 'luis-uuid',
    });
  });

  it('legacy page payload (CreateTicketInput) maps to the same wire shape', async () => {
    await createTicket({
      subject: 'Sin señal',
      clientId: 'cust-1',
      priority: 'alta',
      description: 'Detalle del problema.',
      assignedTo: 'luis-uuid',
    });

    expect(axiosClient.post).toHaveBeenCalledWith('/tickets', expect.objectContaining({
      subject: 'Sin señal',
      description: 'Detalle del problema.',
      priority: 'high',
      customerId: 'cust-1',
      assigneeId: 'luis-uuid',
    }));
  });

  it('no customer / no assignee → null customerId and no NaN anywhere', async () => {
    await createTicket({
      subject: 'Sin señal',
      description: 'Detalle.',
      priority: 'medium',
      customerId: null,
    });

    const body = vi.mocked(axiosClient.post).mock.calls[0][1] as Record<string, unknown>;
    expect(body.customerId).toBeNull();
    expect(body.assigneeId).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('NaN');
  });
});
