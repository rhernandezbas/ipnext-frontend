export interface DunningEntry {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  stage: '1er_aviso' | '2do_aviso' | 'suspendido';
  status: 'pendiente' | 'resuelto';
}

export interface PaymentPlan {
  id: string;
  clientName: string;
  total: number;
  installments: number;
  paid: number;
  status: 'activo' | 'completado' | 'vencido';
}
