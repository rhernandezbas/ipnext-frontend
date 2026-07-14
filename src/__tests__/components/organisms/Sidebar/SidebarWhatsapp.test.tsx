/**
 * Sidebar — entrada "WhatsApp" en CRM_ITEMS (messaging-inbox-fe F1, FB5).
 *
 * F1.5 polish: promovida de link directo (patrón "Informes") a acordeón con
 * children — mismo patrón que Clientes/Tickets/Gestión de red (item +
 * "Configuración" como sub-página) — para alojar la nueva
 * WhatsappSettingsPage (card chat-media-download).
 *
 *  SBW-1 con messaging.read → grupo "WhatsApp" con children "Bandeja de
 *        entrada" (/admin/whatsapp) y "Configuración" (/admin/whatsapp/settings)
 *  SBW-2 sin messaging.read → la entrada NO se renderiza (resto de CRM sigue)
 *  SBW-3 loading → la entrada es visible (no layout shift)
 *
 * F2 (Bulk Messaging, apply chunk 1) — 3er child "Envío masivo"
 * (/admin/whatsapp/bulk), gate PROPIO `messaging.bulk` (independiente del
 * `messaging.read` del padre — mismo criterio que "Recaptación"/"Mis
 * clientes" dentro de "Clientes": un child con permiso propio NO se combina
 * con el del padre, ver `canSeeChild` en Sidebar.tsx):
 *  SBW-4 con messaging.bulk → aparece "Envío masivo" -> /admin/whatsapp/bulk
 *  SBW-5 sin messaging.bulk (con messaging.read) → "Envío masivo" NO aparece,
 *        el resto del grupo WhatsApp sigue
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

/** Open the "WhatsApp" Level-2 accordion so its children links enter the DOM. */
async function openWhatsapp() {
  const whatsapp = screen.queryByRole('button', { name: /^whatsapp$/i });
  if (whatsapp && whatsapp.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(whatsapp);
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
  it('linkea "Bandeja de entrada" a /admin/whatsapp dentro de CRM', async () => {
    mockPerms({
      permissions: ['messaging.read'],
      can: (p) => (Array.isArray(p) ? p : [p]).includes('messaging.read'),
    });
    renderSidebar();
    await openCrm();
    await openWhatsapp();
    const link = screen.getByRole('link', { name: 'Bandeja de entrada' });
    expect(link).toHaveAttribute('href', '/admin/whatsapp');
  });

  it('linkea "Configuración" a /admin/whatsapp/settings dentro de CRM', async () => {
    mockPerms({
      permissions: ['messaging.read'],
      can: (p) => (Array.isArray(p) ? p : [p]).includes('messaging.read'),
    });
    renderSidebar();
    await openCrm();
    await openWhatsapp();
    const link = screen.getByRole('link', { name: 'Configuración' });
    expect(link).toHaveAttribute('href', '/admin/whatsapp/settings');
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
    expect(screen.queryByRole('button', { name: /^whatsapp$/i })).not.toBeInTheDocument();
    expect(getClientesBtn()).toBeTruthy();
  });
});

describe('SBW-3: loading muestra la entrada (sin layout shift)', () => {
  it('renderiza el grupo WhatsApp mientras isLoading=true', async () => {
    mockPerms({ isLoading: true, can: () => false });
    renderSidebar();
    await openCrm();
    expect(screen.getByRole('button', { name: /^whatsapp$/i })).toBeInTheDocument();
  });
});

describe('SBW-4 (F2): "Envío masivo" visible con messaging.bulk', () => {
  it('linkea "Envío masivo" a /admin/whatsapp/bulk dentro de CRM', async () => {
    mockPerms({
      permissions: ['messaging.read', 'messaging.bulk'],
      can: (p) => {
        const perms = Array.isArray(p) ? p : [p];
        return perms.some((x) => ['messaging.read', 'messaging.bulk'].includes(x));
      },
    });
    renderSidebar();
    await openCrm();
    await openWhatsapp();
    const link = screen.getByRole('link', { name: 'Envío masivo' });
    expect(link).toHaveAttribute('href', '/admin/whatsapp/bulk');
  });
});

describe('SBW-5 (F2): sin messaging.bulk no hay "Envío masivo"', () => {
  it('oculta "Envío masivo" pero mantiene "Bandeja de entrada"/"Configuración"', async () => {
    mockPerms({
      permissions: ['messaging.read'],
      can: (p) => (Array.isArray(p) ? p : [p]).includes('messaging.read'),
    });
    renderSidebar();
    await openCrm();
    await openWhatsapp();
    expect(screen.queryByRole('link', { name: 'Envío masivo' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bandeja de entrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
  });
});
