import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';

interface SubItem {
  to: string;
  label: string;
}

interface NavParentItem {
  label: string;
  icon?: string;
  children: SubItem[];
  matchPaths: string[];
}

const CRM_ITEMS: NavParentItem[] = [
  {
    label: 'Clientes',
    matchPaths: ['/admin/customers'],
    children: [
      { to: '/admin/customers/add', label: 'Añadir' },
      { to: '/admin/customers/search', label: 'Búsqueda' },
      { to: '/admin/customers/list', label: 'Lista' },
      { to: '/admin/customers/online', label: 'Online' },
      { to: '/admin/customers/vouchers', label: 'Vouchers' },
      { to: '/admin/customers/map', label: 'Mapas' },
    ],
  },
  {
    label: 'Clientes potenciales',
    matchPaths: ['/admin/crm'],
    children: [
      { to: '/admin/crm/dashboard', label: 'Dashboard' },
      { to: '/admin/crm/leads', label: 'Lista' },
      { to: '/admin/crm/quotes', label: 'Presupuestos' },
      { to: '/admin/crm/map', label: 'Mapas' },
    ],
  },
  {
    label: 'Tickets',
    matchPaths: ['/admin/tickets'],
    children: [
      { to: '/admin/tickets/dashboard', label: 'Dashboard' },
      { to: '/admin/tickets/opened', label: 'Lista' },
      { to: '/admin/tickets/trash', label: 'Archivar' },
      { to: '/admin/tickets/requesters', label: 'Destinatarios' },
    ],
  },
  {
    label: 'Mensajes',
    matchPaths: ['/admin/support'],
    children: [
      { to: '/admin/support/inbox', label: 'Bandeja de entrada' },
      { to: '/admin/support/mass-send', label: 'Envío masivo' },
      { to: '/admin/support/messengers', label: 'Messengers' },
      { to: '/admin/support/news', label: 'Noticias' },
    ],
  },
  {
    label: 'Finanzas',
    matchPaths: ['/admin/finance'],
    children: [
      { to: '/admin/finance/dashboard', label: 'Dashboard' },
      { to: '/admin/finance/transactions', label: 'Transacciones' },
      { to: '/admin/finance/invoices', label: 'Facturas' },
      { to: '/admin/finance/credit-notes', label: 'Notas de crédito' },
      { to: '/admin/finance/proforma-invoices', label: 'Facturas proforma' },
      { to: '/admin/finance/payments', label: 'Pagos' },
      { to: '/admin/finance/history', label: 'Historial y Vista Previa' },
      { to: '/admin/finance/payment-statements', label: 'Payment statements' },
      { to: '/admin/finance/dunning', label: 'Dunning' },
      { to: '/admin/finance/payment-plans', label: 'Planes de pago' },
    ],
  },
];

const EMPRESA_ITEMS: NavParentItem[] = [
  {
    label: 'Gestión de red',
    matchPaths: ['/admin/networking'],
    children: [
      { to: '/admin/networking/network-sites', label: 'Network sites' },
      { to: '/admin/networking/cpe', label: 'CPE (Mikrotik)' },
      { to: '/admin/networking/map', label: 'Mapas' },
      { to: '/admin/networking/routers/list', label: 'Routers' },
      { to: '/admin/networking/tr069', label: 'TR-069' },
      { to: '/admin/networking/hardware', label: 'Hardware' },
      { to: '/admin/networking/gpon', label: 'GPON' },
      { to: '/admin/networking/radius-sessions', label: 'Sesiones RADIUS' },
      { to: '/admin/networking/ipv4-networks', label: 'Redes IPv4' },
      { to: '/admin/networking/ipv6-networks', label: 'Redes IPv6' },
      { to: '/admin/networking/topology', label: 'Topología' },
    ],
  },
  {
    label: 'Scheduling',
    matchPaths: ['/admin/scheduling'],
    children: [
      { to: '/admin/scheduling/dashboard', label: 'Dashboard' },
      { to: '/admin/scheduling/projects', label: 'Proyectos' },
      { to: '/admin/scheduling', label: 'Tareas' },
      { to: '/admin/scheduling/calendars', label: 'Calendar' },
      { to: '/admin/scheduling/maps', label: 'Mapas' },
      { to: '/admin/scheduling/archive', label: 'Archivar' },
    ],
  },
  {
    label: 'Inventario',
    matchPaths: ['/admin/inventory'],
    children: [
      { to: '/admin/inventory/dashboard', label: 'Dashboard' },
      { to: '/admin/inventory/items', label: 'Artículos' },
      { to: '/admin/inventory/products', label: 'Productos' },
      { to: '/admin/inventory/supply', label: 'Suministro' },
    ],
  },
  {
    label: 'Voz',
    matchPaths: ['/admin/voice'],
    children: [
      { to: '/admin/voice/processing', label: 'Procesando' },
      { to: '/admin/voice/rate-tables', label: 'Rate tables' },
      { to: '/admin/voice/categories', label: 'Categorías' },
      { to: '/admin/voice/prefixes', label: 'Prefijos' },
      { to: '/admin/voice/cdr', label: 'CDR' },
    ],
  },
  {
    label: 'SLA',
    matchPaths: ['/admin/sla'],
    children: [
      { to: '/admin/sla', label: 'Dashboard' },
      { to: '/admin/sla/list', label: 'Contratos' },
    ],
  },
  {
    label: 'Resellers',
    matchPaths: ['/admin/resellers'],
    children: [
      { to: '/admin/resellers', label: 'Lista' },
    ],
  },
  {
    label: 'Portal',
    matchPaths: ['/admin/portal'],
    children: [
      { to: '/admin/portal', label: 'Configuración' },
      { to: '/admin/portal/users', label: 'Usuarios' },
    ],
  },
  {
    label: 'Tarifas',
    matchPaths: ['/admin/tariffs'],
    children: [
      { to: '/admin/tariffs/internet', label: 'Internet' },
      { to: '/admin/tariffs/voice', label: 'Voz' },
      { to: '/admin/tariffs/recurring', label: 'Recurrente' },
      { to: '/admin/tariffs/one-time', label: 'Único' },
      { to: '/admin/tariffs/bundles', label: 'Paquetes' },
      { to: '/admin/tariffs/huawei-groups', label: 'Huawei Groups' },
    ],
  },
];

const SISTEMA_ITEMS: NavParentItem[] = [
  {
    label: 'Sistema',
    matchPaths: ['/admin/administration', '/admin/config', '/admin/partners', '/admin/locations', '/admin/api-docs'],
    children: [
      { to: '/admin/administration/administrators', label: 'Administración' },
      { to: '/admin/config/main', label: 'Configuración' },
      { to: '/admin/partners', label: 'Socios' },
      { to: '/admin/locations', label: 'Ubicaciones' },
      { to: '/admin/api-docs', label: 'API' },
    ],
  },
];

function isParentActive(item: NavParentItem, pathname: string): boolean {
  return item.matchPaths.some((p) => pathname.startsWith(p));
}

function CollapsibleNavItem({ item }: { item: NavParentItem }) {
  const location = useLocation();
  const active = isParentActive(item, location.pathname);
  const [open, setOpen] = useState(active);

  return (
    <div className={styles.navGroup}>
      <button
        className={`${styles.navParent} ${active ? styles.navParentActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{item.label}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
      </button>
      {open && (
        <div className={styles.navChildren}>
          {item.children.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                isActive
                  ? `${styles.navChild} ${styles.navChildActive}`
                  : styles.navChild
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandName}>IPNEXT</span>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navSection}>
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              isActive
                ? `${styles.navChild} ${styles.navChildActive}`
                : styles.navChild
            }
          >
            Panel de control
          </NavLink>
          <NavLink
            to="/admin/monitoring"
            className={({ isActive }) =>
              isActive
                ? `${styles.navChild} ${styles.navChildActive}`
                : styles.navChild
            }
          >
            Monitoreo
          </NavLink>
          <NavLink
            to="/admin/notifications"
            className={({ isActive }) =>
              isActive
                ? `${styles.navChild} ${styles.navChildActive}`
                : styles.navChild
            }
          >
            Notificaciones
          </NavLink>
        </div>

        <div className={styles.navSection}>
          <p className={styles.navSectionTitle}>CRM</p>
          {CRM_ITEMS.map((item) => (
            <CollapsibleNavItem key={item.label} item={item} />
          ))}
        </div>

        <div className={styles.navSection}>
          <p className={styles.navSectionTitle}>Empresa</p>
          {EMPRESA_ITEMS.map((item) => (
            <CollapsibleNavItem key={item.label} item={item} />
          ))}
        </div>

        <div className={styles.navSection}>
          <NavLink
            to="/admin/reports"
            className={({ isActive }) =>
              isActive
                ? `${styles.navChild} ${styles.navChildActive}`
                : styles.navChild
            }
          >
            Informes
          </NavLink>
        </div>

        <div className={styles.navSection}>
          <p className={styles.navSectionTitle}>Sistema</p>
          {SISTEMA_ITEMS.map((item) => (
            <CollapsibleNavItem key={item.label} item={item} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
