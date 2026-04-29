import type { PaymentStatement } from '@/types/paymentStatement';

export function getPaymentStatements(): PaymentStatement[] {
  return [
    { id: '1', cliente: 'Juan Pérez', periodo: 'Marzo 2024', monto: 6500, estado: 'Pagado', fecha: '2024-03-05' },
    { id: '2', cliente: 'María González', periodo: 'Marzo 2024', monto: 7865, estado: 'Pagado', fecha: '2024-03-08' },
    { id: '3', cliente: 'Carlos López', periodo: 'Marzo 2024', monto: 5200, estado: 'Pendiente', fecha: '2024-03-31' },
    { id: '4', cliente: 'Ana Rodríguez', periodo: 'Febrero 2024', monto: 6500, estado: 'Pagado', fecha: '2024-02-10' },
    { id: '5', cliente: 'Luis Martínez', periodo: 'Marzo 2024', monto: 9800, estado: 'Pendiente', fecha: '2024-03-31' },
  ];
}
