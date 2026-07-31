/**
 * NoteComposer.capRace.test.tsx — M6 (cobertura repuesta). Este test existía
 * para `TicketCommentsTimeline` ("Race on the 3-image cap (Fix #4)") y se
 * borró junto con ese archivo al migrar a `NoteComposer` — el guard de refs
 * (`pendingCountRef`) sobrevivió en el código nuevo, pero quedó sin la
 * prueba que lo fijaba como contrato. Lo repone acá, adaptado al composer
 * nuevo.
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useTicketComments');
import * as useTicketCommentsModule from '@/hooks/useTicketComments';
import { NoteComposer } from '@/pages/tickets/TicketDetailPage/components/messaging/NoteComposer';

const mockMutateAsync = vi.fn();
const MAX_IMAGES = 3;

function makeImageFile(name: string, type: string, sizeBytes: number): File {
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
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockReset();
  mockMutateAsync.mockResolvedValue(undefined);
  vi.mocked(useTicketCommentsModule.useAddTicketComment).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useTicketCommentsModule.useAddTicketComment>);
});

describe('NoteComposer — race del cap de 3 imágenes (M6, cobertura repuesta)', () => {
  it('dos pegados rápidos de 2 imágenes cada uno nunca superan el cap de 3', async () => {
    const pending: Array<() => void> = [];
    const RealFileReader = globalThis.FileReader;

    class ControlledFileReader {
      result: string | null = null;
      error: unknown = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(file: File) {
        pending.push(() => {
          this.result = `data:${file.type};base64,AAAA`;
          this.onload?.();
        });
      }
    }
    // @ts-expect-error test override
    globalThis.FileReader = ControlledFileReader;

    try {
      render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
      const textarea = screen.getByPlaceholderText(/nota interna/i);

      pasteItems(textarea, [
        makeImageFile('p1a.png', 'image/png', 100),
        makeImageFile('p1b.png', 'image/png', 100),
      ]);
      pasteItems(textarea, [
        makeImageFile('p2a.png', 'image/png', 100),
        makeImageFile('p2b.png', 'image/png', 100),
      ]);

      for (let guard = 0; guard < 20 && pending.length > 0; guard++) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          const fn = pending.shift()!;
          fn();
          await Promise.resolve();
          await Promise.resolve();
        });
      }

      await waitFor(() => {
        const list = screen.queryByRole('list', { name: /imágenes pendientes/i });
        expect(list).toBeInTheDocument();
      });
      const chips = screen.getAllByRole('listitem');
      expect(chips.length).toBeLessThanOrEqual(MAX_IMAGES);
      expect(screen.getByText(/Máximo 3 imágenes por comentario/i)).toBeInTheDocument();
    } finally {
      globalThis.FileReader = RealFileReader;
    }
  });
});
