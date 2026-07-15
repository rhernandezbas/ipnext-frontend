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
// messaging-bulk-inbox Change 2 — la page ahora pide el catálogo de campañas
// (`useCampaigns`, gateado por `messaging.bulk`) para poblar el filtro de
// campaña. Auto-mock: `setHooks` fija un default vacío (sin campañas → sin
// filtro montado, cero interferencia con el resto de la suite).
vi.mock('@/hooks/useBulkMessaging');

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useBulkMessagingModule from '@/hooks/useBulkMessaging';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import WhatsappInboxPage from '@/pages/whatsapp/WhatsappInboxPage';
import type { CampaignSummaryDto, PaginatedResult } from '@/types/messagingBulk';
import type {
  PendingSend,
  WhatsappArea,
  WhatsappAssignee,
  WhatsappConversationListItem,
  WhatsappConversationDetail,
  WhatsappInboxClientContext,
  WhatsappMessage,
  WhatsappPaginatedResult,
} from '@/types/whatsapp';

function campaign(over: Partial<CampaignSummaryDto> & { id: string; name: string }): CampaignSummaryDto {
  return {
    templateName: null,
    status: 'done',
    total: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    optedOutCount: 0,
    createdAt: '2026-07-01T00:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    ...over,
  };
}

function setCampaigns(campaigns: CampaignSummaryDto[]) {
  const page: PaginatedResult<CampaignSummaryDto> = { data: campaigns, total: campaigns.length, page: 1, limit: 50 };
  vi.mocked(useBulkMessagingModule.useCampaigns).mockReturnValue(
    mockQuery<PaginatedResult<CampaignSummaryDto>>({ data: page, isLoading: false }),
  );
}

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
  pendingSends = [],
}: {
  conversations?: WhatsappPaginatedResult<WhatsappConversationListItem>;
  detail?: WhatsappConversationDetail;
  messages?: WhatsappMessage[];
  /** Contexto RICO (F1.5) que devolvería `useInboxClientContext` cuando el
   * panel dispara el fetch (matched / ambiguous ya elegido). Sin esto, el
   * panel queda en estado neutro aunque `detail.clientContext` sea `matched`
   * (el nombre/deuda/etc. ahora vienen del fetch rico, no del lightContext). */
  richContext?: WhatsappInboxClientContext;
  /** messaging-inbox-v2-media F1.5 fase A, Tanda 2 (ENVIAR) — envíos en
   * vuelo que `usePendingSends` devolvería para la conversación abierta. */
  pendingSends?: PendingSend[];
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
    send: vi.fn(),
    retry: vi.fn(),
    discard: vi.fn(),
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useWhatsappModule.useSendWhatsappMessage>);
  vi.mocked(useWhatsappModule.usePendingSends).mockReturnValue(pendingSends);
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
  // messaging-inbox-productivity F1.5-C v1 (Resolver/Reabrir): default
  // neutro — cada test que necesite espiar `setStatus`/`isPending` lo
  // sobreescribe con su propio mock.
  vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
    setStatus: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
  // messaging-inbox-assignment F1.5-C2 (ASIGNACIÓN): defaults neutros —
  // cada test que necesite espiar `setAssignee`/`setArea` los sobreescribe.
  vi.mocked(useWhatsappModule.useSetConversationAssignee).mockReturnValue({
    setAssignee: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationAssignee>);
  vi.mocked(useWhatsappModule.useSetConversationArea).mockReturnValue({
    setArea: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationArea>);
  vi.mocked(useWhatsappModule.useAssignableUsers).mockReturnValue(
    mockQuery<WhatsappAssignee[]>({ data: [], isLoading: false }),
  );
  vi.mocked(useWhatsappModule.useMessagingAreas).mockReturnValue(
    mockQuery<WhatsappArea[]>({ data: [], isLoading: false }),
  );
  // messaging-bulk-inbox Change 2 — default vacío: sin campañas el filtro de
  // campaña no se monta (cada test que lo necesite llama a `setCampaigns`).
  vi.mocked(useBulkMessagingModule.useCampaigns).mockReturnValue(
    mockQuery<PaginatedResult<CampaignSummaryDto>>({ data: undefined, isLoading: false }),
  );
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
  // F1.5 spec #1 (panel de contexto COLAPSABLE): la preferencia se persiste
  // en localStorage (key `wa:context-collapsed`) — sin este clear, un test
  // que la setee contaminaría el resto de la suite (jsdom conserva
  // localStorage entre tests del mismo archivo).
  window.localStorage.clear();
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

describe('WhatsappInboxPage — wiring de pendingSends (messaging-inbox-v2-media F1.5 fase A, Tanda 2 — ENVIAR, design §6.3)', () => {
  function pending(over: Partial<PendingSend> = {}): PendingSend {
    return {
      tempId: 'optimistic:1',
      content: 'en vuelo',
      drafts: [],
      progress: 0.5,
      status: 'sending',
      createdAt: '2026-07-12T00:00:00.000Z',
      isPrivate: false,
      ...over,
    };
  }

  it('usePendingSends(selectedId) llega hasta MessageThread — la burbuja optimista se ve en el thread abierto', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B, pendingSends: [pending()] });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    expect(useWhatsappModule.usePendingSends).toHaveBeenLastCalledWith('conv-b');
    expect(within(screen.getByTestId('message-thread-list')).getByText('en vuelo')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('"Reintentar" en una burbuja failed llama a retry() del hook con ESE pending', async () => {
    const retryFn = vi.fn();
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B, pendingSends: [pending({ status: 'failed', tempId: 'optimistic:fail-1' })] });
    vi.mocked(useWhatsappModule.useSendWhatsappMessage).mockReturnValue({
      send: vi.fn(),
      retry: retryFn,
      discard: vi.fn(),
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSendWhatsappMessage>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(retryFn).toHaveBeenCalledWith(expect.objectContaining({ tempId: 'optimistic:fail-1' }));
  });
});

describe('WhatsappInboxPage — bug CRÍTICO #1 (Composer sin key: contaminación entre conversaciones)', () => {
  it('cambiar de conversación limpia el composer — el texto tipeado para A no sobrevive al cambiar a B', async () => {
    setHooks({ detail: DETAIL_B, messages: [] });
    // `detail` es constante en este mock (no depende del id seleccionado) —
    // alcanza para verificar que el composer se REMONTA (limpia su propio
    // estado local) al cambiar de conversación, más allá de qué `detail`
    // devuelva el mock.
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Juan Perez/i }));
    const textareaA = screen.getByRole('textbox', { name: /mensaje/i });
    await user.type(textareaA, 'Mensaje para Juan');
    expect(textareaA).toHaveValue('Mensaje para Juan');

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    const textareaB = screen.getByRole('textbox', { name: /mensaje/i });

    expect(textareaB).toHaveValue('');
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

describe('WhatsappInboxPage — F1.5-C v1 (Resolver/Reabrir): wiring de useSetConversationStatus', () => {
  it('llama a useSetConversationStatus con el selectedId (o "" sin selección)', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(useWhatsappModule.useSetConversationStatus).toHaveBeenCalledWith('');

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    expect(useWhatsappModule.useSetConversationStatus).toHaveBeenLastCalledWith('conv-b');
  });

  it('el header del thread muestra "Resolver" para CONV_B (status "pending" → tratado como "no resuelta") y el click llama a setStatus("resolved")', async () => {
    const setStatus = vi.fn();
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /resolver/i }));

    // hallazgo MEDIUM #3 (review adversarial): `setStatus` ahora reenvía un
    // 2do argumento (`{onError}`) para poder surfacear el error de la
    // mutation (antes descartado en silencio) — ver el describe de abajo.
    expect(setStatus).toHaveBeenCalledWith('resolved', expect.objectContaining({ onError: expect.any(Function) }));
  });

  it('isPending de la mutation deshabilita el botón Resolver/Reabrir del header', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    expect(screen.getByRole('button', { name: /resolver/i })).toBeDisabled();
  });

  it('sin selección, el header no muestra ningún control de estado (nada que resolver todavía)', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: /resolver|reabrir/i })).toBeNull();
  });
});

describe('WhatsappInboxPage — hallazgo MEDIUM #3 (review adversarial: surface de error de useSetConversationStatus, hoy silenciosa)', () => {
  it('si el POST de status falla, se muestra un feedback de error visible (role="alert") — antes el único indicio era el badge animando ida y vuelta', async () => {
    // Simula EXACTAMENTE lo que hace la mutation real cuando el POST falla:
    // invoca el `onError` que el caller pasó como 2do argumento (ver
    // `useSetConversationStatus`, `useWhatsapp.ts` — `opts` se reenvía a
    // `mutation.mutate`). Acá se mockea el hook entero (mismo criterio que
    // el resto de este describe), así que se simula el callback a mano.
    const setStatus = vi.fn((_next: string, opts?: { onError?: (err: unknown) => void }) => {
      opts?.onError?.(new Error('503 chatwoot caído'));
    });
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    expect(screen.queryByRole('alert')).toBeNull();

    await user.click(screen.getByRole('button', { name: /resolver/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo/i);
  });

  it('el toast de error NO queda pegado al cambiar de conversación (contaminación entre conversaciones, memoria inbox-key-por-conversacion)', async () => {
    const setStatus = vi.fn((_next: string, opts?: { onError?: (err: unknown) => void }) => {
      opts?.onError?.(new Error('503 chatwoot caído'));
    });
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /resolver/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo/i);

    // el agente cambia a OTRA conversación dentro de la ventana de 4s del toast:
    // el banner de error de Maria NO debe quedar visible sobre Juan (leería
    // como que la conversación ACTUAL falló cuando fue otra).
    await user.click(screen.getByRole('button', { name: /Conversación con Juan Perez/i }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('WhatsappInboxPage — F1.5-C2 (ASIGNACIÓN): filtro Todas/Mías/Sin asignar (server-side)', () => {
  it('por default llama a useWhatsappConversations con {} (sin assignment) — cero regresión del wiring existente', () => {
    renderPage();
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenCalledWith({});
  });

  it('cambiar a la pestaña "Mías" pasa {assignment:"mine"} a useWhatsappConversations', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Mías' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ assignment: 'mine' });
  });

  it('cambiar a "Sin asignar" pasa {assignment:"unassigned"}', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Sin asignar' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ assignment: 'unassigned' });
  });

  it('volver a "Todas" (desde "Mías") vuelve a {} — mismo cache entry que el estado inicial', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Mías' }));
    await user.click(screen.getByRole('radio', { name: 'Todas' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({});
  });
});

describe('WhatsappInboxPage — Change 2 (BULK): filtro de campaña (Select propio, server-side)', () => {
  const CAMPAIGNS = [
    campaign({ id: 'camp-1', name: 'Recordatorio Julio' }),
    campaign({ id: 'camp-2', name: 'Black Friday' }),
  ];

  it('sin campañas en el catálogo, NO monta el filtro de campaña (nada útil que filtrar)', () => {
    renderPage();
    expect(screen.queryByRole('combobox', { name: /campaña/i })).toBeNull();
  });

  it('con campañas, monta el filtro (combobox PROPIO, no <select> nativo) mostrando "Todas las campañas"', () => {
    setCampaigns(CAMPAIGNS);
    const { container } = renderPage();

    const combobox = screen.getByRole('combobox', { name: /campaña/i });
    expect(combobox).toHaveTextContent(/todas las campañas/i);
    expect(combobox.tagName).toBe('BUTTON');
    expect(container.querySelector('select')).toBeNull();
  });

  it('por default (sin elegir campaña) llama a useWhatsappConversations con {} — cero regresión', () => {
    setCampaigns(CAMPAIGNS);
    renderPage();
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenCalledWith({});
  });

  it('elegir una campaña pasa {campaignId} a useWhatsappConversations (filtro SERVER-SIDE)', async () => {
    setCampaigns(CAMPAIGNS);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));
    await user.click(screen.getByRole('option', { name: 'Black Friday' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ campaignId: 'camp-2' });
  });

  it('volver a "Todas las campañas" LIMPIA el filtro → {} (mismo cache entry que el estado inicial)', async () => {
    setCampaigns(CAMPAIGNS);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));
    await user.click(screen.getByRole('option', { name: 'Recordatorio Julio' }));
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ campaignId: 'camp-1' });

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));
    await user.click(screen.getByRole('option', { name: /todas las campañas/i }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({});
  });

  it('el filtro de campaña y el de asignación coexisten (ambos server-side en el mismo query)', async () => {
    setCampaigns(CAMPAIGNS);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Mías' }));
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ assignment: 'mine' });

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));
    await user.click(screen.getByRole('option', { name: 'Black Friday' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ assignment: 'mine', campaignId: 'camp-2' });
  });
});

describe('WhatsappInboxPage — Change 2 (BULK): gate del catálogo de campañas por messaging.bulk', () => {
  it('con messaging.bulk, useCampaigns se pide con enabled:true', () => {
    renderPage();
    expect(useBulkMessagingModule.useCampaigns).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('sin messaging.bulk, useCampaigns se pide con enabled:false (no se pide el catálogo)', () => {
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      permissions: [],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => false,
    } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
    renderPage();
    expect(useBulkMessagingModule.useCampaigns).toHaveBeenCalledWith(expect.anything(), false);
  });
});

describe('WhatsappInboxPage — F1.5-C2 (ASIGNACIÓN): wiring de assignee/area al header del thread', () => {
  const USER_ANA: WhatsappAssignee = { id: 'u1', name: 'Ana Torres' };
  const AREA_SOPORTE: WhatsappArea = { id: 'a1', name: 'Soporte', color: '#2563eb' };

  it('useAssignableUsers/useMessagingAreas se llaman incondicionalmente (catálogos de página, no por-conversación)', () => {
    renderPage();
    expect(useWhatsappModule.useAssignableUsers).toHaveBeenCalled();
    expect(useWhatsappModule.useMessagingAreas).toHaveBeenCalled();
  });

  it('useSetConversationAssignee/useSetConversationArea se llaman con el selectedId (o "" sin selección)', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(useWhatsappModule.useSetConversationAssignee).toHaveBeenCalledWith('');
    expect(useWhatsappModule.useSetConversationArea).toHaveBeenCalledWith('');

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    expect(useWhatsappModule.useSetConversationAssignee).toHaveBeenLastCalledWith('conv-b');
    expect(useWhatsappModule.useSetConversationArea).toHaveBeenLastCalledWith('conv-b');
  });

  it('el header muestra los selects con el catálogo + el assignee/area actuales de la conversación seleccionada', async () => {
    setHooks({ detail: { ...DETAIL_B, assignee: USER_ANA, area: AREA_SOPORTE }, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useAssignableUsers).mockReturnValue(
      mockQuery<WhatsappAssignee[]>({ data: [USER_ANA], isLoading: false }),
    );
    vi.mocked(useWhatsappModule.useMessagingAreas).mockReturnValue(
      mockQuery<WhatsappArea[]>({ data: [AREA_SOPORTE], isLoading: false }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    expect(screen.getByRole('combobox', { name: /asignar a/i })).toHaveValue('u1');
    expect(screen.getByRole('combobox', { name: /^área$/i })).toHaveValue('a1');
  });

  it('elegir un agente en el select llama a setAssignee del hook', async () => {
    const setAssignee = vi.fn();
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useAssignableUsers).mockReturnValue(
      mockQuery<WhatsappAssignee[]>({ data: [USER_ANA], isLoading: false }),
    );
    vi.mocked(useWhatsappModule.useSetConversationAssignee).mockReturnValue({
      setAssignee,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationAssignee>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), 'u1');

    // hallazgo HIGH #2 (review adversarial): `setAssignee` ahora reenvía un
    // 2do argumento (`{onError}`) para poder surfacear el error de la
    // mutation (antes descartado en silencio, a diferencia de status) — ver
    // el describe dedicado a ese hallazgo, más abajo.
    expect(setAssignee).toHaveBeenCalledWith(USER_ANA, expect.objectContaining({ onError: expect.any(Function) }));
  });

  it('elegir un área en el select llama a setArea del hook', async () => {
    const setArea = vi.fn();
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useMessagingAreas).mockReturnValue(
      mockQuery<WhatsappArea[]>({ data: [AREA_SOPORTE], isLoading: false }),
    );
    vi.mocked(useWhatsappModule.useSetConversationArea).mockReturnValue({
      setArea,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationArea>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /^área$/i }), 'a1');

    // hallazgo HIGH #2 (review adversarial): mismo criterio que setAssignee arriba.
    expect(setArea).toHaveBeenCalledWith(AREA_SOPORTE, expect.objectContaining({ onError: expect.any(Function) }));
  });

  it('isPending de cada mutation deshabilita SOLO su propio select', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationAssignee).mockReturnValue({
      setAssignee: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationAssignee>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    expect(screen.getByRole('combobox', { name: /asignar a/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /^área$/i })).not.toBeDisabled();
  });

  it('sin selección, el header no muestra los selects de asignación', () => {
    renderPage();
    expect(screen.queryByRole('combobox', { name: /asignar a/i })).toBeNull();
  });
});

describe('WhatsappInboxPage — REGRESIÓN + hallazgo LOW #6 (gate: catálogos de asignación solo se piden si el usuario puede asignar)', () => {
  it('sin permiso messaging.send, useAssignableUsers/useMessagingAreas se llaman con enabled:false (no se pide el catálogo)', () => {
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      permissions: [],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => false,
    } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
    renderPage();

    expect(useWhatsappModule.useAssignableUsers).toHaveBeenCalledWith(false);
    expect(useWhatsappModule.useMessagingAreas).toHaveBeenCalledWith(false);
  });

  it('con permiso messaging.send, se llaman con enabled:true', () => {
    renderPage();

    expect(useWhatsappModule.useAssignableUsers).toHaveBeenCalledWith(true);
    expect(useWhatsappModule.useMessagingAreas).toHaveBeenCalledWith(true);
  });
});

describe('WhatsappInboxPage — F1.5 spec #1 (panel de contexto COLAPSABLE, persistido en localStorage)', () => {
  const STORAGE_KEY = 'wa:context-collapsed';

  it('arranca en data-context-collapsed="false" (abierto) cuando no hay nada en localStorage', () => {
    const { container } = renderPage();
    const page = container.firstElementChild as HTMLElement;
    expect(page).toHaveAttribute('data-context-collapsed', 'false');
  });

  it('lee el estado colapsado guardado en localStorage al montar (lazy-init)', () => {
    window.localStorage.setItem(STORAGE_KEY, 'true');
    const { container } = renderPage();
    const page = container.firstElementChild as HTMLElement;
    expect(page).toHaveAttribute('data-context-collapsed', 'true');
  });

  it('clickear el toggle de contexto invierte data-context-collapsed', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    const user = userEvent.setup();
    const { container } = renderPage();
    const page = container.firstElementChild as HTMLElement;

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    expect(page).toHaveAttribute('data-context-collapsed', 'false');

    await user.click(screen.getByRole('button', { name: /ocultar informaci.n del cliente/i }));

    expect(page).toHaveAttribute('data-context-collapsed', 'true');

    await user.click(screen.getByRole('button', { name: /mostrar informaci.n del cliente/i }));

    expect(page).toHaveAttribute('data-context-collapsed', 'false');
  });

  it('persiste el toggle en localStorage al hacer click (write)', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /ocultar informaci.n del cliente/i }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('el panel de contexto (.contextCol) expone un id que aria-controls referencia', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    const toggle = screen.getByRole('button', { name: /informaci.n del cliente/i });
    const controlsId = toggle.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).not.toBeNull();
  });

  it('colapsar el panel NO desmonta ClientContextPanel (sigue montado, solo cambia el layout CSS) — el candidato elegido en un ambiguous sobrevive al toggle', async () => {
    // El call-count de un hook MOCKEADO no sirve para probar "no remontó"
    // (React invoca el hook en CADA render, mock o no). La prueba real de
    // "sigue montado" es que un estado INTERNO de `ClientContextPanel`
    // (`chosenId`, useState propio) sobreviva al toggle — si el componente se
    // desmontara/remontara, `chosenId` volvería a `null` y veríamos de nuevo
    // el CandidatePicker en vez del candidato ya elegido (mismo mecanismo que
    // el bug BLOQUEANTE de más abajo, `key={selectedId}` vs colapso CSS puro).
    vi.mocked(useWhatsappModule.useWhatsappConversation).mockReturnValue(
      mockQuery({ data: DETAIL_A_AMBIG, isLoading: false }),
    );
    vi.mocked(useWhatsappModule.useInboxClientContext).mockReturnValue({
      ...mockQuery<WhatsappInboxClientContext>({ data: RICH_CHOSEN, isLoading: false, isError: false }),
      isRefreshingBalance: false,
      balanceRefreshFailed: false,
    } as ReturnType<typeof useWhatsappModule.useInboxClientContext>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Juan Perez/i }));
    await user.click(screen.getAllByRole('button', { name: /elegir/i })[0]!);
    expect(screen.getByText('Cliente Elegido A1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ocultar informaci.n del cliente/i }));
    await user.click(screen.getByRole('button', { name: /mostrar informaci.n del cliente/i }));

    expect(screen.getByText('Cliente Elegido A1')).toBeInTheDocument();
    expect(screen.queryByText(/varios clientes posibles/i)).not.toBeInTheDocument();
  });
});

describe('WhatsappInboxPage — hallazgo HIGH #2 (review adversarial: sin feedback de error al fallar assignee/area, a diferencia de status)', () => {
  const USER_ANA: WhatsappAssignee = { id: 'u1', name: 'Ana Torres' };
  const AREA_SOPORTE: WhatsappArea = { id: 'a1', name: 'Soporte', color: '#2563eb' };

  it('si el PATCH de assignee falla, se muestra un feedback de error visible (role="alert")', async () => {
    const setAssignee = vi.fn((_next: WhatsappAssignee | null, opts?: { onError?: (err: unknown) => void }) => {
      opts?.onError?.(new Error('403'));
    });
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useAssignableUsers).mockReturnValue(
      mockQuery<WhatsappAssignee[]>({ data: [USER_ANA], isLoading: false }),
    );
    vi.mocked(useWhatsappModule.useSetConversationAssignee).mockReturnValue({
      setAssignee,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationAssignee>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    expect(screen.queryByRole('alert')).toBeNull();

    await user.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), 'u1');

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo/i);
  });

  it('si el PATCH de area falla, se muestra un feedback de error visible (role="alert")', async () => {
    const setArea = vi.fn((_next: WhatsappArea | null, opts?: { onError?: (err: unknown) => void }) => {
      opts?.onError?.(new Error('403'));
    });
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useMessagingAreas).mockReturnValue(
      mockQuery<WhatsappArea[]>({ data: [AREA_SOPORTE], isLoading: false }),
    );
    vi.mocked(useWhatsappModule.useSetConversationArea).mockReturnValue({
      setArea,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationArea>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));

    await user.selectOptions(screen.getByRole('combobox', { name: /^área$/i }), 'a1');

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo/i);
  });

  it('el toast de error de assignee NO queda pegado al cambiar de conversación (mismo criterio que el toast de status)', async () => {
    const setAssignee = vi.fn((_next: WhatsappAssignee | null, opts?: { onError?: (err: unknown) => void }) => {
      opts?.onError?.(new Error('403'));
    });
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useAssignableUsers).mockReturnValue(
      mockQuery<WhatsappAssignee[]>({ data: [USER_ANA], isLoading: false }),
    );
    vi.mocked(useWhatsappModule.useSetConversationAssignee).mockReturnValue({
      setAssignee,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationAssignee>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), 'u1');
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo/i);

    await user.click(screen.getByRole('button', { name: /Conversación con Juan Perez/i }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
