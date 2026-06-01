import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

function mockPerms(overrides: Partial<UseMyPermissionsResult>) {
  const base: UseMyPermissionsResult = {
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can: () => false,
  };
  vi.mocked(useMyPermissions).mockReturnValue({ ...base, ...overrides });
}

function renderSidebar(path = '/admin/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar open onToggle={() => {}} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Open a Level-1 section accordion (CRM / Empresa / Sistema) so its item
 * buttons enter the DOM. With the inline-accordion redesign, item buttons
 * only render while their section is expanded.
 */
async function openSection(name: RegExp) {
  await userEvent.click(screen.getByRole('button', { name }));
}

describe('Sidebar — permission filtering', () => {
  it('SP1 — super_admin (*): all nav groups render', async () => {
    mockPerms({ permissions: ['*'], can: () => true });
    renderSidebar();
    // Section headers are present regardless of open state.
    expect(screen.getByRole('button', { name: /^crm$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^empresa$/i })).toBeInTheDocument();

    // Expand CRM → its items (Clientes, Finanzas) become visible.
    await openSection(/^crm$/i);
    expect(screen.getAllByRole('button', { name: /clientes/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /finanzas/i })).toBeInTheDocument();

    // Expand Empresa → Scheduling item becomes visible.
    await openSection(/^empresa$/i);
    expect(screen.getByRole('button', { name: /scheduling/i })).toBeInTheDocument();
  });

  it('SP2 — no permissions: CRM section (and its items) are hidden', () => {
    mockPerms({ permissions: [], can: () => false });
    renderSidebar();
    // A section with no visible items is hidden entirely → no CRM header.
    expect(screen.queryByRole('button', { name: /^crm$/i })).not.toBeInTheDocument();
    // And its items never render.
    expect(screen.queryByRole('button', { name: /^clientes$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /finanzas/i })).not.toBeInTheDocument();
  });

  it('SP3 — has scheduling.read: Scheduling group renders', async () => {
    mockPerms({
      permissions: ['scheduling.read'],
      can: (p) => {
        const perm = Array.isArray(p) ? p[0] : p;
        return perm === 'scheduling.read';
      },
    });
    renderSidebar();
    // Empresa section visible (it has at least the Scheduling item); expand it.
    await openSection(/^empresa$/i);
    expect(screen.getByRole('button', { name: /scheduling/i })).toBeInTheDocument();
  });

  it('SP4 — has scheduling.read but NOT clients.read: Clientes hidden', () => {
    mockPerms({
      permissions: ['scheduling.read'],
      can: (p) => {
        const perm = Array.isArray(p) ? p[0] : p;
        return perm === 'scheduling.read';
      },
    });
    renderSidebar();
    // CRM section has no visible items (clients.read denied) → hidden entirely,
    // so the Clientes item never renders.
    expect(screen.queryByRole('button', { name: /^clientes$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^crm$/i })).not.toBeInTheDocument();
  });

  it('SP5 — loading state: all items visible (no layout shift while loading)', async () => {
    mockPerms({ isLoading: true, can: () => false });
    renderSidebar();
    // While loading every section renders (no filtering). Expand CRM to reveal items.
    await userEvent.click(screen.getByRole('button', { name: /^crm$/i }));
    expect(screen.getAllByRole('button', { name: /clientes/i }).length).toBeGreaterThan(0);
  });

  it('SP6 — top-level links (dashboard, monitoring, notifications) always visible (no permission guard on links)', () => {
    // The singleton top links (Panel de control etc) are always shown — no permission guard
    mockPerms({ permissions: [], can: () => false });
    renderSidebar();
    // They are NavLinks (not collapsible groups), no permission filter needed per design
    expect(screen.getByRole('link', { name: /panel de control/i })).toBeInTheDocument();
  });

  it('SP7 — has clients.read + contracts.read: Contratos child renders under Clientes', async () => {
    // Contratos is a child of Clientes (CRM); Tecnologías moved to the Configuración item.
    // Showing Contratos requires clients.read (to see Clientes) + contracts.read (to see the child).
    mockPerms({
      permissions: ['clients.read', 'contracts.read'],
      can: (p) => {
        const perm = Array.isArray(p) ? p[0] : p;
        return perm === 'clients.read' || perm === 'contracts.read';
      },
    });
    renderSidebar('/admin/customers/list');
    // Clientes accordion is auto-expanded at this path, showing its children.
    expect(screen.getByRole('link', { name: /^contratos$/i })).toBeInTheDocument();
  });

  it('SP8 — without contracts.read: Contratos/Tecnologías children are hidden inside Clientes', async () => {
    // User can see Clientes (has clients.read) but not contracts children.
    mockPerms({
      permissions: ['clients.read'],
      can: (p) => {
        const perm = Array.isArray(p) ? p[0] : p;
        return perm === 'clients.read';
      },
    });
    renderSidebar('/admin/customers/list');
    // Clientes is auto-expanded, but Contratos/Tecnologías children are filtered out.
    expect(screen.queryByRole('link', { name: /^contratos$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /tecnologías/i })).not.toBeInTheDocument();
  });

  it('SP9 — has contracts.read: Contratos renders under Clientes with correct href', () => {
    mockPerms({
      permissions: ['clients.read', 'contracts.read'],
      can: (p) => {
        const perm = Array.isArray(p) ? p[0] : p;
        return perm === 'clients.read' || perm === 'contracts.read';
      },
    });
    renderSidebar('/admin/contracts/list');
    // /admin/contracts/list → Clientes auto-expands. (Tecnologías now lives under Configuración; covered in SidebarContracts.)
    expect(screen.getByRole('link', { name: /^contratos$/i })).toHaveAttribute(
      'href',
      '/admin/contracts/list'
    );
  });
});
