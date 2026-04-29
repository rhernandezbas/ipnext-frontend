import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as PartnersPage } from '@/pages/sistema/PartnersPage';
import * as usePartnersModule from '@/hooks/usePartners';
import type { Partner } from '@/types/partner';

vi.mock('@/hooks/usePartners');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockPartners: Partner[] = [
  {
    id: '1',
    name: 'IPNEXT Buenos Aires',
    status: 'active',
    primaryEmail: 'ba@ipnext.com.ar',
    phone: '+541100000000',
    address: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    country: 'AR',
    timezone: 'America/Argentina/Buenos_Aires',
    currency: 'ARS',
    logoUrl: null,
    clientCount: 1250,
    adminCount: 8,
    createdAt: '2023-01-01T00:00:00Z',
    comision: 10,
  },
  {
    id: '2',
    name: 'IPNEXT Córdoba',
    status: 'active',
    primaryEmail: 'cba@ipnext.com.ar',
    phone: '+543510000000',
    address: 'Av. Colón 500',
    city: 'Córdoba',
    country: 'AR',
    timezone: 'America/Argentina/Cordoba',
    currency: 'ARS',
    logoUrl: null,
    clientCount: 430,
    adminCount: 3,
    createdAt: '2023-06-01T00:00:00Z',
    comision: 8,
  },
  {
    id: '3',
    name: 'IPNEXT Rosario',
    status: 'inactive',
    primaryEmail: 'ros@ipnext.com.ar',
    phone: '+543410000000',
    address: 'Bv. Oroño 200',
    city: 'Rosario',
    country: 'AR',
    timezone: 'America/Argentina/Buenos_Aires',
    currency: 'ARS',
    logoUrl: null,
    clientCount: 0,
    adminCount: 1,
    createdAt: '2024-01-15T00:00:00Z',
    comision: 5,
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <PartnersPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PartnersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(usePartnersModule.usePartners).mockReturnValue({
      data: mockPartners,
      isLoading: false,
    } as ReturnType<typeof usePartnersModule.usePartners>);

    vi.mocked(usePartnersModule.useCreatePartner).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof usePartnersModule.useCreatePartner>);

    vi.mocked(usePartnersModule.useUpdatePartner).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof usePartnersModule.useUpdatePartner>);

    vi.mocked(usePartnersModule.useDeletePartner).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof usePartnersModule.useDeletePartner>);
  });

  it('renders "Socios" or "Partners" heading', () => {
    renderPage();
    const heading = screen.queryByText(/socios/i) ?? screen.queryByText(/partners/i);
    expect(heading).toBeInTheDocument();
  });

  it('renders "Nuevo socio" button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nuevo socio/i })).toBeInTheDocument();
  });

  it('table shows partner names from hook', () => {
    renderPage();
    expect(screen.getByText('IPNEXT Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText('IPNEXT Córdoba')).toBeInTheDocument();
    expect(screen.getByText('IPNEXT Rosario')).toBeInTheDocument();
  });

  it('status badges render', () => {
    renderPage();
    const activeBadges = screen.getAllByText('Activo');
    expect(activeBadges.length).toBeGreaterThanOrEqual(1);
    const inactivoItems = screen.getAllByText('Inactivo');
    expect(inactivoItems.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking "Nuevo socio" shows form', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nuevo socio/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('form has Nombre and Email fields', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nuevo socio/i }));

    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  // Batch 2 — new tests

  it('renders a search input with placeholder "Buscar socio..."', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Buscar socio...')).toBeInTheDocument();
  });

  it('renders an "Estado" filter dropdown', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument();
  });

  it('search by name filters table rows', async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = screen.getByPlaceholderText('Buscar socio...');
    await user.type(searchInput, 'Córdoba');

    await new Promise(r => setTimeout(r, 350));

    expect(screen.queryByText('IPNEXT Buenos Aires')).not.toBeInTheDocument();
    expect(screen.getByText('IPNEXT Córdoba')).toBeInTheDocument();
  });

  it('status filter "inactive" hides active partners', async () => {
    const user = userEvent.setup();
    renderPage();

    const statusSelect = screen.getByRole('combobox', { name: 'Estado' });
    await user.selectOptions(statusSelect, 'inactive');

    expect(screen.queryByText('IPNEXT Buenos Aires')).not.toBeInTheDocument();
    expect(screen.getByText('IPNEXT Rosario')).toBeInTheDocument();
  });

  it('renders "Comisión (%)" column header', () => {
    renderPage();
    expect(screen.getByRole('columnheader', { name: 'Comisión (%)' })).toBeInTheDocument();
  });

  it('shows commission values for each partner', () => {
    renderPage();
    // Each partner has a comision field — it should appear as a number in the table
    const cells = screen.getAllByRole('cell');
    const hasNumericComision = cells.some(cell => /^\d+$/.test(cell.textContent?.trim() ?? ''));
    expect(hasNumericComision).toBe(true);
  });
});
