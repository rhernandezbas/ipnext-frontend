/**
 * ChatwootLabelsCard — chatwoot-label-config-fe (Configuración → WhatsApp).
 * Pedido textual del usuario: "el crear label tiene que estar en
 * configuración" — la creación del catálogo de etiquetas de Chatwoot se mudó
 * del composer del bulk (`ChatwootLabelSelector`) a esta card. Integración
 * REAL contra los hooks (`useChatwootLabels`/`useCreateChatwootLabel`,
 * `useBulkMessaging.ts`) con el api mockeado a nivel fetch (molde
 * `CampaignComposer.chatwootLabel.test.tsx`) — el "crear → aparece en la
 * lista" ejercita el `setQueryData` síncrono real del hook (F2-bis), no un
 * mock del hook.
 *
 *  CLC-1 loading → mensaje de carga
 *  CLC-2 error → role=alert + "Reintentar" dispara un refetch real
 *  CLC-3 catálogo vacío → aviso, sin lista
 *  CLC-4 con etiquetas → cada una con swatch dot aria-hidden + título
 *  CLC-5 gate `messaging.manage`: CTA "Crear etiqueta…" visible CON el
 *        permiso, oculto SIN él — la lista se ve en ambos casos
 *  CLC-6 crear una etiqueta OK: el modal cierra y la etiqueta nueva aparece
 *        en la lista (junto con las preexistentes)
 *  CLC-7 400/503 al crear se muestra en el modal, que sigue abierto
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/messagingBulk.api', () => ({
  listChatwootLabels: vi.fn(),
  createChatwootLabel: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions');

import { listChatwootLabels, createChatwootLabel } from '@/api/messagingBulk.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { ChatwootLabelsCard } from '@/components/settings/ChatwootLabelsCard';
import type { ChatwootLabelDto } from '@/types/messagingBulk';

const COBRANZAS: ChatwootLabelDto = { title: 'cobranzas', color: '#e63946' };

/** Molde `CampaignComposer.chatwootLabel.test.tsx`: permisos a partir de la lista concedida. */
function mockPerms(granted: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: granted,
    isLoading: false,
    isError: false,
    can: (permission: string | string[]) => {
      const perms = Array.isArray(permission) ? permission : [permission];
      return perms.some((p) => granted.includes(p));
    },
  } as UseMyPermissionsResult);
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<ChatwootLabelsCard />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms(['messaging.templates', 'messaging.manage']);
});

describe('CLC-1: loading', () => {
  it('muestra mensaje de carga', () => {
    vi.mocked(listChatwootLabels).mockReturnValue(new Promise(() => {}));
    renderCard();
    expect(screen.getByText(/cargando etiquetas de chatwoot/i)).toBeInTheDocument();
  });
});

describe('CLC-2: error', () => {
  it('muestra role=alert y "Reintentar" dispara un refetch real', async () => {
    vi.mocked(listChatwootLabels).mockRejectedValueOnce(new Error('network')).mockResolvedValue([COBRANZAS]);
    const user = userEvent.setup();
    renderCard();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(screen.getByText('cobranzas')).toBeInTheDocument());
  });
});

describe('CLC-3: catálogo vacío', () => {
  it('muestra un aviso, sin lista', async () => {
    vi.mocked(listChatwootLabels).mockResolvedValue([]);
    renderCard();
    expect(await screen.findByText(/no hay etiquetas de chatwoot todav[ií]a/i)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});

describe('CLC-4: con etiquetas', () => {
  it('lista cada etiqueta con un swatch dot aria-hidden + su título', async () => {
    vi.mocked(listChatwootLabels).mockResolvedValue([COBRANZAS]);
    renderCard();

    const item = await screen.findByRole('listitem');
    expect(within(item).getByText('cobranzas')).toBeInTheDocument();
    const dot = item.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect((dot as HTMLElement).style.backgroundColor).toBe('#e63946');
  });
});

describe('CLC-5: gate messaging.manage', () => {
  it('con el permiso, muestra el CTA "Crear etiqueta…"', async () => {
    vi.mocked(listChatwootLabels).mockResolvedValue([COBRANZAS]);
    renderCard();
    expect(await screen.findByRole('button', { name: /crear etiqueta/i })).toBeInTheDocument();
  });

  it('sin el permiso, oculta el CTA — la lista sigue visible', async () => {
    mockPerms(['messaging.templates']);
    vi.mocked(listChatwootLabels).mockResolvedValue([COBRANZAS]);
    renderCard();

    expect(await screen.findByText('cobranzas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear etiqueta/i })).not.toBeInTheDocument();
  });
});

describe('CLC-6: crear etiqueta desde la card', () => {
  it('al crear OK, el modal cierra y la etiqueta nueva aparece en la lista', async () => {
    // El fetch inicial trae solo COBRANZAS; el refetch que dispara
    // `invalidateQueries` (tras crear) simula el catálogo YA crecido en el
    // servidor — sin esto, ese refetch pisaría el `setQueryData` optimista
    // del hook con una respuesta vieja de un solo elemento.
    vi.mocked(listChatwootLabels)
      .mockResolvedValueOnce([COBRANZAS])
      .mockResolvedValue([COBRANZAS, { title: 'promo-julio', color: '#1f93ff' }]);
    vi.mocked(createChatwootLabel).mockResolvedValue({ title: 'promo-julio', color: '#1f93ff' });
    const user = userEvent.setup();
    renderCard();

    await screen.findByText('cobranzas');
    await user.click(screen.getByRole('button', { name: /crear etiqueta/i }));

    const modal = await screen.findByRole('dialog', { name: /crear label de chatwoot/i });
    await user.type(within(modal).getByLabelText(/nombre/i), 'Promo Julio');
    await user.click(within(modal).getByRole('button', { name: /^crear$/i }));

    await waitFor(() => expect(createChatwootLabel).toHaveBeenCalledWith({ title: 'promo-julio', color: '#1f93ff' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /crear label de chatwoot/i })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('promo-julio')).toBeInTheDocument();
    expect(screen.getByText('cobranzas')).toBeInTheDocument();
  });
});

describe('CLC-7: error al crear', () => {
  it('400/503 se muestra en el modal, que sigue abierto', async () => {
    vi.mocked(listChatwootLabels).mockResolvedValue([]);
    vi.mocked(createChatwootLabel).mockRejectedValue(
      Object.assign(new Error('503'), {
        isAxiosError: true,
        response: { status: 503, data: { error: 'Chatwoot no disponible', code: 'CHATWOOT_UNAVAILABLE' } },
      }),
    );
    const user = userEvent.setup();
    renderCard();

    await screen.findByText(/no hay etiquetas de chatwoot todav[ií]a/i);
    await user.click(screen.getByRole('button', { name: /crear etiqueta/i }));
    const modal = await screen.findByRole('dialog', { name: /crear label de chatwoot/i });
    await user.type(within(modal).getByLabelText(/nombre/i), 'Cobranzas');
    await user.click(within(modal).getByRole('button', { name: /^crear$/i }));

    expect(await within(modal).findByText(/ya existe o chatwoot no est[aá] disponible/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /crear label de chatwoot/i })).toBeInTheDocument();
  });
});
