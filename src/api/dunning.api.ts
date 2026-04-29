import type { DunningEntry, PaymentPlan } from '@/types/dunning';

const MOCK_DUNNING_ENTRIES: DunningEntry[] = [
  { id: '1', clientName: 'Juan Pérez', amount: 3500, dueDate: '2026-03-15', stage: '1er_aviso', status: 'pendiente' },
  { id: '2', clientName: 'María García', amount: 7200, dueDate: '2026-02-28', stage: '2do_aviso', status: 'pendiente' },
  { id: '3', clientName: 'Carlos López', amount: 1800, dueDate: '2026-01-10', stage: 'suspendido', status: 'pendiente' },
  { id: '4', clientName: 'Ana Martínez', amount: 4500, dueDate: '2026-03-01', stage: '1er_aviso', status: 'resuelto' },
];

const MOCK_PAYMENT_PLANS: PaymentPlan[] = [
  { id: '1', clientName: 'Roberto Silva', total: 12000, installments: 6, paid: 3, status: 'activo' },
  { id: '2', clientName: 'Laura Fernández', total: 8400, installments: 4, paid: 4, status: 'completado' },
  { id: '3', clientName: 'Diego Torres', total: 5000, installments: 3, paid: 1, status: 'vencido' },
];

export function getDunningEntries(): Promise<DunningEntry[]> {
  return Promise.resolve(MOCK_DUNNING_ENTRIES);
}

export function getPaymentPlans(): Promise<PaymentPlan[]> {
  return Promise.resolve(MOCK_PAYMENT_PLANS);
}
