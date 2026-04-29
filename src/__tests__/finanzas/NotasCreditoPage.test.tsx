import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NotasCreditoPage from '@/pages/finanzas/NotasCreditoPage';
import * as useBillingModule from '@/hooks/useBilling';
import type { CreditNote } from '@/types/billing';

vi.mock('@/hooks/useBilling');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockNotes: CreditNote[] = [
  {
    id: '1',
    number: 'NC-2024-001',
    clientId: 'cli-001',
    clientName: 'Juan Pérez',
    amount: 5000,
    taxAmount: 1050,
    totalAmount: 6050,
    reason: 'Error en facturación',
    relatedInvoiceId: 'inv-001',
    status: 'applied',
    issuedAt: '2024-01-15',
    appliedAt: '2024-01-20',
    notes: '',
  },
  {
    id: '2',
    number: 'NC-2024-002',
    clientId: 'cli-002',
    clientName: 'María González',
    amount: 2500,
    taxAmount: 525,
    totalAmount: 3025,
    reason: 'Descuento',
    relatedInvoiceId: null,
    status: 'draft',
    issuedAt: '2024-02-01',
    appliedAt: null,
    notes: '',
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <NotasCreditoPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NotasCreditoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useBillingModule.useCreditNotes).mockReturnValue({
      data: mockNotes,
      isLoading: false,
    } as ReturnType<typeof useBillingModule.useCreditNotes>);

    vi.mocked(useBillingModule.useCreateCreditNote).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useBillingModule.useCreateCreditNote>);

    vi.mocked(useBillingModule.useApplyCreditNote).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBillingModule.useApplyCreditNote>);

    vi.mocked(useBillingModule.useVoidCreditNote).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBillingModule.useVoidCreditNote>);
  });

  it('renders "Notas de crédito" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /notas de crédito/i })).toBeInTheDocument();
  });

  it('"Nueva nota de crédito" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nueva nota de crédito/i })).toBeInTheDocument();
  });

  it('table shows credit note numbers from mock', () => {
    renderPage();
    expect(screen.getByText('NC-2024-001')).toBeInTheDocument();
    expect(screen.getByText('NC-2024-002')).toBeInTheDocument();
  });

  it('status badges render', () => {
    renderPage();
    expect(screen.getByText('Aplicada')).toBeInTheDocument();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
  });

  it('form opens on button click', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nueva nota de crédito/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/cliente/i)).toBeInTheDocument();
  });
});
