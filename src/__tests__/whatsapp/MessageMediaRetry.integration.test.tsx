/**
 * MessageMediaRetry — integración END-TO-END del botón "Reintentar" de un
 * adjunto `failed` (messaging-inbox-v2-media, fix wave post-review-adversarial
 * — hallazgo CRÍTICO #1, cazado por 2 reviewers independientes).
 *
 * Bug real: `MediaAttachment.tsx` renderizaba `<MediaError filename={...} />`
 * SIN pasar `onRetry` — `MediaAttachments`/`MessageBubble` tampoco tenían el
 * prop en su cadena. El `onClick={onRetry}` de `MediaError` quedaba
 * `undefined`: el botón no hacía NADA (control muerto).
 *
 * A diferencia de `MediaError.test.tsx` (unit, verifica que el CALLBACK se
 * dispare) este test es de INTEGRACIÓN real: usa el hook REAL
 * `useWhatsappMessages` (NO se mockea `@/hooks/useWhatsapp`, a diferencia de
 * `WhatsappInboxPage.test.tsx`) con un `QueryClient` real — solo se mockea el
 * límite de red (`@/api/whatsapp.api`, mismo patrón que `useWhatsapp.test.ts`).
 * Verifica la cadena completa: click en "Reintentar" → invalida
 * `whatsappMessagesKey(conversationId)` → dispara un refetch real que vuelve
 * a llamar a `listWhatsappMessages`.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/whatsapp.api', () => ({
  listWhatsappConversations: vi.fn(),
  getWhatsappConversation: vi.fn(),
  listWhatsappMessages: vi.fn(),
  sendWhatsappMessage: vi.fn(),
  getInboxClientContext: vi.fn(),
  // REGRESIÓN (review adversarial hallazgo #0): `WhatsappInboxPage` ahora
  // también llama a `useAssignableUsers`/`useMessagingAreas` (F1.5-C2,
  // ASIGNACIÓN) — cualquier test que renderice la page entera y mockee este
  // módulo necesita estos 2 exports, aunque el gate `enabled` (hallazgo LOW
  // #6, `useWhatsapp.ts`) los deje sin disparar cuando el usuario no puede
  // asignar. Acá `useMyPermissions` está mockeado con `messaging.send`
  // concedido (ver abajo), así que SÍ se disparan.
  getAssignableUsers: vi.fn(),
  getMessagingAreas: vi.fn(),
  // inbox-views Ola 1: la page ahora también llama a `useInboxViewCounts`
  // (badges del sub-menú de vistas) — mismo criterio que el comment de arriba.
  getInboxViewCounts: vi.fn(),
  // Ola 5 (labels): la page ahora llama a `useMessagingLabels` (catálogo para
  // chips/filtro/control) y arma `useSetConversationLabels` — mismo criterio.
  listMessagingLabels: vi.fn(),
  setConversationLabels: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions');

import * as whatsappApi from '@/api/whatsapp.api';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import WhatsappInboxPage from '@/pages/whatsapp/WhatsappInboxPage';
import type {
  WhatsappConversationDetail,
  WhatsappConversationListItem,
  WhatsappInboxClientContext,
  WhatsappMessage,
  WhatsappPaginatedResult,
} from '@/types/whatsapp';

const CONV: WhatsappConversationListItem = {
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-10T12:00:00.000Z',
  preview: 'una imagen',
  status: 'open',
};

const LIST_PAGE: WhatsappPaginatedResult<WhatsappConversationListItem> = {
  data: [CONV],
  total: 1,
  page: 1,
  limit: 50,
};

const DETAIL: WhatsappConversationDetail = {
  ...CONV,
  canReply: true,
  clientContext: { status: 'unknown', clients: [] },
};

const NEUTRAL_RICH_CONTEXT: WhatsappInboxClientContext = { status: 'unknown' };

const MESSAGE_WITH_FAILED_ATTACHMENT: WhatsappMessage = {
  id: 'm1',
  direction: 'inbound',
  content: '',
  senderName: 'Juan Perez',
  sentAt: '2026-07-10T12:00:00.000Z',
  attachments: [
    {
      id: 'att-1',
      fileType: 'image',
      contentType: 'image/jpeg',
      filename: 'foto.jpg',
      fileSize: 1000,
      width: 800,
      height: 600,
      status: 'failed',
      url: '/api/messaging/attachments/att-1/file',
      thumbUrl: null,
    },
  ],
};

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  const qc = makeQC();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WhatsappInboxPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    permissions: ['messaging.send'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: () => true,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);

  vi.mocked(whatsappApi.listWhatsappConversations).mockResolvedValue(LIST_PAGE);
  vi.mocked(whatsappApi.getWhatsappConversation).mockResolvedValue(DETAIL);
  vi.mocked(whatsappApi.listWhatsappMessages).mockResolvedValue([MESSAGE_WITH_FAILED_ATTACHMENT]);
  vi.mocked(whatsappApi.getInboxClientContext).mockResolvedValue(NEUTRAL_RICH_CONTEXT);
  vi.mocked(whatsappApi.getAssignableUsers).mockResolvedValue([]);
  vi.mocked(whatsappApi.getMessagingAreas).mockResolvedValue([]);
  vi.mocked(whatsappApi.listMessagingLabels).mockResolvedValue([]);
  vi.mocked(whatsappApi.getInboxViewCounts).mockResolvedValue({ mine: 0, unattended: 0, all: 1, unassigned: 0, resolved: 0 });
});

describe('Retry de adjunto failed — bug crítico #1 (onRetry muerto, control sin cablear)', () => {
  it('click en "Reintentar" invalida y REFETCHEA la query real de mensajes del thread (whatsappMessagesKey)', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Conversación con Juan Perez/i }));

    // Adjunto failed visible (MediaError, role=alert) tras el fetch inicial.
    await screen.findByRole('alert');
    expect(whatsappApi.listWhatsappMessages).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    // El fix real: el click debe forzar un refetch de mensajes (2do llamado a
    // la API) — antes del fix, `onRetry` era `undefined` y esto NUNCA pasaba.
    await waitFor(() => {
      expect(whatsappApi.listWhatsappMessages).toHaveBeenCalledTimes(2);
    });
  });
});
