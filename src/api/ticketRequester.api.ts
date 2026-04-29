import type { TicketRequester } from '@/types/ticketRequester';

export function getTicketRequesters(): TicketRequester[] {
  return [
    { id: '1', nombre: 'Juan Pérez', email: 'juan.perez@example.com', ticketsAbiertos: 3, ultimaActividad: '2024-03-20' },
    { id: '2', nombre: 'María González', email: 'maria.gonzalez@example.com', ticketsAbiertos: 1, ultimaActividad: '2024-03-19' },
    { id: '3', nombre: 'Carlos López', email: 'carlos.lopez@example.com', ticketsAbiertos: 5, ultimaActividad: '2024-03-18' },
    { id: '4', nombre: 'Ana Rodríguez', email: 'ana.rodriguez@example.com', ticketsAbiertos: 0, ultimaActividad: '2024-03-15' },
    { id: '5', nombre: 'Luis Martínez', email: 'luis.martinez@example.com', ticketsAbiertos: 2, ultimaActividad: '2024-03-14' },
  ];
}
