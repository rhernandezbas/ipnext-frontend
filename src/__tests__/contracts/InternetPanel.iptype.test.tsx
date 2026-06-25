/**
 * InternetPanel — Tipo de IP toggle + auto-asignación de IP remota
 *
 * Tests:
 * IT-1: El toggle Privada / Pública se renderiza cuando el panel no tiene PPPoE activo
 * IT-2: Seleccionar tipo + router dispara fetch de IP y llena el campo "IP remota"
 * IT-3: El botón "cambiar" re-fetchea y actualiza el campo
 * IT-4: Error 404 muestra "Sin pool configurado" y deja el campo editable
 * IT-5: Error 422 muestra "Pool lleno" y deja el campo editable
 * IT-6: Error 502 muestra "Router no disponible" y deja el campo editable
 * IT-7: Si el operador escribe manualmente, un re-fetch no pisa su valor
 * IT-8: Al cambiar de tipo, el flag auto-fill se resetea
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { InternetPanel } from '@/pages/customers/tabs/contracts/InternetPanel';
import * as usePppoeModule from '@/hooks/usePppoe';
import * as useNasModule from '@/hooks/useNas';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useContractServicesModule from '@/hooks/useContractServices';

import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import type { NasServer } from '@/types/nas';
// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useContractServices');
// ServiceRemovalReasonModal is irrelevant for these tests
vi.mock(
  '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal',
  () => ({ ServiceRemovalReasonModal: () => null }),
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const NAS_SERVERS: NasServer[] = [
  { id: 'nas-1', name: 'Router Central', type: 'mikrotik_api', ipAddress: '192.168.1.1', radiusSecret: 'secret', nasIpAddress: '192.168.1.1', apiPort: null, apiLogin: null, apiPassword: null, status: 'active', lastSeen: null, clientCount: 0, description: '' },
  { id: 'nas-2', name: 'Router Norte', type: 'mikrotik_api', ipAddress: '192.168.1.2', radiusSecret: 'secret', nasIpAddress: '192.168.1.2', apiPort: null, apiLogin: null, apiPassword: null, status: 'active', lastSeen: null, clientCount: 0, description: '' },
];

const NO_PPPOE_CONTRACT_SERVICES = [
  { id: 'svc-1', name: 'INTERNET', status: 'inactive' },
];

/**
 * Base mock: no PPPoE activo → muestra CreatePppoeForm.
 * useNextFreeIp can be overridden per-test.
 */
function setupBaseMocks({
  nextFreeIp,
}: {
  nextFreeIp?: { data?: { ip: string } | undefined; isSuccess?: boolean; isFetching?: boolean; isError?: boolean; error?: Error | null; };
} = {}) {
  // No PPPoE activo
  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));

  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useCreatePppoe>);

  // Adopción de inventario (#pppoe-adopt) — el branch "sin PPPoE activo" ahora
  // monta también AssociatePppoeSection, así que estos hooks deben tener stub.
  vi.mocked(usePppoeModule.useUnassignedPppoe).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useAssociatePppoe>);
  vi.mocked(usePppoeModule.usePppoeCredentials).mockReturnValue(mockQuery({
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
  }));

  vi.mocked(useNasModule.useNasServers).mockReturnValue(mockQuery({
    data: NAS_SERVERS,
  }));

  vi.mocked(useNasModule.useNextFreeIp).mockReturnValue(mockQuery({
    data: undefined,
    isSuccess: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...nextFreeIp,
  }));

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn(() => true),
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);

  vi.mocked(useContractServicesModule.useUpdateContractService).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useContractServicesModule.useUpdateContractService>);

  // deactivate / update / move not needed in create flow
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useDeactivatePppoe>);
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useUpdatePppoe>);
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useMovePppoe>);
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useDeassociatePppoe>);
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useEnforcePppoeForContract>);

  vi.mocked(usePppoeModule.usePinPppoeIp).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  vi.mocked(usePppoeModule.useUnpinPppoeIp).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
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

/**
 * El form de crear PPPoE ahora vive en una sección colapsable que arranca cerrada.
 * Estos tests ejercitan el form, así que primero hay que expandirlo (mirror de la
 * nueva UX: el operador abre la sección "Cargar PPPoE" antes de cargar datos).
 */
async function expandCreateForm(user: ReturnType<typeof userEvent.setup>) {
  const createHeader = screen.getByRole('button', { name: /Cargar PPPoE/i });
  if (createHeader.getAttribute('aria-expanded') === 'false') {
    await user.click(createHeader);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── IT-1: Toggle presente ─────────────────────────────────────────────────────
describe('IT-1: toggle Tipo de IP', () => {
  it('renderiza los botones Privada y Pública en el formulario de creación', () => {
    setupBaseMocks();
    renderPanel();
    expect(screen.getByRole('button', { name: 'Privada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pública' })).toBeInTheDocument();
  });

  it('ninguno está activo (aria-pressed=false) al inicio', () => {
    setupBaseMocks();
    renderPanel();
    expect(screen.getByRole('button', { name: 'Privada' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Pública' })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── IT-2: Seleccionar tipo + router dispara fetch ─────────────────────────────
describe('IT-2: auto-asignación de IP al elegir tipo + router', () => {
  it('cuando hay nasId y se selecciona tipo, llena el campo IP remota con el resultado', async () => {
    const user = userEvent.setup();
    const refetchMock = vi.fn();

    setupBaseMocks({
      nextFreeIp: {
        data: { ip: '10.10.0.5' },
        isSuccess: true,
        isFetching: false,
        isError: false,
        refetch: refetchMock,
      } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>,
    });

    renderPanel();
    await expandCreateForm(user);

    // Elegir router
    await user.selectOptions(screen.getByRole('combobox', { name: /router/i }), 'nas-1');
    // Seleccionar tipo Privada
    await user.click(screen.getByRole('button', { name: 'Privada' }));

    // El campo IP remota debe tener el valor auto-asignado
    await waitFor(() => {
      expect(screen.getByLabelText(/IP remota/i)).toHaveValue('10.10.0.5');
    });
    // Se muestra el hint "auto-asignada"
    expect(screen.getByText('auto-asignada')).toBeInTheDocument();
  });

  it('pasa nasId y type correctos al hook useNextFreeIp', async () => {
    const user = userEvent.setup();
    setupBaseMocks();
    renderPanel();
    await expandCreateForm(user);

    await user.selectOptions(screen.getByRole('combobox', { name: /router/i }), 'nas-2');
    await user.click(screen.getByRole('button', { name: 'Pública' }));

    // El hook se llama con 'nas-2' y 'public'
    expect(useNasModule.useNextFreeIp).toHaveBeenCalledWith('nas-2', 'public');
  });
});

// ── IT-3: botón cambiar re-fetchea ────────────────────────────────────────────
describe('IT-3: botón "cambiar" re-fetchea', () => {
  it('click en "cambiar" llama a refetch del hook', async () => {
    const user = userEvent.setup();
    const refetchMock = vi.fn().mockResolvedValue({ data: { ip: '10.10.0.6' } });

    setupBaseMocks({
      nextFreeIp: {
        data: { ip: '10.10.0.5' },
        isSuccess: true,
        isFetching: false,
        isError: false,
        refetch: refetchMock,
      } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>,
    });

    renderPanel();
    await expandCreateForm(user);

    await user.selectOptions(screen.getByRole('combobox', { name: /router/i }), 'nas-1');
    await user.click(screen.getByRole('button', { name: 'Privada' }));

    // Espera el botón "cambiar"
    const cambiarBtn = await screen.findByRole('button', { name: 'cambiar' });
    await user.click(cambiarBtn);

    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});

// ── IT-4: Error 404 ───────────────────────────────────────────────────────────
describe('IT-4: error 404 — sin pool', () => {
  it('muestra "Sin pool configurado" y el campo sigue editable', async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error('not found'), { response: { status: 404 } });

    setupBaseMocks({
      nextFreeIp: {
        data: undefined,
        isSuccess: false,
        isFetching: false,
        isError: true,
        error: err,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>,
    });

    renderPanel();
    await expandCreateForm(user);

    await user.selectOptions(screen.getByRole('combobox', { name: /router/i }), 'nas-1');
    await user.click(screen.getByRole('button', { name: 'Privada' }));

    await waitFor(() => {
      expect(screen.getByText(/sin pool configurado/i)).toBeInTheDocument();
    });
    // Campo sigue editable (no disabled)
    expect(screen.getByLabelText(/IP remota/i)).not.toBeDisabled();
  });
});

// ── IT-5: Error 422 ───────────────────────────────────────────────────────────
describe('IT-5: error 422 — pool lleno', () => {
  it('muestra "Pool lleno" y el campo sigue editable', async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error('unprocessable'), { response: { status: 422 } });

    setupBaseMocks({
      nextFreeIp: {
        data: undefined,
        isSuccess: false,
        isFetching: false,
        isError: true,
        error: err,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>,
    });

    renderPanel();
    await expandCreateForm(user);

    await user.selectOptions(screen.getByRole('combobox', { name: /router/i }), 'nas-1');
    await user.click(screen.getByRole('button', { name: 'Pública' }));

    await waitFor(() => {
      expect(screen.getByText(/pool lleno/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/IP remota/i)).not.toBeDisabled();
  });
});

// ── IT-6: Error 502 ───────────────────────────────────────────────────────────
describe('IT-6: error 502 — router no disponible', () => {
  it('muestra "Router no disponible" y el campo sigue editable', async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error('bad gateway'), { response: { status: 502 } });

    setupBaseMocks({
      nextFreeIp: {
        data: undefined,
        isSuccess: false,
        isFetching: false,
        isError: true,
        error: err,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>,
    });

    renderPanel();
    await expandCreateForm(user);

    await user.selectOptions(screen.getByRole('combobox', { name: /router/i }), 'nas-1');
    await user.click(screen.getByRole('button', { name: 'Privada' }));

    await waitFor(() => {
      expect(screen.getByText(/router no disponible/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/IP remota/i)).not.toBeDisabled();
  });
});

// ── IT-7: Edición manual no es pisada por re-fetch ───────────────────────────
describe('IT-7: edición manual no es pisada por re-fetch', () => {
  it('si el operador tipea manualmente, el campo no se pisa al re-renderizar con nueva data', async () => {
    const user = userEvent.setup();

    // Primera render: sin data aún
    setupBaseMocks({
      nextFreeIp: {
        data: undefined,
        isSuccess: false,
        isFetching: false,
        isError: false,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>,
    });

    const { rerender } = renderPanel();
    await expandCreateForm(user);

    // Operador escribe manualmente
    const ipInput = screen.getByLabelText(/IP remota/i);
    await user.clear(ipInput);
    await user.type(ipInput, '192.168.1.99');
    expect(ipInput).toHaveValue('192.168.1.99');

    // Ahora el hook devuelve data (simula que llegó la respuesta)
    vi.mocked(useNasModule.useNextFreeIp).mockReturnValue({
      data: { ip: '10.10.0.5' },
      isSuccess: true,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>);

    await act(async () => {
      rerender(
        <QueryClientProvider client={makeQC()}>
          <InternetPanel
            contractId="contract-1"
            clientId="client-42"
            contractServices={NO_PPPOE_CONTRACT_SERVICES as never}
            onClose={vi.fn()}
          />
        </QueryClientProvider>,
      );
    });

    // El valor manual del operador se conserva
    expect(screen.getByLabelText(/IP remota/i)).toHaveValue('192.168.1.99');
  });
});

// ── IT-8: cambio de tipo resetea auto-fill ────────────────────────────────────
describe('IT-8: cambio de tipo resetea auto-fill', () => {
  it('al cambiar de Privada a Pública, Pública es la opción activa (aria-pressed)', async () => {
    const user = userEvent.setup();

    setupBaseMocks();
    renderPanel();
    await expandCreateForm(user);

    await user.click(screen.getByRole('button', { name: 'Privada' }));
    expect(screen.getByRole('button', { name: 'Privada' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Pública' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Pública' }));
    expect(screen.getByRole('button', { name: 'Pública' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Privada' })).toHaveAttribute('aria-pressed', 'false');
  });
});
