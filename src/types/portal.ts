export interface PortalConfig {
  enablePayments: boolean;
  enableTickets: boolean;
  enableUsage: boolean;
  welcomeMessage: string;
  brandColor: string;
}

export interface PortalUser {
  id: string;
  clientName: string;
  email: string;
  lastAccess: string;
  status: 'activo' | 'inactivo';
}
