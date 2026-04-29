import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminLayout } from '@/components/templates/AdminLayout/AdminLayout';
import * as useAuthModule from '@/hooks/useAuth';
import * as useSearchModule from '@/hooks/useSearch';
import * as useNotificationsModule from '@/hooks/useNotifications';
import type { AuthUser } from '@/types/auth';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useSearch');
vi.mock('@/hooks/useNotifications');

const mockUser: AuthUser = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  displayName: 'Admin User',
  role: 'admin',
  permissions: [],
};

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderAdminLayout(path: string) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/*" element={<AdminLayout />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AdminLayout — Breadcrumbs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    });

    vi.mocked(useSearchModule.useSearch).mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      results: [],
      isLoading: false,
      showResults: false,
      closeResults: vi.fn(),
    });

    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useNotificationsModule.useNotifications>);

    vi.mocked(useNotificationsModule.useMarkNotificationRead).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNotificationsModule.useMarkNotificationRead>);

    vi.mocked(useNotificationsModule.useMarkAllNotificationsRead).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNotificationsModule.useMarkAllNotificationsRead>);
  });

  it('renders CRM breadcrumb on /admin/customers/list', () => {
    renderAdminLayout('/admin/customers/list');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('CRM');
  });

  it('renders Clientes breadcrumb on /admin/customers/list', () => {
    renderAdminLayout('/admin/customers/list');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Clientes');
  });

  it('renders Tickets breadcrumb on /admin/tickets', () => {
    renderAdminLayout('/admin/tickets');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Tickets');
  });

  it('renders Finanzas breadcrumb on /admin/finance', () => {
    renderAdminLayout('/admin/finance');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Finanzas');
  });

  it('renders Detalle breadcrumb with back link on /admin/customers/view/123', () => {
    renderAdminLayout('/admin/customers/view/123');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Detalle');
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute(
      'href',
      '/admin/customers/list'
    );
  });

  it('renders Nuevo breadcrumb with back link on /admin/tickets/new', () => {
    renderAdminLayout('/admin/tickets/new');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Nuevo');
    expect(screen.getByRole('link', { name: 'Tickets' })).toHaveAttribute(
      'href',
      '/admin/tickets'
    );
  });

  it('renders Facturas breadcrumb on /admin/finance/invoices', () => {
    renderAdminLayout('/admin/finance/invoices');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Facturas');
  });

  it('renders Pagos breadcrumb on /admin/finance/payments', () => {
    renderAdminLayout('/admin/finance/payments');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Pagos');
  });

  it('renders Transacciones breadcrumb on /admin/finance/transactions', () => {
    renderAdminLayout('/admin/finance/transactions');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Transacciones');
  });

  it('renders Lista breadcrumb on /admin/tickets/opened', () => {
    renderAdminLayout('/admin/tickets/opened');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Lista');
  });

  it('does not render breadcrumbs for unknown paths', () => {
    renderAdminLayout('/admin/unknown');
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });
});
