import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useTicketComments');
import * as useTicketCommentsModule from '@/hooks/useTicketComments';
import { NoteComposer } from '@/pages/tickets/TicketDetailPage/components/messaging/NoteComposer';

const mockMutateAsync = vi.fn();

function makeImageFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

function pasteFiles(textarea: HTMLElement, files: File[]) {
  fireEvent.paste(textarea, { clipboardData: { files, items: [], getData: () => '' } });
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

describe('NoteComposer — identidad visual explícita', () => {
  it('el header dice "Nota interna" y avisa que el cliente NUNCA la ve', () => {
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    expect(screen.getAllByText('Nota interna').length).toBeGreaterThan(0);
    expect(screen.getByText(/el cliente NUNCA la ve/i)).toBeInTheDocument();
  });

  it('el botón de envío dice explícitamente "nota interna" (no un genérico "Enviar")', () => {
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    expect(screen.getByRole('button', { name: /agregar nota interna/i })).toBeInTheDocument();
  });
});

describe('NoteComposer — validación de adjuntos (contrato legacy FROZEN)', () => {
  it('pegar una imagen agrega un chip de preview', async () => {
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    const textarea = screen.getByPlaceholderText(/nota interna/i);
    pasteFiles(textarea, [makeImageFile('shot.png', 'image/png', 1024)]);
    await waitFor(() => expect(screen.getByText('shot.png')).toBeInTheDocument());
  });

  it('rechaza un archivo no-imagen con el mensaje de spec', async () => {
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    const textarea = screen.getByPlaceholderText(/nota interna/i);
    pasteFiles(textarea, [makeImageFile('doc.pdf', 'application/pdf', 1024)]);
    await waitFor(() => expect(screen.getByText(/Solo se aceptan imágenes/i)).toBeInTheDocument());
  });

  it('rechaza una imagen > 2MB con el mensaje de spec', async () => {
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/Adjuntar imagen/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeImageFile('big.png', 'image/png', 3 * 1024 * 1024)] } });
    await waitFor(() => expect(screen.getByText(/supera el límite de 2MB/i)).toBeInTheDocument());
  });

  it('rechaza una 4ta imagen (máximo 3)', async () => {
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/Adjuntar imagen/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeImageFile('a.png', 'image/png', 10), makeImageFile('b.png', 'image/png', 10), makeImageFile('c.png', 'image/png', 10)] },
    });
    await waitFor(() => expect(screen.getByText('c.png')).toBeInTheDocument());
    fireEvent.change(input, { target: { files: [makeImageFile('d.png', 'image/png', 10)] } });
    await waitFor(() => expect(screen.getByText(/Máximo 3 imágenes/i)).toBeInTheDocument());
  });
});

describe('NoteComposer — submit', () => {
  it('el botón está deshabilitado sin body ni adjuntos', () => {
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    expect(screen.getByRole('button', { name: /agregar nota interna/i })).toBeDisabled();
  });

  it('envía body + authorName + attachments vacíos', async () => {
    const user = userEvent.setup();
    render(<NoteComposer ticketId="ticket-1" authorName="Ana Pérez" />);
    await user.type(screen.getByPlaceholderText(/nota interna/i), 'Reviso con el técnico');
    await user.click(screen.getByRole('button', { name: /agregar nota interna/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      body: 'Reviso con el técnico',
      authorName: 'Ana Pérez',
      attachments: [],
    });
  });

  it('sin authorName (no logueado) no se puede enviar', () => {
    render(<NoteComposer ticketId="ticket-1" authorName={null} />);
    expect(screen.getByText(/iniciá sesión/i)).toBeInTheDocument();
  });

  it('limpia el formulario después de un envío exitoso', async () => {
    const user = userEvent.setup();
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    const textarea = screen.getByPlaceholderText(/nota interna/i) as HTMLTextAreaElement;
    await user.type(textarea, 'hola');
    await user.click(screen.getByRole('button', { name: /agregar nota interna/i }));
    await waitFor(() => expect(textarea.value).toBe(''));
  });
});

describe('NoteComposer — no se cae bajo un batch de FileReader controlado', () => {
  it('un batch mixto (pdf inválido + png válido) agrega el válido y muestra el error del inválido', async () => {
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    const input = screen.getByLabelText(/Adjuntar imagen/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeImageFile('doc.pdf', 'application/pdf', 100), makeImageFile('ok.png', 'image/png', 100)] },
    });
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText('ok.png')).toBeInTheDocument());
    expect(screen.getByText(/Solo se aceptan imágenes/i)).toBeInTheDocument();
  });
});
