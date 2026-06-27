/**
 * InternetPanel — Secciones colapsables (disclosure) del branch "sin PPPoE activo"
 *
 * Tests:
 *  CO-1  Ambas secciones (Asociar / Cargar) arrancan COLAPSADAS (aria-expanded=false).
 *  CO-2  El contenido interno NO es interactivo mientras está colapsado (el wrapper es inert).
 *  CO-3  Click en el header "Cargar PPPoE" expande la sección (aria-expanded=true) y el form queda usable.
 *  CO-4  Click en el header "Asociar PPPoE existente" expande la lista de huérfanos.
 *  CO-5  Toggle por teclado (Enter / Space) sobre el header expande/colapsa.
 *  CO-6  Cada sección es independiente: expandir una no expande la otra.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { InternetPanel } from '@/pages/customers/tabs/contracts/InternetPanel';
import * as usePppoeModule from '@/hooks/usePppoe';
import * as useNasModule from '@/hooks/useNas';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useContractServicesModule from '@/hooks/useContractServices';
import type { PppoeServiceDto } from '@/types/pppoe';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useContractServices');
vi.mock(
  '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal',
  () => ({ ServiceRemovalReasonModal: () => null }),
);

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const NO_PPPOE_CONTRACT_SERVICES = [{ id: 'svc-1', name: 'INTERNET', status: 'inactive' }];

const ORPHANS: PppoeServiceDto[] = [
  {
    id: 'orphan-1', username: 'juan.perez', profile: '20M', remoteAddress: '10.0.0.1',
    status: 'active', enforcedState: 'active', nasId: 'nas-1', contractId: null,
    createdAt: '2026-06-01T00:00:00Z',
  },
];

function neutralMutation() {
  return { mutateAsync: vi.fn(), isPending: false } as never;
}

function setup() {
  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue(mockQuery({
    data: [], isLoading: false, isError: false, isSuccess: true,
  }));

  vi.mocked(usePppoeModule.useUnassignedPppoe).mockReturnValue({
    data: ORPHANS, isLoading: false, isError: false, isSuccess: true,
  } as ReturnType<typeof usePppoeModule.useUnassignedPppoe>);

  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}), isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useAssociatePppoe>);

  vi.mocked(usePppoeModule.usePppoeCredentials).mockReturnValue({
    data: undefined, isLoading: false, isError: false, isSuccess: false,
  } as ReturnType<typeof usePppoeModule.usePppoeCredentials>);

  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue(neutralMutation());

  vi.mocked(useNasModule.useNasServers).mockReturnValue({
    data: [{ id: 'nas-1', name: 'Router Central' }],
  } as ReturnType<typeof useNasModule.useNasServers>);
  vi.mocked(useNasModule.useNextFreeIp).mockReturnValue({
    data: undefined, isSuccess: false, isError: false, isFetching: false,
    error: null, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>);

  vi.mocked(useContractServicesModule.useUpdateContractService).mockReturnValue(neutralMutation());

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn(() => true),
    isLoading: false,
    isError: false,
    permissions: ['pppoe.manage'],
    roles: [],
    user: null,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
}

function renderPanel() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <InternetPanel
        contractId="contract-1"
        clientId="client-42"
        contractServices={NO_PPPOE_CONTRACT_SERVICES as never}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

/** El header de disclosure de cada sección es un <button> con su título como nombre. */
function header(name: RegExp | string) {
  return screen.getByRole('button', { name });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CO-1: ambas secciones arrancan colapsadas', () => {
  it('los dos headers tienen aria-expanded=false al render inicial', () => {
    setup();
    renderPanel();
    expect(header(/Asociar PPPoE existente/i)).toHaveAttribute('aria-expanded', 'false');
    expect(header(/Cargar PPPoE/i)).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('CO-2: colapsado = no interactivo', () => {
  it('la región colapsada está marcada inert (fuera del tab-order / a11y)', () => {
    setup();
    renderPanel();
    const createHeader = header(/Cargar PPPoE/i);
    const regionId = createHeader.getAttribute('aria-controls')!;
    const region = document.getElementById(regionId)!;
    expect(region).toHaveAttribute('inert');
  });
});

describe('CO-3: expandir Cargar PPPoE', () => {
  it('click en el header pone aria-expanded=true y el form queda usable', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();

    const createHeader = header(/Cargar PPPoE/i);
    await user.click(createHeader);

    expect(createHeader).toHaveAttribute('aria-expanded', 'true');
    // El campo Usuario del form se puede tipear una vez expandido.
    // El matcher es exacto: "Buscar por usuario" (sección Asociar) también
    // contiene "usuario", así que un regex amplio matchearía de más.
    const usuario = screen.getByLabelText(/^Usuario/);
    await user.type(usuario, 'nuevo.cliente');
    expect(usuario).toHaveValue('nuevo.cliente');
  });
});

describe('CO-4: expandir Asociar PPPoE existente', () => {
  it('click en el header revela la lista de huérfanos', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();

    const assocHeader = header(/Asociar PPPoE existente/i);
    await user.click(assocHeader);

    expect(assocHeader).toHaveAttribute('aria-expanded', 'true');
    const region = document.getElementById(assocHeader.getAttribute('aria-controls')!)!;
    expect(within(region).getByText('juan.perez')).toBeInTheDocument();
  });
});

describe('CO-5: toggle por teclado', () => {
  it('Enter sobre el header expande; Space lo vuelve a colapsar', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();

    const createHeader = header(/Cargar PPPoE/i);
    createHeader.focus();
    expect(createHeader).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(createHeader).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard(' ');
    expect(createHeader).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('CO-6: secciones independientes', () => {
  it('expandir Cargar PPPoE no expande Asociar', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();

    await user.click(header(/Cargar PPPoE/i));

    expect(header(/Cargar PPPoE/i)).toHaveAttribute('aria-expanded', 'true');
    expect(header(/Asociar PPPoE existente/i)).toHaveAttribute('aria-expanded', 'false');
  });
});
