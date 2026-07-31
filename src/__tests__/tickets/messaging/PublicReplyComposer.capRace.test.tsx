/**
 * PublicReplyComposer.capRace.test.tsx — FIX WAVE H2 (HIGH). `addFiles`
 * calculaba `countSoFar`/`batchBytesSoFar` a partir del `attachments` de
 * RENDER (stale) — dos selecciones rápidas de 3 imágenes cada una (antes de
 * que la primera tanda commitee a `attachments`) suman 6 chips, por encima
 * del cap de 5 (`TICKET_MESSAGE_MAX_ATTACHMENTS`). El BE responde 422 y se
 * pierde el ENVÍO ENTERO (texto + adjuntos), no solo el adjunto de más.
 *
 * Mismo patrón de FileReader controlado que protegía este cap en
 * `TicketCommentsTimeline` (test borrado en este branch) — acá se reinstala
 * para `PublicReplyComposer`, que nació SIN el guard de refs que
 * `NoteComposer` sí tiene.
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  TICKET_MESSAGE_MAX_ATTACHMENTS,
} from '@/types/ticketMessages';

vi.mock('@/hooks/useTicketMessages');
import * as useTicketMessagesModule from '@/hooks/useTicketMessages';
import { PublicReplyComposer } from '@/pages/tickets/TicketDetailPage/components/messaging/PublicReplyComposer';

const mockMutateAsync = vi.fn();

function makeFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockReset();
  mockMutateAsync.mockResolvedValue(undefined);
  vi.mocked(useTicketMessagesModule.useSendStaffTicketReply).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useTicketMessagesModule.useSendStaffTicketReply>);
});

describe('PublicReplyComposer — race del cap de adjuntos (H2)', () => {
  it('dos selecciones rápidas de 3 imágenes cada una NUNCA superan el cap de 5', async () => {
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
      render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
      const input = screen.getByLabelText(/adjuntar archivo/i) as HTMLInputElement;

      // Dos tandas de 3 imágenes = 6 en total → el cap (5) debe sostenerse.
      await act(async () => {
        Object.defineProperty(input, 'files', {
          value: [1, 2, 3].map((n) => makeFile(`p1-${n}.jpg`, 'image/jpeg', 100)),
          configurable: true,
        });
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await act(async () => {
        Object.defineProperty(input, 'files', {
          value: [1, 2, 3].map((n) => makeFile(`p2-${n}.jpg`, 'image/jpeg', 100)),
          configurable: true,
        });
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Drenar todas las lecturas pendientes (ambas tandas comparten el mismo
      // `attachments.length` stale = 0 hasta que la primera commitee).
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
        const list = screen.queryByRole('list', { name: /adjuntos pendientes/i });
        expect(list).toBeInTheDocument();
      });
      const chips = screen.getAllByRole('listitem');
      expect(chips.length).toBeLessThanOrEqual(TICKET_MESSAGE_MAX_ATTACHMENTS);
      expect(screen.getByText(/máximo 5 adjuntos/i)).toBeInTheDocument();
    } finally {
      globalThis.FileReader = RealFileReader;
    }
  });
});
