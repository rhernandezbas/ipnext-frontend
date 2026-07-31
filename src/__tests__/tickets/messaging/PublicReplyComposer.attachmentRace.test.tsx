/**
 * PublicReplyComposer.attachmentRace.test.tsx — FIX WAVE H1 (HIGH). El
 * operador escribe "te mando la foto del cableado", elige el archivo y
 * aprieta Enviar ANTES de que termine el `readAsDataURL` (async) que arma el
 * chip. Sin guard, `handleSubmit` lee `attachments` del closure (todavía
 * vacío) y manda el mensaje SIN el adjunto, mientras el operador ve
 * "Respuesta enviada al cliente." — el archivo se pierde EN SILENCIO.
 *
 * Se controla `FileReader` a mano (mismo patrón que el test de cap-race que
 * existía para `TicketCommentsTimeline`, ahora migrado a estos composers) para
 * poder disparar el submit DURANTE la lectura en vuelo, no después.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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

describe('PublicReplyComposer — race entre el FileReader async y el submit (H1)', () => {
  it('el submit NO puede ejecutarse mientras hay una lectura de adjunto en vuelo — el adjunto nunca viaja "perdido"', async () => {
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
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/adjuntar archivo/i), {
          target: { files: [makeFile('cableado.jpg', 'image/jpeg', 1024)] },
        });
      });

      // La lectura del archivo está en vuelo (todavía no resolvimos `pending`) —
      // el chip aún no se pintó. El operador ya escribió el texto y aprieta Enviar.
      expect(screen.queryByText('cableado.jpg')).not.toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText(/respuesta para el cliente/i), {
        target: { value: 'te mando la foto del cableado' },
      });
      fireEvent.click(screen.getByRole('button', { name: /enviar al cliente/i }));

      // El submit NO debe haber disparado la mutación todavía — el botón debe
      // estar bloqueado mientras el adjunto sigue leyéndose.
      expect(mockMutateAsync).not.toHaveBeenCalled();

      // Ahora se resuelve la lectura pendiente.
      await act(async () => {
        pending.forEach((fn) => fn());
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(screen.getByText('cableado.jpg')).toBeInTheDocument());

      // Recién ahora el operador puede enviar, y el payload SÍ trae el archivo.
      fireEvent.click(screen.getByRole('button', { name: /enviar al cliente/i }));
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
      const payload = mockMutateAsync.mock.calls[0]![0];
      expect(payload.files).toHaveLength(1);
      expect(payload.files[0].name).toBe('cableado.jpg');
    } finally {
      globalThis.FileReader = RealFileReader;
    }
  });

  it('muestra feedback visible ("Cargando adjuntos…") mientras hay lecturas en vuelo', async () => {
    const pending: Array<() => void> = [];
    const RealFileReader = globalThis.FileReader;
    class ControlledFileReader {
      result: string | null = null;
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
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/adjuntar archivo/i), {
          target: { files: [makeFile('foto.jpg', 'image/jpeg', 1024)] },
        });
      });

      expect(screen.getByText(/cargando adjunto/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /enviar al cliente/i })).toBeDisabled();

      await act(async () => {
        pending.forEach((fn) => fn());
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(screen.queryByText(/cargando adjunto/i)).not.toBeInTheDocument());
    } finally {
      globalThis.FileReader = RealFileReader;
    }
  });
});
