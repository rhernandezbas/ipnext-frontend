import { useMessengers } from '@/hooks/useMessengers';

export default function MessengersPage() {
  const { data: messengers, isLoading } = useMessengers();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Messengers</h1>
      {isLoading ? (
        <div>Cargando messengers...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(messengers ?? []).map(channel => (
            <div key={channel.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">{channel.name}</h2>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    channel.connected
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {channel.status}
                </span>
              </div>
              <button
                type="button"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                Configurar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
