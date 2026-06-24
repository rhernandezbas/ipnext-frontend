import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import styles from './Sidebar.module.css';

interface SubItem {
  to: string;
  label: string;
  /**
   * Optional permission required to render this child.
   * If omitted — always show (inherits parent visibility).
   * While permissions are loading — show (no layout shift).
   */
  requiredPermission?: string;
}

interface NavParentItem {
  label: string;
  icon?: string;
  /** Sub-pages (level 3). Omitted when the item is a direct link (use `to`). */
  children?: SubItem[];
  /** Direct navigation target. When set, the item renders as a link, not an accordion. */
  to?: string;
  matchPaths: string[];
  /**
   * Permission required to show this nav item.
   * If omitted the item is always visible.
   * While permissions are loading, all items render (no layout shift).
   */
  requiredPermission?: string;
}

interface NavSectionDef {
  /** Section heading (CRM / Empresa / Sistema). */
  label: string;
  /** Stable key used to track which section is open. */
  key: string;
  items: NavParentItem[];
}

const CRM_ITEMS: NavParentItem[] = [
  {
    label: 'Clientes',
    matchPaths: ['/admin/customers', '/admin/contracts/list'],
    requiredPermission: 'clients.read', // /admin/customers/* → clients.read
    children: [
      { to: '/admin/customers/add', label: 'Añadir' },
      { to: '/admin/customers/search', label: 'Búsqueda' },
      { to: '/admin/customers/list', label: 'Lista' },
      { to: '/admin/customers/vouchers', label: 'Vouchers' },
      { to: '/admin/customers/map', label: 'Mapas' },
      { to: '/admin/contracts/list', label: 'Contratos', requiredPermission: 'contracts.read' },
      // TV (Gigared) lives in Clientes (#47b). Note: the Clientes group itself
      // gates on clients.read, so TV requires clients.read + tv.read.
      { to: '/admin/customers/tv', label: 'TV', requiredPermission: 'tv.read' },
      // Servicios de Internet (espejo de TV). El grupo Clientes ya gatea clients.read,
      // así que Internet requiere clients.read + pppoe.read.
      { to: '/admin/customers/internet', label: 'Internet', requiredPermission: 'pppoe.read' },
      // #2 — "Historial TV" sidebar item removed: history is now in ActivationHistoryModal.
      // #80 — Recaptación: recovery of churned clients as leads. Placed above Configuración.
      { to: '/admin/customers/recaptacion', label: 'Recaptación', requiredPermission: 'recapture.read' },
      // Mis clientes (Fase 4) — agent's own portfolio. Same gate as Recaptación (recapture.read).
      { to: '/admin/customers/mis-clientes', label: 'Mis clientes', requiredPermission: 'recapture.read' },
      { to: '/admin/customers/settings', label: 'Configuración' },
    ],
  },
  {
    label: 'Clientes potenciales',
    matchPaths: ['/admin/crm'],
    requiredPermission: 'crm.read', // /admin/crm/* → crm.read
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
    requiredPermission: 'tickets.read', // /admin/tickets/* → tickets.read
    children: [
      { to: '/admin/tickets/dashboard', label: 'Dashboard' },
      { to: '/admin/tickets/opened', label: 'Lista' },
      { to: '/admin/tickets/archived', label: 'Archivar' },
      { to: '/admin/tickets/requesters', label: 'Destinatarios' },
      // #8 — Estados moved into the Configuracion tab (tickets.manage); removed standalone sidebar entry.
      { to: '/admin/tickets/settings', label: 'Configuracion', requiredPermission: 'tickets.manage' },
    ],
  },
  {
    label: 'Mensajes',
    matchPaths: ['/admin/support'],
    requiredPermission: 'support.read', // /admin/support/* → support.read
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
    requiredPermission: 'billing.read', // /admin/finance/* → billing.read
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
    requiredPermission: 'network.read', // /admin/networking/* → network.read
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
      { to: '/admin/networking/plans', label: 'Catálogo de planes', requiredPermission: 'plan.read' },
      // Cortes PPPoE (Fase C) — moved here from the Clientes group. Gate intact.
      { to: '/admin/networking/pppoe-cortes', label: 'Cortes PPPoE', requiredPermission: 'pppoe.cut' },
      { to: '/admin/networking/radius-logs', label: 'Logs RADIUS', requiredPermission: 'network.read' },
      { to: '/admin/networking/ne8000-audit', label: 'Auditoría NE8000', requiredPermission: 'network.read' },
      { to: '/admin/networking/settings', label: 'Configuración' },
    ],
  },
  {
    label: 'Scheduling',
    matchPaths: ['/admin/scheduling'],
    requiredPermission: 'scheduling.read', // /admin/scheduling/* → scheduling.read
    children: [
      { to: '/admin/scheduling/dashboard', label: 'Dashboard' },
      { to: '/admin/scheduling/projects', label: 'Proyectos' },
      { to: '/admin/scheduling/tasks', label: 'Tareas' },
      { to: '/admin/scheduling/nodos', label: 'Tareas Nodos' },
      { to: '/admin/scheduling/calendars', label: 'Calendar' },
      { to: '/admin/scheduling/maps', label: 'Mapas' },
      { to: '/admin/scheduling/archive', label: 'Archivar' },
      { to: '/admin/scheduling/settings', label: 'Configuración' },
    ],
  },
  {
    label: 'Inventario',
    matchPaths: ['/admin/inventory'],
    requiredPermission: 'inventory.read', // /admin/inventory/* → inventory.read
    children: [
      { to: '/admin/inventory/dashboard', label: 'Dashboard' },
      { to: '/admin/inventory/depot', label: 'Depósito' },
      { to: '/admin/inventory/technicians', label: 'Técnicos' },
      { to: '/admin/inventory/returns', label: 'Devoluciones' },
      { to: '/admin/inventory/deductions', label: 'Descuentos pendientes' },
      { to: '/admin/inventory/settings', label: 'Configuración' },
    ],
  },
  {
    label: 'Voz',
    matchPaths: ['/admin/voice'],
    requiredPermission: 'voices.read', // /admin/voice/* → voices.read
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
    requiredPermission: 'sla.read', // /admin/sla/* → sla.read
    children: [
      { to: '/admin/sla', label: 'Dashboard' },
      { to: '/admin/sla/list', label: 'Contratos' },
    ],
  },
  {
    label: 'Resellers',
    matchPaths: ['/admin/resellers'],
    requiredPermission: 'partners.read', // /admin/resellers/* → partners.read
    children: [
      { to: '/admin/resellers', label: 'Lista' },
    ],
  },
  {
    label: 'Portal',
    matchPaths: ['/admin/portal'],
    requiredPermission: 'portal.read', // /admin/portal/* → portal.read
    children: [
      { to: '/admin/portal', label: 'Configuración' },
      { to: '/admin/portal/users', label: 'Usuarios' },
    ],
  },
  {
    label: 'Tarifas',
    matchPaths: ['/admin/tariffs'],
    requiredPermission: 'tariffs.read', // /admin/tariffs/* → tariffs.read
    children: [
      { to: '/admin/tariffs/internet', label: 'Internet' },
      { to: '/admin/tariffs/voice', label: 'Voz' },
      { to: '/admin/tariffs/recurring', label: 'Recurrente' },
      { to: '/admin/tariffs/one-time', label: 'Único' },
      { to: '/admin/tariffs/bundles', label: 'Paquetes' },
      { to: '/admin/tariffs/huawei-groups', label: 'Huawei Groups' },
    ],
  },
  {
    label: 'Informes',
    to: '/admin/reports',
    matchPaths: ['/admin/reports'],
  },
];

const SISTEMA_ITEMS: NavParentItem[] = [
  {
    label: 'Sistema',
    matchPaths: ['/admin/administration', '/admin/config', '/admin/partners', '/admin/locations', '/admin/api-docs'],
    requiredPermission: 'admin.read', // admin section → admin.read (super_admin or system admin)
    children: [
      { to: '/admin/administration/administrators', label: 'Administración' },
      { to: '/admin/config/main', label: 'Configuración' },
      { to: '/admin/partners', label: 'Socios' },
      { to: '/admin/locations', label: 'Ubicaciones' },
      { to: '/admin/api-docs', label: 'API' },
    ],
  },
];

const SECTIONS: NavSectionDef[] = [
  { key: 'crm', label: 'CRM', items: CRM_ITEMS },
  { key: 'empresa', label: 'Empresa', items: EMPRESA_ITEMS },
  { key: 'sistema', label: 'Sistema', items: SISTEMA_ITEMS },
];

function isItemActive(item: NavParentItem, pathname: string): boolean {
  return item.matchPaths.some((p) => pathname.startsWith(p));
}

/**
 * Derive which section + item should auto-expand from the current pathname.
 * Returns the section key and item label that contain the active route,
 * or null when nothing matches (no section auto-opens).
 */
function deriveActive(
  sections: NavSectionDef[],
  pathname: string,
): { sectionKey: string | null; itemLabel: string | null } {
  for (const section of sections) {
    for (const item of section.items) {
      if (isItemActive(item, pathname)) {
        return { sectionKey: section.key, itemLabel: item.label };
      }
    }
  }
  return { sectionKey: null, itemLabel: null };
}

// ---------------------------------------------------------------------------
// NavItem — Level 2 inline accordion (item → sub-pages)
// ---------------------------------------------------------------------------

interface NavItemProps {
  item: NavParentItem;
  open: boolean;
  onToggle: () => void;
}

function NavItem({ item, open, onToggle }: NavItemProps) {
  const location = useLocation();
  const active = isItemActive(item, location.pathname);
  const regionId = useId();

  // Direct-link item (no sub-pages) — e.g. Informes inside Empresa.
  if (item.to) {
    return (
      <NavLink
        to={item.to}
        end
        className={({ isActive }) =>
          isActive ? `${styles.navParent} ${styles.navParentLinkActive}` : styles.navParent
        }
      >
        <span>{item.label}</span>
      </NavLink>
    );
  }

  return (
    <div className={styles.navGroup}>
      <button
        type="button"
        className={`${styles.navParent} ${active ? styles.navParentActive : ''}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={regionId}
      >
        <span>{item.label}</span>
        <span aria-hidden="true" className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
      </button>
      <div
        id={regionId}
        role="region"
        aria-label={item.label}
        className={`${styles.collapsible} ${open ? styles.collapsibleOpen : ''}`}
        hidden={!open}
      >
        <div className={styles.collapsibleInner}>
          <div className={styles.navChildren}>
            {(item.children ?? []).map(({ to, label }) => (
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
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavSection — Level 1 inline accordion (section → items)
// ---------------------------------------------------------------------------

interface NavSectionProps {
  label: string;
  items: NavParentItem[];
  open: boolean;
  onToggle: () => void;
  /** Label of the item open within this section (single-open), or null. */
  openItemLabel: string | null;
  onItemToggle: (label: string) => void;
}

function NavSection({
  label,
  items,
  open,
  onToggle,
  openItemLabel,
  onItemToggle,
}: NavSectionProps) {
  const location = useLocation();
  const regionId = useId();
  const active = items.some((item) => isItemActive(item, location.pathname));

  return (
    <div className={styles.navSection}>
      <button
        type="button"
        className={`${styles.navSectionTitle} ${active ? styles.navSectionTitleActive : ''}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={regionId}
      >
        <span>{label}</span>
        <span aria-hidden="true" className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
      </button>
      <div
        id={regionId}
        role="region"
        aria-label={label}
        className={`${styles.collapsible} ${open ? styles.collapsibleOpen : ''}`}
        hidden={!open}
      >
        <div className={styles.collapsibleInner}>
          {items.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              open={openItemLabel === item.label}
              onToggle={() => onItemToggle(item.label)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

interface SidebarProps {
  open?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ open = true, onToggle }: SidebarProps) {
  const { can, isLoading } = useMyPermissions();
  const location = useLocation();

  /**
   * Returns true if a child item should be rendered.
   * While loading → show all (no layout shift).
   * A child WITHOUT its own requiredPermission inherits the parent's — this
   * preserves the original "child inherits parent visibility" contract while
   * letting the parent be a pure container (its visibility derives from its
   * children, see `canSee`). A child WITH its own permission uses that and is
   * NOT additionally gated by the parent's permission.
   */
  function canSeeChild(child: SubItem, parent: NavParentItem): boolean {
    if (isLoading) return true;
    const perm = child.requiredPermission ?? parent.requiredPermission;
    if (!perm) return true;
    return can(perm);
  }

  /**
   * Returns true if the nav item should be rendered.
   * While loading → show all (no layout shift).
   * Container items (with children) are visible iff at least one child is
   * visible — the parent's requiredPermission is inherited by permission-less
   * children rather than acting as a hard wall (a sales agent with only
   * recapture.read must still reach the Recaptación child inside "Clientes").
   * Direct-link items (no children) keep their own requiredPermission.
   */
  function canSee(item: NavParentItem): boolean {
    if (isLoading) return true;
    if (item.children && item.children.length > 0) {
      return item.children.some((child) => canSeeChild(child, item));
    }
    if (!item.requiredPermission) return true;
    return can(item.requiredPermission);
  }

  // Build the visible section list, dropping any section with no visible items.
  // For each item: filter its children (with parent-permission inheritance) and
  // drop container items left with zero visible children. Direct-link items
  // (with `to`, no children) survive on their own canSee result above.
  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .filter(canSee)
      .map((item) => ({
        ...item,
        children: item.children
          ? item.children.filter((child) => canSeeChild(child, item))
          : item.children,
      }))
      .filter((item) => !item.children || item.children.length > 0 || !!item.to),
  })).filter((section) => section.items.length > 0);

  // Auto-expand: derive the active section + item from the pathname.
  const { sectionKey: activeSectionKey, itemLabel: activeItemLabel } = deriveActive(
    SECTIONS,
    location.pathname,
  );

  // Single-open section state (lazy init from the active route).
  const [openSection, setOpenSection] = useState<string | null>(activeSectionKey);

  // Single-open item state, keyed by section (lazy init from the active route).
  const [openItemBySection, setOpenItemBySection] = useState<Record<string, string | null>>(
    () => (activeSectionKey ? { [activeSectionKey]: activeItemLabel } : {}),
  );

  // Keep the accordion coherent with the route: when navigation lands on a
  // different section/item, auto-expand it (single-open semantics preserved).
  // Skips the initial render — lazy state init already handles first paint.
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;
    if (!activeSectionKey) return;
    setOpenSection(activeSectionKey);
    setOpenItemBySection((prev) => ({
      ...prev,
      [activeSectionKey]: activeItemLabel,
    }));
  }, [location.pathname, activeSectionKey, activeItemLabel]);

  function toggleSection(key: string) {
    setOpenSection((prev) => (prev === key ? null : key));
  }

  function toggleItem(sectionKey: string, label: string) {
    setOpenItemBySection((prev) => ({
      ...prev,
      [sectionKey]: prev[sectionKey] === label ? null : label,
    }));
  }

  return (
    <aside className={`${styles.sidebar} ${!open ? styles.sidebarClosed : ''}`}>
      <div className={styles.brand}>
        <span className={styles.brandName}>Prominense</span>
        <button className={styles.collapseBtn} onClick={onToggle} title="Colapsar menú">
          ‹
        </button>
      </div>

      <nav className={styles.nav}>
        {/* Level 0 — top-level singleton links, always visible, no permission guard */}
        <div className={styles.navTop}>
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
            }
          >
            Panel de control
          </NavLink>
          <NavLink
            to="/admin/monitoring"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
            }
          >
            Monitoreo
          </NavLink>
          <NavLink
            to="/admin/notifications"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
            }
          >
            Notificaciones
          </NavLink>
        </div>

        {/* Level 1 — section accordions (single-open). Informes is now a
            direct-link item inside the Empresa section. */}
        {visibleSections.map((section) => (
          <NavSection
            key={section.key}
            label={section.label}
            items={section.items}
            open={openSection === section.key}
            onToggle={() => toggleSection(section.key)}
            openItemLabel={openItemBySection[section.key] ?? null}
            onItemToggle={(label) => toggleItem(section.key, label)}
          />
        ))}
      </nav>
    </aside>
  );
}
