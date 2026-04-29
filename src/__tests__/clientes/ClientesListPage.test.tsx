import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ClientesListPage from '@/pages/clientes/ClientesListPage';
import * as useClientsModule from '@/hooks/useClients';
import type { CustomerSummary } from '@/types/customer';

vi.mock('@/hooks/useClients');

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockCustomers: CustomerSummary[] = [
  { id: 1, name: 'Alice García', email: 'alice@example.com', phone: '11-1111-1111', status: 'active', balance: 0, category: 'residential', tariffPlan: 'Plan 50MB', login: 'alice', ipRanges: '192.168.1.0/24', accessDevices: 1, createdAt: '2024-01-01' },
  { id: 2, name: 'Bob Martínez', email: 'bob@example.com', phone: '22-2222-2222', status: 'inactive', balance: 0, category: 'residential', tariffPlan: null, login: null, ipRanges: null, accessDevices: 0, createdAt: '2024-02-01' },
];

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={['/admin/customers/list']}>
        <Routes>
          <Route path="/admin/customers/list" element={<ClientesListPage />} />
          <Route path="/admin/customers/view/:id" element={<div>Cliente Detalle</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ClientesListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClientsModule.useClientList).mockReturnValue({
      data: { data: mockCustomers, total: 2, page: 1, totalPages: 1 },
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientList>);
  });

  it('renders page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
  });

  it('renders customer rows', () => {
    renderPage();
    expect(screen.getByText('Alice García')).toBeInTheDocument();
    expect(screen.getByText('Bob Martínez')).toBeInTheDocument();
  });

  it('renders status badges for customers', () => {
    renderPage();
    // "Activo" appears in the filter dropdown AND as StatusBadge — both valid
    expect(screen.getAllByText('Activo').length).toBeGreaterThanOrEqual(2);
    // "Inactivo" appears in the filter dropdown AND as StatusBadge
    expect(screen.getAllByText('Inactivo').length).toBeGreaterThanOrEqual(2);
  });

  it('shows skeleton while loading', () => {
    vi.mocked(useClientsModule.useClientList).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useClientsModule.useClientList>);

    const { container } = renderPage();
    const skeletonRows = container.querySelectorAll('tbody tr');
    expect(skeletonRows).toHaveLength(5);
  });

  it('renders search input', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Buscar cliente...')).toBeInTheDocument();
  });

  it('renders status filter dropdown', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument();
  });

  it('shows empty message when no clients', () => {
    vi.mocked(useClientsModule.useClientList).mockReturnValue({
      data: { data: [], total: 0, page: 1, totalPages: 1 },
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientList>);
    renderPage();
    expect(screen.getByText('No se encontraron clientes.')).toBeInTheDocument();
  });

  it('navigates to client detail on "Ver detalle" action', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: 'Acciones' })[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }));

    await waitFor(() => {
      expect(screen.getByText('Cliente Detalle')).toBeInTheDocument();
    });
  });

  it('calls useClientList with initial empty search', () => {
    renderPage();
    const calls = vi.mocked(useClientsModule.useClientList).mock.calls;
    expect(calls[0][0]).toMatchObject({ page: 1, limit: 25 });
  });

  it('passes status filter to useClientList', () => {
    renderPage();
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado' }), {
      target: { value: 'active' },
    });
    const calls = vi.mocked(useClientsModule.useClientList).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.status).toBe('active');
  });

  it('"Acciones" batch button is present', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Acciones en lote' })).toBeInTheDocument();
  });

  it('"Acciones en lote" button is disabled when no rows selected', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Acciones en lote' })).toBeDisabled();
  });

  it('"Acciones en lote" button is enabled after selecting rows', async () => {
    const user = userEvent.setup();
    renderPage();

    // click the select-all checkbox (first checkbox in the table)
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    expect(screen.getByRole('button', { name: 'Acciones en lote' })).not.toBeDisabled();
  });

  it('clicking "Acciones en lote" shows dropdown with "Bloquear seleccionados"', async () => {
    const user = userEvent.setup();
    renderPage();

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]); // select all

    await user.click(screen.getByRole('button', { name: 'Acciones en lote' }));
    expect(screen.getByText('Bloquear seleccionados')).toBeInTheDocument();
  });

  // R1: Row expansion
  it('each row has an "Expandir fila" button', () => {
    renderPage();
    const expandBtns = screen.getAllByRole('button', { name: 'Expandir fila' });
    expect(expandBtns).toHaveLength(mockCustomers.length);
  });

  it('clicking expand button shows expanded email panel for that client', async () => {
    const user = userEvent.setup();
    renderPage();

    const expandBtns = screen.getAllByRole('button', { name: 'Expandir fila' });
    await user.click(expandBtns[0]);

    // The expanded row shows "Email: alice@example.com" as a labeled span
    expect(screen.getByText('Email: alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Teléfono: 11-1111-1111')).toBeInTheDocument();
  });

  it('clicking expand button again collapses the expanded content', async () => {
    const user = userEvent.setup();
    renderPage();

    const expandBtns = screen.getAllByRole('button', { name: 'Expandir fila' });
    await user.click(expandBtns[0]);
    // Now expanded — button label changes to "Colapsar fila"
    const collapseBtn = screen.getByRole('button', { name: 'Colapsar fila' });
    await user.click(collapseBtn);

    // The labeled spans from the expanded panel are gone
    expect(screen.queryByText('Email: alice@example.com')).not.toBeInTheDocument();
  });

  // E1: Export button
  it('has an "Exportar" button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
  });

  it('clicking "Exportar" does not throw', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    // no error thrown
  });
});
