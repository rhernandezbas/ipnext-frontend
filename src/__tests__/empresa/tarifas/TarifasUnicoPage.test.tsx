import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TarifasUnicoPage from '@/pages/empresa/tarifas/TarifasUnicoPage';
import * as useEmpresaModule from '@/hooks/useEmpresa';
import type { ServicePlan } from '@/types/empresa';

vi.mock('@/hooks/useEmpresa');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockPlans: ServicePlan[] = [
  {
    id: '8',
    name: 'Instalación Básica',
    type: 'other',
    planSubtype: 'onetime',
    downloadSpeed: 0,
    uploadSpeed: 0,
    price: 3000,
    billingCycle: 'monthly',
    status: 'active',
    description: 'Instalación FTTH',
    subscriberCount: 0,
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <TarifasUnicoPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TarifasUnicoPage', () => {
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

  it('renders "Tarifas de Pago Único" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /tarifas de pago único/i })).toBeInTheDocument();
  });

  it('"Nueva tarifa" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nueva tarifa/i })).toBeInTheDocument();
  });

  it('table renders with one-time plans', () => {
    renderPage();
    expect(screen.getByText('Instalación Básica')).toBeInTheDocument();
  });
});
