/**
 * useWhatsapp — useSendableTemplates / useSendWhatsappTemplate
 * (inbox-template-send, design D11) — capa de datos del picker de template
 * del composer del inbox. Archivo DEDICADO (mismo criterio que
 * `useWhatsapp.send.test.ts`): reescribe/agrega el contrato de estos 2 hooks
 * nuevos sin mezclarse con el resto de la suite de `useWhatsapp.test.ts`.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type { WhatsappMessage } from '@/types/whatsapp';
import type { TemplateSummaryDto } from '@/types/messagingBulk';

vi.mock('@/api/whatsapp.api', () => ({
  listSendableTemplates: vi.fn(),
  sendWhatsappTemplate: vi.fn(),
}));

import { listSendableTemplates, sendWhatsappTemplate } from '@/api/whatsapp.api';
import {
  useSendableTemplates,
  useSendWhatsappTemplate,
  whatsappMessagesKey,
  whatsappSendTemplatesKey,
  whatsappViewCountsKey,
} from '@/hooks/useWhatsapp';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

const TEMPLATE: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: ['1', '2'],
  approvalStatus: 'approved',
  sendable: true,
  body: 'Hola {{1}}, tu saldo es {{2}}',
};

const SENT: WhatsappMessage = {
  id: 'msg-tpl-1',
  direction: 'outbound',
  content: 'Hola Juan, tu saldo es $5.000',
  senderName: 'Agente',
  sentAt: '2026-07-16T12:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSendableTemplates(enabled)', () => {
  it('fetchea con enabled:true y devuelve el catálogo', async () => {
    vi.mocked(listSendableTemplates).mockResolvedValue([TEMPLATE]);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSendableTemplates(true), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([TEMPLATE]));
    expect(listSendableTemplates).toHaveBeenCalledTimes(1);
  });

  it('NO fetchea con enabled:false (panel cerrado)', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useSendableTemplates(false), { wrapper });
    expect(listSendableTemplates).not.toHaveBeenCalled();
  });
});

describe('useSendWhatsappTemplate(id).sendTemplate — onSuccess', () => {
  it('appendea el mensaje devuelto en whatsappMessagesKey (dedup por id) e invalida la lista de conversaciones', async () => {
    vi.mocked(sendWhatsappTemplate).mockResolvedValue(SENT);
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappMessagesKey('conv-1'), []);
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSendWhatsappTemplate('conv-1'), { wrapper });

    await act(async () => {
      result.current.sendTemplate({ templateRef: 'HX123', variables: { '1': 'Juan', '2': '$5.000' }, idempotencyKey: 'uuid-1' });
      await waitFor(() => expect(sendWhatsappTemplate).toHaveBeenCalled());
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-1'))).toEqual([SENT]);
    });
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['whatsapp', 'conversations'] }));
    // inbox-views (micro-fix review): enviar un template también es una
    // respuesta saliente → saca la conversación de "Sin atender".
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: whatsappViewCountsKey }));
  });

  it('dedup: si el mensaje ya está en el cache (mismo id), no lo duplica', async () => {
    vi.mocked(sendWhatsappTemplate).mockResolvedValue(SENT);
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappMessagesKey('conv-1'), [SENT]);
    const { result } = renderHook(() => useSendWhatsappTemplate('conv-1'), { wrapper });

    await act(async () => {
      result.current.sendTemplate({ templateRef: 'HX123', variables: {}, idempotencyKey: 'uuid-2' });
      await waitFor(() => expect(sendWhatsappTemplate).toHaveBeenCalled());
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-1'))).toEqual([SENT]);
    });
  });

  it('pasa templateRef/variables/idempotencyKey tal cual a api.sendWhatsappTemplate', async () => {
    vi.mocked(sendWhatsappTemplate).mockResolvedValue(SENT);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendWhatsappTemplate('conv-1'), { wrapper });

    act(() => {
      result.current.sendTemplate({ templateRef: 'HX123', variables: { '1': 'Juan' }, idempotencyKey: 'uuid-3' });
    });

    await waitFor(() =>
      expect(sendWhatsappTemplate).toHaveBeenCalledWith('conv-1', {
        templateRef: 'HX123',
        variables: { '1': 'Juan' },
        idempotencyKey: 'uuid-3',
      }),
    );
  });

  it('opts.onSuccess (reenviado al mutate) se llama EN ADICIÓN al onSuccess propio del hook', async () => {
    vi.mocked(sendWhatsappTemplate).mockResolvedValue(SENT);
    const { wrapper } = makeWrapper();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSendWhatsappTemplate('conv-1'), { wrapper });

    act(() => {
      result.current.sendTemplate({ templateRef: 'HX123', variables: {}, idempotencyKey: 'uuid-4' }, { onSuccess });
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onSuccess.mock.calls[0]?.[0]).toEqual(SENT);
  });
});

describe('useSendWhatsappTemplate(id) — isPending scoped por convId (molde useSetConversationStatus)', () => {
  it('isPending sólo refleja un envío EN VUELO de la conversación actual del hook', async () => {
    let resolveSend!: (m: WhatsappMessage) => void;
    vi.mocked(sendWhatsappTemplate).mockImplementation(() => new Promise((r) => { resolveSend = r; }));
    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useSendWhatsappTemplate(id),
      { wrapper, initialProps: { id: 'conv-a' } },
    );

    act(() => {
      result.current.sendTemplate({ templateRef: 'HX123', variables: {}, idempotencyKey: 'uuid-5' });
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    // El usuario cambia de conversación MIENTRAS el envío de A sigue en vuelo
    // (bug CRÍTICO #1 defensa, memoria `inbox-key-por-conversacion`) — el
    // hook de la conversación B NUNCA debe reportar isPending:true por un
    // envío ajeno.
    rerender({ id: 'conv-b' });
    expect(result.current.isPending).toBe(false);

    resolveSend(SENT);
  });
});

describe('useSendWhatsappTemplate(id) — bug crítico #1 defensa: keys derivadas de vars.convId, NUNCA del closure `id`', () => {
  it('si conversationId cambia MIENTRAS el envío está en vuelo, el mensaje se appendea en el slice de la conversación ORIGINAL', async () => {
    let resolveSend!: (m: WhatsappMessage) => void;
    vi.mocked(sendWhatsappTemplate).mockImplementation(() => new Promise((r) => { resolveSend = r; }));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappMessagesKey('conv-a'), []);
    qc.setQueryData(whatsappMessagesKey('conv-b'), []);
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useSendWhatsappTemplate(id),
      { wrapper, initialProps: { id: 'conv-a' } },
    );

    act(() => {
      result.current.sendTemplate({ templateRef: 'HX123', variables: {}, idempotencyKey: 'uuid-6' });
    });
    await waitFor(() => expect(sendWhatsappTemplate).toHaveBeenCalled());

    rerender({ id: 'conv-b' });

    await act(async () => {
      resolveSend(SENT);
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-a'))).toEqual([SENT]);
    });
    expect(qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-b'))).toEqual([]);
  });
});

describe('whatsappSendTemplatesKey', () => {
  it('es una key estable ["whatsapp","sendTemplates"]', () => {
    expect(whatsappSendTemplatesKey).toEqual(['whatsapp', 'sendTemplates']);
  });
});
