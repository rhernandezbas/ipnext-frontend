import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import NetworkTopologyPage from '@/pages/networking/NetworkTopologyPage';

vi.mock('@/hooks/useTopology', () => ({
  useTopology: vi.fn(),
}));

import { useTopology } from '@/hooks/useTopology';

const mockTopology = {
  id: 'isp-1',
  name: 'IPNEXT Core',
  type: 'isp',
  status: 'activo',
  children: [
    {
      id: 'router-1',
      name: 'Router Principal',
      type: 'router',
      status: 'activo',
      children: [
        {
          id: 'olt-1',
          name: 'OLT Norte',
          type: 'olt',
          status: 'activo',
          children: [],
        },
      ],
    },
  ],
};

describe('NetworkTopologyPage', () => {
  beforeEach(() => {
    vi.mocked(useTopology).mockReturnValue({
      data: mockTopology,
      isLoading: false,
    } as ReturnType<typeof useTopology>);
  });

  it('renders heading "Topología de Red"', () => {
    render(<MemoryRouter><NetworkTopologyPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /topología de red/i })).toBeInTheDocument();
  });

  it('renders the root ISP node', () => {
    render(<MemoryRouter><NetworkTopologyPage /></MemoryRouter>);
    expect(screen.getByText('IPNEXT Core')).toBeInTheDocument();
  });

  it('renders child router node', () => {
    render(<MemoryRouter><NetworkTopologyPage /></MemoryRouter>);
    expect(screen.getByText('Router Principal')).toBeInTheDocument();
  });

  it('renders OLT child node', () => {
    render(<MemoryRouter><NetworkTopologyPage /></MemoryRouter>);
    expect(screen.getByText('OLT Norte')).toBeInTheDocument();
  });

  it('renders status badges for nodes', () => {
    render(<MemoryRouter><NetworkTopologyPage /></MemoryRouter>);
    const activos = screen.getAllByText(/activo/i);
    expect(activos.length).toBeGreaterThan(0);
  });
});
