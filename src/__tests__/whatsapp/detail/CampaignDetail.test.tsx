/**
 * CampaignDetail (F2 apply chunk 3) — compone `CampaignHeader` +
 * `SendCampaignButton` (solo `pending`) + `RecipientsTable`. Se monta cuando
 * `BulkMessagingPage` tiene `?campaign=<id>` en la URL.
 *
 *  CD-1 "Volver al historial" llama a onBack
 *  CD-2 siempre monta CampaignHeader (nombre visible)
 *  CD-3 status pending → monta SendCampaignButton
 *  CD-4 status running → NO monta SendCampaignButton
 *  CD-5 siempre monta RecipientsTable (fetchea destinatarios)
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

import { getCampaign, sendCampaign } from '@/api/messagingBulk.api';
import { CampaignDetail } from '@/pages/whatsapp/BulkMessagingPage/components/detail/CampaignDetail';
import type { CampaignDto, CampaignStatusDto, GetCampaignQuery, GetCampaignOutput } from '@/types/messagingBulk';

function makeCampaign(overrides: Partial<CampaignDto> = {}): CampaignDto {
  return {
    id: 'camp-1',
    name: 'Recordatorio julio',
    templateName: 'Recordatorio de pago',
    status: 'pending',
    total: 42,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    optedOutCount: 0,
    createdAt: '2026-07-01T12:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    templateRef: 'HX123',
    segment: { statuses: ['late'] },
    ...overrides,
  };
}

function renderDetail(campaign: CampaignDto, onBack = vi.fn()) {
  vi.mocked(getCampaign).mockImplementation((_id: string, query: GetCampaignQuery = {}) =>
    Promise.resolve({
      campaign,
      ...(query.includeRecipients ? { recipients: { data: [], total: 0, page: 1, limit: 20 } } : {}),
    } as GetCampaignOutput),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...render(<CampaignDetail campaignId="camp-1" onBack={onBack} />, { wrapper }), onBack };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CD-1: volver al historial', () => {
  it('llama a onBack al click', async () => {
    const user = userEvent.setup();
    const { onBack } = renderDetail(makeCampaign());

    await user.click(screen.getByRole('button', { name: /volver al historial/i }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('CD-2: header', () => {
  it('muestra el nombre de la campaña (CampaignHeader)', async () => {
    renderDetail(makeCampaign());
    expect(await screen.findByText('Recordatorio julio')).toBeInTheDocument();
  });
});

describe('CD-3: status pending', () => {
  it('monta SendCampaignButton', async () => {
    renderDetail(makeCampaign({ status: 'pending' }));
    expect(await screen.findByRole('button', { name: /enviar campaña/i })).toBeInTheDocument();
  });
});

describe('CD-4: status running', () => {
  it('NO monta SendCampaignButton', async () => {
    renderDetail(makeCampaign({ status: 'running' }));
    await screen.findByText('Recordatorio julio');
    expect(screen.queryByRole('button', { name: /enviar campaña/i })).not.toBeInTheDocument();
  });
});

describe('CD-5: destinatarios', () => {
  it('fetchea los destinatarios (RecipientsTable)', async () => {
    renderDetail(makeCampaign());
    await waitFor(() =>
      expect(getCampaign).toHaveBeenCalledWith('camp-1', expect.objectContaining({ includeRecipients: true })),
    );
  });
});

describe('CD-6: feedback de envío persistente (FIX-3c / FIX-5)', () => {
  it('tras enviar, el banner de éxito vive en CampaignDetail y SOBREVIVE aunque el botón desaparezca (status → running)', async () => {
    let currentStatus: CampaignStatusDto = 'pending';
    vi.mocked(getCampaign).mockImplementation((_id: string, query: GetCampaignQuery = {}) =>
      Promise.resolve({
        campaign: makeCampaign({ status: currentStatus }),
        ...(query.includeRecipients ? { recipients: { data: [], total: 0, page: 1, limit: 20 } } : {}),
      } as GetCampaignOutput),
    );
    // Al enviar, el BE pasa la campaña a 'running' → SendCampaignButton se
    // desmonta (guard interno). El feedback NO puede vivir en ese botón.
    vi.mocked(sendCampaign).mockImplementation(() => {
      currentStatus = 'running';
      return Promise.resolve({ campaignId: 'camp-1', accepted: true });
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const user = userEvent.setup();
    render(<CampaignDetail campaignId="camp-1" onBack={vi.fn()} />, { wrapper });

    await user.click(await screen.findByRole('button', { name: /enviar campaña/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /sí, enviar/i }));

    // el botón de envío desaparece (status running), pero el banner persiste
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /enviar campaña/i })).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/se inició|envío.*curso|enviándose/i)).toBeInTheDocument();
  });
});
