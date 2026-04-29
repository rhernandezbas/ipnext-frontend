export interface PaymentStatement {
  id: string;
  cliente: string;
  periodo: string;
  monto: number;
  estado: 'Pagado' | 'Pendiente';
  fecha: string;
}
