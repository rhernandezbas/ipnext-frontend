import { useVoiceProcessing } from '@/hooks/useVoiceProcessing';
import type { VoiceCall } from '@/types/voiceProcessing';

type CallStatus = VoiceCall['estado'];

const STATUS_STYLES: Record<CallStatus, string> = {
  Completada: 'bg-green-100 text-green-800',
  Fallida: 'bg-red-100 text-red-800',
  Ocupado: 'bg-yellow-100 text-yellow-800',
};

export default function VoiceProcessingPage() {
  const { data: calls, isLoading } = useVoiceProcessing();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Procesando</h1>
      {isLoading ? (
        <div>Cargando llamadas...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Llamada ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Origen</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Destino</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Duración (s)</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(calls ?? []).map(call => (
                <tr key={call.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-800">{call.id}</td>
                  <td className="px-4 py-3 text-gray-600">{call.origen}</td>
                  <td className="px-4 py-3 text-gray-600">{call.destino}</td>
                  <td className="px-4 py-3 text-gray-600">{call.duracion}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[call.estado]}`}>
                      {call.estado}
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
