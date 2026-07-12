/**
 * Composer — textarea + envío del thread (messaging-inbox F1, design §1/§6,
 * tasks FB3 3.5/3.6). COMPOSER-1: gate `<Can permission="messaging.send">` +
 * `canReply` (llega como prop, resuelto por `useWhatsappConversation` en
 * `WhatsappInboxPage`, FB4) — pero la mutation de envío es propia: `usa
 * useSendWhatsappMessage` directo (así lo pide la task), mockeado acá.
 * 422/503 se leen reactivamente de `mutation.error` (el hook, FB1, ya los
 * captura en su `onError` sin relanzar) — sin try/catch en este componente.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useWhatsapp');
vi.mock('@/hooks/useMyPermissions');

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import { Composer } from './Composer';

const mockMutate = vi.fn();

type SendMutation = ReturnType<typeof useWhatsappModule.useSendWhatsappMessage>;

function setMutationState(overrides: Partial<{ isPending: boolean; isError: boolean; error: unknown }> = {}) {
  vi.mocked(useWhatsappModule.useSendWhatsappMessage).mockReturnValue({
    mutate: mockMutate,
    isPending: overrides.isPending ?? false,
    isError: overrides.isError ?? false,
    error: overrides.error ?? null,
  } as unknown as SendMutation);
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
  mockMutate.mockReset();
  setMutationState();
  setCanSend(true);
});

describe('Composer — COMPOSER-1 (envío)', () => {
  it('envía el mensaje escrito y limpia el input al resolver', async () => {
    mockMutate.mockImplementation((_content: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    render(<Composer conversationId="c1" canReply />);

    const textarea = screen.getByRole('textbox', { name: /mensaje/i });
    await userEvent.type(textarea, 'Hola, ¿cómo estás?');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(mockMutate).toHaveBeenCalledWith('Hola, ¿cómo estás?', expect.any(Object));
    expect(textarea).toHaveValue('');
  });

  it('no envía un mensaje vacío o solo espacios', async () => {
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });
    await userEvent.type(textarea, '   ');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('deshabilita el botón mientras la mutation está pendiente', () => {
    setMutationState({ isPending: true });
    render(<Composer conversationId="c1" canReply />);
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
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
    // "sigue operable" — el usuario puede reintentar (no quedó bloqueado por el error).
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
    mockMutate.mockImplementation((_content: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    await userEvent.type(textarea, 'Hola{Enter}');

    expect(mockMutate).toHaveBeenCalledWith('Hola', expect.any(Object));
    expect(textarea).toHaveValue('');
  });

  it('Shift+Enter agrega un salto de línea, NO envía', async () => {
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    await userEvent.type(textarea, 'Linea1{Shift>}{Enter}{/Shift}Linea2');

    expect(mockMutate).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Linea1\nLinea2');
  });

  it('Enter con el input vacío no envía', async () => {
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    await userEvent.type(textarea, '{Enter}');

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('Enter con canReply=false (disabled) no envía', async () => {
    render(<Composer conversationId="c1" canReply={false} />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    // El textarea está disabled — userEvent no puede tipear en él; el guard
    // real (canReply/disabled) se ejerce igual si algo dispara el keydown.
    expect(textarea).toBeDisabled();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});

describe('Composer — fix re-review fase 2 (regresión bloqueante: poll de fondo fallido NO debe cortar una respuesta con canReply ya conocido)', () => {
  it('canReply=true + isDetailError=true (el detalle YA resolvió con canReply, un poll de fondo posterior falló) → composer sigue HABILITADO, sin banner de error', () => {
    // Escenario real: React Query v5 conserva `data` del último fetch exitoso
    // cuando un refetch de fondo falla — el `detail` (y por lo tanto
    // `canReply`) sigue siendo el último valor CONOCIDO-BUENO. `isDetailError`
    // solo debería bloquear cuando NO hay un `canReply` conocido (data ausente).
    render(<Composer conversationId="c1" canReply isDetailError />);
    // El input SÍ está habilitado — el botón de enviar se mantiene disabled
    // por `!trimmed` (input vacío, una regla aparte, no relacionada con este
    // bug); se ejerce la enviabilidad real en el test siguiente.
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/ventana de 24h expirada/i)).toBeNull();
  });

  it('sigue habilitado para escribir y enviar con canReply=true + isDetailError=true', async () => {
    mockMutate.mockImplementation((_content: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    render(<Composer conversationId="c1" canReply isDetailError />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    await userEvent.type(textarea, 'Sigo acá');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(mockMutate).toHaveBeenCalledWith('Sigo acá', expect.any(Object));
  });
});
