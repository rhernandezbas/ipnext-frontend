import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as GestionRedPage } from '@/pages/networking/GestionRedPage';
import * as useNasModule from '@/hooks/useNas';
import * as useNetworkModule from '@/hooks/useNetwork';
import * as useRadiusSessionsModule from '@/hooks/useRadiusSessions';
import type { NasServer } from '@/types/nas';
import { NAS_SECRET_MASK } from '@/types/nas';
import type { PaginatedAssignments } from '@/types/network';
import type { PaginatedRadiusSessions } from '@/types/radiusSessions';

// ── Masked-secret edit flow ───────────────────────────────────────────────────
// El BE ahora devuelve radiusSecret/apiPassword como el mask '••••••••' en las
// lecturas. Si el modal de edición pre-llena esos campos y siempre los manda,
// "Guardar" sin tocar el secret pisaría el valor real guardado con el mask.
// Este test cubre: (1) omitir los campos cuando no se tocan, (2) mandarlos
// cuando el usuario efectivamente escribe un valor nuevo.

vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useNetwork');
vi.mock('@/hooks/useRadiusSessions');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const maskedNas: NasServer = {
  id: '1',
  name: 'MikroTik central',
  type: 'mikrotik_api',
  ipAddress: '192.168.1.1',
  radiusSecret: NAS_SECRET_MASK,
  nasIpAddress: '192.168.1.1',
  apiPort: 8728,
  apiLogin: 'admin',
  apiPassword: NAS_SECRET_MASK,
  status: 'active',
  lastSeen: '2026-04-28T08:00:00Z',
  clientCount: 234,
  description: 'Router central',
};

const mockPaginatedEmpty: PaginatedAssignments = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 25,
};

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <GestionRedPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GestionRedPage — EditNasModal: no reenviar el mask del secret', () => {
  const updateMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNasModule.useNasServers).mockReturnValue({
      data: [maskedNas],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNasModule.useNasServers>);

    vi.mocked(useNasModule.useCreateNasServer).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useCreateNasServer>);

    vi.mocked(useNasModule.useUpdateNasServer).mockReturnValue({
      mutate: updateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useUpdateNasServer>);

    vi.mocked(useNasModule.useDeleteNasServer).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useDeleteNasServer>);

    vi.mocked(useNetworkModule.useIpNetworks).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpNetworks>);

    vi.mocked(useNetworkModule.useCreateIpNetwork).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpNetwork>);

    vi.mocked(useNetworkModule.useDeleteIpNetwork).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpNetwork>);

    vi.mocked(useNetworkModule.useIpPools).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpPools>);

    vi.mocked(useNetworkModule.useCreateIpPool).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpPool>);

    vi.mocked(useNetworkModule.useDeleteIpPool).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpPool>);

    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: mockPaginatedEmpty,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);

    vi.mocked(useNetworkModule.useIpv6Networks).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpv6Networks>);

    vi.mocked(useNetworkModule.useCreateIpv6Network).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpv6Network>);

    const envelope: PaginatedRadiusSessions = {
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      hasNext: false,
      stats: { total: 0, active: 0, idle: 0 },
    };
    vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue({
      data: envelope,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRadiusSessionsModule.useRadiusSessionsPaginated>);
  });

  async function openEditModal() {
    const user = userEvent.setup();
    renderPage();
    // La tab "Dispositivos NAS" es la default (activeTab='nas'), así que la
    // fila del NAS ya está en pantalla. Se abre el menú kebab de la fila y se
    // clickea "Editar" para abrir el modal.
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await user.click(kebabBtns[0]);
    await user.click(screen.getByRole('menuitem', { name: /^editar$/i }));
    return user;
  }

  it('omite radiusSecret y apiPassword cuando no se tocan (no pisa el secret real con el mask)', async () => {
    const user = await openEditModal();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/editar nas/i);

    await user.click(within(dialog).getByRole('button', { name: /guardar/i }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const arg = updateMutate.mock.calls[0][0];
    expect('radiusSecret' in arg.data).toBe(false);
    expect('apiPassword' in arg.data).toBe(false);
  });

  it('envía radiusSecret cuando el usuario efectivamente escribe un valor nuevo', async () => {
    const user = await openEditModal();

    const dialog = screen.getByRole('dialog');
    const secretInput = within(dialog).getByLabelText(/secret radius/i);
    await user.type(secretInput, 'nuevo-secret-123');
    await user.click(within(dialog).getByRole('button', { name: /guardar/i }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const arg = updateMutate.mock.calls[0][0];
    expect(arg.data.radiusSecret).toBe('nuevo-secret-123');
  });
});
