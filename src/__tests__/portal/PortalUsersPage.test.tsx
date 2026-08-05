/**
 * PortalUsersPage (gestion-app) — PÁGINA de Usuarios de la app, cableada al
 * CRUD REAL (`/api/admin/portal-accounts`, permiso `portal.manage`).
 *
 *  PU-1  la tabla renderiza las cuentas REALES que devuelve la API (mock del
 *        fetch — NADA hardcodeado en el componente)
 *  PU-2  4 ramas de estado: loading / empty / error+retry / success
 *  PU-3  gating: sin `portal.manage` NO se llama a la API y NO se ven acciones
 *  PU-4  regenerar contraseña exige DOBLE confirmación; sin completar las dos
 *        NO se llama al endpoint (revert-probe); al completarlas la nueva pass
 *        se muestra UNA vez
 *  PU-5  deshabilitar dispara el PATCH e INVALIDA la lista (se re-consulta)
 */
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/portalAccounts.api', () => ({
  portalAccountsApi: {
    list: vi.fn(),
    create: vi.fn(),
    setStatus: vi.fn(),
    regeneratePassword: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
}));

import { portalAccountsApi } from '@/api/portalAccounts.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import type { PortalAccountAdminDto, PortalAccountListDto } from '@/types/portalAccount';
import PortalUsersPage from '@/pages/portal/PortalUsersPage';

function account(overrides: Partial<PortalAccountAdminDto> = {}): PortalAccountAdminDto {
  return {
    id: 'acc-1',
    clientId: 'cli-1',
    clientName: 'Juan Pérez',
    dni: '30111222',
    status: 'active',
    lastLoginAt: '2026-04-28T10:00:00.000Z',
    ...overrides,
  };
}

function page(data: PortalAccountAdminDto[]): PortalAccountListDto {
  return { data, total: data.length, page: 1, limit: 20 };
}

function mockPerms(perms: string[]) {
  const base: UseMyPermissionsResult = {
    user: null,
    roles: [],
    permissions: perms,
    isLoading: false,
    isError: false,
    can: (permission, mode = 'any') => {
      if (perms.includes('*')) return true;
      const list = Array.isArray(permission) ? permission : [permission];
      return mode === 'all' ? list.every((p) => perms.includes(p)) : list.some((p) => perms.includes(p));
    },
  };
  vi.mocked(useMyPermissions).mockReturnValue(base);
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return { qc, ...render(<PortalUsersPage />, { wrapper }) };
}

/** ¿Sobrevive el texto `secret` en el `data` de ALGUNA mutación del cache? */
function secretLingersInMutationCache(qc: QueryClient, secret: string): boolean {
  return qc
    .getMutationCache()
    .getAll()
    .some((m) => JSON.stringify(m.state.data ?? null).includes(secret));
}

/** Abre el kebab de acciones de la (única) fila y clickea el item por nombre. */
async function clickRowAction(name: RegExp) {
  fireEvent.click(await screen.findByRole('button', { name: /acciones/i }));
  fireEvent.click(await screen.findByRole('menuitem', { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms(['portal.manage']);
});

describe('PortalUsersPage', () => {
  it('PU-1 renderiza las cuentas REALES de la API (no datos hardcodeados)', async () => {
    vi.mocked(portalAccountsApi.list).mockResolvedValue(
      page([account({ clientName: 'Ada Lovelace', dni: '27999888' })]),
    );

    renderPage();

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('27999888')).toBeInTheDocument();
    expect(portalAccountsApi.list).toHaveBeenCalled();
    // Ninguno de los nombres del viejo mock hardcodeado debe aparecer.
    expect(screen.queryByText('María García')).not.toBeInTheDocument();
  });

  it('PU-2a rama LOADING — no muestra vacío ni error mientras carga', () => {
    vi.mocked(portalAccountsApi.list).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/no hay cuentas/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /usuarios de la app/i })).toBeInTheDocument();
  });

  it('PU-2b rama EMPTY — sin cuentas muestra un mensaje honesto', async () => {
    vi.mocked(portalAccountsApi.list).mockResolvedValue(page([]));

    renderPage();

    expect(await screen.findByText(/no hay cuentas de la app/i)).toBeInTheDocument();
  });

  it('PU-2c rama ERROR — muestra alerta + reintentar, y reintentar re-consulta', async () => {
    vi.mocked(portalAccountsApi.list).mockRejectedValueOnce(new Error('boom'));

    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    vi.mocked(portalAccountsApi.list).mockResolvedValue(page([account({ clientName: 'Grace Hopper' })]));
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
  });

  it('PU-3 gating — sin portal.manage NO llama a la API y NO muestra acciones', async () => {
    mockPerms(['portal.read']);
    vi.mocked(portalAccountsApi.list).mockResolvedValue(page([account()]));

    renderPage();

    expect(await screen.findByText(/portal\.manage/i)).toBeInTheDocument();
    expect(portalAccountsApi.list).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /acciones/i })).not.toBeInTheDocument();
  });

  it('PU-4 regenerar contraseña — DOBLE confirmación (revert-probe) y revela la pass una vez', async () => {
    vi.mocked(portalAccountsApi.list).mockResolvedValue(page([account()]));
    vi.mocked(portalAccountsApi.regeneratePassword).mockResolvedValue({
      ...account(),
      password: 'Tmp-9x7Q2k',
    });

    renderPage();
    await screen.findByText('Juan Pérez');

    // Primer confirm.
    await clickRowAction(/regenerar contrase/i);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(portalAccountsApi.regeneratePassword).not.toHaveBeenCalled();

    // Avanza al SEGUNDO confirm — todavía NO llama al endpoint.
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));
    expect(await screen.findByText(/segunda confirmaci/i)).toBeInTheDocument();
    expect(portalAccountsApi.regeneratePassword).not.toHaveBeenCalled();

    // Confirma la segunda → recién ahí dispara.
    fireEvent.click(screen.getByRole('button', { name: /regenerar ahora/i }));
    await waitFor(() => expect(portalAccountsApi.regeneratePassword).toHaveBeenCalledTimes(1));

    // La nueva contraseña se muestra una vez, con botón de copiar.
    expect(await screen.findByText('Tmp-9x7Q2k')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument();
  });

  it('PU-4b revert-probe — cancelar la PRIMERA confirmación no llama al endpoint', async () => {
    vi.mocked(portalAccountsApi.list).mockResolvedValue(page([account()]));

    renderPage();
    await screen.findByText('Juan Pérez');

    await clickRowAction(/regenerar contrase/i);
    fireEvent.click(await screen.findByRole('button', { name: /cancelar/i }));

    expect(portalAccountsApi.regeneratePassword).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('PU-4c revert-probe — cancelar la SEGUNDA confirmación no llama al endpoint', async () => {
    vi.mocked(portalAccountsApi.list).mockResolvedValue(page([account()]));

    renderPage();
    await screen.findByText('Juan Pérez');

    await clickRowAction(/regenerar contrase/i);
    fireEvent.click(await screen.findByRole('button', { name: /^continuar$/i }));
    await screen.findByText(/segunda confirmaci/i);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(portalAccountsApi.regeneratePassword).not.toHaveBeenCalled();
  });

  it('PU-6 la pass temporal NO sobrevive en el MutationCache tras cerrar el modal', async () => {
    const SECRET = 'Tmp-9x7Q2k';
    vi.mocked(portalAccountsApi.list).mockResolvedValue(page([account()]));
    vi.mocked(portalAccountsApi.regeneratePassword).mockResolvedValue({ ...account(), password: SECRET });

    const { qc } = renderPage();
    await screen.findByText('Juan Pérez');

    // Regenerar (doble confirm) → revelar la pass.
    await clickRowAction(/regenerar contrase/i);
    fireEvent.click(await screen.findByRole('button', { name: /^continuar$/i }));
    await screen.findByText(/segunda confirmaci/i);
    fireEvent.click(screen.getByRole('button', { name: /regenerar ahora/i }));
    expect(await screen.findByText(SECRET)).toBeInTheDocument();

    // Presencia ANTES de cerrar: el secreto vive en el cache de la mutación
    // (esto ancla la ausencia posterior — sin esto el test pasaría trivialmente).
    expect(secretLingersInMutationCache(qc, SECRET)).toBe(true);

    // Cerrar el modal debe RESETEAR la mutación y borrar el secreto del cache
    // (el gc de `gcTime: 0` corre en un setTimeout(0) → esperamos con waitFor).
    fireEvent.click(screen.getByRole('button', { name: /entendido|cerrar/i }));
    await waitFor(() => expect(screen.queryByText(SECRET)).not.toBeInTheDocument());
    await waitFor(() => expect(secretLingersInMutationCache(qc, SECRET)).toBe(false));
  });

  it('PU-7 borrar la última fila de la última página repliega a la real (no falso vacío)', async () => {
    let removed = false;
    vi.mocked(portalAccountsApi.list).mockImplementation(async (params) => {
      const p = params?.page ?? 1;
      const total = removed ? 20 : 21;
      if (p >= 2) {
        return { data: removed ? [] : [account({ id: 'acc-21', clientName: 'Rosalind Franklin' })], total, page: 2, limit: 20 };
      }
      return { data: [account({ id: 'acc-1', clientName: 'Juan Pérez' })], total, page: 1, limit: 20 };
    });
    vi.mocked(portalAccountsApi.remove).mockResolvedValue(undefined);

    renderPage();
    await screen.findByText('Juan Pérez');

    // Ir a la página 2 (21 cuentas ⇒ 2 páginas de 20).
    fireEvent.click(await screen.findByRole('button', { name: '2' }));
    expect(await screen.findByText('Rosalind Franklin')).toBeInTheDocument();

    // Borrar la ÚNICA fila de la página 2 (doble confirm). A partir de acá la API
    // devuelve total=20 ⇒ la página 2 ya no existe.
    removed = true;
    await clickRowAction(/borrar/i);
    fireEvent.click(await screen.findByRole('button', { name: /^continuar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /eliminar definitivamente/i }));

    // El clamp debe replegar a la página 1: se ve la cuenta real, NO el falso
    // "no hay cuentas".
    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.queryByText(/no hay cuentas de la app/i)).not.toBeInTheDocument();
  });

  it('PU-5 deshabilitar — dispara el PATCH e invalida la lista (se re-consulta)', async () => {
    vi.mocked(portalAccountsApi.list).mockResolvedValue(page([account({ status: 'active' })]));
    vi.mocked(portalAccountsApi.setStatus).mockResolvedValue(account({ status: 'disabled' }));

    renderPage();
    await screen.findByText('Juan Pérez');
    const callsBefore = vi.mocked(portalAccountsApi.list).mock.calls.length;

    await clickRowAction(/deshabilitar/i);
    fireEvent.click(await within(screen.getByRole('dialog')).findByRole('button', { name: /deshabilitar/i }));

    await waitFor(() => expect(portalAccountsApi.setStatus).toHaveBeenCalledWith('acc-1', 'disabled'));
    // Invalidación → la lista se vuelve a consultar.
    await waitFor(() =>
      expect(vi.mocked(portalAccountsApi.list).mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });
});
