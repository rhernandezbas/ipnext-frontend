import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Ipv4NetworksPage from '@/pages/networking/Ipv4NetworksPage';

vi.mock('@/hooks/useNetwork', () => ({
  useIpNetworks: vi.fn(),
}));

import { useIpNetworks } from '@/hooks/useNetwork';

const mockNetworks = [
  { id: '1', network: '192.168.1.0/24', gateway: '192.168.1.1', dns1: '8.8.8.8', dns2: '8.8.4.4', description: 'Red local', partnerId: null, type: 'static' as const, totalIps: 254, usedIps: 50, freeIps: 204 },
  { id: '2', network: '10.0.0.0/8', gateway: '10.0.0.1', dns1: '1.1.1.1', dns2: '1.0.0.1', description: 'Red corporativa', partnerId: null, type: 'dhcp' as const, totalIps: 1000, usedIps: 300, freeIps: 700 },
];

describe('Ipv4NetworksPage', () => {
  beforeEach(() => {
    vi.mocked(useIpNetworks).mockReturnValue({
      data: mockNetworks,
      isLoading: false,
    } as ReturnType<typeof useIpNetworks>);
  });

  it('renders heading "Redes IPv4"', () => {
    render(<MemoryRouter><Ipv4NetworksPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Redes IPv4/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useIpNetworks).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useIpNetworks>);
    render(<MemoryRouter><Ipv4NetworksPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Redes IPv4/i })).toBeInTheDocument();
  });

  it('KPI "Total redes" shows count', () => {
    render(<MemoryRouter><Ipv4NetworksPage /></MemoryRouter>);
    expect(screen.getByText('Total redes')).toBeInTheDocument();
    const label = screen.getByText('Total redes');
    const card = label.closest('[class*="kpiCard"]');
    const val = card?.querySelector('[class*="kpiValue"]');
    expect(val?.textContent).toBe('2');
  });
});
