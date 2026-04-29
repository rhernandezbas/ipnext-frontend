import { usePortalConfig } from '@/hooks/usePortal';

export default function PortalConfigPage() {
  const { data: config, isLoading } = usePortalConfig();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configuración del Portal</h1>

      {isLoading ? (
        <div className="bg-gray-100 rounded-lg h-48 animate-pulse" />
      ) : config ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Pagos</span>
            <span className={`text-sm font-semibold ${config.enablePayments ? 'text-green-600' : 'text-gray-400'}`}>
              {config.enablePayments ? 'Habilitado' : 'Deshabilitado'}
            </span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Tickets</span>
            <span className={`text-sm font-semibold ${config.enableTickets ? 'text-green-600' : 'text-gray-400'}`}>
              {config.enableTickets ? 'Habilitado' : 'Deshabilitado'}
            </span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Uso</span>
            <span className={`text-sm font-semibold ${config.enableUsage ? 'text-green-600' : 'text-gray-400'}`}>
              {config.enableUsage ? 'Habilitado' : 'Deshabilitado'}
            </span>
          </div>
          <div className="py-3">
            <p className="text-sm font-medium text-gray-700 mb-1">Mensaje de bienvenida</p>
            <p className="text-sm text-gray-600">{config.welcomeMessage}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
