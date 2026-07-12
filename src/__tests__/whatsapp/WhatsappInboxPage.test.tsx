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
  WhatsappInboxClientContext,
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

const RICH_MARIA: WhatsappInboxClientContext = {
  status: 'matched',
  client: {
    id: 'cli-1',
    name: 'Maria Gomez',
    email: null,
    phone: null,
    status: 'active',
    fichaClientId: 'cli-1',
    balance: { due: null, currency: null, isDebtor: false, stale: false, lastRefreshedAt: null },
    lastInvoice: null,
    nextDueDate: null,
    contracts: [],
    openTicketsCount: 0,
    recentTickets: [],
    recentTasks: [],
    recentLogs: [],
  },
};

const DETAIL_A_AMBIG: WhatsappConversationDetail = {
  ...CONV_A,
  canReply: true,
  clientContext: {
    status: 'ambiguous',
    clients: [
      { id: 'a1', name: 'Candidato Uno', status: 'active' },
      { id: 'a2', name: 'Candidato Dos', status: 'active' },
    ],
  },
};

const DETAIL_B_AMBIG: WhatsappConversationDetail = {
  ...CONV_B,
  canReply: true,
  clientContext: {
    status: 'ambiguous',
    clients: [{ id: 'b1', name: 'Candidato Tres', status: 'active' }],
  },
};

const RICH_CHOSEN: WhatsappInboxClientContext = {
  status: 'matched',
  client: {
    id: 'a1',
    name: 'Cliente Elegido A1',
    email: null,
    phone: null,
    status: 'active',
    fichaClientId: 'a1',
    balance: { due: null, currency: null, isDebtor: false, stale: false, lastRefreshedAt: null },
    lastInvoice: null,
    nextDueDate: null,
    contracts: [],
    openTicketsCount: 0,
    recentTickets: [],
    recentTasks: [],
    recentLogs: [],
  },
};

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
  richContext,
}: {
  conversations?: WhatsappPaginatedResult<WhatsappConversationListItem>;
  detail?: WhatsappConversationDetail;
  messages?: WhatsappMessage[];
  /** Contexto RICO (F1.5) que devolvería `useInboxClientContext` cuando el
   * panel dispara el fetch (matched / ambiguous ya elegido). Sin esto, el
   * panel queda en estado neutro aunque `detail.clientContext` sea `matched`
   * (el nombre/deuda/etc. ahora vienen del fetch rico, no del lightContext). */
  richContext?: WhatsappInboxClientContext;
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
  // messaging-inbox-v2 F1.5 (F5): `ClientContextPanel` ahora es un container
  // que llama a `useInboxClientContext` incondicionalmente (reglas de hooks).
  // Sin este default, cualquier test que renderice el panel con una
  // conversación `matched`/`ambiguous`-elegida crashearía leyendo
  // `.isLoading`/`.data` de `undefined` (automock de `@/hooks/useWhatsapp`).
  vi.mocked(useWhatsappModule.useInboxClientContext).mockReturnValue({
    ...mockQuery({ data: richContext, isLoading: false, isError: false }),
    isRefreshingBalance: false,
    balanceRefreshFailed: false,
  } as ReturnType<typeof useWhatsappModule.useInboxClientContext>);
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
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B, richContext: RICH_MARIA });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    // "buenas" aparece TAMBIÉN como preview en la fila de la lista — se
    // escopea al contenido real del thread (data-testid de MessageThread).
    expect(within(screen.getByTestId('message-thread-list')).getByText('buenas')).toBeInTheDocument();
    // ClientContextPanel matched — nombre del cliente resuelto (region = el
    // <section aria-labelledby> del panel de contexto). Se nombra "Cliente"
    // explícitamente porque F1.5 (design §10) agrega sub-secciones propias
    // (Financiero/Servicio/Interacciones), cada una TAMBIÉN un landmark
    // `region` con su propio heading — sin el nombre, `getByRole('region')`
    // es ambiguo (5 regiones anidadas en vez de 1).
    expect(within(screen.getByRole('region', { name: 'Cliente' })).getByText('Maria Gomez')).toBeInTheDocument();
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

describe('WhatsappInboxPage — F5 (messaging-inbox-v2): wiring de conversationId+lightContext al ClientContextPanel', () => {
  it('al seleccionar una conversación matched, el panel dispara el fetch rico con conversationId=selectedId', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    // DETAIL_B.clientContext = {status:'matched', clients:[{id:'cli-1',...}]}
    // → ClientContextPanel dispara useInboxClientContext(conversationId, null).
    expect(useWhatsappModule.useInboxClientContext).toHaveBeenLastCalledWith('conv-b', null);
  });

  it('sin selección, el panel recibe lightContext undefined (conversationId "") y queda en estado neutro', () => {
    renderPage();

    expect(screen.getByText('Sin información de contexto disponible.')).toBeInTheDocument();
  });
});

describe('WhatsappInboxPage — bug BLOQUEANTE (chosenId pegado entre conversaciones, F1.5 review adversarial)', () => {
  it('elegir un candidato en la conversación A y cambiar a B (ambiguous con candidatos DISTINTOS) muestra el CandidatePicker de B, NO el MatchedClientView del candidato de A', async () => {
    // `ClientContextPanel` se renderizaba sin `key` — su `chosenId` (useState
    // interno) sobrevivía al cambio de conversación. Repro: A ambiguous →
    // elegir un candidato → B ambiguous (candidatos distintos) → sin la key,
    // el panel queda "pegado" mostrando el MatchedClientView del candidato de
    // A en vez del CandidatePicker de B.
    vi.mocked(useWhatsappModule.useWhatsappConversation).mockImplementation((id: string) => {
      if (id === 'conv-a') return mockQuery({ data: DETAIL_A_AMBIG, isLoading: false });
      if (id === 'conv-b') return mockQuery({ data: DETAIL_B_AMBIG, isLoading: false });
      return mockQuery({ data: undefined, isLoading: false });
    });
    vi.mocked(useWhatsappModule.useInboxClientContext).mockReturnValue({
      ...mockQuery<WhatsappInboxClientContext>({ data: RICH_CHOSEN, isLoading: false, isError: false }),
      isRefreshingBalance: false,
      balanceRefreshFailed: false,
    } as ReturnType<typeof useWhatsappModule.useInboxClientContext>);

    const user = userEvent.setup();
    renderPage();

    // Conversación A (ambiguous) → elegir "Candidato Uno".
    await user.click(screen.getByRole('button', { name: /Conversación con Juan Perez/i }));
    expect(screen.getByText('Candidato Uno')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /elegir/i })[0]!);
    expect(screen.getByText('Cliente Elegido A1')).toBeInTheDocument();

    // Cambiar a conversación B (ambiguous, candidatos DISTINTOS de los de A).
    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    expect(screen.getByText(/varios clientes posibles/i)).toBeInTheDocument();
    expect(screen.getByText('Candidato Tres')).toBeInTheDocument();
    expect(screen.queryByText('Cliente Elegido A1')).not.toBeInTheDocument();
  });
});
