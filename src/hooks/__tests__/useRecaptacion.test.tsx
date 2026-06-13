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
}));

import {
  listRecaptureLeads,
  getRecaptureLead,
  claimRecaptureLead,
  claimNextRecaptureLead,
} from '@/api/recaptacion.api';
import {
  useRecaptacionLeads,
  useRecaptacionLead,
  useClaimLead,
  useClaimNext,
} from '@/hooks/useRecaptacion';
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
