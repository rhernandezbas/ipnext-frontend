import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import CrmDashboardPage from '@/pages/crm/CrmDashboardPage';

vi.mock('@/hooks/useLeads', () => ({
  useLeads: vi.fn(),
}));

import { useLeads } from '@/hooks/useLeads';

const mockLeads = [
  { id: '1', name: 'Carlos García', email: 'carlos@test.com', phone: '111', address: '', city: '', source: 'website', status: 'new', assignedTo: 'Admin', assignedToId: 'a1', interestedIn: '', notes: '', followUpDate: null, createdAt: '2026-04-28T10:00:00Z', convertedAt: null, convertedClientId: null },
  { id: '2', name: 'María López', email: 'maria@test.com', phone: '222', address: '', city: '', source: 'referral', status: 'contacted', assignedTo: 'Admin', assignedToId: 'a1', interestedIn: '', notes: '', followUpDate: null, createdAt: '2026-04-27T10:00:00Z', convertedAt: null, convertedClientId: null },
  { id: '3', name: 'Pedro Ruiz', email: 'pedro@test.com', phone: '333', address: '', city: '', source: 'cold_call', status: 'qualified', assignedTo: 'Admin', assignedToId: 'a1', interestedIn: '', notes: '', followUpDate: null, createdAt: '2026-04-26T10:00:00Z', convertedAt: null, convertedClientId: null },
  { id: '4', name: 'Ana Martínez', email: 'ana@test.com', phone: '444', address: '', city: '', source: 'social_media', status: 'won', assignedTo: 'Admin', assignedToId: 'a1', interestedIn: '', notes: '', followUpDate: null, createdAt: '2026-04-25T10:00:00Z', convertedAt: '2026-04-26T00:00:00Z', convertedClientId: 'c1' },
  { id: '5', name: 'Luis Fernández', email: 'luis@test.com', phone: '555', address: '', city: '', source: 'other', status: 'lost', assignedTo: 'Admin', assignedToId: 'a1', interestedIn: '', notes: '', followUpDate: null, createdAt: '2026-04-24T10:00:00Z', convertedAt: null, convertedClientId: null },
];

describe('CrmDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(useLeads).mockReturnValue({
      data: mockLeads,
      isLoading: false,
    } as ReturnType<typeof useLeads>);
  });

  it('renders heading "CRM — Panel"', () => {
    render(<MemoryRouter><CrmDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /CRM — Panel/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useLeads).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useLeads>);
    render(<MemoryRouter><CrmDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /CRM — Panel/i })).toBeInTheDocument();
  });

  it('"En proceso" KPI shows correct aggregation', () => {
    render(<MemoryRouter><CrmDashboardPage /></MemoryRouter>);
    // contacted + qualified = 2, proposal_sent = 0 → total 2
    const enProcesoLabel = screen.getByText('En proceso');
    const card = enProcesoLabel.closest('[class*="kpiCard"]');
    const val = card?.querySelector('[class*="kpiValue"]');
    expect(val?.textContent).toBe('2');
  });
});
