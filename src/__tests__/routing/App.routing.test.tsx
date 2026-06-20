/**
 * Phase 0 — Golden Routing Test
 *
 * Renders <App> with MemoryRouter at each URL and asserts the correct page component
 * is mounted. This is the regression net for the nested-routing refactor.
 * NEVER change URLs or remove cases — if a path changes, that's a bug.
 *
 * Strategy:
 *  - Mock every lazy-loaded page with a unique text marker
 *  - Mock ProtectedRoute to render Outlet directly (bypasses auth)
 *  - Mock AdminLayout to render Outlet directly (bypasses sidebar/navbar)
 *  - Mock useAuth so ProtectedRoute (real or mocked) sees an authenticated user
 *
 * Each test case: { url, marker } — navigate to url, expect text marker in DOM.
 * Redirect cases: { url, redirectsTo, marker } — follow redirect and check marker.
 */
import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

// ── Auth mock (must be before any component that uses useAuth) ────────────────
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 1, username: 'admin', email: 'a@a.com', displayName: 'Admin', role: 'admin', permissions: [] },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })),
}));

// ── Layout mocks: render Outlet so we can test page routing ──────────────────
vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: () => {
    const { Outlet } = require('react-router-dom');
    return React.createElement(Outlet);
  },
}));

vi.mock('@/components/templates/AdminLayout/AdminLayout', () => ({
  AdminLayout: () => {
    const { Outlet } = require('react-router-dom');
    return React.createElement(Outlet);
  },
}));

// ── Page mocks — each returns a unique text marker ────────────────────────────
// Root / public
vi.mock('@/pages/LoginPage/LoginPage', () => ({
  LoginPage: () => React.createElement('div', null, '[PAGE:Login]'),
}));
vi.mock('@/pages/NotFoundPage/NotFoundPage', () => ({
  NotFoundPage: () => React.createElement('div', null, '[PAGE:NotFound]'),
}));

// Dashboard
vi.mock('@/pages/DashboardPage/DashboardPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Dashboard]'),
}));

// Customers
vi.mock('@/pages/customers/CustomersListPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:CustomersList]'),
}));
vi.mock('@/pages/customers/AddCustomerPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:AddCliente]'),
}));
vi.mock('@/pages/customers/CustomerDetailPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:ClienteDetail]'),
}));
vi.mock('@/pages/customers/EditCustomerPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:EditCliente]'),
}));
vi.mock('@/pages/customers/CustomerSearchPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:CustomerSearch]'),
}));
vi.mock('@/pages/customers/CustomerVouchersPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:CustomerVouchers]'),
}));
vi.mock('@/pages/customers/CustomerMapPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:CustomerMap]'),
}));

// CRM
vi.mock('@/pages/customers/LeadsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Leads]'),
}));
vi.mock('@/pages/crm/CrmDashboardPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:CrmDashboard]'),
}));
vi.mock('@/pages/crm/CrmQuotesPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:CrmQuotes]'),
}));
vi.mock('@/pages/crm/CrmMapPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:CrmMap]'),
}));

// Tickets
vi.mock('@/pages/tickets/TicketsDashboardPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TicketsDashboard]'),
}));
vi.mock('@/pages/tickets/TicketsListPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TicketsList]'),
}));
vi.mock('@/pages/tickets/TicketsArchivePage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TicketsArchive]'),
}));
vi.mock('@/pages/tickets/CreateTicketPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:CreateTicket]'),
}));
vi.mock('@/pages/tickets/TicketDetailPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TicketDetail]'),
}));
vi.mock('@/pages/tickets/TicketRequestersPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TicketRequesters]'),
}));

// Finance
vi.mock('@/pages/FinanzasDashboardPage/FinanzasDashboardPage', () => ({
  FinanzasDashboardPage: () => React.createElement('div', null, '[PAGE:FinanzasDashboard]'),
}));
vi.mock('@/pages/FacturasPage/FacturasPage', () => ({
  FacturasPage: () => React.createElement('div', null, '[PAGE:Facturas]'),
}));
vi.mock('@/pages/PagosPage/PagosPage', () => ({
  PagosPage: () => React.createElement('div', null, '[PAGE:Pagos]'),
}));
vi.mock('@/pages/TransaccionesPage/TransaccionesPage', () => ({
  TransaccionesPage: () => React.createElement('div', null, '[PAGE:Transacciones]'),
}));
vi.mock('@/pages/finance/NotasCreditoPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:NotasCredito]'),
}));
vi.mock('@/pages/finance/ProformasPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Proformas]'),
}));
vi.mock('@/pages/finance/HistorialFinancieroPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:HistorialFinanciero]'),
}));
vi.mock('@/pages/finance/PaymentStatementsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:PaymentStatements]'),
}));
vi.mock('@/pages/finance/DunningPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Dunning]'),
}));
vi.mock('@/pages/finance/PaymentPlansPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:PaymentPlans]'),
}));

// Networking
vi.mock('@/pages/networking/GestionRedPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:GestionRed]'),
}));
vi.mock('@/pages/networking/NetworkSitesPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:NetworkSites]'),
}));
vi.mock('@/pages/networking/CpePage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Cpe]'),
}));
vi.mock('@/pages/networking/Tr069Page', () => ({
  default: () => React.createElement('div', null, '[PAGE:Tr069]'),
}));
vi.mock('@/pages/networking/HardwarePage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Hardware]'),
}));
vi.mock('@/pages/networking/Ipv4NetworksPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Ipv4Networks]'),
}));
vi.mock('@/pages/networking/Ipv6NetworksPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Ipv6Networks]'),
}));
vi.mock('@/pages/networking/NetworkMapPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:NetworkMap]'),
}));
vi.mock('@/pages/networking/NetworkTopologyPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:NetworkTopology]'),
}));
vi.mock('@/pages/gpon/GponPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Gpon]'),
}));
vi.mock('@/pages/radius/RadiusSessionsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:RadiusSessions]'),
}));
vi.mock('@/pages/networking/NetworkingSettingsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:NetworkingSettings]'),
}));
vi.mock('@/pages/customers/PppoeCortesPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:PppoeCortes]'),
}));

// Scheduling
vi.mock('@/pages/scheduling/SchedulingDashboardPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SchedulingDashboard]'),
}));
vi.mock('@/pages/scheduling/SchedulingProjectsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SchedulingProjects]'),
}));
vi.mock('@/pages/scheduling/SchedulingCalendarPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SchedulingCalendar]'),
}));
vi.mock('@/pages/scheduling/SchedulingMapsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SchedulingMaps]'),
}));
vi.mock('@/pages/scheduling/SchedulingArchivedTasksPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SchedulingArchivedTasks]'),
}));
vi.mock('@/pages/scheduling/SchedulingTemplatesPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SchedulingTemplates]'),
}));
vi.mock('@/pages/scheduling/SchedulingTaskCategoriesPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SchedulingTaskCategories]'),
}));
vi.mock('@/pages/scheduling/SchedulingTaskPrioritiesPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SchedulingTaskPriorities]'),
}));
vi.mock('@/pages/scheduling/SchedulingTasksPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SchedulingTasks]'),
}));
vi.mock('@/pages/scheduling/SchedulingTaskDetailPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SchedulingTaskDetail]'),
}));

// Tariffs
vi.mock('@/pages/tariffs/TariffsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Tarifas]'),
}));
vi.mock('@/pages/tariffs/TarifasInternetPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TarifasInternet]'),
}));
vi.mock('@/pages/tariffs/TarifasVozPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TarifasVoz]'),
}));
vi.mock('@/pages/tariffs/TarifasRecurrentePage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TarifasRecurrente]'),
}));
vi.mock('@/pages/tariffs/TarifasUnicoPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TarifasUnico]'),
}));
vi.mock('@/pages/tariffs/TarifasPaquetesPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TarifasPaquetes]'),
}));
vi.mock('@/pages/tariffs/TarifasHuaweiGroupsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TarifasHuaweiGroups]'),
}));

// Inventory (World A retired: InventoryLegacyPage/Items/Products/Supply deleted)
vi.mock('@/pages/inventory/InventoryDashboardPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:InventoryDashboard]'),
}));

// Voice
vi.mock('@/pages/voice/VoiceLegacyPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Voz]'),
}));
vi.mock('@/pages/voice/VoiceCategoriesPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:VoiceCategories]'),
}));
vi.mock('@/pages/voice/VoiceProcessingPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:VoiceProcessing]'),
}));
vi.mock('@/pages/voice/VoiceRateTablesPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:VoiceRateTables]'),
}));
vi.mock('@/pages/voice/VoicePrefixesPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:VoicePrefixes]'),
}));
vi.mock('@/pages/voice/CDRPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:CDR]'),
}));

// Contracts
vi.mock('@/pages/contracts/ContractsListPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:ContractsList]'),
}));
vi.mock('@/pages/contracts/ServiceTechnologiesPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:ServiceTechnologies]'),
}));

// SLA
vi.mock('@/pages/sla/SLADashboardPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SLADashboard]'),
}));
vi.mock('@/pages/sla/SLAListPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SLAList]'),
}));

// Resellers
vi.mock('@/pages/resellers/ResellersListPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:ResellersList]'),
}));
vi.mock('@/pages/resellers/ResellerDetailPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:ResellerDetail]'),
}));

// Support
vi.mock('@/pages/support/SupportInboxPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:SupportInbox]'),
}));
vi.mock('@/pages/support/MassSendPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:MassSend]'),
}));
vi.mock('@/pages/support/MessengersPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Messengers]'),
}));
vi.mock('@/pages/support/NewsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:News]'),
}));

// Portal
vi.mock('@/pages/portal/PortalConfigPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:PortalConfig]'),
}));
vi.mock('@/pages/portal/PortalUsersPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:PortalUsers]'),
}));

// Sistema / Administration
vi.mock('@/pages/system/LocationsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Ubicaciones]'),
}));
vi.mock('@/pages/system/AdminPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Administracion]'),
}));
vi.mock('@/pages/system/SettingsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Configuracion]'),
}));
vi.mock('@/pages/system/PartnersPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Partners]'),
}));

// Miscellaneous
vi.mock('@/pages/reports/ReportsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Informes]'),
}));
vi.mock('@/pages/monitoring/MonitoringPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Monitoring]'),
}));
vi.mock('@/pages/notifications/NotificationsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Notifications]'),
}));
vi.mock('@/pages/api-docs/ApiDocsPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:ApiDocs]'),
}));
vi.mock('@/pages/profile/ProfilePage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Profile]'),
}));

// ── Import App AFTER all mocks ────────────────────────────────────────────────
import { App } from '@/App';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function renderAt(url: string) {
  const { unmount } = render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[url]}>
        <Suspense fallback={<div>loading</div>}>
          <App />
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return unmount;
}

// ── Test cases ────────────────────────────────────────────────────────────────
// Direct URL → page marker
const directCases: Array<{ url: string; marker: string }> = [
  // Root redirect — / → /admin/dashboard
  { url: '/admin/dashboard', marker: '[PAGE:Dashboard]' },
  // Login
  { url: '/login', marker: '[PAGE:Login]' },
  // Customers
  { url: '/admin/customers/list', marker: '[PAGE:CustomersList]' },
  { url: '/admin/customers/add', marker: '[PAGE:AddCliente]' },
  { url: '/admin/customers/search', marker: '[PAGE:CustomerSearch]' },
  { url: '/admin/customers/vouchers', marker: '[PAGE:CustomerVouchers]' },
  { url: '/admin/customers/map', marker: '[PAGE:CustomerMap]' },
  { url: '/admin/customers/view/42', marker: '[PAGE:ClienteDetail]' },
  { url: '/admin/customers/view/42/edit', marker: '[PAGE:EditCliente]' },
  // Contracts (CP-8 — 2 new routes; total routes 94 → 96)
  { url: '/admin/contracts/list', marker: '[PAGE:ContractsList]' },
  { url: '/admin/contracts/technologies', marker: '[PAGE:ServiceTechnologies]' },
  // CRM
  { url: '/admin/crm/leads', marker: '[PAGE:Leads]' },
  { url: '/admin/crm/dashboard', marker: '[PAGE:CrmDashboard]' },
  { url: '/admin/crm/quotes', marker: '[PAGE:CrmQuotes]' },
  { url: '/admin/crm/map', marker: '[PAGE:CrmMap]' },
  // Tickets
  { url: '/admin/tickets', marker: '[PAGE:TicketsDashboard]' },
  { url: '/admin/tickets/opened', marker: '[PAGE:TicketsList]' },
  { url: '/admin/tickets/trash', marker: '[PAGE:TicketsArchive]' },
  { url: '/admin/tickets/new', marker: '[PAGE:CreateTicket]' },
  { url: '/admin/tickets/requesters', marker: '[PAGE:TicketRequesters]' },
  { url: '/admin/tickets/abc-123', marker: '[PAGE:TicketDetail]' },
  // Finance
  { url: '/admin/finance', marker: '[PAGE:FinanzasDashboard]' },
  { url: '/admin/finance/invoices', marker: '[PAGE:Facturas]' },
  { url: '/admin/finance/payments', marker: '[PAGE:Pagos]' },
  { url: '/admin/finance/transactions', marker: '[PAGE:Transacciones]' },
  { url: '/admin/finance/credit-notes', marker: '[PAGE:NotasCredito]' },
  { url: '/admin/finance/proforma-invoices', marker: '[PAGE:Proformas]' },
  { url: '/admin/finance/history', marker: '[PAGE:HistorialFinanciero]' },
  { url: '/admin/finance/payment-statements', marker: '[PAGE:PaymentStatements]' },
  { url: '/admin/finance/dunning', marker: '[PAGE:Dunning]' },
  { url: '/admin/finance/payment-plans', marker: '[PAGE:PaymentPlans]' },
  // Networking
  { url: '/admin/networking/routers/list', marker: '[PAGE:GestionRed]' },
  { url: '/admin/networking/network-sites', marker: '[PAGE:NetworkSites]' },
  { url: '/admin/networking/cpe', marker: '[PAGE:Cpe]' },
  { url: '/admin/networking/tr069', marker: '[PAGE:Tr069]' },
  { url: '/admin/networking/hardware', marker: '[PAGE:Hardware]' },
  { url: '/admin/networking/ipv4-networks', marker: '[PAGE:Ipv4Networks]' },
  { url: '/admin/networking/ipv6-networks', marker: '[PAGE:Ipv6Networks]' },
  { url: '/admin/networking/map', marker: '[PAGE:NetworkMap]' },
  { url: '/admin/networking/topology', marker: '[PAGE:NetworkTopology]' },
  { url: '/admin/networking/gpon', marker: '[PAGE:Gpon]' },
  { url: '/admin/networking/radius-sessions', marker: '[PAGE:RadiusSessions]' },
  { url: '/admin/networking/settings', marker: '[PAGE:NetworkingSettings]' },
  // Cortes PPPoE — moved from Clientes to Gestión de Red (pppoe.cut)
  { url: '/admin/networking/pppoe-cortes', marker: '[PAGE:PppoeCortes]' },
  // Scheduling
  { url: '/admin/scheduling/dashboard', marker: '[PAGE:SchedulingDashboard]' },
  { url: '/admin/scheduling/projects', marker: '[PAGE:SchedulingProjects]' },
  { url: '/admin/scheduling/calendars', marker: '[PAGE:SchedulingCalendar]' },
  { url: '/admin/scheduling/maps', marker: '[PAGE:SchedulingMaps]' },
  { url: '/admin/scheduling/archive', marker: '[PAGE:SchedulingArchivedTasks]' },
  { url: '/admin/scheduling/templates', marker: '[PAGE:SchedulingTemplates]' },
  { url: '/admin/scheduling/task-categories', marker: '[PAGE:SchedulingTaskCategories]' },
  { url: '/admin/scheduling/task-priorities', marker: '[PAGE:SchedulingTaskPriorities]' },
  { url: '/admin/scheduling/tasks', marker: '[PAGE:SchedulingTasks]' },
  { url: '/admin/scheduling/tasks/abc-123', marker: '[PAGE:SchedulingTaskDetail]' },
  // Tariffs
  { url: '/admin/tariffs', marker: '[PAGE:Tarifas]' },
  { url: '/admin/tariffs/internet', marker: '[PAGE:TarifasInternet]' },
  { url: '/admin/tariffs/voice', marker: '[PAGE:TarifasVoz]' },
  { url: '/admin/tariffs/recurring', marker: '[PAGE:TarifasRecurrente]' },
  { url: '/admin/tariffs/one-time', marker: '[PAGE:TarifasUnico]' },
  { url: '/admin/tariffs/bundles', marker: '[PAGE:TarifasPaquetes]' },
  { url: '/admin/tariffs/huawei-groups', marker: '[PAGE:TarifasHuaweiGroups]' },
  // Inventory (World A retired: list/items/products/supply routes removed)
  { url: '/admin/inventory/dashboard', marker: '[PAGE:InventoryDashboard]' },
  // Voice
  { url: '/admin/voice', marker: '[PAGE:Voz]' },
  { url: '/admin/voice/categories', marker: '[PAGE:VoiceCategories]' },
  { url: '/admin/voice/processing', marker: '[PAGE:VoiceProcessing]' },
  { url: '/admin/voice/rate-tables', marker: '[PAGE:VoiceRateTables]' },
  { url: '/admin/voice/prefixes', marker: '[PAGE:VoicePrefixes]' },
  { url: '/admin/voice/cdr', marker: '[PAGE:CDR]' },
  // SLA
  { url: '/admin/sla', marker: '[PAGE:SLADashboard]' },
  { url: '/admin/sla/list', marker: '[PAGE:SLAList]' },
  // Resellers
  { url: '/admin/resellers', marker: '[PAGE:ResellersList]' },
  { url: '/admin/resellers/r-42', marker: '[PAGE:ResellerDetail]' },
  // Support
  { url: '/admin/support/inbox', marker: '[PAGE:SupportInbox]' },
  { url: '/admin/support/mass-send', marker: '[PAGE:MassSend]' },
  { url: '/admin/support/messengers', marker: '[PAGE:Messengers]' },
  { url: '/admin/support/news', marker: '[PAGE:News]' },
  // Portal
  { url: '/admin/portal', marker: '[PAGE:PortalConfig]' },
  { url: '/admin/portal/users', marker: '[PAGE:PortalUsers]' },
  // System / Administration
  { url: '/admin/locations', marker: '[PAGE:Ubicaciones]' },
  { url: '/admin/administration/administrators', marker: '[PAGE:Administracion]' },
  { url: '/admin/config/main', marker: '[PAGE:Configuracion]' },
  { url: '/admin/partners', marker: '[PAGE:Partners]' },
  // Misc
  { url: '/admin/reports', marker: '[PAGE:Informes]' },
  { url: '/admin/monitoring', marker: '[PAGE:Monitoring]' },
  { url: '/admin/notifications', marker: '[PAGE:Notifications]' },
  { url: '/admin/api-docs', marker: '[PAGE:ApiDocs]' },
  { url: '/admin/profile', marker: '[PAGE:Profile]' },
  // Not found
  { url: '/totally-unknown-path', marker: '[PAGE:NotFound]' },
];

// Redirect cases: navigating to `url` should land on `marker`
const redirectCases: Array<{ url: string; redirectsTo: string; marker: string }> = [
  { url: '/', redirectsTo: '/admin/dashboard', marker: '[PAGE:Dashboard]' },
  { url: '/admin/leads', redirectsTo: '/admin/crm/leads', marker: '[PAGE:Leads]' },
  { url: '/admin/messages', redirectsTo: '/admin/support/inbox', marker: '[PAGE:SupportInbox]' },
  { url: '/admin/tickets/dashboard', redirectsTo: '/admin/tickets', marker: '[PAGE:TicketsDashboard]' },
  { url: '/admin/tickets/list', redirectsTo: '/admin/tickets/opened', marker: '[PAGE:TicketsList]' },
  { url: '/admin/tickets/archive', redirectsTo: '/admin/tickets/trash', marker: '[PAGE:TicketsArchive]' },
  { url: '/admin/finance/dashboard', redirectsTo: '/admin/finance', marker: '[PAGE:FinanzasDashboard]' },
  { url: '/admin/finance/proformas', redirectsTo: '/admin/finance/proforma-invoices', marker: '[PAGE:Proformas]' },
  { url: '/admin/networking/sites', redirectsTo: '/admin/networking/network-sites', marker: '[PAGE:NetworkSites]' },
  // Cortes PPPoE moved to Gestión de Red — old Clientes path redirects (preserves bookmarks)
  { url: '/admin/customers/pppoe-cortes', redirectsTo: '/admin/networking/pppoe-cortes', marker: '[PAGE:PppoeCortes]' },
  { url: '/admin/scheduling', redirectsTo: '/admin/scheduling/tasks', marker: '[PAGE:SchedulingTasks]' },
];

// ── Catch-all redirect: /admin/customers/:id → /admin/customers/view/:id ───────
// (CustomerIdRedirect is a real component in App.tsx — the catch-all at the bottom
//  of the customers block. It must NOT intercept specific sub-paths.)
const catchAllCases: Array<{ url: string; marker: string; shouldNotSee?: string }> = [
  // The catch-all redirects unknown :id patterns to view/:id
  { url: '/admin/customers/some-id-999', marker: '[PAGE:ClienteDetail]' },
  // Specific paths MUST NOT be swallowed by :id catch-all
  { url: '/admin/customers/search', marker: '[PAGE:CustomerSearch]', shouldNotSee: '[PAGE:ClienteDetail]' },
  { url: '/admin/customers/map', marker: '[PAGE:CustomerMap]', shouldNotSee: '[PAGE:ClienteDetail]' },
  { url: '/admin/customers/vouchers', marker: '[PAGE:CustomerVouchers]', shouldNotSee: '[PAGE:ClienteDetail]' },
  { url: '/admin/customers/add', marker: '[PAGE:AddCliente]', shouldNotSee: '[PAGE:ClienteDetail]' },
];

// ── Run direct cases ──────────────────────────────────────────────────────────
describe('Golden Routing — direct URL to page', () => {
  for (const { url, marker } of directCases) {
    it(`${url} → ${marker}`, async () => {
      const unmount = renderAt(url);
      // Suspense may need a tick to resolve lazy mocks
      await screen.findByText(marker);
      expect(screen.getByText(marker)).toBeInTheDocument();
      unmount();
    });
  }
});

// ── Run redirect cases ────────────────────────────────────────────────────────
describe('Golden Routing — redirects', () => {
  for (const { url, redirectsTo: _redirectsTo, marker } of redirectCases) {
    it(`${url} redirects → ${marker}`, async () => {
      const unmount = renderAt(url);
      await screen.findByText(marker);
      expect(screen.getByText(marker)).toBeInTheDocument();
      unmount();
    });
  }
});

// ── Run catch-all collision cases ─────────────────────────────────────────────
describe('Golden Routing — customers catch-all collision', () => {
  for (const { url, marker, shouldNotSee } of catchAllCases) {
    it(`${url} → ${marker}${shouldNotSee ? ` (NOT ${shouldNotSee})` : ''}`, async () => {
      const unmount = renderAt(url);
      await screen.findByText(marker);
      expect(screen.getByText(marker)).toBeInTheDocument();
      if (shouldNotSee) {
        expect(screen.queryByText(shouldNotSee)).not.toBeInTheDocument();
      }
      unmount();
    });
  }
});
