export interface RadiusSession {
  id: string;
  sessionId: string;
  /**
   * Trio contractId/clientId/customerName puede venir null desde el BE:
   * una sesión PPPoE activa puede no estar asociada a un contrato/cliente
   * conocido todavía (alta sin contrato, MAC huérfana, etc.).
   */
  contractId: string | null;
  clientId: string | null;
  customerName: string | null;
  clientName: string;
  nasId: string;
  nasName: string;
  ipAddress: string;
  macAddress: string;
  startedAt: string;
  duration: number;
  downloadBytes: number;
  uploadBytes: number;
  downloadMbps: number;
  uploadMbps: number;
  status: 'active' | 'idle';
  username: string;
}
