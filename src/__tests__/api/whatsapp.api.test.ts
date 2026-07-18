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
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import {
  listWhatsappConversations,
  getWhatsappConversation,
  listWhatsappMessages,
  sendWhatsappMessage,
  getInboxClientContext,
  setConversationStatus,
  setConversationAssignee,
  setConversationArea,
  getAssignableUsers,
  getMessagingAreas,
  editWhatsappNote,
  deleteWhatsappNote,
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

describe('WAPI-9 (messaging-inbox-assignment F1.5-C2): listWhatsappConversations con assignment', () => {
  it('con assignment:"mine" manda params.assignment="mine"', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ assignment: 'mine' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { assignment: 'mine' },
    });
  });

  it('con assignment:"unassigned" manda params.assignment="unassigned"', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ assignment: 'unassigned' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { assignment: 'unassigned' },
    });
  });

  it('combina assignment con page/limit', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ assignment: 'all', page: 2, limit: 20 });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { assignment: 'all', page: 2, limit: 20 },
    });
  });
});

describe('WAPI-14 (messaging-bulk-inbox Change 2): listWhatsappConversations con campaignId', () => {
  it('con campaignId manda params.campaignId (filtro server-side por campaña)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ campaignId: 'camp-1' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { campaignId: 'camp-1' },
    });
  });

  it('combina campaignId con assignment y page/limit', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ campaignId: 'camp-1', assignment: 'mine', page: 2, limit: 20 });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { campaignId: 'camp-1', assignment: 'mine', page: 2, limit: 20 },
    });
  });

  it('sin campaignId no manda el param (cero regresión, mismo criterio que assignment)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ assignment: 'mine' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { assignment: 'mine' },
    });
  });
});

describe('API-1 (inbox-resolve): listWhatsappConversations con status', () => {
  it('con status:"open" manda params.status="open"', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ status: 'open' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { status: 'open' },
    });
  });

  it('con status:"resolved" manda params.status="resolved"', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ status: 'resolved' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { status: 'resolved' },
    });
  });

  it('sin status no manda el param (mismo criterio que assignment/campaignId)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({});

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', { params: {} });
  });

  it('combina status con assignment y campaignId', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGINATED });

    await listWhatsappConversations({ status: 'open', assignment: 'mine', campaignId: 'camp-1' });

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/conversations', {
      params: { status: 'open', assignment: 'mine', campaignId: 'camp-1' },
    });
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

describe('WAPI-7: sendWhatsappMessage con private (messaging-inbox-notes F1.5 fase D — NOTA PRIVADA)', () => {
  it('con private:true (JSON, sin files) → el body incluye {content, private:true}', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: MESSAGE });

    await sendWhatsappMessage('conv-1', { content: 'nota interna', private: true });

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/conversations/conv-1/messages', {
      content: 'nota interna',
      private: true,
    });
  });

  it('sin private (ausente) → el body NO trae el campo private (cero regresión, toEqual ignora undefined)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: MESSAGE });

    await sendWhatsappMessage('conv-1', { content: 'hola' });

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/conversations/conv-1/messages', {
      content: 'hola',
    });
  });

  it('con private:false explícito → tampoco aparece un private:true engañoso (mismo criterio, JSON queda {content, private:false})', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: MESSAGE });

    await sendWhatsappMessage('conv-1', { content: 'hola', private: false });

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/conversations/conv-1/messages', {
      content: 'hola',
      private: false,
    });
  });

  it('con files + private:true → el multipart agrega form.append("private","true")', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: MESSAGE });
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

    await sendWhatsappMessage('conv-1', { content: 'mirá esto', files: [file], private: true });

    const [, body] = vi.mocked(axiosClient.post).mock.calls[0] as [string, FormData];
    expect(body.get('private')).toBe('true');
  });

  it('con files sin private (ausente) → el multipart NO trae el campo private', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: MESSAGE });
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

    await sendWhatsappMessage('conv-1', { content: 'mirá esto', files: [file] });

    const [, body] = vi.mocked(axiosClient.post).mock.calls[0] as [string, FormData];
    expect(body.has('private')).toBe(false);
  });

  it('con files + private:false explícito → el multipart tampoco agrega el campo (solo se manda cuando es true)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: MESSAGE });
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

    await sendWhatsappMessage('conv-1', { content: 'mirá esto', files: [file], private: false });

    const [, body] = vi.mocked(axiosClient.post).mock.calls[0] as [string, FormData];
    expect(body.has('private')).toBe(false);
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

describe('WAPI-8: setConversationStatus (messaging-inbox-productivity F1.5-C v1 — RESOLVER/REABRIR)', () => {
  // hallazgo MEDIUM #4 (review adversarial): el BE devuelve el shape de
  // LISTA (`WhatsappConversationListItem`), NO el de detalle — SIN
  // `canReply`/`clientContext` (ver la nota de `setConversationStatus`,
  // `whatsapp.api.ts`). Antes este fixture hormaba `RESOLVED_DETAIL` con
  // esos campos, horneando un contrato que el BE real nunca cumple.
  const RESOLVED_LIST_ITEM: WhatsappConversationListItem = { ...LIST_ITEM, status: 'resolved' };

  it('POSTea /messaging/conversations/:id/status con {status} y devuelve la conversación actualizada (shape de LISTA)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: RESOLVED_LIST_ITEM });

    const result = await setConversationStatus('conv-1', 'resolved');

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/conversations/conv-1/status', { status: 'resolved' });
    expect(result).toEqual(RESOLVED_LIST_ITEM);
    // Honestidad del contrato: sin canReply/clientContext (exclusivos del detalle).
    expect('canReply' in (result as object)).toBe(false);
    expect('clientContext' in (result as object)).toBe(false);
  });

  it('acepta status "open" (reabrir)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: LIST_ITEM });

    await setConversationStatus('conv-1', 'open');

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/conversations/conv-1/status', { status: 'open' });
  });

  it('acepta status "pending" (el tipo lo contempla aunque v1 no lo dispare desde la UI)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: { ...LIST_ITEM, status: 'pending' } });

    await setConversationStatus('conv-1', 'pending');

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/conversations/conv-1/status', { status: 'pending' });
  });

  it('cada llamada postea SOLO {status} en el body (sin 3er argumento de config extra)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: RESOLVED_LIST_ITEM });

    await setConversationStatus('conv-1', 'resolved');

    expect((vi.mocked(axiosClient.post).mock.calls[0] as unknown[]).length).toBe(2);
  });
});

describe('WAPI-10 (messaging-inbox-assignment F1.5-C2): setConversationAssignee', () => {
  const ASSIGNED_LIST_ITEM: WhatsappConversationListItem = { ...LIST_ITEM, assignee: { id: 'u1', name: 'Ana Torres' } };

  it('PATCHea /messaging/conversations/:id/assignee con {assigneeId} y devuelve la conversación actualizada', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: ASSIGNED_LIST_ITEM });

    const result = await setConversationAssignee('conv-1', 'u1');

    expect(axiosClient.patch).toHaveBeenCalledWith('/messaging/conversations/conv-1/assignee', { assigneeId: 'u1' });
    expect(result).toEqual(ASSIGNED_LIST_ITEM);
  });

  it('assigneeId:null desasigna', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: LIST_ITEM });

    await setConversationAssignee('conv-1', null);

    expect(axiosClient.patch).toHaveBeenCalledWith('/messaging/conversations/conv-1/assignee', { assigneeId: null });
  });
});

describe('WAPI-11 (messaging-inbox-assignment F1.5-C2): setConversationArea', () => {
  const AREA_LIST_ITEM: WhatsappConversationListItem = { ...LIST_ITEM, area: { id: 'a1', name: 'Soporte', color: '#2563eb' } };

  it('PATCHea /messaging/conversations/:id/area con {areaId} y devuelve la conversación actualizada', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: AREA_LIST_ITEM });

    const result = await setConversationArea('conv-1', 'a1');

    expect(axiosClient.patch).toHaveBeenCalledWith('/messaging/conversations/conv-1/area', { areaId: 'a1' });
    expect(result).toEqual(AREA_LIST_ITEM);
  });

  it('areaId:null quita el área', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: LIST_ITEM });

    await setConversationArea('conv-1', null);

    expect(axiosClient.patch).toHaveBeenCalledWith('/messaging/conversations/conv-1/area', { areaId: null });
  });
});

describe('WAPI-12 (messaging-inbox-assignment F1.5-C2): getAssignableUsers', () => {
  it('GETs /messaging/assignable-users y devuelve el array plano', async () => {
    const USERS = [{ id: 'u1', name: 'Ana Torres' }, { id: 'u2', name: 'Beto Diaz' }];
    // el BE envuelve en { data } (res.json({ data })) — el shape HTTP real, no un array plano
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { data: USERS } });

    const result = await getAssignableUsers();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/assignable-users');
    expect(result).toEqual(USERS);
  });
});

describe('WAPI-13 (messaging-inbox-assignment F1.5-C2): getMessagingAreas', () => {
  it('GETs /messaging/areas y devuelve el array plano (catálogo compartido con tickets)', async () => {
    const AREAS = [{ id: 'a1', name: 'Soporte', color: '#2563eb' }, { id: 'a2', name: 'Ventas', color: '#f59e0b' }];
    // el BE envuelve en { data } (res.json({ data })) — el shape HTTP real, no un array plano
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { data: AREAS } });

    const result = await getMessagingAreas();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/areas');
    expect(result).toEqual(AREAS);
  });
});

describe('WAPI-15 (internal-notes F1.5): editWhatsappNote', () => {
  const EDITED: WhatsappMessage = { ...MESSAGE, private: true, content: 'nota corregida', edited: true };

  it('PATCHea /messaging/conversations/:id/messages/:messageId con {content} y devuelve la nota editada FLAT', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: EDITED });

    const result = await editWhatsappNote('conv-1', 'msg-1', 'nota corregida');

    expect(axiosClient.patch).toHaveBeenCalledWith('/messaging/conversations/conv-1/messages/msg-1', {
      content: 'nota corregida',
    });
    expect(result).toEqual(EDITED);
    // Honestidad del contrato: flat, sin envelope.
    expect('data' in (result as object)).toBe(false);
  });

  it('postea SOLO {content} (sin 3er argumento de config extra)', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: EDITED });

    await editWhatsappNote('conv-1', 'msg-1', 'x');

    expect((vi.mocked(axiosClient.patch).mock.calls[0] as unknown[]).length).toBe(2);
  });
});

describe('WAPI-16 (internal-notes F1.5): deleteWhatsappNote', () => {
  // TOMBSTONE: el BE devuelve la nota con deleted:true + content:"" (la fila
  // sigue en el hilo, no desaparece).
  const TOMBSTONE: WhatsappMessage = { ...MESSAGE, private: true, content: '', deleted: true };

  it('DELETEa /messaging/conversations/:id/messages/:messageId y devuelve el tombstone (deleted:true)', async () => {
    vi.mocked(axiosClient.delete).mockResolvedValue({ data: TOMBSTONE });

    const result = await deleteWhatsappNote('conv-1', 'msg-1');

    expect(axiosClient.delete).toHaveBeenCalledWith('/messaging/conversations/conv-1/messages/msg-1');
    expect(result).toEqual(TOMBSTONE);
    expect(result.deleted).toBe(true);
    expect(result.content).toBe('');
  });
});
