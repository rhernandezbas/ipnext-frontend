import { useSlaStats } from '@/hooks/useSla';

export default function SLADashboardPage() {
  const { data: stats, isLoading } = useSlaStats();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">SLA Management</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-100 rounded-lg h-24 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-800">{stats.uptimePercent}%</p>
            <p className="text-sm text-gray-500 mt-1">Uptime %</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-800">{stats.breaches}</p>
            <p className="text-sm text-gray-500 mt-1">Breaches</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-800">{stats.activeIncidents}</p>
            <p className="text-sm text-gray-500 mt-1">Incidentes activos</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-800">{stats.mttr} min</p>
            <p className="text-sm text-gray-500 mt-1">MTTR</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
