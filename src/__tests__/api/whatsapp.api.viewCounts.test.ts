/**
 * whatsapp.api — inbox-views Ola 1: wire contract de los contadores por vista
 * + param `view` del listado. Archivo DEDICADO (mismo criterio que
 * `whatsapp.api.templateSend.test.ts`: no inflar `whatsapp.api.test.ts`).
 * Contrato verificado contra el código REAL del BE (worktree inbox-views-be,
 * `messaging.routes.ts` + `application/dto/messaging.ts`):
 *
 *  WAPI-11 getInboxViewCounts: GET /messaging/conversations/counts, responde
 *          el DTO FLAT (`res.json(result)` — SIN envelope `{data}`, a
 *          diferencia de los catálogos): `{mine,unattended,all,unassigned,
 *          resolved}` (`InboxViewCountsDto`).
 *  WAPI-12 listWhatsappConversations con `view:'unattended'` manda
 *          `params.view='unattended'`; ausente NO manda el param (mismo
 *          criterio que assignment/campaignId/status). `view` es ortogonal a
 *          `assignment` (AND válido en el BE).
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { WhatsappConversationListItem, WhatsappInboxViewCounts, WhatsappPaginatedResult } from '@/types/whatsapp';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { getInboxViewCounts, listWhatsappConversations } from '@/api/whatsapp.api';

const COUNTS: WhatsappInboxViewCounts = {
  mine: 4,
  unattended: 7,
  all: 23,
  unassigned: 5,
  resolved: 118,
};

const PAGINATED: WhatsappPaginatedResult<WhatsappConversationListItem> = {
  data: [],
  total: 0,
  page: 1,
  limit: 20,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WAPI-11: getInboxViewCounts', () => {
  it('GETs /messaging/conversations/counts y devuelve el DTO FLAT (sin envelope)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: COUNTS });

    const result = await getInboxViewCounts();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations/counts');
    expect(result).toEqual(COUNTS);
  });
});

describe('WAPI-12: listWhatsappConversations con view', () => {
  it('con view:"unattended" manda params.view="unattended"', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ view: 'unattended' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { view: 'unattended' },
    });
  });

  it('view es ORTOGONAL a assignment — ambos viajan juntos (AND válido en el BE)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ view: 'unattended', assignment: 'mine' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { view: 'unattended', assignment: 'mine' },
    });
  });

  it('sin view NO manda el param (cero regresión del wire existente)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ status: 'open' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { status: 'open' },
    });
  });
});
