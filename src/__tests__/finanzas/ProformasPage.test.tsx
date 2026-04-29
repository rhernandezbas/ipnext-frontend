import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProformasPage from '@/pages/finanzas/ProformasPage';
import * as useBillingModule from '@/hooks/useBilling';
import type { ProformaInvoice } from '@/types/billing';

vi.mock('@/hooks/useBilling');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockProformas: ProformaInvoice[] = [
  {
    id: '1',
    number: 'PRO-2024-001',
    clientId: 'cli-001',
    clientName: 'Juan Pérez',
    items: [{ description: 'Plan Internet', quantity: 1, unitPrice: 6500, total: 6500 }],
    subtotal: 6500,
    taxAmount: 1365,
    total: 7865,
    status: 'paid',
    issuedAt: '2024-01-10',
    validUntil: '2024-01-25',
    convertedToInvoiceId: 'inv-001',
    notes: '',
  },
  {
    id: '2',
    number: 'PRO-2024-002',
    clientId: 'cli-002',
    clientName: 'María González',
    items: [{ description: 'Instalación', quantity: 1, unitPrice: 3000, total: 3000 }],
    subtotal: 3000,
    taxAmount: 630,
    total: 3630,
    status: 'draft',
    issuedAt: '2024-02-05',
    validUntil: '2024-02-20',
    convertedToInvoiceId: null,
    notes: '',
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <ProformasPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProformasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useBillingModule.useProformas).mockReturnValue({
      data: mockProformas,
      isLoading: false,
    } as ReturnType<typeof useBillingModule.useProformas>);

    vi.mocked(useBillingModule.useCreateProforma).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useBillingModule.useCreateProforma>);

    vi.mocked(useBillingModule.useCancelProforma).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBillingModule.useCancelProforma>);

    vi.mocked(useBillingModule.useConvertToInvoice).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBillingModule.useConvertToInvoice>);
  });

  it('renders "Facturas proforma" heading', () => {
    renderPage();
    const heading = screen.queryByText(/facturas proforma/i) ?? screen.queryByText(/proforma/i);
    expect(heading).toBeInTheDocument();
  });

  it('"Nueva proforma" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nueva proforma/i })).toBeInTheDocument();
  });

  it('table shows proforma numbers', () => {
    renderPage();
    expect(screen.getByText('PRO-2024-001')).toBeInTheDocument();
    expect(screen.getByText('PRO-2024-002')).toBeInTheDocument();
  });

  it('valid-until date column exists', () => {
    renderPage();
    expect(screen.getByText('Válida hasta')).toBeInTheDocument();
  });

  it('form opens on button click', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nueva proforma/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/cliente/i)).toBeInTheDocument();
  });
});
