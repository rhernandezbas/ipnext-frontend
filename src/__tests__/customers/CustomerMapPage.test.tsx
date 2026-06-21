import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import CustomerMapPage from '@/pages/customers/CustomerMapPage';

// CustomerMapPage now uses useZones (TanStack Query) so it needs a QueryClientProvider.
// We mock useZones to return an empty list so the test doesn't hit the network.
const mockUseZones = vi.fn(() => ({ data: [], isLoading: false, isError: false }));

vi.mock('@/hooks/useZones', () => ({
  useZones: () => mockUseZones(),
  useCreateZone: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateZone: vi.fn(() => ({ mutate: vi.fn() })),
  useDeleteZone: vi.fn(() => ({ mutate: vi.fn() })),
}));

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(MemoryRouter, null, children),
    );
}

const TWO_ZONES = [
  {
    id: 'zone-1',
    name: 'Zona Norte',
    color: '#3b82f6',
    points: [
      { lat: -34.53, lng: -58.48 },
      { lat: -34.55, lng: -58.45 },
      { lat: -34.57, lng: -58.42 },
    ],
    description: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'zone-2',
    name: 'Zona Sur',
    color: '#22c55e',
    points: [
      { lat: -34.63, lng: -58.33 },
      { lat: -34.65, lng: -58.30 },
      { lat: -34.67, lng: -58.27 },
    ],
    description: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  },
];

describe('CustomerMapPage', () => {
  beforeEach(() => {
    mockUseZones.mockReturnValue({ data: [], isLoading: false, isError: false });
  });

  it('renders the page title', () => {
    render(<CustomerMapPage />, { wrapper: makeWrapper() });
    expect(screen.getByRole('heading', { name: /Mapa de clientes/i })).toBeInTheDocument();
  });

  it('renders a map container', () => {
    render(<CustomerMapPage />, { wrapper: makeWrapper() });
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('renders customer markers', () => {
    render(<CustomerMapPage />, { wrapper: makeWrapper() });
    expect(screen.getAllByTestId('map-marker').length).toBeGreaterThanOrEqual(10);
  });

  // C1 — read-only path: two zones render without crashing (needs Polygon in mock)
  it('renders both zone polygons in read-only mode (non-empty zones)', () => {
    mockUseZones.mockReturnValue({ data: TWO_ZONES, isLoading: false, isError: false });
    render(<CustomerMapPage />, { wrapper: makeWrapper() });
    const polygons = screen.getAllByTestId('polygon');
    expect(polygons).toHaveLength(2);
  });

  // W4 — isError: shows error message when zones fetch fails
  it('shows an error message when zones fail to load', () => {
    mockUseZones.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<CustomerMapPage />, { wrapper: makeWrapper() });
    expect(screen.getByRole('alert', { hidden: false })).toHaveTextContent(
      'No se pudieron cargar las zonas.',
    );
  });
});
