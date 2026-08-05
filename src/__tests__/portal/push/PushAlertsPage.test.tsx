/**
 * PushAlertsPage (gestion-app) — avisos push de SERVICIO a la app de clientes.
 * Única pantalla nueva de verdad del change: hasta ahora esto sólo se podía
 * disparar por API.
 *
 *  PP-1 "Enviar" arranca DESHABILITADO — hay que ver el alcance primero
 *  PP-2 "Ver alcance" llama al preview con el nodo elegido y muestra N/M
 *  PP-3 cambiar el nodo INVALIDA el alcance (el número ya no corresponde al filtro)
 *  PP-4 doble confirmación con el impacto explícito ANTES de enviar
 *  PP-5 cancelar la PRIMERA confirmación ⇒ NO se llama al endpoint de envío
 *  PP-6 cancelar la SEGUNDA confirmación ⇒ NO se llama al endpoint de envío
 *  PP-7 resultado real (recipients/devices/inboxed)
 *  PP-8 dryRun:true avisa que Firebase no está configurado y que NO se envió nada
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/push.api', () => ({
  pushApi: { previewServiceAlert: vi.fn(), sendServiceAlert: vi.fn() },
}));

vi.mock('@/api/networkSite.api', () => ({
  getNetworkSites: vi.fn(),
  createNetworkSite: vi.fn(),
  updateNetworkSite: vi.fn(),
  patchNetworkSite: vi.fn(),
  deleteNetworkSite: vi.fn(),
}));

import { pushApi } from '@/api/push.api';
import { getNetworkSites } from '@/api/networkSite.api';
import { useConfirm } from '@/context/ConfirmContext';
import PushAlertsPage from '@/pages/portal/PushAlertsPage/PushAlertsPage';
import type { NetworkSite } from '@/types/networkSite';

function site(id: string, name: string): NetworkSite {
  return {
    id,
    siteNumber: 1,
    fixedCode: 'NODO 1',
    name,
    address: '',
    city: 'Chivilcoy',
    coordinates: null,
    type: 'nodo',
    status: 'active',
    deviceCount: 0,
    clientCount: 0,
    uplink: '',
    parentSiteId: null,
    description: '',
    iclassNodeCode: null,
  } as NetworkSite;
}

const SITES = [site('site-1', 'Nodo Centro'), site('site-2', 'Nodo Norte')];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<PushAlertsPage />, { wrapper });
}

async function fillMessage(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/título/i), 'Corte programado');
  await user.type(screen.getByLabelText(/mensaje/i), 'Mañana de 9 a 12 hs.');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getNetworkSites).mockResolvedValue(SITES);
  vi.mocked(pushApi.previewServiceAlert).mockResolvedValue({ recipients: 128, devices: 205 });
  vi.mocked(pushApi.sendServiceAlert).mockResolvedValue({
    recipients: 128,
    devices: 205,
    invalidated: 3,
    dryRun: false,
    inboxed: 130,
  });
  // El setup global mockea useConfirm auto-confirmando; re-aplicarlo tras el clearAllMocks.
  vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
});

describe('PP-1: el envío exige ver el alcance primero', () => {
  it('el botón Enviar arranca deshabilitado aun con título y mensaje cargados', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillMessage(user);

    expect(screen.getByRole('button', { name: /enviar aviso/i })).toBeDisabled();
  });

  it('se habilita recién después de "Ver alcance"', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillMessage(user);

    await user.click(screen.getByRole('button', { name: /ver alcance/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /enviar aviso/i })).toBeEnabled());
  });
});

describe('PP-2: preview', () => {
  it('llama al preview con el nodo elegido y muestra cuentas y dispositivos', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillMessage(user);
    await screen.findByRole('option', { name: /nodo centro/i });
    await user.selectOptions(screen.getByLabelText(/nodo/i), 'site-1');

    await user.click(screen.getByRole('button', { name: /ver alcance/i }));

    await waitFor(() => expect(pushApi.previewServiceAlert).toHaveBeenCalledWith({ networkSiteId: 'site-1' }));
    const scope = await screen.findByTestId('push-scope');
    expect(scope.textContent).toMatch(/128/);
    expect(scope.textContent).toMatch(/205/);
  });

  it('sin nodo elegido manda networkSiteId null (todos)', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillMessage(user);

    await user.click(screen.getByRole('button', { name: /ver alcance/i }));
    await waitFor(() => expect(pushApi.previewServiceAlert).toHaveBeenCalledWith({ networkSiteId: null }));
  });
});

describe('PP-3: el alcance caduca al cambiar el filtro', () => {
  it('cambiar el nodo vuelve a deshabilitar Enviar', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillMessage(user);
    await user.click(screen.getByRole('button', { name: /ver alcance/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /enviar aviso/i })).toBeEnabled());

    await screen.findByRole('option', { name: /nodo norte/i });
    await user.selectOptions(screen.getByLabelText(/nodo/i), 'site-2');

    expect(screen.getByRole('button', { name: /enviar aviso/i })).toBeDisabled();
    expect(screen.queryByTestId('push-scope')).not.toBeInTheDocument();
  });
});

describe('PP-4: doble confirmación con impacto explícito', () => {
  it('pide DOS confirmaciones y la primera dice a cuántos clientes les llega', async () => {
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    const user = userEvent.setup();
    renderPage();
    await fillMessage(user);
    await user.click(screen.getByRole('button', { name: /ver alcance/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /enviar aviso/i })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: /enviar aviso/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(2));
    const first = confirmFn.mock.calls[0]![0] as { message: string };
    expect(first.message).toMatch(/128/);
    expect(first.message).toMatch(/cliente/i);
    const second = confirmFn.mock.calls[1]![0] as { message: string; tone?: string };
    expect(second.message).toMatch(/128/);
    expect(second.tone).toBe('danger');
    await waitFor(() => expect(pushApi.sendServiceAlert).toHaveBeenCalledTimes(1));
  });
});

describe('PP-5 / PP-6: sin confirmar NO se envía', () => {
  it('cancelar la PRIMERA confirmación no llama al endpoint de envío', async () => {
    const confirmFn = vi.fn().mockResolvedValue(false);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    const user = userEvent.setup();
    renderPage();
    await fillMessage(user);
    await user.click(screen.getByRole('button', { name: /ver alcance/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /enviar aviso/i })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: /enviar aviso/i }));

    // El aserto que carga el peso es el de ABAJO (no se envió). El conteo de
    // confirmaciones lo fija PP-4; acá pedir un número exacto haría que el test
    // se cayera por la razón equivocada si alguien rompiera el corte temprano.
    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(pushApi.sendServiceAlert).not.toHaveBeenCalled();
  });

  it('cancelar la SEGUNDA confirmación no llama al endpoint de envío', async () => {
    const confirmFn = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    const user = userEvent.setup();
    renderPage();
    await fillMessage(user);
    await user.click(screen.getByRole('button', { name: /ver alcance/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /enviar aviso/i })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: /enviar aviso/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(2));
    expect(pushApi.sendServiceAlert).not.toHaveBeenCalled();
  });
});

describe('PP-7: resultado real', () => {
  it('muestra recipients / devices / inboxed devueltos por el BE', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillMessage(user);
    await user.click(screen.getByRole('button', { name: /ver alcance/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /enviar aviso/i })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /enviar aviso/i }));

    const result = await screen.findByTestId('push-result');
    expect(result.textContent).toMatch(/128/);
    expect(result.textContent).toMatch(/205/);
    expect(result.textContent).toMatch(/130/);
    expect(pushApi.sendServiceAlert).toHaveBeenCalledWith({
      title: 'Corte programado',
      body: 'Mañana de 9 a 12 hs.',
      networkSiteId: null,
    });
  });
});

describe('PP-8: dryRun', () => {
  it('avisa que Firebase no está configurado y que NO se envió nada', async () => {
    vi.mocked(pushApi.sendServiceAlert).mockResolvedValue({
      recipients: 128,
      devices: 205,
      invalidated: 0,
      dryRun: true,
      inboxed: 130,
    });
    const user = userEvent.setup();
    renderPage();
    await fillMessage(user);
    await user.click(screen.getByRole('button', { name: /ver alcance/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /enviar aviso/i })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /enviar aviso/i }));

    const result = await screen.findByTestId('push-result');
    expect(result.textContent).toMatch(/firebase/i);
    expect(result.textContent).toMatch(/no se envió/i);
  });
});
