import { useTicketRequesters } from '@/hooks/useTicketRequesters';

export default function TicketRequestersPage() {
  const { data: requesters, isLoading } = useTicketRequesters();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Destinatarios</h1>
      {isLoading ? (
        <div>Cargando destinatarios...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Tickets abiertos</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {(requesters ?? []).map(r => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{r.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{r.email}</td>
                  <td className="px-4 py-3 text-gray-600">{r.ticketsAbiertos}</td>
                  <td className="px-4 py-3 text-gray-600">{r.ultimaActividad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
