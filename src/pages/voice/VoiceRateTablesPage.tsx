import { useVoiceRateTables } from '@/hooks/useVoiceRateTables';

export default function VoiceRateTablesPage() {
  const { data: rates, isLoading } = useVoiceRateTables();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Tablas de tarifas</h1>
      {isLoading ? (
        <div>Cargando tarifas...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Destino</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Prefijo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Tarifa/min</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Zona</th>
              </tr>
            </thead>
            <tbody>
              {(rates ?? []).map(row => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{row.destino}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{row.prefijo}</td>
                  <td className="px-4 py-3 text-gray-600">${row.tarifaMin.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-600">{row.zona}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
