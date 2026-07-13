/**
 * Composer — textarea + envío del thread (messaging-inbox F1, design §1/§6,
 * tasks FB3 3.5/3.6; EXTENDIDO messaging-inbox-v2-media F1.5 fase A, Tanda 2
 * — ENVIAR, design §4). COMPOSER-1: gate `<Can permission="messaging.send">` +
 * `canReply` (llega como prop). La mutation de envío es propia:
 * `useSendWhatsappMessage` (design §6.3) devuelve `{send,retry,discard,
 * isError,error}` — YA NO un `useMutation` crudo (`mutate`/`isPending`): el
 * spinner de "enviando" vive en la burbuja optimista, NO en este botón
 * (FE4.6 — `mutation.isPending` deja de bloquear el composer).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useWhatsapp');
vi.mock('@/hooks/useMyPermissions');

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import { Composer } from './Composer';

const mockSend = vi.fn();
const mockRetry = vi.fn();
const mockDiscard = vi.fn();

type SendApi = ReturnType<typeof useWhatsappModule.useSendWhatsappMessage>;

function setMutationState(overrides: Partial<{ isError: boolean; error: unknown }> = {}) {
  vi.mocked(useWhatsappModule.useSendWhatsappMessage).mockReturnValue({
    send: mockSend,
    retry: mockRetry,
    discard: mockDiscard,
    isError: overrides.isError ?? false,
    error: overrides.error ?? null,
  } as unknown as SendApi);
}

function setCanSend(can: boolean) {
  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    permissions: can ? ['messaging.send'] : [],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: () => can,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
}

beforeEach(() => {
  mockSend.mockReset();
  mockRetry.mockReset();
  mockDiscard.mockReset();
  setMutationState();
  setCanSend(true);
  // GOTCHA jsdom: no trae createObjectURL/revokeObjectURL (mismo gap que
  // matchMedia en MessageBubble) — necesarios porque adjuntar una imagen
  // pasa por useComposerAttachments, que los llama de verdad.
  (globalThis as { URL: typeof URL }).URL.createObjectURL = vi.fn(() => 'blob:mock');
  (globalThis as { URL: typeof URL }).URL.revokeObjectURL = vi.fn();
});

describe('Composer — COMPOSER-1 (envío de texto)', () => {
  it('envía el mensaje escrito y limpia el input al disparar el envío (bug #10: ya no espera a "resolver")', async () => {
    render(<Composer conversationId="c1" canReply />);

    const textarea = screen.getByRole('textbox', { name: /mensaje/i });
    await userEvent.type(textarea, 'Hola, ¿cómo estás?');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(mockSend).toHaveBeenCalledWith({ content: 'Hola, ¿cómo estás?', files: [], drafts: [] });
    expect(textarea).toHaveValue('');
  });

  it('no envía un mensaje vacío o solo espacios (sin adjuntos)', async () => {
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });
    await userEvent.type(textarea, '   ');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('Composer — COMPOSER-1 (canReply=false)', () => {
  it('deshabilita input y botón, y muestra el aviso de ventana de 24h', () => {
    render(<Composer conversationId="c1" canReply={false} />);
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
    expect(screen.getByText('Ventana de 24h expirada — se necesita un template')).toBeInTheDocument();
  });

  it('con canReply=true NO muestra el aviso de ventana 24h', () => {
    render(<Composer conversationId="c1" canReply />);
    expect(screen.queryByText(/ventana de 24h expirada/i)).toBeNull();
  });
});

describe('Composer — COMPOSER-1 (422/503 sin crash)', () => {
  it('un 422 MESSAGING_WINDOW_EXPIRED muestra un mensaje claro y el composer sigue operable', async () => {
    setMutationState({
      isError: true,
      error: { response: { data: { error: 'La ventana de 24h expiró', code: 'MESSAGING_WINDOW_EXPIRED' } } },
    });
    render(<Composer conversationId="c1" canReply />);

    expect(screen.getByRole('alert')).toHaveTextContent(/ventana de 24 horas/i);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });
    expect(textarea).toBeEnabled();
    await userEvent.type(textarea, 'Reintento');
    expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled();
  });

  it('un 503 CHATWOOT_UNAVAILABLE muestra un mensaje claro', () => {
    setMutationState({
      isError: true,
      error: { response: { data: { error: 'no disponible', code: 'CHATWOOT_UNAVAILABLE' } } },
    });
    render(<Composer conversationId="c1" canReply />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no está disponible/i);
  });

  it('un error sin body legible cae a un mensaje genérico (no crashea)', () => {
    setMutationState({ isError: true, error: new Error('network fail') });
    render(<Composer conversationId="c1" canReply />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo enviar/i);
  });

  it('sin error, no se muestra ningún alert', () => {
    render(<Composer conversationId="c1" canReply />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Composer — COMPOSER-1 (gate messaging.send)', () => {
  it('sin permiso messaging.send, el composer no se renderiza', () => {
    setCanSend(false);
    render(<Composer conversationId="c1" canReply />);
    expect(screen.queryByRole('textbox', { name: /mensaje/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /enviar/i })).toBeNull();
  });

  it('con permiso messaging.send, el composer se renderiza', () => {
    render(<Composer conversationId="c1" canReply />);
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeInTheDocument();
  });
});

describe('Composer — A11Y-1 (touch target)', () => {
  it('el botón de enviar aplica la clase que garantiza el touch target ≥44px', () => {
    render(<Composer conversationId="c1" canReply />);
    expect(screen.getByRole('button', { name: /enviar/i })).toHaveClass('sendButton');
  });
});

describe('Composer — bug #4 (no debe mentir "ventana expirada" mientras carga o si el detalle falla)', () => {
  it('mientras isDetailLoading, el input está disabled pero NO se muestra el aviso de expirada', () => {
    render(<Composer conversationId="c1" canReply={false} isDetailLoading />);
    expect(screen.queryByText(/ventana de 24h expirada/i)).toBeNull();
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeDisabled();
  });

  it('si isDetailError, se muestra un error legible y NO el aviso de expirada', () => {
    render(<Composer conversationId="c1" canReply={false} isDetailError />);
    expect(screen.queryByText(/ventana de 24h expirada/i)).toBeNull();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeDisabled();
  });

  it('canReply=false genuino (sin loading/error) SÍ muestra el aviso real de ventana expirada', () => {
    render(<Composer conversationId="c1" canReply={false} />);
    expect(screen.getByText('Ventana de 24h expirada — se necesita un template')).toBeInTheDocument();
  });

  it('isDetailLoading tiene prioridad sobre isDetailError (no muestran ambos a la vez)', () => {
    render(<Composer conversationId="c1" canReply={false} isDetailLoading isDetailError />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeDisabled();
  });
});

describe('Composer — bug #11 (Enter para enviar, Shift+Enter = salto de línea)', () => {
  it('Enter (sin shift) envía el mensaje y limpia el input', async () => {
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    await userEvent.type(textarea, 'Hola{Enter}');

    expect(mockSend).toHaveBeenCalledWith({ content: 'Hola', files: [], drafts: [] });
    expect(textarea).toHaveValue('');
  });

  it('Shift+Enter agrega un salto de línea, NO envía', async () => {
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    await userEvent.type(textarea, 'Linea1{Shift>}{Enter}{/Shift}Linea2');

    expect(mockSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Linea1\nLinea2');
  });

  it('Enter con el input vacío no envía', async () => {
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    await userEvent.type(textarea, '{Enter}');

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Enter con canReply=false (disabled) no envía', async () => {
    render(<Composer conversationId="c1" canReply={false} />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    expect(textarea).toBeDisabled();
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('Composer — fix re-review fase 2 (regresión bloqueante: poll de fondo fallido NO debe cortar una respuesta con canReply ya conocido)', () => {
  it('canReply=true + isDetailError=true (el detalle YA resolvió con canReply, un poll de fondo posterior falló) → composer sigue HABILITADO, sin banner de error', () => {
    render(<Composer conversationId="c1" canReply isDetailError />);
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/ventana de 24h expirada/i)).toBeNull();
  });

  it('sigue habilitado para escribir y enviar con canReply=true + isDetailError=true', async () => {
    render(<Composer conversationId="c1" canReply isDetailError />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    await userEvent.type(textarea, 'Sigo acá');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(mockSend).toHaveBeenCalledWith({ content: 'Sigo acá', files: [], drafts: [] });
  });
});

// ── messaging-inbox-v2-media F1.5 fase A, Tanda 2 (ENVIAR) ─────────────────

describe('Composer — F4.5 (envío habilitado solo con archivos, sin texto)', () => {
  it('con un archivo válido adjunto y el textarea vacío, el botón enviar se habilita', async () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

    await userEvent.upload(input, file);

    expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled();
  });

  it('enviar solo-archivos llama a send con content vacío y el file correspondiente', async () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, file);

    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ content: '', files: [file] }));
  });
});

describe('Composer — F4.5 (disabled si algún draft tiene error de validación)', () => {
  it('un archivo que excede su límite bloquea el envío aunque haya texto', async () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    const bigFile = new File(['x'], 'grande.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });

    await userEvent.upload(input, bigFile);
    await userEvent.type(screen.getByRole('textbox', { name: /mensaje/i }), 'hola');

    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });
});

describe('Composer — F4.5 (Enter envía media-sola)', () => {
  it('Enter con textarea vacío pero con un archivo válido adjunto SÍ envía', async () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, file);

    await userEvent.type(screen.getByRole('textbox', { name: /mensaje/i }), '{Enter}');

    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ content: '', files: [file] }));
  });
});

describe('Composer — F4.5 (bug #10: limpia content + drafts AL DISPARAR, no en onSuccess)', () => {
  it('tras disparar un envío con texto+archivo, el tray de adjuntos desaparece de inmediato', async () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, file);
    expect(screen.getByRole('list', { name: /archivos adjuntos/i })).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /mensaje/i }), 'mirá');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(screen.queryByRole('list', { name: /archivos adjuntos/i })).toBeNull();
  });
});

describe('Composer — F4.6 (mutation.isPending YA NO bloquea el composer — el spinner vive en la burbuja)', () => {
  it('el hook ya no expone isPending; el composer no depende de eso para deshabilitarse', () => {
    // El mock de useSendWhatsappMessage no tiene isPending — si Composer lo
    // leyera igual, sería `undefined` (falsy) y NO debe deshabilitar nada.
    render(<Composer conversationId="c1" canReply />);
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeEnabled();
  });
});

describe('Composer — bug CRÍTICO #4 (el feedback de "máximo N archivos" ya no desaparece en silencio)', () => {
  it('elegir 12 archivos (por encima de MAX_FILES=10) muestra un aviso visible (role=status) con el máximo', async () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    const files = Array.from({ length: 12 }, (_, i) => new File(['x'], `f${i}.jpg`, { type: 'image/jpeg' }));

    await userEvent.upload(input, files);

    const notice = screen.getByText(/m[aá]ximo 10 archivos/i);
    expect(notice).toHaveAttribute('role', 'status');
    // Los 10 primeros SÍ se ven en el tray — los 2 excedentes no desaparecen del todo silenciosos, el aviso los explica.
    expect(screen.getByRole('list', { name: /archivos adjuntos \(10\)/i })).toBeInTheDocument();
  });

  it('sin exceder el tope, no se muestra ningún aviso de "máximo"', async () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'a.jpg', { type: 'image/jpeg' }));

    expect(screen.queryByText(/m[aá]ximo 10 archivos/i)).toBeNull();
  });
});

describe('Composer — bug CRÍTICO #3 (foco no se pierde a document.body al quitar un adjunto)', () => {
  it('quitar un chip que NO es el último mueve el foco al remove-button del chip siguiente', async () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    await userEvent.upload(input, [
      new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['x'], 'b.jpg', { type: 'image/jpeg' }),
    ]);

    await userEvent.click(screen.getByRole('button', { name: /quitar a\.jpg/i }));

    expect(screen.getByRole('button', { name: /quitar b\.jpg/i })).toHaveFocus();
  });

  it('quitar el ÚLTIMO chip mueve el foco al botón "adjuntar"', async () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'a.jpg', { type: 'image/jpeg' }));

    await userEvent.click(screen.getByRole('button', { name: /quitar a\.jpg/i }));

    expect(screen.getByRole('button', { name: /adjuntar archivos/i })).toHaveFocus();
  });

  it('el foco jamás cae a document.body tras quitar un adjunto', async () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'a.jpg', { type: 'image/jpeg' }));

    await userEvent.click(screen.getByRole('button', { name: /quitar a\.jpg/i }));

    expect(document.activeElement).not.toBe(document.body);
  });
});

describe('Composer — bug MEDIO #8 (validación client-side de tipo)', () => {
  // NOTA: se usa `fireEvent.change` (no `userEvent.upload`) para estos 2 —
  // `userEvent.upload` filtra por el atributo `accept` del input ANTES de
  // disparar el evento (mismo comportamiento que un browser real con el
  // picker nativo); acá justamente queremos simular el caso "igual llegó un
  // archivo no soportado" (drag&drop, o un accept desactualizado), que es lo
  // que `validateFile` debe atajar client-side.
  it('un archivo no soportado (.exe) queda marcado con error y bloquea el envío', () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    const file = new File(['x'], 'virus.exe', { type: 'application/x-msdownload' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/no se puede enviar/i);
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('heic (no soportado por WhatsApp) también bloquea, aunque matchee "image/*"', () => {
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    const file = new File(['x'], 'foto.heic', { type: 'image/heic' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });
});

describe('Composer — bug MEDIO #9 (mapSendError reemplaza el resolveErrorMessage local — cubre códigos de adjuntos)', () => {
  it('ATTACHMENT_TOO_LARGE (413 del BE al subir) muestra la copy de tamaño excedido, no el genérico', () => {
    setMutationState({ isError: true, error: { response: { data: { code: 'ATTACHMENT_TOO_LARGE' } } } });
    render(<Composer conversationId="c1" canReply />);
    expect(screen.getByRole('alert')).toHaveTextContent(/supera el tama[ñn]o/i);
  });

  it('UNSUPPORTED_ATTACHMENT_TYPE (415 del BE) muestra la copy de tipo no soportado', () => {
    setMutationState({ isError: true, error: { response: { data: { code: 'UNSUPPORTED_ATTACHMENT_TYPE' } } } });
    render(<Composer conversationId="c1" canReply />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no se puede enviar/i);
  });

  it('TOO_MANY_FILES (del BE, re-validación server-side) muestra la copy con el máximo', () => {
    setMutationState({ isError: true, error: { response: { data: { code: 'TOO_MANY_FILES' } } } });
    render(<Composer conversationId="c1" canReply />);
    expect(screen.getByRole('alert')).toHaveTextContent(/máximo 10 archivos/i);
  });
});

describe('Composer — bug MEDIO/BAJO #10 (el composer se limpia AL DISPARAR el envío, no en onSuccess)', () => {
  it('el composer se vacía apenas se dispara el envío, sin esperar a que la mutation resuelva', async () => {
    mockSend.mockImplementation(() => {}); // simula un envío en vuelo (nunca invoca ningún callback)
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });
    await userEvent.type(textarea, 'Hola');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(textarea).toHaveValue('');
  });

  it('si el envío nunca resuelve (en vuelo) el tray de adjuntos YA desapareció — un solo camino de retry (el de la burbuja), no 2', async () => {
    mockSend.mockImplementation(() => {});
    render(<Composer conversationId="c1" canReply />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(screen.queryByRole('list', { name: /archivos adjuntos/i })).toBeNull();
  });
});

describe('Composer — bug BAJO #13d (Enter durante composición IME no envía)', () => {
  it('Enter mientras nativeEvent.isComposing=true (IME activo) NO envía', async () => {
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });
    await userEvent.type(textarea, 'こんにちは');

    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Enter SIN composición activa sigue enviando normalmente (no regresión)', async () => {
    mockSend.mockImplementation((_input, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });
    await userEvent.type(textarea, 'Hola');

    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: false });

    expect(mockSend).toHaveBeenCalled();
  });
});
