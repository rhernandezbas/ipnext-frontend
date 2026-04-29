import type { SchedulingArchiveTask } from '@/types/schedulingArchive';

export function getSchedulingArchive(): SchedulingArchiveTask[] {
  return [
    { id: '1', proyecto: 'Instalación fibra Zona Norte', tecnico: 'Carlos López', fecha: '2024-03-01', estado: 'Completado' },
    { id: '2', proyecto: 'Mantenimiento antenas Zona Sur', tecnico: 'Ana García', fecha: '2024-03-05', estado: 'Completado' },
    { id: '3', proyecto: 'Migración equipos Centro', tecnico: 'Luis Martínez', fecha: '2024-03-10', estado: 'Completado' },
    { id: '4', proyecto: 'Revisión red GPON', tecnico: 'María Rodríguez', fecha: '2024-03-15', estado: 'Completado' },
    { id: '5', proyecto: 'Instalación OLT nuevas', tecnico: 'Pedro Sánchez', fecha: '2024-03-20', estado: 'Completado' },
  ];
}
