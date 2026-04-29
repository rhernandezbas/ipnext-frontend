import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TarifasRecurrentePage from '@/pages/empresa/tarifas/TarifasRecurrentePage';
import * as useEmpresaModule from '@/hooks/useEmpresa';
import type { ServicePlan } from '@/types/empresa';

vi.mock('@/hooks/useEmpresa');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockPlans: ServicePlan[] = [
  {
    id: '6',
    name: 'Soporte Técnico Mensual',
    type: 'other',
    planSubtype: 'recurring',
    downloadSpeed: 0,
    uploadSpeed: 0,
    price: 1500,
    billingCycle: 'monthly',
    status: 'active',
    description: 'Soporte mensual',
    subscriberCount: 120,
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <TarifasRecurrentePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TarifasRecurrentePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useEmpresaModule.useServicePlans).mockReturnValue({
      data: mockPlans,
      isLoading: false,
    } as ReturnType<typeof useEmpresaModule.useServicePlans>);

    vi.mocked(useEmpresaModule.useCreateServicePlan).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useEmpresaModule.useCreateServicePlan>);
  });

  it('renders "Tarifas Recurrentes" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /tarifas recurrentes/i })).toBeInTheDocument();
  });

  it('"Nueva tarifa" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nueva tarifa/i })).toBeInTheDocument();
  });

  it('table renders with recurring plans', () => {
    renderPage();
    expect(screen.getByText('Soporte Técnico Mensual')).toBeInTheDocument();
  });
});
