/**
 * whatsapp.api — wire contract del router `/api/messaging` (messaging-inbox F1,
 * design §4). Contrato verificado contra el código REAL del BE (no el boceto):
 * `ipnext-backend/src/infrastructure/http/routes/messaging.routes.ts` +
 * `application/use-cases/messaging/*`.
 *
 *  WAPI-1 listWhatsappConversations: GET /messaging/conversations con
 *         page/limit, devuelve el envelope paginado tal cual (`{data,total,
 *         page,limit}` — NO un array plano)
 *  WAPI-2 listWhatsappConversations sin query no manda params vacíos
 *  WAPI-3 getWhatsappConversation: GET /messaging/conversations/:id, devuelve
 *         el detalle FLAT (sin envelope — `GetConversation.execute` responde
 *         el DTO directo)
 *  WAPI-4 listWhatsappMessages: GET /messaging/conversations/:id/messages,
 *         UNWRAP de `{data}` → devuelve el array de mensajes pelado (la ruta
 *         responde `res.json({data})`)
 *  WAPI-5 sendWhatsappMessage: POST /messaging/conversations/:id/messages con
 *         `{content}`, devuelve el mensaje creado FLAT (201, sin envelope)
 *  WAPI-6 getInboxClientContext (messaging-inbox-v2 F1.5, tasks F1): GET
 *         /messaging/conversations/:id/client-context, `clientId` en params
 *         SOLO si viene, `refresh=1` en params SOLO si `opts.refreshBalance`
 *         (nombre de wire `refresh`, verificado contra B4 real:
 *         `const {clientId, refresh} = req.query`), devuelve el DTO FLAT
 *         (sin envelope, igual que getWhatsappConversation)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type {
  WhatsappConversationDetail,
  WhatsappConversationListItem,
  WhatsappInboxClientContext,
  WhatsappMessage,
  WhatsappPaginatedResult,
} from '@/types/whatsapp';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import {
  listWhatsappConversations,
  getWhatsappConversation,
  listWhatsappMessages,
  sendWhatsappMessage,
  getInboxClientContext,
} from '@/api/whatsapp.api';

const LIST_ITEM: WhatsappConversationListItem = {
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-10T12:00:00.000Z',
  preview: 'hola, tengo un problema',
  status: 'open',
};

const PAGINATED: WhatsappPaginatedResult<WhatsappConversationListItem> = {
  data: [LIST_ITEM],
  total: 1,
  page: 1,
  limit: 20,
};

const DETAIL: WhatsappConversationDetail = {
  ...LIST_ITEM,
  canReply: true,
  clientContext: { status: 'matched', clients: [{ id: 'cli-1', name: 'Juan Perez', status: 'active' }] },
};

const MESSAGE: WhatsappMessage = {
  id: 'msg-1',
  direction: 'inbound',
  content: 'hola, tengo un problema',
  senderName: 'Juan Perez',
  sentAt: '2026-07-10T12:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WAPI-1/2: listWhatsappConversations', () => {
  it('GETs /messaging/conversations con page/limit y devuelve el envelope paginado', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    const result = await listWhatsappConversations({ page: 2, limit: 20 });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { page: 2, limit: 20 },
    });
    expect(result).toEqual(PAGINATED);
  });

  it('sin query no manda params vacíos', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', { params: {} });
  });
});

describe('WAPI-3: getWhatsappConversation', () => {
  it('GETs /messaging/conversations/:id y devuelve el detalle flat (sin envelope)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: DETAIL });

    const result = await getWhatsappConversation('conv-1');

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations/conv-1');
    expect(result).toEqual(DETAIL);
    // Honestidad del contrato: el detalle NO viene envuelto en {data}.
    expect('data' in (result as object)).toBe(false);
  });
});

describe('WAPI-4: listWhatsappMessages', () => {
  it('GETs /messaging/conversations/:id/messages y unwrappea {data} al array pelado', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { data: [MESSAGE] } });

    const result = await listWhatsappMessages('conv-1');

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations/conv-1/messages');
    expect(result).toEqual([MESSAGE]);
  });

  it('unwrappea también cuando la conversación no tiene mensajes (array vacío real)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { data: [] } });

    const result = await listWhatsappMessages('conv-empty');

    expect(result).toEqual([]);
  });
});

describe('WAPI-5: sendWhatsappMessage', () => {
  it('sin files → POSTea {content} JSON idéntico a hoy (cero regresión, messaging-inbox-v2-media Tanda 2)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: MESSAGE });

    const result = await sendWhatsappMessage('conv-1', { content: 'hola, tengo un problema' });

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/conversations/conv-1/messages', {
      content: 'hola, tengo un problema',
    });
    // Cero regresión: NO se manda un 3er argumento de config (sin headers multipart).
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    expect((vi.mocked(axiosClient.post).mock.calls[0] as unknown[]).length).toBe(2);
    expect(result).toEqual(MESSAGE);
  });

  it('con files → POSTea FormData multipart (field "attachments") + onUploadProgress reporta loaded/total', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: MESSAGE });
    const onUploadProgress = vi.fn();
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

    const result = await sendWhatsappMessage('conv-1', { content: 'mirá esto', files: [file], onUploadProgress });

    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(axiosClient.post).mock.calls[0] as [string, FormData, { headers: Record<string, string>; onUploadProgress: (e: { loaded: number; total: number }) => void }];
    expect(url).toBe('/messaging/conversations/conv-1/messages');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('content')).toBe('mirá esto');
    expect(body.get('attachments')).toBe(file);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');

    config.onUploadProgress({ loaded: 50, total: 100 });
    expect(onUploadProgress).toHaveBeenCalledWith(0.5);
    expect(result).toEqual(MESSAGE);
  });

  it('con múltiples files, cada uno se agrega como una parte "attachments" separada', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: MESSAGE });
    const file1 = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const file2 = new File(['b'], 'b.pdf', { type: 'application/pdf' });

    await sendWhatsappMessage('conv-1', { content: '', files: [file1, file2] });

    const [, body] = vi.mocked(axiosClient.post).mock.calls[0] as [string, FormData];
    expect(body.getAll('attachments')).toEqual([file1, file2]);
  });
});

describe('WAPI-6: getInboxClientContext', () => {
  const RICH: WhatsappInboxClientContext = {
    status: 'matched',
    client: {
      id: 'cli-1',
      name: 'Juan Perez',
      email: null,
      phone: null,
      status: 'active',
      fichaClientId: 'cli-1',
      balance: { due: 1000, currency: 'ARS', isDebtor: true, stale: true, lastRefreshedAt: null },
      lastInvoice: null,
      nextDueDate: null,
      contracts: [],
      openTicketsCount: 0,
      recentTickets: [],
      recentTasks: [],
      recentLogs: [],
    },
  };

  it('GETs /messaging/conversations/:id/client-context sin clientId/opts no manda params', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: RICH });

    const result = await getInboxClientContext('conv-1');

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations/conv-1/client-context', {
      params: {},
    });
    expect(result).toEqual(RICH);
    // Honestidad del contrato: flat, sin envelope.
    expect('data' in (result as object)).toBe(false);
  });

  it('con clientId arma params.clientId (desambiguación de ambiguous)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: RICH });

    await getInboxClientContext('conv-1', 'cli-1');

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations/conv-1/client-context', {
      params: { clientId: 'cli-1' },
    });
  });

  it('con opts.refreshBalance manda params.refresh="1" (nombre de wire real, RICH-4)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: RICH });

    await getInboxClientContext('conv-1', undefined, { refreshBalance: true });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations/conv-1/client-context', {
      params: { refresh: '1' },
    });
  });

  it('con clientId + opts.refreshBalance combina ambos params', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: RICH });

    await getInboxClientContext('conv-1', 'cli-1', { refreshBalance: true });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations/conv-1/client-context', {
      params: { clientId: 'cli-1', refresh: '1' },
    });
  });
});
