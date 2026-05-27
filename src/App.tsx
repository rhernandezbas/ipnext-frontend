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

const DashboardPage = lazy(() => import('@/pages/DashboardPage/DashboardPage'));
const LeadsPage = lazy(() => import('@/pages/clientes/LeadsPage'));
const LocationsPage = lazy(() => import('@/pages/system/LocationsPage'));
const ClientesListPage = lazy(() => import('@/pages/clientes/ClientesListPage'));

const ClienteDetailPage = lazy(() => import('@/pages/clientes/ClienteDetailPage'));

const TicketsDashboardPage = lazy(() => import('@/pages/tickets/TicketsDashboardPage'));
const TicketsListPage = lazy(() => import('@/pages/tickets/TicketsListPage'));
const TicketsArchivePage = lazy(() => import('@/pages/tickets/TicketsArchivePage'));
const TicketCreatePage = lazy(() => import('@/pages/tickets/CreateTicketPage'));
const TicketDetailPage = lazy(() => import('@/pages/tickets/TicketDetailPage'));
const AddClientePage = lazy(() => import('@/pages/clientes/AddClientePage'));
const EditClientePage = lazy(() => import('@/pages/clientes/EditClientePage'));

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

const GestionRedPage = lazy(() => import('@/pages/empresa/GestionRedPage'));
// Legacy pre-change-6 tasks page — kept on disk for reference but no longer routed.
// `/admin/scheduling` now redirects to /admin/scheduling/tasks (SchedulingTasksPage).
// const SchedulingPage = lazy(() => import('@/pages/empresa/SchedulingPage'));
const InventarioPage = lazy(() => import('@/pages/empresa/InventarioPage'));
const VozPage = lazy(() => import('@/pages/empresa/VozPage'));
const TarifasPage = lazy(() => import('@/pages/empresa/TarifasPage'));
const NetworkSitesPage = lazy(() => import('@/pages/empresa/NetworkSitesPage'));
const CpePage = lazy(() => import('@/pages/empresa/CpePage'));
const Tr069Page = lazy(() => import('@/pages/empresa/Tr069Page'));
const HardwarePage = lazy(() => import('@/pages/empresa/HardwarePage'));
const TarifasInternetPage = lazy(() => import('@/pages/empresa/tarifas/TarifasInternetPage'));
const TarifasVozPage = lazy(() => import('@/pages/empresa/tarifas/TarifasVozPage'));
const TarifasRecurrentePage = lazy(() => import('@/pages/empresa/tarifas/TarifasRecurrentePage'));
const TarifasUnicoPage = lazy(() => import('@/pages/empresa/tarifas/TarifasUnicoPage'));
const TarifasPaquetesPage = lazy(() => import('@/pages/empresa/tarifas/TarifasPaquetesPage'));
const TarifasHuaweiGroupsPage = lazy(() => import('@/pages/empresa/tarifas/TarifasHuaweiGroupsPage'));
const NotasCreditoPage = lazy(() => import('@/pages/finanzas/NotasCreditoPage'));
const ProformasPage = lazy(() => import('@/pages/finanzas/ProformasPage'));
const HistorialFinancieroPage = lazy(() => import('@/pages/finanzas/HistorialFinancieroPage'));
const PaymentStatementsPage = lazy(() => import('@/pages/finanzas/PaymentStatementsPage'));
const AdminPage = lazy(() => import('@/pages/system/AdminPage'));
const SettingsPage = lazy(() => import('@/pages/system/SettingsPage'));
const PartnersPage = lazy(() => import('@/pages/system/PartnersPage'));
const InformesPage = lazy(() => import('@/pages/informes/InformesPage'));
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
const CustomerSearchPage = lazy(() => import('@/pages/clientes/CustomerSearchPage'));
const CustomerVouchersPage = lazy(() => import('@/pages/clientes/CustomerVouchersPage'));
const CustomerMapPage = lazy(() => import('@/pages/clientes/CustomerMapPage'));
const TicketRequestersPage = lazy(() => import('@/pages/tickets/TicketRequestersPage'));
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
const SchedulingStageColorsPage = lazy(() => import('@/pages/scheduling/SchedulingStageColorsPage'));
const SchedulingTaskDetailPage = lazy(() => import('@/pages/scheduling/SchedulingTaskDetailPage'));
// SchedulingTasksPage is a re-export shim pointing at the directory index (SchedulingTasksPage/index.tsx).
// Route ordering is no longer load-bearing — RR6 ranking handles tasks vs tasks/:id automatically.
const SchedulingTasksPage = lazy(() => import('@/pages/scheduling/SchedulingTasksPage'));
const InventoryDashboardPage = lazy(() => import('@/pages/inventory/InventoryDashboardPage'));
const InventoryItemsPage = lazy(() => import('@/pages/inventory/InventoryItemsPage'));
const InventoryProductsPage = lazy(() => import('@/pages/inventory/InventoryProductsPage'));
const InventorySupplyPage = lazy(() => import('@/pages/inventory/InventorySupplyPage'));
const VoiceCategoriesPage = lazy(() => import('@/pages/voice/VoiceCategoriesPage'));
const VoiceProcessingPage = lazy(() => import('@/pages/voice/VoiceProcessingPage'));
const VoiceRateTablesPage = lazy(() => import('@/pages/voice/VoiceRateTablesPage'));
const VoicePrefixesPage = lazy(() => import('@/pages/voice/VoicePrefixesPage'));
const SLADashboardPage = lazy(() => import('@/pages/sla/SLADashboardPage'));
const SLAListPage = lazy(() => import('@/pages/sla/SLAListPage'));
const ResellersListPage = lazy(() => import('@/pages/resellers/ResellersListPage'));
const ResellerDetailPage = lazy(() => import('@/pages/resellers/ResellerDetailPage'));
const DunningPage = lazy(() => import('@/pages/finanzas/DunningPage'));
const PaymentPlansPage = lazy(() => import('@/pages/finanzas/PaymentPlansPage'));
const CDRPage = lazy(() => import('@/pages/voice/CDRPage'));
const PortalConfigPage = lazy(() => import('@/pages/portal/PortalConfigPage'));
const PortalUsersPage = lazy(() => import('@/pages/portal/PortalUsersPage'));
const NetworkTopologyPage = lazy(() => import('@/pages/networking/NetworkTopologyPage'));

export function App() {
  return (
    <Suspense fallback={<Spinner fullPage />}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="admin">
              <Route path="dashboard" element={<DashboardPage />} />

              {/* ── Customers ──────────────────────────────────────────────── */}
              <Route path="customers">
                <Route path="list" element={<ClientesListPage />} />
                <Route path="add" element={<AddClientePage />} />
                <Route path="search" element={<CustomerSearchPage />} />
                <Route path="vouchers" element={<CustomerVouchersPage />} />
                <Route path="map" element={<CustomerMapPage />} />
                <Route path="view/:id" element={<ClienteDetailPage />} />
                <Route path="view/:id/edit" element={<EditClientePage />} />
                {/* CATCH-ALL — RR6 ranking ensures specific paths above win over :id.
                    Natural /admin/customers/:id redirects to canonical /view/:id. */}
                <Route path=":id" element={<CustomerIdRedirect />} />
              </Route>

              <Route path="leads" element={<Navigate to="/admin/crm/leads" replace />} />
              <Route path="messages" element={<Navigate to="/admin/support/inbox" replace />} />
              {/* ── Tickets ────────────────────────────────────────────────── */}
              <Route path="tickets">
                <Route index element={<TicketsDashboardPage />} />
                <Route path="dashboard" element={<Navigate to="/admin/tickets" replace />} />
                <Route path="opened" element={<TicketsListPage />} />
                <Route path="list" element={<Navigate to="/admin/tickets/opened" replace />} />
                <Route path="trash" element={<TicketsArchivePage />} />
                <Route path="archive" element={<Navigate to="/admin/tickets/trash" replace />} />
                <Route path="new" element={<TicketCreatePage />} />
                <Route path="requesters" element={<TicketRequestersPage />} />
                <Route path=":id" element={<TicketDetailPage />} />
              </Route>
              {/* ── Finance ────────────────────────────────────────────────── */}
              <Route path="finance">
                <Route index element={<FinanzasDashboardPage />} />
                <Route path="dashboard" element={<Navigate to="/admin/finance" replace />} />
                <Route path="invoices" element={<FacturasPage />} />
                <Route path="payments" element={<PagosPage />} />
                <Route path="transactions" element={<TransaccionesPage />} />
                <Route path="credit-notes" element={<NotasCreditoPage />} />
                <Route path="proforma-invoices" element={<ProformasPage />} />
                <Route path="proformas" element={<Navigate to="/admin/finance/proforma-invoices" replace />} />
                <Route path="history" element={<HistorialFinancieroPage />} />
                <Route path="payment-statements" element={<PaymentStatementsPage />} />
                <Route path="dunning" element={<DunningPage />} />
                <Route path="payment-plans" element={<PaymentPlansPage />} />
              </Route>
              {/* ── Networking ─────────────────────────────────────────────── */}
              <Route path="networking">
                <Route path="routers/list" element={<GestionRedPage />} />
                <Route path="network-sites" element={<NetworkSitesPage />} />
                <Route path="sites" element={<Navigate to="/admin/networking/network-sites" replace />} />
                <Route path="cpe" element={<CpePage />} />
                <Route path="tr069" element={<Tr069Page />} />
                <Route path="hardware" element={<HardwarePage />} />
                <Route path="gpon" element={<GponPage />} />
                <Route path="radius-sessions" element={<RadiusSessionsPage />} />
                <Route path="ipv4-networks" element={<Ipv4NetworksPage />} />
                <Route path="ipv6-networks" element={<Ipv6NetworksPage />} />
                <Route path="map" element={<NetworkMapPage />} />
                <Route path="topology" element={<NetworkTopologyPage />} />
              </Route>
              {/* ── Scheduling ─────────────────────────────────────────────── */}
              <Route path="scheduling">
                {/*
                 * /admin/scheduling was the legacy pre-change-6 tasks page
                 * (empresa/SchedulingPage). It's now superseded by the change-6
                 * SchedulingTasksPage at /admin/scheduling/tasks. Redirect any
                 * bookmark / sidebar entry that still hits the old URL.
                 */}
                <Route index element={<Navigate to="/admin/scheduling/tasks" replace />} />
                <Route path="dashboard" element={<SchedulingDashboardPage />} />
                <Route path="projects" element={<SchedulingProjectsPage />} />
                <Route path="calendars" element={<SchedulingCalendarPage />} />
                <Route path="maps" element={<SchedulingMapsPage />} />
                <Route path="archive" element={<SchedulingArchivePage />} />
                <Route path="templates" element={<SchedulingTemplatesPage />} />
                <Route path="task-categories" element={<SchedulingTaskCategoriesPage />} />
                <Route path="task-priorities" element={<SchedulingTaskPrioritiesPage />} />
                <Route path="stage-colors" element={<SchedulingStageColorsPage />} />
                <Route path="tasks" element={<SchedulingTasksPage />} />
                <Route path="tasks/:id" element={<SchedulingTaskDetailPage />} />
              </Route>
              {/* ── Tariffs ────────────────────────────────────────────────── */}
              <Route path="tariffs">
                <Route index element={<TarifasPage />} />
                <Route path="internet" element={<TarifasInternetPage />} />
                <Route path="voice" element={<TarifasVozPage />} />
                <Route path="recurring" element={<TarifasRecurrentePage />} />
                <Route path="one-time" element={<TarifasUnicoPage />} />
                <Route path="bundles" element={<TarifasPaquetesPage />} />
                <Route path="huawei-groups" element={<TarifasHuaweiGroupsPage />} />
              </Route>

              {/* ── Voice ──────────────────────────────────────────────────── */}
              <Route path="voice">
                <Route index element={<VozPage />} />
                <Route path="categories" element={<VoiceCategoriesPage />} />
                <Route path="processing" element={<VoiceProcessingPage />} />
                <Route path="rate-tables" element={<VoiceRateTablesPage />} />
                <Route path="prefixes" element={<VoicePrefixesPage />} />
                <Route path="cdr" element={<CDRPage />} />
              </Route>

              {/* ── Inventory ──────────────────────────────────────────────── */}
              <Route path="inventory">
                <Route path="list" element={<InventarioPage />} />
                <Route path="dashboard" element={<InventoryDashboardPage />} />
                <Route path="items" element={<InventoryItemsPage />} />
                <Route path="products" element={<InventoryProductsPage />} />
                <Route path="supply" element={<InventorySupplyPage />} />
              </Route>

              {/* ── Support ────────────────────────────────────────────────── */}
              <Route path="support">
                <Route path="inbox" element={<SupportInboxPage />} />
                <Route path="mass-send" element={<MassSendPage />} />
                <Route path="messengers" element={<MessengersPage />} />
                <Route path="news" element={<NewsPage />} />
              </Route>

              {/* ── CRM ────────────────────────────────────────────────────── */}
              <Route path="crm">
                <Route path="leads" element={<LeadsPage />} />
                <Route path="dashboard" element={<CrmDashboardPage />} />
                <Route path="quotes" element={<CrmQuotesPage />} />
                <Route path="map" element={<CrmMapPage />} />
              </Route>

              {/* ── SLA ────────────────────────────────────────────────────── */}
              <Route path="sla">
                <Route index element={<SLADashboardPage />} />
                <Route path="list" element={<SLAListPage />} />
              </Route>

              {/* ── Resellers ──────────────────────────────────────────────── */}
              <Route path="resellers">
                <Route index element={<ResellersListPage />} />
                <Route path=":id" element={<ResellerDetailPage />} />
              </Route>

              {/* ── Portal ─────────────────────────────────────────────────── */}
              <Route path="portal">
                <Route index element={<PortalConfigPage />} />
                <Route path="users" element={<PortalUsersPage />} />
              </Route>

              {/* ── Administration ─────────────────────────────────────────── */}
              <Route path="administration">
                <Route path="administrators" element={<AdminPage />} />
              </Route>

              {/* ── Config ─────────────────────────────────────────────────── */}
              <Route path="config">
                <Route path="main" element={<SettingsPage />} />
              </Route>

              {/* ── Singletons ─────────────────────────────────────────────── */}
              <Route path="partners" element={<PartnersPage />} />
              <Route path="locations" element={<LocationsPage />} />
              <Route path="reports" element={<InformesPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="api-docs" element={<ApiDocsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
