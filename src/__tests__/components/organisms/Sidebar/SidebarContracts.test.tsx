/**
 * Sidebar — Contracts migration to CRM/Clientes group
 *
 * SB-C1: "Contratos" and "Tecnologías" appear as children of Clientes when user has contracts.read
 * SB-C2: "Contratos" and "Tecnologías" are hidden when user lacks contracts.read
 * SB-C3: "Contratos" item no longer appears in Empresa section
 * SB-C4: Clientes auto-expands when on /admin/contracts/* paths
 * SB-C5: Contratos child links to /admin/contracts/list
 * SB-C6: Tecnologías child links to /admin/contracts/technologies
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const permHandles = vi.hoisted(() => ({
  result: {
    can: (_: string | string[]) => true,
    isLoading: false,
    isError: false,
    user: null,
    roles: [],
    permissions: [] as string[],
  },
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => permHandles.result,
}));

import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

/** Render sidebar at a given path */
function renderSidebar(path = '/admin/customers/list') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

/** Returns the "Clientes" L2 item button (not "Clientes potenciales") */
function getClientesBtn() {
  return screen
    .getAllByRole('button', { name: /clientes/i })
    .find((btn) => !/potenciales/i.test(btn.textContent ?? ''))!;
}

describe('Sidebar — Contratos bajo Clientes', () => {
  beforeEach(() => {
    permHandles.result.isLoading = false;
    // Default: user has both clients.read and contracts.read
    permHandles.result.can = () => true;
  });

  // SB-C1: Contratos and Tecnologías visible when user has contracts.read
  it('shows Contratos and Tecnologías children under Clientes when has contracts.read', () => {
    renderSidebar('/admin/customers/list');
    // Clientes is auto-expanded at this path
    expect(screen.getByRole('link', { name: /^contratos$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^tecnologías$/i })).toBeInTheDocument();
  });

  // SB-C2: hidden without contracts.read
  it('hides Contratos and Tecnologías children when user lacks contracts.read', () => {
    permHandles.result.can = (p) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some((x) => x !== 'contracts.read');
    };
    renderSidebar('/admin/customers/list');
    expect(screen.queryByRole('link', { name: /^contratos$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^tecnologías$/i })).not.toBeInTheDocument();
  });

  // SB-C3: "Contratos" accordion item no longer in Empresa section
  it('does not render a "Contratos" accordion button in Empresa section', async () => {
    const { container } = renderSidebar('/admin/dashboard');
    // Open Empresa section to check
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const empresaBtn = screen.getByRole('button', { name: /^empresa$/i });
    await user.click(empresaBtn);

    // There should be no "Contratos" accordion button (L2 item button) in Empresa
    const allButtons = Array.from(container.querySelectorAll('button'));
    // We look for a button with text exactly "Contratos" (not a NavLink/child)
    const contratosAccordion = allButtons.find(
      (b) => b.textContent?.trim() === 'Contratos' && b.getAttribute('aria-expanded') !== null,
    );
    expect(contratosAccordion).toBeUndefined();
  });

  // SB-C4: Clientes auto-expands on /admin/contracts/* path
  it('auto-expands Clientes item when on /admin/contracts/list', () => {
    renderSidebar('/admin/contracts/list');
    const clientesBtn = getClientesBtn();
    expect(clientesBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('auto-expands Clientes item when on /admin/contracts/technologies', () => {
    renderSidebar('/admin/contracts/technologies');
    const clientesBtn = getClientesBtn();
    expect(clientesBtn).toHaveAttribute('aria-expanded', 'true');
  });

  // SB-C5: correct href for Contratos
  it('Contratos child links to /admin/contracts/list', () => {
    renderSidebar('/admin/customers/list');
    const link = screen.getByRole('link', { name: /^contratos$/i });
    expect(link).toHaveAttribute('href', '/admin/contracts/list');
  });

  // SB-C6: correct href for Tecnologías
  it('Tecnologías child links to /admin/contracts/technologies', () => {
    renderSidebar('/admin/customers/list');
    const link = screen.getByRole('link', { name: /^tecnologías$/i });
    expect(link).toHaveAttribute('href', '/admin/contracts/technologies');
  });
});
