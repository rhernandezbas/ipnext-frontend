/**
 * Sidebar — entrada "WhatsApp" en CRM_ITEMS (messaging-inbox-fe F1, FB5).
 *
 * Molde: SidebarAcciones.test.tsx / SidebarVentasAccess.test.tsx. "WhatsApp" es
 * un item de link directo (patrón "Informes": `to` + sin `children`), agregado
 * a `CRM_ITEMS` — junto a "Mensajes" (bandeja de soporte existente), NO la
 * reemplaza ni colisiona con ella.
 *
 *  SBW-1 con messaging.read → link "WhatsApp" a /admin/whatsapp dentro de CRM
 *  SBW-2 sin messaging.read → la entrada NO se renderiza (resto de CRM sigue)
 *  SBW-3 loading → la entrada es visible (no layout shift)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

vi.mock('@/hooks/useMyPermissions');

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
    </MemoryRouter>,
  );
}

/** Open the CRM Level-1 section so its item buttons/links enter the DOM. */
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

describe('SBW-1: entrada WhatsApp visible con messaging.read', () => {
  it('linkea a /admin/whatsapp dentro de CRM', async () => {
    mockPerms({
      permissions: ['messaging.read'],
      can: (p) => (Array.isArray(p) ? p : [p]).includes('messaging.read'),
    });
    renderSidebar();
    await openCrm();
    const link = screen.getByRole('link', { name: 'WhatsApp' });
    expect(link).toHaveAttribute('href', '/admin/whatsapp');
  });
});

describe('SBW-2: sin messaging.read no hay entrada', () => {
  it('oculta WhatsApp pero mantiene el resto de CRM', async () => {
    mockPerms({
      permissions: ['clients.read'],
      can: (p) => (Array.isArray(p) ? p : [p]).includes('clients.read'),
    });
    renderSidebar('/admin/customers/list');
    await openCrm();
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    expect(getClientesBtn()).toBeTruthy();
  });
});

describe('SBW-3: loading muestra la entrada (sin layout shift)', () => {
  it('renderiza WhatsApp mientras isLoading=true', async () => {
    mockPerms({ isLoading: true, can: () => false });
    renderSidebar();
    await openCrm();
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toBeInTheDocument();
  });
});
