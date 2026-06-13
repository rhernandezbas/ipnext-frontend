/**
 * RecaptacionPage — tests for:
 *   #4  CSV / Bajas tabs: clicking sets source in the query/URL
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useRecaptacion', () => ({
  useRecaptacionLeads:       vi.fn(),
  useClaimNext:              vi.fn(),
  useIngestChurned:          vi.fn(),
  useClaimLead:              vi.fn(),
  useReleaseLead:            vi.fn(),
  useAddContact:             vi.fn(),
  useUpdateLeadStatus:       vi.fn(),
  useRecaptacionLead:        vi.fn(),
  useImportCsvLeads:         vi.fn(),
  downloadRecaptureCsvTemplate: vi.fn(),
}));

vi.mock('@/api/recaptacion.api', () => ({
  listRecaptureLeads:     vi.fn(),
  importCsvLeads:         vi.fn(),
  downloadCsvTemplate:    vi.fn(),
  isLeadConflictError:    vi.fn(() => false),
}));

import {
  useRecaptacionLeads,
  useClaimNext,
  useIngestChurned,
  useImportCsvLeads,
} from '@/hooks/useRecaptacion';
import RecaptacionPage from '@/pages/customers/RecaptacionPage';
import type { RecaptureLeadsQuery } from '@/types/recaptacion';

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_RESULT = { data: [], total: 0, page: 1, limit: 25 };

function mockHooks() {
  let capturedQuery: RecaptureLeadsQuery = {};

  vi.mocked(useRecaptacionLeads).mockImplementation((q) => {
    capturedQuery = q;
    return {
      data: EMPTY_RESULT,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRecaptacionLeads>;
  });

  vi.mocked(useClaimNext).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(null),
    isPending: false,
  } as unknown as ReturnType<typeof useClaimNext>);

  vi.mocked(useIngestChurned).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
    isPending: false,
  } as unknown as ReturnType<typeof useIngestChurned>);

  vi.mocked(useImportCsvLeads).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ created: 0, errors: [] }),
    isPending: false,
    isError: false,
    data: undefined,
  } as unknown as ReturnType<typeof useImportCsvLeads>);

  return { getCapturedQuery: () => capturedQuery };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RecaptacionPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── #4 — CSV tabs ─────────────────────────────────────────────────────────────

describe('RecaptacionPage — source tabs (#4)', () => {
  it('P1 — renders both "Bajas" and "CSV" tabs', () => {
    mockHooks();
    renderPage();
    // Use exact name to avoid matching "Ingestar bajas" button
    expect(screen.getByRole('button', { name: 'Bajas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument();
  });

  it('P2 — default tab is "Bajas" and query receives source=churned_client', () => {
    const { getCapturedQuery } = mockHooks();
    renderPage();
    // "Bajas" is the default — it should be active and source set
    expect(getCapturedQuery().source).toBe('churned_client');
  });

  it('P3 — clicking "CSV" sets source=csv in the query', async () => {
    const user = userEvent.setup();
    const { getCapturedQuery } = mockHooks();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'CSV' }));

    await waitFor(() => expect(getCapturedQuery().source).toBe('csv'));
  });

  it('P4 — clicking "Bajas" after "CSV" resets source to churned_client', async () => {
    const user = userEvent.setup();
    const { getCapturedQuery } = mockHooks();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'CSV' }));
    await waitFor(() => expect(getCapturedQuery().source).toBe('csv'));

    await user.click(screen.getByRole('button', { name: 'Bajas' }));
    await waitFor(() => expect(getCapturedQuery().source).toBe('churned_client'));
  });
});
