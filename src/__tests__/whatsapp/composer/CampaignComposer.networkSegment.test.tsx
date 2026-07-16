/**
 * CampaignComposer — integración del filtro de red Nodo/AP (node-segment-fe).
 * Hooks REALES (`useNetworkSites`/`useAssignableAccessPoints` con las APIs
 * mockeadas a nivel fetch — mismo seam que `CampaignComposer.test.tsx` para
 * `messagingBulk.api`). Contrato BE FIJO: el segmento (preview + creación)
 * acepta `networkSiteId?`/`accessPointId?`; nodo o AP SOLOS ya son un
 * segmento válido.
 *
 *  CNS-1 con SOLO un nodo elegido, el preview automático se dispara con
 *        networkSiteId en el payload y "Crear campaña" se habilita
 *  CNS-2 nodo + AP viajan JUNTOS en el payload del preview
 *  CNS-3 el body de createCampaign incluye segment.networkSiteId/accessPointId
 *  CNS-4 el modal de confirmación muestra el nodo/AP elegidos por NOMBRE
 *  CNS-5 sin filtro de red, el payload NO incluye las keys (no-regresión)
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { NetworkSite } from '@/types/networkSite';
import type { AccessPointOption } from '@/types/accessPoint';

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
vi.mock('@/hooks/useCustomers', () => ({ useClientList: vi.fn() }));
vi.mock('@/api/networkSite.api', () => ({ getNetworkSites: vi.fn() }));
vi.mock('@/api/accessPoints.api', () => ({ listAssignableAccessPoints: vi.fn() }));

import { listBulkTemplates, previewSegment, createCampaign } from '@/api/messagingBulk.api';
import { getNetworkSites } from '@/api/networkSite.api';
import { listAssignableAccessPoints } from '@/api/accessPoints.api';
import { useClientList } from '@/hooks/useCustomers';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { CampaignComposer } from '@/pages/whatsapp/BulkMessagingPage/components/composer/CampaignComposer';
import type { PreviewSegmentOutput, TemplateSummaryDto } from '@/types/messagingBulk';

/** Template SIN variables — el gate `allVariablesMapped` queda trivialmente en true (mismo atajo que BMP-5). */
const TEMPLATE: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Aviso de corte',
  language: 'es',
  variables: [],
  approvalStatus: 'approved',
  sendable: true,
  body: 'Aviso de corte programado en tu zona.',
};

const PREVIEW: PreviewSegmentOutput = {
  count: 42,
  sample: [{ clientId: 'cli-1', name: 'Juan Perez', phoneE164: '+5491100000000', status: 'active' }],
  skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
  statusCounts: { active: 42 },
};

function site(overrides: Partial<NetworkSite> = {}): NetworkSite {
  return {
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
    ...overrides,
  };
}

const SITES: NetworkSite[] = [
  site({ id: 'site-1', name: 'Nodo Centro' }),
  site({ id: 'site-2', siteNumber: 2, fixedCode: 'NODO 2', name: 'Nodo Norte' }),
];

const APS: AccessPointOption[] = [
  { id: 'ap-1', name: 'AP Centro Torre', mac: 'AA:BB:CC:DD:EE:01', networkSiteId: 'site-1' },
  { id: 'ap-3', name: 'AP Norte Torre', mac: 'AA:BB:CC:DD:EE:03', networkSiteId: 'site-2' },
];

function renderComposer() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<CampaignComposer />, { wrapper });
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
  vi.mocked(getNetworkSites).mockResolvedValue(SITES);
  // Scoping real: con networkSiteId devuelve SOLO los APs de ese nodo.
  vi.mocked(listAssignableAccessPoints).mockImplementation((networkSiteId?: string) =>
    Promise.resolve(networkSiteId ? APS.filter((a) => a.networkSiteId === networkSiteId) : APS),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retorno mínimo de useClientList (ManualRecipientsPicker montado)
  vi.mocked(useClientList).mockReturnValue({ data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false } as any);
});

async function selectTemplate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('combobox', { name: /template/i }));
  await user.click(screen.getByRole('option', { name: /aviso de corte/i }));
}

async function selectNode(name: string | RegExp) {
  fireEvent.click(screen.getByRole('combobox', { name: /^nodo$/i }));
  fireEvent.click(await screen.findByRole('option', { name }));
}

async function selectAp(name: string | RegExp) {
  fireEvent.click(screen.getByRole('combobox', { name: /access point/i }));
  fireEvent.click(await screen.findByRole('option', { name }));
}

describe('CNS-1: nodo SOLO ya es un segmento válido', () => {
  it('elegir un nodo (sin estados ni deuda) dispara el preview con networkSiteId y habilita crear', async () => {
    const user = userEvent.setup();
    renderComposer();

    await selectTemplate(user);
    expect(previewSegment).not.toHaveBeenCalled();

    await selectNode('Nodo Centro');

    await waitFor(
      () => expect(previewSegment).toHaveBeenCalledWith({ statuses: [], networkSiteId: 'site-1' }),
      { timeout: 2000 },
    );
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());

    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Corte Nodo Centro');
    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
  });
});

describe('CNS-2: nodo + AP en el payload del preview', () => {
  it('elegir nodo y AP manda ambos ids (AND con estados/deuda)', async () => {
    const user = userEvent.setup();
    renderComposer();

    await selectTemplate(user);
    await selectNode('Nodo Centro');
    // El select de AP quedó scoped al nodo — esperar el catálogo acotado.
    await waitFor(() => expect(listAssignableAccessPoints).toHaveBeenCalledWith('site-1'));
    await selectAp('AP Centro Torre');

    await waitFor(
      () =>
        expect(previewSegment).toHaveBeenCalledWith({
          statuses: [],
          networkSiteId: 'site-1',
          accessPointId: 'ap-1',
        }),
      { timeout: 2000 },
    );
  });
});

describe('CNS-3: creación con filtro de red', () => {
  it('el body de createCampaign incluye segment.networkSiteId/accessPointId', async () => {
    const user = userEvent.setup();
    renderComposer();

    await selectTemplate(user);
    await selectNode('Nodo Centro');
    await waitFor(() => expect(listAssignableAccessPoints).toHaveBeenCalledWith('site-1'));
    await selectAp('AP Centro Torre');
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument(), { timeout: 2000 });
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Corte Nodo Centro');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);
    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    await user.click(within(dialog).getByRole('button', { name: /confirmar y crear/i }));

    await waitFor(() =>
      expect(createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          segment: { statuses: [], networkSiteId: 'site-1', accessPointId: 'ap-1' },
        }),
      ),
    );
  });
});

describe('CNS-4: el confirm modal muestra nodo/AP por NOMBRE', () => {
  it('el resumen del modal nombra "Nodo Centro" y "AP Centro Torre" (no ids)', async () => {
    const user = userEvent.setup();
    renderComposer();

    await selectTemplate(user);
    await selectNode('Nodo Centro');
    await waitFor(() => expect(listAssignableAccessPoints).toHaveBeenCalledWith('site-1'));
    await selectAp('AP Centro Torre');
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument(), { timeout: 2000 });
    // OJO: el nombre de campaña NO debe contener "Nodo Centro" — colisionaría
    // con la fila "Filtro de red" y rompería el getByText singular de abajo.
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Aviso julio');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);

    const dialog = await screen.findByRole('dialog', { name: /nueva campaña/i });
    expect(within(dialog).getByText(/nodo centro/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/ap centro torre/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/site-1|ap-1/)).not.toBeInTheDocument();
  });
});

describe('CNS-5: sin filtro de red, cero cambio en el payload', () => {
  it('tildar solo un estado NO agrega las keys networkSiteId/accessPointId', async () => {
    const user = userEvent.setup();
    renderComposer();

    await selectTemplate(user);
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));

    await waitFor(
      () => expect(previewSegment).toHaveBeenCalledWith({ statuses: ['late'] }),
      { timeout: 2000 },
    );
    const payload = vi.mocked(previewSegment).mock.calls[0][0];
    expect(payload.networkSiteId).toBeUndefined();
    expect(payload.accessPointId).toBeUndefined();
  });
});
