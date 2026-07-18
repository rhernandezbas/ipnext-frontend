/**
 * useWhatsapp — useEditWhatsappNote / useDeleteWhatsappNote (internal-notes
 * F1.5 — EDITAR/ELIMINAR NOTA). Archivo DEDICADO (mismo criterio que
 * `useWhatsapp.status.test.ts`/`useWhatsapp.send.test.ts`).
 *
 * Contrato (ver `useWhatsapp.ts`):
 *  - `onSuccess` REEMPLAZA el mensaje editado/borrado en el cache del hilo
 *    (`whatsappMessagesKey(convId)`) con el DTO devuelto por el BE (content
 *    editado / tombstone deleted:true) → feedback inmediato, sin esperar el
 *    poll de 5s.
 *  - `onSuccess` INVALIDA el hilo (`whatsappMessagesKey`) Y el listado
 *    (`WHATSAPP_CONVERSATIONS_ROOT`) — el `internalNoteCount` de la fila baja
 *    al eliminar, así que la lista tiene que refrescar.
 *  - Bug CRÍTICO #1 defensa (mismo criterio que `useSendWhatsappMessage`):
 *    todas las keys se derivan de `vars.convId` capturado AL DISPATCH, nunca
 *    del closure `id` del hook.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type { WhatsappMessage } from '@/types/whatsapp';

vi.mock('@/api/whatsapp.api', () => ({
  editWhatsappNote: vi.fn(),
  deleteWhatsappNote: vi.fn(),
}));

vi.mock('@/hooks/useDocumentVisible', () => ({
  useDocumentVisible: vi.fn(),
}));

import { editWhatsappNote, deleteWhatsappNote } from '@/api/whatsapp.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import {
  useEditWhatsappNote,
  useDeleteWhatsappNote,
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

const NOTE: WhatsappMessage = {
  id: 'msg-1',
  direction: 'outbound',
  content: 'nota original',
  senderName: 'Agente Rocío',
  sentAt: '2026-07-12T12:00:00.000Z',
  private: true,
  edited: false,
  deleted: false,
  canEdit: true,
  canDelete: true,
};

const OTHER: WhatsappMessage = { ...NOTE, id: 'msg-2', content: 'otra nota' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useDocumentVisible).mockReturnValue(true);
});

describe('useEditWhatsappNote(id).editNote', () => {
  it('llama a la API con (convId, messageId, content)', async () => {
    vi.mocked(editWhatsappNote).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEditWhatsappNote('conv-1'), { wrapper });

    act(() => {
      result.current.editNote('msg-1', 'nota corregida');
    });

    await waitFor(() => expect(editWhatsappNote).toHaveBeenCalledWith('conv-1', 'msg-1', 'nota corregida'));
  });

  it('onSuccess reemplaza el mensaje en el cache del hilo con el DTO editado (content + edited:true)', async () => {
    const edited: WhatsappMessage = { ...NOTE, content: 'nota corregida', edited: true };
    vi.mocked(editWhatsappNote).mockResolvedValue(edited);
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappMessagesKey('conv-1'), [NOTE, OTHER]);
    const { result } = renderHook(() => useEditWhatsappNote('conv-1'), { wrapper });

    await act(async () => {
      result.current.editNote('msg-1', 'nota corregida');
    });

    await waitFor(() => {
      const cached = qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-1'));
      const m = cached?.find((x) => x.id === 'msg-1');
      expect(m?.content).toBe('nota corregida');
      expect(m?.edited).toBe(true);
    });
    // la otra nota queda intacta
    const cached = qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-1'));
    expect(cached?.find((x) => x.id === 'msg-2')?.content).toBe('otra nota');
  });

  it('onSuccess invalida el listado (internalNoteCount de la fila) y el hilo', async () => {
    vi.mocked(editWhatsappNote).mockResolvedValue({ ...NOTE, edited: true });
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useEditWhatsappNote('conv-1'), { wrapper });

    await act(async () => {
      result.current.editNote('msg-1', 'x');
    });

    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]));
      expect(keys.some((k) => k.includes('conversations'))).toBe(true);
      expect(keys.some((k) => k.includes('messages'))).toBe(true);
    });
  });

  it('opts.onError se reenvía al fallar (para el toast por código)', async () => {
    vi.mocked(editWhatsappNote).mockRejectedValue({ response: { data: { code: 'INTERNAL_NOTE_FORBIDDEN' } } });
    const onError = vi.fn();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEditWhatsappNote('conv-1'), { wrapper });

    await act(async () => {
      result.current.editNote('msg-1', 'x', { onError });
    });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});

describe('useDeleteWhatsappNote(id).deleteNote', () => {
  it('llama a la API con (convId, messageId)', async () => {
    vi.mocked(deleteWhatsappNote).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteWhatsappNote('conv-1'), { wrapper });

    act(() => {
      result.current.deleteNote('msg-1');
    });

    await waitFor(() => expect(deleteWhatsappNote).toHaveBeenCalledWith('conv-1', 'msg-1'));
  });

  it('onSuccess reemplaza el mensaje por el TOMBSTONE (deleted:true, content:"") sin sacarlo del hilo', async () => {
    const tombstone: WhatsappMessage = { ...NOTE, content: '', deleted: true, canEdit: false, canDelete: false };
    vi.mocked(deleteWhatsappNote).mockResolvedValue(tombstone);
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappMessagesKey('conv-1'), [NOTE, OTHER]);
    const { result } = renderHook(() => useDeleteWhatsappNote('conv-1'), { wrapper });

    await act(async () => {
      result.current.deleteNote('msg-1');
    });

    await waitFor(() => {
      const cached = qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-1'));
      const m = cached?.find((x) => x.id === 'msg-1');
      expect(m?.deleted).toBe(true);
      expect(m?.content).toBe('');
    });
    // La fila NO desaparece: sigue habiendo 2 mensajes.
    expect(qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-1'))?.length).toBe(2);
  });

  it('onSuccess invalida el listado (el internalNoteCount baja) y el hilo', async () => {
    vi.mocked(deleteWhatsappNote).mockResolvedValue({ ...NOTE, deleted: true, content: '' });
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteWhatsappNote('conv-1'), { wrapper });

    await act(async () => {
      result.current.deleteNote('msg-1');
    });

    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]));
      expect(keys.some((k) => k.includes('conversations'))).toBe(true);
      expect(keys.some((k) => k.includes('messages'))).toBe(true);
    });
  });

  it('opts.onError se reenvía al fallar', async () => {
    vi.mocked(deleteWhatsappNote).mockRejectedValue({ response: { data: { code: 'INTERNAL_NOTE_ALREADY_DELETED' } } });
    const onError = vi.fn();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteWhatsappNote('conv-1'), { wrapper });

    await act(async () => {
      result.current.deleteNote('msg-1', { onError });
    });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});

describe('useEditWhatsappNote / useDeleteWhatsappNote — bug CRÍTICO #1 defensa (keys derivadas de convId capturado al dispatch)', () => {
  it('editNote: si el id del hook cambia MIENTRAS la mutation está en vuelo, el resultado aterriza en el slice de la conversación ORIGINAL', async () => {
    let resolveEdit!: (v: WhatsappMessage) => void;
    vi.mocked(editWhatsappNote).mockImplementation(() => new Promise((r) => { resolveEdit = r; }));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappMessagesKey('conv-a'), [NOTE]);
    qc.setQueryData(whatsappMessagesKey('conv-b'), [OTHER]);

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useEditWhatsappNote(id),
      { wrapper, initialProps: { id: 'conv-a' } },
    );

    act(() => {
      result.current.editNote('msg-1', 'editada en A');
    });
    await waitFor(() => expect(editWhatsappNote).toHaveBeenCalled());

    // El agente cambia de conversación ANTES de que la red resuelva.
    rerender({ id: 'conv-b' });

    await act(async () => {
      resolveEdit({ ...NOTE, content: 'editada en A', edited: true });
    });

    await waitFor(() => {
      const a = qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-a'));
      expect(a?.find((x) => x.id === 'msg-1')?.content).toBe('editada en A');
    });
    // conv-b jamás fue tocada.
    const b = qc.getQueryData<WhatsappMessage[]>(whatsappMessagesKey('conv-b'));
    expect(b?.find((x) => x.id === 'msg-2')?.content).toBe('otra nota');
    expect(editWhatsappNote).toHaveBeenCalledWith('conv-a', 'msg-1', 'editada en A');
  });
});
