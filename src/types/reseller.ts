export interface Reseller {
  id: string;
  name: string;
  clientCount: number;
  revenue: number;
  status: 'activo' | 'inactivo';
  contactEmail: string;
}
