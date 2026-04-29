import type { SlaStats, SlaContract } from '@/types/sla';

const MOCK_STATS: SlaStats = {
  uptimePercent: 99.2,
  breaches: 3,
  activeIncidents: 2,
  mttr: 45,
};

const MOCK_CONTRACTS: SlaContract[] = [
  { id: '1', clientName: 'Empresa Alpha', level: 'premium', committedUptime: 99.9, actualUptime: 99.7, status: 'en_riesgo' },
  { id: '2', clientName: 'Empresa Beta', level: 'estandar', committedUptime: 99.5, actualUptime: 99.8, status: 'activo' },
  { id: '3', clientName: 'Empresa Gamma', level: 'basico', committedUptime: 98.0, actualUptime: 97.5, status: 'violado' },
  { id: '4', clientName: 'Empresa Delta', level: 'premium', committedUptime: 99.9, actualUptime: 99.9, status: 'activo' },
];

export function getSlaStats(): Promise<SlaStats> {
  return Promise.resolve(MOCK_STATS);
}

export function getSlaContracts(): Promise<SlaContract[]> {
  return Promise.resolve(MOCK_CONTRACTS);
}
