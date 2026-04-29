import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Navbar } from '@/components/organisms/Navbar/Navbar';
import * as useAuthModule from '@/hooks/useAuth';
import * as useSearchModule from '@/hooks/useSearch';
import * as useNotificationsModule from '@/hooks/useNotifications';
import type { AuthUser } from '@/types/auth';
import type { SearchResult } from '@/types/search';
import type { Notification } from '@/types/notification';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useSearch');
vi.mock('@/hooks/useNotifications');

const mockLogout = vi.fn();

const mockUser: AuthUser = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  displayName: 'Admin User',
  role: 'admin',
  permissions: [],
};

const mockSearchResults: SearchResult[] = [
  {
    id: 'client-1',
    type: 'client',
    title: 'Carlos Rodríguez',
    subtitle: 'carlos@email.com',
    href: '/admin/customers/view?id=client-1',
    icon: '👤',
  },
];

const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    type: 'device_offline',
    title: 'Dispositivo sin conexión',
    message: 'CPE-Cliente-Torres dejó de responder.',
    severity: 'error',
    read: false,
    link: '/admin/monitoring',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    readAt: null,
  },
];

const mockCloseResults = vi.fn();
const mockSetQuery = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderNavbar(path = '/admin/customers/list') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[path]}>
        <Navbar />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: mockLogout,
    });

    vi.mocked(useSearchModule.useSearch).mockReturnValue({
      query: '',
      setQuery: mockSetQuery,
      results: [],
      isLoading: false,
      showResults: false,
      closeResults: mockCloseResults,
    });

    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useNotificationsModule.useNotifications>);

    vi.mocked(useNotificationsModule.useMarkNotificationRead).mockReturnValue({
      mutate: mockMarkRead,
      isPending: false,
    } as unknown as ReturnType<typeof useNotificationsModule.useMarkNotificationRead>);

    vi.mocked(useNotificationsModule.useMarkAllNotificationsRead).mockReturnValue({
      mutate: mockMarkAllRead,
      isPending: false,
    } as unknown as ReturnType<typeof useNotificationsModule.useMarkAllNotificationsRead>);
  });

  it('shows section title based on current path', () => {
    renderNavbar('/admin/customers/list');
    expect(screen.getByText('Clientes')).toBeInTheDocument();
  });

  it('shows Tickets section title', () => {
    renderNavbar('/admin/tickets');
    expect(screen.getByText('Tickets')).toBeInTheDocument();
  });

  it('shows Finanzas section title', () => {
    renderNavbar('/admin/finance');
    expect(screen.getByText('Finanzas')).toBeInTheDocument();
  });

  it('shows Administración for unknown path', () => {
    renderNavbar('/admin/unknown');
    expect(screen.getByText('Administración')).toBeInTheDocument();
  });

  it('shows user initials from displayName', () => {
    renderNavbar();
    // "Admin User" → "AU"
    expect(screen.getByText('AU')).toBeInTheDocument();
  });

  it('shows ? when no user', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: mockLogout,
    });
    renderNavbar();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('calls logout when Salir button is clicked', async () => {
    const user = userEvent.setup();
    mockLogout.mockResolvedValueOnce(undefined);

    renderNavbar();
    await user.click(screen.getByRole('button', { name: /salir/i }));

    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('renders a search input with placeholder "Buscar..."', () => {
    renderNavbar();
    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument();
  });

  it('search input is of type text', () => {
    renderNavbar();
    const input = screen.getByPlaceholderText('Buscar...');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('renders a bell icon button for notifications', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument();
  });

  it('renders a plus icon button for quick-add', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument();
  });

  it('search input accepts text input', async () => {
    const user = userEvent.setup();
    renderNavbar();
    const input = screen.getByPlaceholderText('Buscar...');
    await user.type(input, 'test query');
    expect(mockSetQuery).toHaveBeenCalled();
  });

  // ── Search tests ───────────────────────────────────────────────────────

  it('typing 2+ chars in search input triggers search (setQuery called)', async () => {
    const user = userEvent.setup();
    renderNavbar();
    const input = screen.getByPlaceholderText('Buscar...');
    await user.type(input, 'ca');
    expect(mockSetQuery).toHaveBeenCalled();
  });

  it('search dropdown shows results when data is returned', () => {
    vi.mocked(useSearchModule.useSearch).mockReturnValue({
      query: 'carlos',
      setQuery: mockSetQuery,
      results: mockSearchResults,
      isLoading: false,
      showResults: true,
      closeResults: mockCloseResults,
    });
    renderNavbar();
    expect(screen.getByText('Carlos Rodríguez')).toBeInTheDocument();
  });

  it('clicking a search result closes dropdown', async () => {
    const user = userEvent.setup();
    vi.mocked(useSearchModule.useSearch).mockReturnValue({
      query: 'carlos',
      setQuery: mockSetQuery,
      results: mockSearchResults,
      isLoading: false,
      showResults: true,
      closeResults: mockCloseResults,
    });
    renderNavbar();
    await user.click(screen.getByText('Carlos Rodríguez'));
    expect(mockCloseResults).toHaveBeenCalled();
  });

  it('ESC key closes search dropdown', async () => {
    const user = userEvent.setup();
    vi.mocked(useSearchModule.useSearch).mockReturnValue({
      query: 'carlos',
      setQuery: mockSetQuery,
      results: mockSearchResults,
      isLoading: false,
      showResults: true,
      closeResults: mockCloseResults,
    });
    renderNavbar();
    const input = screen.getByPlaceholderText('Buscar...');
    await user.type(input, '{Escape}');
    expect(mockCloseResults).toHaveBeenCalled();
  });

  // ── Notification tests ─────────────────────────────────────────────────

  it('bell button exists with unread count badge', () => {
    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      data: mockNotifications,
      isLoading: false,
    } as ReturnType<typeof useNotificationsModule.useNotifications>);
    renderNavbar();
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('clicking bell opens notification dropdown', async () => {
    const user = userEvent.setup();
    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      data: mockNotifications,
      isLoading: false,
    } as ReturnType<typeof useNotificationsModule.useNotifications>);
    renderNavbar();
    await user.click(screen.getByRole('button', { name: 'Notificaciones' }));
    expect(screen.getByText('Notificaciones')).toBeInTheDocument();
  });

  it('notification dropdown shows notification titles', async () => {
    const user = userEvent.setup();
    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      data: mockNotifications,
      isLoading: false,
    } as ReturnType<typeof useNotificationsModule.useNotifications>);
    renderNavbar();
    await user.click(screen.getByRole('button', { name: 'Notificaciones' }));
    expect(screen.getByText('Dispositivo sin conexión')).toBeInTheDocument();
  });
});
