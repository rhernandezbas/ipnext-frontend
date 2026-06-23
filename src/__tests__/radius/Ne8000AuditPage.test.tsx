import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Ne8000AuditPage from '@/pages/radius/Ne8000AuditPage';
import * as useNe8000AuditModule from '@/hooks/useNe8000Audit';
import type { PaginatedNe8000Audit } from '@/types/networkAudit';

vi.mock('@/hooks/useNe8000Audit');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const MOCK_DATA: PaginatedNe8000Audit = {
  data: [
    {
      pppoeId: 'pppoe-1',
      username: 'user2@isp.com',
      profile: 'Plan 50MB',
      remoteAddress: '10.0.1.50',
      macAddress: 'FF:EE:DD:CC:BB:AA',
      status: 'enabled',
      enforcedState: 'active',
      contractId: 'contract-42',
      currentlyOnline: true,
      lastStartedAt: '2026-06-22T08:00:00Z',
      lastStoppedAt: null,
      lastFramedIp: '10.0.1.50',
      lastVlanId: 200,
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
  hasNext: false,
};

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <Ne8000AuditPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Ne8000AuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Auditoría NE8000" heading', () => {
    vi.mocked(useNe8000AuditModule.useNe8000Audit).mockReturnValue({
      data: MOCK_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNe8000AuditModule.useNe8000Audit>);

    renderPage();
    expect(screen.getByText('Auditoría NE8000')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useNe8000AuditModule.useNe8000Audit).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useNe8000AuditModule.useNe8000Audit>);

    renderPage();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('renders username in table when data is present', () => {
    vi.mocked(useNe8000AuditModule.useNe8000Audit).mockReturnValue({
      data: MOCK_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNe8000AuditModule.useNe8000Audit>);

    renderPage();
    expect(screen.getByText('user2@isp.com')).toBeInTheDocument();
  });

  it('shows empty state when data is empty', () => {
    vi.mocked(useNe8000AuditModule.useNe8000Audit).mockReturnValue({
      data: { ...MOCK_DATA, data: [], total: 0 },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNe8000AuditModule.useNe8000Audit>);

    renderPage();
    expect(screen.getByText('No hay registros')).toBeInTheDocument();
  });

  it('shows error state when request fails', () => {
    vi.mocked(useNe8000AuditModule.useNe8000Audit).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useNe8000AuditModule.useNe8000Audit>);

    renderPage();
    expect(screen.getByText('Error al cargar la auditoría')).toBeInTheDocument();
  });

  it('does NOT render any mutation buttons', () => {
    vi.mocked(useNe8000AuditModule.useNe8000Audit).mockReturnValue({
      data: MOCK_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNe8000AuditModule.useNe8000Audit>);

    renderPage();
    // No disconnect, edit, or action buttons should be present
    expect(screen.queryByRole('button', { name: /desconectar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cortar/i })).not.toBeInTheDocument();
  });

  it('renders filter controls: username input, status select, and Limpiar button', () => {
    vi.mocked(useNe8000AuditModule.useNe8000Audit).mockReturnValue({
      data: MOCK_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNe8000AuditModule.useNe8000Audit>);

    renderPage();
    expect(screen.getByRole('textbox', { name: /filtrar por username/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filtrar por estado/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument();
  });
});
