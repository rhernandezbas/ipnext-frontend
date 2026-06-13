import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ContractService, ServiceCatalogEntry } from '@/types/customer';

vi.mock('@/hooks/useContractServices', () => ({
  useAddContractService: vi.fn(),
}));
vi.mock('@/hooks/useServiceCatalog', () => ({
  useServiceCatalog: vi.fn(),
}));

import { useAddContractService } from '@/hooks/useContractServices';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { ServicePickerMenu } from '@/pages/customers/tabs/contracts/ServicePickerMenu';

const catalogEntry = (over: Partial<ServiceCatalogEntry> = {}): ServiceCatalogEntry => ({
  id: 'sc-tv',
  name: 'TV',
  label: 'Televisión',
  active: true,
  sortOrder: 1,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const noop = vi.fn().mockResolvedValue(undefined);

function setup({
  catalog = [catalogEntry()],
  services = [],
  addMutate = noop,
}: {
  catalog?: ServiceCatalogEntry[];
  services?: ContractService[];
  addMutate?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(useServiceCatalog).mockReturnValue({ data: catalog, isLoading: false } as ReturnType<typeof useServiceCatalog>);
  vi.mocked(useAddContractService).mockReturnValue({ mutateAsync: addMutate, isPending: false } as unknown as ReturnType<typeof useAddContractService>);
  return (
    <ServicePickerMenu contractId="ctr-1" clientId="c-1" services={services} />
  );
}

/** Mocks getBoundingClientRect for the trigger so flip/anchor logic is testable. */
function stubTriggerRect(rect: Partial<DOMRect>) {
  const full: DOMRect = {
    top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
    toJSON: () => ({}), ...rect,
  } as DOMRect;
  vi.spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect').mockReturnValue(full);
}

// ---------------------------------------------------------------------------
// #107 — inactive TV service must NOT block TV from the picker
// ---------------------------------------------------------------------------

/** Build a minimal ContractService fixture. */
function makeService(over: Partial<ContractService>): ContractService {
  return {
    id: 'cs-1',
    serviceCatalogId: 'sc-tv',
    name: 'TV',
    label: 'Televisión',
    status: 'active',
    notes: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

describe('ServicePickerMenu (#107) — inactive TV reappears after baja', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    // Stub trigger rect so toggle() can compute position without JSDOM throwing.
    vi.spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 120, left: 50, right: 230, width: 180, height: 20,
      x: 50, y: 100, toJSON: () => ({}),
    } as DOMRect);
  });

  it('shows TV in the picker when the only TV service is inactive (post-baja)', async () => {
    // INACTIVE TV service — after a TV baja, status is 'inactive', not deleted.
    const inactiveTv = makeService({ status: 'inactive' });
    const tvCatalog = [catalogEntry()]; // TV entry, active in catalog

    vi.mocked(useServiceCatalog).mockReturnValue({ data: tvCatalog, isLoading: false } as ReturnType<typeof useServiceCatalog>);
    vi.mocked(useAddContractService).mockReturnValue({ mutateAsync: noop, isPending: false } as unknown as ReturnType<typeof useAddContractService>);

    const user = userEvent.setup();
    render(
      <ServicePickerMenu contractId="ctr-1" clientId="c-1" services={[inactiveTv]} />,
    );

    await user.click(screen.getByText(/Agregar servicio/i));

    // TV must appear — inactive service should not block it.
    expect(screen.getByRole('menuitem', { name: /Televisión/i })).toBeInTheDocument();
  });

  it('keeps an ACTIVE service excluded from the picker', async () => {
    // ACTIVE TV service — must stay excluded (not a regression).
    const activeTv = makeService({ status: 'active' });
    const tvCatalog = [catalogEntry()];

    vi.mocked(useServiceCatalog).mockReturnValue({ data: tvCatalog, isLoading: false } as ReturnType<typeof useServiceCatalog>);
    vi.mocked(useAddContractService).mockReturnValue({ mutateAsync: noop, isPending: false } as unknown as ReturnType<typeof useAddContractService>);

    const user = userEvent.setup();
    render(
      <ServicePickerMenu contractId="ctr-1" clientId="c-1" services={[activeTv]} />,
    );

    await user.click(screen.getByText(/Agregar servicio/i));

    // Picker must show empty state — active TV is already attached.
    expect(screen.queryByRole('menuitem', { name: /Televisión/i })).not.toBeInTheDocument();
    expect(screen.getByText(/No hay servicios disponibles/i)).toBeInTheDocument();
  });
});

describe('ServicePickerMenu (#58 fix wave) — Contract service picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // jsdom default innerHeight is 768; make it explicit.
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
  });

  // --- HIGH 1: resize closes the menu without throwing ---
  it('closes the menu on window resize without throwing a TypeError', async () => {
    const user = userEvent.setup();
    render(setup());
    await user.click(screen.getByText(/Agregar servicio/i));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Dispatch a real resize event — the old code called menuRef.contains(window)
    // which throws. A throw here fails the test.
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  // --- HIGH 2: flip mode anchors by bottom, glued to the trigger ---
  it('anchors a flipped menu by its bottom edge to the trigger (no fixed-height guess)', async () => {
    // Trigger near the viewport bottom → no room below → must flip upward.
    // bottom=760 of innerHeight 768 leaves 8px below, top=740 leaves plenty above.
    stubTriggerRect({ top: 740, bottom: 760, left: 100 });
    const user = userEvent.setup();
    render(setup());
    await user.click(screen.getByText(/Agregar servicio/i));

    const menu = screen.getByRole('menu');
    // Bottom-anchored: bottom = innerHeight - r.top + 4 = 768 - 740 + 4 = 32.
    expect(menu.style.bottom).toBe('32px');
    expect(menu.style.top).toBe('');
    expect(menu.style.left).toBe('100px');
  });

  // --- HIGH 2 (counterpart): downward open anchors by top ---
  it('anchors a downward-opening menu by its top edge', async () => {
    stubTriggerRect({ top: 100, bottom: 120, left: 50 });
    const user = userEvent.setup();
    render(setup());
    await user.click(screen.getByText(/Agregar servicio/i));

    const menu = screen.getByRole('menu');
    expect(menu.style.top).toBe('124px'); // r.bottom + 4
    expect(menu.style.bottom).toBe('');
  });

  // --- LOW: horizontal clamp keeps the menu inside the viewport ---
  it('clamps the menu left edge so it does not overflow the right viewport edge', async () => {
    // innerWidth 1024, min-width 180, margin 8 → max left = 1024-180-8 = 836.
    stubTriggerRect({ top: 100, bottom: 120, left: 1000 });
    const user = userEvent.setup();
    render(setup());
    await user.click(screen.getByText(/Agregar servicio/i));

    expect(screen.getByRole('menu').style.left).toBe('836px');
  });

  // --- MEDIUM 1: toast is portaled to <body>, not nested in the card wrapper ---
  it('portals the toast to document.body when a duplicate is added', async () => {
    const addMutate = vi.fn().mockRejectedValue({
      response: { status: 409, data: { code: 'CONTRACT_SERVICE_DUPLICATE' } },
    });
    stubTriggerRect({ top: 100, bottom: 120, left: 50 });
    const user = userEvent.setup();
    render(setup({ addMutate }));
    await user.click(screen.getByText(/Agregar servicio/i));
    await user.click(screen.getByText(/Televisión/i));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/ya está agregado al contrato/i);
    // Portaled: its parent is <body>, not the component's .wrapper div.
    expect(alert.parentElement).toBe(document.body);
    expect(alert.style.position).toBe('fixed');
  });

  // --- MEDIUM 2: Escape closes and returns focus to the trigger ---
  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(setup());
    const trigger = screen.getByText(/Agregar servicio/i);
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  // --- MEDIUM 2: first item is focused on open ---
  it('focuses the first menu item when the menu opens', async () => {
    const user = userEvent.setup();
    render(setup({ catalog: [catalogEntry({ id: 'a', name: 'A', label: 'Alpha' }), catalogEntry({ id: 'b', name: 'B', label: 'Beta' })] }));
    await user.click(screen.getByText(/Agregar servicio/i));

    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus(),
    );
  });

  // --- MEDIUM 2: ArrowDown/ArrowUp move focus between items (wrapping) ---
  it('moves focus with ArrowDown/ArrowUp and wraps around', async () => {
    const user = userEvent.setup();
    render(setup({ catalog: [catalogEntry({ id: 'a', name: 'A', label: 'Alpha' }), catalogEntry({ id: 'b', name: 'B', label: 'Beta' })] }));
    await user.click(screen.getByText(/Agregar servicio/i));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus());

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Beta' })).toHaveFocus();

    await user.keyboard('{ArrowDown}'); // wraps back to first
    expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus();

    await user.keyboard('{ArrowUp}'); // wraps to last
    expect(screen.getByRole('menuitem', { name: 'Beta' })).toHaveFocus();
  });
});
