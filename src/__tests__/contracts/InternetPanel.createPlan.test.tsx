/**
 * InternetPanel — CreatePppoeForm: campo "Plan" como <select> obligatorio
 *
 * CP-1  El select muestra los planes enabled y category !== 'Corte'
 * CP-2  NO muestra planes con category='Corte' ni status='disabled'
 * CP-3  "Crear PPPoE" está deshabilitado cuando no hay plan elegido (form.profile='')
 * CP-4  "Crear PPPoE" se habilita al elegir un plan (y llenar usuario/password/router)
 * CP-5  El submit manda profile=plan.code (no el nombre visible)
 * CP-6  El placeholder "Elegí un plan…" está presente como primera opción (value='')
 * CP-7  Fallback a <input> de texto requerido si usePlans().isError
 * CP-8  El label del campo tiene un asterisco '*' que lo marca como requerido
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { InternetPanel } from '@/pages/customers/tabs/contracts/InternetPanel';
import * as usePppoeModule from '@/hooks/usePppoe';
import * as useNasModule from '@/hooks/useNas';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as usePlansModule from '@/hooks/usePlans';
import type { PlanDto } from '@/types/plans';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/usePlans');
vi.mock(
  '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal',
  () => ({ ServiceRemovalReasonModal: () => null }),
);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const PLANS: PlanDto[] = [
  {
    id: 'p1',
    code: 'IP-Air-10-5',
    name: 'Air 10/5',
    category: 'Air',
    downloadKbps: 10000,
    uploadKbps: 5000,
    rateLimit: '10M/5M',
    status: 'enabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p2',
    code: 'IP-Air-30-10',
    name: 'Air 30/10',
    category: 'Air',
    downloadKbps: 30000,
    uploadKbps: 10000,
    rateLimit: '30M/10M',
    status: 'enabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p3',
    code: 'IP-Corte',
    name: 'Corte',
    category: 'Corte',
    downloadKbps: 512,
    uploadKbps: 256,
    rateLimit: '512k/256k',
    status: 'enabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p4',
    code: 'IP-Alta-Disabled',
    name: 'Alta Disabled',
    category: 'Alta',
    downloadKbps: 5000,
    uploadKbps: 2000,
    rateLimit: '5M/2M',
    status: 'disabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const CONTRACT_SERVICES = [{ id: 'svc-1', name: 'INTERNET', status: 'active' }];

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function neutralMutation() {
  return { mutateAsync: vi.fn(), isPending: false } as never;
}

interface SetupOpts {
  plans?: PlanDto[];
  plansError?: boolean;
  createMutateAsync?: ReturnType<typeof vi.fn>;
}

function setup(opts: SetupOpts = {}) {
  const {
    plans = PLANS,
    plansError = false,
    createMutateAsync = vi.fn().mockResolvedValue({}),
  } = opts;

  // Sin PPPoE activo → se muestra el form de crear
  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));

  vi.mocked(usePppoeModule.useUnassignedPppoe).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));

  vi.mocked(usePppoeModule.usePppoeCredentials).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
  } as ReturnType<typeof usePppoeModule.usePppoeCredentials>);

  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue({
    mutateAsync: createMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useCreatePppoe>);

  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.usePppoeCallerId).mockReturnValue({
    data: undefined, isLoading: false, isError: false, isSuccess: false,
  } as ReturnType<typeof usePppoeModule.usePppoeCallerId>);

  vi.mocked(useNasModule.useNasServers).mockReturnValue({
    data: [{ id: 'nas-1', name: 'Router Central' }],
  } as ReturnType<typeof useNasModule.useNasServers>);

  vi.mocked(useNasModule.useNextFreeIp).mockReturnValue({
    data: undefined,
    isSuccess: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>);

  vi.mocked(usePlansModule.usePlans).mockReturnValue({
    data: plansError ? undefined : plans,
    isLoading: false,
    isError: plansError,
    isSuccess: !plansError,
  } as ReturnType<typeof usePlansModule.usePlans>);

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn((_perm: string | string[]) => true),
    isLoading: false,
    isError: false,
    permissions: ['pppoe.manage', 'pppoe.cut'],
    roles: [],
    user: null,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);

  return { createMutateAsync };
}

/**
 * Abre la sección "Cargar PPPoE" (emula click en el disclosure header).
 * El harness del panel la deja colapsada por defecto (defaultOpen=false),
 * así que hay que expandirla antes de interactuar con el form.
 */
async function expandCreateForm(user: ReturnType<typeof userEvent.setup>) {
  const btn = screen.getByRole('button', { name: /Cargar PPPoE/i });
  await user.click(btn);
}

function renderPanel() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <InternetPanel
        contractId="contract-1"
        clientId="client-42"
        contractServices={CONTRACT_SERVICES as never}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── CP-1: select muestra planes enabled no-Corte ──────────────────────────────
describe('CP-1: el select de Plan muestra solo planes enabled y no-Corte', () => {
  it('renderiza opciones para p1 y p2, no para Corte ni disabled', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await expandCreateForm(user);

    const selects = screen.getAllByRole('combobox');
    // Hay un select de Router (pppoe-nas) y uno de Plan (pppoe-profile)
    const planSelect = selects.find((s) => s.id === 'pppoe-profile');
    expect(planSelect).toBeInTheDocument();

    expect(screen.getByRole('option', { name: /Air 10\/5/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Air 30\/10/i })).toBeInTheDocument();
  });
});

// ── CP-2: no muestra Corte ni disabled ──────────────────────────────────────
describe('CP-2: no muestra planes de categoría Corte ni status disabled', () => {
  it('las opciones Corte y Alta Disabled no aparecen en el select de Plan', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await expandCreateForm(user);

    // Las opciones excluidas no deben estar en el DOM
    // Nota: el select de Router tiene su propio "Elegí un router…", así que buscamos
    // específicamente las opciones de planes filtrados
    const planSelect = document.getElementById('pppoe-profile') as HTMLSelectElement;
    expect(planSelect).toBeInTheDocument();

    const optionTexts = Array.from(planSelect.options).map((o) => o.text);
    expect(optionTexts.some((t) => /Corte/i.test(t))).toBe(false);
    expect(optionTexts.some((t) => /Alta Disabled/i.test(t))).toBe(false);
  });
});

// ── CP-3: botón deshabilitado sin plan elegido ────────────────────────────────
describe('CP-3: "Crear PPPoE" deshabilitado sin plan', () => {
  it('el botón está disabled cuando form.profile está vacío', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await expandCreateForm(user);

    const btn = screen.getByRole('button', { name: /Crear PPPoE/i });
    expect(btn).toBeDisabled();
  });
});

// ── CP-4: botón habilitado al completar todos los campos ─────────────────────
describe('CP-4: "Crear PPPoE" se habilita al completar usuario + password + router + plan', () => {
  it('el botón se habilita cuando todos los campos requeridos están llenos', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await expandCreateForm(user);

    const usernameInput = document.getElementById('pppoe-username') as HTMLInputElement;
    const passwordInput = document.getElementById('pppoe-password') as HTMLInputElement;
    const routerSelect = document.getElementById('pppoe-nas') as HTMLSelectElement;
    const planSelect = document.getElementById('pppoe-profile') as HTMLSelectElement;

    await user.type(usernameInput, 'juan.perez');
    await user.type(passwordInput, 'secret123');
    await user.selectOptions(routerSelect, 'nas-1');
    await user.selectOptions(planSelect, 'IP-Air-10-5');

    const btn = screen.getByRole('button', { name: /Crear PPPoE/i });
    expect(btn).not.toBeDisabled();
  });
});

// ── CP-5: submit manda profile=plan.code ─────────────────────────────────────
describe('CP-5: el submit envía profile=plan.code (no el nombre)', () => {
  it('mutateAsync recibe profile="IP-Air-10-5" al elegir ese plan', async () => {
    const user = userEvent.setup();
    const createFn = vi.fn().mockResolvedValue({});
    setup({ createMutateAsync: createFn });
    renderPanel();
    await expandCreateForm(user);

    const usernameInput = document.getElementById('pppoe-username') as HTMLInputElement;
    const passwordInput = document.getElementById('pppoe-password') as HTMLInputElement;
    const routerSelect = document.getElementById('pppoe-nas') as HTMLSelectElement;
    const planSelect = document.getElementById('pppoe-profile') as HTMLSelectElement;

    await user.type(usernameInput, 'juan.perez');
    await user.type(passwordInput, 'secret123');
    await user.selectOptions(routerSelect, 'nas-1');
    await user.selectOptions(planSelect, 'IP-Air-10-5');

    await user.click(screen.getByRole('button', { name: /Crear PPPoE/i }));

    await waitFor(() => {
      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({ profile: 'IP-Air-10-5' }),
      );
    });
  });
});

// ── CP-6: placeholder "Elegí un plan…" ───────────────────────────────────────
describe('CP-6: el placeholder "Elegí un plan…" es la primera opción', () => {
  it('el select de Plan tiene value="" como primera opción', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await expandCreateForm(user);

    const planSelect = document.getElementById('pppoe-profile') as HTMLSelectElement;
    expect(planSelect).toBeInTheDocument();
    const firstOption = planSelect.options[0];
    expect(firstOption.value).toBe('');
    expect(firstOption.text).toMatch(/Elegí un plan/i);
  });
});

// ── CP-7: fallback a input de texto si usePlans().isError ────────────────────
describe('CP-7: fallback a <input> de texto requerido si usePlans falla', () => {
  it('muestra un input de texto (no select) cuando plans query es error', async () => {
    const user = userEvent.setup();
    setup({ plansError: true });
    renderPanel();
    await expandCreateForm(user);

    // El campo pppoe-profile debe ser un input de texto, no un select
    const profileField = document.getElementById('pppoe-profile');
    expect(profileField).toBeInTheDocument();
    expect(profileField?.tagName.toLowerCase()).toBe('input');
    // Y debe ser requerido
    expect(profileField).toBeRequired();
  });

  it('"Crear PPPoE" está disabled cuando el input de texto está vacío', async () => {
    const user = userEvent.setup();
    setup({ plansError: true });
    renderPanel();
    await expandCreateForm(user);

    const btn = screen.getByRole('button', { name: /Crear PPPoE/i });
    expect(btn).toBeDisabled();
  });

  it('"Crear PPPoE" se habilita al escribir en el input de texto', async () => {
    const user = userEvent.setup();
    setup({ plansError: true });
    renderPanel();
    await expandCreateForm(user);

    // Completar los demás campos requeridos
    const usernameInput = document.getElementById('pppoe-username') as HTMLInputElement;
    const passwordInput = document.getElementById('pppoe-password') as HTMLInputElement;
    const routerSelect = document.getElementById('pppoe-nas') as HTMLSelectElement;
    const profileInput = document.getElementById('pppoe-profile') as HTMLInputElement;

    await user.type(usernameInput, 'juan.perez');
    await user.type(passwordInput, 'secret123');
    await user.selectOptions(routerSelect, 'nas-1');
    await user.type(profileInput, 'PLAN-MANUAL');

    const btn = screen.getByRole('button', { name: /Crear PPPoE/i });
    expect(btn).not.toBeDisabled();
  });
});

// ── CP-8: label con asterisco de requerido ───────────────────────────────────
describe('CP-8: el label del campo Plan tiene asterisco (*)', () => {
  it('el label asociado a pppoe-profile contiene un asterisco', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await expandCreateForm(user);

    // Buscamos el label que apunta a pppoe-profile
    const label = document.querySelector('label[for="pppoe-profile"]');
    expect(label).toBeInTheDocument();
    expect(label?.textContent).toMatch(/\*/);
  });
});
