import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TarifasVozPage from '@/pages/empresa/tarifas/TarifasVozPage';
import * as useEmpresaModule from '@/hooks/useEmpresa';
import type { ServicePlan } from '@/types/empresa';

vi.mock('@/hooks/useEmpresa');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockPlans: ServicePlan[] = [
  {
    id: '4',
    name: 'VoIP Básico',
    type: 'voip',
    planSubtype: 'voice',
    downloadSpeed: 0,
    uploadSpeed: 0,
    price: 2000,
    billingCycle: 'monthly',
    status: 'active',
    description: 'VoIP básico',
    subscriberCount: 45,
  },
  {
    id: '1',
    name: 'Plan Básico',
    type: 'internet',
    planSubtype: 'internet',
    downloadSpeed: 25,
    uploadSpeed: 10,
    price: 3500,
    billingCycle: 'monthly',
    status: 'active',
    description: 'Internet básico',
    subscriberCount: 234,
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <TarifasVozPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TarifasVozPage', () => {
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

  it('renders "Tarifas de Voz" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /tarifas de voz/i })).toBeInTheDocument();
  });

  it('"Nueva tarifa" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nueva tarifa/i })).toBeInTheDocument();
  });

  it('table renders only voice plans', () => {
    renderPage();
    expect(screen.getByText('VoIP Básico')).toBeInTheDocument();
    expect(screen.queryByText('Plan Básico')).not.toBeInTheDocument();
  });
});
