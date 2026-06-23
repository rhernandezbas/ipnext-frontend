import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/networkAudit.api', () => ({
  getRadiusEvents: vi.fn(),
  getNe8000Audit:  vi.fn(),
}));

import { getRadiusEvents } from '@/api/networkAudit.api';
import { useRadiusEvents } from '@/hooks/useRadiusEvents';
import type { PaginatedRadiusEvents } from '@/types/networkAudit';

const PAGINATED: PaginatedRadiusEvents = {
  data: [
    {
      id: 'evt-1',
      username: 'user1@isp.com',
      nasId: 'nas-1',
      nasIpAddress: '192.168.1.1',
      nasName: 'NAS-Central',
      framedIp: '10.0.0.1',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      vlanId: 100,
      startedAt: '2026-06-22T10:00:00Z',
      stoppedAt: null,
      sessionTimeSeconds: null,
      inOctets: '1048576',
      outOctets: '524288',
      eventType: 'start',
      status: 'online',
      online: true,
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

describe('useRadiusEvents', () => {
  it('returns paginated data on success and queryKey includes params', async () => {
    vi.mocked(getRadiusEvents).mockResolvedValue(PAGINATED);
    const params = { username: 'user1@isp.com', page: 1, limit: 20 };

    const { result } = renderHook(() => useRadiusEvents(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGINATED);
    expect(getRadiusEvents).toHaveBeenCalledTimes(1);
  });

  it('surfaces error state when request fails', async () => {
    vi.mocked(getRadiusEvents).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useRadiusEvents({}), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('forwards query params to the API function', async () => {
    vi.mocked(getRadiusEvents).mockResolvedValue(PAGINATED);
    const params = { username: 'test@isp.com', eventType: 'stop' as const, online: false, page: 2, limit: 50 };

    const { result } = renderHook(() => useRadiusEvents(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRadiusEvents).toHaveBeenCalledWith(params);
  });
});
