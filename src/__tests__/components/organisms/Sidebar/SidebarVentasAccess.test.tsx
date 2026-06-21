/**
 * Sidebar — sales-agent access to Recaptación (recapture-ventas-access)
 *
 * A sales agent has recapture.read (+ recapture.manage, role ventas) but NOT
 * clients.read. They must see the "Clientes" group containing ONLY Recaptación
 * and Mis clientes — never any clients.read-gated child.
 *
 * RVA-1.1  agent sees Clientes with Recaptación + Mis clientes
 * RVA-1.2  agent sees NO clients.read-only child (no leak)
 * RVA-1.3  clients.read user still sees the full Clientes group
 * RVA-1.4  no-permission user sees neither the group nor the CRM section
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

vi.mock('@/hooks/useMyPermissions');

function mockPerms(perms: string[]) {
  const base: UseMyPermissionsResult = {
    user: null,
    roles: [],
    permissions: perms,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      if (perms.includes('*')) return true;
      const list = Array.isArray(p) ? p : [p];
      return list.some((x) => perms.includes(x));
    },
  };
  vi.mocked(useMyPermissions).mockReturnValue(base);
}

function renderSidebar(path = '/admin/customers/recaptacion') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar open onToggle={() => {}} />
    </MemoryRouter>,
  );
}

/** Open the CRM Level-1 section so its item buttons enter the DOM. */
async function openCrm() {
  const crm = screen.queryByRole('button', { name: /^crm$/i });
  if (crm && crm.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(crm);
  }
}

/** The "Clientes" L2 item button (not "Clientes potenciales"). */
function getClientesBtn() {
  return screen
    .queryAllByRole('button', { name: /clientes/i })
    .find((btn) => !/potenciales/i.test(btn.textContent ?? ''));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Sidebar — sales-agent recapture access', () => {
  it('RVA-1.1 — agent (recapture.read, no clients.read) sees Clientes with Recaptación + Mis clientes', async () => {
    mockPerms(['recapture.read', 'recapture.manage']);
    renderSidebar('/admin/customers/recaptacion');
    await openCrm();

    // CRM section visible (the Clientes group now has visible children).
    expect(screen.getByRole('button', { name: /^crm$/i })).toBeInTheDocument();
    // Clientes group visible.
    expect(getClientesBtn()).toBeTruthy();
    // Its allowed children render.
    expect(screen.getByRole('link', { name: /recaptación/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /mis clientes/i })).toBeInTheDocument();
  });

  it('RVA-1.2 — agent sees NO clients.read-only child (no leak)', async () => {
    mockPerms(['recapture.read', 'recapture.manage']);
    renderSidebar('/admin/customers/recaptacion');
    await openCrm();

    // None of the clients.read-inheriting children leak.
    expect(screen.queryByRole('link', { name: /^añadir$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^lista$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^búsqueda$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^vouchers$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^mapas$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^configuración$/i })).not.toBeInTheDocument();
    // Children with their own (other) permission also hidden.
    expect(screen.queryByRole('link', { name: /^contratos$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^tv$/i })).not.toBeInTheDocument();
  });

  it('RVA-1.3 — clients.read user still sees the full Clientes group', async () => {
    mockPerms(['clients.read']);
    renderSidebar('/admin/customers/list');
    await openCrm();

    expect(getClientesBtn()).toBeTruthy();
    // Inherited (no own perm) children show because the user has clients.read.
    expect(screen.getByRole('link', { name: /^añadir$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^lista$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^vouchers$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^configuración$/i })).toBeInTheDocument();
    // Extra-perm children remain gated (user lacks contracts.read / tv.read / recapture.read).
    expect(screen.queryByRole('link', { name: /^contratos$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^tv$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /recaptación/i })).not.toBeInTheDocument();
  });

  it('RVA-1.4 — no-permission user sees neither the Clientes group nor the CRM section', () => {
    mockPerms([]);
    renderSidebar('/admin/dashboard');

    expect(screen.queryByRole('button', { name: /^crm$/i })).not.toBeInTheDocument();
    expect(getClientesBtn()).toBeUndefined();
  });
});
