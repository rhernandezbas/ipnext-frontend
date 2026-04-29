import { useCrmQuotes } from '@/hooks/useCrmQuotes';
import type { CrmQuote } from '@/types/crmQuote';

type QuoteStatus = CrmQuote['estado'];

const STATUS_STYLES: Record<QuoteStatus, string> = {
  Pendiente: 'bg-yellow-100 text-yellow-800',
  Aprobada: 'bg-green-100 text-green-800',
  Rechazada: 'bg-red-100 text-red-800',
};

export default function CrmQuotesPage() {
  const { data: quotes, isLoading } = useCrmQuotes();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Presupuestos</h1>
      {isLoading ? (
        <div>Cargando presupuestos...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Servicio</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Monto</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(quotes ?? []).map(q => (
                <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{q.cliente}</td>
                  <td className="px-4 py-3 text-gray-600">{q.servicio}</td>
                  <td className="px-4 py-3 text-gray-600">${q.monto.toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[q.estado]}`}>
                      {q.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
