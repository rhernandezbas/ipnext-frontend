import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/templates/AdminLayout/AdminLayout';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import { Spinner } from '@/components/atoms/Spinner/Spinner';

const DashboardPage = lazy(() => import('@/pages/DashboardPage/DashboardPage'));
const LeadsPage = lazy(() => import('@/pages/clientes/LeadsPage'));
const UbicacionesPage = lazy(() => import('@/pages/sistema/UbicacionesPage'));
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
const SchedulingPage = lazy(() => import('@/pages/empresa/SchedulingPage'));
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
const AdministracionPage = lazy(() => import('@/pages/sistema/AdministracionPage'));
const ConfiguracionPage = lazy(() => import('@/pages/sistema/ConfiguracionPage'));
const PartnersPage = lazy(() => import('@/pages/sistema/PartnersPage'));
const InformesPage = lazy(() => import('@/pages/informes/InformesPage'));
const MonitoringPage = lazy(() => import('@/pages/monitoring/MonitoringPage'));
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage'));
const ApiDocsPage = lazy(() => import('@/pages/api-docs/ApiDocsPage'));
const GponPage = lazy(() => import('@/pages/gpon/GponPage'));
const RadiusSessionsPage = lazy(() => import('@/pages/radius/RadiusSessionsPage'));
const ClientesOnlinePage = lazy(() => import('@/pages/clientes/ClientesOnlinePage'));
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
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route path="/admin/customers/list" element={<ClientesListPage />} />
            <Route path="/admin/customers/add" element={<AddClientePage />} />
            <Route path="/admin/crm/leads" element={<LeadsPage />} />
            <Route path="/admin/leads" element={<Navigate to="/admin/crm/leads" replace />} />
            <Route path="/admin/messages" element={<Navigate to="/admin/support/inbox" replace />} />
            <Route path="/admin/customers/online" element={<ClientesOnlinePage />} />
            <Route path="/admin/customers/view/:id" element={<ClienteDetailPage />} />
            <Route path="/admin/customers/view/:id/edit" element={<EditClientePage />} />
            <Route path="/admin/tickets/dashboard" element={<Navigate to="/admin/tickets" replace />} />
            <Route path="/admin/tickets" element={<TicketsDashboardPage />} />
            <Route path="/admin/tickets/opened" element={<TicketsListPage />} />
            <Route path="/admin/tickets/list" element={<Navigate to="/admin/tickets/opened" replace />} />
            <Route path="/admin/tickets/trash" element={<TicketsArchivePage />} />
            <Route path="/admin/tickets/archive" element={<Navigate to="/admin/tickets/trash" replace />} />
            <Route path="/admin/tickets/new" element={<TicketCreatePage />} />
            <Route path="/admin/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/admin/finance/dashboard" element={<Navigate to="/admin/finance" replace />} />
            <Route path="/admin/finance" element={<FinanzasDashboardPage />} />
            <Route path="/admin/finance/invoices" element={<FacturasPage />} />
            <Route path="/admin/finance/payments" element={<PagosPage />} />
            <Route
              path="/admin/finance/transactions"
              element={<TransaccionesPage />}
            />
            <Route path="/admin/finance/credit-notes" element={<NotasCreditoPage />} />
            <Route path="/admin/finance/proforma-invoices" element={<ProformasPage />} />
            <Route path="/admin/finance/proformas" element={<Navigate to="/admin/finance/proforma-invoices" replace />} />
            <Route path="/admin/finance/history" element={<HistorialFinancieroPage />} />
            <Route path="/admin/finance/payment-statements" element={<PaymentStatementsPage />} />
            <Route path="/admin/networking/routers/list" element={<GestionRedPage />} />
            <Route path="/admin/networking/network-sites" element={<NetworkSitesPage />} />
            <Route path="/admin/networking/sites" element={<Navigate to="/admin/networking/network-sites" replace />} />
            <Route path="/admin/networking/cpe" element={<CpePage />} />
            <Route path="/admin/networking/tr069" element={<Tr069Page />} />
            <Route path="/admin/networking/hardware" element={<HardwarePage />} />
            <Route path="/admin/scheduling" element={<SchedulingPage />} />
            <Route path="/admin/inventory/list" element={<InventarioPage />} />
            <Route path="/admin/voice" element={<VozPage />} />
            <Route path="/admin/tariffs" element={<TarifasPage />} />
            <Route path="/admin/tariffs/internet" element={<TarifasInternetPage />} />
            <Route path="/admin/tariffs/voice" element={<TarifasVozPage />} />
            <Route path="/admin/tariffs/recurring" element={<TarifasRecurrentePage />} />
            <Route path="/admin/tariffs/one-time" element={<TarifasUnicoPage />} />
            <Route path="/admin/tariffs/bundles" element={<TarifasPaquetesPage />} />
            <Route path="/admin/tariffs/huawei-groups" element={<TarifasHuaweiGroupsPage />} />
            <Route path="/admin/administration/administrators" element={<AdministracionPage />} />
            <Route path="/admin/config/main" element={<ConfiguracionPage />} />
            <Route path="/admin/partners" element={<PartnersPage />} />
            <Route path="/admin/locations" element={<UbicacionesPage />} />
            <Route path="/admin/reports" element={<InformesPage />} />
            <Route path="/admin/monitoring" element={<MonitoringPage />} />
            <Route path="/admin/notifications" element={<NotificationsPage />} />
            <Route path="/admin/api-docs" element={<ApiDocsPage />} />
            <Route path="/admin/networking/gpon" element={<GponPage />} />
            <Route path="/admin/networking/radius-sessions" element={<RadiusSessionsPage />} />
            <Route path="/admin/profile" element={<ProfilePage />} />
            <Route path="/admin/crm/dashboard" element={<CrmDashboardPage />} />
            <Route path="/admin/crm/quotes" element={<CrmQuotesPage />} />
            <Route path="/admin/crm/map" element={<CrmMapPage />} />
            <Route path="/admin/customers/search" element={<CustomerSearchPage />} />
            <Route path="/admin/customers/vouchers" element={<CustomerVouchersPage />} />
            <Route path="/admin/customers/map" element={<CustomerMapPage />} />
            <Route path="/admin/tickets/requesters" element={<TicketRequestersPage />} />
            <Route path="/admin/support/inbox" element={<SupportInboxPage />} />
            <Route path="/admin/support/mass-send" element={<MassSendPage />} />
            <Route path="/admin/support/messengers" element={<MessengersPage />} />
            <Route path="/admin/support/news" element={<NewsPage />} />
            <Route path="/admin/networking/ipv4-networks" element={<Ipv4NetworksPage />} />
            <Route path="/admin/networking/ipv6-networks" element={<Ipv6NetworksPage />} />
            <Route path="/admin/networking/map" element={<NetworkMapPage />} />
            <Route path="/admin/scheduling/dashboard" element={<SchedulingDashboardPage />} />
            <Route path="/admin/scheduling/projects" element={<SchedulingProjectsPage />} />
            <Route path="/admin/scheduling/calendars" element={<SchedulingCalendarPage />} />
            <Route path="/admin/scheduling/maps" element={<SchedulingMapsPage />} />
            <Route path="/admin/scheduling/archive" element={<SchedulingArchivePage />} />
            <Route path="/admin/inventory/dashboard" element={<InventoryDashboardPage />} />
            <Route path="/admin/inventory/items" element={<InventoryItemsPage />} />
            <Route path="/admin/inventory/products" element={<InventoryProductsPage />} />
            <Route path="/admin/inventory/supply" element={<InventorySupplyPage />} />
            <Route path="/admin/voice/categories" element={<VoiceCategoriesPage />} />
            <Route path="/admin/voice/processing" element={<VoiceProcessingPage />} />
            <Route path="/admin/voice/rate-tables" element={<VoiceRateTablesPage />} />
            <Route path="/admin/voice/prefixes" element={<VoicePrefixesPage />} />
            <Route path="/admin/sla" element={<SLADashboardPage />} />
            <Route path="/admin/sla/list" element={<SLAListPage />} />
            <Route path="/admin/resellers" element={<ResellersListPage />} />
            <Route path="/admin/resellers/:id" element={<ResellerDetailPage />} />
            <Route path="/admin/finance/dunning" element={<DunningPage />} />
            <Route path="/admin/finance/payment-plans" element={<PaymentPlansPage />} />
            <Route path="/admin/voice/cdr" element={<CDRPage />} />
            <Route path="/admin/portal" element={<PortalConfigPage />} />
            <Route path="/admin/portal/users" element={<PortalUsersPage />} />
            <Route path="/admin/networking/topology" element={<NetworkTopologyPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
