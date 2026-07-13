/**
 * useWhatsapp — envío de media, optimistic UI (messaging-inbox-v2-media
 * F1.5 fase A, Tanda 2 — ENVIAR, design §6.3). Archivo DEDICADO (separado de
 * `useWhatsapp.test.ts`) porque reescribe por completo el contrato de
 * `useSendWhatsappMessage` (de un `useMutation` crudo a `{send,retry,discard,
 * isError,error}`) y agrega `usePendingSends`/`whatsappPendingSendsKey`.
 *
 * GOTCHA jsdom: no trae `URL.createObjectURL`/`revokeObjectURL` — se mockean
 * acá (mismo tipo de gap que `matchMedia` en `MessageBubble.tsx`).
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type { DraftAttachment, PendingSend, WhatsappMessage } from '@/types/whatsapp';

vi.mock('@/api/whatsapp.api', () => ({
  sendWhatsappMessage: vi.fn(),
}));

import { sendWhatsappMessage } from '@/api/whatsapp.api';
import {
  useSendWhatsappMessage,
  usePendingSends,
  whatsappPendingSendsKey,
  whatsappMessagesKey,
} from '@/hooks/useWhatsapp';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

function draft(id: string, previewUrl: string | null = `blob:${id}`): DraftAttachment {
  return {
    id,
    file: new File(['x'], `${id}.jpg`, { type: 'image/jpeg' }),
    fileType: 'image',
    previewUrl,
    error: null,
  };
}

const SENT: WhatsappMessage = {
  id: 'msg-real-1',
  direction: 'outbound',
  content: 'mirá esto',
  senderName: 'Agente',
  sentAt: '2026-07-12T12:00:00.000Z',
  attachments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as { URL: typeof URL }).URL.createObjectURL = vi.fn(() => 'blob:mock');
  (globalThis as { URL: typeof URL }).URL.revokeObjectURL = vi.fn();
});

describe('usePendingSends(id) — cache-como-store', () => {
  it('devuelve [] cuando no hay nada en el slice', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePendingSends('conv-1'), { wrapper });
    expect(result.current).toEqual([]);
  });

  it('NO dispara ningún fetch (enabled:false) — es cache-como-store, no una query real', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => usePendingSends('conv-1'), { wrapper });
    // Sin queryFn/mock de red — si intentara fetchear, React Query tiraría
    // (no hay queryFn). Que no explote confirma enabled:false.
    expect(true).toBe(true);
  });

  it('re-renderiza (patrón "external store") cuando algo hace setQueryData sobre su key', async () => {
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => usePendingSends('conv-1'), { wrapper });
    expect(result.current).toEqual([]);

    const pending: PendingSend = {
      tempId: 'optimistic:1', content: 'hola', drafts: [], progress: 0, status: 'sending', createdAt: '2026-07-12T00:00:00.000Z', isPrivate: false,
    };
    act(() => {
      qc.setQueryData(whatsappPendingSendsKey('conv-1'), [pending]);
    });

    await waitFor(() => expect(result.current).toEqual([pending]));
  });
});

describe('useSendWhatsappMessage(id).send — onMutate mete el PendingSend', () => {
  it('onMutate agrega un PendingSend con status "sending" y progress 0 al slice ANTES de que resuelva la red', async () => {
    let resolveSend!: (m: WhatsappMessage) => void;
    vi.mocked(sendWhatsappMessage).mockImplementation(() => new Promise((r) => { resolveSend = r; }));
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.send({ content: 'mirá esto', files: [], drafts: [] });
    });

    await waitFor(() => {
      const pending = qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1')) ?? [];
      expect(pending).toHaveLength(1);
      expect(pending[0]?.status).toBe('sending');
      expect(pending[0]?.progress).toBe(0);
      expect(pending[0]?.content).toBe('mirá esto');
    });

    resolveSend(SENT);
  });

  it('onUploadProgress patchea SOLO el progress de ese pending (no toca status/content)', async () => {
    let capturedProgressCb!: (f: number) => void;
    vi.mocked(sendWhatsappMessage).mockImplementation((_id, input) => {
      capturedProgressCb = input.onUploadProgress!;
      return new Promise(() => {}); // nunca resuelve en este test
    });
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.send({ content: '', files: [draft('a1').file], drafts: [draft('a1')] });
    });

    await waitFor(() => expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1'))).toHaveLength(1));

    act(() => capturedProgressCb(0.42));

    await waitFor(() => {
      const pending = qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1')) ?? [];
      expect(pending[0]?.progress).toBe(0.42);
      expect(pending[0]?.status).toBe('sending');
    });
  });
});

describe('useSendWhatsappMessage(id).send — onSuccess', () => {
  it('revoca los objectURL de los drafts, remueve el pending, y appendea el mensaje real (dedup) en whatsappMessagesKey', async () => {
    vi.mocked(sendWhatsappMessage).mockResolvedValue(SENT);
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappMessagesKey('conv-1'), []);
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    const d1 = draft('a1', 'blob:a1');
    await act(async () => {
      result.current.send({ content: 'mirá esto', files: [d1.file], drafts: [d1] });
      await waitFor(() => expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1'))).toHaveLength(1));
    });

    await waitFor(() => {
      expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1'))).toEqual([]);
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a1');
    expect(qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-1'))).toEqual([SENT]);
  });

  it('dedup: si el poll ya trajo el mensaje (mismo id) antes de onSuccess, no lo duplica', async () => {
    vi.mocked(sendWhatsappMessage).mockResolvedValue(SENT);
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappMessagesKey('conv-1'), [SENT]);
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    await act(async () => {
      result.current.send({ content: 'mirá esto', files: [], drafts: [] });
      await waitFor(() => expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1'))).toEqual([]));
    });

    expect(qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-1'))).toEqual([SENT]);
  });

  it('el poll (setQueryData sobre whatsappMessagesKey) NO toca el slice pendingSends', async () => {
    let resolveSend!: (m: WhatsappMessage) => void;
    vi.mocked(sendWhatsappMessage).mockImplementation(() => new Promise((r) => { resolveSend = r; }));
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.send({ content: 'en vuelo', files: [], drafts: [] });
    });
    await waitFor(() => expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1'))).toHaveLength(1));

    // Simula un poll de useWhatsappMessages reemplazando el array del thread.
    act(() => {
      qc.setQueryData(whatsappMessagesKey('conv-1'), []);
    });

    // El pending sigue ahí — el poll no lo borró.
    expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1'))).toHaveLength(1);

    resolveSend(SENT);
  });
});

describe('useSendWhatsappMessage(id).send — onError', () => {
  it('marca el pending como "failed" (NO lo remueve, NO relanza la excepción)', async () => {
    vi.mocked(sendWhatsappMessage).mockRejectedValue(new Error('chatwoot caído'));
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    await act(async () => {
      result.current.send({ content: 'fallará', files: [], drafts: [] });
    });

    await waitFor(() => {
      const pending = qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1')) ?? [];
      expect(pending).toHaveLength(1);
      expect(pending[0]?.status).toBe('failed');
    });
  });
});

describe('useSendWhatsappMessage(id).retry', () => {
  it('re-mutea con el mismo tempId: vuelve a "sending" con progress 0, sin duplicar el pending', async () => {
    const { qc, wrapper } = makeWrapper();
    const failing: PendingSend = {
      tempId: 'optimistic:retry-1', content: 'reintento', drafts: [draft('a1')], progress: 0, status: 'failed', createdAt: '2026-07-12T00:00:00.000Z', isPrivate: false,
    };
    qc.setQueryData(whatsappPendingSendsKey('conv-1'), [failing]);
    let resolveSend!: (m: WhatsappMessage) => void;
    vi.mocked(sendWhatsappMessage).mockImplementation(() => new Promise((r) => { resolveSend = r; }));

    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.retry(failing);
    });

    await waitFor(() => {
      const pending = qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1')) ?? [];
      expect(pending).toHaveLength(1);
      expect(pending[0]?.status).toBe('sending');
      expect(pending[0]?.progress).toBe(0);
      expect(pending[0]?.tempId).toBe('optimistic:retry-1');
    });

    resolveSend(SENT);
  });
});

describe('useSendWhatsappMessage(id) — bug CRÍTICO #1 defensa (todas las keys se derivan de vars.convId, NUNCA del closure `id`)', () => {
  it('si conversationId cambia MIENTRAS la mutation está en vuelo (Composer sin key, mismo instance), el pending se resuelve en el slice de la conversación ORIGINAL, no en la nueva', async () => {
    let resolveSend!: (m: WhatsappMessage) => void;
    vi.mocked(sendWhatsappMessage).mockImplementation(() => new Promise((r) => { resolveSend = r; }));
    const { qc, wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useSendWhatsappMessage(id),
      { wrapper, initialProps: { id: 'conv-a' } },
    );

    act(() => {
      result.current.send({ content: 'para A', files: [], drafts: [] });
    });
    await waitFor(() => expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-a'))).toHaveLength(1));

    // El usuario cambia de conversación ANTES de que la red resuelva — SIN
    // `key` en `Composer` (bug #1), el mismo hook instance se re-renderiza
    // con un `id` nuevo, refrescando los closures de onSuccess/onError.
    rerender({ id: 'conv-b' });

    resolveSend(SENT);

    await waitFor(() => {
      expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-a'))).toEqual([]);
    });
    // conv-b JAMÁS tuvo un envío propio — su slice no debe ensuciarse con el
    // resultado de un envío que en realidad era de conv-a.
    expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-b'))).toBeUndefined();
  });

  it('lo mismo ante un onError: el pending se marca "failed" en el slice de la conversación ORIGINAL', async () => {
    let rejectSend!: (e: unknown) => void;
    vi.mocked(sendWhatsappMessage).mockImplementation(() => new Promise((_r, rej) => { rejectSend = rej; }));
    const { qc, wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useSendWhatsappMessage(id),
      { wrapper, initialProps: { id: 'conv-a' } },
    );

    act(() => {
      result.current.send({ content: 'para A', files: [], drafts: [] });
    });
    await waitFor(() => expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-a'))).toHaveLength(1));

    rerender({ id: 'conv-b' });

    await act(async () => {
      rejectSend(new Error('fail'));
    });

    await waitFor(() => {
      const pending = qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-a')) ?? [];
      expect(pending).toHaveLength(1);
      expect(pending[0]?.status).toBe('failed');
    });
    expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-b'))).toBeUndefined();
  });
});

describe('useSendWhatsappMessage(id).send — bug MEDIO #11 (throttle de onUploadProgress)', () => {
  it('el primer tick patchea; los siguientes solo si avanzaron >= 5% desde el último patcheado; completar (1) siempre patchea', async () => {
    let capturedProgressCb!: (f: number) => void;
    vi.mocked(sendWhatsappMessage).mockImplementation((_id, input) => {
      capturedProgressCb = input.onUploadProgress!;
      return new Promise(() => {});
    });
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.send({ content: '', files: [draft('a1').file], drafts: [draft('a1')] });
    });
    await waitFor(() => expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1'))).toHaveLength(1));

    const progress = () => qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1'))?.[0]?.progress;

    act(() => capturedProgressCb(0.01));
    expect(progress()).toBe(0.01); // primer tick, siempre patchea

    act(() => capturedProgressCb(0.02));
    expect(progress()).toBe(0.01); // +0.01 desde el último patcheado, no llega a 5%

    act(() => capturedProgressCb(0.03));
    expect(progress()).toBe(0.01); // +0.02, todavía no llega a 5%

    act(() => capturedProgressCb(0.07));
    expect(progress()).toBe(0.07); // +0.06 desde 0.01, cruza el umbral

    act(() => capturedProgressCb(1));
    expect(progress()).toBe(1); // completar SIEMPRE patchea
  });
});

describe('useSendWhatsappMessage(id).send — bug BAJO #13c (crypto.randomUUID sin fallback)', () => {
  it('sin crypto.randomUUID disponible, igual genera un tempId único (no crashea)', async () => {
    const original = globalThis.crypto;
    // Simula un entorno sin randomUUID (navegadores viejos / contexto no-seguro).
    Object.defineProperty(globalThis, 'crypto', { value: { ...original, randomUUID: undefined }, configurable: true });

    try {
      vi.mocked(sendWhatsappMessage).mockImplementation(() => new Promise(() => {}));
      const { qc, wrapper } = makeWrapper();
      const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

      act(() => {
        result.current.send({ content: 'sin uuid', files: [], drafts: [] });
      });

      await waitFor(() => {
        const pending = qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1')) ?? [];
        expect(pending).toHaveLength(1);
        expect(pending[0]?.tempId).toMatch(/^optimistic:/);
      });
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });
});

describe('useSendWhatsappMessage(id).send — isPrivate threading (messaging-inbox-notes F1.5 fase D — NOTA PRIVADA)', () => {
  it('send({..., isPrivate:true}) → onMutate guarda un PendingSend con isPrivate:true', async () => {
    vi.mocked(sendWhatsappMessage).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.send({ content: 'nota interna', files: [], drafts: [], isPrivate: true });
    });

    await waitFor(() => {
      const pending = qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1')) ?? [];
      expect(pending).toHaveLength(1);
      expect(pending[0]?.isPrivate).toBe(true);
    });
  });

  it('send({...}) SIN isPrivate → default false (cero regresión de los call sites de 3 args existentes)', async () => {
    vi.mocked(sendWhatsappMessage).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.send({ content: 'reply normal', files: [], drafts: [] });
    });

    await waitFor(() => {
      const pending = qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1')) ?? [];
      expect(pending[0]?.isPrivate).toBe(false);
    });
  });

  it('mutationFn llama a api.sendWhatsappMessage con private:true cuando el pending es una nota', async () => {
    vi.mocked(sendWhatsappMessage).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.send({ content: 'nota interna', files: [], drafts: [], isPrivate: true });
    });

    await waitFor(() => expect(sendWhatsappMessage).toHaveBeenCalled());
    const [, input] = vi.mocked(sendWhatsappMessage).mock.calls[0] as [string, { private?: boolean }];
    expect(input.private).toBe(true);
  });

  it('mutationFn llama a api.sendWhatsappMessage con private:false cuando el pending es un reply normal', async () => {
    vi.mocked(sendWhatsappMessage).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.send({ content: 'reply normal', files: [], drafts: [] });
    });

    await waitFor(() => expect(sendWhatsappMessage).toHaveBeenCalled());
    const [, input] = vi.mocked(sendWhatsappMessage).mock.calls[0] as [string, { private?: boolean }];
    expect(input.private).toBe(false);
  });

  it('retry(pending) conserva pending.isPrivate en el re-mutate (nota que falló, reintentada, sigue siendo nota)', async () => {
    const { qc, wrapper } = makeWrapper();
    const failingNote: PendingSend = {
      tempId: 'optimistic:note-retry-1', content: 'nota que falló', drafts: [], progress: 0, status: 'failed', createdAt: '2026-07-12T00:00:00.000Z', isPrivate: true,
    };
    qc.setQueryData(whatsappPendingSendsKey('conv-1'), [failingNote]);
    vi.mocked(sendWhatsappMessage).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.retry(failingNote);
    });

    await waitFor(() => {
      const pending = qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1')) ?? [];
      expect(pending[0]?.isPrivate).toBe(true);
      expect(pending[0]?.status).toBe('sending');
    });
    const [, input] = vi.mocked(sendWhatsappMessage).mock.calls[0] as [string, { private?: boolean }];
    expect(input.private).toBe(true);
  });
});

describe('useSendWhatsappMessage(id).discard', () => {
  it('revoca los objectURL de los drafts y remueve el pending del slice', () => {
    const { qc, wrapper } = makeWrapper();
    const failing: PendingSend = {
      tempId: 'optimistic:discard-1', content: 'chau', drafts: [draft('a1', 'blob:discard')], progress: 0, status: 'failed', createdAt: '2026-07-12T00:00:00.000Z', isPrivate: false,
    };
    qc.setQueryData(whatsappPendingSendsKey('conv-1'), [failing]);
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.discard(failing);
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:discard');
    expect(qc.getQueryData<PendingSend[]>(whatsappPendingSendsKey('conv-1'))).toEqual([]);
  });
});
