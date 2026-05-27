const PLANS = [
  { id: '1', plan: 'Básico 25 Mbps', bajada: '25 Mbps', subida: '10 Mbps', precio: 4500 },
  { id: '2', plan: 'Estándar 50 Mbps', bajada: '50 Mbps', subida: '25 Mbps', precio: 6500 },
  { id: '3', plan: 'Plus 100 Mbps', bajada: '100 Mbps', subida: '50 Mbps', precio: 9800 },
  { id: '4', plan: 'Pro 200 Mbps', bajada: '200 Mbps', subida: '100 Mbps', precio: 14500 },
  { id: '5', plan: 'Ultra 500 Mbps', bajada: '500 Mbps', subida: '250 Mbps', precio: 24000 },
];

export default function TarifasHuaweiGroupsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Huawei Groups</h1>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Plan</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Velocidad bajada</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Velocidad subida</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Precio</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map(row => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800">{row.plan}</td>
                <td className="px-4 py-3 text-gray-600">{row.bajada}</td>
                <td className="px-4 py-3 text-gray-600">{row.subida}</td>
                <td className="px-4 py-3 text-gray-600">${row.precio.toLocaleString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
