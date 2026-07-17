/**
 * CampaignComposer — rediseño bulk-elegant: la card "Destinatarios" consolida
 * los 3 orígenes (Segmento / Manuales / CSV) en tabs accesibles (componente
 * `Tabs` del repo, mountMode="all" — los 3 paneles SIEMPRE montados, solo se
 * ocultan con CSS). CERO cambio de comportamiento: los orígenes se siguen
 * COMBINANDO (unión dedupeada) en preview y create.
 *
 *  TAB-1 estructura: tablist con Segmento/Manuales/CSV, Segmento activo por
 *        default, headings h2 "Mensaje" y "Destinatarios"
 *  TAB-2 cambiar de tab NO pierde el estado de los otros orígenes (lección
 *        `inbox-key-por-conversacion`) y la UNIÓN sigue viajando completa
 *  TAB-3 contador-chip en el label del tab cuando su origen tiene algo cargado
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
}));
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useCustomers', () => ({ useClientList: vi.fn() }));
vi.mock('@/api/networkSite.api', () => ({ getNetworkSites: vi.fn() }));
vi.mock('@/api/accessPoints.api', () => ({ listAssignableAccessPoints: vi.fn() }));

import { listBulkTemplates, previewSegment, createCampaign, listSegmentRecipients, listExcludedRecipients } from '@/api/messagingBulk.api';
import { getNetworkSites } from '@/api/networkSite.api';
import { listAssignableAccessPoints } from '@/api/accessPoints.api';
import { useClientList } from '@/hooks/useCustomers';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { CampaignComposer } from '@/pages/whatsapp/BulkMessagingPage/components/composer/CampaignComposer';
import type { PreviewSegmentOutput, TemplateSummaryDto } from '@/types/messagingBulk';

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
  vi.mocked(getNetworkSites).mockResolvedValue([]);
  vi.mocked(listAssignableAccessPoints).mockResolvedValue([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- retorno mínimo de useClientList
  vi.mocked(useClientList).mockReturnValue({ data: { data: CLIENTS, total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false } as any);
});

describe('TAB-1: la card Destinatarios consolida los 3 orígenes en tabs', () => {
  it('tablist con Segmento/Manuales/CSV, Segmento activo por default y su panel visible', async () => {
    renderComposer();

    const segmentTab = await screen.findByRole('tab', { name: /segmento/i });
    expect(segmentTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /manuales/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /csv/i })).toHaveAttribute('aria-selected', 'false');

    // El panel activo (Segmento) expone sus controles en el árbol de accesibilidad;
    // los paneles ocultos quedan fuera (display: none — getByRole los excluye).
    expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeInTheDocument();
  });

  it('jerarquía de cards: headings h2 "Mensaje" y "Destinatarios" (h1 de la page → h2, sin saltos)', async () => {
    renderComposer();

    expect(await screen.findByRole('heading', { name: 'Mensaje', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Destinatarios', level: 2 })).toBeInTheDocument();
  });
});

describe('TAB-2: cambiar de tab NO pierde el estado de los otros orígenes', () => {
  it('segmento + manual + CSV sobreviven al ciclo completo de tabs y la UNIÓN viaja completa al preview', async () => {
    const user = userEvent.setup();
    renderComposer();

    // Segmento (tab default): tildar "atrasado".
    await user.click(await screen.findByRole('checkbox', { name: /atrasado/i }));

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

    // Volver a Manuales — el chip de Juan sigue.
    await user.click(screen.getByRole('tab', { name: /manuales/i }));
    expect(screen.getByText(/1 destinatario manual/i)).toBeInTheDocument();

    // Volver a CSV — el resumen del archivo sigue.
    await user.click(screen.getByRole('tab', { name: /csv/i }));
    expect(screen.getByText(/1 destinatario del archivo/i)).toBeInTheDocument();

    // La UNIÓN de los 3 orígenes sigue viajando COMPLETA en el preview.
    await waitFor(() =>
      expect(previewSegment).toHaveBeenLastCalledWith({
        statuses: ['late'],
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
    expect(screen.getByRole('tab', { name: /manuales/i })).not.toHaveTextContent(/\d/);
    expect(screen.getByRole('tab', { name: /csv/i })).not.toHaveTextContent(/\d/);
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
