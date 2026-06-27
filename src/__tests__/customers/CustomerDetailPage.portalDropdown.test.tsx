/**
 * DEUDA #5 — CustomerDetailPage: dropdown "Acciones" portalizado.
 *
 * STRICT TDD: estos tests deben FALLAR antes de la implementación.
 *
 * El dropdown se renderiza vía createPortal al body (fuera del contenedor .subHeader),
 * abre/cierra correctamente, y el click-outside lo cierra.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CustomerDetailPage from '@/pages/customers/CustomerDetailPage';
import * as useClientsModule from '@/hooks/useCustomers';
import * as useSchedulingModule from '@/hooks/useScheduling';
import * as useTicketsModule from '@/hooks/useTickets';
import type { Customer } from '@/types/customer';
import { mockMutation, mockQuery } from '@/__tests__/_utils/reactQueryMocks';

vi.mock('@/hooks/useCustomers');
vi.mock('@/hooks/useScheduling');
vi.mock('@/hooks/useTickets');
vi.mock('@/hooks/useServiceInventory', () => ({
  useClientInstalledItems: vi.fn(() => ({ data: [], isLoading: false })),
}));

const mockCustomer: Customer = {
  id: 42,
  name: 'Alice García',
  email: 'alice@example.com',
  phone: '11-1111-1111',
  address: 'Av. Corrientes 1234, CABA',
  status: 'active',
  category: 'residential',
  tariffPlan: 'Plan 50MB',
  createdAt: '2024-01-01',
  updatedAt: '2024-06-01',
  contracts: [],
  logs: [],
};

function mockAllHooks() {
  vi.mocked(useSchedulingModule.useTasksByCustomer).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useTicketsModule.useTicketsByCustomer).mockReturnValue(mockQuery({
    data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 },
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
    data: mockCustomer,
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientDetail>);

  vi.mocked(useClientsModule.useToggleClientStatus).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useToggleClientStatus>);

  vi.mocked(useClientsModule.useClientContracts).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useClientInvoices).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useClientLogs).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientLogs>);

  vi.mocked(useClientsModule.useClientComments).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useCreateComment).mockReturnValue(mockMutation({
    mutate: vi.fn(),
    isPending: false,
  }));

  vi.mocked(useClientsModule.useClientDocuments).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useUploadDocument).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useUploadDocument>);

  vi.mocked(useClientsModule.useClientFiles).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useUploadFile).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useUploadFile>);

  vi.mocked(useClientsModule.useDeleteCustomer).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useDeleteCustomer>);
}

function renderDetail() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/customers/view/42']}>
        <Routes>
          <Route path="/admin/customers/view/:id" element={<CustomerDetailPage />} />
          <Route path="/admin/customers/list" element={<div>Lista de Clientes</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CustomerDetailPage – Acciones dropdown portalizado (Deuda #5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllHooks();
  });

  it('el dropdown se renderiza fuera del contenedor de la card (portal al body)', async () => {
    const user = userEvent.setup();
    const { container } = renderDetail();

    await user.click(screen.getByRole('button', { name: /acciones/i }));

    // El dropdown debe estar en document.body, NO dentro de container
    const dropdown = document.body.querySelector('[data-testid="acciones-dropdown"]');
    expect(dropdown).not.toBeNull();
    // Verifica que NO está dentro del container del componente renderizado
    expect(container.querySelector('[data-testid="acciones-dropdown"]')).toBeNull();
  });

  it('el dropdown se abre al clickear el botón Acciones', async () => {
    const user = userEvent.setup();
    renderDetail();

    expect(screen.queryByRole('button', { name: 'Bloquear cliente' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.getByRole('button', { name: 'Bloquear cliente' })).toBeInTheDocument();
  });

  it('el dropdown se cierra al clickear el botón Acciones de nuevo (toggle)', async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.getByRole('button', { name: 'Bloquear cliente' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /acciones/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Bloquear cliente' })).not.toBeInTheDocument();
    });
  });

  it('el dropdown se cierra al hacer click-outside', async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.getByRole('button', { name: 'Bloquear cliente' })).toBeInTheDocument();

    // Click fuera del dropdown
    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Bloquear cliente' })).not.toBeInTheDocument();
    });
  });

  it('el dropdown tiene position:fixed (no position:absolute) para escapar overflow:hidden', async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole('button', { name: /acciones/i }));

    const dropdown = document.body.querySelector('[data-testid="acciones-dropdown"]') as HTMLElement;
    expect(dropdown).not.toBeNull();
    expect(dropdown.style.position).toBe('fixed');
  });
});
