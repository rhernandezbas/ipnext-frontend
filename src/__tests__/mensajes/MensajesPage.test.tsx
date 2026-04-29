import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MensajesPage from '@/pages/mensajes/MensajesPage';
import * as useMessagesModule from '@/hooks/useMessages';
import type { Message } from '@/types/message';

vi.mock('@/hooks/useMessages');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockMessages: Message[] = [
  {
    id: '1',
    subject: 'Consulta sobre facturación',
    body: 'Hola, quisiera saber el estado de mi factura.',
    fromId: 'client-42',
    fromName: 'Carlos Rodríguez',
    toId: 'admin-1',
    toName: 'Admin',
    clientId: 'client-42',
    channel: 'email',
    status: 'unread',
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    threadId: null,
  },
  {
    id: '2',
    subject: 'Problema de conexión',
    body: 'El cliente reporta intermitencia.',
    fromId: 'admin-2',
    fromName: 'Soporte Técnico',
    toId: 'admin-1',
    toName: 'Admin',
    clientId: null,
    channel: 'internal',
    status: 'read',
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    threadId: null,
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <MensajesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MensajesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useMessagesModule.useMessages).mockReturnValue({
      data: mockMessages,
      isLoading: false,
    } as ReturnType<typeof useMessagesModule.useMessages>);

    vi.mocked(useMessagesModule.useCreateMessage).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useMessagesModule.useCreateMessage>);

    vi.mocked(useMessagesModule.useMarkMessageAsRead).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useMessagesModule.useMarkMessageAsRead>);

    vi.mocked(useMessagesModule.useDeleteMessage).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useMessagesModule.useDeleteMessage>);
  });

  it('renders "Mensajes" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Mensajes' })).toBeInTheDocument();
  });

  it('"Recibidos" tab exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Recibidos' })).toBeInTheDocument();
  });

  it('"Enviados" tab exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Enviados' })).toBeInTheDocument();
  });

  it('"Nuevo mensaje" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Nuevo mensaje' })).toBeInTheDocument();
  });

  it('message list shows subject from mock', () => {
    renderPage();
    expect(screen.getByText('Consulta sobre facturación')).toBeInTheDocument();
    expect(screen.getByText('Problema de conexión')).toBeInTheDocument();
  });

  it('"Nuevo mensaje" opens compose form with Para, Asunto, Mensaje fields', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Nuevo mensaje' }));

    expect(screen.getByLabelText('Para')).toBeInTheDocument();
    expect(screen.getByLabelText('Asunto')).toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje')).toBeInTheDocument();
  });
});
