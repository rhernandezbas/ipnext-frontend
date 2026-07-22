/**
 * CampaignComposer — integración de la etiqueta de Chatwoot (campaign-chatwoot-label,
 * design D6). Mismos seams de mock que `CampaignComposer.bulkPerms.test.tsx`
 * (permisos por lista concedida, fetch-level para messagingBulk.api/red).
 *
 * chatwoot-label-config-fe — el CTA "Crear label…" (mini-modal incluido) SALIÓ
 * del composer: la creación del catálogo ahora vive en Configuración →
 * WhatsApp (`ChatwootLabelsCard`, ver su propio test). El composer conserva
 * SOLO la selección sobre el catálogo ya existente.
 *
 *  CHW-C1 sin elegir etiqueta, el payload de createCampaign NO incluye `chatwootLabel`
 *  CHW-C2 elegir una etiqueta existente la incluye en el payload de create
 *  CHW-C3 el modal de confirmación muestra la etiqueta elegida
 *  CHW-C4 el composer NO ofrece ningún CTA de creación de etiquetas, con o
 *         sin `messaging.manage` (se mudó a Configuración → WhatsApp)
 *
 * El escenario F4 (LOW, fix wave anterior — catálogo en error con un label
 * YA elegido, botón "Quitar") sigue cubierto a nivel unitario en
 * `ChatwootLabelSelector.test.tsx` (CWL-8). Acá NO se repite: el disparador
 * original era "el refetch post-create falla" — un escenario que dejó de
 * existir en el composer porque ya no crea etiquetas.
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
}));
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useCustomers', () => ({ useClientList: vi.fn() }));
vi.mock('@/api/networkSite.api', () => ({ getNetworkSites: vi.fn() }));
vi.mock('@/api/accessPoints.api', () => ({ listAssignableAccessPoints: vi.fn() }));
// bulk-task-recipients (D8) — mockeado a nivel hook (default: config vacía).
vi.mock('@/hooks/useTaskStageConfig', () => ({ useTaskStageConfig: vi.fn(), useUpdateTaskStageConfig: vi.fn() }));

import {
  listBulkTemplates,
  previewSegment,
  createCampaign,
  listSegmentRecipients,
  listExcludedRecipients,
  listChatwootLabels,
} from '@/api/messagingBulk.api';
import { useTaskStageConfig } from '@/hooks/useTaskStageConfig';
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
  // bulk-task-recipients (D8) — default neutro: config vacía.
  vi.mocked(useTaskStageConfig).mockReturnValue({
    data: { stages: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retorno mínimo de useTaskStageConfig
  } as any);
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

describe('CHW-C4: sin CTA de creación en el composer', () => {
  it('con messaging.manage, el composer NO ofrece ningún botón de creación de etiquetas', async () => {
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await screen.findByRole('combobox', { name: /etiqueta de chatwoot/i });
    expect(screen.queryByRole('button', { name: /crear (label|etiqueta)/i })).not.toBeInTheDocument();
    // Tampoco existe el mini-modal (se mudó, ya no lo monta el composer).
    expect(screen.queryByRole('dialog', { name: /crear label de chatwoot/i })).not.toBeInTheDocument();
  });

  it('sin messaging.manage, tampoco (el Select sigue disponible igual)', async () => {
    mockPerms(['messaging.templates', 'messaging.bulk_active', 'messaging.bulk_late']);
    renderComposer();

    expect(await screen.findByRole('combobox', { name: /etiqueta de chatwoot/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear (label|etiqueta)/i })).not.toBeInTheDocument();
  });
});
