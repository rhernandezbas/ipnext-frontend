import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/networkAudit.api', () => ({
  getRadiusEvents: vi.fn(),
  getNe8000Audit:  vi.fn(),
}));

import { getNe8000Audit } from '@/api/networkAudit.api';
import { useNe8000Audit } from '@/hooks/useNe8000Audit';
import type { PaginatedNe8000Audit } from '@/types/networkAudit';

const PAGINATED: PaginatedNe8000Audit = {
  data: [
    {
      pppoeId: 'pppoe-1',
      username: 'user2@isp.com',
      profile: 'Plan 50MB',
      remoteAddress: '10.0.1.50',
      macAddress: 'FF:EE:DD:CC:BB:AA',
      status: 'enabled',
      enforcedState: 'active',
      contractId: 'contract-42',
      currentlyOnline: true,
      lastStartedAt: '2026-06-22T08:00:00Z',
      lastStoppedAt: null,
      lastFramedIp: '10.0.1.50',
      lastVlanId: 200,
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  hasNext: false,
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useNe8000Audit', () => {
  it('returns paginated data on success', async () => {
    vi.mocked(getNe8000Audit).mockResolvedValue(PAGINATED);
    const params = { page: 1, limit: 20 };

    const { result } = renderHook(() => useNe8000Audit(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGINATED);
    expect(getNe8000Audit).toHaveBeenCalledTimes(1);
  });

  it('surfaces error state when request fails', async () => {
    vi.mocked(getNe8000Audit).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useNe8000Audit({}), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('forwards filter params to the API function', async () => {
    vi.mocked(getNe8000Audit).mockResolvedValue(PAGINATED);
    const params = { username: 'user2@isp.com', status: 'enabled' as const, enforcedState: 'active' as const, online: true, page: 1, limit: 20 };

    const { result } = renderHook(() => useNe8000Audit(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getNe8000Audit).toHaveBeenCalledWith(params);
  });
});
