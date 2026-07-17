/**
 * CampaignComposer — container-fino del tab "Nueva campaña" (F2 apply chunk
 * 2). Orquesta `useTemplates`/`usePreviewSegment`/`useCreateCampaign`
 * (hooks REALES, `@/api/messagingBulk.api` mockeada a nivel fetch — mismo
 * seam que `useBulkMessaging.test.ts`) + los 4 presentacionales del
 * composer. `useMyPermissions` se mockea directo (mismo patrón que
 * `WhatsappInboxPage.test.tsx`).
 *
 *  CC-1 sin permiso "messaging.templates" → NO fetchea templates, no se
 *       muestra el selector
 *  CC-2 elegir un template muestra sus variables (via TemplateSelector)
 *  CC-3 con variables sin mapear → "Crear campaña" deshabilitado
 *  CC-4 sin criterio de segmento → preview no se dispara, panel derecho
 *       muestra la nota, botón deshabilitado
 *  CC-5 tildar un estado dispara el preview automático tras el debounce (500ms)
 *  CC-6 preview count=0 → "Crear campaña" deshabilitado (EMPTY_SEGMENT guard)
 *  CC-7 todo completo → "Crear campaña" habilitado; click llama a
 *       createCampaign con el payload correcto, muestra el toast
 *       (role=alert) y llama a onCampaignCreated con el id
 *  CC-8 422 MISSING_TEMPLATE_VARIABLES → resalta la variable rechazada
 *  CC-9 botón "Ver preview" manual dispara sin esperar el debounce
 *  CC-24 M3 (review adversarial) — re-subir un CSV con el MISMO nombre y la
 *        MISMA cantidad de filas válidas pero contenido DISTINTO re-dispara
 *        el preview (el fingerprint ya no es lossy sobre `fileName:length`)
 */
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
}));
vi.mock('@/hooks/useMyPermissions');
// El composer ahora monta `ManualRecipientsPicker` → `CustomerPicker`, que usa
// `useClientList`. Se mockea a nivel hook (mismo seam que CustomerPicker.test).
vi.mock('@/hooks/useCustomers', () => ({ useClientList: vi.fn() }));
// node-segment-fe — el SegmentBuilder (y el composer, para los nombres del
// confirm modal) fetchean los catálogos de red. Mock a nivel fetch (mismo
// seam que messagingBulk.api); los escenarios de red viven en
// `CampaignComposer.networkSegment.test.tsx` — acá solo se neutralizan.
vi.mock('@/api/networkSite.api', () => ({ getNetworkSites: vi.fn() }));
vi.mock('@/api/accessPoints.api', () => ({ listAssignableAccessPoints: vi.fn() }));

import { listBulkTemplates, previewSegment, createCampaign, listSegmentRecipients, listExcludedRecipients } from '@/api/messagingBulk.api';
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

const ZERO_PREVIEW: PreviewSegmentOutput = {
  count: 0,
  sample: [],
  skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
  statusCounts: {},
};

/**
 * messaging-bulk-v11 FE apply chunk 2 — default del `PreviewModal` (query
 * PROPIA, `useSegmentRecipients`, independiente de `previewSegment`). Vacío a
 * propósito: estos tests NO verifican el contenido del modal (eso vive en
 * `PreviewModal.test.tsx`), sólo que "Ver preview" lo abre sin romper nada —
 * un total:0 evita CUALQUIER colisión de texto con las aserciones de acá
 * (p.ej. "42" del count de `SegmentPreviewPanel`, o "0 destinatarios" de
 * `ZERO_PREVIEW`, que el modal redacta distinto — "Sin destinatarios...").
 */
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
  { id: 'c-2', name: 'María López', email: 'maria@test.com', phone: '+5492222222222', status: 'active', balance: 0, category: '', tariffPlan: null, login: null, ipRanges: null, accessDevices: 0, createdAt: '' },
];

function mockPerms(granted: boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: granted ? ['messaging.templates'] : [],
    isLoading: false,
    isError: false,
    can: () => granted,
  } as UseMyPermissionsResult);
}

function renderComposer(onCampaignCreated = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...render(<CampaignComposer onCampaignCreated={onCampaignCreated} />, { wrapper }), onCampaignCreated, qc };
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

/**
 * Deja el composer en estado "válido para crear" y devuelve el botón "Crear
 * campaña" ya habilitado. A partir del #5 ese botón ABRE el modal de
 * confirmación — NO dispara `createCampaign` directo (eso lo hace el confirm
 * DENTRO del modal, ver `confirmCreate`).
 */
async function fillValidCampaign(user: ReturnType<typeof userEvent.setup>) {
  await selectTemplateAndMapVariables();
  await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
  // El count del gate `canCreate` sale del preview AUTOMÁTICO (debounce 500ms,
  // ver CC-5) — NO de abrir el PreviewModal. No lo abrimos acá a propósito: así
  // el ÚNICO diálogo en el DOM durante el flujo es el modal de confirmación #5.
  await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
  await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Recordatorio julio');
  const createButton = screen.getByRole('button', { name: /crear campaña/i });
  await waitFor(() => expect(createButton).toBeEnabled());
  return createButton;
}

/** Abre el modal de confirmación (#5) y clickea "Confirmar y crear" adentro. */
async function confirmCreate(user: ReturnType<typeof userEvent.setup>, createButton: HTMLElement) {
  await user.click(createButton);
  const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
  await user.click(within(dialog).getByRole('button', { name: /confirmar y crear/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms(true);
  vi.mocked(listBulkTemplates).mockResolvedValue([TEMPLATE]);
  vi.mocked(previewSegment).mockResolvedValue(PREVIEW);
  vi.mocked(createCampaign).mockResolvedValue({ campaignId: 'camp-1', total: 42, status: 'pending' });
  vi.mocked(listSegmentRecipients).mockResolvedValue(EMPTY_RECIPIENTS);
  vi.mocked(listExcludedRecipients).mockResolvedValue({ ...EMPTY_RECIPIENTS, data: [] });
  vi.mocked(getNetworkSites).mockResolvedValue([]);
  vi.mocked(listAssignableAccessPoints).mockResolvedValue([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retorno mínimo de useClientList
  vi.mocked(useClientList).mockReturnValue({ data: { data: CLIENTS, total: 2, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false } as any);
});

/**
 * Agrega un destinatario manual vía el typeahead del `ManualRecipientsPicker`.
 * Rediseño bulk-elegant — el picker vive en el tab "Manuales" de la card
 * Destinatarios: la interacción legítima activa el tab ANTES de tipear.
 */
async function addManualRecipient(user: ReturnType<typeof userEvent.setup>, name = 'Juan García') {
  await user.click(screen.getByRole('tab', { name: /manuales/i }));
  await user.type(screen.getByLabelText(/buscar cliente/i), 'a');
  await user.click(await screen.findByText(name));
}

/**
 * bulk-csv-recipients (CSV-FE-5) — carga un CSV vía el `CsvRecipientsUploader`
 * del composer. Rediseño bulk-elegant — el uploader vive en el tab "CSV": la
 * interacción legítima activa el tab ANTES de tocar el input de archivo.
 */
function uploadCsv(csv: string, fileName = 'destinatarios.csv') {
  fireEvent.click(screen.getByRole('tab', { name: /csv/i }));
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([csv], fileName, { type: 'text/csv' });
  fireEvent.change(input, { target: { files: [file] } });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('CC-1: gate de permiso messaging.templates', () => {
  it('sin el permiso, NO fetchea templates ni muestra el selector', async () => {
    mockPerms(false);
    renderComposer();

    await waitFor(() => expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeInTheDocument());
    expect(listBulkTemplates).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: /template/i })).not.toBeInTheDocument();
  });
});

describe('CC-2: elegir un template', () => {
  it('muestra sus variables en VariablesMapForm', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));

    expect(screen.getByRole('combobox', { name: '{{1}}' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '{{2}}' })).toBeInTheDocument();
  });
});

describe('CC-3: variables sin mapear', () => {
  it('"Crear campaña" queda deshabilitado', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));

    expect(screen.getByRole('button', { name: /crear campaña/i })).toBeDisabled();
  });
});

describe('CC-4: sin criterio de segmento', () => {
  it('el panel de preview muestra la nota y el botón "Ver preview" está deshabilitado', async () => {
    renderComposer();
    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());

    expect(screen.getByText(/elegí al menos un criterio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver preview/i })).toBeDisabled();
    expect(previewSegment).not.toHaveBeenCalled();
  });
});

describe('CC-5: preview automático con debounce', () => {
  it('tildar un estado dispara previewSegment recién a los 500ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderComposer();
    await vi.waitFor(() => expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    expect(previewSegment).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(previewSegment).toHaveBeenCalledWith({ statuses: ['late'] });
  });
});

describe('CC-6: preview con count=0', () => {
  it('deshabilita "Crear campaña" (guard EMPTY_SEGMENT)', async () => {
    vi.mocked(previewSegment).mockResolvedValue(ZERO_PREVIEW);
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    await user.click(screen.getByRole('button', { name: /ver preview/i }));

    await waitFor(() => expect(screen.getByText(/0 destinatarios/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /crear campaña/i })).toBeDisabled();
  });
});

describe('CC-7: flujo completo de creación (vía modal de confirmación #5)', () => {
  it('con todo completo, "Crear campaña" abre el modal; confirmar crea la campaña, muestra el toast, navega y cierra el modal', async () => {
    const user = userEvent.setup();
    const onCampaignCreated = vi.fn();
    renderComposer(onCampaignCreated);

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    const createButton = await fillValidCampaign(user);

    // El click de "Crear campaña" abre el modal — todavía NO crea nada.
    await user.click(createButton);
    expect(createCampaign).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });

    // Confirmar DENTRO del modal dispara la creación real.
    await user.click(within(dialog).getByRole('button', { name: /confirmar y crear/i }));

    await waitFor(() => expect(createCampaign).toHaveBeenCalledWith({
      name: 'Recordatorio julio',
      templateRef: 'HX123',
      templateName: 'Recordatorio de pago',
      segment: { statuses: ['late'] },
      variablesMap: { '1': { source: 'name', value: undefined }, '2': { source: 'balanceDue', value: undefined } },
    }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/recordatorio julio/i);
    expect(onCampaignCreated).toHaveBeenCalledWith('camp-1');
    // Al crear OK, el modal se cierra.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('CC-8: 422 MISSING_TEMPLATE_VARIABLES', () => {
  it('resalta la variable rechazada por el servidor', async () => {
    const axiosError = Object.assign(new Error('422'), {
      isAxiosError: true,
      response: {
        status: 422,
        data: { error: 'Faltan variables', code: 'MISSING_TEMPLATE_VARIABLES', missing: ['2'] },
      },
    });
    vi.mocked(createCampaign).mockRejectedValue(axiosError);
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    const createButton = await fillValidCampaign(user);
    await confirmCreate(user, createButton);

    await waitFor(() => expect(screen.getByText(/falta mapear/i)).toBeInTheDocument());
  });
});

describe('CC-9: botón "Ver preview" abre el PreviewModal (messaging-bulk-v11 FE apply chunk 2)', () => {
  it('abre el modal completo, que dispara SU PROPIA query de destinatarios paginados', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    await user.click(screen.getByRole('button', { name: /ver preview/i }));

    expect(screen.getByRole('dialog', { name: /preview del envío/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(listSegmentRecipients).toHaveBeenCalledWith({ statuses: ['late'], page: 1, limit: 20 }),
    );
    // El indicador liviano de `SegmentPreviewPanel` sigue viniendo del debounce
    // automático (`previewSegment`), NO de este click — ver CC-5.
    await waitFor(() => expect(previewSegment).toHaveBeenCalledWith({ statuses: ['late'] }));
  });
});

describe('CC-10: error de creación que NO es 422-MISSING (FIX-3b)', () => {
  it('surface un error de servidor (EMPTY_SEGMENT/etc.) con role=alert — el botón no queda "sin hacer nada"', async () => {
    const axiosError = Object.assign(new Error('400'), {
      isAxiosError: true,
      response: { status: 400, data: { error: 'segmento vacío', code: 'EMPTY_SEGMENT' } },
    });
    vi.mocked(createCampaign).mockRejectedValue(axiosError);
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    const createButton = await fillValidCampaign(user);
    await confirmCreate(user, createButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/segmento|no se pudo crear/i);
  });
});

describe('CC-11: preview stale invalida la creación (FIX-5)', () => {
  it('editar el segmento (aunque siga válido) invalida el preview previo → "Crear campaña" se re-bloquea', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    await user.click(screen.getByRole('button', { name: /ver preview/i }));
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Recordatorio julio');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());

    // El operador cambia el segmento: el count de 42 ya no corresponde al
    // segmento actual — no se puede crear con ese número viejo.
    await user.click(screen.getByRole('checkbox', { name: /bloqueado/i }));

    expect(createButton).toBeDisabled();
  });
});

describe('CC-12: hint del primer paso sin template (FIX-8a)', () => {
  it('sin template elegido, guía al operador a elegir uno', async () => {
    renderComposer();
    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());

    expect(screen.getByText(/elegí un template/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear campaña/i })).toBeDisabled();
  });
});

describe('CC-13: "Crear campaña" abre el modal de confirmación con el resumen (#5)', () => {
  it('abre el modal con nombre + template + total + desglose, SIN disparar createCampaign', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    const createButton = await fillValidCampaign(user);
    await user.click(createButton);

    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    expect(createCampaign).not.toHaveBeenCalled();

    // Resumen de impacto (todo desde previewData, ya en memoria — sin fetch).
    expect(within(dialog).getByText('Recordatorio julio')).toBeInTheDocument();
    expect(within(dialog).getByText('Recordatorio de pago')).toBeInTheDocument();
    // total (42) y statusCount late (42) — ambos "42"; basta con que aparezca.
    expect(within(dialog).getAllByText('42').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('Atrasado')).toBeInTheDocument();
  });
});

describe('CC-14: cancelar el modal no crea nada y preserva el estado (#5)', () => {
  it('Cancelar cierra el modal, NO llama createCampaign y el nombre queda intacto', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    const createButton = await fillValidCampaign(user);
    await user.click(createButton);

    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    await user.click(within(dialog).getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(createCampaign).not.toHaveBeenCalled();
    // El estado del composer sigue intacto (el nombre NO se limpió).
    expect(screen.getByLabelText(/nombre de la campaña/i)).toHaveValue('Recordatorio julio');
  });
});

describe('CC-15: Esc en el modal no crea nada (#5)', () => {
  it('Esc cierra el modal sin llamar createCampaign', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    const createButton = await fillValidCampaign(user);
    await user.click(createButton);
    await screen.findByRole('dialog', { name: /nueva campaña/i });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(createCampaign).not.toHaveBeenCalled();
  });
});

describe('CC-16: el modal cierra al confirmar aunque createCampaign cuelgue (fix wave 2 — anti-trap)', () => {
  it('con createCampaign colgado (server acepta pero nunca responde), confirmar CIERRA el modal — la página no queda atrapada', async () => {
    // El axios client NO tiene timeout global: si el server nunca responde,
    // `isCreating` quedaría true para siempre. El modal NO debe vivir durante
    // la creación: cierra AL confirmar, antes de disparar el create.
    vi.mocked(createCampaign).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    const createButton = await fillValidCampaign(user);
    await user.click(createButton);
    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    await user.click(within(dialog).getByRole('button', { name: /confirmar y crear/i }));

    // El modal se cerró (no queda incerrable) y la creación igual se disparó.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(createCampaign).toHaveBeenCalled();
  });
});

describe('CC-17: preview se dispara al agregar un destinatario manual (COMP-1)', () => {
  it('con el segmento vacío, agregar un manual dispara previewSegment con manualClientIds', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    // Sin criterio de segmento ni lista manual, el preview NO se dispara.
    expect(previewSegment).not.toHaveBeenCalled();

    await addManualRecipient(user);

    await waitFor(() =>
      expect(previewSegment).toHaveBeenCalledWith({ statuses: [], manualClientIds: ['c-1'] }),
    );
  });
});

describe('CC-18: crear con SÓLO lista manual (COMP-1)', () => {
  it('canCreate con sólo manual; el body de create incluye manualClientIds y segment vacío', async () => {
    const user = userEvent.setup();
    const onCampaignCreated = vi.fn();
    renderComposer(onCampaignCreated);

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();
    await addManualRecipient(user);

    // El preview automático (count 42) habilita el gate — sin tildar ningún estado.
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Recordatorio julio');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());

    await user.click(createButton);
    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    await user.click(within(dialog).getByRole('button', { name: /confirmar y crear/i }));

    await waitFor(() =>
      expect(createCampaign).toHaveBeenCalledWith({
        name: 'Recordatorio julio',
        templateRef: 'HX123',
        templateName: 'Recordatorio de pago',
        segment: { statuses: [] },
        variablesMap: { '1': { source: 'name', value: undefined }, '2': { source: 'balanceDue', value: undefined } },
        manualClientIds: ['c-1'],
      }),
    );
    expect(onCampaignCreated).toHaveBeenCalledWith('camp-1');
  });
});

describe('CC-19: el modal de confirmación refleja los destinatarios manuales (CONF-1)', () => {
  it('muestra cuántos fueron agregados manualmente', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();
    await addManualRecipient(user);
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Recordatorio julio');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);

    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    expect(within(dialog).getByText(/1.*manual/i)).toBeInTheDocument();
  });
});

describe('CC-20: preview se dispara al cargar un CSV válido (bulk-csv-recipients CSV-FE-5)', () => {
  it('con el segmento vacío, cargar un CSV dispara previewSegment con manualContacts', async () => {
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    expect(previewSegment).not.toHaveBeenCalled();

    uploadCsv('nombre;telefono\nAna;1123456789');

    await waitFor(() =>
      expect(previewSegment).toHaveBeenCalledWith({
        statuses: [],
        manualContacts: [{ name: 'Ana', phone: '1123456789' }],
      }),
    );
  });
});

describe('CC-21: crear con SÓLO CSV (CSV-FE-5, scenario "solo-CSV habilita crear")', () => {
  it('canCreate con sólo CSV; el body de create incluye manualContacts y SIN manualClientIds', async () => {
    const user = userEvent.setup();
    const onCampaignCreated = vi.fn();
    renderComposer(onCampaignCreated);

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();
    uploadCsv('nombre;telefono\nAna;1123456789');

    // El preview automático (count 42) habilita el gate — sin segmento ni manuales.
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Recordatorio julio');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());

    await user.click(createButton);
    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    await user.click(within(dialog).getByRole('button', { name: /confirmar y crear/i }));

    await waitFor(() =>
      expect(createCampaign).toHaveBeenCalledWith({
        name: 'Recordatorio julio',
        templateRef: 'HX123',
        templateName: 'Recordatorio de pago',
        segment: { statuses: [] },
        variablesMap: { '1': { source: 'name', value: undefined }, '2': { source: 'balanceDue', value: undefined } },
        manualContacts: [{ name: 'Ana', phone: '1123456789' }],
      }),
    );
    expect(onCampaignCreated).toHaveBeenCalledWith('camp-1');
  });
});

describe('CC-22: sin CSV, no-regresión (CSV-FE-5, scenario "payload omitido cuando no hay CSV")', () => {
  it('el payload de create NO incluye la key manualContacts', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    const createButton = await fillValidCampaign(user);
    await confirmCreate(user, createButton);

    await waitFor(() => expect(createCampaign).toHaveBeenCalled());
    const payload = vi.mocked(createCampaign).mock.calls[0][0];
    expect(payload).not.toHaveProperty('manualContacts');
  });
});

describe('CC-23: resetea el CSV tras crear la campaña (CSV-FE-5.5)', () => {
  it('tras crear OK, el uploader vuelve a idle (sin resumen del archivo anterior)', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();
    uploadCsv('nombre;telefono\nAna;1123456789');
    await screen.findByText(/1 destinatario del archivo/i);
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Recordatorio julio');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);
    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    await user.click(within(dialog).getByRole('button', { name: /confirmar y crear/i }));

    await waitFor(() => expect(screen.queryByText(/destinatario.*del archivo/i)).not.toBeInTheDocument());
  });
});

describe('CC-24: fingerprint del CSV refleja el CONTENIDO, no sólo nombre+cantidad (M3, review adversarial)', () => {
  it('re-subir el mismo archivo (mismo nombre, misma cantidad de filas) con OTRO teléfono re-dispara el preview', async () => {
    renderComposer();
    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());

    uploadCsv('nombre;telefono\nAna;1123456789', 'destinatarios.csv');
    await waitFor(() =>
      expect(previewSegment).toHaveBeenLastCalledWith({
        statuses: [],
        manualContacts: [{ name: 'Ana', phone: '1123456789' }],
      }),
    );

    vi.mocked(previewSegment).mockClear();

    // Mismo nombre de archivo, misma cantidad de filas válidas (1) — pero el
    // teléfono cambió (ej. el operador corrigió un dato y volvió a exportar
    // con el mismo nombre de archivo). Con `fileName:length` esto NO
    // dispararía el preview de nuevo, dejándolo stale contra los
    // `csvContacts` frescos que sí viajan en `handleCreate`.
    uploadCsv('nombre;telefono\nAna;1199998888', 'destinatarios.csv');

    await waitFor(() =>
      expect(previewSegment).toHaveBeenCalledWith({
        statuses: [],
        manualContacts: [{ name: 'Ana', phone: '1199998888' }],
      }),
    );
  });
});
