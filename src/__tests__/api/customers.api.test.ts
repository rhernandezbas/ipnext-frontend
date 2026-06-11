import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock axiosClient before importing the api module
vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import { patchContractName } from '@/api/customers.api';

describe('patchContractName (#43)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PATCHes /contracts/:id with { name } using the UUID verbatim', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: { id: 'ctr-uuid-9', name: 'Fibra Casa' } });
    const result = await patchContractName('ctr-uuid-9', 'Fibra Casa');
    expect(axiosClient.patch).toHaveBeenCalledWith('/contracts/ctr-uuid-9', { name: 'Fibra Casa' });
    expect(result).toEqual({ id: 'ctr-uuid-9', name: 'Fibra Casa' });
  });

  it('sends name: null when clearing the name', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: { id: 'ctr-uuid-9', name: null } });
    await patchContractName('ctr-uuid-9', null);
    expect(axiosClient.patch).toHaveBeenCalledWith('/contracts/ctr-uuid-9', { name: null });
  });
});
