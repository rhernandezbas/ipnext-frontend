/**
 * messagingBulk.api — wire contract del router `/api/messaging/bulk` (F2,
 * apply chunk 1). Contrato verificado contra el código REAL del BE (no el
 * boceto de design.md): `ipnext-backend/src/infrastructure/http/routes/
 * messagingBulk.routes.ts` + los use-cases `application/use-cases/messaging/*`.
 *
 * OJO envelope ASIMETRICO por endpoint:
 *  MBAPI-1 listBulkTemplates: GET /messaging/bulk/templates → `res.json({data})`
 *          → UNWRAP `.data.data`
 *  MBAPI-2 previewSegment: POST /messaging/bulk/segment/preview con el body
 *          del segmento → `res.json(result)` → FLAT (sin envelope)
 *  MBAPI-3 createCampaign: POST /messaging/bulk/campaigns con el input →
 *          `res.status(201).json(result)` → FLAT
 *  MBAPI-4 sendCampaign: POST /messaging/bulk/campaigns/:id/send (sin body) →
 *          `res.status(202).json({campaignId,accepted:true})` → FLAT
 *  MBAPI-5 getCampaign: GET /messaging/bulk/campaigns/:id con
 *          includeRecipients/page/limit/status en query → `res.json(result)`
 *          → FLAT ({campaign, recipients?})
 *  MBAPI-6 listCampaigns: GET /messaging/bulk/campaigns con page/limit →
 *          `res.json(result)` → FLAT (PaginatedResult<CampaignSummaryDto>)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type {
  CampaignDto,
  CampaignSummaryDto,
  CreateCampaignInput,
  CreateCampaignOutput,
  GetCampaignOutput,
  PaginatedResult,
  PreviewSegmentOutput,
  SendCampaignOutput,
  TemplateSummaryDto,
} from '@/types/messagingBulk';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import {
  listBulkTemplates,
  previewSegment,
  createCampaign,
  sendCampaign,
  getCampaign,
  listCampaigns,
} from '@/api/messagingBulk.api';

const TEMPLATE: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: ['1', '2'],
  approvalStatus: 'approved',
  category: 'UTILITY',
  sendable: true,
};

const PREVIEW: PreviewSegmentOutput = {
  count: 42,
  sample: [{ clientId: 'cli-1', name: 'Juan Perez', phoneE164: '+5491100000000' }],
  skipped: { optedOut: 1, duplicatePhone: 2, invalidPhone: 3 },
};

const CREATE_OUTPUT: CreateCampaignOutput = { campaignId: 'camp-1', total: 42, status: 'pending' };

const SEND_OUTPUT: SendCampaignOutput = { campaignId: 'camp-1', accepted: true };

const CAMPAIGN_DTO: CampaignDto = {
  id: 'camp-1',
  name: 'Recordatorio julio',
  templateName: 'Recordatorio de pago',
  status: 'running',
  total: 42,
  sentCount: 10,
  failedCount: 0,
  skippedCount: 0,
  optedOutCount: 0,
  createdAt: '2026-07-01T12:00:00.000Z',
  startedAt: '2026-07-01T12:05:00.000Z',
  finishedAt: null,
  templateRef: 'HX123',
  segment: { statuses: ['late'] },
};

const GET_CAMPAIGN_OUTPUT: GetCampaignOutput = { campaign: CAMPAIGN_DTO };

const CAMPAIGN_SUMMARY: CampaignSummaryDto = {
  id: 'camp-1',
  name: 'Recordatorio julio',
  templateName: 'Recordatorio de pago',
  status: 'done',
  total: 42,
  sentCount: 42,
  failedCount: 0,
  skippedCount: 0,
  optedOutCount: 0,
  createdAt: '2026-07-01T12:00:00.000Z',
  startedAt: '2026-07-01T12:05:00.000Z',
  finishedAt: '2026-07-01T12:10:00.000Z',
};

const CAMPAIGNS_PAGE: PaginatedResult<CampaignSummaryDto> = {
  data: [CAMPAIGN_SUMMARY],
  total: 1,
  page: 1,
  limit: 20,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MBAPI-1: listBulkTemplates', () => {
  it('GETs /messaging/bulk/templates y unwrappea {data} al array pelado', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { data: [TEMPLATE] } });

    const result = await listBulkTemplates();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/bulk/templates');
    expect(result).toEqual([TEMPLATE]);
  });
});

describe('MBAPI-2: previewSegment', () => {
  it('POSTea /messaging/bulk/segment/preview con el segmento y devuelve el resultado FLAT (sin envelope)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: PREVIEW });

    const result = await previewSegment({ statuses: ['late', 'blocked'], balanceMin: 1000 });

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/bulk/segment/preview', {
      statuses: ['late', 'blocked'],
      balanceMin: 1000,
    });
    expect(result).toEqual(PREVIEW);
    // Honestidad del contrato: NO viene envuelto en {data}.
    expect('data' in (result as object)).toBe(false);
  });
});

describe('MBAPI-3: createCampaign', () => {
  it('POSTea /messaging/bulk/campaigns con el input y devuelve el resultado FLAT (201)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: CREATE_OUTPUT });

    const input: CreateCampaignInput = {
      name: 'Recordatorio julio',
      templateRef: 'HX123',
      segment: { statuses: ['late'] },
      variablesMap: { '1': { source: 'name' }, '2': { source: 'balanceDue' } },
    };

    const result = await createCampaign(input);

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/bulk/campaigns', input);
    expect(result).toEqual(CREATE_OUTPUT);
  });
});

describe('MBAPI-4: sendCampaign', () => {
  it('POSTea /messaging/bulk/campaigns/:id/send sin body y devuelve el resultado FLAT (202)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: SEND_OUTPUT });

    const result = await sendCampaign('camp-1');

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/bulk/campaigns/camp-1/send');
    expect(result).toEqual(SEND_OUTPUT);
  });
});

describe('MBAPI-5: getCampaign', () => {
  it('sin query no manda params vacíos', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: GET_CAMPAIGN_OUTPUT });

    const result = await getCampaign('camp-1');

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/bulk/campaigns/camp-1', { params: {} });
    expect(result).toEqual(GET_CAMPAIGN_OUTPUT);
    // Honestidad del contrato: FLAT, sin envelope.
    expect('data' in (result as object)).toBe(false);
  });

  it('con includeRecipients/page/limit/status arma los params de query', async () => {
    const withRecipients: GetCampaignOutput = {
      campaign: CAMPAIGN_DTO,
      recipients: { data: [], total: 0, page: 1, limit: 20 },
    };
    vi.mocked(axiosClient.get).mockResolvedValue({ data: withRecipients });

    const result = await getCampaign('camp-1', { includeRecipients: true, page: 1, limit: 20, status: 'sent' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/bulk/campaigns/camp-1', {
      params: { includeRecipients: 'true', page: 1, limit: 20, status: 'sent' },
    });
    expect(result).toEqual(withRecipients);
  });

  it('MBAPI-5b (hallazgo): status "opted-out" (DTO, con guion) se traduce a "opted_out" (dominio) en el query param', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: GET_CAMPAIGN_OUTPUT });

    await getCampaign('camp-1', { status: 'opted-out' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/bulk/campaigns/camp-1', {
      params: { status: 'opted_out' },
    });
  });

  it.each(['queued', 'sent', 'delivered', 'skipped', 'failed'])(
    'MBAPI-5c: status "%s" NO difiere entre DTO y dominio — se manda tal cual',
    async (status) => {
      vi.mocked(axiosClient.get).mockResolvedValue({ data: GET_CAMPAIGN_OUTPUT });

      await getCampaign('camp-1', { status });

      expect(axiosClient.get).toHaveBeenCalledWith('/messaging/bulk/campaigns/camp-1', {
        params: { status },
      });
    },
  );
});

describe('MBAPI-6: listCampaigns', () => {
  it('sin query no manda params vacíos', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: CAMPAIGNS_PAGE });

    const result = await listCampaigns();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/bulk/campaigns', { params: {} });
    expect(result).toEqual(CAMPAIGNS_PAGE);
  });

  it('con page/limit arma los params de query', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: CAMPAIGNS_PAGE });

    await listCampaigns({ page: 2, limit: 10 });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/bulk/campaigns', {
      params: { page: 2, limit: 10 },
    });
  });
});
