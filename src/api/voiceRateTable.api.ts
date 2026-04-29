import type { VoiceRateTable } from '@/types/voiceRateTable';

export function getVoiceRateTables(): VoiceRateTable[] {
  return [
    { id: '1', destino: 'Nacional móvil', prefijo: '15', tarifaMin: 0.85, zona: 'Nacional' },
    { id: '2', destino: 'Nacional fijo', prefijo: '0', tarifaMin: 0.45, zona: 'Nacional' },
    { id: '3', destino: 'Internacional USA', prefijo: '001', tarifaMin: 1.20, zona: 'América del Norte' },
    { id: '4', destino: 'Internacional Europa', prefijo: '0044', tarifaMin: 1.80, zona: 'Europa' },
    { id: '5', destino: 'Internacional Brasil', prefijo: '0055', tarifaMin: 1.10, zona: 'América del Sur' },
  ];
}
