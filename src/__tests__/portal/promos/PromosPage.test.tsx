/**
 * PromosPage (promos-admin) — ABM de las promociones que ven los clientes en
 * la app. Container: hooks REALES (`usePromos`/`useCreatePromo`/
 * `useUpdatePromo`/`useAudiencePreview`), `@/api/promos.api` +
 * `@/api/ticketAreas.api` mockeadas a nivel fetch (mismo seam que
 * `WhatsappTemplatesPage.test.tsx`). `useMyPermissions` viene del mock global
 * permisivo (setup.ts, can:()=>true) — el gating negativo vive en
 * `PromosPage.permissions.test.tsx`.
 *
 *  PP-1 lista deriva los 4 estados (Borrador/Publicada/Vencida/Archivada) desde una fixture mixta
 *  PP-2 editar: el form precarga TODOS los campos (texto, fechas, área, segmento)
 *  PP-3 crear: el submit manda el segmento TAL CUAL lo armó el SegmentBuilder (body real de la mutación)
 *  PP-4 panel de audiencia: muestra segmentCount + withAppCount (destacado)
 *  PP-5 panel de audiencia: withAppCount===0 muestra la advertencia explícita (role=alert)
 *  PP-6 publicar: pide confirmación con el impacto y NO llama a update si se cancela
 *  PP-7 publicar: confirmar llama a update con publishedAt
 *  PP-8 el form NO tiene ningún campo de imagen
 */
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/promos.api', () => ({
  promosApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    audiencePreview: vi.fn(),
  },
}));

vi.mock('@/api/ticketAreas.api', () => ({
  ticketAreasApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { promosApi } from '@/api/promos.api';
import { ticketAreasApi } from '@/api/ticketAreas.api';
import PromosPage from '@/pages/portal/PromosPage/PromosPage';
import type { PromoAdminDto } from '@/types/promos';

const EMPTY_SEGMENT_DTO = { statuses: [], balanceMin: null, balanceMax: null, networkSiteId: null, accessPointId: null };

const DRAFT_1: PromoAdminDto = {
  id: 'promo-draft-1',
  title: 'Subí a 600MB',
  summary: 'Duplicá tu velocidad',
  body: 'Texto largo de la promo 1',
  imageStorageKey: null,
  ctaLabel: 'Me interesa',
  ticketAreaId: null,
  segment: { ...EMPTY_SEGMENT_DTO, statuses: ['active'] },
  startsAt: '2026-06-01T00:00:00.000Z',
  endsAt: '2026-12-31T00:00:00.000Z',
  publishedAt: null,
  archivedAt: null,
  authorId: 'user-1',
  authorName: 'superadmin',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const DRAFT_2: PromoAdminDto = { ...DRAFT_1, id: 'promo-draft-2', title: 'Sumá TV', authorName: 'operador2' };

const PUBLISHED: PromoAdminDto = {
  ...DRAFT_1,
  id: 'promo-published',
  title: 'Fibra 1GB',
  publishedAt: '2026-06-05T00:00:00.000Z',
  endsAt: '2027-01-01T00:00:00.000Z',
};

const EXPIRED: PromoAdminDto = {
  ...DRAFT_1,
  id: 'promo-expired',
  title: 'Oferta vieja',
  publishedAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2026-02-01T00:00:00.000Z',
};

const ARCHIVED: PromoAdminDto = {
  ...DRAFT_1,
  id: 'promo-archived',
  title: 'Retirada',
  publishedAt: '2026-01-01T00:00:00.000Z',
  archivedAt: '2026-03-01T00:00:00.000Z',
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<PromosPage />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ticketAreasApi.list).mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PP-1: lista — 4 estados derivados', () => {
  it('renderiza el badge textual correcto para Borrador (x2), Publicada, Vencida y Archivada', async () => {
    vi.mocked(promosApi.list).mockResolvedValue([DRAFT_1, DRAFT_2, PUBLISHED, EXPIRED, ARCHIVED]);
    renderPage();

    await screen.findByText('Subí a 600MB');
    expect(screen.getAllByText('Borrador')).toHaveLength(2);
    expect(screen.getByText('Publicada')).toBeInTheDocument();
    expect(screen.getByText('Vencida')).toBeInTheDocument();
    expect(screen.getByText('Archivada')).toBeInTheDocument();
  });
});

describe('PP-2: editar — precarga TODOS los campos', () => {
  it('precarga título/resumen/cuerpo/cta/fechas/segmento del promo original', async () => {
    vi.mocked(promosApi.list).mockResolvedValue([PUBLISHED]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Fibra 1GB');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Editar promoción')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Título')).toHaveValue(PUBLISHED.title);
    expect(within(dialog).getByLabelText('Resumen')).toHaveValue(PUBLISHED.summary);
    expect(within(dialog).getByLabelText('Cuerpo')).toHaveValue(PUBLISHED.body);
    expect(within(dialog).getByLabelText('Texto del botón (CTA)')).toHaveValue(PUBLISHED.ctaLabel);
    // Segmento precargado — el checkbox "Activo" (segment.statuses=['active']) viene tildado.
    expect(within(dialog).getByRole('checkbox', { name: /^activo$/i })).toBeChecked();
    // Fechas: comparamos contra el MISMO cómputo local que hace el componente
    // (evita atar el test a un timezone fijo, ver no-browser-tz).
    expect(within(dialog).getByLabelText('Vigencia desde')).toHaveValue(toLocalInputExpected(PUBLISHED.startsAt));
    expect(within(dialog).getByLabelText('Vigencia hasta')).toHaveValue(toLocalInputExpected(PUBLISHED.endsAt));
  });
});

describe('PP-3: crear — el segmento viaja TAL CUAL lo armó el SegmentBuilder', () => {
  it('createPromo recibe exactamente el segmento del builder (statuses + balanceMin, sin balanceMax)', async () => {
    vi.mocked(promosApi.list).mockResolvedValue([]);
    vi.mocked(promosApi.create).mockResolvedValue({ ...DRAFT_1, id: 'promo-new' });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/todavía no hay promociones/i);
    await user.click(screen.getAllByRole('button', { name: /crear promoción/i })[0]);
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Título'), 'Nueva promo');
    await user.type(within(dialog).getByLabelText('Resumen'), 'Resumen corto');
    await user.type(within(dialog).getByLabelText('Cuerpo'), 'Cuerpo largo');
    await user.type(within(dialog).getByLabelText('Texto del botón (CTA)'), 'Quiero saber más');
    fireEvent.change(within(dialog).getByLabelText('Vigencia desde'), { target: { value: '2026-08-01T10:00' } });
    fireEvent.change(within(dialog).getByLabelText('Vigencia hasta'), { target: { value: '2026-09-01T10:00' } });

    await user.click(within(dialog).getByRole('checkbox', { name: /atrasado/i }));
    fireEvent.change(within(dialog).getByLabelText(/deuda mínima/i), { target: { value: '500' } });

    await user.click(within(dialog).getByRole('button', { name: 'Crear promoción' }));

    await waitFor(() =>
      expect(promosApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Nueva promo',
          summary: 'Resumen corto',
          body: 'Cuerpo largo',
          ctaLabel: 'Quiero saber más',
          segment: { statuses: ['late'], balanceMin: 500 },
        }),
      ),
    );
  });
});

describe('PP-4/PP-5: panel de audiencia', () => {
  it('muestra segmentCount y withAppCount (destacado) tras el debounce automático', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(promosApi.list).mockResolvedValue([]);
    vi.mocked(promosApi.audiencePreview).mockResolvedValue({ segmentCount: 5317, withAppCount: 1 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await screen.findByText(/todavía no hay promociones/i);
    await user.click(screen.getAllByRole('button', { name: /crear promoción/i })[0]);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('checkbox', { name: /^activo$/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    await waitFor(() => expect(promosApi.audiencePreview).toHaveBeenCalledWith({ statuses: ['active'] }));
    expect(await within(dialog).findByText('1')).toBeInTheDocument();
    expect(within(dialog).getByText(/5[.,]317/)).toBeInTheDocument();
  });

  it('withAppCount === 0 muestra la advertencia explícita (role=alert), no lo esconde', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(promosApi.list).mockResolvedValue([]);
    vi.mocked(promosApi.audiencePreview).mockResolvedValue({ segmentCount: 42, withAppCount: 0 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await screen.findByText(/todavía no hay promociones/i);
    await user.click(screen.getAllByRole('button', { name: /crear promoción/i })[0]);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('checkbox', { name: /^activo$/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    const warning = await within(dialog).findByRole('alert');
    expect(warning).toHaveTextContent(/nadie con la app entra en este segmento/i);
    expect(warning).toHaveTextContent(/no la va a ver ningún cliente/i);
  });
});

describe('PP-6/PP-7: publicar — confirmación con impacto', () => {
  it('pide confirmación mostrando el impacto y NO llama a update si se cancela', async () => {
    vi.mocked(promosApi.list).mockResolvedValue([DRAFT_1]);
    vi.mocked(promosApi.audiencePreview).mockResolvedValue({ segmentCount: 100, withAppCount: 3 });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Subí a 600MB');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Publicar' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Publicar promoción')).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByText(/3 clientes/i)).toBeInTheDocument());
    expect(within(dialog).getByText(/100 en el segmento/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(promosApi.update).not.toHaveBeenCalled();
  });

  it('confirmar llama a update con publishedAt seteado', async () => {
    vi.mocked(promosApi.list).mockResolvedValue([DRAFT_1]);
    vi.mocked(promosApi.audiencePreview).mockResolvedValue({ segmentCount: 100, withAppCount: 3 });
    vi.mocked(promosApi.update).mockResolvedValue({ ...DRAFT_1, publishedAt: '2026-08-01T12:00:00.000Z' });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Subí a 600MB');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Publicar' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByText(/3 clientes/i)).toBeInTheDocument());
    await user.click(within(dialog).getByRole('button', { name: 'Publicar' }));

    await waitFor(() =>
      expect(promosApi.update).toHaveBeenCalledWith(DRAFT_1.id, expect.objectContaining({ publishedAt: expect.any(String) })),
    );
  });
});

describe('PP-8: el form NO tiene campo de imagen', () => {
  it('no renderiza ningún input/label relacionado a imagen', async () => {
    vi.mocked(promosApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText(/todavía no hay promociones/i);
    await user.click(screen.getAllByRole('button', { name: /crear promoción/i })[0]);
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).queryByLabelText(/imagen/i)).not.toBeInTheDocument();
    expect(dialog.querySelector('input[type="file"]')).toBeNull();
    expect(within(dialog).queryByText(/imagen/i)).not.toBeInTheDocument();
  });
});

/** Mismo cómputo LOCAL que `toLocalInput` de `PromoFormModal.tsx` — deliberadamente NO importado (asserción independiente de la implementación, sólo del contrato datetime-local). */
function toLocalInputExpected(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
