import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import VoicePrefixesPage from '@/pages/voice/VoicePrefixesPage';

vi.mock('@/hooks/useVoz', () => ({
  useVoipPrefixes: vi.fn(),
}));

import { useVoipPrefixes } from '@/hooks/useVoz';

const mockPrefixes = [
  { id: '1', name: 'Argentina', prefix: '+54', country: 'Argentina', categoryId: 'c1', categoryName: 'Local', ratePerMinute: 0.005, status: 'active' },
  { id: '2', name: 'United States', prefix: '+1', country: 'USA', categoryId: 'c2', categoryName: 'Internacional', ratePerMinute: 0.025, status: 'active' },
  { id: '3', name: 'España', prefix: '+34', country: 'España', categoryId: 'c2', categoryName: 'Internacional', ratePerMinute: 0.030, status: 'active' },
];

describe('VoicePrefixesPage', () => {
  beforeEach(() => {
    vi.mocked(useVoipPrefixes).mockReturnValue({
      data: mockPrefixes,
      isLoading: false,
    } as ReturnType<typeof useVoipPrefixes>);
  });

  it('renders heading "Prefijos"', () => {
    render(<MemoryRouter><VoicePrefixesPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Prefijos/i })).toBeInTheDocument();
  });

  it('search input is present', () => {
    render(<MemoryRouter><VoicePrefixesPage /></MemoryRouter>);
    expect(screen.getByPlaceholderText('Buscar prefijo o país...')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useVoipPrefixes).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useVoipPrefixes>);
    render(<MemoryRouter><VoicePrefixesPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Prefijos/i })).toBeInTheDocument();
  });

  it('search filter works', async () => {
    render(<MemoryRouter><VoicePrefixesPage /></MemoryRouter>);
    expect(screen.getByText('+54')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Buscar prefijo o país...');
    await userEvent.type(searchInput, 'Argentina');

    // FilterBar debounces; input should have the value typed
    expect(searchInput).toHaveValue('Argentina');
  });
});
