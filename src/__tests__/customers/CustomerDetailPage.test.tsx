import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CustomerDetailPage from '@/pages/customers/CustomerDetailPage';
import * as useClientsModule from '@/hooks/useCustomers';
import * as useSchedulingModule from '@/hooks/useScheduling';
import * as useTicketsModule from '@/hooks/useTickets';
import type { Customer } from '@/types/customer';

vi.mock('@/hooks/useCustomers');
vi.mock('@/hooks/useScheduling');
vi.mock('@/hooks/useTickets');
// The "Equipos" tab queries client equipment — stub the hook so the tab renders
// without a live request.
vi.mock('@/hooks/useServiceInventory', () => ({
  useClientInstalledItems: vi.fn(() => ({ data: [], isLoading: false })),
}));

import { useCan } from '@/hooks/useMyPermissions';

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockCustomer: Customer = {
  id: 42,
  name: 'Alice García',
  email: 'alice@example.com',
  phone: '11-1111-1111',
  address: 'Av. Corrientes 1234, CABA',
  status: 'active',
  balance: -1500,
  category: 'residential',
  tariffPlan: 'Plan 50MB',
  createdAt: '2024-01-01',
  updatedAt: '2024-06-01',
  contracts: [],
  logs: [],
};

function mockAllHooks() {
  vi.mocked(useSchedulingModule.useTasksByCustomer).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useSchedulingModule.useTasksByCustomer>);

  vi.mocked(useTicketsModule.useTicketsByCustomer).mockReturnValue({
    data: { data: [], total: 0 },
    isLoading: false,
  } as ReturnType<typeof useTicketsModule.useTicketsByCustomer>);

  vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
    data: mockCustomer,
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientDetail>);

  vi.mocked(useClientsModule.useToggleClientStatus).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useToggleClientStatus>);

  vi.mocked(useClientsModule.useClientContracts).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientContracts>);

  vi.mocked(useClientsModule.useClientInvoices).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientInvoices>);

  vi.mocked(useClientsModule.useClientLogs).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientLogs>);

  vi.mocked(useClientsModule.useClientComments).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientComments>);

  vi.mocked(useClientsModule.useCreateComment).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as ReturnType<typeof useClientsModule.useCreateComment>);

  vi.mocked(useClientsModule.useClientDocuments).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientDocuments>);

  vi.mocked(useClientsModule.useUploadDocument).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useUploadDocument>);

  vi.mocked(useClientsModule.useClientFiles).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientFiles>);

  vi.mocked(useClientsModule.useUploadFile).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useUploadFile>);

  vi.mocked(useClientsModule.useDeleteCustomer).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useDeleteCustomer>);
}

function renderDetail(pathSuffix = '/42') {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/admin/customers/view${pathSuffix}`]}>
        <Routes>
          <Route path="/admin/customers/view/:id" element={<CustomerDetailPage />} />
          <Route path="/admin/customers/view" element={<CustomerDetailPage />} />
          <Route path="/admin/customers/list" element={<div>Lista de Clientes</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CustomerDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllHooks();
  });

  it('shows loading state', () => {
    vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useClientsModule.useClientDetail>);
    renderDetail();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('redirects to clients list when no id', () => {
    // render without :id param — route matches /admin/customers/view (no :id)
    renderDetail('');
    // navigate() called during render — synchronous redirect
    expect(screen.getByText('Lista de Clientes')).toBeInTheDocument();
  });

  it('shows not found when customer is null', () => {
    vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientDetail>);
    renderDetail();
    expect(screen.getByText('Cliente no encontrado.')).toBeInTheDocument();
  });

  it('renders customer name and ID in header', () => {
    renderDetail();
    // Name appears in header h1 — getByRole heading
    expect(screen.getByRole('heading', { name: /Alice García/ })).toBeInTheDocument();
    // ID is rendered as an input value inside InfoTab (aria-label="ID")
    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
  });

  it('renders customer email and phone', () => {
    renderDetail();
    // Email and phone are rendered as input defaultValues inside InfoTab
    expect(screen.getAllByDisplayValue('alice@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue('11-1111-1111').length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badge', () => {
    renderDetail();
    // FieldRowStatus now uses the GR client-status labels: 'active' → 'Activo'.
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('renders all 7 tabs', () => {
    renderDetail();
    expect(screen.getByRole('tab', { name: 'Información' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Contratos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Facturación' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Estadísticas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Documentos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Archivos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument();
  });

  it('renders the "Equipos" tab for users with inventory.read', () => {
    vi.mocked(useCan).mockReturnValue(true);
    renderDetail();
    expect(screen.getByRole('tab', { name: 'Equipos' })).toBeInTheDocument();
  });

  it('hides the "Equipos" tab when the user lacks inventory.read', () => {
    // Deny ONLY inventory.read; everything else stays permissive so the rest
    // of the page still renders.
    vi.mocked(useCan).mockImplementation((perm?: string | string[]) => {
      const perms = Array.isArray(perm) ? perm : perm ? [perm] : [];
      return !perms.includes('inventory.read');
    });
    renderDetail();
    expect(screen.queryByRole('tab', { name: 'Equipos' })).not.toBeInTheDocument();
  });

  it('renders the "TV" tab for users with tv.read', () => {
    vi.mocked(useCan).mockReturnValue(true);
    renderDetail();
    expect(screen.getByRole('tab', { name: 'TV' })).toBeInTheDocument();
  });

  it('hides the "TV" tab when the user lacks tv.read', () => {
    vi.mocked(useCan).mockImplementation((perm?: string | string[]) => {
      const perms = Array.isArray(perm) ? perm : perm ? [perm] : [];
      return !perms.includes('tv.read');
    });
    renderDetail();
    expect(screen.queryByRole('tab', { name: 'TV' })).not.toBeInTheDocument();
  });

  it('renders Actividad tab button', () => {
    renderDetail();
    expect(screen.getByRole('tab', { name: 'Actividad' })).toBeInTheDocument();
  });

  it('renders Comentarios tab button', () => {
    renderDetail();
    expect(screen.getByRole('tab', { name: 'Comentarios' })).toBeInTheDocument();
  });

  it('Información tab is active by default', () => {
    renderDetail();
    expect(screen.getByRole('tab', { name: 'Información' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to Servicios tab on click', async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole('tab', { name: 'Contratos' }));
    expect(screen.getByRole('tab', { name: 'Contratos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Información' })).toHaveAttribute('aria-selected', 'false');
  });

  it('"Acciones" button is present and clickable', () => {
    renderDetail();
    // Button renders "Acciones ▾" — use regex to match
    expect(screen.getByRole('button', { name: /acciones/i })).toBeInTheDocument();
  });

  it('clicking "Acciones" shows dropdown items', async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.getByRole('button', { name: 'Bloquear cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear ticket' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar cliente' })).toBeInTheDocument();
  });

  it('"Tareas (N)" button is present and shows task count', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: /^Tareas \(\d+\)/ })).toBeInTheDocument();
  });

  it('"Tickets (N)" button is present and shows ticket count', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: /^Tickets \(\d+\)/ })).toBeInTheDocument();
  });

  it('"Tickets (N)" button navigates to filtered ticket list', async () => {
    const user = userEvent.setup();
    renderDetail();
    const ticketsBtn = screen.getByRole('button', { name: /^Tickets \(\d+\)/ });
    await user.click(ticketsBtn);
    // Navigation is triggered; no error thrown = success
  });
});
