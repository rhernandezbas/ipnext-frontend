import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as VozPage } from '@/pages/empresa/VozPage';
import * as useVozModule from '@/hooks/useVoz';
import type { VoipCategory, VoipCdr, VoipPlan } from '@/types/voz';

vi.mock('@/hooks/useVoz');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockCategories: VoipCategory[] = [
  { id: '1', name: 'Llamadas locales', prefix: '011', pricePerMinute: 0.5, freeMinutes: 300, status: 'active' },
  { id: '2', name: 'Larga distancia', prefix: '0', pricePerMinute: 1.5, freeMinutes: 100, status: 'active' },
  { id: '3', name: 'Celulares', prefix: '15', pricePerMinute: 2.0, freeMinutes: 60, status: 'active' },
];

const mockCdrs: VoipCdr[] = [
  { id: '1', clientId: 'cli-001', clientName: 'Juan García', callerNumber: '01145678901', calledNumber: '01145670001', duration: 180, categoryId: '1', categoryName: 'Llamadas locales', cost: 1.5, status: 'answered', startedAt: '2026-04-28T09:00:00Z' },
];

const mockPlans: VoipPlan[] = [
  { id: '1', name: 'Plan VoIP Básico', monthlyPrice: 1500, includedMinutes: 300, categories: ['1', '3'], status: 'active' },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <VozPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VozPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useVozModule.useVoipCategories).mockReturnValue({
      data: mockCategories,
      isLoading: false,
    } as ReturnType<typeof useVozModule.useVoipCategories>);

    vi.mocked(useVozModule.useCreateVoipCategory).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useVozModule.useCreateVoipCategory>);

    vi.mocked(useVozModule.useVoipCdrs).mockReturnValue({
      data: mockCdrs,
      isLoading: false,
    } as ReturnType<typeof useVozModule.useVoipCdrs>);

    vi.mocked(useVozModule.useVoipPlans).mockReturnValue({
      data: mockPlans,
      isLoading: false,
    } as ReturnType<typeof useVozModule.useVoipPlans>);

    vi.mocked(useVozModule.useCreateVoipPlan).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useVozModule.useCreateVoipPlan>);
  });

  it('renders "Voz" heading', () => {
    renderPage();
    expect(screen.getByText(/voz/i)).toBeInTheDocument();
  });

  it('renders "Categorías" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Categorías' })).toBeInTheDocument();
  });

  it('renders "Planes VoIP" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Planes VoIP' })).toBeInTheDocument();
  });

  it('renders "CDR (Llamadas)" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'CDR (Llamadas)' })).toBeInTheDocument();
  });

  it('categories table shows data from mock', () => {
    renderPage();
    expect(screen.getByText('Llamadas locales')).toBeInTheDocument();
    expect(screen.getByText('Larga distancia')).toBeInTheDocument();
  });

  it('"Nueva categoría" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Nueva categoría' })).toBeInTheDocument();
  });
});
