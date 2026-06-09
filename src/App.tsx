import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';

/** Redirect from the natural /admin/customers/:id path to the canonical /view/:id route. */
function CustomerIdRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/admin/customers/view/${id}`} replace />;
}
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/templates/AdminLayout/AdminLayout';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary/RouteErrorBoundary';
import { RequirePermission } from '@/components/auth/RequirePermission';

const DashboardPage = lazy(() => import('@/pages/DashboardPage/DashboardPage'));
const LeadsPage = lazy(() => import('@/pages/customers/LeadsPage'));
const LocationsPage = lazy(() => import('@/pages/system/LocationsPage'));
const CustomersListPage = lazy(() => import('@/pages/customers/CustomersListPage'));
const CustomersSettingsPage = lazy(() => import('@/pages/customers/CustomersSettingsPage'));

const CustomerDetailPage = lazy(() => import('@/pages/customers/CustomerDetailPage'));

const TicketsDashboardPage = lazy(() => import('@/pages/tickets/TicketsDashboardPage'));
const TicketsListPage = lazy(() => import('@/pages/tickets/TicketsListPage'));
const TicketsArchivePage = lazy(() => import('@/pages/tickets/TicketsArchivePage'));
const TicketCreatePage = lazy(() => import('@/pages/tickets/CreateTicketPage'));
const TicketDetailPage = lazy(() => import('@/pages/tickets/TicketDetailPage'));
const AddCustomerPage = lazy(() => import('@/pages/customers/AddCustomerPage'));
const EditCustomerPage = lazy(() => import('@/pages/customers/EditCustomerPage'));

const FinanzasDashboardPage = lazy(() =>
  import('@/pages/FinanzasDashboardPage/FinanzasDashboardPage').then((m) => ({
    default: m.FinanzasDashboardPage,
  }))
);

const FacturasPage = lazy(() =>
  import('@/pages/FacturasPage/FacturasPage').then((m) => ({
    default: m.FacturasPage,
  }))
);

const PagosPage = lazy(() =>
  import('@/pages/PagosPage/PagosPage').then((m) => ({
    default: m.PagosPage,
  }))
);

const TransaccionesPage = lazy(() =>
  import('@/pages/TransaccionesPage/TransaccionesPage').then((m) => ({
    default: m.TransaccionesPage,
  }))
);

const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage/NotFoundPage').then((m) => ({
    default: m.NotFoundPage,
  }))
);

const GestionRedPage = lazy(() => import('@/pages/networking/GestionRedPage'));
const InventoryLegacyPage = lazy(() => import('@/pages/inventory/InventoryLegacyPage'));
const VoiceLegacyPage = lazy(() => import('@/pages/voice/VoiceLegacyPage'));
const TariffsPage = lazy(() => import('@/pages/tariffs/TariffsPage'));
const NetworkSitesPage = lazy(() => import('@/pages/networking/NetworkSitesPage'));
const CpePage = lazy(() => import('@/pages/networking/CpePage'));
const Tr069Page = lazy(() => import('@/pages/networking/Tr069Page'));
const HardwarePage = lazy(() => import('@/pages/networking/HardwarePage'));
const TarifasInternetPage = lazy(() => import('@/pages/tariffs/TarifasInternetPage'));
const TarifasVozPage = lazy(() => import('@/pages/tariffs/TarifasVozPage'));
const TarifasRecurrentePage = lazy(() => import('@/pages/tariffs/TarifasRecurrentePage'));
const TarifasUnicoPage = lazy(() => import('@/pages/tariffs/TarifasUnicoPage'));
const TarifasPaquetesPage = lazy(() => import('@/pages/tariffs/TarifasPaquetesPage'));
const TarifasHuaweiGroupsPage = lazy(() => import('@/pages/tariffs/TarifasHuaweiGroupsPage'));
const NotasCreditoPage = lazy(() => import('@/pages/finance/NotasCreditoPage'));
const ProformasPage = lazy(() => import('@/pages/finance/ProformasPage'));
const HistorialFinancieroPage = lazy(() => import('@/pages/finance/HistorialFinancieroPage'));
const PaymentStatementsPage = lazy(() => import('@/pages/finance/PaymentStatementsPage'));
const AdminPage = lazy(() => import('@/pages/system/AdminPage'));
const SettingsPage = lazy(() => import('@/pages/system/SettingsPage'));
const PartnersPage = lazy(() => import('@/pages/system/PartnersPage'));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));
const MonitoringPage = lazy(() => import('@/pages/monitoring/MonitoringPage'));
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage'));
const ApiDocsPage = lazy(() => import('@/pages/api-docs/ApiDocsPage'));
const GponPage = lazy(() => import('@/pages/gpon/GponPage'));
const RadiusSessionsPage = lazy(() => import('@/pages/radius/RadiusSessionsPage'));
// Removed: ClientesOnlinePage — /admin/customers/online deprecated per user request 2026-05-22.
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));

const CrmDashboardPage = lazy(() => import('@/pages/crm/CrmDashboardPage'));
const CrmQuotesPage = lazy(() => import('@/pages/crm/CrmQuotesPage'));
const CrmMapPage = lazy(() => import('@/pages/crm/CrmMapPage'));
const CustomerSearchPage = lazy(() => import('@/pages/customers/CustomerSearchPage'));
const CustomerVouchersPage = lazy(() => import('@/pages/customers/CustomerVouchersPage'));
const CustomerMapPage = lazy(() => import('@/pages/customers/CustomerMapPage'));
const TicketRequestersPage = lazy(() => import('@/pages/tickets/TicketRequestersPage'));
const TicketStatusesPage = lazy(() => import('@/pages/tickets/TicketStatusesPage'));
const SupportInboxPage = lazy(() => import('@/pages/support/SupportInboxPage'));
const MassSendPage = lazy(() => import('@/pages/support/MassSendPage'));
const MessengersPage = lazy(() => import('@/pages/support/MessengersPage'));
const NewsPage = lazy(() => import('@/pages/support/NewsPage'));
const Ipv4NetworksPage = lazy(() => import('@/pages/networking/Ipv4NetworksPage'));
const Ipv6NetworksPage = lazy(() => import('@/pages/networking/Ipv6NetworksPage'));
const NetworkMapPage = lazy(() => import('@/pages/networking/NetworkMapPage'));
const SchedulingDashboardPage = lazy(() => import('@/pages/scheduling/SchedulingDashboardPage'));
const SchedulingProjectsPage = lazy(() => import('@/pages/scheduling/SchedulingProjectsPage'));
const SchedulingCalendarPage = lazy(() => import('@/pages/scheduling/SchedulingCalendarPage'));
const SchedulingMapsPage = lazy(() => import('@/pages/scheduling/SchedulingMapsPage'));
const SchedulingArchivePage = lazy(() => import('@/pages/scheduling/SchedulingArchivePage'));
const SchedulingTemplatesPage = lazy(() => import('@/pages/scheduling/SchedulingTemplatesPage'));
const SchedulingTaskCategoriesPage = lazy(() => import('@/pages/scheduling/SchedulingTaskCategoriesPage'));
const SchedulingTaskPrioritiesPage = lazy(() => import('@/pages/scheduling/SchedulingTaskPrioritiesPage'));
const SchedulingSettingsPage = lazy(() => import('@/pages/scheduling/SchedulingSettingsPage'));
const SchedulingTaskDetailPage = lazy(() => import('@/pages/scheduling/SchedulingTaskDetailPage'));
const ClosurePendingPage = lazy(() =>
  import('@/pages/scheduling/ClosurePendingPage').then((m) => ({
    default: m.ClosurePendingPage,
  }))
);
const ReconcileInFlightPage = lazy(() =>
  import('@/pages/scheduling/ReconcileInFlightPage').then((m) => ({
    default: m.ReconcileInFlightPage,
  }))
);
// SchedulingTasksPage is a re-export shim pointing at the directory index (SchedulingTasksPage/index.tsx).
// Route ordering is no longer load-bearing — RR6 ranking handles tasks vs tasks/:id automatically.
const SchedulingTasksPage = lazy(() => import('@/pages/scheduling/SchedulingTasksPage'));
const InventoryDashboardPage = lazy(() => import('@/pages/inventory/InventoryDashboardPage'));
const InventoryItemsPage = lazy(() => import('@/pages/inventory/InventoryItemsPage'));
const InventoryProductsPage = lazy(() => import('@/pages/inventory/InventoryProductsPage'));
const InventorySupplyPage = lazy(() => import('@/pages/inventory/InventorySupplyPage'));
const InventorySettingsPage = lazy(() => import('@/pages/inventory/InventorySettingsPage'));
const InventoryDepotPage = lazy(() => import('@/pages/inventory/InventoryDepotPage'));
const InventoryReturnsPendingPage = lazy(() => import('@/pages/inventory/InventoryReturnsPendingPage'));
const VoiceCategoriesPage = lazy(() => import('@/pages/voice/VoiceCategoriesPage'));
const VoiceProcessingPage = lazy(() => import('@/pages/voice/VoiceProcessingPage'));
const VoiceRateTablesPage = lazy(() => import('@/pages/voice/VoiceRateTablesPage'));
const VoicePrefixesPage = lazy(() => import('@/pages/voice/VoicePrefixesPage'));
const SLADashboardPage = lazy(() => import('@/pages/sla/SLADashboardPage'));
const SLAListPage = lazy(() => import('@/pages/sla/SLAListPage'));
const ResellersListPage = lazy(() => import('@/pages/resellers/ResellersListPage'));
const ResellerDetailPage = lazy(() => import('@/pages/resellers/ResellerDetailPage'));
const DunningPage = lazy(() => import('@/pages/finance/DunningPage'));
const PaymentPlansPage = lazy(() => import('@/pages/finance/PaymentPlansPage'));
const CDRPage = lazy(() => import('@/pages/voice/CDRPage'));
const PortalConfigPage = lazy(() => import('@/pages/portal/PortalConfigPage'));
const PortalUsersPage = lazy(() => import('@/pages/portal/PortalUsersPage'));
const NetworkTopologyPage = lazy(() => import('@/pages/networking/NetworkTopologyPage'));
const ContractsListPage = lazy(() => import('@/pages/contracts/ContractsListPage'));
const ServiceTechnologiesPage = lazy(() => import('@/pages/contracts/ServiceTechnologiesPage'));

export function App() {
  return (
    <RouteErrorBoundary>
    <Suspense fallback={<Spinner fullPage />}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="admin">
              {/* dashboard.read */}
              <Route path="dashboard" element={<RequirePermission permission="dashboard.read"><DashboardPage /></RequirePermission>} />

              {/* ── Customers (clients.read) ────────────────────────────────── */}
              <Route path="customers">
                <Route path="list" element={<RequirePermission permission="clients.read"><CustomersListPage /></RequirePermission>} />
                <Route path="add" element={<RequirePermission permission="clients.read"><AddCustomerPage /></RequirePermission>} />
                <Route path="search" element={<RequirePermission permission="clients.read"><CustomerSearchPage /></RequirePermission>} />
                <Route path="vouchers" element={<RequirePermission permission="clients.read"><CustomerVouchersPage /></RequirePermission>} />
                <Route path="map" element={<RequirePermission permission="clients.read"><CustomerMapPage /></RequirePermission>} />
                <Route path="view/:id" element={<RequirePermission permission="clients.read"><CustomerDetailPage /></RequirePermission>} />
                <Route path="view/:id/edit" element={<RequirePermission permission="clients.read"><EditCustomerPage /></RequirePermission>} />
                <Route path="settings" element={<RequirePermission permission="clients.read"><CustomersSettingsPage /></RequirePermission>} />
                {/* CATCH-ALL — RR6 ranking ensures specific paths above win over :id.
                    Natural /admin/customers/:id redirects to canonical /view/:id. */}
                <Route path=":id" element={<CustomerIdRedirect />} />
              </Route>

              <Route path="leads" element={<Navigate to="/admin/crm/leads" replace />} />
              <Route path="messages" element={<Navigate to="/admin/support/inbox" replace />} />
              {/* ── Tickets (tickets.read) ─────────────────────────────────── */}
              <Route path="tickets">
                <Route index element={<RequirePermission permission="tickets.read"><TicketsDashboardPage /></RequirePermission>} />
                <Route path="dashboard" element={<Navigate to="/admin/tickets" replace />} />
                <Route path="opened" element={<RequirePermission permission="tickets.read"><TicketsListPage /></RequirePermission>} />
                <Route path="list" element={<Navigate to="/admin/tickets/opened" replace />} />
                <Route path="trash" element={<RequirePermission permission="tickets.read"><TicketsArchivePage /></RequirePermission>} />
                <Route path="archive" element={<Navigate to="/admin/tickets/trash" replace />} />
                <Route path="new" element={<RequirePermission permission="tickets.read"><TicketCreatePage /></RequirePermission>} />
                <Route path="requesters" element={<RequirePermission permission="tickets.read"><TicketRequestersPage /></RequirePermission>} />
                <Route path="statuses" element={<RequirePermission permission="tickets.read"><TicketStatusesPage /></RequirePermission>} />
                <Route path=":id" element={<RequirePermission permission="tickets.read"><TicketDetailPage /></RequirePermission>} />
              </Route>
              {/* ── Finance (billing.read) ─────────────────────────────────── */}
              <Route path="finance">
                <Route index element={<RequirePermission permission="billing.read"><FinanzasDashboardPage /></RequirePermission>} />
                <Route path="dashboard" element={<Navigate to="/admin/finance" replace />} />
                <Route path="invoices" element={<RequirePermission permission="billing.read"><FacturasPage /></RequirePermission>} />
                <Route path="payments" element={<RequirePermission permission="billing.read"><PagosPage /></RequirePermission>} />
                <Route path="transactions" element={<RequirePermission permission="billing.read"><TransaccionesPage /></RequirePermission>} />
                <Route path="credit-notes" element={<RequirePermission permission="billing.read"><NotasCreditoPage /></RequirePermission>} />
                <Route path="proforma-invoices" element={<RequirePermission permission="billing.read"><ProformasPage /></RequirePermission>} />
                <Route path="proformas" element={<Navigate to="/admin/finance/proforma-invoices" replace />} />
                <Route path="history" element={<RequirePermission permission="billing.read"><HistorialFinancieroPage /></RequirePermission>} />
                <Route path="payment-statements" element={<RequirePermission permission="billing.read"><PaymentStatementsPage /></RequirePermission>} />
                <Route path="dunning" element={<RequirePermission permission="billing.read"><DunningPage /></RequirePermission>} />
                <Route path="payment-plans" element={<RequirePermission permission="billing.read"><PaymentPlansPage /></RequirePermission>} />
              </Route>
              {/* ── Networking (network.read) ──────────────────────────────── */}
              <Route path="networking">
                <Route path="routers/list" element={<RequirePermission permission="network.read"><GestionRedPage /></RequirePermission>} />
                <Route path="network-sites" element={<RequirePermission permission="network.read"><NetworkSitesPage /></RequirePermission>} />
                <Route path="sites" element={<Navigate to="/admin/networking/network-sites" replace />} />
                <Route path="cpe" element={<RequirePermission permission="network.read"><CpePage /></RequirePermission>} />
                <Route path="tr069" element={<RequirePermission permission="network.read"><Tr069Page /></RequirePermission>} />
                <Route path="hardware" element={<RequirePermission permission="network.read"><HardwarePage /></RequirePermission>} />
                <Route path="gpon" element={<RequirePermission permission="network.read"><GponPage /></RequirePermission>} />
                <Route path="radius-sessions" element={<RequirePermission permission="network.read"><RadiusSessionsPage /></RequirePermission>} />
                <Route path="ipv4-networks" element={<RequirePermission permission="network.read"><Ipv4NetworksPage /></RequirePermission>} />
                <Route path="ipv6-networks" element={<RequirePermission permission="network.read"><Ipv6NetworksPage /></RequirePermission>} />
                <Route path="map" element={<RequirePermission permission="network.read"><NetworkMapPage /></RequirePermission>} />
                <Route path="topology" element={<RequirePermission permission="network.read"><NetworkTopologyPage /></RequirePermission>} />
              </Route>
              {/* ── Scheduling (scheduling.read) ───────────────────────────── */}
              <Route path="scheduling">
                {/*
                 * /admin/scheduling was the legacy pre-change-6 tasks page
                 * (empresa/SchedulingPage). It's now superseded by the change-6
                 * SchedulingTasksPage at /admin/scheduling/tasks. Redirect any
                 * bookmark / sidebar entry that still hits the old URL.
                 */}
                <Route index element={<Navigate to="/admin/scheduling/tasks" replace />} />
                <Route path="dashboard" element={<RequirePermission permission="scheduling.read"><SchedulingDashboardPage /></RequirePermission>} />
                <Route path="projects" element={<RequirePermission permission="scheduling.read"><SchedulingProjectsPage /></RequirePermission>} />
                <Route path="calendars" element={<RequirePermission permission="scheduling.read"><SchedulingCalendarPage /></RequirePermission>} />
                <Route path="maps" element={<RequirePermission permission="scheduling.read"><SchedulingMapsPage /></RequirePermission>} />
                <Route path="archive" element={<RequirePermission permission="scheduling.read"><SchedulingArchivePage /></RequirePermission>} />
                <Route path="templates" element={<RequirePermission permission="scheduling.read"><SchedulingTemplatesPage /></RequirePermission>} />
                <Route path="task-categories" element={<RequirePermission permission="scheduling.read"><SchedulingTaskCategoriesPage /></RequirePermission>} />
                <Route path="task-priorities" element={<RequirePermission permission="scheduling.read"><SchedulingTaskPrioritiesPage /></RequirePermission>} />
                <Route path="settings" element={<RequirePermission permission="scheduling.read"><SchedulingSettingsPage /></RequirePermission>} />
                <Route path="iclass/closure/pending" element={<RequirePermission permission="iclass.manage"><ClosurePendingPage /></RequirePermission>} />
                <Route path="iclass/closure/reconcile" element={<RequirePermission permission="iclass.manage"><ReconcileInFlightPage /></RequirePermission>} />
                <Route path="tasks" element={<RequirePermission permission="scheduling.read"><SchedulingTasksPage /></RequirePermission>} />
                <Route path="tasks/:id" element={<RequirePermission permission="scheduling.read"><SchedulingTaskDetailPage /></RequirePermission>} />
              </Route>
              {/* ── Tariffs (tariffs.read) ─────────────────────────────────── */}
              <Route path="tariffs">
                <Route index element={<RequirePermission permission="tariffs.read"><TariffsPage /></RequirePermission>} />
                <Route path="internet" element={<RequirePermission permission="tariffs.read"><TarifasInternetPage /></RequirePermission>} />
                <Route path="voice" element={<RequirePermission permission="tariffs.read"><TarifasVozPage /></RequirePermission>} />
                <Route path="recurring" element={<RequirePermission permission="tariffs.read"><TarifasRecurrentePage /></RequirePermission>} />
                <Route path="one-time" element={<RequirePermission permission="tariffs.read"><TarifasUnicoPage /></RequirePermission>} />
                <Route path="bundles" element={<RequirePermission permission="tariffs.read"><TarifasPaquetesPage /></RequirePermission>} />
                <Route path="huawei-groups" element={<RequirePermission permission="tariffs.read"><TarifasHuaweiGroupsPage /></RequirePermission>} />
              </Route>

              {/* ── Voice (voices.read) ────────────────────────────────────── */}
              <Route path="voice">
                <Route index element={<RequirePermission permission="voices.read"><VoiceLegacyPage /></RequirePermission>} />
                <Route path="categories" element={<RequirePermission permission="voices.read"><VoiceCategoriesPage /></RequirePermission>} />
                <Route path="processing" element={<RequirePermission permission="voices.read"><VoiceProcessingPage /></RequirePermission>} />
                <Route path="rate-tables" element={<RequirePermission permission="voices.read"><VoiceRateTablesPage /></RequirePermission>} />
                <Route path="prefixes" element={<RequirePermission permission="voices.read"><VoicePrefixesPage /></RequirePermission>} />
                <Route path="cdr" element={<RequirePermission permission="voices.read"><CDRPage /></RequirePermission>} />
              </Route>

              {/* ── Inventory (inventory.read) ─────────────────────────────── */}
              <Route path="inventory">
                <Route path="list" element={<RequirePermission permission="inventory.read"><InventoryLegacyPage /></RequirePermission>} />
                <Route path="dashboard" element={<RequirePermission permission="inventory.read"><InventoryDashboardPage /></RequirePermission>} />
                <Route path="items" element={<RequirePermission permission="inventory.read"><InventoryItemsPage /></RequirePermission>} />
                <Route path="products" element={<RequirePermission permission="inventory.read"><InventoryProductsPage /></RequirePermission>} />
                <Route path="depot" element={<RequirePermission permission="inventory.read"><InventoryDepotPage /></RequirePermission>} />
                <Route path="returns" element={<RequirePermission permission="inventory.read"><InventoryReturnsPendingPage /></RequirePermission>} />
                <Route path="supply" element={<RequirePermission permission="inventory.read"><InventorySupplyPage /></RequirePermission>} />
                <Route path="settings" element={<RequirePermission permission="inventory.read"><InventorySettingsPage /></RequirePermission>} />
              </Route>

              {/* ── Support (support.read) ─────────────────────────────────── */}
              <Route path="support">
                <Route path="inbox" element={<RequirePermission permission="support.read"><SupportInboxPage /></RequirePermission>} />
                <Route path="mass-send" element={<RequirePermission permission="support.read"><MassSendPage /></RequirePermission>} />
                <Route path="messengers" element={<RequirePermission permission="support.read"><MessengersPage /></RequirePermission>} />
                <Route path="news" element={<RequirePermission permission="support.read"><NewsPage /></RequirePermission>} />
              </Route>

              {/* ── CRM (crm.read) ─────────────────────────────────────────── */}
              <Route path="crm">
                <Route path="leads" element={<RequirePermission permission="crm.read"><LeadsPage /></RequirePermission>} />
                <Route path="dashboard" element={<RequirePermission permission="crm.read"><CrmDashboardPage /></RequirePermission>} />
                <Route path="quotes" element={<RequirePermission permission="crm.read"><CrmQuotesPage /></RequirePermission>} />
                <Route path="map" element={<RequirePermission permission="crm.read"><CrmMapPage /></RequirePermission>} />
              </Route>

              {/* ── Contracts (contracts.read) — 2 routes ─────────────────── */}
              <Route path="contracts">
                <Route path="list" element={<RequirePermission permission="contracts.read"><ContractsListPage /></RequirePermission>} />
                <Route path="technologies" element={<RequirePermission permission="contracts.read"><ServiceTechnologiesPage /></RequirePermission>} />
              </Route>

              {/* ── SLA (sla.read) ─────────────────────────────────────────── */}
              <Route path="sla">
                <Route index element={<RequirePermission permission="sla.read"><SLADashboardPage /></RequirePermission>} />
                <Route path="list" element={<RequirePermission permission="sla.read"><SLAListPage /></RequirePermission>} />
              </Route>

              {/* ── Resellers (partners.read) ──────────────────────────────── */}
              <Route path="resellers">
                <Route index element={<RequirePermission permission="partners.read"><ResellersListPage /></RequirePermission>} />
                <Route path=":id" element={<RequirePermission permission="partners.read"><ResellerDetailPage /></RequirePermission>} />
              </Route>

              {/* ── Portal (portal.read) ───────────────────────────────────── */}
              <Route path="portal">
                <Route index element={<RequirePermission permission="portal.read"><PortalConfigPage /></RequirePermission>} />
                <Route path="users" element={<RequirePermission permission="portal.read"><PortalUsersPage /></RequirePermission>} />
              </Route>

              {/* ── Administration (admin.read) ────────────────────────────── */}
              <Route path="administration">
                <Route path="administrators" element={<RequirePermission permission="admin.read"><AdminPage /></RequirePermission>} />
              </Route>

              {/* ── Config (settings.read) ─────────────────────────────────── */}
              <Route path="config">
                <Route path="main" element={<RequirePermission permission="settings.read"><SettingsPage /></RequirePermission>} />
              </Route>

              {/* ── Singletons ─────────────────────────────────────────────── */}
              {/* partners.read — used for /admin/partners per inventory */}
              <Route path="partners" element={<RequirePermission permission="partners.read"><PartnersPage /></RequirePermission>} />
              {/* crm.read — locations per inventory note */}
              <Route path="locations" element={<RequirePermission permission="crm.read"><LocationsPage /></RequirePermission>} />
              {/* reports.read */}
              <Route path="reports" element={<RequirePermission permission="reports.read"><ReportsPage /></RequirePermission>} />
              {/* monitoring.read */}
              <Route path="monitoring" element={<RequirePermission permission="monitoring.read"><MonitoringPage /></RequirePermission>} />
              {/* notifications.read */}
              <Route path="notifications" element={<RequirePermission permission="notifications.read"><NotificationsPage /></RequirePermission>} />
              {/* settings.read — api-docs */}
              <Route path="api-docs" element={<RequirePermission permission="settings.read"><ApiDocsPage /></RequirePermission>} />
              {/* profile.read — always allow own profile */}
              <Route path="profile" element={<RequirePermission permission="profile.read"><ProfilePage /></RequirePermission>} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
    </RouteErrorBoundary>
  );
}
