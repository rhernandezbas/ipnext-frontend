import { useParams } from 'react-router-dom';
import { useResellerDetail } from '@/hooks/useResellers';

export default function ResellerDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: reseller, isLoading } = useResellerDetail(id);

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Detalle Reseller</h1>
        <div className="bg-gray-100 rounded-lg h-32 animate-pulse" />
      </div>
    );
  }

  if (!reseller) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Detalle Reseller</h1>
        <p className="text-gray-500">Reseller no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Detalle Reseller</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">{reseller.name}</h2>
        <p className="text-sm text-gray-500">Email: {reseller.contactEmail}</p>
        <p className="text-sm text-gray-500 mt-1">Estado: {reseller.status}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-800">{reseller.clientCount}</p>
          <p className="text-sm text-gray-500 mt-1">Total clientes</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-800">{reseller.revenue}</p>
          <p className="text-sm text-gray-500 mt-1">Revenue</p>
        </div>
      </div>
    </div>
  );
}
