import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RadiusAuthErrorsPage from '@/pages/radius/RadiusAuthErrorsPage';
import * as useRadiusAuthFailuresModule from '@/hooks/useRadiusAuthFailures';
import type { PaginatedRadiusAuthEvents } from '@/types/networkAudit';

vi.mock('@/hooks/useRadiusAuthFailures');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const MOCK_DATA: PaginatedRadiusAuthEvents = {
  data: [
    {
      id: 'auth-1',
      username: 'rejected@isp.com',
      reply: 'Access-Reject',
      authdate: '2026-06-22T10:00:00Z',
      class: 'plan-50',
    },
    {
      id: 'auth-2',
      username: 'accepted@isp.com',
      reply: 'Access-Accept',
      authdate: '2026-06-22T09:00:00Z',
      class: null,
    },
  ],
  total: 2,
  page: 1,
  limit: 50,
  hasNext: false,
};

function mockHook(value: Partial<ReturnType<typeof useRadiusAuthFailuresModule.useRadiusAuthFailures>>) {
  vi.mocked(useRadiusAuthFailuresModule.useRadiusAuthFailures).mockReturnValue(
    value as unknown as ReturnType<typeof useRadiusAuthFailuresModule.useRadiusAuthFailures>,
  );
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <RadiusAuthErrorsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RadiusAuthErrorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Errores de auth" heading', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByText('Errores de auth')).toBeInTheDocument();
  });

  it('defaults the reply filter to Access-Reject (the feature is "errors")', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    const replySelect = screen.getByRole('combobox', { name: /filtrar por resultado/i }) as HTMLSelectElement;
    expect(replySelect.value).toBe('Access-Reject');
  });

  it('queries the hook with reply=Access-Reject by default', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenCalledWith(
      expect.objectContaining({ reply: 'Access-Reject' }),
    );
  });

  it('renders rows with username and Class', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByText('rejected@isp.com')).toBeInTheDocument();
    expect(screen.getByText('accepted@isp.com')).toBeInTheDocument();
    expect(screen.getByText('plan-50')).toBeInTheDocument();
  });

  it('renders reply badges as text (Access-Reject / Access-Accept), no emoji', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    // Scope to <td> cells so the assertion targets the table badges, not the
    // <option> entries in the Resultado <select>.
    const cells = screen.getAllByRole('cell');
    expect(cells.some((c) => c.textContent === 'Access-Reject')).toBe(true);
    expect(cells.some((c) => c.textContent === 'Access-Accept')).toBe(true);
  });

  it('shows the loading state', () => {
    mockHook({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('shows the error state when the request fails', () => {
    mockHook({ data: undefined, isLoading: false, isError: true });
    renderPage();
    expect(screen.getByText('Error al cargar los intentos de auth')).toBeInTheDocument();
  });

  it('shows a clear empty state (not an error) when there are no rows', () => {
    mockHook({ data: { ...MOCK_DATA, data: [], total: 0 }, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByText('No hay intentos de auth')).toBeInTheDocument();
  });

  it('renders pagination when there is more than one page', () => {
    mockHook({
      data: { ...MOCK_DATA, total: 120, limit: 50, hasNext: true },
      isLoading: false,
      isError: false,
    });
    renderPage();
    // Pagination renders numbered page buttons; page "2" must exist.
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
  });

  it('does NOT render pagination for a single page', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });

  it('renders filter controls: username, reply select, Desde/Hasta, Limpiar', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByRole('textbox', { name: /filtrar por username/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filtrar por resultado/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument();
  });
});
