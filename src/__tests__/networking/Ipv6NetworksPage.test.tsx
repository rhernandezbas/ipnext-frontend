import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Ipv6NetworksPage from '@/pages/networking/Ipv6NetworksPage';

vi.mock('@/hooks/useNetwork', () => ({
  useIpv6Networks: vi.fn(),
}));

import { useIpv6Networks } from '@/hooks/useNetwork';

const mockNetworks = [
  { id: '1', network: '2001:db8::/32', description: 'Red IPv6 principal', delegationPrefix: 48, type: 'static' as const, usedPrefixes: 10, totalPrefixes: 100, status: 'active' as const },
];

describe('Ipv6NetworksPage', () => {
  beforeEach(() => {
    vi.mocked(useIpv6Networks).mockReturnValue({
      data: mockNetworks,
      isLoading: false,
    } as ReturnType<typeof useIpv6Networks>);
  });

  it('renders heading "Redes IPv6"', () => {
    render(<MemoryRouter><Ipv6NetworksPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Redes IPv6/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useIpv6Networks).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useIpv6Networks>);
    render(<MemoryRouter><Ipv6NetworksPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Redes IPv6/i })).toBeInTheDocument();
  });

  it('renders table with network data', () => {
    render(<MemoryRouter><Ipv6NetworksPage /></MemoryRouter>);
    expect(screen.getByText('2001:db8::/32')).toBeInTheDocument();
  });
});
