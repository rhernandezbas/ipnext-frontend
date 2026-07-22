/**
 * CampaignComposer — integración de la etiqueta de Chatwoot (campaign-chatwoot-label,
 * design D6). Mismos seams de mock que `CampaignComposer.bulkPerms.test.tsx`
 * (permisos por lista concedida, fetch-level para messagingBulk.api/red).
 *
 *  CHW-C1 sin elegir etiqueta, el payload de createCampaign NO incluye `chatwootLabel`
 *  CHW-C2 elegir una etiqueta existente la incluye en el payload de create
 *  CHW-C3 el modal de confirmación muestra la etiqueta elegida
 *  CHW-C4 "Crear label…" abre el mini-modal; crear una OK la auto-selecciona
 *         (queda elegida en el Select Y viaja en el payload de create)
 *  CHW-C5 gate de permiso: sin messaging.manage, el CTA "Crear label…" no
 *         aparece pero el Select sigue disponible (hereda messaging.templates)
 *  CHW-C6 400/503 al crear una etiqueta se muestra en el mini-modal (que
 *         sigue abierto) sin tocar el resto del composer
 *
 * Fix wave (review adversarial, post-apply):
 *  CHW-C7 [F2 LOW-A11Y] crear la PRIMERA etiqueta desde catálogo VACÍO (el
 *         trigger de la rama emptyState se desmonta) no deja el foco en body
 *  CHW-C8 [F4 LOW] si el refetch del catálogo falla justo después de crear,
 *         el label elegido se ve en la rama error + "Quitar" lo limpia del
 *         estado Y del payload de create
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/messagingBulk.api', () => ({
  listBulkTemplates: vi.fn(),
  previewSegment: vi.fn(),
  createCampaign: vi.fn(),
  sendCampaign: vi.fn(),
  getCampaign: vi.fn(),
  listCampaigns: vi.fn(),
  listSegmentRecipients: vi.fn(),
  listExcludedRecipients: vi.fn(),
  listChatwootLabels: vi.fn(),
  createChatwootLabel: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useCustomers', () => ({ useClientList: vi.fn() }));
vi.mock('@/api/networkSite.api', () => ({ getNetworkSites: vi.fn() }));
vi.mock('@/api/accessPoints.api', () => ({ listAssignableAccessPoints: vi.fn() }));

import {
  listBulkTemplates,
  previewSegment,
  createCampaign,
  listSegmentRecipients,
  listExcludedRecipients,
  listChatwootLabels,
  createChatwootLabel,
} from '@/api/messagingBulk.api';
import { getNetworkSites } from '@/api/networkSite.api';
import { listAssignableAccessPoints } from '@/api/accessPoints.api';
import { useClientList } from '@/hooks/useCustomers';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { CampaignComposer } from '@/pages/whatsapp/BulkMessagingPage/components/composer/CampaignComposer';
import type { ChatwootLabelDto, PreviewSegmentOutput, SegmentRecipientsOutput, TemplateSummaryDto } from '@/types/messagingBulk';

const TEMPLATE: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: [],
  approvalStatus: 'approved',
  sendable: true,
  body: 'Hola, tu saldo vence pronto.',
};

const PREVIEW: PreviewSegmentOutput = {
  count: 42,
  sample: [{ clientId: 'cli-1', name: 'Juan Perez', phoneE164: '+5491100000000', status: 'late' }],
  skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
  statusCounts: { late: 42 },
};

const EMPTY_RECIPIENTS: SegmentRecipientsOutput = {
  data: [],
  total: 0,
  page: 1,
  limit: 20,
  skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
  statusCounts: {},
};

const COBRANZAS: ChatwootLabelDto = { title: 'cobranzas', color: '#e63946' };

/** Permisos a partir de la lista concedida (`['*']` = super_admin) — molde `CampaignComposer.bulkPerms.test.tsx`. */
function mockPerms(granted: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: granted,
    isLoading: false,
    isError: false,
    can: (permission: string | string[]) => {
      if (granted.includes('*')) return true;
      const perms = Array.isArray(permission) ? permission : [permission];
      return perms.some((p) => granted.includes(p));
    },
  } as UseMyPermissionsResult);
}

function renderComposer(onCampaignCreated = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...render(<CampaignComposer onCampaignCreated={onCampaignCreated} />, { wrapper }), onCampaignCreated };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms(['*']);
  vi.mocked(listBulkTemplates).mockResolvedValue([TEMPLATE]);
  vi.mocked(previewSegment).mockResolvedValue(PREVIEW);
  vi.mocked(createCampaign).mockResolvedValue({ campaignId: 'camp-1', total: 42, status: 'pending' });
  vi.mocked(listSegmentRecipients).mockResolvedValue(EMPTY_RECIPIENTS);
  vi.mocked(listExcludedRecipients).mockResolvedValue({ ...EMPTY_RECIPIENTS, data: [] });
  vi.mocked(listChatwootLabels).mockResolvedValue([COBRANZAS]);
  vi.mocked(getNetworkSites).mockResolvedValue([]);
  vi.mocked(listAssignableAccessPoints).mockResolvedValue([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retorno mínimo de useClientList
  vi.mocked(useClientList).mockReturnValue({ data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false } as any);
});

/** Llena una campaña válida (template sin variables + segmento 'late') hasta habilitar "Crear campaña". */
async function fillValidCampaign(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
  await user.click(screen.getByRole('combobox', { name: /template/i }));
  await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
  await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
  await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
  await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Campaña con label');
  const createButton = screen.getByRole('button', { name: /crear campaña/i });
  await waitFor(() => expect(createButton).toBeEnabled());
  return createButton;
}

async function confirmCreate(user: ReturnType<typeof userEvent.setup>, createButton: HTMLElement) {
  await user.click(createButton);
  const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
  await user.click(within(dialog).getByRole('button', { name: /confirmar y crear/i }));
}

describe('CHW-C1: sin elegir etiqueta', () => {
  it('el payload de createCampaign NO incluye chatwootLabel', async () => {
    const user = userEvent.setup();
    renderComposer();

    const createButton = await fillValidCampaign(user);
    await confirmCreate(user, createButton);

    await waitFor(() => expect(createCampaign).toHaveBeenCalled());
    const payload = vi.mocked(createCampaign).mock.calls[0][0];
    expect(payload).not.toHaveProperty('chatwootLabel');
  });
});

describe('CHW-C2: elegir una etiqueta existente', () => {
  it('el payload de createCampaign incluye chatwootLabel con el title elegido', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(await screen.findByRole('combobox', { name: /etiqueta de chatwoot/i }));
    await user.click(screen.getByRole('option', { name: 'cobranzas' }));

    const createButton = await fillValidCampaign(user);
    await confirmCreate(user, createButton);

    await waitFor(() =>
      expect(createCampaign).toHaveBeenCalledWith(expect.objectContaining({ chatwootLabel: 'cobranzas' })),
    );
  });
});

describe('CHW-C3: resumen del confirm modal', () => {
  it('muestra la etiqueta elegida en el checkpoint', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(await screen.findByRole('combobox', { name: /etiqueta de chatwoot/i }));
    await user.click(screen.getByRole('option', { name: 'cobranzas' }));

    const createButton = await fillValidCampaign(user);
    await user.click(createButton);

    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    expect(within(dialog).getByText('cobranzas')).toBeInTheDocument();
  });
});

describe('CHW-C4: crear una etiqueta nueva la auto-selecciona', () => {
  it('"Crear label…" abre el mini-modal; al crear OK, queda elegida y viaja en el create', async () => {
    vi.mocked(createChatwootLabel).mockResolvedValue({ title: 'promo-julio', color: '#1f93ff' });
    // El catálogo real crecería tras el POST — la invalidación de
    // `useCreateChatwootLabel` dispara un refetch; el mock simula esa
    // segunda respuesta YA con la etiqueta recién creada (el fetch inicial
    // del mount sigue devolviendo solo COBRANZAS).
    vi.mocked(listChatwootLabels)
      .mockResolvedValueOnce([COBRANZAS])
      .mockResolvedValue([COBRANZAS, { title: 'promo-julio', color: '#1f93ff' }]);
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /crear label/i }));

    const modal = await screen.findByRole('dialog', { name: /crear label de chatwoot/i });
    await user.type(within(modal).getByLabelText(/nombre/i), 'Promo Julio');
    await user.click(within(modal).getByRole('button', { name: /^crear$/i }));

    await waitFor(() => expect(createChatwootLabel).toHaveBeenCalledWith({ title: 'promo-julio', color: '#1f93ff' }));
    // El modal se cierra y el label recién creado queda elegido en el Select.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /crear label de chatwoot/i })).not.toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: /etiqueta de chatwoot/i })).toHaveTextContent('promo-julio');

    const createButton = await fillValidCampaign(user);
    await confirmCreate(user, createButton);

    await waitFor(() =>
      expect(createCampaign).toHaveBeenCalledWith(expect.objectContaining({ chatwootLabel: 'promo-julio' })),
    );
  });
});

describe('CHW-C5: gate de permiso messaging.manage', () => {
  it('sin messaging.manage, el CTA "Crear label…" no aparece pero el Select sigue disponible', async () => {
    mockPerms(['messaging.templates', 'messaging.bulk_active', 'messaging.bulk_late']);
    renderComposer();

    expect(await screen.findByRole('combobox', { name: /etiqueta de chatwoot/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear label/i })).not.toBeInTheDocument();
  });
});

describe('CHW-C6: error al crear una etiqueta', () => {
  it('400/503 se muestra en el mini-modal, que sigue abierto', async () => {
    vi.mocked(createChatwootLabel).mockRejectedValue(
      Object.assign(new Error('503'), {
        isAxiosError: true,
        response: { status: 503, data: { error: 'Chatwoot no disponible', code: 'CHATWOOT_UNAVAILABLE' } },
      }),
    );
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /crear label/i }));

    const modal = await screen.findByRole('dialog', { name: /crear label de chatwoot/i });
    await user.type(within(modal).getByLabelText(/nombre/i), 'Cobranzas');
    await user.click(within(modal).getByRole('button', { name: /^crear$/i }));

    expect(await within(modal).findByText(/ya existe o chatwoot no está disponible/i)).toBeInTheDocument();
    // El modal sigue abierto (no se cerró por el error) y el Select del composer no cambió.
    expect(screen.getByRole('dialog', { name: /crear label de chatwoot/i })).toBeInTheDocument();
  });
});

// ─── Fix wave (review adversarial) ───────────────────────────────────────────

describe('CHW-C7 (F2 fix-wave, LOW-A11Y): foco al crear la PRIMERA etiqueta', () => {
  it('desde catálogo vacío, crear la primera etiqueta (el trigger emptyState se desmonta) — el foco queda en el fallback (root del selector), NO en body', async () => {
    // Catálogo VACÍO al montar (rama emptyState, dueña del trigger) → tras
    // crear, la rama pasa a `success` y el botón original queda desmontado.
    vi.mocked(listChatwootLabels)
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ title: 'promo-julio', color: '#1f93ff' }]);
    vi.mocked(createChatwootLabel).mockResolvedValue({ title: 'promo-julio', color: '#1f93ff' });
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    expect(await screen.findByText(/no hay etiquetas de chatwoot/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /crear label/i }));
    const modal = await screen.findByRole('dialog', { name: /crear label de chatwoot/i });
    await user.type(within(modal).getByLabelText(/nombre/i), 'Promo Julio');
    await user.click(within(modal).getByRole('button', { name: /^crear$/i }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /crear label de chatwoot/i })).not.toBeInTheDocument(),
    );
    // Assertion ENDURECIDA (re-review): no alcanza con "body no lo tiene" —
    // hay que probar EXPLÍCITAMENTE que el fallback (root del
    // `ChatwootLabelSelector`, `data-testid="chatwoot-label-section"`) es
    // quien tiene el foco.
    await waitFor(() => expect(screen.getByTestId('chatwoot-label-section')).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it('F2-bis (re-review empírica): con latencia REAL en el refetch (setTimeout >=100ms) tras crear, el foco SIGUE cayendo en el fallback, no en body', async () => {
    // Probe del revisor: el bug real NO es que "el trigger ya esté
    // desmontado cuando el modal cierra" (eso sería demasiado rápido para
    // pasar) — es que el refetch disparado por `invalidateQueries` es
    // ASÍNCRONO con latencia de red REAL (~100ms+), mientras el cleanup del
    // modal corre ~16ms después de cerrar. Con el código viejo: al momento
    // del cleanup, `labels` todavía está vacío (el refetch no resolvió) →
    // `emptyState` SIGUE montado → `isConnected` da `true` → el fallback NO
    // se usa, se foca el trigger viejo → ~100ms después el refetch resuelve,
    // el catálogo pasa a tener 1 label, la rama cambia a `success`, el
    // trigger (que TENÍA el foco) se desmonta → el foco cae a `body` sin que
    // nada lo repare. El fix real vive en `useCreateChatwootLabel`
    // (`setQueryData` SÍNCRONO antes del invalidate) — el modal/selector NO
    // se tocan para esto.
    vi.mocked(listChatwootLabels)
      .mockResolvedValueOnce([]) // fetch inicial (mount) — catálogo vacío
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([{ title: 'promo-julio', color: '#1f93ff' }]), 120);
          }),
      ); // refetch disparado por invalidateQueries — latencia de red REAL
    vi.mocked(createChatwootLabel).mockResolvedValue({ title: 'promo-julio', color: '#1f93ff' });
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    expect(await screen.findByText(/no hay etiquetas de chatwoot/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /crear label/i }));
    const modal = await screen.findByRole('dialog', { name: /crear label de chatwoot/i });
    await user.type(within(modal).getByLabelText(/nombre/i), 'Promo Julio');
    await user.click(within(modal).getByRole('button', { name: /^crear$/i }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /crear label de chatwoot/i })).not.toBeInTheDocument(),
    );

    // Esperar a que el refetch DEMORADO resuelva y el catálogo pase a tener 1
    // label (recién ACÁ el trigger de emptyState se desmonta de verdad, ~120ms
    // después de cerrado el modal — no antes).
    await waitFor(
      () => expect(screen.getByRole('combobox', { name: /etiqueta de chatwoot/i })).toBeInTheDocument(),
      { timeout: 2000 },
    );

    // El foco DEBE seguir en el fallback estable, sin importar CUÁNDO (antes
    // o después del cierre del modal) se haya desmontado el trigger real.
    await waitFor(() => expect(screen.getByTestId('chatwoot-label-section')).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });
});

describe('CHW-C8 (F4 fix-wave, LOW): refetch del catálogo falla post-create', () => {
  it('el label elegido se ve en la rama error y "Quitar" lo limpia del estado y del payload', async () => {
    vi.mocked(listChatwootLabels)
      .mockResolvedValueOnce([COBRANZAS]) // mount
      .mockRejectedValue(new Error('network')); // refetch post-invalidate (tras crear)
    vi.mocked(createChatwootLabel).mockResolvedValue({ title: 'promo-julio', color: '#1f93ff' });
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /crear label/i }));
    const modal = await screen.findByRole('dialog', { name: /crear label de chatwoot/i });
    await user.type(within(modal).getByLabelText(/nombre/i), 'Promo Julio');
    await user.click(within(modal).getByRole('button', { name: /^crear$/i }));

    // El catálogo cae en error (refetch post-create falló), pero el label
    // recién creado sigue visible — nunca invisible mientras viaja en el payload.
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
    expect(screen.getByText('promo-julio')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /quitar/i }));

    const createButton = await fillValidCampaign(user);
    await confirmCreate(user, createButton);

    await waitFor(() => expect(createCampaign).toHaveBeenCalled());
    const payload = vi.mocked(createCampaign).mock.calls[0][0];
    expect(payload).not.toHaveProperty('chatwootLabel');
  });
});
