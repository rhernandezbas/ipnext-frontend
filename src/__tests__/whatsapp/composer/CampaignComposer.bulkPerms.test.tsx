/**
 * CampaignComposer — permisos granulares del Bulk (bulk-granular-perms FE).
 * Mismos seams de mock que `CampaignComposer.test.tsx` (fetch-level para
 * messagingBulk.api / catálogos de red; hook-level para permisos y clientes).
 *
 *  BP-1 el tab "Números" aparece en la card Destinatarios
 *  BP-2 sin `messaging.bulk_numbers` → el textarea del tab Números queda
 *       deshabilitado (candado + aviso)
 *  BP-3 con permiso, los números pegados viajan en `manualContacts` del
 *       payload de create, CONCATENADOS con los del CSV (el BE dedup por tel)
 *  BP-4 403 BULK_RECIPIENTS_NOT_PERMITTED con `forbidden` → muestra la lista
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

import { listBulkTemplates, previewSegment, createCampaign, listSegmentRecipients, listExcludedRecipients, listChatwootLabels } from '@/api/messagingBulk.api';
import { getNetworkSites } from '@/api/networkSite.api';
import { listAssignableAccessPoints } from '@/api/accessPoints.api';
import { useClientList } from '@/hooks/useCustomers';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { CampaignComposer } from '@/pages/whatsapp/BulkMessagingPage/components/composer/CampaignComposer';
import type { PreviewSegmentOutput, SegmentRecipientsOutput, TemplateSummaryDto } from '@/types/messagingBulk';

const TEMPLATE: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: ['1', '2'],
  approvalStatus: 'approved',
  sendable: true,
  body: 'Hola {{1}}, tu saldo de ${{2}} vence pronto.',
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

const CLIENTS = [
  { id: 'c-1', name: 'Juan García', email: 'juan@test.com', phone: '+5491111111111', status: 'active', balance: 0, category: '', tariffPlan: null, login: null, ipRanges: null, accessDevices: 0, createdAt: '' },
];

/** Permisos a partir de la lista concedida (`['*']` = super_admin). */
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

async function selectTemplateAndMapVariables() {
  const user = userEvent.setup({ delay: null });
  await user.click(screen.getByRole('combobox', { name: /template/i }));
  await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
  await user.click(screen.getByRole('combobox', { name: '{{1}}' }));
  await user.click(screen.getByRole('option', { name: /nombre del cliente/i }));
  await user.click(screen.getByRole('combobox', { name: '{{2}}' }));
  await user.click(screen.getByRole('option', { name: /monto de deuda/i }));
}

function uploadCsv(csv: string, fileName = 'destinatarios.csv') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([csv], fileName, { type: 'text/csv' });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms(['*']);
  vi.mocked(listBulkTemplates).mockResolvedValue([TEMPLATE]);
  vi.mocked(previewSegment).mockResolvedValue(PREVIEW);
  vi.mocked(createCampaign).mockResolvedValue({ campaignId: 'camp-1', total: 42, status: 'pending' });
  vi.mocked(listSegmentRecipients).mockResolvedValue(EMPTY_RECIPIENTS);
  vi.mocked(listExcludedRecipients).mockResolvedValue({ ...EMPTY_RECIPIENTS, data: [] });
  vi.mocked(listChatwootLabels).mockResolvedValue([]);
  vi.mocked(getNetworkSites).mockResolvedValue([]);
  vi.mocked(listAssignableAccessPoints).mockResolvedValue([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retorno mínimo de useClientList
  vi.mocked(useClientList).mockReturnValue({ data: { data: CLIENTS, total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false } as any);
});

describe('BP-1: el tab "Números" aparece', () => {
  it('la card Destinatarios ofrece un tab Números', async () => {
    renderComposer();
    expect(await screen.findByRole('tab', { name: /números/i })).toBeInTheDocument();
  });
});

describe('BP-2: gate del tab Números', () => {
  it('sin messaging.bulk_numbers, el textarea de números queda deshabilitado', async () => {
    // Todo MENOS bulk_numbers.
    mockPerms(['messaging.templates', 'messaging.bulk_active', 'messaging.bulk_late']);
    renderComposer();

    fireEvent.click(await screen.findByRole('tab', { name: /números/i }));
    expect(screen.getByRole('textbox', { name: /números/i })).toBeDisabled();
  });

  it('con messaging.bulk_numbers, el textarea queda habilitado', async () => {
    mockPerms(['messaging.templates', 'messaging.bulk_numbers']);
    renderComposer();

    fireEvent.click(await screen.findByRole('tab', { name: /números/i }));
    expect(screen.getByRole('textbox', { name: /números/i })).toBeEnabled();
  });
});

describe('BP-3: los números pegados viajan en manualContacts (junto con el CSV)', () => {
  it('concatena números + CSV en el mismo array manualContacts del payload de create', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();

    // Pegar números en el tab Números.
    fireEvent.click(screen.getByRole('tab', { name: /números/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /números/i }), {
      target: { value: '1123456789\n1198765432, Bob' },
    });

    // También cargar un CSV.
    fireEvent.click(screen.getByRole('tab', { name: /csv/i }));
    uploadCsv('nombre;telefono\nAna;1100000000');

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Campaña números');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);
    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    await user.click(within(dialog).getByRole('button', { name: /confirmar y crear/i }));

    await waitFor(() =>
      expect(createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          manualContacts: [
            { name: 'Ana', phone: '1100000000' },
            { name: '1123456789', phone: '1123456789' },
            { name: 'Bob', phone: '1198765432' },
          ],
        }),
      ),
    );
  });
});

describe('BP-4: 403 BULK_RECIPIENTS_NOT_PERMITTED', () => {
  /** Arma un axios-like 403 con el body del contrato (forbidden variable para F2/F3). */
  function make403(forbidden: unknown, error = 'sin permiso') {
    return Object.assign(new Error('403'), {
      isAxiosError: true,
      response: { status: 403, data: { error, code: 'BULK_RECIPIENTS_NOT_PERMITTED', forbidden } },
    });
  }

  /** Llena una campaña válida (segmento 'late') y confirma la creación. */
  async function createValidCampaign(user: ReturnType<typeof userEvent.setup>) {
    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Campaña');
    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);
    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    await user.click(within(dialog).getByRole('button', { name: /confirmar y crear/i }));
  }

  it('muestra la lista de destinatarios prohibidos que devuelve el BE', async () => {
    vi.mocked(createCampaign).mockRejectedValue(make403(['bloqueado', 'números']));
    const user = userEvent.setup();
    renderComposer();

    await createValidCampaign(user);

    expect(await screen.findByText(/no tenés permiso para enviar a: bloqueado, números/i)).toBeInTheDocument();
  });

  // F2 (review adversarial) — 403 con `forbidden` vacío: no dejar un
  // "No tenés permiso para enviar a: " colgado; mostrar el `error` del body.
  it('F2: forbidden vacío → muestra el message del BE (no un prefijo colgado)', async () => {
    vi.mocked(createCampaign).mockRejectedValue(make403([], 'No podés enviar a esos destinatarios'));
    const user = userEvent.setup();
    renderComposer();

    await createValidCampaign(user);

    expect(await screen.findByText('No podés enviar a esos destinatarios')).toBeInTheDocument();
    expect(screen.queryByText(/enviar a:\s*$/)).not.toBeInTheDocument();
  });

  // F3 (review adversarial) — `forbidden` NO-array (BE viejo / body inesperado):
  // el render no debe crashear por `.join`; cae al message.
  it('F3: forbidden no-array → no crashea, muestra el message', async () => {
    vi.mocked(createCampaign).mockRejectedValue(make403('oops-no-es-array', 'Sin permiso para el envío'));
    const user = userEvent.setup();
    renderComposer();

    await createValidCampaign(user);

    expect(await screen.findByText('Sin permiso para el envío')).toBeInTheDocument();
  });
});

describe('BP-5: F1 — el modal de confirmación desglosa los números sueltos', () => {
  it('con números cargados, el checkpoint muestra "incluye hasta N números sueltos"', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();

    fireEvent.click(screen.getByRole('tab', { name: /números/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /números/i }), {
      target: { value: '1123456789\n1198765432, Bob' },
    });

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Campaña números');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);

    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    expect(within(dialog).getByText(/incluye hasta 2 números sueltos/i)).toBeInTheDocument();
  });
});

describe('BP-6: F4 — sin permiso los números NO viajan en el payload', () => {
  it('si se revoca bulk_numbers tras tipear, el create NO incluye esos números', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();

    // Segmento válido (para que canCreate se sostenga tras revocar bulk_numbers).
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));

    // Números tipeados CON permiso.
    fireEvent.click(screen.getByRole('tab', { name: /números/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /números/i }), {
      target: { value: '1123456789' },
    });
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());

    // Se REVOCA bulk_numbers (permiso perdido). Sigue con templates + bulk_late
    // (el estado 'late' no se stripea; la campaña sigue siendo creable).
    mockPerms(['messaging.templates', 'messaging.bulk_late']);

    // Un re-render (tipear el nombre) hace que el composer re-lea el permiso.
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Campaña');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);
    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    await user.click(within(dialog).getByRole('button', { name: /confirmar y crear/i }));

    await waitFor(() => expect(createCampaign).toHaveBeenCalled());
    const payload = vi.mocked(createCampaign).mock.calls[0][0];
    // Los números NO viajan (scrubeados por falta de permiso).
    expect(payload).not.toHaveProperty('manualContacts');
  });
});
