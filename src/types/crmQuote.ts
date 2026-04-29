export interface CrmQuote {
  id: string;
  cliente: string;
  servicio: string;
  monto: number;
  estado: 'Pendiente' | 'Aprobada' | 'Rechazada';
}
