/**
 * CampaignsTable — tab "Historial" (F2 apply chunk 3, HIST-1). Container-fino:
 * `useCampaigns` REAL, `@/api/messagingBulk.api` mockeada a nivel fetch
 * (mismo seam que `CampaignComposer.test.tsx`). Paginado SERVER-SIDE real,
 * molde `ContractsListPage`.
 *
 *  CT-1 loading → skeleton de DataTable
 *  CT-2 error → mensaje role=alert, NO monta la tabla
 *  CT-3 empty → emptyMessage de DataTable
 *  CT-4 con datos → nombre/template/estado(pill)/total/contadores/fecha
 *  CT-5 click en el nombre llama a onViewDetail(id)
 *  CT-6 click en la acción "Ver detalle" (kebab) llama a onViewDetail(id)
 *  CT-7 paginación server-side: cambiar de página llama a listCampaigns con el page nuevo
 */
import { render, screen, waitFor } from '@testing-library/react';
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
}));

import { listCampaigns } from '@/api/messagingBulk.api';
import { CampaignsTable } from '@/pages/whatsapp/BulkMessagingPage/components/history/CampaignsTable';
import type { CampaignSummaryDto, PaginatedResult } from '@/types/messagingBulk';

const CAMPAIGN: CampaignSummaryDto = {
  id: 'camp-1',
  name: 'Recordatorio julio',
  templateName: 'Recordatorio de pago',
  status: 'running',
  total: 42,
  sentCount: 10,
  failedCount: 1,
  skippedCount: 2,
  optedOutCount: 0,
  createdAt: '2026-07-01T12:00:00.000Z',
  startedAt: '2026-07-01T12:05:00.000Z',
  finishedAt: null,
};

function makePage(
  data: CampaignSummaryDto[],
  overrides: Partial<PaginatedResult<CampaignSummaryDto>> = {},
): PaginatedResult<CampaignSummaryDto> {
  return { data, total: data.length, page: 1, limit: 20, ...overrides };
}

function renderTable(onViewDetail = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...render(<CampaignsTable onViewDetail={onViewDetail} />, { wrapper }), onViewDetail };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CT-1: loading', () => {
  it('muestra el skeleton de DataTable mientras carga', () => {
    vi.mocked(listCampaigns).mockReturnValue(new Promise(() => {}));
    renderTable();
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});

describe('CT-2: error', () => {
  it('muestra un mensaje role=alert y no monta la tabla', async () => {
    vi.mocked(listCampaigns).mockRejectedValue(new Error('fail'));
    renderTable();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo cargar/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('CT-3: empty', () => {
  it('muestra el emptyMessage de DataTable', async () => {
    vi.mocked(listCampaigns).mockResolvedValue(makePage([]));
    renderTable();

    expect(await screen.findByText(/todavía no se creó ninguna campaña/i)).toBeInTheDocument();
  });
});

describe('CT-4: con datos', () => {
  it('renderiza nombre/template/estado/total/contadores/fecha', async () => {
    vi.mocked(listCampaigns).mockResolvedValue(makePage([CAMPAIGN]));
    renderTable();

    expect(await screen.findByText('Recordatorio julio')).toBeInTheDocument();
    expect(screen.getByText('Recordatorio de pago')).toBeInTheDocument();
    expect(screen.getByText('Enviando')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('10 / 1 / 2')).toBeInTheDocument();
  });
});

describe('CT-5: click en el nombre', () => {
  it('llama a onViewDetail con el id', async () => {
    vi.mocked(listCampaigns).mockResolvedValue(makePage([CAMPAIGN]));
    const user = userEvent.setup();
    const { onViewDetail } = renderTable();

    await user.click(await screen.findByText('Recordatorio julio'));

    expect(onViewDetail).toHaveBeenCalledWith('camp-1');
  });
});

describe('CT-6: acción "Ver detalle"', () => {
  it('el kebab también llama a onViewDetail con el id', async () => {
    vi.mocked(listCampaigns).mockResolvedValue(makePage([CAMPAIGN]));
    const user = userEvent.setup();
    const { onViewDetail } = renderTable();

    await screen.findByText('Recordatorio julio');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }));

    expect(onViewDetail).toHaveBeenCalledWith('camp-1');
  });
});

describe('CT-7: paginación server-side', () => {
  it('cambiar de página llama a listCampaigns con el page nuevo', async () => {
    vi.mocked(listCampaigns).mockResolvedValue(makePage([CAMPAIGN], { total: 50, limit: 20 }));
    const user = userEvent.setup();
    renderTable();

    await screen.findByText('Recordatorio julio');
    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => expect(listCampaigns).toHaveBeenCalledWith({ page: 2, limit: 20 }));
  });
});
