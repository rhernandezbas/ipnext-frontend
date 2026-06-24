import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/networkAudit.api', () => ({
  getRadiusEvents:       vi.fn(),
  getNe8000Audit:        vi.fn(),
  getRadiusAuthFailures: vi.fn(),
}));

import { getRadiusAuthFailures } from '@/api/networkAudit.api';
import { useRadiusAuthFailures } from '@/hooks/useRadiusAuthFailures';
import type { PaginatedRadiusAuthEvents } from '@/types/networkAudit';

const PAGINATED: PaginatedRadiusAuthEvents = {
  data: [
    {
      id: 'auth-1',
      username: 'user1@isp.com',
      reply: 'Access-Reject',
      authdate: '2026-06-22T10:00:00Z',
      class: null,
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
  hasNext: false,
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRadiusAuthFailures', () => {
  it('returns paginated data on success and calls the API once', async () => {
    vi.mocked(getRadiusAuthFailures).mockResolvedValue(PAGINATED);
    const params = { username: 'user1@isp.com', page: 1, limit: 50 };

    const { result } = renderHook(() => useRadiusAuthFailures(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGINATED);
    expect(getRadiusAuthFailures).toHaveBeenCalledTimes(1);
  });

  it('surfaces error state when the request fails', async () => {
    vi.mocked(getRadiusAuthFailures).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useRadiusAuthFailures({}), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('forwards query params to the API function', async () => {
    vi.mocked(getRadiusAuthFailures).mockResolvedValue(PAGINATED);
    const params = { username: 'test@isp.com', reply: 'Access-Reject' as const, page: 2, limit: 50 };

    const { result } = renderHook(() => useRadiusAuthFailures(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRadiusAuthFailures).toHaveBeenCalledWith(params);
  });
});
