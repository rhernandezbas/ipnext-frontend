/**
 * PortalConfigPage (gestion-app) — vista de SÓLO LECTURA de la configuración
 * REAL del portal (`GET /api/settings/client-portal`). La edición vive en
 * Sistema › Configuración (fuente de verdad única); esta página ya no miente
 * con un mock.
 *
 *  PC-1  muestra los valores REALES que devuelve el endpoint (mock del fetch)
 *  PC-2  rama ERROR — alerta + reintentar
 *  PC-3  rama LOADING — ni error ni datos mientras carga
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/settings.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/settings.api')>();
  return { ...actual, getClientPortalSettings: vi.fn() };
});

import { getClientPortalSettings } from '@/api/settings.api';
import type { ClientPortalSettings } from '@/types/settings';
import PortalConfigPage from '@/pages/portal/PortalConfigPage';

const SETTINGS: ClientPortalSettings = {
  enabled: true,
  portalUrl: 'https://portal.ipnext.example',
  allowSelfRegistration: false,
  requireEmailVerification: true,
  allowPaymentOnline: true,
  allowTicketCreation: false,
  allowServiceManagement: false,
  welcomeMessage: 'Bienvenido a la app de IPNEXT',
  logoUrl: null,
  primaryColor: '#2563eb',
  customCss: '',
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<PortalConfigPage />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PortalConfigPage', () => {
  it('PC-1 muestra la configuración REAL del endpoint', async () => {
    vi.mocked(getClientPortalSettings).mockResolvedValue(SETTINGS);

    renderPage();

    expect(await screen.findByText('Bienvenido a la app de IPNEXT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /configuración de la app/i })).toBeInTheDocument();
    // El estado real (habilitada) se refleja.
    expect(screen.getByText(/activada/i)).toBeInTheDocument();
    // El mock viejo mentía con "Prominense"; ya no aparece.
    expect(screen.queryByText(/bienvenido al portal de clientes prominense/i)).not.toBeInTheDocument();
  });

  it('PC-2 rama ERROR — alerta + reintentar re-consulta', async () => {
    vi.mocked(getClientPortalSettings).mockRejectedValueOnce(new Error('boom'));

    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    vi.mocked(getClientPortalSettings).mockResolvedValue(SETTINGS);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Bienvenido a la app de IPNEXT')).toBeInTheDocument();
  });

  it('PC-3 rama LOADING — ni error ni datos mientras carga', () => {
    vi.mocked(getClientPortalSettings).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Bienvenido a la app de IPNEXT')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /configuración de la app/i })).toBeInTheDocument();
  });
});
