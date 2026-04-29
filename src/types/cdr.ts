export interface CdrRecord {
  id: string;
  date: string;
  origin: string;
  destination: string;
  duration: number;
  rate: number;
  cost: number;
  status: 'completada' | 'fallida' | 'ocupado';
}
