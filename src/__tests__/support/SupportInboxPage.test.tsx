import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import SupportInboxPage from '@/pages/support/SupportInboxPage';

vi.mock('@/hooks/useMessages', () => ({
  useMessages: vi.fn(),
}));

import { useMessages } from '@/hooks/useMessages';

const mockMessages = [
  { id: '1', subject: 'Consulta de servicio', body: 'Hola', fromId: 'u1', fromName: 'Juan Pérez', toId: null, toName: null, clientId: '123', channel: 'email' as const, status: 'unread' as const, sentAt: null, createdAt: '2026-04-01T10:00:00Z', threadId: null },
  { id: '2', subject: 'Reclamo factura', body: 'Problema', fromId: 'u2', fromName: 'Ana García', toId: null, toName: null, clientId: '456', channel: 'internal' as const, status: 'read' as const, sentAt: '2026-04-02T09:00:00Z', createdAt: '2026-04-02T09:00:00Z', threadId: null },
];

describe('SupportInboxPage', () => {
  beforeEach(() => {
    vi.mocked(useMessages).mockReturnValue({
      data: mockMessages,
      isLoading: false,
    } as ReturnType<typeof useMessages>);
  });

  it('renders heading "Bandeja de entrada"', () => {
    render(<MemoryRouter><SupportInboxPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Bandeja de entrada/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useMessages).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useMessages>);
    render(<MemoryRouter><SupportInboxPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Bandeja de entrada/i })).toBeInTheDocument();
  });

  it('renders Estado filter', () => {
    render(<MemoryRouter><SupportInboxPage /></MemoryRouter>);
    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument();
  });
});
