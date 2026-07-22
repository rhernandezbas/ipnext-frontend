/**
 * CampaignComposer — rediseño bulk-elegant: la card "Destinatarios" consolida
 * los orígenes en tabs accesibles (componente `Tabs` del repo, mountMode="all"
 * — los paneles SIEMPRE montados, solo se ocultan con CSS). CERO cambio de
 * comportamiento: los orígenes se siguen COMBINANDO (unión dedupeada) en
 * preview y create.
 *
 * Change network-filter-tab — el filtro de red Nodo/AP salió del panel
 * Segmento a un TAB PROPIO (segundo): Segmento | Nodo/AP | Manuales | CSV.
 * Mudanza de UI únicamente: `networkSiteId`/`accessPointId` siguen DENTRO de
 * `CampaignSegment` (AND con estados/deuda, payload idéntico).
 *
 *  TAB-1 estructura: tablist con Segmento/Nodo\/AP/Manuales/CSV (en ese
 *        orden), Segmento activo por default, headings h2 "Mensaje" y
 *        "Destinatarios"; los selects de red viven en el tab Nodo/AP y NO
 *        en Segmento
 *  TAB-2 cambiar de tab NO pierde el estado de los otros orígenes (lección
 *        `inbox-key-por-conversacion`) y la UNIÓN sigue viajando completa
 *  TAB-3 contador-chip en el label del tab cuando su origen tiene algo
 *        cargado — el chip de Segmento cuenta SOLO estados+deuda efectiva;
 *        el de Nodo/AP cuenta sus propios filtros (0/1/2)
 *  TAB-4 microcopy de la unión visible en la card (sin abrir cada tab)
 *
 * Mismos seams de mock que `CampaignComposer.test.tsx` (fetch-level para
 * messagingBulk.api / catálogos de red; hook-level para permisos y clientes).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
// bulk-task-recipients (D8) — mockeado a nivel hook: describe propio más
// abajo (TASK-1..TASK-4) sobreescribe con catálogos concretos.
vi.mock('@/hooks/useTaskStageConfig', () => ({ useTaskStageConfig: vi.fn(), useUpdateTaskStageConfig: vi.fn() }));

import { listBulkTemplates, previewSegment, createCampaign, listSegmentRecipients, listExcludedRecipients, listChatwootLabels } from '@/api/messagingBulk.api';
import { getNetworkSites } from '@/api/networkSite.api';
import { listAssignableAccessPoints } from '@/api/accessPoints.api';
import { useClientList } from '@/hooks/useCustomers';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { useTaskStageConfig } from '@/hooks/useTaskStageConfig';
import { CampaignComposer } from '@/pages/whatsapp/BulkMessagingPage/components/composer/CampaignComposer';
import type { PreviewSegmentOutput, TemplateSummaryDto } from '@/types/messagingBulk';
import type { NetworkSite } from '@/types/networkSite';
import type { AccessPointOption } from '@/types/accessPoint';
import type { MappedStageDto } from '@/types/taskStageConfig';

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

const CLIENTS = [
  { id: 'c-1', name: 'Juan García', email: 'juan@test.com', phone: '+5491111111111', status: 'active', balance: 0, category: '', tariffPlan: null, login: null, ipRanges: null, accessDevices: 0, createdAt: '' },
];

// network-filter-tab — catálogos de red para el tab Nodo/AP (fetch-level,
// mismos seams que `CampaignComposer.networkSegment.test.tsx`).
const SITES: NetworkSite[] = [
  {
    id: 'site-1',
    siteNumber: 1,
    fixedCode: 'NODO 1',
    name: 'Nodo Centro',
    address: 'Av. Siempreviva 742',
    city: 'CABA',
    coordinates: null,
    type: 'nodo',
    status: 'active',
    deviceCount: 10,
    clientCount: 100,
    uplink: '1 Gbps',
    parentSiteId: null,
    description: '',
    iclassNodeCode: null,
    uispSiteId: null,
  },
];

const APS: AccessPointOption[] = [
  { id: 'ap-1', name: 'AP Centro Torre', mac: 'AA:BB:CC:DD:EE:01', networkSiteId: 'site-1' },
];

// bulk-task-recipients (D8) — catálogo mapeado fixture (2 stages, 1 workflow).
const MAPPED_STAGES: MappedStageDto[] = [
  { stageId: 's1', stageName: 'Pendiente', stageCode: 'PEND', color: '#111111', workflowId: 'wf1', workflowName: 'Instalaciones' },
];

function renderComposer() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<CampaignComposer />, { wrapper });
}

/** Carga un CSV vía el input del uploader — el tab CSV debe estar activo (interacción legítima). */
function uploadCsv(csv: string, fileName = 'destinatarios.csv') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([csv], fileName, { type: 'text/csv' });
  fireEvent.change(input, { target: { files: [file] } });
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
  vi.mocked(createCampaign).mockResolvedValue({ campaignId: 'camp-1', total: 42, status: 'pending' });
  vi.mocked(listSegmentRecipients).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 }, statusCounts: {} });
  vi.mocked(listExcludedRecipients).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 }, statusCounts: {} });
  vi.mocked(listChatwootLabels).mockResolvedValue([]);
  vi.mocked(getNetworkSites).mockResolvedValue(SITES);
  // Scoping real: con networkSiteId devuelve SOLO los APs de ese nodo.
  vi.mocked(listAssignableAccessPoints).mockImplementation((networkSiteId?: string) =>
    Promise.resolve(networkSiteId ? APS.filter((a) => a.networkSiteId === networkSiteId) : APS),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retorno mínimo de useClientList
  vi.mocked(useClientList).mockReturnValue({ data: { data: CLIENTS, total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false } as any);
  // bulk-task-recipients (D8) — default: mapeo YA cargado con 1 stage (los
  // tests TAB-1..TAB-4 preexistentes no dependen de "Tarea"; el describe
  // propio TASK-1..TASK-4 sobreescribe cuando necesita otro catálogo).
  vi.mocked(useTaskStageConfig).mockReturnValue({
    data: { stages: MAPPED_STAGES },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retorno mínimo de useTaskStageConfig
  } as any);
});

describe('TAB-1: la card Destinatarios consolida los orígenes en tabs', () => {
  it('tablist con Segmento/Nodo\\/AP/Manuales/CSV en ese orden, Segmento activo por default y su panel visible', async () => {
    renderComposer();

    const segmentTab = await screen.findByRole('tab', { name: /segmento/i });
    expect(segmentTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /nodo\/ap/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /manuales/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /csv/i })).toHaveAttribute('aria-selected', 'false');

    // Orden: Segmento | Nodo/AP | Manuales | CSV | Números | Tarea
    // (bulk-granular-perms agregó "Números"; bulk-task-recipients agrega
    // "Tarea" AL FINAL, D10 — append, nunca insertar en medio).
    const tabTexts = screen.getAllByRole('tab').map((t) => t.textContent ?? '');
    expect(tabTexts).toHaveLength(6);
    expect(tabTexts[0]).toMatch(/segmento/i);
    expect(tabTexts[1]).toMatch(/nodo\/ap/i);
    expect(tabTexts[2]).toMatch(/manuales/i);
    expect(tabTexts[3]).toMatch(/csv/i);
    expect(tabTexts[4]).toMatch(/números/i);
    expect(tabTexts[5]).toMatch(/tarea/i);

    // El panel activo (Segmento) expone sus controles en el árbol de accesibilidad;
    // los paneles ocultos quedan fuera (display: none — getByRole los excluye).
    expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeInTheDocument();
  });

  it('los selects de Nodo/AP viven en el tab nuevo y NO en el panel Segmento', async () => {
    const user = userEvent.setup();
    renderComposer();

    // Tab Segmento activo (default): NINGÚN combobox de red visible en su panel.
    await screen.findByRole('tab', { name: /segmento/i });
    expect(screen.queryByRole('combobox', { name: /^nodo$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /access point/i })).not.toBeInTheDocument();

    // Tab Nodo/AP: ahí están los dos selects; los controles del Segmento se ocultan.
    await user.click(screen.getByRole('tab', { name: /nodo\/ap/i }));
    expect(screen.getByRole('combobox', { name: /^nodo$/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /access point/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /atrasado/i })).not.toBeInTheDocument();
  });

  it('jerarquía de cards: headings h2 "Mensaje" y "Destinatarios" (h1 de la page → h2, sin saltos)', async () => {
    renderComposer();

    expect(await screen.findByRole('heading', { name: 'Mensaje', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Destinatarios', level: 2 })).toBeInTheDocument();
  });
});

describe('TAB-2: cambiar de tab NO pierde el estado de los otros orígenes', () => {
  it('segmento + nodo + manual + CSV sobreviven al ciclo completo por los 4 tabs y la UNIÓN viaja completa al preview', async () => {
    const user = userEvent.setup();
    renderComposer();

    // Segmento (tab default): tildar "atrasado".
    await user.click(await screen.findByRole('checkbox', { name: /atrasado/i }));

    // Nodo/AP: elegir el nodo (el filtro de red vive DENTRO del segment igual
    // que siempre — mudanza de UI, no de modelo).
    await user.click(screen.getByRole('tab', { name: /nodo\/ap/i }));
    fireEvent.click(screen.getByRole('combobox', { name: /^nodo$/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'Nodo Centro' }));

    // Manuales: agregar a Juan.
    await user.click(screen.getByRole('tab', { name: /manuales/i }));
    await user.type(screen.getByLabelText(/buscar cliente/i), 'a');
    await user.click(await screen.findByText('Juan García'));

    // CSV: cargar un archivo válido.
    await user.click(screen.getByRole('tab', { name: /csv/i }));
    uploadCsv('nombre;telefono\nAna;1123456789');
    await screen.findByText(/1 destinatario del archivo/i);

    // Volver a Segmento — el estado NO se perdió.
    await user.click(screen.getByRole('tab', { name: /segmento/i }));
    expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeChecked();

    // Volver a Nodo/AP — el trigger sigue mostrando el nodo elegido.
    await user.click(screen.getByRole('tab', { name: /nodo\/ap/i }));
    expect(screen.getByRole('combobox', { name: /^nodo$/i })).toHaveTextContent('Nodo Centro');

    // Volver a Manuales — el chip de Juan sigue.
    await user.click(screen.getByRole('tab', { name: /manuales/i }));
    expect(screen.getByText(/1 destinatario manual/i)).toBeInTheDocument();

    // Volver a CSV — el resumen del archivo sigue.
    await user.click(screen.getByRole('tab', { name: /csv/i }));
    expect(screen.getByText(/1 destinatario del archivo/i)).toBeInTheDocument();

    // La UNIÓN de los 4 orígenes de datos sigue viajando COMPLETA en el
    // preview — payload IDÉNTICO al de siempre: networkSiteId adentro del
    // segment (spread plano), NO en una key nueva.
    await waitFor(() =>
      expect(previewSegment).toHaveBeenLastCalledWith({
        statuses: ['late'],
        networkSiteId: 'site-1',
        manualClientIds: ['c-1'],
        manualContacts: [{ name: 'Ana', phone: '1123456789' }],
      }),
    );
  });
});

describe('TAB-3: contador-chip en el label del tab cuando su origen tiene algo cargado', () => {
  it('sin nada cargado, ningún tab muestra contador', async () => {
    renderComposer();

    expect(await screen.findByRole('tab', { name: /segmento/i })).not.toHaveTextContent(/\d/);
    expect(screen.getByRole('tab', { name: /nodo\/ap/i })).not.toHaveTextContent(/\d/);
    expect(screen.getByRole('tab', { name: /manuales/i })).not.toHaveTextContent(/\d/);
    expect(screen.getByRole('tab', { name: /csv/i })).not.toHaveTextContent(/\d/);
  });

  it('el filtro de red cuenta en el chip del tab Nodo/AP (1 con nodo, 2 con nodo+AP) y NO en el de Segmento', async () => {
    const user = userEvent.setup();
    renderComposer();

    // Elegir un nodo en su tab → chip "1" en Nodo/AP; Segmento sigue sin chip
    // (su contador es honesto: cuenta SOLO estados+deuda, que viven ahí).
    await user.click(await screen.findByRole('tab', { name: /nodo\/ap/i }));
    fireEvent.click(screen.getByRole('combobox', { name: /^nodo$/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'Nodo Centro' }));
    expect(screen.getByRole('tab', { name: /nodo\/ap/i })).toHaveTextContent(/1/);
    expect(screen.getByRole('tab', { name: /segmento/i })).not.toHaveTextContent(/\d/);

    // Elegir también el AP → chip "2". El catálogo de APs se re-scopea al
    // nodo recién elegido (query nueva) — esperar a que el select re-habilite.
    const apTrigger = screen.getByRole('combobox', { name: /access point/i });
    await waitFor(() => expect(apTrigger).toBeEnabled());
    fireEvent.click(apTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'AP Centro Torre' }));
    expect(screen.getByRole('tab', { name: /nodo\/ap/i })).toHaveTextContent(/2/);
    expect(screen.getByRole('tab', { name: /segmento/i })).not.toHaveTextContent(/\d/);

    // Un estado tildado suma SOLO al chip de Segmento (no al de Nodo/AP).
    await user.click(screen.getByRole('tab', { name: /segmento/i }));
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    expect(screen.getByRole('tab', { name: /segmento/i })).toHaveTextContent(/1 filtro/i);
    expect(screen.getByRole('tab', { name: /nodo\/ap/i })).toHaveTextContent(/2/);
  });

  it('limpiar el filtro de red hace desaparecer el chip de Nodo/AP (sin "0" colgado)', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(await screen.findByRole('tab', { name: /nodo\/ap/i }));
    fireEvent.click(screen.getByRole('combobox', { name: /^nodo$/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'Nodo Centro' }));
    expect(screen.getByRole('tab', { name: /nodo\/ap/i })).toHaveTextContent(/1/);

    fireEvent.click(screen.getByRole('combobox', { name: /^nodo$/i }));
    fireEvent.click(await screen.findByRole('option', { name: /todos los nodos/i }));
    expect(screen.getByRole('tab', { name: /nodo\/ap/i })).not.toHaveTextContent(/\d/);
  });

  it('Segmento muestra la cantidad de filtros activos; Manuales y CSV la cantidad de destinatarios', async () => {
    const user = userEvent.setup();
    renderComposer();

    // 1 estado tildado → "1 filtro".
    await user.click(await screen.findByRole('checkbox', { name: /atrasado/i }));
    expect(screen.getByRole('tab', { name: /segmento/i })).toHaveTextContent(/1 filtro/i);

    // 1 manual agregado → chip "1".
    await user.click(screen.getByRole('tab', { name: /manuales/i }));
    await user.type(screen.getByLabelText(/buscar cliente/i), 'a');
    await user.click(await screen.findByText('Juan García'));
    expect(screen.getByRole('tab', { name: /manuales/i })).toHaveTextContent(/1/);

    // CSV con 2 filas válidas → chip "2".
    await user.click(screen.getByRole('tab', { name: /csv/i }));
    uploadCsv('nombre;telefono\nAna;1123456789\nLuis;1198765432');
    await screen.findByText(/2 destinatarios del archivo/i);
    expect(screen.getByRole('tab', { name: /csv/i })).toHaveTextContent(/2/);
  });

  it('L1: una deuda de $0 NO cuenta como filtro (mismo criterio efectivo que el gate/hint)', async () => {
    const user = userEvent.setup();
    renderComposer();

    // El operador tipea $0 — el hint del SegmentBuilder ya avisa que "no
    // filtra a nadie" y el gate lo trata como no-criterio: el chip NO puede
    // contradecirlos mostrando "1 filtro".
    const minInput = await screen.findByLabelText(/deuda mínima/i);
    await user.type(minInput, '0');
    expect(screen.getByRole('tab', { name: /segmento/i })).not.toHaveTextContent(/\d/);

    // Con una deuda que SÍ filtra (>0), el chip aparece.
    await user.clear(minInput);
    await user.type(minInput, '100');
    expect(screen.getByRole('tab', { name: /segmento/i })).toHaveTextContent(/1 filtro/i);
  });

  it('quitar lo cargado hace desaparecer el contador (no queda un "0" colgado)', async () => {
    const user = userEvent.setup();
    renderComposer();

    const checkbox = await screen.findByRole('checkbox', { name: /atrasado/i });
    await user.click(checkbox);
    expect(screen.getByRole('tab', { name: /segmento/i })).toHaveTextContent(/1 filtro/i);

    await user.click(checkbox);
    expect(screen.getByRole('tab', { name: /segmento/i })).not.toHaveTextContent(/\d/);
  });
});

describe('TAB-4: microcopy de la unión — se VE sin abrir cada tab', () => {
  it('la card Destinatarios aclara que los 3 orígenes se combinan sin duplicados', async () => {
    renderComposer();

    expect(await screen.findByText(/se combinan en un único envío/i)).toBeInTheDocument();
  });
});

/**
 * TASK-1..TASK-4 — 6to tab "Tarea" (bulk-task-recipients FE, D8). Molde de
 * mock: `useTaskStageConfig` a nivel hook (mismo criterio que `useMyPermissions`).
 */
describe('TASK-1: el tab "Tarea" muestra los estados MAPEADOS', () => {
  it('con mapeo cargado, lista un checkbox por stage y permite tildarlo', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(await screen.findByRole('tab', { name: /^tarea/i }));
    const checkbox = screen.getByRole('checkbox', { name: /pendiente/i });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});

describe('TASK-2: config vacía → tab con hint, sin checklist', () => {
  it('sin NINGÚN stage mapeado, el panel muestra el hint accionable (no checkboxes)', async () => {
    vi.mocked(useTaskStageConfig).mockReturnValue({
      data: { stages: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retorno mínimo de useTaskStageConfig
    } as any);
    const user = userEvent.setup();
    renderComposer();

    await user.click(await screen.findByRole('tab', { name: /^tarea/i }));
    expect(screen.getByText(/configur[aá].*ajustes.*whatsapp/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /pendiente/i })).not.toBeInTheDocument();
  });
});

describe('TASK-3: tildar un estado de tarea viaja en el payload del preview', () => {
  it('con SOLO un estado tildado (sin segmento/manual/csv), previewSegment recibe taskStageIds', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(await screen.findByRole('tab', { name: /^tarea/i }));
    await user.click(screen.getByRole('checkbox', { name: /pendiente/i }));

    await waitFor(() =>
      expect(previewSegment).toHaveBeenCalledWith({ statuses: [], taskStageIds: ['s1'] }),
    );
  });
});

describe('TASK-4: sin selección, el payload NO incluye taskStageIds (no-regresión)', () => {
  it('tildar y destildar deja el payload IDÉNTICO al de antes de este change', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(await screen.findByRole('checkbox', { name: /atrasado/i }));
    await waitFor(() => expect(previewSegment).toHaveBeenCalledWith({ statuses: ['late'] }));

    const payload = vi.mocked(previewSegment).mock.calls[vi.mocked(previewSegment).mock.calls.length - 1][0];
    expect(payload).not.toHaveProperty('taskStageIds');
  });
});
