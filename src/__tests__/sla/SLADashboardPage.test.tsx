import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import SLADashboardPage from '@/pages/sla/SLADashboardPage';

vi.mock('@/hooks/useSla', () => ({
  useSlaStats: vi.fn(),
}));

import { useSlaStats } from '@/hooks/useSla';

const mockStats = {
  uptimePercent: 99.2,
  breaches: 3,
  activeIncidents: 2,
  mttr: 45,
};

describe('SLADashboardPage', () => {
  beforeEach(() => {
    vi.mocked(useSlaStats).mockReturnValue({
      data: mockStats,
      isLoading: false,
    } as ReturnType<typeof useSlaStats>);
  });

  it('renders heading "SLA Management"', () => {
    render(<MemoryRouter><SLADashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /SLA Management/i })).toBeInTheDocument();
  });

  it('renders Uptime % KPI card with value', () => {
    render(<MemoryRouter><SLADashboardPage /></MemoryRouter>);
    expect(screen.getByText('99.2%')).toBeInTheDocument();
  });

  it('renders Breaches KPI card with value', () => {
    render(<MemoryRouter><SLADashboardPage /></MemoryRouter>);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders Incidentes activos KPI card', () => {
    render(<MemoryRouter><SLADashboardPage /></MemoryRouter>);
    expect(screen.getByText(/incidentes activos/i)).toBeInTheDocument();
  });

  it('renders MTTR KPI card with value', () => {
    render(<MemoryRouter><SLADashboardPage /></MemoryRouter>);
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText(/mttr/i)).toBeInTheDocument();
  });
});
