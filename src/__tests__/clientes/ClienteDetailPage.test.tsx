import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ClienteDetailPage from '@/pages/clientes/ClienteDetailPage';
import * as useClientsModule from '@/hooks/useClients';
import type { Customer } from '@/types/customer';

vi.mock('@/hooks/useClients');

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
  services: [],
  logs: [],
};

function mockAllHooks() {
  vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
    data: mockCustomer,
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientDetail>);

  vi.mocked(useClientsModule.useToggleClientStatus).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useToggleClientStatus>);

  vi.mocked(useClientsModule.useClientServices).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientServices>);

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

  vi.mocked(useClientsModule.useAddService).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useAddService>);

  vi.mocked(useClientsModule.useUpdateService).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useUpdateService>);

  vi.mocked(useClientsModule.useDeleteService).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useDeleteService>);

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
          <Route path="/admin/customers/view/:id" element={<ClienteDetailPage />} />
          <Route path="/admin/customers/view" element={<ClienteDetailPage />} />
          <Route path="/admin/customers/list" element={<div>Lista de Clientes</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ClienteDetailPage', () => {
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
    // Name appears in header h1 and in InformacionTab — getAllByText is ok
    expect(screen.getAllByText('Alice García').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ID: 42')).toBeInTheDocument();
  });

  it('renders customer email and phone', () => {
    renderDetail();
    // Email and phone appear in header and InformacionTab
    expect(screen.getAllByText('alice@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('11-1111-1111').length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badge', () => {
    renderDetail();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('renders all 7 tabs', () => {
    renderDetail();
    expect(screen.getByRole('tab', { name: 'Información' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Servicios' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Facturación' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Estadísticas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Documentos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Archivos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument();
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
    await user.click(screen.getByRole('tab', { name: 'Servicios' }));
    expect(screen.getByRole('tab', { name: 'Servicios' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Información' })).toHaveAttribute('aria-selected', 'false');
  });

  it('"Acciones" button is present and clickable', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: 'Acciones' })).toBeInTheDocument();
  });

  it('clicking "Acciones" shows dropdown items', async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    expect(screen.getByRole('button', { name: 'Bloquear cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear ticket' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar cliente' })).toBeInTheDocument();
  });

  it('"Tareas" button is present', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: 'Tareas' })).toBeInTheDocument();
  });

  it('"Tickets" button is present', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: 'Tickets' })).toBeInTheDocument();
  });
});
