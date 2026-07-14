/**
 * RecipientsTable (F2 apply chunk 3, HIST-3) — paginado server-side de
 * destinatarios vía `useCampaign(id, {includeRecipients,page,limit,status})`.
 * Container-fino: hook REAL, `@/api/messagingBulk.api` mockeada a nivel
 * fetch.
 *
 * El filtro de estado usa los valores del DTO (lo que se VE en la tabla,
 * `'opted-out'` con guion) — la traducción a dominio (`'opted_out'`) vive
 * en `messagingBulk.api.ts` (`toDomainRecipientStatus`, probada en
 * `messagingBulk.api.test.ts` MBAPI-5b/5c) y NO se re-testea acá: acá solo
 * se verifica que `getCampaign` recibe el valor del DTO tal cual lo eligió
 * el usuario.
 *
 *  RT-1 loading → skeleton
 *  RT-2 error → role=alert
 *  RT-3 empty → emptyMessage
 *  RT-4 con datos → teléfono/estado/error/enviado
 *  RT-5 fila sin error → "—"
 *  RT-6 cambiar el filtro llama a getCampaign con el status del DTO y resetea a page 1
 *  RT-7 paginación server-side
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

import { getCampaign } from '@/api/messagingBulk.api';
import { RecipientsTable } from '@/pages/whatsapp/BulkMessagingPage/components/detail/RecipientsTable';
import type { CampaignDto, CampaignRecipientDto, GetCampaignOutput } from '@/types/messagingBulk';

const CAMPAIGN: CampaignDto = {
  id: 'camp-1',
  name: 'Recordatorio julio',
  templateName: 'Recordatorio de pago',
  status: 'running',
  total: 2,
  sentCount: 1,
  failedCount: 1,
  skippedCount: 0,
  optedOutCount: 0,
  createdAt: '2026-07-01T12:00:00.000Z',
  startedAt: '2026-07-01T12:05:00.000Z',
  finishedAt: null,
  templateRef: 'HX123',
  segment: { statuses: ['late'] },
};

const RECIPIENT_SENT: CampaignRecipientDto = {
  id: 'rec-1',
  clientId: 'cli-1',
  phoneE164: '+5491100000000',
  status: 'sent',
  error: null,
  sentAt: '2026-07-01T12:06:00.000Z',
};

const RECIPIENT_FAILED: CampaignRecipientDto = {
  id: 'rec-2',
  clientId: 'cli-2',
  phoneE164: '+5491100000001',
  status: 'failed',
  error: 'Número inválido',
  sentAt: null,
};

function makeOutput(recipients: CampaignRecipientDto[], overrides: Record<string, unknown> = {}): GetCampaignOutput {
  return { campaign: CAMPAIGN, recipients: { data: recipients, total: recipients.length, page: 1, limit: 20, ...overrides } };
}

function renderTable(campaignId = 'camp-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<RecipientsTable campaignId={campaignId} />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RT-1: loading', () => {
  it('muestra el skeleton de DataTable', () => {
    vi.mocked(getCampaign).mockReturnValue(new Promise(() => {}));
    renderTable();

    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});

describe('RT-2: error', () => {
  it('muestra un mensaje role=alert', async () => {
    vi.mocked(getCampaign).mockRejectedValue(new Error('fail'));
    renderTable();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
  });
});

describe('RT-3: empty', () => {
  it('muestra el emptyMessage', async () => {
    vi.mocked(getCampaign).mockResolvedValue(makeOutput([]));
    renderTable();

    expect(await screen.findByText(/no hay destinatarios/i)).toBeInTheDocument();
  });
});

describe('RT-4: con datos', () => {
  it('renderiza teléfono/estado/error/enviado', async () => {
    vi.mocked(getCampaign).mockResolvedValue(makeOutput([RECIPIENT_SENT, RECIPIENT_FAILED]));
    renderTable();

    expect(await screen.findByText('+5491100000000')).toBeInTheDocument();
    // "Enviado"/"Fallido" también son labels de opciones del filtro (select) —
    // se scopea a la CELDA de la tabla para no matchear el <option>.
    expect(screen.getByRole('cell', { name: 'Enviado' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Número inválido' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Fallido' })).toBeInTheDocument();
  });
});

describe('RT-5: fila sin error', () => {
  it('muestra "—" en la columna error', async () => {
    vi.mocked(getCampaign).mockResolvedValue(makeOutput([RECIPIENT_SENT]));
    renderTable();

    await screen.findByText('+5491100000000');
    const cells = screen.getAllByRole('cell');
    expect(cells.some((c) => c.textContent === '—')).toBe(true);
  });
});

describe('RT-6: filtro de estado', () => {
  it('elegir "opted-out" llama a getCampaign con status="opted-out" y resetea a page 1', async () => {
    vi.mocked(getCampaign).mockResolvedValue(makeOutput([RECIPIENT_SENT]));
    const user = userEvent.setup();
    renderTable();

    await screen.findByText('+5491100000000');
    await user.selectOptions(screen.getByRole('combobox', { name: /filtrar por estado/i }), 'opted-out');

    await waitFor(() =>
      expect(getCampaign).toHaveBeenCalledWith(
        'camp-1',
        expect.objectContaining({ status: 'opted-out', page: 1 }),
      ),
    );
  });
});

describe('RT-7: paginación server-side', () => {
  it('cambiar de página llama a getCampaign con el page nuevo', async () => {
    vi.mocked(getCampaign).mockResolvedValue(makeOutput([RECIPIENT_SENT], { total: 50, limit: 20 }));
    const user = userEvent.setup();
    renderTable();

    await screen.findByText('+5491100000000');
    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() =>
      expect(getCampaign).toHaveBeenCalledWith('camp-1', expect.objectContaining({ page: 2 })),
    );
  });
});
