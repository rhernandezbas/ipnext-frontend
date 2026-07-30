/**
 * pppoe-move-ip-kind-aware (Fase 5) — el toggle de tipo de IP ofrece SOLO lo que el NAS soporta.
 *
 * Pedido del usuario: "si el NE8000 ya no tiene CGNAT, que desaparezca el botón de Privada".
 * El BE expone `supportedIpKinds` por NAS (derivado de sus `IpPool.ipKind`); el FE lo consume.
 *
 * Regla de las DOS CAPAS: el FE es comodidad (no ofrece lo imposible), el BE es autoridad
 * (rechaza lo inválido igual). Por eso el fallback con `supportedIpKinds` ausente muestra AMBOS:
 * esconder los dos bloquearía al operador por un fallo de lectura ajeno a su intención.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { InternetPanel } from '@/pages/customers/tabs/contracts/InternetPanel';
import * as usePppoeModule from '@/hooks/usePppoe';
import * as useNasModule from '@/hooks/useNas';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useContractServicesModule from '@/hooks/useContractServices';
import * as usePlansModule from '@/hooks/usePlans';
import type { PppoeServiceDto } from '@/types/pppoe';
import type { NasServer } from '@/types/nas';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useContractServices');
vi.mock('@/hooks/usePlans');
vi.mock(
  '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal',
  () => ({ ServiceRemovalReasonModal: () => null }),
);

const BASE_PPPOE: PppoeServiceDto = {
  id: 'pppoe-1', username: 'cliente.test', profile: 'IP-Air-30-30',
  remoteAddress: '100.64.60.200', status: 'enabled', enforcedState: 'active',
  nasId: 'nas-cgnat', contractId: 'contract-1', createdAt: '2026-06-01T00:00:00Z',
  ipMode: 'fixed', ipTypePreference: 'cgnat',
};

function nas(id: string, name: string, supportedIpKinds?: Array<'cgnat' | 'public'>): NasServer {
  return {
    id, name, type: 'radius_orchestrator', ipAddress: '10.0.0.1', radiusSecret: 's',
    nasIpAddress: '10.0.0.1', apiPort: null, apiLogin: null, apiPassword: null,
    status: 'active', lastSeen: null, clientCount: 0, description: '',
    ...(supportedIpKinds !== undefined ? { supportedIpKinds } : {}),
  } as NasServer;
}

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}
function neutralMutation() {
  return { mutateAsync: vi.fn(), isPending: false } as never;
}

function setup(nasList: NasServer[], pppoePatch: Partial<PppoeServiceDto> = {}) {
  const updateSpy = vi.fn().mockResolvedValue({});
  const moveSpy = vi.fn().mockResolvedValue({});

  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue(mockQuery({
    data: [{ ...BASE_PPPOE, ...pppoePatch }], isLoading: false, isError: false, isSuccess: true,
  }));
  vi.mocked(usePppoeModule.useUnassignedPppoe).mockReturnValue(mockQuery({ data: [], isSuccess: true }));
  vi.mocked(usePppoeModule.usePppoeCredentials).mockReturnValue(mockQuery({ data: undefined, isSuccess: false }));
  vi.mocked(usePppoeModule.usePppoeCallerId).mockReturnValue(mockQuery({ data: undefined, isSuccess: false }));
  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue({ mutateAsync: moveSpy, isPending: false } as never);
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue({ mutateAsync: updateSpy, isPending: false } as never);

  vi.mocked(useNasModule.useNasServers).mockReturnValue(mockQuery({ data: nasList }));
  vi.mocked(useNasModule.useNextFreeIp).mockReturnValue(mockQuery({
    data: { ip: '190.7.229.90' }, isSuccess: true, isFetching: false, isError: false, error: null, refetch: vi.fn(),
  }));
  vi.mocked(useContractServicesModule.useUpdateContractService).mockReturnValue(neutralMutation());
  vi.mocked(usePlansModule.usePlans).mockReturnValue(mockQuery({ data: [], isSuccess: true }));
  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn(() => true), isLoading: false, isError: false,
    permissions: ['pppoe.manage'], roles: [], user: null,
  } as never);

  return { updateSpy, moveSpy };
}

function renderPanel() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <InternetPanel contractId="contract-1" clientId="client-42" contractServices={[] as never} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

async function openEditForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Editar/i }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('el toggle ofrece solo los tipos que el NAS soporta', () => {
  it('NAS public-only: "Privada" NO se muestra y "Pública" queda seleccionada', async () => {
    const user = userEvent.setup();
    setup([nas('nas-cgnat', 'NE8000 - Mercedes', ['public'])]);
    renderPanel();
    await openEditForm(user);

    expect(screen.queryByRole('button', { name: 'Privada' })).not.toBeInTheDocument();
    const publica = screen.getByRole('button', { name: 'Pública' });
    expect(publica).toHaveAttribute('aria-pressed', 'true');
  });

  it('NAS cgnat-only: "Pública" NO se muestra', async () => {
    const user = userEvent.setup();
    setup([nas('nas-cgnat', 'CANEPA', ['cgnat'])]);
    renderPanel();
    await openEditForm(user);

    expect(screen.queryByRole('button', { name: 'Pública' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Privada' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('NAS con ambas clases: se muestran las dos opciones', async () => {
    const user = userEvent.setup();
    setup([nas('nas-cgnat', 'RDA Agote', ['cgnat', 'public'])]);
    renderPanel();
    await openEditForm(user);

    expect(screen.getByRole('button', { name: 'Privada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pública' })).toBeInTheDocument();
  });

  it('supportedIpKinds AUSENTE: fallback a mostrar ambas (el BE es el gate)', async () => {
    const user = userEvent.setup();
    setup([nas('nas-cgnat', 'NAS legacy')]);   // sin el campo
    renderPanel();
    await openEditForm(user);

    expect(screen.getByRole('button', { name: 'Privada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pública' })).toBeInTheDocument();
  });

  it('supportedIpKinds VACIO: fallback a mostrar ambas', async () => {
    const user = userEvent.setup();
    setup([nas('nas-cgnat', 'NAS sin pools', [])]);
    renderPanel();
    await openEditForm(user);

    expect(screen.getByRole('button', { name: 'Privada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pública' })).toBeInTheDocument();
  });
});

describe('el ipTypePreference se manda al backend', () => {
  it('cambiar SOLO el tipo (sin tocar el router) lo manda en el update', async () => {
    const user = userEvent.setup();
    const { updateSpy } = setup([nas('nas-cgnat', 'RDA Agote', ['cgnat', 'public'])]);
    renderPanel();
    await openEditForm(user);

    await user.click(screen.getByRole('button', { name: 'Pública' }));
    await user.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(updateSpy).toHaveBeenCalled();
    const body = updateSpy.mock.calls[0][0].body as Record<string, unknown>;
    expect(body.ipTypePreference).toBe('public');
  });

  /**
   * Hallazgo del review adversarial: en la ADOPCIÓN de un pendiente (elegir router en el form de
   * un servicio con nasId null) el `nasChanged` es true, así que la preferencia NO se mandaba y la
   * adopción usaba la PERSISTIDA. El operador elegía "Pública", el cliente recibía una CGNAT, y
   * NO había ningún error: falla silenciosa.
   *
   * Fix de ORDEN: en un pendiente, la preferencia se persiste ANTES del move, para que la
   * adopción resuelva el pool con la clase que el operador acaba de elegir.
   */
  it('ADOPCIÓN de un pendiente: la clase elegida se persiste ANTES del move', async () => {
    const user = userEvent.setup();
    const { updateSpy, moveSpy } = setup(
      [nas('nas-agote', 'RDA Agote', ['cgnat', 'public'])],
      { nasId: null, remoteAddress: null },
    );
    renderPanel();
    await openEditForm(user);

    await user.click(screen.getByRole('button', { name: 'Pública' }));
    await user.selectOptions(screen.getByLabelText(/Router/i), 'nas-agote');
    await user.click(screen.getByRole('button', { name: /Guardar/i }));

    // La preferencia viajó...
    expect(updateSpy).toHaveBeenCalled();
    const body = updateSpy.mock.calls[0][0].body as Record<string, unknown>;
    expect(body.ipTypePreference).toBe('public');
    // ...y ANTES del move, para que la adopción use la clase nueva.
    expect(moveSpy).toHaveBeenCalled();
    expect(updateSpy.mock.invocationCallOrder[0]).toBeLessThan(moveSpy.mock.invocationCallOrder[0]);
  });

  it('si el ROUTER cambió en un servicio YA instalado, el update NO manda ipTypePreference (el move resolvió la clase)', async () => {
    const user = userEvent.setup();
    const { updateSpy, moveSpy } = setup([
      nas('nas-cgnat', 'CANEPA', ['cgnat']),
      nas('nas-ne', 'NE8000 - Mercedes', ['public']),
    ]);
    renderPanel();
    await openEditForm(user);

    await user.selectOptions(screen.getByLabelText(/Router/i), 'nas-ne');
    await user.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(moveSpy).toHaveBeenCalled();
    if (updateSpy.mock.calls.length > 0) {
      const body = updateSpy.mock.calls[0][0].body as Record<string, unknown>;
      expect(body.ipTypePreference).toBeUndefined();
    }
  });
});
