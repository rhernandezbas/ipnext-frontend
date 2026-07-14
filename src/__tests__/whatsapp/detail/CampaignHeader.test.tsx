/**
 * CampaignHeader (F2 apply chunk 3, HIST-2) — nombre + pill de estado +
 * contadores EN VIVO. Container-fino: `useCampaign` REAL, mockeada a nivel
 * fetch (mismo seam que `CampaignComposer.test.tsx`). El MECANISMO de
 * polling (5s mientras running, gate `useDocumentVisible`) ya está probado
 * en `useBulkMessaging.test.ts` (MBH-5) — acá solo se verifica el
 * renderizado de las 3 ramas + el cálculo de la barra de progreso.
 *
 *  CH-1 loading → skeleton (aria-busy)
 *  CH-2 error → role=alert
 *  CH-3 success → nombre + pill + contadores (total/enviados/fallidos/omitidos/opt-out)
 *  CH-4 progreso: role=status aria-live=polite + % calculado sobre el total
 *  CH-5 total=0 (blindaje división por cero) → 0% sin NaN
 */
import { render, screen } from '@testing-library/react';
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
import { CampaignHeader } from '@/pages/whatsapp/BulkMessagingPage/components/detail/CampaignHeader';
import type { CampaignDto } from '@/types/messagingBulk';

function makeCampaign(overrides: Partial<CampaignDto> = {}): CampaignDto {
  return {
    id: 'camp-1',
    name: 'Recordatorio julio',
    templateName: 'Recordatorio de pago',
    status: 'running',
    total: 40,
    sentCount: 10,
    failedCount: 5,
    skippedCount: 3,
    optedOutCount: 2,
    createdAt: '2026-07-01T12:00:00.000Z',
    startedAt: '2026-07-01T12:05:00.000Z',
    finishedAt: null,
    templateRef: 'HX123',
    segment: { statuses: ['late'] },
    ...overrides,
  };
}

function renderHeader(campaignId = 'camp-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<CampaignHeader campaignId={campaignId} />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CH-1: loading', () => {
  it('muestra un estado de carga (aria-busy)', () => {
    vi.mocked(getCampaign).mockReturnValue(new Promise(() => {}));
    renderHeader();

    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });
});

describe('CH-2: error', () => {
  it('muestra un mensaje role=alert', async () => {
    vi.mocked(getCampaign).mockRejectedValue(new Error('fail'));
    renderHeader();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo cargar/i);
  });
});

describe('CH-3: success', () => {
  it('muestra el nombre, la pill de estado y los contadores', async () => {
    vi.mocked(getCampaign).mockResolvedValue({ campaign: makeCampaign() });
    renderHeader();

    expect(await screen.findByText('Recordatorio julio')).toBeInTheDocument();
    expect(screen.getByText('Enviando')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('CH-4: barra de progreso', () => {
  it('role=status aria-live=polite y % calculado sobre el total', async () => {
    // processed = sent(10)+failed(5)+skipped(3)+optedOut(2) = 20 de 40 = 50%
    vi.mocked(getCampaign).mockResolvedValue({ campaign: makeCampaign() });
    renderHeader();

    const status = await screen.findByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('50%');
    expect(status).toHaveTextContent('20');
  });
});

describe('CH-5: total=0 (blindaje)', () => {
  it('no divide por cero (0%, sin NaN)', async () => {
    vi.mocked(getCampaign).mockResolvedValue({
      campaign: makeCampaign({ total: 0, sentCount: 0, failedCount: 0, skippedCount: 0, optedOutCount: 0 }),
    });
    renderHeader();

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('0%');
    expect(status.textContent).not.toMatch(/nan/i);
  });
});
