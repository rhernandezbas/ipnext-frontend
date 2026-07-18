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
// Ola 4 — la sección de respuestas rápidas (gateada por `messaging.manage`)
// usa `useCannedResponses` (useQuery real). Se mockea el api a nivel fetch para
// que renderice sin red — solo importa cuando el permiso está presente.
vi.mock('@/api/cannedResponses.api', () => ({
  listCannedResponses: vi.fn().mockResolvedValue([]),
  createCannedResponse: vi.fn(),
  updateCannedResponse: vi.fn(),
  deleteCannedResponse: vi.fn(),
}));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
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
  } as unknown as ReturnType<typeof useSetFeatureFlag>);
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
    expect(screen.getByText(/no tenés permiso/i)).toBeInTheDocument();
    expect(screen.queryByText(/descarga de media de whatsapp/i)).not.toBeInTheDocument();
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
});
