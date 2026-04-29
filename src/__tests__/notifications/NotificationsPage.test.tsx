import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NotificationsPage from '@/pages/notifications/NotificationsPage';
import * as useNotificationsModule from '@/hooks/useNotifications';
import type { Notification } from '@/types/notification';

vi.mock('@/hooks/useNotifications');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    type: 'device_offline',
    title: 'Dispositivo sin conexión',
    message: 'CPE-Cliente-Torres dejó de responder hace más de 1 hora.',
    severity: 'error',
    read: false,
    link: '/admin/monitoring',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    readAt: null,
  },
  {
    id: 'notif-2',
    type: 'payment_received',
    title: 'Pago recibido',
    message: 'Ana Torres realizó un pago de $2.800.',
    severity: 'success',
    read: true,
    link: '/admin/finance/payments',
    createdAt: new Date(Date.now() - 7_200_000).toISOString(),
    readAt: new Date(Date.now() - 6_000_000).toISOString(),
  },
];

const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();
const mockDeleteNotif = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      data: mockNotifications,
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

    vi.mocked(useNotificationsModule.useDeleteNotification).mockReturnValue({
      mutate: mockDeleteNotif,
      isPending: false,
    } as unknown as ReturnType<typeof useNotificationsModule.useDeleteNotification>);
  });

  it('renders "Notificaciones" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Notificaciones' })).toBeInTheDocument();
  });

  it('shows notification list from hook', () => {
    renderPage();
    expect(screen.getByText('Dispositivo sin conexión')).toBeInTheDocument();
    expect(screen.getByText('Pago recibido')).toBeInTheDocument();
  });

  it('"Marcar todas como leidas" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /marcar todas como leidas/i })).toBeInTheDocument();
  });

  it('type filter exists (Todas / Sin leer)', () => {
    renderPage();
    const filterBtns = screen.getAllByRole('button');
    const todaBtn = filterBtns.find(btn => btn.textContent?.match(/^Todas\s*\(/));
    expect(todaBtn).toBeInTheDocument();
    const sinLeerBtn = filterBtns.find(btn => btn.textContent?.match(/^Sin leer\s*\(/));
    expect(sinLeerBtn).toBeInTheDocument();
  });

  it('unread notifications have visual indicator', () => {
    renderPage();
    const indicators = document.querySelectorAll('[aria-label="Sin leer"]');
    expect(indicators.length).toBeGreaterThan(0);
  });
});
