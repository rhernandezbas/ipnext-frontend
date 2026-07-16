/**
 * BulkMessagingPage — container + Tabs "Nueva campaña"/"Historial" (F2, apply
 * chunk 1 shell + chunk 2 wiring del composer + chunk 3 wiring de
 * Historial/Detalle).
 *
 *  BMP-1 renderiza el título "Envío masivo" y los 2 tabs
 *  BMP-2 arranca en el tab "Nueva campaña"
 *  BMP-3 clickear "Historial" cambia el panel activo
 *  BMP-4 el tab "Nueva campaña" monta el composer real (CampaignComposer)
 *  BMP-5 al crear una campaña, cambia a "Historial" y persiste el id en `?campaign=`
 *  BMP-6 sin `?campaign=` en la URL, "Historial" muestra CampaignsTable
 *  BMP-7 con `?campaign=<id>` en la URL, "Historial" muestra CampaignDetail
 *
 * Chunk 2 agrega el wrapper de `QueryClientProvider`/`MemoryRouter` (el
 * composer real usa hooks de datos + `useSearchParams`) + mocks de
 * `@/hooks/useMyPermissions` y `@/api/messagingBulk.api` — mismo criterio que
 * `WhatsappInboxPage.test.tsx`/`useBulkMessaging.test.ts` (hook real, api
 * mockeada a nivel fetch). Chunk 3 agrega `listCampaigns`/`getCampaign`
 * resueltos al `beforeEach` — ambos tabs se montan siempre
 * (`Tabs mountMode="all"`), así que Historial fetchea desde el primer render.
 */
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/messagingBulk.api', () => ({
  listBulkTemplates: vi.fn(),
  previewSegment: vi.fn(),
  createCampaign: vi.fn(),
  sendCampaign: vi.fn(),
  getCampaign: vi.fn(),
  listCampaigns: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions');

import { listBulkTemplates, previewSegment, createCampaign, listCampaigns, getCampaign, sendCampaign } from '@/api/messagingBulk.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import BulkMessagingPage from '@/pages/whatsapp/BulkMessagingPage';
import type { CampaignDto, PreviewSegmentOutput, TemplateSummaryDto } from '@/types/messagingBulk';

const TEMPLATE: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: [],
  approvalStatus: 'approved',
  sendable: true,
  body: 'Hola {{1}}, este es tu recordatorio de pago.',
};

const PREVIEW: PreviewSegmentOutput = {
  count: 10,
  sample: [{ clientId: 'cli-1', name: 'Juan Perez', phoneE164: '+5491100000000', status: 'late' }],
  skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
  statusCounts: { late: 10 },
};

const CAMPAIGN_DTO: CampaignDto = {
  id: 'camp-1',
  name: 'Recordatorio julio',
  templateName: 'Recordatorio de pago',
  status: 'pending',
  total: 10,
  sentCount: 0,
  failedCount: 0,
  skippedCount: 0,
  optedOutCount: 0,
  createdAt: '2026-07-01T12:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  templateRef: 'HX123',
  segment: { statuses: ['late'] },
};

function renderPage(initialEntries: string[] = ['/admin/whatsapp/bulk']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <BulkMessagingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: ['messaging.templates'],
    isLoading: false,
    isError: false,
    can: () => true,
  } as UseMyPermissionsResult);
  vi.mocked(listBulkTemplates).mockResolvedValue([TEMPLATE]);
  vi.mocked(previewSegment).mockResolvedValue(PREVIEW);
  vi.mocked(createCampaign).mockResolvedValue({ campaignId: 'camp-1', total: 10, status: 'pending' });
  vi.mocked(listCampaigns).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
  vi.mocked(getCampaign).mockResolvedValue({ campaign: CAMPAIGN_DTO });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BMP-1: header + tabs', () => {
  it('renderiza el título "Envío masivo"', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Envío masivo' })).toBeInTheDocument();
  });

  it('renderiza los tabs "Nueva campaña" e "Historial"', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Nueva campaña' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Historial' })).toBeInTheDocument();
  });
});

describe('BMP-2: tab inicial', () => {
  it('arranca con "Nueva campaña" seleccionado', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Nueva campaña' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'false');
  });
});

describe('BMP-3: cambio de tab', () => {
  it('clickear "Historial" lo selecciona', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Historial' }));

    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Nueva campaña' })).toHaveAttribute('aria-selected', 'false');
  });
});

describe('BMP-4: composer real', () => {
  it('el tab "Nueva campaña" monta CampaignComposer (fetchea templates)', async () => {
    renderPage();
    await waitFor(() => expect(listBulkTemplates).toHaveBeenCalled());
    expect(await screen.findByRole('combobox', { name: /template/i })).toBeInTheDocument();
  });
});

describe('BMP-5: creación → cambia a Historial + persiste el id', () => {
  it('al crear la campaña, activa el tab Historial', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    await user.click(screen.getByRole('button', { name: /ver preview/i }));
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Recordatorio julio');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    // #5 — "Crear campaña" abre el modal de confirmación; el confirm de adentro dispara la creación.
    await user.click(createButton);
    const confirmDialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    await user.click(within(confirmDialog).getByRole('button', { name: /confirmar y crear/i }));

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true'));
  });
});

describe('BMP-6: Historial sin ?campaign=', () => {
  it('muestra CampaignsTable (fetchea el listado)', async () => {
    renderPage();
    await waitFor(() => expect(listCampaigns).toHaveBeenCalled());
    expect(getCampaign).not.toHaveBeenCalled();
  });
});

describe('BMP-7: Historial con ?campaign=<id>', () => {
  it('muestra CampaignDetail (fetchea la campaña puntual)', async () => {
    renderPage(['/admin/whatsapp/bulk?campaign=camp-1']);

    await waitFor(() => expect(getCampaign).toHaveBeenCalledWith('camp-1', expect.anything()));
    expect(await screen.findByText('Recordatorio julio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver al historial/i })).toBeInTheDocument();
  });
});

// FIX-4 — contaminación de estado entre campañas (lección `inbox-key-por-conversacion`):
// cambiar de ?campaign=A a B por cambio de prop (sin remount) NO debe conservar
// el filtro/paginación de RecipientsTable de A. `key={campaignId}` fuerza el reset.
function CampaignSwitcher() {
  const [, setSearchParams] = useSearchParams();
  return (
    <button type="button" onClick={() => setSearchParams({ campaign: 'camp-2' })}>
      switch-to-2
    </button>
  );
}

// MEDIUM-4 (Fix Wave, review adversarial) — este test es una GUARDIA DE
// WIRING del doble-confirm → `sendCampaign` a nivel `BulkMessagingPage`
// (router real + `Tabs mountMode="all"`, la composición real de prod). NO es
// un repro del bug de prod "el POST /send nunca sale": acá la api layer está
// mockeada (`vi.mock('@/api/messagingBulk.api')`), sin lazy import ni
// permisos reales, así que no puede reproducir un bundle stale servido por
// el browser ni un bloqueo client-side (extensión/adblocker/CSP). El bug de
// prod se cerró por otra vía: Playwright contra prod emitió el POST
// perfecto, evidenciando que era un bloqueo client-side en el browser del
// operador, no un problema del wiring de componentes — ver proposal.md
// ("Investigación adicional") y `openspec/changes/bulk-detail-polling-fe/`.
describe('BMP-9: guardia de wiring del doble-confirm → sendCampaign (NO repro del bug de prod)', () => {
  it('con mountMode="all" (ambos tabs montados) + router real, confirmar el 2do modal SÍ llama a sendCampaign(id) exactamente una vez', async () => {
    vi.mocked(sendCampaign).mockResolvedValue({ campaignId: 'camp-1', accepted: true });
    const user = userEvent.setup();
    renderPage(['/admin/whatsapp/bulk?campaign=camp-1']);

    await user.click(await screen.findByRole('button', { name: /enviar campaña/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    // LOW-5 — todavía no se confirmó el 2do modal: sendCampaign NO debe haberse llamado.
    expect(sendCampaign).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /sí, enviar/i }));

    await waitFor(() => expect(sendCampaign).toHaveBeenCalledWith('camp-1'));
    // LOW-5 — un solo click en el 2do modal = una sola llamada, ni cero ni duplicada.
    expect(sendCampaign).toHaveBeenCalledTimes(1);
  });
});

describe('BMP-8: cambio de campaña resetea el estado local del detalle (FIX-4)', () => {
  it('al pasar de camp-1 a camp-2, RecipientsTable arranca sin el filtro de estado de camp-1', async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/admin/whatsapp/bulk?campaign=camp-1']}>
          <CampaignSwitcher />
          <BulkMessagingPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // detalle de camp-1 visible
    await screen.findByRole('button', { name: /volver al historial/i });

    // el operador filtra por "Fallido" en la tabla de destinatarios de camp-1
    await user.selectOptions(await screen.findByLabelText(/filtrar por estado/i), 'failed');
    await waitFor(() =>
      expect(getCampaign).toHaveBeenCalledWith('camp-1', expect.objectContaining({ status: 'failed' })),
    );

    // cambia a camp-2 (mismo prop, sin pasar por "volver")
    await user.click(screen.getByRole('button', { name: 'switch-to-2' }));

    // camp-2 se pide con el filtro RESETEADO (nunca con status 'failed')
    await waitFor(() =>
      expect(getCampaign).toHaveBeenCalledWith('camp-2', expect.objectContaining({ includeRecipients: true })),
    );
    expect(getCampaign).not.toHaveBeenCalledWith('camp-2', expect.objectContaining({ status: 'failed' }));
  });
});

describe('BMP-10: tab-gating detiene el poll del historial/detalle oculto (Fix Wave MEDIUM-2)', () => {
  it('con mountMode="all", cambiar a "Nueva campaña" apaga el poll del CampaignDetail que queda montado detrás', async () => {
    vi.mocked(getCampaign).mockResolvedValue({
      campaign: CAMPAIGN_DTO, // status: 'pending' (30s de poll cuando active)
      recipients: { data: [], total: 0, page: 1, limit: 20 },
    });
    const user = userEvent.setup();
    renderPage(['/admin/whatsapp/bulk?campaign=camp-1']);

    // arranca en "Historial" (hay ?campaign=), CampaignDetail visible y activo
    await screen.findByRole('button', { name: /volver al historial/i });
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true');

    // el operador cambia a "Nueva campaña" — CampaignDetail sigue MONTADO
    // (mountMode="all") pero ya no es el tab activo
    await user.click(screen.getByRole('tab', { name: 'Nueva campaña' }));
    await waitFor(() => expect(getCampaign).toHaveBeenCalled());
    const callsAtTabSwitch = vi.mocked(getCampaign).mock.calls.length;

    vi.useFakeTimers({ shouldAdvanceTime: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    // sin el gate, "pending" pollea a los 30s — con el gate, cero llamadas nuevas
    expect(vi.mocked(getCampaign).mock.calls.length).toBe(callsAtTabSwitch);
  });
});
