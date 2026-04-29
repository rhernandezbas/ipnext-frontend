import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TarifasPaquetesPage from '@/pages/empresa/tarifas/TarifasPaquetesPage';
import * as useEmpresaModule from '@/hooks/useEmpresa';
import type { ServicePlan } from '@/types/empresa';

vi.mock('@/hooks/useEmpresa');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockPlans: ServicePlan[] = [
  {
    id: '10',
    name: 'Paquete Internet + Voz Básico',
    type: 'other',
    planSubtype: 'bundle',
    downloadSpeed: 100,
    uploadSpeed: 50,
    price: 7500,
    billingCycle: 'monthly',
    status: 'active',
    description: 'Internet + VoIP',
    subscriberCount: 67,
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <TarifasPaquetesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TarifasPaquetesPage', () => {
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

  it('renders "Tarifas de Paquetes" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /tarifas de paquetes/i })).toBeInTheDocument();
  });

  it('"Nueva tarifa" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nueva tarifa/i })).toBeInTheDocument();
  });

  it('table renders with bundle plans', () => {
    renderPage();
    expect(screen.getByText('Paquete Internet + Voz Básico')).toBeInTheDocument();
  });
});
