import type { CrmQuote } from '@/types/crmQuote';

export function getCrmQuotes(): CrmQuote[] {
  return [
    { id: '1', cliente: 'Empresa A S.A.', servicio: 'Internet Empresarial 200 Mbps', monto: 25000, estado: 'Pendiente' },
    { id: '2', cliente: 'Comercio B', servicio: 'Internet + Telefonía IP', monto: 18500, estado: 'Aprobada' },
    { id: '3', cliente: 'Pymes C S.R.L.', servicio: 'Internet Dedicado 500 Mbps', monto: 45000, estado: 'Rechazada' },
    { id: '4', cliente: 'Industria D', servicio: 'Internet + VPN MPLS', monto: 62000, estado: 'Pendiente' },
    { id: '5', cliente: 'Estudio E', servicio: 'Internet Residencial Pro', monto: 8500, estado: 'Aprobada' },
  ];
}
