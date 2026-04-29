import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import VoiceCategoriesPage from '@/pages/voice/VoiceCategoriesPage';

vi.mock('@/hooks/useVoz', () => ({
  useVoipCategories: vi.fn(),
}));

import { useVoipCategories } from '@/hooks/useVoz';

const mockCategories = [
  { id: '1', name: 'Local', prefix: 'LCL', pricePerMinute: 0.01, freeMinutes: 60, status: 'active' },
  { id: '2', name: 'Internacional', prefix: 'INT', pricePerMinute: 0.15, freeMinutes: 0, status: 'active' },
];

describe('VoiceCategoriesPage', () => {
  beforeEach(() => {
    vi.mocked(useVoipCategories).mockReturnValue({
      data: mockCategories,
      isLoading: false,
    } as ReturnType<typeof useVoipCategories>);
  });

  it('renders heading "Categorías de voz"', () => {
    render(<MemoryRouter><VoiceCategoriesPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Categorías de voz/i })).toBeInTheDocument();
  });

  it('"Nueva categoría" button is present', () => {
    render(<MemoryRouter><VoiceCategoriesPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Nueva categoría/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useVoipCategories).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useVoipCategories>);
    render(<MemoryRouter><VoiceCategoriesPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Categorías de voz/i })).toBeInTheDocument();
  });

  it('renders category rows', () => {
    render(<MemoryRouter><VoiceCategoriesPage /></MemoryRouter>);
    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('Internacional')).toBeInTheDocument();
  });
});
