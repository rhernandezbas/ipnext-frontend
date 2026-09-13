/**
 * SuricataTicketsPage (Fase G, task G.5) — composition root for the panel.
 * RBAC gating (`suricata.read`) lives at the route level (App.tsx
 * `RequirePermission`, same convention as every other gated route) — this
 * test only covers that the page renders its title plus both children.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/pages/suricata/SuricataKpiStrip', () => ({
  SuricataKpiStrip: () => <div data-testid="kpi-strip-stub" />,
}));
vi.mock('@/pages/suricata/SuricataTicketList', () => ({
  SuricataTicketList: () => <div data-testid="ticket-list-stub" />,
}));
// SyncNowButton's useTriggerSuricataSync is a REAL react-query useMutation
// (needs useQueryClient) -- safe default, same criterion as useNewsUnreadCount
// in src/test/setup.ts (a real hook pervasively called by a composed page).
vi.mock('@/pages/suricata/hooks/useSuricataTickets', () => ({
  useTriggerSuricataSync: () => ({ mutate: vi.fn(), isPending: false, isError: false, data: undefined }),
}));

import SuricataTicketsPage from '@/pages/suricata/SuricataTicketsPage';

describe('SuricataTicketsPage composition', () => {
  it('renders the page title, the KPI strip and the ticket list', () => {
    render(<SuricataTicketsPage />);
    expect(screen.getByRole('heading', { name: /tickets suricata/i })).toBeInTheDocument();
    expect(screen.getByTestId('kpi-strip-stub')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-list-stub')).toBeInTheDocument();
  });
});
