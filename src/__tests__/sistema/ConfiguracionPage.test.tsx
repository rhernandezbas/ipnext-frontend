import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as ConfiguracionPage } from '@/pages/sistema/ConfiguracionPage';
import * as useSettingsModule from '@/hooks/useSettings';
import type { SystemSettings, EmailSettings, MessageTemplate, ApiToken, FinanceSettings, PaymentMethod, Webhook, BackupRecord, ClientPortalSettings } from '@/types/settings';

vi.mock('@/hooks/useSettings');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockSystemSettings: SystemSettings = {
  companyName: 'IPNEXT SA',
  timezone: 'America/Argentina/Buenos_Aires',
  currency: 'ARS',
  language: 'es',
  dateFormat: 'DD/MM/YYYY',
  invoicePrefix: 'FAC-',
  supportEmail: 'soporte@ipnext.com.ar',
  website: 'https://ipnext.com.ar',
};

const mockEmailSettings: EmailSettings = {
  smtpHost: 'smtp.ipnext.com.ar',
  smtpPort: 587,
  smtpUser: 'noreply@ipnext.com.ar',
  smtpPassword: '••••••••',
  fromName: 'IPNEXT',
  fromEmail: 'noreply@ipnext.com.ar',
  useTls: true,
};

const mockTemplates: MessageTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Bienvenida',
    type: 'welcome',
    subject: 'Bienvenido a IPNEXT',
    body: 'Cuerpo del email de bienvenida',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tpl-2',
    name: 'Factura',
    type: 'invoice',
    subject: 'Factura disponible',
    body: 'Cuerpo de la factura',
    updatedAt: '2024-02-01T00:00:00Z',
  },
];

const mockApiTokens: ApiToken[] = [
  {
    id: 'tok-1',
    name: 'Integración ERP',
    token: '••••••••a1b2',
    permissions: ['read:clients', 'write:invoices'],
    createdAt: '2024-01-15T00:00:00Z',
    lastUsed: '2026-04-28T06:00:00Z',
  },
];

const mockFinanceSettings: FinanceSettings = {
  invoiceDueDays: 10,
  taxName: 'IVA',
  taxRate: 21,
  taxIncluded: false,
  autoGenerateInvoices: true,
  invoiceDay: 1,
  paymentMethods: [],
  lateFeeEnabled: true,
  lateFeeAmount: 500,
  lateFeeDays: 5,
  reminderDays: [3, 7],
  currency: 'ARS',
  currencySymbol: '$',
};

const mockPaymentMethods: PaymentMethod[] = [
  { id: '1', name: 'Transferencia bancaria', type: 'bank_transfer', enabled: true, config: { cbu: '0000003100012345678901', alias: 'ipnext.pago' } },
  { id: '2', name: 'Mercado Pago', type: 'mercadopago', enabled: true, config: {} },
  { id: '3', name: 'Efectivo', type: 'cash', enabled: true, config: {} },
];

const mockWebhooks: Webhook[] = [
  {
    id: 'wh-1',
    name: 'ERP Integration',
    url: 'https://erp.ipnext.com.ar/webhooks',
    events: ['invoice.created', 'invoice.paid'],
    secret: '••••••••',
    status: 'active',
    lastTriggered: '2026-04-28T06:00:00Z',
    lastStatus: 'success',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const mockBackups: BackupRecord[] = [
  {
    id: 'bk-1',
    filename: 'backup-2026-04-21-0300.tar.gz',
    size: 52428800,
    type: 'scheduled',
    status: 'completed',
    createdAt: '2026-04-21T03:00:00Z',
    downloadUrl: '/api/settings/backups/bk-1/download',
  },
];

const mockClientPortal: ClientPortalSettings = {
  enabled: true,
  portalUrl: 'https://portal.ipnext.com.ar',
  allowSelfRegistration: false,
  requireEmailVerification: true,
  allowPaymentOnline: true,
  allowTicketCreation: true,
  allowServiceManagement: false,
  welcomeMessage: 'Bienvenido',
  logoUrl: null,
  primaryColor: '#2563eb',
  customCss: '',
};

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <ConfiguracionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ConfiguracionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSettingsModule.useSystemSettings).mockReturnValue({
      data: mockSystemSettings,
      isLoading: false,
    } as ReturnType<typeof useSettingsModule.useSystemSettings>);

    vi.mocked(useSettingsModule.useUpdateSystemSettings).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useUpdateSystemSettings>);

    vi.mocked(useSettingsModule.useEmailSettings).mockReturnValue({
      data: mockEmailSettings,
      isLoading: false,
    } as ReturnType<typeof useSettingsModule.useEmailSettings>);

    vi.mocked(useSettingsModule.useUpdateEmailSettings).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useUpdateEmailSettings>);

    vi.mocked(useSettingsModule.useSendTestEmail).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useSendTestEmail>);

    vi.mocked(useSettingsModule.useTemplates).mockReturnValue({
      data: mockTemplates,
      isLoading: false,
    } as ReturnType<typeof useSettingsModule.useTemplates>);

    vi.mocked(useSettingsModule.useUpdateTemplate).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useUpdateTemplate>);

    vi.mocked(useSettingsModule.useApiTokens).mockReturnValue({
      data: mockApiTokens,
      isLoading: false,
    } as ReturnType<typeof useSettingsModule.useApiTokens>);

    vi.mocked(useSettingsModule.useCreateApiToken).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useCreateApiToken>);

    vi.mocked(useSettingsModule.useRevokeApiToken).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useRevokeApiToken>);

    vi.mocked(useSettingsModule.useFinanceSettings).mockReturnValue({
      data: mockFinanceSettings,
      isLoading: false,
    } as ReturnType<typeof useSettingsModule.useFinanceSettings>);

    vi.mocked(useSettingsModule.useUpdateFinanceSettings).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useUpdateFinanceSettings>);

    vi.mocked(useSettingsModule.usePaymentMethods).mockReturnValue({
      data: mockPaymentMethods,
      isLoading: false,
    } as ReturnType<typeof useSettingsModule.usePaymentMethods>);

    vi.mocked(useSettingsModule.useCreatePaymentMethod).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useCreatePaymentMethod>);

    vi.mocked(useSettingsModule.useWebhooks).mockReturnValue({
      data: mockWebhooks,
      isLoading: false,
    } as ReturnType<typeof useSettingsModule.useWebhooks>);

    vi.mocked(useSettingsModule.useCreateWebhook).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useCreateWebhook>);

    vi.mocked(useSettingsModule.useTestWebhook).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useTestWebhook>);

    vi.mocked(useSettingsModule.useBackups).mockReturnValue({
      data: mockBackups,
      isLoading: false,
    } as ReturnType<typeof useSettingsModule.useBackups>);

    vi.mocked(useSettingsModule.useCreateBackup).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useCreateBackup>);

    vi.mocked(useSettingsModule.useDeleteBackup).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useDeleteBackup>);

    vi.mocked(useSettingsModule.useClientPortalSettings).mockReturnValue({
      data: mockClientPortal,
      isLoading: false,
    } as ReturnType<typeof useSettingsModule.useClientPortalSettings>);

    vi.mocked(useSettingsModule.useUpdateClientPortalSettings).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSettingsModule.useUpdateClientPortalSettings>);
  });

  it('renders "Sistema" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Sistema' })).toBeInTheDocument();
  });

  it('renders "Correo" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Correo' })).toBeInTheDocument();
  });

  it('renders "Plantillas" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Plantillas' })).toBeInTheDocument();
  });

  it('renders "Tokens API" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Tokens API' })).toBeInTheDocument();
  });

  it('Sistema tab shows company name field with value from hook', () => {
    renderPage();
    const input = screen.getByLabelText('Nombre de empresa') as HTMLInputElement;
    expect(input.value).toBe('IPNEXT SA');
  });

  it('Correo tab shows SMTP host field', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Correo' }));

    const input = screen.getByLabelText('Servidor SMTP') as HTMLInputElement;
    expect(input.value).toBe('smtp.ipnext.com.ar');
  });

  it('Plantillas tab shows template list', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Plantillas' }));

    // Template names appear (possibly multiple times due to type badge labels)
    expect(screen.getAllByText('Bienvenida').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Factura').length).toBeGreaterThanOrEqual(1);
  });

  it('Tokens API tab shows "Nuevo token" button', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Tokens API' }));

    expect(screen.getByRole('button', { name: 'Nuevo token' })).toBeInTheDocument();
  });

  it('renders "Finanzas" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Finanzas' })).toBeInTheDocument();
  });

  it('switching to Finanzas tab shows "Facturación" section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Finanzas' }));

    expect(screen.getByText('Facturación')).toBeInTheDocument();
  });

  it('Finanzas tab shows payment methods table with method names', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Finanzas' }));

    expect(screen.getAllByText('Transferencia bancaria').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Mercado Pago').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Efectivo').length).toBeGreaterThanOrEqual(1);
  });

  it('"Agregar método de pago" button exists in Finanzas tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Finanzas' }));

    expect(screen.getByRole('button', { name: 'Agregar método de pago' })).toBeInTheDocument();
  });

  it('Template editor shows available variables panel when template has variables', async () => {
    const user = userEvent.setup();

    // Override templates mock with variables
    vi.mocked(useSettingsModule.useTemplates).mockReturnValue({
      data: [{
        id: 'tpl-1',
        name: 'Bienvenida',
        type: 'welcome' as const,
        subject: 'Bienvenido a {{empresa.nombre}}',
        body: 'Estimado {{cliente.nombre}}',
        variables: [
          { key: 'cliente.nombre', description: 'Nombre del cliente', example: 'Juan Pérez' },
          { key: 'empresa.nombre', description: 'Nombre de la empresa', example: 'IPNEXT SA' },
        ],
        updatedAt: '2024-01-01T00:00:00Z',
      }],
      isLoading: false,
    } as ReturnType<typeof useSettingsModule.useTemplates>);

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Plantillas' }));

    // Click the template row to open editor
    const templateButtons = screen.getAllByRole('button', { name: /bienvenida/i });
    await user.click(templateButtons[0]);

    // Variables panel should appear
    expect(screen.getByTestId('variables-panel')).toBeInTheDocument();
  });

  it('"Vista previa" button exists in template editor', async () => {
    const user = userEvent.setup();

    vi.mocked(useSettingsModule.useTemplates).mockReturnValue({
      data: [{
        id: 'tpl-1',
        name: 'Bienvenida',
        type: 'welcome' as const,
        subject: 'Bienvenido',
        body: 'Hola {{cliente.nombre}}',
        variables: [
          { key: 'cliente.nombre', description: 'Nombre', example: 'Juan' },
        ],
        updatedAt: '2024-01-01T00:00:00Z',
      }],
      isLoading: false,
    } as ReturnType<typeof useSettingsModule.useTemplates>);

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Plantillas' }));
    const templateButtons = screen.getAllByRole('button', { name: /bienvenida/i });
    await user.click(templateButtons[0]);

    expect(screen.getByRole('button', { name: 'Vista previa' })).toBeInTheDocument();
  });

  // Module 1: Webhooks
  it('"Webhooks" tab button renders', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Webhooks' })).toBeInTheDocument();
  });

  it('switching to Webhooks shows webhook list', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Webhooks' }));

    expect(screen.getByText('ERP Integration')).toBeInTheDocument();
  });

  it('"Nuevo webhook" button exists in Webhooks tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Webhooks' }));

    expect(screen.getByRole('button', { name: 'Nuevo webhook' })).toBeInTheDocument();
  });

  // Module 2: Respaldo
  it('"Respaldo" tab button renders', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Respaldo' })).toBeInTheDocument();
  });

  it('switching to Respaldo shows backup list', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Respaldo' }));

    expect(screen.getByText('backup-2026-04-21-0300.tar.gz')).toBeInTheDocument();
  });

  it('"Crear respaldo ahora" button exists in Respaldo tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Respaldo' }));

    expect(screen.getByRole('button', { name: 'Crear respaldo ahora' })).toBeInTheDocument();
  });

  // Module 3: Portal Cliente
  it('"Portal Cliente" tab button renders', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Portal Cliente' })).toBeInTheDocument();
  });

  it('switching to Portal Cliente shows portal URL field', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Portal Cliente' }));

    expect(screen.getByLabelText('URL del portal')).toBeInTheDocument();
  });

  it('"Habilitar portal" toggle exists in Portal Cliente tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Portal Cliente' }));

    expect(screen.getByLabelText('Habilitar portal')).toBeInTheDocument();
  });

  // Batch 4 — new tabs

  it('"Notificaciones" tab button renders', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument();
  });

  it('switching to Notificaciones tab shows SMS section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(screen.getByText('SMS')).toBeInTheDocument();
  });

  it('Notificaciones tab shows WhatsApp section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  });

  it('Notificaciones tab shows Push Notifications section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(screen.getByText(/push/i)).toBeInTheDocument();
  });

  it('"Políticas de Red" tab button renders', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Políticas de Red' })).toBeInTheDocument();
  });

  it('switching to Políticas de Red tab shows session timeout field', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Políticas de Red' }));

    expect(screen.getByLabelText(/timeout de sesión/i)).toBeInTheDocument();
  });

  it('Políticas de Red tab shows IP Pools section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Políticas de Red' }));

    expect(screen.getByText(/ip pools/i)).toBeInTheDocument();
  });

  it('Políticas de Red tab shows RADIUS section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Políticas de Red' }));

    expect(screen.getByText(/radius/i)).toBeInTheDocument();
  });

  // Batch 2 — new tabs: Add-ons, Logs del sistema, Tareas programadas, Integraciones

  it('renders "Add-ons" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Add-ons' })).toBeInTheDocument();
  });

  it('switching to Add-ons tab shows module cards', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Add-ons' }));

    expect(screen.getByText('Facturación')).toBeInTheDocument();
  });

  it('Add-ons tab shows optional modules with toggles', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Add-ons' }));

    expect(screen.getByText('Inventario')).toBeInTheDocument();
  });

  it('renders "Logs del sistema" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Logs del sistema' })).toBeInTheDocument();
  });

  it('switching to Logs del sistema tab shows log level filter', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Logs del sistema' }));

    expect(screen.getAllByText(/nivel/i).length).toBeGreaterThan(0);
  });

  it('Logs del sistema tab shows log entries with timestamps', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Logs del sistema' }));

    expect(screen.getByText(/timestamp/i)).toBeInTheDocument();
  });

  it('renders "Tareas programadas" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Tareas programadas' })).toBeInTheDocument();
  });

  it('switching to Tareas programadas tab shows task list', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Tareas programadas' }));

    expect(screen.getByText('Generar facturas')).toBeInTheDocument();
  });

  it('Tareas programadas tab shows "Ejecutar ahora" button', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Tareas programadas' }));

    const runBtns = screen.getAllByRole('button', { name: /ejecutar ahora/i });
    expect(runBtns.length).toBeGreaterThan(0);
  });

  it('renders "Integraciones" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Integraciones' })).toBeInTheDocument();
  });

  it('switching to Integraciones tab shows Contabilidad section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Integraciones' }));

    expect(screen.getByText('Contabilidad')).toBeInTheDocument();
  });

  it('Integraciones tab shows Pagos section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Integraciones' }));

    expect(screen.getByText('Pagos')).toBeInTheDocument();
  });

  it('Integraciones tab shows Monitoreo section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Integraciones' }));

    expect(screen.getByText('Monitoreo')).toBeInTheDocument();
  });
});
