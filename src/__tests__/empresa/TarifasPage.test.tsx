import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as TarifasPage } from '@/pages/empresa/TarifasPage';
import * as useEmpresaModule from '@/hooks/useEmpresa';
import type { ServicePlan } from '@/types/empresa';

vi.mock('@/hooks/useEmpresa');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockPlans: ServicePlan[] = [
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
    description: 'Internet hasta 25 Mbps',
    subscriberCount: 234,
  },
  {
    id: '2',
    name: 'Plan VoIP Básico',
    type: 'voip',
    planSubtype: 'voice',
    downloadSpeed: 0,
    uploadSpeed: 0,
    price: 2000,
    billingCycle: 'monthly',
    status: 'inactive',
    description: 'Servicio VoIP básico',
    subscriberCount: 45,
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <TarifasPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TarifasPage', () => {
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

    vi.mocked(useEmpresaModule.useUpdateServicePlan).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useEmpresaModule.useUpdateServicePlan>);

    vi.mocked(useEmpresaModule.useDeleteServicePlan).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useEmpresaModule.useDeleteServicePlan>);
  });

  it('renders "Tarifas" or "Planes de servicio" heading', () => {
    renderPage();
    const heading = screen.queryByText(/tarifas/i) ?? screen.queryByText(/planes de servicio/i);
    expect(heading).toBeInTheDocument();
  });

  it('renders "Nuevo plan" button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nuevo plan/i })).toBeInTheDocument();
  });

  it('table shows plan names from hook', () => {
    renderPage();
    expect(screen.getByText('Plan Básico')).toBeInTheDocument();
    expect(screen.getByText('Plan VoIP Básico')).toBeInTheDocument();
  });

  it('type filter dropdown exists', () => {
    renderPage();
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('clicking "Nuevo plan" shows form', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nuevo plan/i }));

    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });

  it('clicking "Editar" on a plan opens form with plan name', async () => {
    const user = userEvent.setup();
    renderPage();

    // Click the KebabMenu (Acciones) for first row
    const kebabButtons = screen.getAllByRole('button', { name: 'Acciones' });
    await user.click(kebabButtons[0]);

    // Click Editar menu item
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));

    // Form should appear pre-filled with plan name
    const nameInput = screen.getByLabelText(/nombre/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Plan Básico');
  });
});
