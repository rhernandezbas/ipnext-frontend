/**
 * WhatsappInboxPage — container (messaging-inbox F1, design §1/§2, FB4 task
 * 4.1). Integración: orquesta los 4 hooks de `useWhatsapp.ts` (ya testeados
 * unitariamente en FB1, `useWhatsapp.test.ts` — acá se mockean para verificar
 * el WIRING, no su lógica interna) y compone los paneles presentacionales de
 * FB2/FB3 (`ConversationList`/`MessageThread`/`Composer`/`ClientContextPanel`,
 * cada uno con sus propios tests). `selectedId` es estado LOCAL de la page
 * (design §4, LIST-1) — sobrevive a un refetch de la lista porque nunca lo
 * toca la data de `useWhatsappConversations`.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useWhatsapp');
vi.mock('@/hooks/useMyPermissions');

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import WhatsappInboxPage from '@/pages/whatsapp/WhatsappInboxPage';
import type {
  WhatsappConversationListItem,
  WhatsappConversationDetail,
  WhatsappMessage,
  WhatsappPaginatedResult,
} from '@/types/whatsapp';

const CONV_A: WhatsappConversationListItem = {
  id: 'conv-a',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-10T12:00:00.000Z',
  preview: 'hola, tengo un problema',
  status: 'open',
};

const CONV_B: WhatsappConversationListItem = {
  id: 'conv-b',
  contactName: 'Maria Gomez',
  contactPhone: '+5491100000001',
  lastMessageAt: '2026-07-09T12:00:00.000Z',
  preview: 'buenas',
  status: 'pending',
};

const LIST_PAGE: WhatsappPaginatedResult<WhatsappConversationListItem> = {
  data: [CONV_A, CONV_B],
  total: 2,
  page: 1,
  limit: 50,
};

const DETAIL_B: WhatsappConversationDetail = {
  ...CONV_B,
  canReply: true,
  clientContext: { status: 'matched', clients: [{ id: 'cli-1', name: 'Maria Gomez', status: 'active' }] },
};

const MESSAGES_B: WhatsappMessage[] = [
  { id: 'm1', direction: 'inbound', content: 'buenas', senderName: 'Maria Gomez', sentAt: '2026-07-09T12:00:00.000Z' },
];

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function setCanSend() {
  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    permissions: ['messaging.send'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: () => true,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
}

function setHooks({
  conversations = LIST_PAGE,
  detail,
  messages = [],
}: {
  conversations?: WhatsappPaginatedResult<WhatsappConversationListItem>;
  detail?: WhatsappConversationDetail;
  messages?: WhatsappMessage[];
} = {}) {
  vi.mocked(useWhatsappModule.useWhatsappConversations).mockReturnValue(
    mockQuery({ data: conversations, isLoading: false }),
  );
  vi.mocked(useWhatsappModule.useWhatsappConversation).mockReturnValue(
    mockQuery({ data: detail, isLoading: false }),
  );
  vi.mocked(useWhatsappModule.useWhatsappMessages).mockReturnValue(
    mockQuery({ data: messages, isLoading: false }),
  );
  vi.mocked(useWhatsappModule.useSendWhatsappMessage).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useWhatsappModule.useSendWhatsappMessage>);
}

function renderPage() {
  const qc = makeQC();
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WhatsappInboxPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, qc };
}

beforeEach(() => {
  vi.clearAllMocks();
  setCanSend();
  setHooks();
});

describe('WhatsappInboxPage — wiring de los 4 hooks (FB4, task 4.1)', () => {
  it('llama a useWhatsappConversations con un query estable y a los hooks de detalle/mensajes con "" sin selección', () => {
    renderPage();

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenCalledWith({});
    expect(useWhatsappModule.useWhatsappConversation).toHaveBeenCalledWith('');
    expect(useWhatsappModule.useWhatsappMessages).toHaveBeenCalledWith('');
  });

  it('seleccionar una conversación dispara el detalle/mensajes con ESE id', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    expect(useWhatsappModule.useWhatsappConversation).toHaveBeenLastCalledWith('conv-b');
    expect(useWhatsappModule.useWhatsappMessages).toHaveBeenLastCalledWith('conv-b');
  });
});

describe('WhatsappInboxPage — empty state (sin selección)', () => {
  it('muestra el placeholder del thread y el estado neutro del contexto, sin Composer montado', () => {
    renderPage();

    expect(screen.getByText('Seleccioná una conversación para ver los mensajes.')).toBeInTheDocument();
    expect(screen.getByText('Sin información de contexto disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /mensaje/i })).not.toBeInTheDocument();
  });
});

describe('WhatsappInboxPage — thread + contexto + composer tras seleccionar', () => {
  it('muestra los mensajes del thread, el contexto de cliente y el composer habilitado (canReply)', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    // "buenas" aparece TAMBIÉN como preview en la fila de la lista — se
    // escopea al contenido real del thread (data-testid de MessageThread).
    expect(within(screen.getByTestId('message-thread-list')).getByText('buenas')).toBeInTheDocument();
    // ClientContextPanel matched — nombre del cliente resuelto (region = el
    // <section aria-labelledby> del panel de contexto).
    expect(within(screen.getByRole('region')).getByText('Maria Gomez')).toBeInTheDocument();
    // Composer montado y habilitado (canReply:true en el detalle).
    const textarea = screen.getByRole('textbox', { name: /mensaje/i });
    expect(textarea).toBeEnabled();
  });

  it('canReply:false deshabilita el composer y muestra el aviso de ventana 24h', async () => {
    setHooks({ detail: { ...DETAIL_B, canReply: false }, messages: MESSAGES_B });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeDisabled();
    expect(screen.getByText('Ventana de 24h expirada — se necesita un template')).toBeInTheDocument();
  });
});

describe('WhatsappInboxPage — LIST-1: selectedId sobrevive un refetch de la lista', () => {
  it('la selección se mantiene aunque useWhatsappConversations devuelva una nueva referencia de data (poll)', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    const user = userEvent.setup();
    const { rerender, qc } = renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeInTheDocument();

    // Simula el poll de 15s: nueva referencia de array (misma conv-b, preview
    // actualizado) — NO debe resetear selectedId ni desmontar thread/composer.
    const REFRESHED_PAGE: WhatsappPaginatedResult<WhatsappConversationListItem> = {
      data: [CONV_A, { ...CONV_B, preview: 'una novedad' }],
      total: 2,
      page: 1,
      limit: 50,
    };
    vi.mocked(useWhatsappModule.useWhatsappConversations).mockReturnValue(
      mockQuery({ data: REFRESHED_PAGE, isLoading: false }),
    );

    rerender(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <WhatsappInboxPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // La conversación seguiría seleccionada: el thread de conv-b sigue montado.
    expect(useWhatsappModule.useWhatsappConversation).toHaveBeenLastCalledWith('conv-b');
    expect(useWhatsappModule.useWhatsappMessages).toHaveBeenLastCalledWith('conv-b');
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeInTheDocument();
  });
});

describe('WhatsappInboxPage — data-has-selection (driver del toggle mobile <=860px, design §2/task 4.3)', () => {
  it('arranca en "false" sin selección y pasa a "true" al seleccionar una conversación', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    const page = container.firstElementChild as HTMLElement;
    expect(page).toHaveAttribute('data-has-selection', 'false');

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    expect(page).toHaveAttribute('data-has-selection', 'true');
  });
});

describe('WhatsappInboxPage — bug #8 (mobile trap: volver de thread a lista limpia selectedId)', () => {
  it('clickear "Volver" limpia selectedId, vuelve al placeholder y a data-has-selection="false"', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    const page = container.firstElementChild as HTMLElement;
    expect(page).toHaveAttribute('data-has-selection', 'true');

    await user.click(screen.getByRole('button', { name: /volver a la lista/i }));

    expect(page).toHaveAttribute('data-has-selection', 'false');
    expect(screen.getByText('Seleccioná una conversación para ver los mensajes.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /mensaje/i })).not.toBeInTheDocument();
  });
});

describe('WhatsappInboxPage — bug #12 (header del thread no muestra "Contacto" genérico mientras carga el detalle)', () => {
  it('mientras detail está undefined (fetch-on-open todavía en vuelo), usa el contactName del list-item seleccionado', async () => {
    setHooks({ detail: undefined, messages: [] });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    const header = screen.getByTestId('message-thread-swap');
    expect(within(header).getByText('Maria Gomez')).toBeInTheDocument();
    expect(within(header).queryByText('Contacto')).toBeNull();
  });

  it('con detail ya resuelto, sigue usando el contactName del detail (no el fallback)', async () => {
    setHooks({ detail: { ...DETAIL_B, contactName: 'Nombre Actualizado' }, messages: MESSAGES_B });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    const header = screen.getByTestId('message-thread-swap');
    expect(within(header).getByText('Nombre Actualizado')).toBeInTheDocument();
  });
});

describe('WhatsappInboxPage — bug #4 (wiring: Composer conoce el estado real del detalle, no solo canReply)', () => {
  it('propaga isLoading/isError del detailQuery al Composer para que no mienta "expirada"', async () => {
    setHooks({ detail: undefined, messages: [] });
    vi.mocked(useWhatsappModule.useWhatsappConversation).mockReturnValue(
      mockQuery({ data: undefined, isLoading: true }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    expect(screen.queryByText('Ventana de 24h expirada — se necesita un template')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeDisabled();
  });
});

describe('WhatsappInboxPage — fix re-review fase 2 (regresión bloqueante: un poll de fondo fallido NO debe cortar una respuesta con canReply ya conocido)', () => {
  it('detail con canReply=true + detailQuery.isError=true (React Query v5 conserva `data` tras un refetch de fondo fallido) → composer sigue habilitado, sin banner de error', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    // Simula EXACTAMENTE el escenario reportado: el detalle ya resolvió
    // (`data` presente, `canReply:true`) y un poll de fondo (25s) falló tras
    // los retries — react-query v5 pone `isError:true` pero preserva `data`.
    vi.mocked(useWhatsappModule.useWhatsappConversation).mockReturnValue(
      mockQuery({ data: DETAIL_B, isLoading: false, isError: true }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    const textarea = screen.getByRole('textbox', { name: /mensaje/i });
    expect(textarea).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/ventana de 24h expirada/i)).toBeNull();
  });
});
