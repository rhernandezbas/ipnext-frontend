export interface SlaContract {
  id: string;
  clientName: string;
  level: 'basico' | 'estandar' | 'premium';
  committedUptime: number;
  actualUptime: number;
  status: 'activo' | 'en_riesgo' | 'violado';
}

export interface SlaStats {
  uptimePercent: number;
  breaches: number;
  activeIncidents: number;
  mttr: number;
}
