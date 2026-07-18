/**
 * Composer — respuestas rápidas / macros (Ola 4). El composer ACTIVO (modo
 * "Respuesta", NO nota, NO template) gana un picker de respuestas rápidas:
 * botón 💬 dedicado + atajo "/" al inicio del textarea vacío (estilo Chatwoot).
 * Al elegir, el `content` se INSERTA en el textarea; si se abrió por "/", se
 * reemplaza el "/". El envío normal no se toca.
 *
 * `@/hooks/useCannedResponses` se mockea (el picker es hijo condicional del
 * composer — solo se monta al abrir; sin mock, su `useQuery` real necesitaría
 * un QueryClientProvider que estos tests no montan — mismo criterio que el
 * panel de templates con `useSendableTemplates`).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useWhatsapp');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useCannedResponses');

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useCannedResponsesModule from '@/hooks/useCannedResponses';
import { Composer } from './Composer';
import type { CannedResponse } from '@/types/cannedResponses';

const mockSend = vi.fn();

type SendApi = ReturnType<typeof useWhatsappModule.useSendWhatsappMessage>;
type ListReturn = ReturnType<typeof useCannedResponsesModule.useCannedResponses>;

const SALUDO: CannedResponse = {
  id: 'cr-1',
  shortcut: 'saludo',
  content: 'Hola, ¿en qué te puedo ayudar?',
  createdById: 'u1',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

function setCanned(data: CannedResponse[] = [SALUDO]) {
  vi.mocked(useCannedResponsesModule.useCannedResponses).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  } as unknown as ListReturn);
}

beforeEach(() => {
  mockSend.mockReset();
  vi.mocked(useWhatsappModule.useSendWhatsappMessage).mockReturnValue({
    send: mockSend,
    retry: vi.fn(),
    discard: vi.fn(),
    isError: false,
    error: null,
  } as unknown as SendApi);
  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    permissions: ['messaging.send'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: () => true,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
  setCanned();
  (globalThis as { URL: typeof URL }).URL.createObjectURL = vi.fn(() => 'blob:mock');
  (globalThis as { URL: typeof URL }).URL.revokeObjectURL = vi.fn();
});

describe('Composer — respuestas rápidas: botón 💬', () => {
  it('en modo reply hay un botón accesible de respuestas rápidas', () => {
    render(<Composer conversationId="c1" canReply />);
    expect(screen.getByRole('button', { name: /respuestas r[aá]pidas/i })).toBeInTheDocument();
  });

  it('clickear el botón abre el popover (combobox de búsqueda)', async () => {
    render(<Composer conversationId="c1" canReply />);
    expect(screen.queryByRole('combobox', { name: /buscar respuesta r[aá]pida/i })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /respuestas r[aá]pidas/i }));

    expect(screen.getByRole('combobox', { name: /buscar respuesta r[aá]pida/i })).toBeInTheDocument();
  });

  it('en modo nota NO se renderiza el botón de respuestas rápidas', async () => {
    render(<Composer conversationId="c1" canReply />);
    await userEvent.click(screen.getByRole('radio', { name: 'Nota interna' }));
    expect(screen.queryByRole('button', { name: /respuestas r[aá]pidas/i })).toBeNull();
  });
});

describe('Composer — respuestas rápidas: atajo "/"', () => {
  it('tipear "/" al inicio del textarea vacío abre el popover', () => {
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    fireEvent.change(textarea, { target: { value: '/' } });

    expect(screen.getByRole('combobox', { name: /buscar respuesta r[aá]pida/i })).toBeInTheDocument();
  });

  it('un "/" en el MEDIO del texto NO abre el popover (solo al inicio del vacío)', async () => {
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });

    await userEvent.type(textarea, 'hola/');

    expect(screen.queryByRole('combobox', { name: /buscar respuesta r[aá]pida/i })).toBeNull();
  });
});

describe('Composer — respuestas rápidas: insertar', () => {
  it('elegir por botón inserta el content en el textarea y cierra el popover', async () => {
    render(<Composer conversationId="c1" canReply />);
    await userEvent.click(screen.getByRole('button', { name: /respuestas r[aá]pidas/i }));
    await userEvent.click(screen.getByRole('option', { name: /saludo/i }));

    const textarea = screen.getByRole('textbox', { name: /mensaje/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe(SALUDO.content);
    expect(screen.queryByRole('combobox', { name: /buscar respuesta r[aá]pida/i })).toBeNull();
  });

  it('abierto por "/", elegir REEMPLAZA el "/" (no queda "/Hola…")', async () => {
    render(<Composer conversationId="c1" canReply />);
    const textarea = screen.getByRole('textbox', { name: /mensaje/i }) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: '/' } });
    await userEvent.click(await screen.findByRole('option', { name: /saludo/i }));

    expect(textarea.value).toBe(SALUDO.content);
  });

  it('tras insertar, el envío normal sigue funcionando (send con el content insertado)', async () => {
    render(<Composer conversationId="c1" canReply />);
    await userEvent.click(screen.getByRole('button', { name: /respuestas r[aá]pidas/i }));
    await userEvent.click(screen.getByRole('option', { name: /saludo/i }));
    await userEvent.click(screen.getByRole('button', { name: /^enviar mensaje$/i }));

    expect(mockSend).toHaveBeenCalledWith({ content: SALUDO.content, files: [], drafts: [] });
  });
});
