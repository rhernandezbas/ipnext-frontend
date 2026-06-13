import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/recaptacion.api', () => ({
  listRecaptureLeads:        vi.fn(),
  getRecaptureLead:          vi.fn(),
  claimRecaptureLead:        vi.fn(),
  claimNextRecaptureLead:    vi.fn(),
  releaseRecaptureLead:      vi.fn(),
  updateRecaptureLeadStatus: vi.fn(),
  addRecaptureContact:       vi.fn(),
  // Real-ish implementation: detect the 409 shape the api would reject with.
  isLeadConflictError: (err: unknown) =>
    typeof err === 'object' && err !== null &&
    (err as { response?: { status?: number } }).response?.status === 409,
}));

import {
  listRecaptureLeads,
  getRecaptureLead,
  claimRecaptureLead,
  claimNextRecaptureLead,
  releaseRecaptureLead,
} from '@/api/recaptacion.api';
import {
  useRecaptacionLeads,
  useRecaptacionLead,
  useClaimLead,
  useClaimNext,
  useReleaseLead,
  CLAIM_CONFLICT_MESSAGE,
} from '@/hooks/useRecaptacion';

/** Build an axios-like 409 error (the shape claimRecaptureLead rejects with). */
function make409(): unknown {
  return {
    isAxiosError: true,
    response: { status: 409, data: { code: 'RECAPTURE_LEAD_ALREADY_CLAIMED' } },
  };
}
import type { RecaptureLeadDto, RecaptureLeadDetailDto } from '@/types/recaptacion';

const LEAD: RecaptureLeadDto = {
  id: 'lead-1',
  source: 'churned_client',
  clientId: 'client-1',
  contactName: 'Juan Pérez',
  phone: '+5491112345678',
  email: 'juan@example.com',
  status: 'nuevo',
  assigneeId: null,
  claimedAt: null,
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
};

const LEAD_DETAIL: RecaptureLeadDetailDto = {
  ...LEAD,
  contacts: [],
};

const PAGINATED = { data: [LEAD], total: 1, page: 1, limit: 25 };

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRecaptacionLeads', () => {
  it('returns paginated data on success', async () => {
    vi.mocked(listRecaptureLeads).mockResolvedValue(PAGINATED);

    const { result } = renderHook(() => useRecaptacionLeads({ page: 1, limit: 25 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGINATED);
    expect(listRecaptureLeads).toHaveBeenCalledTimes(1);
  });

  it('surfaces error state when request fails', async () => {
    vi.mocked(listRecaptureLeads).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useRecaptacionLeads({}), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useRecaptacionLead', () => {
  it('returns detail on success', async () => {
    vi.mocked(getRecaptureLead).mockResolvedValue(LEAD_DETAIL);

    const { result } = renderHook(() => useRecaptacionLead('lead-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(LEAD_DETAIL);
  });

  it('does not fetch when id is null', () => {
    const { result } = renderHook(() => useRecaptacionLead(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getRecaptureLead).not.toHaveBeenCalled();
  });
});

describe('useClaimLead', () => {
  it('calls claimRecaptureLead with the given id', async () => {
    vi.mocked(claimRecaptureLead).mockResolvedValue({ ...LEAD, assigneeId: 'user-1', status: 'en_gestion', claimedAt: '2026-06-13T00:01:00.000Z' });

    const { result } = renderHook(() => useClaimLead(), { wrapper });

    result.current.mutate('lead-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(claimRecaptureLead).toHaveBeenCalledWith('lead-1');
  });
});

describe('useClaimNext', () => {
  it('returns null when no free leads (204)', async () => {
    vi.mocked(claimNextRecaptureLead).mockResolvedValue(null);

    const { result } = renderHook(() => useClaimNext(), { wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('returns the claimed lead on success', async () => {
    vi.mocked(claimNextRecaptureLead).mockResolvedValue({ ...LEAD, assigneeId: 'user-1', status: 'en_gestion', claimedAt: '2026-06-13T00:02:00.000Z' });

    const { result } = renderHook(() => useClaimNext(), { wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.assigneeId).toBe('user-1');
  });
});

// ── 409 conflict handling on claim ─────────────────────────────────────────────
// The 409 (another operator already claimed the lead) is expected business state,
// not a crash. The mutation must surface a clear message AND invalidate the
// queries even on error, so the list/detail refresh and the lead stops looking free.

describe('useClaimLead — 409 conflict', () => {
  it('surfaces a friendly message and invalidates queries on 409', async () => {
    vi.mocked(claimRecaptureLead).mockRejectedValue(make409());

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useClaimLead(), { wrapper: localWrapper });

    result.current.mutate('lead-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    // Friendly, user-facing message — not a raw axios error
    expect(result.current.error?.message).toBe(CLAIM_CONFLICT_MESSAGE);
    // Invalidation happened on error (refresh the stale "free" view)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recaptacion'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recaptacion-lead', 'lead-1'] });
  });
});

describe('useReleaseLead — 409 conflict', () => {
  it('invalidates queries on error', async () => {
    vi.mocked(releaseRecaptureLead).mockRejectedValue(make409());

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useReleaseLead(), { wrapper: localWrapper });

    result.current.mutate('lead-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recaptacion'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recaptacion-lead', 'lead-1'] });
  });
});
