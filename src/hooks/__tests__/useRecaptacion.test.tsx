import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/recaptacion.api', () => ({
  listRecaptureLeads:        vi.fn(),
  getRecaptureLead:          vi.fn(),
  updateRecaptureLeadStatus: vi.fn(),
  addRecaptureContact:       vi.fn(),
  assignRecaptureLead:       vi.fn(),
  assignBulkRecaptureLeads:  vi.fn(),
}));

import {
  listRecaptureLeads,
  getRecaptureLead,
  assignRecaptureLead,
  assignBulkRecaptureLeads,
} from '@/api/recaptacion.api';
import {
  useRecaptacionLeads,
  useRecaptacionLead,
  useAssignLead,
  useAssignBulk,
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
  assigneeName: null,
  technologies: [],
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

// ── useAssignLead ─────────────────────────────────────────────────────────────

describe('useAssignLead', () => {
  it('calls assignRecaptureLead with leadId and operatorId', async () => {
    vi.mocked(assignRecaptureLead).mockResolvedValue({
      ...LEAD,
      assigneeId: 'operator-5',
      assigneeName: 'Operator Name',
    });

    const { result } = renderHook(() => useAssignLead(), { wrapper });

    result.current.mutate({ leadId: 'lead-1', operatorId: 'operator-5' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(assignRecaptureLead).toHaveBeenCalledWith('lead-1', 'operator-5');
  });

  it('passes null operatorId to unassign', async () => {
    vi.mocked(assignRecaptureLead).mockResolvedValue({
      ...LEAD,
      assigneeId: null,
      assigneeName: null,
    });

    const { result } = renderHook(() => useAssignLead(), { wrapper });

    result.current.mutate({ leadId: 'lead-1', operatorId: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(assignRecaptureLead).toHaveBeenCalledWith('lead-1', null);
  });

  it('invalidates recaptacion list and lead detail on success', async () => {
    vi.mocked(assignRecaptureLead).mockResolvedValue({ ...LEAD });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAssignLead(), { wrapper: localWrapper });

    result.current.mutate({ leadId: 'lead-1', operatorId: 'operator-5' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recaptacion'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recaptacion-lead', 'lead-1'] });
  });
});

// ── useAssignBulk ─────────────────────────────────────────────────────────────

describe('useAssignBulk', () => {
  it('calls assignBulkRecaptureLeads with leadIds and operatorId', async () => {
    vi.mocked(assignBulkRecaptureLeads).mockResolvedValue({ assigned: 2 });

    const { result } = renderHook(() => useAssignBulk(), { wrapper });

    result.current.mutate({ leadIds: ['l1', 'l2'], operatorId: 'op-2' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(assignBulkRecaptureLeads).toHaveBeenCalledWith({ leadIds: ['l1', 'l2'], operatorId: 'op-2' });
    expect(result.current.data).toEqual({ assigned: 2 });
  });

  it('passes null operatorId to bulk-unassign', async () => {
    vi.mocked(assignBulkRecaptureLeads).mockResolvedValue({ assigned: 1 });

    const { result } = renderHook(() => useAssignBulk(), { wrapper });

    result.current.mutate({ leadIds: ['l1'], operatorId: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(assignBulkRecaptureLeads).toHaveBeenCalledWith({ leadIds: ['l1'], operatorId: null });
  });

  it('invalidates the recaptacion list on success', async () => {
    vi.mocked(assignBulkRecaptureLeads).mockResolvedValue({ assigned: 3 });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAssignBulk(), { wrapper: localWrapper });

    result.current.mutate({ leadIds: ['l1', 'l2', 'l3'], operatorId: 'op-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recaptacion'] });
  });
});
