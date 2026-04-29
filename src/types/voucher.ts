export interface Voucher {
  id: string;
  code: string;
  plan: string;
  duration: string;
  price: number;
  status: 'Disponible' | 'Usado' | 'Expirado';
  createdAt: string;
}
