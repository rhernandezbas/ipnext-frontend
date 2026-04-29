import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { usePaymentPlans } from '@/hooks/useDunning';
import type { PaymentPlan } from '@/types/dunning';

const COLUMNS = [
  { label: 'Cliente', key: 'clientName' as keyof PaymentPlan },
  { label: 'Total', key: 'total' as keyof PaymentPlan, render: (row: PaymentPlan) => `$${row.total.toLocaleString('es-AR')}` },
  { label: 'Cuotas', key: 'installments' as keyof PaymentPlan },
  { label: 'Pagadas', key: 'paid' as keyof PaymentPlan },
  { label: 'Estado', key: 'status' as keyof PaymentPlan },
];

export default function PaymentPlansPage() {
  const { data: plans = [], isLoading } = usePaymentPlans();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Planes de Pago</h1>
      <DataTable<PaymentPlan>
        columns={COLUMNS}
        data={plans}
        loading={isLoading}
        emptyMessage="No hay planes de pago registrados."
      />
    </div>
  );
}
