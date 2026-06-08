import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NetworkSite } from '@/types/networkSite';

const mockSites: NetworkSite[] = [
  {
    id: 'ns-1',
    name: 'Nodo Central',
    address: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    coordinates: null,
    type: 'nodo',
    status: 'active',
    deviceCount: 10,
    clientCount: 200,
    uplink: '10 Gbps',
    parentSiteId: null,
    description: 'Nodo principal',
    iclassNodeCode: 'NODO-C-01',
  },
  {
    id: 'ns-2',
    name: 'POP Norte',
    address: 'Av. Cabildo 2500',
    city: 'Buenos Aires',
    coordinates: null,
    type: 'pop',
    status: 'active',
    deviceCount: 5,
    clientCount: 100,
    uplink: '1 Gbps',
    parentSiteId: 'ns-1',
    description: 'POP norte',
    iclassNodeCode: null,
  },
];

// Mutable holder so individual tests can drive the hook's return value
// (a top-level vi.mock factory is hoisted, so it must read from a hoisted ref;
// vi.doMock after the import does NOT re-wire the already-imported component).
const hook = vi.hoisted(() => ({ ret: { data: [] as unknown[], isLoading: false } }));
vi.mock('@/hooks/useNetworkSites', () => ({
  useNetworkSites: () => hook.ret,
}));

import { NodeSelector } from '@/components/NodeSelector';

describe('NodeSelector', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    hook.ret = { data: mockSites, isLoading: false };
  });

  it('renders a list of network sites', () => {
    render(<NodeSelector value={null} onChange={onChange} />);
    expect(screen.getByText('Nodo Central')).toBeInTheDocument();
    expect(screen.getByText('POP Norte')).toBeInTheDocument();
  });

  it('shows city under each site name', () => {
    render(<NodeSelector value={null} onChange={onChange} />);
    // Both sites are in Buenos Aires
    expect(screen.getAllByText('Buenos Aires').length).toBeGreaterThanOrEqual(2);
  });

  it('calls onChange with the site id when a site is clicked', () => {
    render(<NodeSelector value={null} onChange={onChange} />);
    fireEvent.click(screen.getByText('Nodo Central'));
    expect(onChange).toHaveBeenCalledWith('ns-1');
  });

  it('marks the selected site visually with aria-selected', () => {
    render(<NodeSelector value="ns-1" onChange={onChange} />);
    const selected = screen.getByRole('option', { name: /Nodo Central/i });
    expect(selected).toHaveAttribute('aria-selected', 'true');
  });

  it('deselects when the selected site is clicked again', () => {
    render(<NodeSelector value="ns-1" onChange={onChange} />);
    fireEvent.click(screen.getByRole('option', { name: /Nodo Central/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('filters sites by search query', () => {
    render(<NodeSelector value={null} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/buscar nodo/i), { target: { value: 'central' } });
    expect(screen.getByText('Nodo Central')).toBeInTheDocument();
    expect(screen.queryByText('POP Norte')).not.toBeInTheDocument();
  });

  it('shows empty state when no sites match the search', () => {
    render(<NodeSelector value={null} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/buscar nodo/i), { target: { value: 'zzznomatch' } });
    expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();
  });

  it('shows the loading indicator while sites are loading', () => {
    hook.ret = { data: [], isLoading: true };
    render(<NodeSelector value={null} onChange={onChange} />);
    // Actually exercises the isLoading branch (was a tautology before).
    expect(screen.getByText(/cargando nodos/i)).toBeInTheDocument();
    // And the list is not rendered while loading.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
