import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/recaptacion.api', () => ({
  ingestChurnedClients: vi.fn(),
  importCsvLeads:       vi.fn(),
  // keep the rest as stubs so the module resolves cleanly
  listRecaptureLeads:        vi.fn(),
  getRecaptureLead:          vi.fn(),
  updateRecaptureLeadStatus: vi.fn(),
  addRecaptureContact:       vi.fn(),
  assignRecaptureLead:       vi.fn(),
  assignBulkRecaptureLeads:  vi.fn(),
  downloadCsvTemplate:       vi.fn(),
}));

import { ingestChurnedClients, importCsvLeads } from '@/api/recaptacion.api';
import { useIngestChurned, useImportCsvLeads } from '@/hooks/useRecaptacion';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

// ── useIngestChurned ─────────────────────────────────────────────────────────

describe('useIngestChurned', () => {
  it('calls ingestChurnedClients and returns created/skipped', async () => {
    vi.mocked(ingestChurnedClients).mockResolvedValue({ created: 3, skipped: 1 });

    const { result } = renderHook(() => useIngestChurned(), { wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ingestChurnedClients).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ created: 3, skipped: 1 });
  });

  it('invalidates ["recaptacion"] on success', async () => {
    vi.mocked(ingestChurnedClients).mockResolvedValue({ created: 0, skipped: 5 });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useIngestChurned(), { wrapper: localWrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recaptacion'] });
  });
});

// ── useImportCsvLeads ────────────────────────────────────────────────────────

describe('useImportCsvLeads', () => {
  it('posts the csv string and returns created/errors', async () => {
    vi.mocked(importCsvLeads).mockResolvedValue({ created: 2, errors: [] });

    const { result } = renderHook(() => useImportCsvLeads(), { wrapper });

    result.current.mutate('id,name\n1,Juan');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(importCsvLeads).toHaveBeenCalledWith('id,name\n1,Juan');
    expect(result.current.data).toEqual({ created: 2, errors: [] });
  });

  it('invalidates ["recaptacion"] on success', async () => {
    vi.mocked(importCsvLeads).mockResolvedValue({ created: 1, errors: ['row 3: bad'] });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useImportCsvLeads(), { wrapper: localWrapper });

    result.current.mutate('id,name\n1,Juan');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recaptacion'] });
  });
});
