/**
 * ClientContextPanel — container fino (messaging-inbox-v2 F1.5, design §1).
 * Reescritura de F1 (histórico: presentacional puro sobre `clientContext`).
 * Preserva los 6 `it` EXISTENTES (matched/unknown/ambiguous/ausente×3) bajo
 * el NUEVO contrato de props (`conversationId` + `lightContext`, F5/design §1)
 * + agrega los escenarios del fetch rico (F4): ambiguous sin elección NO
 * dispara el hook, elegir candidato SÍ lo dispara, loading→skeleton,
 * error sin/con cache.
 *
 * `useInboxClientContext` se MOCKEA (mismo patrón que `WhatsappInboxPage.test.tsx`
 * mockea `useWhatsapp` entero) — este archivo testea el WIRING del container
 * (qué le pasa al hook, qué presentacional delega por estado), no la lógica
 * interna del hook (ya cubierta en `useWhatsapp.test.ts`, WHATS-5).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import type { WhatsappClientContext, WhatsappInboxClientContext } from '@/types/whatsapp';

vi.mock('@/hooks/useWhatsapp');

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import { ClientContextPanel } from './ClientContextPanel';

const RICH_MATCHED: WhatsappInboxClientContext = {
  status: 'matched',
  client: {
    id: '42',
    name: 'Juan Perez',
    email: null,
    phone: null,
    status: 'active',
    fichaClientId: '42',
    balance: { due: 0, currency: 'ARS', isDebtor: false, stale: false, lastRefreshedAt: null },
    lastInvoice: null,
    nextDueDate: null,
    contracts: [],
    openTicketsCount: 0,
    recentTickets: [],
    recentTasks: [],
    recentLogs: [],
  },
};

function mockRich(overrides: Partial<ReturnType<typeof useWhatsappModule.useInboxClientContext>> = {}) {
  vi.mocked(useWhatsappModule.useInboxClientContext).mockReturnValue({
    ...mockQuery<WhatsappInboxClientContext>({ data: undefined, isLoading: false, isError: false }),
    isRefreshingBalance: false,
    balanceRefreshFailed: false,
    ...overrides,
  } as ReturnType<typeof useWhatsappModule.useInboxClientContext>);
}

function renderPanel(lightContext?: WhatsappClientContext | null, conversationId = 'conv-1') {
  return render(
    <MemoryRouter>
      <ClientContextPanel conversationId={conversationId} lightContext={lightContext} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRich();
});

describe('ClientContextPanel — CONTEXT-1 (matched)', () => {
  it('muestra ficha básica + link al cliente', () => {
    mockRich({ data: RICH_MATCHED });
    renderPanel({ status: 'matched', clients: [{ id: '42', name: 'Juan Perez', status: 'active' }] });
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver perfil/i })).toHaveAttribute('href', '/admin/customers/view/42');
  });
});

describe('ClientContextPanel — bug MEDIO a11y (4 landmarks anidados en un panel de 320px)', () => {
  it('con MatchedClientView renderizado, hay UN SOLO landmark "region" (el panel raíz) — Financiero/Servicio/Interacciones ya NO son <section> propios', () => {
    mockRich({ data: RICH_MATCHED });
    renderPanel({ status: 'matched', clients: [{ id: '42', name: 'Juan Perez', status: 'active' }] });

    expect(screen.getAllByRole('region')).toHaveLength(1);
    // Los headings de las sub-secciones se preservan (jerarquía visual/semántica).
    expect(screen.getByRole('heading', { name: 'Financiero', level: 3 })).toBeInTheDocument();
  });
});

describe('ClientContextPanel — CONTEXT-1 (unknown)', () => {
  it('muestra "contacto desconocido" sin datos de cliente', () => {
    renderPanel({ status: 'unknown', clients: [] });
    expect(screen.getByText(/contacto desconocido/i)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('ClientContextPanel — CONTEXT-1 (ambiguous)', () => {
  it('muestra la lista de candidatos (nombre + link) sin elegir uno solo', () => {
    renderPanel({
      status: 'ambiguous',
      clients: [
        { id: '1', name: 'Juan Perez', status: 'active' },
        { id: '2', name: 'Juan P.', status: 'active' },
      ],
    });
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText('Juan P.')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /ver perfil/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/admin/customers/view/1');
    expect(links[1]).toHaveAttribute('href', '/admin/customers/view/2');
  });
});

describe('ClientContextPanel — CONTEXT-1 (contexto ausente)', () => {
  it('sin lightContext (null), muestra un estado neutro y no rompe', () => {
    renderPanel(null);
    expect(screen.getByText(/sin informaci.n de contexto/i)).toBeInTheDocument();
  });

  it('sin lightContext (prop omitida), también neutro', () => {
    render(
      <MemoryRouter>
        <ClientContextPanel />
      </MemoryRouter>,
    );
    expect(screen.getByText(/sin informaci.n de contexto/i)).toBeInTheDocument();
  });

  it('matched con clients vacío (dato malformado) cae a neutro sin crashear', () => {
    renderPanel({ status: 'matched', clients: [] });
    expect(screen.getByText(/sin informaci.n de contexto/i)).toBeInTheDocument();
  });
});

describe('ClientContextPanel — F4: ambiguous sin elección NO dispara el fetch rico', () => {
  it('el hook se llama con (null, null) — efectivamente disabled — mientras no hay chosenId', () => {
    renderPanel({
      status: 'ambiguous',
      clients: [{ id: '1', name: 'Juan Perez', status: 'active' }],
    });

    expect(screen.getByText(/varios clientes posibles/i)).toBeInTheDocument();
    expect(useWhatsappModule.useInboxClientContext).toHaveBeenLastCalledWith(null, null);
  });
});

describe('ClientContextPanel — F4: elegir un candidato dispara el fetch rico con ese clientId', () => {
  it('clickear "Elegir" hace que el hook se llame con (conversationId, clientId elegido)', async () => {
    const user = userEvent.setup();
    renderPanel({
      status: 'ambiguous',
      clients: [
        { id: '1', name: 'Juan Perez', status: 'active' },
        { id: '2', name: 'Juan P.', status: 'active' },
      ],
    });

    await user.click(screen.getAllByRole('button', { name: /elegir/i })[1]!);

    expect(useWhatsappModule.useInboxClientContext).toHaveBeenLastCalledWith('conv-1', '2');
  });
});

describe('ClientContextPanel — F4: loading del fetch rico', () => {
  it('matched con isLoading:true muestra ContextSkeleton (no muestra data vieja)', () => {
    mockRich({ isLoading: true, data: undefined });
    renderPanel({ status: 'matched', clients: [{ id: '42', name: 'Juan Perez', status: 'active' }] });

    expect(screen.queryByText('Juan Perez')).not.toBeInTheDocument();
  });
});

describe('ClientContextPanel — bug ALTO a11y (aria-busy ausente, design §10)', () => {
  it('con richQuery.isLoading:true, el panel (<section aria-labelledby>) tiene aria-busy="true"', () => {
    mockRich({ isLoading: true, data: undefined });
    renderPanel({ status: 'matched', clients: [{ id: '42', name: 'Juan Perez', status: 'active' }] });

    expect(screen.getByRole('region', { name: 'Cliente' })).toHaveAttribute('aria-busy', 'true');
  });

  it('con richQuery.isLoading:false, el panel tiene aria-busy="false"', () => {
    mockRich({ isLoading: false, data: RICH_MATCHED });
    renderPanel({ status: 'matched', clients: [{ id: '42', name: 'Juan Perez', status: 'active' }] });

    expect(screen.getByRole('region', { name: 'Cliente' })).toHaveAttribute('aria-busy', 'false');
  });
});

describe('ClientContextPanel — F4: error sin data previa', () => {
  it('isError sin cache muestra ContextError + "Reintentar" invoca refetch()', async () => {
    const refetch = vi.fn();
    mockRich({ isError: true, data: undefined, refetch });
    const user = userEvent.setup();
    renderPanel({ status: 'matched', clients: [{ id: '42', name: 'Juan Perez', status: 'active' }] });

    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('ClientContextPanel — F4: error CON cache previa', () => {
  it('isError con data previa mantiene el contenido (NO cae a ContextError)', () => {
    mockRich({ isError: true, data: RICH_MATCHED });
    renderPanel({ status: 'matched', clients: [{ id: '42', name: 'Juan Perez', status: 'active' }] });

    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
  });
});

describe('ClientContextPanel — bug #2 (review adversarial): el chip "no se pudo actualizar" usa balanceRefreshFailed, NO el isError de la query PRIMARIA', () => {
  it('balanceRefreshFailed:true (con la primaria OK) muestra el chip', () => {
    mockRich({ data: RICH_MATCHED, isError: false, balanceRefreshFailed: true });
    renderPanel({ status: 'matched', clients: [{ id: '42', name: 'Juan Perez', status: 'active' }] });

    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo actualizar/i)).toBeInTheDocument();
  });

  it('isError:true de la query PRIMARIA (con cache) pero balanceRefreshFailed:false NO muestra el chip — el chip es del refresh de balance, no de la primaria', () => {
    mockRich({ data: RICH_MATCHED, isError: true, balanceRefreshFailed: false });
    renderPanel({ status: 'matched', clients: [{ id: '42', name: 'Juan Perez', status: 'active' }] });

    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.queryByText(/no se pudo actualizar/i)).not.toBeInTheDocument();
  });
});
