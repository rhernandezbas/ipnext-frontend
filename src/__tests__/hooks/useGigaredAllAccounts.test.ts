import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { GigaredAccount } from '@/types/gigared';

vi.mock('@/api/gigared.api', () => ({
  gigaredApi: {
    listAccounts: vi.fn(),
  },
}));

import { gigaredApi } from '@/api/gigared.api';
import { useGigaredAllAccounts } from '@/hooks/useGigared';

function account(cic: string, over: Partial<GigaredAccount> = {}): GigaredAccount {
  return {
    cic,
    gigaredId: `g-${cic}`,
    email: null,
    firstName: 'N',
    lastName: 'A',
    registrationDate: null,
    services: [],
    internalId: null,
    ott: null,
    ...over,
  };
}

/** A full page of 20 distinct accounts (forces the loop to ask for a next page). */
function fullPage(prefix: string): GigaredAccount[] {
  return Array.from({ length: 20 }, (_, i) => account(`${prefix}${String(i).padStart(2, '0')}`));
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useGigaredAllAccounts', () => {
  it('paginates until a short page and flattens the result (2 pages)', async () => {
    const page1 = fullPage('a'); // 20 → there may be more
    const page2 = [account('b00'), account('b01')]; // < 20 → last page
    vi.mocked(gigaredApi.listAccounts)
      .mockResolvedValueOnce({ accounts: page1 })
      .mockResolvedValueOnce({ accounts: page2 });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGigaredAllAccounts('registered'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(22);
    // First call: offset 0; second call: offset 20.
    expect(gigaredApi.listAccounts).toHaveBeenCalledTimes(2);
    expect(gigaredApi.listAccounts).toHaveBeenNthCalledWith(1, {
      status: 'registered',
      paginationLimit: 20,
      paginationOffset: 0,
    });
    expect(gigaredApi.listAccounts).toHaveBeenNthCalledWith(2, {
      status: 'registered',
      paginationLimit: 20,
      paginationOffset: 20,
    });
  });

  it('stops after a single short page (no extra request)', async () => {
    vi.mocked(gigaredApi.listAccounts).mockResolvedValueOnce({
      accounts: [account('x00'), account('x01')],
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGigaredAllAccounts('unregistered'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(gigaredApi.listAccounts).toHaveBeenCalledTimes(1);
    expect(gigaredApi.listAccounts).toHaveBeenCalledWith({
      status: 'unregistered',
      paginationLimit: 20,
      paginationOffset: 0,
    });
  });

  it('passes the status through to each page request', async () => {
    vi.mocked(gigaredApi.listAccounts).mockResolvedValueOnce({ accounts: [] });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGigaredAllAccounts('unregistered'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(gigaredApi.listAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'unregistered' }),
    );
  });
});
