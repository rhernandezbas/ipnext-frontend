import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('PublicReplyComposer — identidad visual explícita', () => {
  it('el header dice "Responder al cliente" y avisa que el cliente SÍ lo ve', () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    expect(screen.getByText('Responder al cliente')).toBeInTheDocument();
    expect(screen.getByText(/lo va a ver el cliente/i)).toBeInTheDocument();
  });

  it('el botón de envío dice explícitamente "al cliente"', () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    expect(screen.getByRole('button', { name: /enviar al cliente/i })).toBeInTheDocument();
  });
});

describe('PublicReplyComposer — adjuntos: allowlist image/audio/video', () => {
  it('el input acepta imagen, audio y video (mirror del allowlist del BE)', () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/adjuntar archivo/i) as HTMLInputElement;
    expect(input.accept).toMatch(/image\/jpeg/);
    expect(input.accept).toMatch(/audio\/mpeg/);
    expect(input.accept).toMatch(/video\/mp4/);
  });

  it('agrega una imagen válida como chip con thumbnail', async () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/adjuntar archivo/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('foto.jpg', 'image/jpeg', 1024)] } });
    await waitFor(() => expect(screen.getByText('foto.jpg')).toBeInTheDocument());
  });

  it('agrega un audio válido como chip (sin thumbnail de imagen)', async () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/adjuntar archivo/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('nota.mp3', 'audio/mpeg', 1024)] } });
    await waitFor(() => expect(screen.getByText('nota.mp3')).toBeInTheDocument());
  });

  it('rechaza un tipo no soportado (pdf)', async () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/adjuntar archivo/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('doc.pdf', 'application/pdf', 1024)] } });
    await waitFor(() => expect(screen.getByText(/formato no soportado/i)).toBeInTheDocument());
    expect(screen.queryByText('doc.pdf')).not.toBeInTheDocument();
  });

  it('rechaza una imagen > 8MB (límite de la categoría)', async () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/adjuntar archivo/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('grande.jpg', 'image/jpeg', 9 * 1024 * 1024)] } });
    await waitFor(() => expect(screen.getByText(/supera el límite/i)).toBeInTheDocument());
    expect(screen.queryByText('grande.jpg')).not.toBeInTheDocument();
  });

  it('rechaza un 6to adjunto (máximo 5)', async () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/adjuntar archivo/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [1, 2, 3, 4, 5].map((n) => makeFile(`f${n}.jpg`, 'image/jpeg', 100)),
      },
    });
    await waitFor(() => expect(screen.getByText('f5.jpg')).toBeInTheDocument());
    fireEvent.change(input, { target: { files: [makeFile('f6.jpg', 'image/jpeg', 100)] } });
    await waitFor(() => expect(screen.getByText(/máximo 5/i)).toBeInTheDocument());
    expect(screen.queryByText('f6.jpg')).not.toBeInTheDocument();
  });

  it('rechaza un batch cuyo total combinado supera 60MB', async () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/adjuntar archivo/i) as HTMLInputElement;
    // 2 videos de 35MB cada uno (bajo el tope individual de 40MB) pero 70MB combinados.
    fireEvent.change(input, {
      target: {
        files: [makeFile('v1.mp4', 'video/mp4', 35 * 1024 * 1024), makeFile('v2.mp4', 'video/mp4', 35 * 1024 * 1024)],
      },
    });
    await waitFor(() => expect(screen.getByText('v1.mp4')).toBeInTheDocument());
    expect(screen.queryByText('v2.mp4')).not.toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).toMatch(/60\s*MB|tamaño combinado/i);
  });

  it('quitar un adjunto pendiente lo saca de la lista', async () => {
    const user = userEvent.setup();
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/adjuntar archivo/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('keep.jpg', 'image/jpeg', 100), makeFile('drop.jpg', 'image/jpeg', 100)] } });
    await waitFor(() => expect(screen.getByText('drop.jpg')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /quitar adjunto drop\.jpg/i }));
    expect(screen.queryByText('drop.jpg')).not.toBeInTheDocument();
    expect(screen.getByText('keep.jpg')).toBeInTheDocument();
  });
});

describe('PublicReplyComposer — largo del mensaje', () => {
  it('deshabilita el envío y avisa cuando el body supera 4000 caracteres', async () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const textarea = screen.getByPlaceholderText(/respuesta para el cliente/i);
    fireEvent.change(textarea, { target: { value: 'a'.repeat(4001) } });
    expect(screen.getByRole('button', { name: /enviar al cliente/i })).toBeDisabled();
    expect(screen.getByText(/4001\s*\/\s*4000|supera el largo/i)).toBeInTheDocument();
  });
});

describe('PublicReplyComposer — submit', () => {
  it('el botón está deshabilitado sin body ni adjuntos', () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    expect(screen.getByRole('button', { name: /enviar al cliente/i })).toBeDisabled();
  });

  it('envía ticketId + body + authorName + los File reales (multipart, no data-URI)', async () => {
    const user = userEvent.setup();
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana Pérez" />);
    const input = screen.getByLabelText(/adjuntar archivo/i) as HTMLInputElement;
    const file = makeFile('foto.jpg', 'image/jpeg', 100);
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('foto.jpg')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/respuesta para el cliente/i), 'Ya reviso tu conexión');
    await user.click(screen.getByRole('button', { name: /enviar al cliente/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      body: 'Ya reviso tu conexión',
      authorName: 'Ana Pérez',
      files: [file],
    });
  });

  it('permite enviar SOLO adjuntos (body vacío)', async () => {
    const user = userEvent.setup();
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/adjuntar archivo/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('foto.jpg', 'image/jpeg', 100)] } });
    await waitFor(() => expect(screen.getByText('foto.jpg')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /enviar al cliente/i }));
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('sin authorName (no logueado) no se puede enviar', () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName={null} />);
    expect(screen.getByText(/iniciá sesión/i)).toBeInTheDocument();
  });

  it('limpia el formulario y muestra feedback de éxito tras un envío exitoso', async () => {
    const user = userEvent.setup();
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const textarea = screen.getByPlaceholderText(/respuesta para el cliente/i) as HTMLTextAreaElement;
    await user.type(textarea, 'hola');
    await user.click(screen.getByRole('button', { name: /enviar al cliente/i }));
    await waitFor(() => expect(textarea.value).toBe(''));
    expect(screen.getByText(/enviada al cliente/i)).toBeInTheDocument();
  });

  it('muestra el error mapeado del BE cuando el envío falla', async () => {
    mockMutateAsync.mockRejectedValueOnce({ response: { data: { code: 'TICKET_MESSAGE_STORAGE_UNAVAILABLE' } } });
    const user = userEvent.setup();
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    await user.type(screen.getByPlaceholderText(/respuesta para el cliente/i), 'hola');
    await user.click(screen.getByRole('button', { name: /enviar al cliente/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/no está disponible/i);
  });
});
