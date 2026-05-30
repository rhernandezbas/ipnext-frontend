import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockTriggerRect(top: number, right: number) {
  Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
    top,
    right,
    bottom: top + 32,
    left: 0,
    width: right,
    height: 32,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
}

/** Render a Sidebar rooted at a path that opens the "Clientes" group by default */
function renderSidebar(path = '/admin/customers/list') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>
  );
}

function getClientesButton() {
  // The button's accessible name includes the chevron character "›",
  // so we use a partial match. getAllByRole returns all matching buttons;
  // the first one that matches /clientes/i (case-insensitive, no "potenciales")
  // is the one we want.
  return screen
    .getAllByRole('button', { name: /clientes/i })
    .find((btn) => !/potenciales/i.test(btn.textContent ?? ''))!;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Phase 2 RED tests
// ---------------------------------------------------------------------------

describe('CollapsibleNavItem — portal behavior', () => {
  // 2.1 — Panel renderizado en document.body (NO dentro del <aside>)
  it('renders nav panel in document.body, NOT inside <aside>', async () => {
    renderSidebar('/admin/dashboard'); // start closed — Clientes not active
    const trigger = getClientesButton();
    const aside = document.querySelector('aside');

    // Panel should not exist initially
    expect(screen.queryByRole('navigation', { name: /menú clientes/i })).not.toBeInTheDocument();

    await userEvent.click(trigger);

    const panel = screen.getByRole('navigation', { name: /menú clientes/i });
    expect(panel).toBeInTheDocument();
    expect(aside).not.toContainElement(panel);
  });

  // 2.2 — Panel NO montado cuando cerrado
  it('does NOT mount panel when closed', () => {
    renderSidebar('/admin/dashboard');
    expect(screen.queryByRole('navigation', { name: /menú clientes/i })).toBeNull();
  });

  // 2.3 — Posicionamiento position: fixed
  it('positions panel with style.top and style.left from getBoundingClientRect', async () => {
    mockTriggerRect(120, 240);
    renderSidebar('/admin/dashboard');
    const trigger = getClientesButton();

    await userEvent.click(trigger);

    const panel = screen.getByRole('navigation', { name: /menú clientes/i });
    const top = parseFloat(panel.style.top);
    const left = parseFloat(panel.style.left);
    expect(top).toBeCloseTo(120, 0);
    expect(left).toBeCloseTo(240, 0);
  });

  // 2.4 — aria-expanded en trigger
  it('toggles aria-expanded on trigger button', async () => {
    renderSidebar('/admin/dashboard');
    const trigger = getClientesButton();

    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  // 2.5 — aria-label en panel
  it('panel has accessible navigation label', async () => {
    renderSidebar('/admin/dashboard');
    const trigger = getClientesButton();

    await userEvent.click(trigger);

    expect(screen.getByRole('navigation', { name: /menú clientes/i })).toBeInTheDocument();
  });

  // 2.6 — Cierre por outside click
  it('closes panel on outside mousedown', async () => {
    renderSidebar('/admin/dashboard');
    const trigger = getClientesButton();

    await userEvent.click(trigger);
    expect(screen.getByRole('navigation', { name: /menú clientes/i })).toBeInTheDocument();

    fireEvent.mousedown(document.body);

    expect(screen.queryByRole('navigation', { name: /menú clientes/i })).toBeNull();
  });

  // 2.7 — Click dentro del panel no cierra
  it('click inside panel does not close it', async () => {
    renderSidebar('/admin/dashboard');
    const trigger = getClientesButton();

    await userEvent.click(trigger);

    const panel = screen.getByRole('navigation', { name: /menú clientes/i });
    fireEvent.mousedown(panel);

    expect(screen.queryByRole('navigation', { name: /menú clientes/i })).toBeInTheDocument();
  });

  // 2.8 — Cierre al navegar (NavLink click)
  it('closes panel when a NavLink child is clicked', async () => {
    renderSidebar('/admin/dashboard');
    const trigger = getClientesButton();

    await userEvent.click(trigger);
    expect(screen.getByRole('navigation', { name: /menú clientes/i })).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /búsqueda/i });
    await userEvent.click(link);

    expect(screen.queryByRole('navigation', { name: /menú clientes/i })).toBeNull();
  });

  // 2.9 + 2.10 — Escape cierra y devuelve foco al trigger
  it('closes panel on Escape and returns focus to trigger', async () => {
    renderSidebar('/admin/dashboard');
    const trigger = getClientesButton();

    await userEvent.click(trigger);
    expect(screen.getByRole('navigation', { name: /menú clientes/i })).toBeInTheDocument();

    const panel = screen.getByRole('navigation', { name: /menú clientes/i });
    panel.focus();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('navigation', { name: /menú clientes/i })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  // 2.11 — Chevron tiene clase chevronOpen cuando open
  it('applies chevronOpen class to chevron when open', async () => {
    renderSidebar('/admin/dashboard');
    const trigger = getClientesButton();
    const chevron = trigger.querySelector('[class*="chevron"]') as HTMLElement;

    expect(chevron.className).not.toMatch(/chevronOpen/);

    await userEvent.click(trigger);
    expect(chevron.className).toMatch(/chevronOpen/);

    await userEvent.click(trigger);
    expect(chevron.className).not.toMatch(/chevronOpen/);
  });

  // 2.12 — Reposicionamiento en scroll
  it('recalculates panel position on scroll', async () => {
    mockTriggerRect(120, 240);
    renderSidebar('/admin/dashboard');
    const trigger = getClientesButton();

    await userEvent.click(trigger);

    const panel = screen.getByRole('navigation', { name: /menú clientes/i });
    expect(parseFloat(panel.style.top)).toBeCloseTo(120, 0);

    // Update mock rect and fire scroll
    mockTriggerRect(200, 240);

    act(() => {
      fireEvent.scroll(window);
    });

    expect(parseFloat(panel.style.top)).toBeCloseTo(200, 0);
  });
});
