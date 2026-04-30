import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';
import { Navbar } from '@/components/organisms/Navbar/Navbar';
import { Breadcrumbs } from '@/components/atoms/Breadcrumbs/Breadcrumbs';
import styles from './AdminLayout.module.css';

interface CrumbItem {
  label: string;
  to?: string;
}

interface RouteConfig {
  pattern: string;
  crumbs: CrumbItem[];
}

const ROUTE_CRUMBS: RouteConfig[] = [
  {
    pattern: '/admin/customers/view/:id',
    crumbs: [
      { label: 'CRM' },
      { label: 'Clientes', to: '/admin/customers/list' },
      { label: 'Detalle' },
    ],
  },
  {
    pattern: '/admin/customers/list',
    crumbs: [{ label: 'CRM' }, { label: 'Clientes' }],
  },
  {
    pattern: '/admin/tickets/new',
    crumbs: [
      { label: 'CRM' },
      { label: 'Tickets', to: '/admin/tickets' },
      { label: 'Nuevo' },
    ],
  },
  {
    pattern: '/admin/tickets/opened',
    crumbs: [
      { label: 'CRM' },
      { label: 'Tickets', to: '/admin/tickets' },
      { label: 'Lista' },
    ],
  },
  {
    pattern: '/admin/tickets',
    crumbs: [{ label: 'CRM' }, { label: 'Tickets' }],
  },
  {
    pattern: '/admin/finance/invoices',
    crumbs: [
      { label: 'CRM' },
      { label: 'Finanzas', to: '/admin/finance' },
      { label: 'Facturas' },
    ],
  },
  {
    pattern: '/admin/finance/payments',
    crumbs: [
      { label: 'CRM' },
      { label: 'Finanzas', to: '/admin/finance' },
      { label: 'Pagos' },
    ],
  },
  {
    pattern: '/admin/finance/transactions',
    crumbs: [
      { label: 'CRM' },
      { label: 'Finanzas', to: '/admin/finance' },
      { label: 'Transacciones' },
    ],
  },
  {
    pattern: '/admin/finance',
    crumbs: [{ label: 'CRM' }, { label: 'Finanzas' }],
  },
];

function useBreadcrumbs(): CrumbItem[] {
  const { pathname } = useLocation();

  for (const route of ROUTE_CRUMBS) {
    // Exact match first (static routes)
    if (pathname === route.pattern) return route.crumbs;
  }

  // Pattern match with dynamic segments (e.g. :id)
  for (const route of ROUTE_CRUMBS) {
    if (!route.pattern.includes(':')) continue;
    const regexStr = route.pattern.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${regexStr}$`);
    if (regex.test(pathname)) return route.crumbs;
  }

  return [];
}

export function AdminLayout() {
  const crumbs = useBreadcrumbs();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = () => setSidebarOpen(v => !v);

  return (
    <div className={styles.layout}>
      <Sidebar open={sidebarOpen} onToggle={toggleSidebar} />
      <div className={`${styles.main} ${!sidebarOpen ? styles.mainExpanded : ''}`}>
        <Navbar onMenuClick={toggleSidebar} sidebarOpen={sidebarOpen} />
        <main className={styles.content}>
          {crumbs.length > 0 && (
            <div className={styles.breadcrumbsWrapper}>
              <Breadcrumbs items={crumbs} />
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
