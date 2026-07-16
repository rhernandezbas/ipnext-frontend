import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

function renderSidebar(path = '/admin/customers/list') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>
  );
}

describe('Sidebar', () => {
  it('renders Prominense brand', () => {
    renderSidebar();
    expect(screen.getByText('Prominense')).toBeInTheDocument();
  });

  it('renders CRM navigation section buttons', () => {
    renderSidebar();
    // Use getAllByRole to handle possible multiple matches; check at least one exists
    expect(screen.getAllByRole('button', { name: /clientes/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /tickets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finanzas/i })).toBeInTheDocument();
  });

  it('CRM item is labelled "Clientes potenciales" (the leads group, distinct from the CRM section header)', () => {
    renderSidebar('/admin/crm/dashboard');
    // The leads item button is labelled "Clientes potenciales".
    expect(screen.getByRole('button', { name: /clientes potenciales/i })).toBeInTheDocument();
    // The CRM section header is now its own accordion button (introduced by the redesign);
    // the leads item must NOT be mislabelled as a bare "CRM".
    expect(
      screen.getByRole('button', { name: /clientes potenciales/i }).textContent,
    ).not.toMatch(/^crm/i);
  });

  it('does not render a "Mensajes" nav item (Support legacy removed)', () => {
    renderSidebar('/admin/customers/list');
    expect(screen.queryByRole('button', { name: /^mensajes$/i })).not.toBeInTheDocument();
  });

  it('Clientes has a "Clientes" sub-item linking to /admin/customers/list; no Búsqueda/Vouchers', () => {
    renderSidebar('/admin/customers/list');
    const clientesLink = screen.getByRole('link', { name: /^clientes$/i });
    expect(clientesLink).toBeInTheDocument();
    expect(clientesLink).toHaveAttribute('href', '/admin/customers/list');
    expect(screen.queryByRole('link', { name: /^vouchers$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^búsqueda$/i })).not.toBeInTheDocument();
  });

  it('Tickets has no "Nuevo" sub-item', () => {
    renderSidebar('/admin/tickets/opened');
    expect(screen.queryByRole('link', { name: /^nuevo$/i })).not.toBeInTheDocument();
  });

  it('Voz has Categorías and Prefijos sub-items', () => {
    renderSidebar('/admin/voice/categories');
    expect(screen.getByRole('link', { name: /categorías/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /prefijos/i })).toBeInTheDocument();
  });

  it('Voz has Procesando and Rate tables sub-items', () => {
    renderSidebar('/admin/voice/categories');
    expect(screen.getByRole('link', { name: /procesando/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rate tables/i })).toBeInTheDocument();
  });

  it('Inventario has Dashboard sub-item (World A retired: no Artículos/Productos/Suministro)', () => {
    renderSidebar('/admin/inventory/dashboard');
    expect(screen.getByRole('link', { name: /^dashboard$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /artículos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /productos/i })).not.toBeInTheDocument();
  });

  it('Inventario does not have Suministro sub-item (World A retired)', () => {
    renderSidebar('/admin/inventory/dashboard');
    expect(screen.queryByRole('link', { name: /suministro/i })).not.toBeInTheDocument();
  });

  it('EMPRESA renders Gestión de red as independent collapsible', () => {
    renderSidebar('/admin/networking/network-sites');
    expect(screen.getByRole('button', { name: /gestión de red/i })).toBeInTheDocument();
  });

  it('EMPRESA renders Scheduling as independent collapsible', () => {
    renderSidebar('/admin/scheduling/dashboard');
    expect(screen.getByRole('button', { name: /scheduling/i })).toBeInTheDocument();
  });

  it('EMPRESA renders Inventario as independent collapsible', () => {
    renderSidebar('/admin/inventory/dashboard');
    expect(screen.getByRole('button', { name: /inventario/i })).toBeInTheDocument();
  });

  it('EMPRESA renders Voz as independent collapsible', () => {
    renderSidebar('/admin/voice/categories');
    expect(screen.getByRole('button', { name: /voz/i })).toBeInTheDocument();
  });

  it('EMPRESA renders Tarifas as independent collapsible', () => {
    renderSidebar('/admin/tariffs/internet');
    expect(screen.getByRole('button', { name: /tarifas/i })).toBeInTheDocument();
  });

  it('Clientes list link points to correct route', () => {
    renderSidebar('/admin/customers/list');
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute(
      'href',
      '/admin/customers/list'
    );
  });

  it('Clientes group has Añadir link pointing to /admin/customers/add', () => {
    renderSidebar('/admin/customers/list');
    expect(screen.getByRole('link', { name: 'Añadir' })).toHaveAttribute(
      'href',
      '/admin/customers/add'
    );
  });

  it('Sistema group renders Administración link', () => {
    renderSidebar('/admin/administration/administrators');
    expect(screen.getByRole('link', { name: 'Administración' })).toHaveAttribute(
      'href',
      '/admin/administration/administrators'
    );
  });

  it('Sistema group renders Configuración link', () => {
    renderSidebar('/admin/config/main');
    expect(screen.getByRole('link', { name: 'Configuración' })).toHaveAttribute(
      'href',
      '/admin/config/main'
    );
  });

  it('Gestión de red no longer has Topología / Redes IPv4 / Redes IPv6 / Sesiones RADIUS sub-items (consolidated into Gestión de Red tabs)', () => {
    renderSidebar('/admin/networking/network-sites');
    expect(screen.queryByRole('link', { name: /topología/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /redes ipv4/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /redes ipv6/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sesiones radius/i })).not.toBeInTheDocument();
  });

  it('Gestión de red has a unified "Auditoría / Logs" sub-item (replaces Logs RADIUS + Auditoría NE8000)', () => {
    renderSidebar('/admin/networking/network-sites');
    const auditLink = screen.getByRole('link', { name: /auditoría \/ logs/i });
    expect(auditLink).toBeInTheDocument();
    expect(auditLink).toHaveAttribute('href', '/admin/networking/audit');
    // The old standalone audit items are gone.
    expect(screen.queryByRole('link', { name: /^logs radius$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /auditoría ne8000/i })).not.toBeInTheDocument();
  });

  it('Gestión de red does NOT have a Nodos sidebar entry (concept moved to config embeds)', () => {
    renderSidebar('/admin/networking/network-sites');
    const nodosLink = screen.queryByRole('link', { name: /^nodos$/i });
    expect(nodosLink).not.toBeInTheDocument();
  });

  it('Gestión de red has Configuración sub-item linking to /admin/networking/settings', () => {
    renderSidebar('/admin/networking/settings');
    const configLink = screen.getByRole('link', { name: 'Configuración', hidden: false });
    expect(configLink).toHaveAttribute('href', '/admin/networking/settings');
  });

  it('Voz has CDR sub-item', () => {
    renderSidebar('/admin/voice/cdr');
    expect(screen.getByRole('link', { name: /^CDR$/i })).toBeInTheDocument();
  });

  it('Finanzas has Dunning sub-item', () => {
    renderSidebar('/admin/finance/dunning');
    expect(screen.getByRole('link', { name: /dunning/i })).toBeInTheDocument();
  });

  it('Finanzas has Planes de pago sub-item', () => {
    renderSidebar('/admin/finance/dunning');
    expect(screen.getByRole('link', { name: /planes de pago/i })).toBeInTheDocument();
  });

  it('Resellers collapsible section renders', () => {
    renderSidebar('/admin/resellers');
    expect(screen.getByRole('button', { name: /resellers/i })).toBeInTheDocument();
  });

  it('Portal collapsible section renders', () => {
    renderSidebar('/admin/portal');
    expect(screen.getByRole('button', { name: /portal/i })).toBeInTheDocument();
  });

  it('SLA collapsible section renders', () => {
    renderSidebar('/admin/sla');
    expect(screen.getByRole('button', { name: /sla/i })).toBeInTheDocument();
  });

  // Fix 1: Tarifas sub-items
  it('Tarifas has Internet sub-item linking to /admin/tariffs/internet', () => {
    renderSidebar('/admin/tariffs/internet');
    const link = screen.getByRole('link', { name: /^internet$/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/tariffs/internet');
  });

  it('Tarifas has Voz sub-item linking to /admin/tariffs/voice', () => {
    renderSidebar('/admin/tariffs/internet');
    const link = screen.getByRole('link', { name: /^voz$/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/tariffs/voice');
  });

  it('Tarifas has Recurrente sub-item linking to /admin/tariffs/recurring', () => {
    renderSidebar('/admin/tariffs/internet');
    const link = screen.getByRole('link', { name: /^recurrente$/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/tariffs/recurring');
  });

  it('Tarifas has Único sub-item linking to /admin/tariffs/one-time', () => {
    renderSidebar('/admin/tariffs/internet');
    const link = screen.getByRole('link', { name: /^único$/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/tariffs/one-time');
  });

  it('Tarifas has Paquetes sub-item linking to /admin/tariffs/bundles', () => {
    renderSidebar('/admin/tariffs/internet');
    const link = screen.getByRole('link', { name: /^paquetes$/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/tariffs/bundles');
  });

  it('Tarifas has Huawei Groups sub-item linking to /admin/tariffs/huawei-groups', () => {
    renderSidebar('/admin/tariffs/internet');
    const link = screen.getByRole('link', { name: /huawei groups/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/tariffs/huawei-groups');
  });

  // internal-news (NEWS-FE-SB-1) — "Notificaciones" was replaced by "Noticias".
  // /admin/notifications itself (the page + campanita target) is untouched —
  // just no longer linked from this navTop item.
  it('renders Noticias link pointing to /admin/news, no Notificaciones link', () => {
    renderSidebar('/admin/news');
    const link = screen.getByRole('link', { name: /^noticias$/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/news');
    expect(screen.queryByRole('link', { name: /^notificaciones$/i })).not.toBeInTheDocument();
  });
});
