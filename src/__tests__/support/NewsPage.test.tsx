import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NewsPage from '@/pages/support/NewsPage';
import * as useNewsModule from '@/hooks/useNews';
import type { NewsItem } from '@/types/news';

vi.mock('@/hooks/useNews');

const mockNews: NewsItem[] = [
  { id: '1', title: 'Noticia Test A', date: '2024-03-20', excerpt: 'Resumen de noticia A.' },
  { id: '2', title: 'Noticia Test B', date: '2024-03-15', excerpt: 'Resumen de noticia B.' },
];

describe('NewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNewsModule.useNews).mockReturnValue({
      data: mockNews,
      isLoading: false,
    } as ReturnType<typeof useNewsModule.useNews>);
  });

  it('renders the page title', () => {
    render(<MemoryRouter><NewsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Noticias/i })).toBeInTheDocument();
  });

  it('renders news items from hook data', () => {
    render(<MemoryRouter><NewsPage /></MemoryRouter>);
    expect(screen.getByText('Noticia Test A')).toBeInTheDocument();
    expect(screen.getByText('Noticia Test B')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useNewsModule.useNews).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useNewsModule.useNews>);
    render(<MemoryRouter><NewsPage /></MemoryRouter>);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
