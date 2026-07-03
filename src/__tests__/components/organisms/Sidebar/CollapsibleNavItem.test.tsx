import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

// ---------------------------------------------------------------------------
// Inline accordion behavior (NO portal, NO document.body, NO Escape/outside-click)
//
// Three levels, all inline:
//   L1 sections (CRM / Empresa / Sistema)  -> single-open accordions
//   L2 items    (Clientes, Tickets, ...)   -> single-open accordions within a section
//   L3 sub-pages (Lista, Añadir, ...)      -> NavLinks
// ---------------------------------------------------------------------------

function renderSidebar(path = '/admin/customers/list') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

/** L2 "Clientes" item button (excludes "Clientes potenciales"). */
function getClientesItemButton() {
  return screen
    .getAllByRole('button', { name: /clientes/i })
    .find((btn) => !/potenciales/i.test(btn.textContent ?? ''))!;
}

/** L1 section button by accessible name. */
function getSectionButton(name: RegExp) {
  return screen.getByRole('button', { name });
}

describe('Sidebar — inline accordion (no portal)', () => {
  // (a) clicking a section expands its items INLINE inside the sidebar (not portaled)
  it('expands section items inline inside the <aside>, not in document.body', async () => {
    // Start on a neutral route so no section is auto-open.
    renderSidebar('/admin/dashboard');
    const aside = document.querySelector('aside')!;

    // Empresa item buttons not present while section collapsed.
    expect(screen.queryByRole('button', { name: /^scheduling$/i })).toBeNull();

    const empresa = getSectionButton(/^empresa$/i);
    await userEvent.click(empresa);

    const scheduling = screen.getByRole('button', { name: /^scheduling$/i });
    expect(scheduling).toBeInTheDocument();
    // Crucial: the expanded content lives INSIDE the sidebar tree, never portaled to body.
    expect(aside).toContainElement(scheduling);
  });

  // (b) sections are single-open: opening Empresa closes CRM
  it('single-open sections: opening Empresa collapses CRM', async () => {
    renderSidebar('/admin/customers/list'); // CRM auto-open

    // CRM open → its item "Tickets" button is visible.
    expect(screen.getByRole('button', { name: /^tickets$/i })).toBeInTheDocument();

    await userEvent.click(getSectionButton(/^empresa$/i));

    // CRM collapsed now → Tickets item button gone, Empresa items present.
    expect(screen.queryByRole('button', { name: /^tickets$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^scheduling$/i })).toBeInTheDocument();
  });

  // (c) single-open items within a section
  it('single-open items: opening Tickets collapses Clientes within CRM', async () => {
    renderSidebar('/admin/customers/list'); // CRM open, Clientes item auto-open

    // Clientes open → "Añadir" sub-link visible.
    expect(screen.getByRole('link', { name: /^añadir$/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^tickets$/i }));

    // Clientes collapsed → Añadir gone; Tickets open → its sub-link visible.
    expect(screen.queryByRole('link', { name: /^añadir$/i })).toBeNull();
    expect(screen.getByRole('link', { name: /destinatarios/i })).toBeInTheDocument();
  });

  // (d) auto-expand of the active route: /admin/customers/list -> CRM + Clientes open, "Clientes" sub-link active
  it('auto-expands the section and item of the active route', () => {
    renderSidebar('/admin/customers/list');

    // CRM section auto-open → Clientes item button present.
    const clientes = getClientesItemButton();
    expect(clientes).toBeInTheDocument();
    expect(clientes).toHaveAttribute('aria-expanded', 'true');

    // Clientes item auto-open → "Clientes" sub-link present and active.
    const clientesLink = screen.getByRole('link', { name: /^clientes$/i });
    expect(clientesLink).toHaveAttribute('href', '/admin/customers/list');
    expect(clientesLink.className).toMatch(/navChildActive/);
  });

  // (e) aria-expanded reflects state on section and item buttons
  it('toggles aria-expanded on section and item buttons', async () => {
    renderSidebar('/admin/dashboard');

    const empresa = getSectionButton(/^empresa$/i);
    expect(empresa).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(empresa);
    expect(empresa).toHaveAttribute('aria-expanded', 'true');

    const scheduling = screen.getByRole('button', { name: /^scheduling$/i });
    expect(scheduling).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(scheduling);
    expect(scheduling).toHaveAttribute('aria-expanded', 'true');
  });

  // (f) chevron open class toggles
  it('applies chevronOpen class when a section/item is open', async () => {
    renderSidebar('/admin/dashboard');

    const empresa = getSectionButton(/^empresa$/i);
    const chevron = empresa.querySelector('[class*="chevron"]') as HTMLElement;
    expect(chevron.className).not.toMatch(/chevronOpen/);

    await userEvent.click(empresa);
    expect(chevron.className).toMatch(/chevronOpen/);

    await userEvent.click(empresa);
    expect(chevron.className).not.toMatch(/chevronOpen/);
  });

  // a11y: section button points at the region it controls via aria-controls
  it('wires aria-controls from a section button to its region', async () => {
    renderSidebar('/admin/dashboard');
    const empresa = getSectionButton(/^empresa$/i);
    const controls = empresa.getAttribute('aria-controls');
    expect(controls).toBeTruthy();

    await userEvent.click(empresa);
    const region = document.getElementById(controls!);
    expect(region).toBeInTheDocument();
    expect(region).toContainElement(screen.getByRole('button', { name: /^scheduling$/i }));
  });

  // keyboard: Enter / Space toggle the section
  it('toggles a section with Enter and Space', async () => {
    renderSidebar('/admin/dashboard');
    const empresa = getSectionButton(/^empresa$/i);
    empresa.focus();

    await userEvent.keyboard('{Enter}');
    expect(empresa).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard(' ');
    expect(empresa).toHaveAttribute('aria-expanded', 'false');
  });
});
