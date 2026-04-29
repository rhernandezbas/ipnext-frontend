import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import UbicacionesPage from '@/pages/sistema/UbicacionesPage';
import * as useUbicacionesModule from '@/hooks/useUbicaciones';
import type { Ubicacion } from '@/types/ubicacion';

vi.mock('@/hooks/useUbicaciones');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockUbicaciones: Ubicacion[] = [
  {
    id: '1',
    name: 'Main',
    address: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    state: 'CABA',
    country: 'Argentina',
    phone: '+54 11 4000-0001',
    email: 'main@ipnext.com.ar',
    manager: 'Admin Principal',
    clientCount: 523,
    status: 'active',
    coordinates: { lat: -34.6037, lng: -58.3816 },
    timezone: 'America/Argentina/Buenos_Aires',
  },
  {
    id: '2',
    name: 'Mercedes',
    address: 'Calle Real 450',
    city: 'Mercedes',
    state: 'Buenos Aires',
    country: 'Argentina',
    phone: '+54 2324 400-100',
    email: 'mercedes@ipnext.com.ar',
    manager: 'María López',
    clientCount: 215,
    status: 'active',
    coordinates: null,
    timezone: 'America/Argentina/Buenos_Aires',
  },
  {
    id: '3',
    name: 'Achupallas',
    address: 'Ruta 25 km 12',
    city: 'Achupallas',
    state: 'Buenos Aires',
    country: 'Argentina',
    phone: '+54 2343 400-300',
    email: 'achupallas@ipnext.com.ar',
    manager: 'Roberto Sánchez',
    clientCount: 128,
    status: 'inactive',
    coordinates: null,
    timezone: 'America/Argentina/Buenos_Aires',
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <UbicacionesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('UbicacionesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useUbicacionesModule.useUbicaciones).mockReturnValue({
      data: mockUbicaciones,
      isLoading: false,
    } as ReturnType<typeof useUbicacionesModule.useUbicaciones>);

    vi.mocked(useUbicacionesModule.useCreateUbicacion).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUbicacionesModule.useCreateUbicacion>);

    vi.mocked(useUbicacionesModule.useUpdateUbicacion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUbicacionesModule.useUpdateUbicacion>);

    vi.mocked(useUbicacionesModule.useDeleteUbicacion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUbicacionesModule.useDeleteUbicacion>);
  });

  it('renders "Ubicaciones" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Ubicaciones' })).toBeInTheDocument();
  });

  it('"Nueva ubicación" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Nueva ubicación' })).toBeInTheDocument();
  });

  it('summary cards render (total count)', () => {
    renderPage();
    // Total ubicaciones = 3
    expect(screen.getByText('Total ubicaciones')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('table shows location names from mock', () => {
    renderPage();
    // Names appear in both name column and possibly city column
    expect(screen.getAllByText('Main').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Mercedes').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Achupallas').length).toBeGreaterThanOrEqual(1);
  });

  it('clicking "Nueva ubicación" shows form', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Nueva ubicación' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('form has Nombre and Ciudad fields', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Nueva ubicación' }));

    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Ciudad')).toBeInTheDocument();
  });

  // Batch 3 — new tests

  it('renders a search input with placeholder "Buscar por nombre o ciudad..."', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Buscar por nombre o ciudad...')).toBeInTheDocument();
  });

  it('renders an "Estado" filter dropdown', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument();
  });

  it('search by name filters table rows', async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = screen.getByPlaceholderText('Buscar por nombre o ciudad...');
    await user.type(searchInput, 'Mercedes');

    await new Promise(r => setTimeout(r, 350));

    expect(screen.queryByText('Achupallas')).not.toBeInTheDocument();
    expect(screen.getAllByText('Mercedes').length).toBeGreaterThanOrEqual(1);
  });

  it('status filter "inactive" hides active locations', async () => {
    const user = userEvent.setup();
    renderPage();

    const statusSelect = screen.getByRole('combobox', { name: 'Estado' });
    await user.selectOptions(statusSelect, 'inactive');

    expect(screen.queryByText('Main')).not.toBeInTheDocument();
    expect(screen.getAllByText('Achupallas').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Ubicación padre" column header in table', () => {
    renderPage();
    expect(screen.getByRole('columnheader', { name: 'Ubicación padre' })).toBeInTheDocument();
  });
});
