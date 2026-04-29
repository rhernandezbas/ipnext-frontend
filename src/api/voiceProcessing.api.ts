import type { VoiceCall } from '@/types/voiceProcessing';

export function getVoiceCalls(): VoiceCall[] {
  return [
    { id: 'CALL-001', origen: '+54 11 4000-0001', destino: '+54 11 5000-0001', duracion: 222, estado: 'Completada' },
    { id: 'CALL-002', origen: '+54 11 4000-0002', destino: '+54 351 400-0002', duracion: 0, estado: 'Fallida' },
    { id: 'CALL-003', origen: '+54 11 4000-0003', destino: '+54 261 400-0003', duracion: 75, estado: 'Completada' },
    { id: 'CALL-004', origen: '+54 11 4000-0004', destino: '+54 11 6000-0004', duracion: 507, estado: 'Completada' },
    { id: 'CALL-005', origen: '+54 11 4000-0005', destino: '+54 341 400-0005', duracion: 52, estado: 'Completada' },
  ];
}
