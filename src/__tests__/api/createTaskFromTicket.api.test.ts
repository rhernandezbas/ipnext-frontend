import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock axiosClient before importing the api module
vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import { createTaskFromTicket } from '@/api/tickets.api';
import type { CreateTaskPayload } from '@/types/scheduling';

const body: CreateTaskPayload = {
  title: 'Tarea desde ticket',
  priority: 'normal',
  category: 'support',
  estimatedHours: 1,
  projectId: 'p1',
  contractId: 'c1',
};

describe('createTaskFromTicket api (#9)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs to /tickets/:id/tasks so the backend persists ticketId from the path', async () => {
    const created = { id: 'task-9', ticketId: 42, sequenceNumber: 100 };
    vi.mocked(axiosClient.post).mockResolvedValue({ data: created });

    const result = await createTaskFromTicket('42', body);

    // The whole point of #9: use the ticket-scoped endpoint, NOT the generic
    // POST /scheduling (which drops ticketId by design — AD-7).
    expect(axiosClient.post).toHaveBeenCalledWith('/tickets/42/tasks', body);
    expect(result).toEqual(created);
  });
});
