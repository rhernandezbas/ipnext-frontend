import type { CdrRecord } from '@/types/cdr';

const MOCK_CDR_RECORDS: CdrRecord[] = [
  { id: '1', date: '2026-04-28 10:30:00', origin: '+54 11 4000-0001', destination: '+54 11 5000-0001', duration: 222, rate: 0.02, cost: 4.44, status: 'completada' },
  { id: '2', date: '2026-04-28 11:15:00', origin: '+54 11 4000-0002', destination: '+54 351 400-0002', duration: 0, rate: 0.05, cost: 0, status: 'fallida' },
  { id: '3', date: '2026-04-28 12:00:00', origin: '+54 11 4000-0003', destination: '+54 261 400-0003', duration: 75, rate: 0.03, cost: 2.25, status: 'completada' },
  { id: '4', date: '2026-04-28 13:45:00', origin: '+54 11 4000-0004', destination: '+54 11 6000-0004', duration: 507, rate: 0.02, cost: 10.14, status: 'completada' },
  { id: '5', date: '2026-04-28 14:20:00', origin: '+54 11 4000-0005', destination: '+1 800 555-0005', duration: 0, rate: 0.15, cost: 0, status: 'ocupado' },
];

export function getCdrRecords(): Promise<CdrRecord[]> {
  return Promise.resolve(MOCK_CDR_RECORDS);
}
