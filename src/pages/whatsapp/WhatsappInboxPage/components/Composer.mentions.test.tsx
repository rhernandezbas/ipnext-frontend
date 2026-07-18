/**
 * Composer — @menciones en la NOTA interna (Ola 6). Solo en modo "Nota
 * interna": al tipear "@" se abre un popover con el catálogo de agentes
 * asignables (llega por prop, mismo catálogo que el control de asignación).
 * Elegir inserta el token del contrato BE `@[Nombre](userId)` en el textarea;
 * el envío de la nota NO cambia (el BE parsea el token). En modo Respuesta el
 * "@" NO dispara nada (las menciones son internas).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useWhatsapp');
vi.mock('@/hooks/useMyPermissions');

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import { Composer } from './Composer';
import type { WhatsappAssignee } from '@/types/whatsapp';

const mockSend = vi.fn();

const USERS: WhatsappAssignee[] = [
  { id: 'u-1', name: 'Ana Gómez' },
  { id: 'u-2', name: 'Beto Ruiz' },
];

beforeEach(() => {
  mockSend.mockReset();
  vi.mocked(useWhatsappModule.useSendWhatsappMessage).mockReturnValue({
    send: mockSend,
    retry: vi.fn(),
    discard: vi.fn(),
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useWhatsappModule.useSendWhatsappMessage>);
  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    permissions: ['messaging.send'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: () => true,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
  (globalThis as { URL: typeof URL }).URL.createObjectURL = vi.fn(() => 'blob:mock');
  (globalThis as { URL: typeof URL }).URL.revokeObjectURL = vi.fn();
});

async function enterNoteMode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: /nota interna/i }));
  return screen.getByRole('textbox', { name: /nota interna/i });
}

describe('Composer @menciones — solo en modo nota', () => {
  it('en modo nota, tipear "@" abre el popover con el catálogo de agentes', async () => {
    const user = userEvent.setup();
    render(<Composer conversationId="c1" canReply assignableUsers={USERS} />);
    const textarea = await enterNoteMode(user);

    await user.type(textarea, '@');

    const popover = await screen.findByTestId('mention-popover');
    expect(within(popover).getByText('Ana Gómez')).toBeInTheDocument();
    expect(within(popover).getByText('Beto Ruiz')).toBeInTheDocument();
  });

  it('en modo RESPUESTA, tipear "@" NO abre el popover (las menciones son internas)', async () => {
    const user = userEvent.setup();
    render(<Composer conversationId="c1" canReply assignableUsers={USERS} />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    await user.type(textarea, '@');

    expect(screen.queryByTestId('mention-popover')).toBeNull();
  });

  it('lo tipeado tras el "@" filtra el catálogo', async () => {
    const user = userEvent.setup();
    render(<Composer conversationId="c1" canReply assignableUsers={USERS} />);
    const textarea = await enterNoteMode(user);

    await user.type(textarea, 'aviso @be');

    const popover = await screen.findByTestId('mention-popover');
    expect(within(popover).getByText('Beto Ruiz')).toBeInTheDocument();
    expect(within(popover).queryByText('Ana Gómez')).toBeNull();
  });

  it('elegir un agente inserta el token @[Nombre](userId) y cierra el popover', async () => {
    const user = userEvent.setup();
    render(<Composer conversationId="c1" canReply assignableUsers={USERS} />);
    const textarea = await enterNoteMode(user);

    await user.type(textarea, 'ping @an');
    const popover = await screen.findByTestId('mention-popover');
    await user.click(within(popover).getByText('Ana Gómez'));

    expect(textarea).toHaveValue('ping @[Ana Gómez](u-1) ');
    expect(screen.queryByTestId('mention-popover')).toBeNull();
  });

  it('teclado: ↓ + Enter elige el 2º agente sin enviar la nota', async () => {
    const user = userEvent.setup();
    render(<Composer conversationId="c1" canReply assignableUsers={USERS} />);
    const textarea = await enterNoteMode(user);

    await user.type(textarea, '@');
    await screen.findByTestId('mention-popover');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(textarea).toHaveValue('@[Beto Ruiz](u-2) ');
    // Enter dentro del popover elige, NO envía la nota.
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('Escape cierra el popover sin insertar nada', async () => {
    const user = userEvent.setup();
    render(<Composer conversationId="c1" canReply assignableUsers={USERS} />);
    const textarea = await enterNoteMode(user);

    await user.type(textarea, '@an');
    await screen.findByTestId('mention-popover');
    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('mention-popover')).toBeNull();
    expect(textarea).toHaveValue('@an');
  });

  it('catálogo vacío → popover con "Sin coincidencias" (no rompe)', async () => {
    const user = userEvent.setup();
    render(<Composer conversationId="c1" canReply assignableUsers={[]} />);
    const textarea = await enterNoteMode(user);

    await user.type(textarea, '@');

    const popover = await screen.findByTestId('mention-popover');
    expect(within(popover).getByText(/sin coincidencias/i)).toBeInTheDocument();
  });

  it('la nota se envía con el token crudo en el content (el BE lo parsea)', async () => {
    const user = userEvent.setup();
    render(<Composer conversationId="c1" canReply assignableUsers={USERS} />);
    const textarea = await enterNoteMode(user);

    await user.type(textarea, '@an');
    const popover = await screen.findByTestId('mention-popover');
    await user.click(within(popover).getByText('Ana Gómez'));
    await user.type(textarea, 'revisá esto');
    await user.click(screen.getByRole('button', { name: /agregar nota/i }));

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ content: '@[Ana Gómez](u-1) revisá esto', isPrivate: true }),
    );
  });
});
