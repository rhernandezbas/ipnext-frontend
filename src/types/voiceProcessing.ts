export interface VoiceCall {
  id: string;
  origen: string;
  destino: string;
  duracion: number;
  estado: 'Completada' | 'Fallida' | 'Ocupado';
}
