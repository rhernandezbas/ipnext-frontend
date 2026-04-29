import type { NewsItem } from '@/types/news';

export function getNews(): NewsItem[] {
  return [
    { id: '1', title: 'Actualización del sistema de facturación', date: '2024-03-20', excerpt: 'Se han implementado mejoras en el módulo de facturación para optimizar el proceso de emisión de comprobantes y la gestión de pagos.' },
    { id: '2', title: 'Nuevo módulo de monitoreo GPON', date: '2024-03-15', excerpt: 'El módulo de monitoreo GPON ahora incluye alertas en tiempo real y visualización de métricas de rendimiento por OLT.' },
    { id: '3', title: 'Mantenimiento programado — Sábado 30/03', date: '2024-03-10', excerpt: 'Se realizará mantenimiento preventivo en los servidores el próximo sábado de 02:00 a 06:00 hs. El servicio estará disponible con funcionalidad reducida.' },
    { id: '4', title: 'Integración con nuevos proveedores de pago', date: '2024-03-05', excerpt: 'Se habilitaron nuevas opciones de pago online incluyendo transferencias bancarias y billeteras virtuales.' },
  ];
}
