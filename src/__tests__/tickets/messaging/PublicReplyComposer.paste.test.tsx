/**
 * PublicReplyComposer.paste.test.tsx — FIX WAVE L2 (LOW). `NoteComposer`
 * soporta pegar (Ctrl+V) un screenshot; `PublicReplyComposer` no — el
 * operador pega una imagen en la caja PÚBLICA y no pasa NADA, silencio
 * total (ni error, ni chip). Fix: mismo `onPaste` que `NoteComposer`, pero
 * reusando `addFiles` (con su allowlist image/audio/video, no solo imagen).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useTicketMessages');
import * as useTicketMessagesModule from '@/hooks/useTicketMessages';
import { PublicReplyComposer } from '@/pages/tickets/TicketDetailPage/components/messaging/PublicReplyComposer';

function makeFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

function pasteItems(textarea: HTMLElement, files: File[]) {
  const items = files.map((f) => ({ kind: 'file' as const, type: f.type, getAsFile: () => f }));
  const evt = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(evt, 'clipboardData', {
    value: { files: [] as unknown as FileList, items, getData: () => '' },
  });
  textarea.dispatchEvent(evt);
  return evt;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTicketMessagesModule.useSendStaffTicketReply).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false,
  } as unknown as ReturnType<typeof useTicketMessagesModule.useSendStaffTicketReply>);
});

describe('PublicReplyComposer — soporta pegar (Ctrl+V) igual que NoteComposer (L2)', () => {
  it('pegar una captura de pantalla agrega un chip de preview (antes: silencio total)', async () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const textarea = screen.getByPlaceholderText(/respuesta para el cliente/i);
    pasteItems(textarea, [makeFile('captura.png', 'image/png', 1024)]);
    await waitFor(() => expect(screen.getByText('captura.png')).toBeInTheDocument());
  });

  it('pegar texto plano (sin imagen) no hace preventDefault ni agrega chip', () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const textarea = screen.getByPlaceholderText(/respuesta para el cliente/i);
    const evt = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(evt, 'clipboardData', {
      value: { files: [], items: [], getData: () => 'hello' },
    });
    textarea.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(false);
    expect(screen.queryByRole('list', { name: /adjuntos pendientes/i })).not.toBeInTheDocument();
  });

  it('pegar un tipo no soportado muestra el error de formato (allowlist compartida con el file input)', async () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const textarea = screen.getByPlaceholderText(/respuesta para el cliente/i);
    pasteItems(textarea, [makeFile('doc.pdf', 'application/pdf', 1024)]);
    await waitFor(() => expect(screen.getByText(/formato no soportado/i)).toBeInTheDocument());
  });
});
