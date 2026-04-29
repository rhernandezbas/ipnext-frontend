import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MessengersPage from '@/pages/support/MessengersPage';
import * as useMessengersModule from '@/hooks/useMessengers';
import type { Messenger } from '@/types/messenger';

vi.mock('@/hooks/useMessengers');

const mockMessengers: Messenger[] = [
  { id: 'whatsapp', name: 'WhatsApp', status: 'Conectado', connected: true },
  { id: 'telegram', name: 'Telegram Test', status: 'Desconectado', connected: false },
];

describe('MessengersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMessengersModule.useMessengers).mockReturnValue({
      data: mockMessengers,
      isLoading: false,
    } as ReturnType<typeof useMessengersModule.useMessengers>);
  });

  it('renders the page title', () => {
    render(<MemoryRouter><MessengersPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Messengers/i })).toBeInTheDocument();
  });

  it('renders messenger cards from hook data', () => {
    render(<MemoryRouter><MessengersPage /></MemoryRouter>);
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Telegram Test')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useMessengersModule.useMessengers).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useMessengersModule.useMessengers>);
    render(<MemoryRouter><MessengersPage /></MemoryRouter>);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
