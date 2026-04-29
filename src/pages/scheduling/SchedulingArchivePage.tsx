import { useSchedulingArchive } from '@/hooks/useSchedulingArchive';

export default function SchedulingArchivePage() {
  const { data: tasks, isLoading } = useSchedulingArchive();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Archivo de Scheduling</h1>
      {isLoading ? (
        <div>Cargando archivo...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Proyecto</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Técnico</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(tasks ?? []).map(task => (
                <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{task.proyecto}</td>
                  <td className="px-4 py-3 text-gray-600">{task.tecnico}</td>
                  <td className="px-4 py-3 text-gray-600">{task.fecha}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      {task.estado}
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
