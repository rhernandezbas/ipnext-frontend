/**
 * DEUDA #5 — CustomersListPage: dropdown "Acciones en lote" portalizado.
 *
 * STRICT TDD: estos tests deben FALLAR antes de la implementación.
 *
 * El dropdown se renderiza vía createPortal al body (fuera del contenedor .actionsBar),
 * abre/cierra correctamente.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CustomersListPage from '@/pages/customers/CustomersListPage';
import * as useClientsModule from '@/hooks/useCustomers';
import type { CustomerSummary } from '@/types/customer';

vi.mock('@/hooks/useCustomers');

const mockCustomers: CustomerSummary[] = [
  { id: 1, name: 'Alice García', email: 'alice@example.com', phone: '11-1111-1111', status: 'active', category: 'residential', tariffPlan: 'Plan 50MB', login: 'alice', ipRanges: '192.168.1.0/24', accessDevices: 1, createdAt: '2024-01-01' },
  { id: 2, name: 'Bob Martínez', email: 'bob@example.com', phone: '22-2222-2222', status: 'inactive', category: 'residential', tariffPlan: null, login: null, ipRanges: null, accessDevices: 0, createdAt: '2024-02-01' },
];

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/customers/list']}>
        <Routes>
          <Route path="/admin/customers/list" element={<CustomersListPage />} />
          <Route path="/admin/customers/view/:id" element={<div>Cliente Detalle</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CustomersListPage – actionsDropdown portalizado (Deuda #5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClientsModule.useClientList).mockReturnValue({
      data: { data: mockCustomers, total: 2, page: 1, totalPages: 1 },
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientList>);
    vi.mocked(useClientsModule.useClientStats).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientStats>);
    vi.mocked(useClientsModule.useToggleClientStatus).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useToggleClientStatus>);
  });

  it('el dropdown se renderiza fuera del contenedor de la página (portal al body)', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    // Seleccionar al menos una fila para habilitar el botón
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    await user.click(screen.getByRole('button', { name: 'Acciones en lote' }));

    // El dropdown debe estar en document.body, NO dentro del container
    const dropdown = document.body.querySelector('[data-testid="acciones-lote-dropdown"]');
    expect(dropdown).not.toBeNull();
    expect(container.querySelector('[data-testid="acciones-lote-dropdown"]')).toBeNull();
  });

  it('el dropdown se abre al clickear "Acciones en lote" con filas seleccionadas', async () => {
    const user = userEvent.setup();
    renderPage();

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    expect(screen.queryByText('Bloquear seleccionados')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Acciones en lote' }));
    expect(screen.getByText('Bloquear seleccionados')).toBeInTheDocument();
  });

  it('el dropdown se cierra al hacer click-outside', async () => {
    const user = userEvent.setup();
    renderPage();

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole('button', { name: 'Acciones en lote' }));
    expect(screen.getByText('Bloquear seleccionados')).toBeInTheDocument();

    // Click fuera
    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByText('Bloquear seleccionados')).not.toBeInTheDocument();
    });
  });

  it('el dropdown tiene position:fixed', async () => {
    const user = userEvent.setup();
    renderPage();

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole('button', { name: 'Acciones en lote' }));

    const dropdown = document.body.querySelector('[data-testid="acciones-lote-dropdown"]') as HTMLElement;
    expect(dropdown).not.toBeNull();
    expect(dropdown.style.position).toBe('fixed');
  });
});
