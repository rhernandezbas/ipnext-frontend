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
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  WhatsappInboxViewCounts,
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
  viewCounts,
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
  /** inbox-views Ola 1 — contadores del sub-menú. Default `undefined`
   * (counts caídos/cargando): el sub-menú se pinta SIN números, así el
   * accname de cada vista queda pelado ("Todas", "Resueltas", …) y el resto
   * de la suite interactúa por nombre exacto sin acoplarse a los counts. */
  viewCounts?: WhatsappInboxViewCounts;
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
  // internal-notes F1.5 (EDITAR/ELIMINAR NOTA): defaults neutros — cada test
  // que necesite espiar `editNote`/`deleteNote` los sobreescribe.
  vi.mocked(useWhatsappModule.useEditWhatsappNote).mockReturnValue({
    editNote: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useWhatsappModule.useEditWhatsappNote>);
  vi.mocked(useWhatsappModule.useDeleteWhatsappNote).mockReturnValue({
    deleteNote: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useWhatsappModule.useDeleteWhatsappNote>);
  vi.mocked(useWhatsappModule.useAssignableUsers).mockReturnValue(
    mockQuery<WhatsappAssignee[]>({ data: [], isLoading: false }),
  );
  vi.mocked(useWhatsappModule.useMessagingAreas).mockReturnValue(
    mockQuery<WhatsappArea[]>({ data: [], isLoading: false }),
  );
  // inbox-views Ola 1 — counts del sub-menú (ver el comment de `viewCounts`).
  vi.mocked(useWhatsappModule.useInboxViewCounts).mockReturnValue(
    mockQuery<WhatsappInboxViewCounts>({ data: viewCounts, isLoading: false }),
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
  it('llama a useWhatsappConversations con un query estable (status:"open" default, inbox-resolve D5) y a los hooks de detalle/mensajes con "" sin selección', () => {
    renderPage();

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenCalledWith({ status: 'open' });
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

describe('WhatsappInboxPage — internal-notes F1.5: wiring de editar/eliminar nota + error por código', () => {
  const NOTE: WhatsappMessage = {
    id: 'note-x',
    direction: 'outbound',
    content: 'ojo, cliente moroso',
    senderName: 'Agente',
    sentAt: '2026-07-12T12:00:00.000Z',
    private: true,
    canEdit: true,
    canDelete: true,
  };

  it('useEditWhatsappNote/useDeleteWhatsappNote se llaman con el selectedId', async () => {
    setHooks({});
    const user = userEvent.setup();
    renderPage();
    // sin selección → ''
    expect(useWhatsappModule.useEditWhatsappNote).toHaveBeenCalledWith('');
    expect(useWhatsappModule.useDeleteWhatsappNote).toHaveBeenCalledWith('');

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    expect(useWhatsappModule.useEditWhatsappNote).toHaveBeenLastCalledWith('conv-b');
    expect(useWhatsappModule.useDeleteWhatsappNote).toHaveBeenLastCalledWith('conv-b');
  });

  it('si el DELETE de la nota falla, el toast muestra el mensaje mapeado por código (409 → "ya fue eliminada")', async () => {
    const deleteNote = vi.fn((_id: string, opts?: { onError?: (err: unknown) => void }) => {
      opts?.onError?.({ response: { data: { code: 'INTERNAL_NOTE_ALREADY_DELETED' } } });
    });
    setHooks({ detail: DETAIL_B, messages: [NOTE] });
    vi.mocked(useWhatsappModule.useDeleteWhatsappNote).mockReturnValue({
      deleteNote,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useDeleteWhatsappNote>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: 'Eliminar nota' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/ya fue eliminada/i);
  });

  it('si el PATCH de edición falla con 403, el toast dice "no tenés permiso para editar esta nota"', async () => {
    const editNote = vi.fn((_id: string, _content: string, opts?: { onError?: (err: unknown) => void }) => {
      opts?.onError?.({ response: { data: { code: 'INTERNAL_NOTE_FORBIDDEN' } } });
    });
    setHooks({ detail: DETAIL_B, messages: [NOTE] });
    vi.mocked(useWhatsappModule.useEditWhatsappNote).mockReturnValue({
      editNote,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useEditWhatsappNote>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: 'Editar nota' }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/no ten[eé]s permiso.*editar.*nota/i);
  });

  it('LOW review: un 403 en el flujo DELETE dice "eliminar" (handleDeleteNote pasa action="delete"), NO "editar"', async () => {
    const deleteNote = vi.fn((_id: string, opts?: { onError?: (err: unknown) => void }) => {
      opts?.onError?.({ response: { data: { code: 'INTERNAL_NOTE_FORBIDDEN' } } });
    });
    setHooks({ detail: DETAIL_B, messages: [NOTE] });
    vi.mocked(useWhatsappModule.useDeleteWhatsappNote).mockReturnValue({
      deleteNote,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useDeleteWhatsappNote>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: 'Eliminar nota' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/no ten[eé]s permiso.*eliminar.*nota/i);
    expect(alert).not.toHaveTextContent(/editar/i);
  });
});

describe('WhatsappInboxPage — inbox-resolve (UNDO-1): resolver directo + toast "Deshacer"', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolver muestra un toast con "Deshacer" (sin confirm previo)', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /^resolver/i }));

    expect(screen.getByText('Conversación resuelta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeInTheDocument();
  });

  it('MEDIUM 5.1 (review adversarial, fix wave) — el toast de undo usa role="status" + aria-live="polite" (no interrumpe un éxito rutinario)', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /^resolver/i }));

    // `getByRole('status', {name})` no sirve acá: el role="status" NO admite
    // "name from content" (accname spec) y, además, `Composer` YA monta su
    // propio `role="status"` sr-only (anuncia el modo Responder/Nota) apenas
    // hay conversación seleccionada — escopeamos por `data-kind` (atributo
    // que YA distingue error/undo en la implementación) en vez de pelear
    // con el cómputo de accessible name.
    const toast = container.querySelector('[data-kind="undo"]');
    expect(toast).not.toBeNull();
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });

  it('MEDIUM 5.1 (review adversarial, fix wave) — el foco se mueve al botón "Deshacer" al aparecer el toast (teclado/lector puede accionarlo sin tabular toda la página)', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /^resolver/i }));

    expect(screen.getByRole('button', { name: /deshacer/i })).toHaveFocus();
  });

  it('reabrir (next="open") NO muestra el toast de Deshacer (UNDO-1 es solo para resolver)', async () => {
    setHooks({ detail: { ...DETAIL_B, status: 'resolved' }, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /reabrir/i }));

    expect(screen.queryByRole('alert')).toBeNull();
    // `container.querySelector` (no `getByRole('status')`): `Composer` ya
    // monta su propio `role="status"` sr-only (anuncia el modo
    // Responder/Nota) — sin escopear por `data-kind`, este chequeo sería
    // ajeno al toast de undo.
    expect(container.querySelector('[data-kind="undo"]')).toBeNull();
  });

  it('click en "Deshacer" despacha setStatus("open") para el convId capturado al resolver', async () => {
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
    await user.click(screen.getByRole('button', { name: /^resolver/i }));
    expect(setStatus).toHaveBeenLastCalledWith('resolved', expect.objectContaining({ onError: expect.any(Function) }));

    await user.click(screen.getByRole('button', { name: /deshacer/i }));

    expect(setStatus).toHaveBeenLastCalledWith('open', expect.objectContaining({ onError: expect.any(Function) }));
    expect(screen.queryByRole('button', { name: /deshacer/i })).toBeNull();
  });

  it('MEDIUM 5.1 (review adversarial, fix wave) — al hacer click en "Deshacer", el foco vuelve al elemento que lo tenía antes (no queda huérfano tras desmontarse el botón)', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    const resolverButton = screen.getByRole('button', { name: /^resolver/i });
    await user.click(resolverButton);
    const undoButton = screen.getByRole('button', { name: /deshacer/i });
    expect(undoButton).toHaveFocus();

    await user.click(undoButton);

    expect(resolverButton).toHaveFocus();
  });

  it('el toast de Deshacer expira a los ~5s sin dejar timer colgado', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /^resolver/i }));
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.queryByRole('button', { name: /deshacer/i })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('[data-kind="undo"]')).toBeNull();
  });

  it('MEDIUM 5.1 (review adversarial, fix wave) — al expirar el toast de undo (5s), el foco se restaura al elemento que lo tenía antes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    const resolverButton = screen.getByRole('button', { name: /^resolver/i });
    await user.click(resolverButton);
    expect(screen.getByRole('button', { name: /deshacer/i })).toHaveFocus();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(resolverButton).toHaveFocus();
  });

  it('MEDIUM 5.1 (review adversarial, fix wave) — NO le roba el foco al agente si ya lo movió a otro elemento (ej. empezó a tipear en el Composer) antes de que el toast expire', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /^resolver/i }));
    expect(screen.getByRole('button', { name: /deshacer/i })).toHaveFocus();

    const textarea = screen.getByRole('textbox', { name: /mensaje/i });
    await user.click(textarea);
    expect(textarea).toHaveFocus();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(textarea).toHaveFocus();
  });

  it('el toast de Deshacer se descarta al cambiar de conversación (misma disciplina que el toast de error — inbox-key-por-conversacion)', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /^resolver/i }));
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Conversación con Juan Perez/i }));

    expect(screen.queryByRole('button', { name: /deshacer/i })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('[data-kind="undo"]')).toBeNull();
  });

  it('si el POST de resolver falla (async, simulando latencia real), el toast de ERROR reemplaza al de Deshacer (prioridad, UNDO-1)', async () => {
    let rejectResolve: (() => void) | null = null;
    const setStatus = vi.fn((_next: string, opts?: { onError?: (err: unknown) => void }) => {
      rejectResolve = () => opts?.onError?.(new Error('503 chatwoot caído'));
    });
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    await user.click(screen.getByRole('button', { name: /^resolver/i }));
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeInTheDocument();

    // el POST falla DESPUÉS (simula la latencia real de red — a diferencia
    // del mock síncrono de la describe de arriba).
    act(() => {
      rejectResolve?.();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo/i);
    expect(container.querySelector('[data-kind="undo"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /deshacer/i })).toBeNull();
  });

  // MEDIUM #3 (review adversarial F1.5-C, ya cubierto arriba en el describe
  // dedicado) confirma que el toast de ERROR mantiene role="alert" +
  // aria-live="assertive" — acá se agrega el chequeo explícito de
  // aria-live, que ese test original no verificaba (MEDIUM 5.1, fix wave).
  it('MEDIUM 5.1 (review adversarial, fix wave) — el toast de ERROR mantiene role="alert" + aria-live="assertive" (SÍ debe interrumpir)', async () => {
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
    await user.click(screen.getByRole('button', { name: /^resolver/i }));

    const toast = screen.getByRole('alert');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
  });
});

describe('WhatsappInboxPage — inbox-resolve: Reabrir funciona seleccionando desde la vista Resueltas', () => {
  it('vista Resueltas → seleccionar una conversación resuelta → Reabrir llama a setStatus("open") (el toggle existente ya lo permite)', async () => {
    const CONV_RESOLVED: WhatsappConversationListItem = { ...CONV_B, id: 'conv-r', contactName: 'Resuelta Uno', status: 'resolved' };
    const setStatus = vi.fn();
    setHooks({
      conversations: { data: [CONV_A, CONV_B, CONV_RESOLVED], total: 3, page: 1, limit: 50 },
      detail: { ...DETAIL_B, id: 'conv-r', status: 'resolved' },
      messages: MESSAGES_B,
    });
    vi.mocked(useWhatsappModule.useSetConversationStatus).mockReturnValue({
      setStatus,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWhatsappModule.useSetConversationStatus>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Resueltas' }));
    expect(screen.getByRole('button', { name: /Conversación con Resuelta Uno/i })).toBeInTheDocument();
    // las abiertas no aparecen en esta tab.
    expect(screen.queryByRole('button', { name: /Conversación con Maria Gomez/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: /Conversación con Resuelta Uno/i }));
    await user.click(screen.getByRole('button', { name: /^reabrir/i }));

    expect(setStatus).toHaveBeenCalledWith('open', expect.objectContaining({ onError: expect.any(Function) }));
  });
});

describe('WhatsappInboxPage — inbox-views Ola 1: sub-menú de vistas (pin del query por vista)', () => {
  it('por default la vista "Todas" está activa (aria-current) y llama a useWhatsappConversations con {status:"open"} — cero regresión del cache entry inicial', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-current', 'page');
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenCalledWith({ status: 'open' });
  });

  it('"Mi bandeja" pasa {status:"open",assignment:"mine"} a useWhatsappConversations', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Mi bandeja' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'open', assignment: 'mine' });
  });

  it('"Sin atender" pasa {view:"unattended"} — SIN status ni assignment (view gana sobre status en el BE)', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Sin atender' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ view: 'unattended' });
  });

  it('"Sin asignar" pasa {status:"open",assignment:"unassigned"}', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Sin asignar' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'open', assignment: 'unassigned' });
  });

  it('volver a "Todas" (desde "Mi bandeja") vuelve a {status:"open"} — mismo cache entry que el estado inicial', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Mi bandeja' }));
    await user.click(screen.getByRole('button', { name: 'Todas' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'open' });
  });

  it('los presets NO acumulan ejes: Mi bandeja → Resueltas deja {status:"resolved"} SIN assignment', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Mi bandeja' }));
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'open', assignment: 'mine' });

    await user.click(screen.getByRole('button', { name: 'Resueltas' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'resolved' });
  });

  it('aria-current acompaña a la vista activa (y deja a la anterior sin marcar)', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Sin atender' }));

    expect(screen.getByRole('button', { name: 'Sin atender' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Todas' })).not.toHaveAttribute('aria-current');
  });
});

describe('WhatsappInboxPage — inbox-views Ola 1: counts del sub-menú (badges vivos)', () => {
  const COUNTS: WhatsappInboxViewCounts = { mine: 4, unattended: 7, all: 23, unassigned: 0, resolved: 118 };

  it('pide useInboxViewCounts y pinta el contador de cada vista (incluido el CERO — es información)', () => {
    setHooks({ viewCounts: COUNTS });
    renderPage();

    expect(useWhatsappModule.useInboxViewCounts).toHaveBeenCalled();
    const nav = screen.getByRole('navigation', { name: 'Vistas del inbox' });
    expect(within(nav).getByRole('button', { name: 'Sin atender, 7 conversaciones' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Sin asignar, 0 conversaciones' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Resueltas, 118 conversaciones' })).toBeInTheDocument();
  });

  it('con >99 el badge visual muestra "99+" (el accname conserva el número real)', () => {
    setHooks({ viewCounts: { ...COUNTS, all: 240 } });
    renderPage();

    const all = screen.getByRole('button', { name: 'Todas, 240 conversaciones' });
    expect(within(all).getByText('99+')).toBeInTheDocument();
  });

  it('si el hook de counts falla (403 sin messaging:read / 503), el sub-menú queda SIN números pero 100% operable', async () => {
    setHooks(); // viewCounts undefined = counts caídos
    vi.mocked(useWhatsappModule.useInboxViewCounts).mockReturnValue(
      mockQuery<WhatsappInboxViewCounts>({ data: undefined, isLoading: false, isError: true, error: new Error('403') }),
    );
    const user = userEvent.setup();
    renderPage();

    const nav = screen.getByRole('navigation', { name: 'Vistas del inbox' });
    // las 5 vistas presentes, con accname pelado (sin ", N conversaciones").
    expect(within(nav).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Mi bandeja',
      'Sin atender',
      'Todas',
      'Sin asignar',
      'Resueltas',
    ]);
    // y sigue navegable: el click cambia el query igual.
    await user.click(within(nav).getByRole('button', { name: 'Sin atender' }));
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ view: 'unattended' });
  });
});

describe('WhatsappInboxPage — inbox-views Ola 1: los controles viejos se fueron de la barra de la lista', () => {
  it('no queda NINGÚN radio (tabs Abiertas/Resueltas + radios Todas/Mías/Sin asignar murieron — el sub-menú es la única fuente)', () => {
    renderPage();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});

describe('WhatsappInboxPage — inbox-resolve (TAB-1, enmendado inbox-views): la vista Resueltas filtra server-side', () => {
  it('cambiar a Resueltas pasa {status:"resolved"} a useWhatsappConversations', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Resueltas' }));

    expect(screen.getByRole('button', { name: 'Resueltas' })).toHaveAttribute('aria-current', 'page');
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'resolved' });
  });

});

describe('WhatsappInboxPage — inbox-resolve (TAB-3): selectedId/thread sobreviven al resolve y al cambio de tab', () => {
  it('resolver la conversación seleccionada NO toca selectedId — el thread sigue montado (design D8, paridad Chatwoot)', async () => {
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

    // el thread de conv-b sigue montado (composer + mensajes), nada se
    // desmontó ni se deseleccionó por resolver.
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeInTheDocument();
    expect(useWhatsappModule.useWhatsappConversation).toHaveBeenLastCalledWith('conv-b');
    expect(useWhatsappModule.useWhatsappMessages).toHaveBeenLastCalledWith('conv-b');
  });

  it('cambiar de vista (Todas → Resueltas) NO toca selectedId — el thread de la conversación seleccionada sigue montado', async () => {
    setHooks({ detail: DETAIL_B, messages: MESSAGES_B });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Conversación con Maria Gomez/i }));
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resueltas' }));

    expect(useWhatsappModule.useWhatsappConversation).toHaveBeenLastCalledWith('conv-b');
    expect(useWhatsappModule.useWhatsappMessages).toHaveBeenLastCalledWith('conv-b');
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeInTheDocument();
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

  it('por default (sin elegir campaña) llama a useWhatsappConversations con {status:"open"} — cero regresión', () => {
    setCampaigns(CAMPAIGNS);
    renderPage();
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenCalledWith({ status: 'open' });
  });

  it('elegir una campaña pasa {status:"open",campaignId} a useWhatsappConversations (filtro SERVER-SIDE)', async () => {
    setCampaigns(CAMPAIGNS);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));
    await user.click(screen.getByRole('option', { name: 'Black Friday' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'open', campaignId: 'camp-2' });
  });

  it('volver a "Todas las campañas" LIMPIA el filtro → {status:"open"} (mismo cache entry que el estado inicial)', async () => {
    setCampaigns(CAMPAIGNS);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));
    await user.click(screen.getByRole('option', { name: 'Recordatorio Julio' }));
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'open', campaignId: 'camp-1' });

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));
    await user.click(screen.getByRole('option', { name: /todas las campañas/i }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'open' });
  });

  it('el filtro de campaña y la vista activa coexisten (ambos server-side en el mismo query)', async () => {
    setCampaigns(CAMPAIGNS);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Mi bandeja' }));
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'open', assignment: 'mine' });

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));
    await user.click(screen.getByRole('option', { name: 'Black Friday' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'open', assignment: 'mine', campaignId: 'camp-2' });
  });

  it('cambiar de vista PRESERVA el filtro de campaña activo (los presets pisan status/assignment/view, jamás campaignId)', async () => {
    setCampaigns(CAMPAIGNS);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));
    await user.click(screen.getByRole('option', { name: 'Black Friday' }));
    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ status: 'open', campaignId: 'camp-2' });

    await user.click(screen.getByRole('button', { name: 'Sin atender' }));

    expect(useWhatsappModule.useWhatsappConversations).toHaveBeenLastCalledWith({ view: 'unattended', campaignId: 'camp-2' });
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
