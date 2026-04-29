import { usePaymentStatements } from '@/hooks/usePaymentStatements';
import type { PaymentStatement } from '@/types/paymentStatement';

type PaymentStatus = PaymentStatement['estado'];

const STATUS_STYLES: Record<PaymentStatus, string> = {
  Pagado: 'bg-green-100 text-green-800',
  Pendiente: 'bg-yellow-100 text-yellow-800',
};

export default function PaymentStatementsPage() {
  const { data: statements, isLoading } = usePaymentStatements();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Payment statements</h1>
      {isLoading ? (
        <div>Cargando estados de cuenta...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Período</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Monto</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(statements ?? []).map(s => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{s.cliente}</td>
                  <td className="px-4 py-3 text-gray-600">{s.periodo}</td>
                  <td className="px-4 py-3 text-gray-600">${s.monto.toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[s.estado]}`}>
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
