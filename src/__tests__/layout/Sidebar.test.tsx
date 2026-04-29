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
  it('renders IPNEXT brand', () => {
    renderSidebar();
    expect(screen.getByText('IPNEXT')).toBeInTheDocument();
  });

  it('renders CRM navigation section buttons', () => {
    renderSidebar();
    // Use getAllByRole to handle possible multiple matches; check at least one exists
    expect(screen.getAllByRole('button', { name: /clientes/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /tickets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finanzas/i })).toBeInTheDocument();
  });

  it('CRM parent is labelled "Clientes potenciales" (not "CRM")', () => {
    renderSidebar('/admin/crm/dashboard');
    expect(screen.getByRole('button', { name: /clientes potenciales/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^crm$/i })).not.toBeInTheDocument();
  });

  it('Mensajes parent is labelled "Mensajes" (not "Soporte")', () => {
    renderSidebar('/admin/support/inbox');
    expect(screen.getByRole('button', { name: /mensajes/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^soporte$/i })).not.toBeInTheDocument();
  });

  it('Clientes has "Online" sub-item linking to /admin/customers/online and has Vouchers', () => {
    renderSidebar('/admin/customers/list');
    const onlineLink = screen.getByRole('link', { name: /^online$/i });
    expect(onlineLink).toBeInTheDocument();
    expect(onlineLink).toHaveAttribute('href', '/admin/customers/online');
    expect(screen.getByRole('link', { name: /vouchers/i })).toBeInTheDocument();
  });

  it('Tickets has no "Nuevo" sub-item', () => {
    renderSidebar('/admin/tickets/opened');
    expect(screen.queryByRole('link', { name: /^nuevo$/i })).not.toBeInTheDocument();
  });

  it('Mensajes has "Envío masivo" sub-item', () => {
    renderSidebar('/admin/support/inbox');
    expect(screen.getByRole('link', { name: /envío masivo/i })).toBeInTheDocument();
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

  it('Inventario has Dashboard, Artículos, Productos sub-items', () => {
    renderSidebar('/admin/inventory/dashboard');
    expect(screen.getByRole('link', { name: /artículos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /productos/i })).toBeInTheDocument();
  });

  it('Inventario has Suministro sub-item', () => {
    renderSidebar('/admin/inventory/dashboard');
    expect(screen.getByRole('link', { name: /suministro/i })).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Lista' })).toHaveAttribute(
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

  it('Gestión de red has Topología sub-item', () => {
    renderSidebar('/admin/networking/topology');
    expect(screen.getByRole('link', { name: /topología/i })).toBeInTheDocument();
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

  // Fix 2: Notificaciones link
  it('renders Notificaciones link pointing to /admin/notifications', () => {
    renderSidebar('/admin/notifications');
    const link = screen.getByRole('link', { name: /notificaciones/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/notifications');
  });
});
