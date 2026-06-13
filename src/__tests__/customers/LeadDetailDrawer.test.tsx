/**
 * LeadDetailDrawer — tests for:
 *   #3a  status selector (6 options, change calls useUpdateLeadStatus, gated by recapture.manage)
 *   #3b  assignee name (assigneeName shown in the meta grid)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock the hooks this component uses ────────────────────────────────────────

vi.mock('@/hooks/useRecaptacion', () => ({
  useRecaptacionLead:   vi.fn(),
  useClaimLead:         vi.fn(),
  useReleaseLead:       vi.fn(),
  useAddContact:        vi.fn(),
  useUpdateLeadStatus:  vi.fn(),
}));

import {
  useRecaptacionLead,
  useClaimLead,
  useReleaseLead,
  useAddContact,
  useUpdateLeadStatus,
} from '@/hooks/useRecaptacion';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';

import { LeadDetailDrawer } from '@/pages/customers/RecaptacionPage/components/LeadDetailDrawer';
import type { RecaptureLeadDto } from '@/types/recaptacion';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_LEAD: RecaptureLeadDto = {
  id: 'lead-42',
  source: 'churned_client',
  clientId: 'client-1',
  contactName: 'Ana García',
  phone: '+5491144556677',
  email: 'ana@example.com',
  status: 'nuevo',
  assigneeId: null,
  assigneeName: null,
  claimedAt: null,
  createdAt: '2026-06-13T10:00:00.000Z',
  updatedAt: '2026-06-13T10:00:00.000Z',
};

const LEAD_WITH_ASSIGNEE: RecaptureLeadDto = {
  ...BASE_LEAD,
  assigneeId: 'user-99',
  assigneeName: 'María López',
  claimedAt: '2026-06-13T10:05:00.000Z',
};

const mutate       = vi.fn();
const mutateStatus = vi.fn();

function mockHooks(opts?: { hasPermission?: boolean }) {
  const hasPermission = opts?.hasPermission ?? true;

  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: hasPermission ? ['*'] : [],
    isLoading: false,
    isError: false,
    can: () => hasPermission,
  } as UseMyPermissionsResult);

  vi.mocked(useRecaptacionLead).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as ReturnType<typeof useRecaptacionLead>);

  vi.mocked(useClaimLead).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useClaimLead>);

  vi.mocked(useReleaseLead).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useReleaseLead>);

  vi.mocked(useAddContact).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useAddContact>);

  vi.mocked(useUpdateLeadStatus).mockReturnValue({
    mutate: mutateStatus,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useUpdateLeadStatus>);
}

function renderDrawer(lead: RecaptureLeadDto | null = BASE_LEAD) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LeadDetailDrawer lead={lead} onClose={vi.fn()} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHooks();
});

// ── #3a — status selector ─────────────────────────────────────────────────────

describe('LeadDetailDrawer — status selector (#3a)', () => {
  it('D1 — renders a status select with 6 options', () => {
    renderDrawer();
    const select = screen.getByRole('combobox', { name: /estado/i });
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    const values = options.map((o) => (o as HTMLOptionElement).value);
    expect(values).toContain('nuevo');
    expect(values).toContain('en_gestion');
    expect(values).toContain('contactado');
    expect(values).toContain('interesado');
    expect(values).toContain('recuperado');
    expect(values).toContain('descartado');
    expect(options.length).toBe(6);
  });

  it('D2 — current lead status is pre-selected', () => {
    renderDrawer({ ...BASE_LEAD, status: 'interesado' });
    const select = screen.getByRole('combobox', { name: /estado/i }) as HTMLSelectElement;
    expect(select.value).toBe('interesado');
  });

  it('D3 — changing status calls useUpdateLeadStatus.mutate with {id, status}', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const select = screen.getByRole('combobox', { name: /estado/i });
    await user.selectOptions(select, 'contactado');

    expect(mutateStatus).toHaveBeenCalledWith({ id: 'lead-42', status: 'contactado' });
  });

  it('D4 — select is disabled while mutation is pending', () => {
    vi.mocked(useUpdateLeadStatus).mockReturnValue({
      mutate: mutateStatus,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useUpdateLeadStatus>);

    renderDrawer();
    const select = screen.getByRole('combobox', { name: /estado/i });
    expect(select).toBeDisabled();
  });

  it('D5 — status selector is NOT rendered when user lacks recapture.manage', () => {
    mockHooks({ hasPermission: false });
    renderDrawer();
    expect(screen.queryByRole('combobox', { name: /estado/i })).not.toBeInTheDocument();
  });
});

// ── #3b — assignee name ───────────────────────────────────────────────────────

describe('LeadDetailDrawer — assignee name (#3b)', () => {
  it('D6 — shows assigneeName in meta grid when present', () => {
    renderDrawer(LEAD_WITH_ASSIGNEE);
    expect(screen.getByText('María López')).toBeInTheDocument();
  });

  it('D7 — shows fallback "—" when assigneeName is null', () => {
    renderDrawer({ ...BASE_LEAD, assigneeId: null, assigneeName: null });
    // The "Asignado" label must be present
    expect(screen.getByText('Asignado')).toBeInTheDocument();
    // And the fallback dash — use getAllByText because other meta fields also use '—'
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('D8 — does NOT render raw assigneeId when assigneeName is provided', () => {
    renderDrawer(LEAD_WITH_ASSIGNEE);
    expect(screen.queryByText('user-99')).not.toBeInTheDocument();
  });
});
