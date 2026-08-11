import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CustomerDetailPage from '@/pages/customers/CustomerDetailPage';
import * as useClientsModule from '@/hooks/useCustomers';
import * as useSchedulingModule from '@/hooks/useScheduling';
import * as useTicketsModule from '@/hooks/useTickets';
import type { Customer } from '@/types/customer';

vi.mock('@/hooks/useCustomers');
vi.mock('@/hooks/useScheduling');
vi.mock('@/hooks/useTickets');
// The "Equipos" tab queries client equipment — stub the hook so the tab renders
// without a live request.
vi.mock('@/hooks/useServiceInventory', () => ({
  useClientInstalledItems: vi.fn(() => ({ data: [], isLoading: false })),
}));

// Mock useNavigate so "Enviar mensaje" navigation can be asserted (review M1).
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { useCan, useMyPermissions } from '@/hooks/useMyPermissions';
import { mockMutation, mockQuery } from '@/__tests__/_utils/reactQueryMocks';

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockCustomer: Customer = {
  id: 42,
  name: 'Alice García',
  email: 'alice@example.com',
  phone: '11-1111-1111',
  address: 'Av. Corrientes 1234, CABA',
  status: 'active',
  category: 'residential',
  tariffPlan: 'Plan 50MB',
  createdAt: '2024-01-01',
  updatedAt: '2024-06-01',
  contracts: [],
  logs: [],
};

function mockAllHooks() {
  vi.mocked(useSchedulingModule.useTasksByCustomer).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useTicketsModule.useTicketsByCustomer).mockReturnValue(mockQuery({
    data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 },
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
    data: mockCustomer,
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientDetail>);

  vi.mocked(useClientsModule.useToggleClientStatus).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useToggleClientStatus>);

  vi.mocked(useClientsModule.useClientContracts).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useClientInvoices).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useClientLogs).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as ReturnType<typeof useClientsModule.useClientLogs>);

  vi.mocked(useClientsModule.useClientComments).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useCreateComment).mockReturnValue(mockMutation({
    mutate: vi.fn(),
    isPending: false,
  }));

  vi.mocked(useClientsModule.useClientDocuments).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useUploadDocument).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useUploadDocument>);

  vi.mocked(useClientsModule.useClientFiles).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useClientsModule.useUploadFile).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useUploadFile>);

  vi.mocked(useClientsModule.useDeleteCustomer).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClientsModule.useDeleteCustomer>);
}

function renderDetail(pathSuffix = '/42') {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/admin/customers/view${pathSuffix}`]}>
        <Routes>
          <Route path="/admin/customers/view/:id" element={<CustomerDetailPage />} />
          <Route path="/admin/customers/view" element={<CustomerDetailPage />} />
          <Route path="/admin/customers/list" element={<div>Lista de Clientes</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CustomerDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllHooks();
  });

  it('shows loading state', () => {
    vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useClientsModule.useClientDetail>);
    renderDetail();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('redirects to clients list when no id', () => {
    // render without :id param — route matches /admin/customers/view (no :id)
    renderDetail('');
    // navigate() called during render — synchronous redirect
    expect(screen.getByText('Lista de Clientes')).toBeInTheDocument();
  });

  it('shows not found when customer is null', () => {
    vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientDetail>);
    renderDetail();
    expect(screen.getByText('Cliente no encontrado.')).toBeInTheDocument();
  });

  it('renders customer name and ID in header', () => {
    renderDetail();
    // Name appears in header h1 — getByRole heading
    expect(screen.getByRole('heading', { name: /Alice García/ })).toBeInTheDocument();
    // ID is rendered as an input value inside InfoTab (aria-label="ID")
    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
  });

  it('renders customer email and phone', () => {
    renderDetail();
    // Email and phone are rendered as input defaultValues inside InfoTab
    expect(screen.getAllByDisplayValue('alice@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue('11-1111-1111').length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badge', () => {
    renderDetail();
    // FieldRowStatus now uses the GR client-status labels: 'active' → 'Activo'.
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('renders all 7 tabs', () => {
    renderDetail();
    expect(screen.getByRole('tab', { name: 'Información' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Contratos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Facturación' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Estadísticas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Documentos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Archivos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument();
  });

  it('renders the "Equipos" tab for users with inventory.read', () => {
    vi.mocked(useCan).mockReturnValue(true);
    renderDetail();
    expect(screen.getByRole('tab', { name: 'Equipos' })).toBeInTheDocument();
  });

  it('hides the "Equipos" tab when the user lacks inventory.read', () => {
    // Deny ONLY inventory.read; everything else stays permissive so the rest
    // of the page still renders.
    vi.mocked(useCan).mockImplementation((perm?: string | string[]) => {
      const perms = Array.isArray(perm) ? perm : perm ? [perm] : [];
      return !perms.includes('inventory.read');
    });
    renderDetail();
    expect(screen.queryByRole('tab', { name: 'Equipos' })).not.toBeInTheDocument();
  });

  it('no longer renders a "TV" tab — TV is managed from the contract (#47b)', () => {
    vi.mocked(useCan).mockReturnValue(true);
    renderDetail();
    expect(screen.queryByRole('tab', { name: 'TV' })).not.toBeInTheDocument();
  });

  it('renders Actividad tab button', () => {
    renderDetail();
    expect(screen.getByRole('tab', { name: 'Actividad' })).toBeInTheDocument();
  });

  it('renders Comentarios tab button', () => {
    renderDetail();
    expect(screen.getByRole('tab', { name: 'Comentarios' })).toBeInTheDocument();
  });

  it('Información tab is active by default', () => {
    renderDetail();
    expect(screen.getByRole('tab', { name: 'Información' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to Servicios tab on click', async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole('tab', { name: 'Contratos' }));
    expect(screen.getByRole('tab', { name: 'Contratos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Información' })).toHaveAttribute('aria-selected', 'false');
  });

  it('"Acciones" button is present and clickable', () => {
    renderDetail();
    // Button renders "Acciones ▾" — use regex to match
    expect(screen.getByRole('button', { name: /acciones/i })).toBeInTheDocument();
  });

  it('clicking "Acciones" shows dropdown items', async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.getByRole('button', { name: 'Bloquear cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear ticket' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar cliente' })).toBeInTheDocument();
  });

  it('"Tareas (N)" button is present and shows task count', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: /^Tareas \(\d+\)/ })).toBeInTheDocument();
  });

  it('"Tickets (N)" button is present and shows ticket count', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: /^Tickets \(\d+\)/ })).toBeInTheDocument();
  });

  it('"Tickets (N)" button navigates to filtered ticket list', async () => {
    const user = userEvent.setup();
    renderDetail();
    const ticketsBtn = screen.getByRole('button', { name: /^Tickets \(\d+\)/ });
    await user.click(ticketsBtn);
    // Navigation is triggered; no error thrown = success
  });

  it('clicking "Enviar mensaje" navigates to /admin/whatsapp (review M1)', async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole('button', { name: /acciones/i }));
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/whatsapp');
  });

  it('hides "Enviar mensaje" when the user lacks messaging.read (review L1)', async () => {
    const user = userEvent.setup();
    vi.mocked(useMyPermissions).mockReturnValue({
      user: null,
      roles: [],
      permissions: [],
      isLoading: false,
      isError: false,
      can: (permission: string | string[]) => {
        const perms = Array.isArray(permission) ? permission : [permission];
        return !perms.includes('messaging.read');
      },
    });
    renderDetail();
    await user.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.queryByRole('button', { name: 'Enviar mensaje' })).not.toBeInTheDocument();
    // The rest of the dropdown (ungated items) must still render.
    expect(screen.getByRole('button', { name: 'Bloquear cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear ticket' })).toBeInTheDocument();
  });
});

describe('CustomerDetailPage — sub-header "Saldo de la cuenta" (combo-balance-honesto)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllHooks();
  });

  function mockCustomerBalance(balanceDue: number | null | undefined, extra: Partial<Customer> = {}) {
    vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
      data: { ...mockCustomer, balanceDue, ...extra },
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientDetail>);
  }

  // El sub-header no es la única fuente de "$ 0,00" en la página (StatsTab/
  // BillingTab también rinden montos en cero) — cada scenario se scopea al
  // contenedor "Saldo de la cuenta:" para no confundirse con esos otros.
  function getSubHeaderBalance() {
    return screen.getByText('Saldo de la cuenta:').closest('span')!;
  }

  it('HEADER-1: balanceDue null → NO aparece "$ 0,00"; aparece el marcador de no disponible con explicación accesible', () => {
    mockCustomerBalance(null);
    renderDetail();

    const subHeader = getSubHeaderBalance();
    expect(within(subHeader).queryByText('$ 0,00')).not.toBeInTheDocument();
    const marker = within(subHeader).getByTitle(/no disponible/i);
    expect(marker).toBeInTheDocument();
    expect(marker.getAttribute('aria-label')).toMatch(/no disponible/i);
    // FX11 (R2 F5 / MUT-9): "dato no disponible" es BOILERPLATE de
    // `MaybeValue` — pasa con CUALQUIER `unknownReason` (incluso vacío). Lo
    // que este scenario promete es la RAZÓN concreta; se assertea el texto
    // real, igual que su gemelo de la card (`InfoTab.test.tsx` CARD-1).
    expect(marker.getAttribute('title')).toMatch(/gesti[oó]n real|sincroniz/i);
    expect(marker.getAttribute('aria-label')).toMatch(/gesti[oó]n real|sincroniz/i);
  });

  it('HEADER-1: balanceDue 0 → muestra un monto cero REAL, no el marcador de "no disponible"', () => {
    mockCustomerBalance(0);
    renderDetail();

    const subHeader = getSubHeaderBalance();
    expect(within(subHeader).getByText(/\$\s*0,00/)).toBeInTheDocument();
    expect(within(subHeader).queryByTitle(/no disponible/i)).not.toBeInTheDocument();
  });

  it('HEADER-2: balanceDue 5000 (deuda) → negativo, NO etiquetado "a favor"', () => {
    mockCustomerBalance(5000);
    renderDetail();

    const subHeader = getSubHeaderBalance();
    expect(within(subHeader).getByText(/-\s*\$\s*5[.,]000/)).toBeInTheDocument();
    expect(within(subHeader).queryByText(/a favor/i)).not.toBeInTheDocument();
  });

  it('HEADER-2: balanceDue -5000 (crédito) → etiquetado "a favor", distinguible de la deuda por TEXTO', () => {
    mockCustomerBalance(-5000);
    renderDetail();

    const subHeader = getSubHeaderBalance();
    expect(within(subHeader).getByText(/a favor/i)).toBeInTheDocument();
    expect(within(subHeader).getByText(/\$\s*5[.,]000/)).toBeInTheDocument();
    // No debe salir con signo negativo: "$ 5.000 a favor", no "-$ 5.000 a favor".
    expect(within(subHeader).queryByText(/-\s*\$\s*5[.,]000/)).not.toBeInTheDocument();
  });

  it('FX12 (R2 F6): balanceDue 0 (cero medido) NO dice "a favor" — un saldo saldado no es un crédito', () => {
    mockCustomerBalance(0);
    renderDetail();

    const subHeader = getSubHeaderBalance();
    expect(within(subHeader).queryByText(/a favor/i)).not.toBeInTheDocument();
  });
});

/**
 * FX3 (fix wave, R1 HIGH) — el sub-header pintaba TODOS los estados con un
 * solo color hardcodeado (`#16a34a`, verde, 3.30:1: fallaba AA y encima
 * mostraba la DEUDA en verde y el CRÉDITO del MISMO verde que la deuda).
 * El color pasa a ser POR ESTADO y CONSISTENTE con la BalanceCard del tab
 * Información — mismo concepto, mismos tokens:
 *   debt    → --badge-late-fg      (el rojo de `.balanceAmount`)
 *   credit  → --badge-paid-fg      (el verde de `.balanceCredit`)
 *   settled → --badge-paid-fg      (el verde "al día" del `.balanceCheckIcon`)
 *   unknown → --color-text-secondary (el gris de `.balanceUnknown`)
 * El color es REFUERZO: el canal informativo sigue siendo el texto
 * ("—"/"$ 0,00"/"-$ 5.000"/"a favor"). Este test fija la CLASE por estado;
 * el contraste de cada par se calcula en `CustomerDetailPage.contrast.test.tsx`.
 */
describe('CustomerDetailPage — FX3: el valor del sub-header toma color POR ESTADO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllHooks();
  });

  function mockBalance(balanceDue: number | null | undefined, extra: Partial<Customer> = {}) {
    vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
      data: { ...mockCustomer, balanceDue, ...extra },
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientDetail>);
  }

  const TONE_CLASSES = [
    'subHeaderValueUnknown',
    'subHeaderValueCredit',
    'subHeaderValueSettled',
    'subHeaderValueDebt',
  ];

  function getValueEl() {
    return screen.getByTestId('subheader-balance-value');
  }

  it.each([
    ['unknown', null, 'subHeaderValueUnknown'],
    ['settled', 0, 'subHeaderValueSettled'],
    ['debt', 5000, 'subHeaderValueDebt'],
    ['credit', -5000, 'subHeaderValueCredit'],
  ] as const)('estado %s → clase %s, y NINGUNA de las otras tres', (_kind, due, expectedClass) => {
    mockBalance(due);
    renderDetail();

    const el = getValueEl();
    expect(el).toHaveClass(expectedClass);
    for (const other of TONE_CLASSES.filter((c) => c !== expectedClass)) {
      expect(el).not.toHaveClass(other);
    }
  });

  it('la deuda NO comparte clase con el crédito (era el bug: los dos del mismo verde)', () => {
    mockBalance(5000);
    renderDetail();
    expect(getValueEl()).not.toHaveClass('subHeaderValueCredit');
  });
});

/**
 * FX6 (fix wave, R1 M6) — el saldo MÁS visible de la página no tenía señal de
 * frescura: un dato de 26h+ (el barrido de bajas) se presentaba idéntico a uno
 * recién sincronizado. Se reusa el patrón EXACTO del chip de la card (icono +
 * TEXTO "Desactualizado", nunca sólo color) y el MISMO gate: con el saldo
 * desconocido no se avisa "dato viejo" (el BE puede mandar `stale:true`
 * permanente para un cliente sin `grClienteId`; los dos avisos juntos se
 * contradicen).
 */
describe('CustomerDetailPage — FX6: marca de frescura en el sub-header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllHooks();
  });

  function mockBalance(balanceDue: number | null | undefined, extra: Partial<Customer> = {}) {
    vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
      data: { ...mockCustomer, balanceDue, ...extra },
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientDetail>);
  }

  it('balanceStale: true + dato presente → chip "⚠ Desactualizado" con TEXTO', () => {
    mockBalance(5000, { balanceStale: true });
    renderDetail();

    const chip = screen.getByTestId('subheader-balance-stale');
    expect(chip.textContent).toMatch(/desactualizad/i);
  });

  it('balanceStale: false → sin chip', () => {
    mockBalance(5000, { balanceStale: false });
    renderDetail();
    expect(screen.queryByTestId('subheader-balance-stale')).not.toBeInTheDocument();
  });

  it('balanceStale ausente ≡ fresco → sin chip, sin crash', () => {
    mockBalance(5000);
    renderDetail();
    expect(screen.queryByTestId('subheader-balance-stale')).not.toBeInTheDocument();
  });

  it('balanceDue null + balanceStale true → NO se avisa de dato viejo (gana "no disponible"), mismo gate que la card', () => {
    mockBalance(null, { balanceStale: true });
    renderDetail();

    expect(screen.queryByTestId('subheader-balance-stale')).not.toBeInTheDocument();
    expect(within(getSubHeaderBalanceScoped()).getByTitle(/no disponible/i)).toBeInTheDocument();
  });

  it('el crédito también avisa cuando está desactualizado (la clase, no la instancia)', () => {
    mockBalance(-5000, { balanceStale: true });
    renderDetail();
    expect(screen.getByTestId('subheader-balance-stale')).toBeInTheDocument();
  });
});

function getSubHeaderBalanceScoped() {
  return screen.getByText('Saldo de la cuenta:').closest('span')!;
}
