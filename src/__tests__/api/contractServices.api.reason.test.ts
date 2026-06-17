/**
 * #127 — contract-services API: remove() must send reason in the DELETE body.
 * Wire contract: DELETE /api/contracts/:contractId/services/:id
 *   body: { reason?: string }  (via axios.delete(url, { data: { reason } }))
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import { contractServicesApi } from '@/api/contract-services.api';

describe('contractServicesApi.remove — #127 reason body', () => {
  beforeEach(() => vi.clearAllMocks());

  it('remove() sends reason in the DELETE body when provided', async () => {
    vi.mocked(axiosClient.delete).mockResolvedValue({ data: undefined });
    await contractServicesApi.remove('ctr-9', 'cs-1', 'Motivo de prueba');
    expect(axiosClient.delete).toHaveBeenCalledWith(
      '/contracts/ctr-9/services/cs-1',
      { data: { reason: 'Motivo de prueba' } },
    );
  });

  it('remove() sends an empty body when reason is omitted', async () => {
    vi.mocked(axiosClient.delete).mockResolvedValue({ data: undefined });
    await contractServicesApi.remove('ctr-9', 'cs-1');
    expect(axiosClient.delete).toHaveBeenCalledWith(
      '/contracts/ctr-9/services/cs-1',
      { data: { reason: undefined } },
    );
  });
});
