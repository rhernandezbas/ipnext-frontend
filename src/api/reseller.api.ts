import type { Reseller } from '@/types/reseller';

const MOCK_RESELLERS: Reseller[] = [
  { id: '1', name: 'ISP Norte', clientCount: 150, revenue: 45000, status: 'activo', contactEmail: 'norte@isp.com' },
  { id: '2', name: 'ISP Sur', clientCount: 89, revenue: 27000, status: 'activo', contactEmail: 'sur@isp.com' },
  { id: '3', name: 'ISP Centro', clientCount: 42, revenue: 12500, status: 'inactivo', contactEmail: 'centro@isp.com' },
  { id: '4', name: 'Conectar SA', clientCount: 210, revenue: 63000, status: 'activo', contactEmail: 'info@conectar.com' },
];

export function getResellers(): Promise<Reseller[]> {
  return Promise.resolve(MOCK_RESELLERS);
}

export function getResellerById(id: string): Promise<Reseller | undefined> {
  return Promise.resolve(MOCK_RESELLERS.find(r => r.id === id));
}
