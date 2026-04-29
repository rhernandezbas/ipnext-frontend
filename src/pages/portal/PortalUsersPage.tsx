import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { usePortalUsers } from '@/hooks/usePortal';
import type { PortalUser } from '@/types/portal';

const COLUMNS = [
  { label: 'Cliente', key: 'clientName' as keyof PortalUser },
  { label: 'Email', key: 'email' as keyof PortalUser },
  { label: 'Último acceso', key: 'lastAccess' as keyof PortalUser },
  { label: 'Estado', key: 'status' as keyof PortalUser },
];

export default function PortalUsersPage() {
  const { data: users = [], isLoading } = usePortalUsers();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Usuarios del Portal</h1>
      <DataTable<PortalUser>
        columns={COLUMNS}
        data={users}
        loading={isLoading}
        emptyMessage="No hay usuarios del portal registrados."
      />
    </div>
  );
}
