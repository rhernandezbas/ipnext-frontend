/**
 * SendCampaignButton (F2 apply chunk 3, SEND-1) — visible SOLO si
 * `status === 'pending'`. Doble-confirm (decisión LOCKED) + 409
 * CAMPAIGN_SEND_IN_PROGRESS. Container-fino: `useSendCampaign` REAL,
 * `@/api/messagingBulk.api` mockeada a nivel fetch (mismo seam que
 * `CampaignComposer.test.tsx`).
 *
 *  SCB-1 status !== 'pending' → no renderiza nada
 *  SCB-2 status === 'pending' → renderiza "Enviar campaña"
 *  SCB-3 click abre el 1er ConfirmModal con el total + advertencia
 *  SCB-4 confirmar el 1ro abre el 2do (irreversible, tone danger)
 *  SCB-5 cancelar cualquiera de los dos cierra sin llamar a sendCampaign
 *  SCB-6 confirmar el 2do llama a sendCampaign(id), toast de éxito + onSent
 *  SCB-7 409 CAMPAIGN_SEND_IN_PROGRESS → mensaje claro de envío en curso en
 *        el servidor, PERSISTENTE (no se auto-oculta como el toast), nunca
 *        "tu campaña" (bulk-detail-polling-fe Change A)
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { AxiosError, AxiosHeaders } from 'axios';

vi.mock('@/api/messagingBulk.api', () => ({
  listBulkTemplates: vi.fn(),
  previewSegment: vi.fn(),
  createCampaign: vi.fn(),
  sendCampaign: vi.fn(),
  getCampaign: vi.fn(),
  listCampaigns: vi.fn(),
}));

import { sendCampaign } from '@/api/messagingBulk.api';
import { SendCampaignButton } from '@/pages/whatsapp/BulkMessagingPage/components/detail/SendCampaignButton';
import type { CampaignStatusDto } from '@/types/messagingBulk';

/** Debe coincidir con `TOAST_DURATION_MS` del componente. */
const TOAST_MS = 4000;

function makeConflictError(): AxiosError {
  const error = new AxiosError('Request failed with status code 409', 'ERR_BAD_REQUEST');
  error.response = {
    status: 409,
    statusText: 'Conflict',
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture mínimo de AxiosResponse
    config: { headers: new AxiosHeaders() } as any,
    data: {
      error: 'Ya hay un envío de campañas en curso (se procesa una campaña a la vez); reintentá cuando termine',
      code: 'CAMPAIGN_SEND_IN_PROGRESS',
    },
  };
  return error;
}

/** F8 (review adversarial) — el BE re-chequea permisos AL ENVIAR: 403 BULK_RECIPIENTS_NOT_PERMITTED con forbidden. */
function makeForbiddenError(forbidden: string[] = ['bloqueado', 'números']): AxiosError {
  const error = new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST');
  error.response = {
    status: 403,
    statusText: 'Forbidden',
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture mínimo de AxiosResponse
    config: { headers: new AxiosHeaders() } as any,
    data: { error: 'sin permiso', code: 'BULK_RECIPIENTS_NOT_PERMITTED', forbidden },
  };
  return error;
}

function renderButton(overrides: { status?: CampaignStatusDto; total?: number; onSent?: () => void } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const onSent = overrides.onSent ?? vi.fn();
  return {
    ...render(
      <SendCampaignButton
        campaignId="camp-1"
        status={overrides.status ?? 'pending'}
        total={overrides.total ?? 42}
        onSent={onSent}
      />,
      { wrapper },
    ),
    onSent,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SCB-1: status distinto de pending', () => {
  it('no renderiza nada', () => {
    const { container } = renderButton({ status: 'running' });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SCB-2: status pending', () => {
  it('renderiza el botón "Enviar campaña"', () => {
    renderButton();
    expect(screen.getByRole('button', { name: /enviar campaña/i })).toBeInTheDocument();
  });
});

describe('SCB-3/4: doble-confirm', () => {
  it('abre el primer modal con el total y, al confirmar, el segundo con la advertencia irreversible', async () => {
    const user = userEvent.setup();
    renderButton({ total: 7 });

    await user.click(screen.getByRole('button', { name: /enviar campaña/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent('7 destinatarios');

    await user.click(screen.getByRole('button', { name: /continuar/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/irreversible/i);
    expect(sendCampaign).not.toHaveBeenCalled();
  });
});

describe('SCB-5: cancelar', () => {
  it('cancelar el primer modal cierra sin llamar a sendCampaign', async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: /enviar campaña/i }));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sendCampaign).not.toHaveBeenCalled();
  });

  it('cancelar el segundo modal cierra sin llamar a sendCampaign', async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: /enviar campaña/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sendCampaign).not.toHaveBeenCalled();
  });
});

describe('SCB-6: confirmar el segundo modal', () => {
  it('llama a sendCampaign, muestra un toast de éxito y llama a onSent', async () => {
    vi.mocked(sendCampaign).mockResolvedValue({ campaignId: 'camp-1', accepted: true });
    const user = userEvent.setup();
    const { onSent } = renderButton();

    await user.click(screen.getByRole('button', { name: /enviar campaña/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /sí, enviar/i }));

    await waitFor(() => expect(sendCampaign).toHaveBeenCalledWith('camp-1'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/envi/i);
    expect(onSent).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('SCB-7: 409 CAMPAIGN_SEND_IN_PROGRESS (bulk-detail-polling-fe Change A — wording más claro)', () => {
  it('muestra un mensaje claro de envío en curso en el servidor, nunca "tu campaña"', async () => {
    vi.mocked(sendCampaign).mockRejectedValue(makeConflictError());
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: /enviar campaña/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /sí, enviar/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/ya hay un envío en curso en el servidor/i);
    expect(alert).toHaveTextContent(/reintentá/i);
    expect(alert.textContent?.toLowerCase()).not.toMatch(/tu campaña/);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('el mensaje es PERSISTENTE — sigue en pantalla mucho después de la ventana del toast (4s)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(sendCampaign).mockRejectedValue(makeConflictError());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderButton();

    await user.click(screen.getByRole('button', { name: /enviar campaña/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /sí, enviar/i }));
    await screen.findByRole('alert');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOAST_MS + 1000);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/ya hay un envío en curso en el servidor/i);
    vi.useRealTimers();
  });
});

describe('SCB-8: fallo de envío que NO es 409 (FIX-3a)', () => {
  it('un error de red/500 se muestra visible (role=alert), no cae silencioso', async () => {
    vi.mocked(sendCampaign).mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: /enviar campaña/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /sí, enviar/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/no se pudo enviar/i);
    // no debe confundirse con el 409 (otra campaña en curso)
    expect(alert.textContent?.toLowerCase()).not.toMatch(/otra campaña|una a la vez/);
  });
});

describe('SCB-10: 403 BULK_RECIPIENTS_NOT_PERMITTED al ENVIAR (F8 review adversarial)', () => {
  it('muestra la lista de destinatarios prohibidos que devuelve el BE (no el error genérico)', async () => {
    vi.mocked(sendCampaign).mockRejectedValue(makeForbiddenError(['bloqueado', 'números']));
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: /enviar campaña/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /sí, enviar/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/no tenés permiso para enviar a: bloqueado, números/i);
    // No debe caer en el mensaje genérico de red/500.
    expect(alert.textContent?.toLowerCase()).not.toMatch(/no se pudo enviar/);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('SCB-9: cleanup del timer del toast al desmontar (FIX-8b)', () => {
  it('desmontar tras un envío exitoso limpia el timer ESPECÍFICO del toast (4s)', async () => {
    vi.mocked(sendCampaign).mockResolvedValue({ campaignId: 'camp-1', accepted: true });
    const setSpy = vi.spyOn(globalThis, 'setTimeout');
    const user = userEvent.setup();
    const { unmount } = renderButton();

    await user.click(screen.getByRole('button', { name: /enviar campaña/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /sí, enviar/i }));
    await screen.findByRole('alert'); // toast en pantalla → timer de 4s agendado

    // id del timer del toast (el único de 4000ms del componente)
    const toastIdx = setSpy.mock.calls.findIndex((args) => args[1] === TOAST_MS);
    expect(toastIdx, 'no se agendó el timer del toast (4s)').toBeGreaterThanOrEqual(0);
    const toastId = setSpy.mock.results[toastIdx].value;

    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    unmount();

    expect(clearSpy).toHaveBeenCalledWith(toastId);
    setSpy.mockRestore();
    clearSpy.mockRestore();
  });
});
