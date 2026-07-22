/**
 * WhatsappSettingsPage tests
 *
 * Primera página de Ajustes del dominio WhatsApp (F1.5 polish). Sigue el
 * patrón simple (sin tabs) de NetworkingSettingsPage: header + secciones
 * gateadas con <Can>, cada una con su card de flag.
 *
 * Covers:
 *  1. Page renders heading + breadcrumb
 *  2. ChatMediaDownloadCard renders when user has messaging.read
 *  3. Fallback renders when user lacks messaging.read
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));
// chatwoot-hub-sendpath — ChatwootSendPathCard usa useConfirm (toggle ON/OFF
// pide confirmación, igual que RadiusAutoCureCard/FiberAutoProvisionCard).
// Acá solo importa el WIRING/gating de la sección; el confirm en sí ya tiene
// cobertura propia en ChatwootSendPathCard.test.tsx.
vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: vi.fn(),
}));
// Ola 4 — la sección de respuestas rápidas (gateada por `messaging.manage`)
// usa `useCannedResponses` (useQuery real). Se mockea el api a nivel fetch para
// que renderice sin red — solo importa cuando el permiso está presente.
vi.mock('@/api/cannedResponses.api', () => ({
  listCannedResponses: vi.fn().mockResolvedValue([]),
  createCannedResponse: vi.fn(),
  updateCannedResponse: vi.fn(),
  deleteCannedResponse: vi.fn(),
}));
// Ola 5 (labels) — el ABM de etiquetas tiene su propio test (react-query +
// ConfirmProvider). Acá solo importa el WIRING/gating de la sección, así que se
// stubbea el body para no arrastrar sus providers.
vi.mock('@/pages/whatsapp/settings/MessagingLabelsBody', () => ({
  MessagingLabelsBody: () => <div>catálogo de etiquetas</div>,
}));
// N1-FE (Difusión NOC) — la card tiene su propio test (mockea sus hooks GET/PUT/
// POST). Acá solo importa el WIRING/gating de la sección (gate messaging.manage),
// así que se stubbea la card para no arrastrar sus hooks de red.
vi.mock('@/components/settings/NocBroadcastCard', () => ({
  NocBroadcastCard: () => <div>tarjeta difusión noc</div>,
}));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import WhatsappSettingsPage from '@/pages/whatsapp/WhatsappSettingsPage';

function setupHooks(permissions: string[] = ['messaging.read']) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p: string | string[], _mode?: string) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some(perm => permissions.includes(perm));
    },
  } as never);

  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));

  vi.mocked(useFeatureFlag).mockReturnValue({
    data: { key: 'chat-media-download', enabled: false },
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useFeatureFlag>);

  vi.mocked(useSetFeatureFlag).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  } as unknown as ReturnType<typeof useSetFeatureFlag>);

  vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<WhatsappSettingsPage />, { wrapper });
}

describe('WhatsappSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders breadcrumb and page title', () => {
    setupHooks();
    renderPage();
    expect(screen.getByText('WhatsApp /')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /configuración/i })).toBeInTheDocument();
  });

  it('renders ChatMediaDownloadCard content when user has messaging.read', () => {
    setupHooks(['messaging.read']);
    renderPage();
    expect(screen.getByText(/descarga de media de whatsapp/i)).toBeInTheDocument();
  });

  it('renders fallback when user lacks messaging.read', () => {
    setupHooks([]);
    renderPage();
    // Ola 5 (labels) — ahora hay 2 secciones gateadas (Media por messaging.read,
    // Etiquetas por messaging.manage): sin ninguno de los dos permisos, ambas
    // muestran el fallback "No tenés permiso…".
    expect(screen.getAllByText(/no tenés permiso/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/descarga de media de whatsapp/i)).not.toBeInTheDocument();
  });

  // ── chatwoot-hub-sendpath: card de envío vía Chatwoot (gate messaging.read) ─
  it('renders the "Envío" section heading and ChatwootSendPathCard content when user has messaging.read', () => {
    setupHooks(['messaging.read']);
    renderPage();
    expect(screen.getByRole('heading', { name: /^envío$/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /envío vía chatwoot \(eje central\)/i }),
    ).toBeInTheDocument();
  });

  it('hides ChatwootSendPathCard content (fallback instead) without messaging.read', () => {
    setupHooks([]);
    renderPage();
    expect(
      screen.queryByRole('heading', { name: /envío vía chatwoot \(eje central\)/i }),
    ).not.toBeInTheDocument();
  });

  // ── Ola 4: gestión de respuestas rápidas (gate messaging.manage) ──────────
  it('renders the canned responses section when user has messaging.manage', () => {
    setupHooks(['messaging.read', 'messaging.manage']);
    renderPage();
    expect(screen.getByRole('heading', { name: /respuestas r[aá]pidas/i })).toBeInTheDocument();
  });

  it('hides the canned responses section (and its heading) without messaging.manage', () => {
    setupHooks(['messaging.read']);
    renderPage();
    expect(screen.queryByRole('heading', { name: /respuestas r[aá]pidas/i })).not.toBeInTheDocument();
  });

  // ── Ola 5: catálogo de etiquetas (gate messaging.manage) ──────────────────
  it('Ola 5 (labels) — con messaging.manage, monta el ABM de etiquetas', () => {
    setupHooks(['messaging.read', 'messaging.manage']);
    renderPage();
    expect(screen.getByRole('heading', { name: /^etiquetas$/i })).toBeInTheDocument();
    expect(screen.getByText(/catálogo de etiquetas/i)).toBeInTheDocument();
  });

  it('Ola 5 (labels) — sin messaging.manage, la sección Etiquetas queda en fallback', () => {
    setupHooks(['messaging.read']);
    renderPage();
    // La sección Media SÍ (tiene read); la de Etiquetas NO (falta manage).
    expect(screen.getByText(/descarga de media de whatsapp/i)).toBeInTheDocument();
    expect(screen.getByText(/no tenés permiso/i)).toBeInTheDocument();
    expect(screen.queryByText(/catálogo de etiquetas/i)).not.toBeInTheDocument();
  });

  // ── N1-FE: Difusión NOC (Evolution API) — gate messaging.manage ────────────
  it('Difusión NOC — con messaging.manage, monta la sección y la card', () => {
    setupHooks(['messaging.read', 'messaging.manage']);
    renderPage();
    expect(screen.getByRole('heading', { name: /difusión noc/i })).toBeInTheDocument();
    expect(screen.getByText(/tarjeta difusión noc/i)).toBeInTheDocument();
  });

  it('Difusión NOC — sin messaging.manage, ni la sección ni su encabezado se renderizan', () => {
    setupHooks(['messaging.read']);
    renderPage();
    expect(screen.queryByRole('heading', { name: /difusión noc/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/tarjeta difusión noc/i)).not.toBeInTheDocument();
  });
});
