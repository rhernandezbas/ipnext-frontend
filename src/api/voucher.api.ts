import type { Voucher } from '@/types/voucher';

export function getCustomerVouchers(): Voucher[] {
  return [
    { id: '1', code: 'VCH-001-ABCD', plan: 'Plan 10MB - 1 hora', duration: '1 hora', price: 50, status: 'Disponible', createdAt: '2026-04-01' },
    { id: '2', code: 'VCH-002-EFGH', plan: 'Plan 10MB - 1 día', duration: '24 horas', price: 200, status: 'Usado', createdAt: '2026-04-05' },
    { id: '3', code: 'VCH-003-IJKL', plan: 'Plan 20MB - 1 semana', duration: '7 días', price: 800, status: 'Disponible', createdAt: '2026-04-10' },
    { id: '4', code: 'VCH-004-MNOP', plan: 'Plan 5MB - 30 min', duration: '30 min', price: 30, status: 'Expirado', createdAt: '2026-03-20' },
  ];
}
