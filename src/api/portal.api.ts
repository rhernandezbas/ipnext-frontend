import type { PortalConfig, PortalUser } from '@/types/portal';

const MOCK_CONFIG: PortalConfig = {
  enablePayments: true,
  enableTickets: true,
  enableUsage: false,
  welcomeMessage: 'Bienvenido al portal de clientes IPNEXT',
  brandColor: '#2563eb',
};

const MOCK_USERS: PortalUser[] = [
  { id: '1', clientName: 'Juan Pérez', email: 'juan@ejemplo.com', lastAccess: '2026-04-28', status: 'activo' },
  { id: '2', clientName: 'María García', email: 'maria@ejemplo.com', lastAccess: '2026-04-27', status: 'activo' },
  { id: '3', clientName: 'Carlos López', email: 'carlos@ejemplo.com', lastAccess: '2026-03-15', status: 'inactivo' },
];

export function getPortalConfig(): Promise<PortalConfig> {
  return Promise.resolve(MOCK_CONFIG);
}

export function getPortalUsers(): Promise<PortalUser[]> {
  return Promise.resolve(MOCK_USERS);
}
