export interface Messenger {
  id: string;
  name: string;
  status: 'Conectado' | 'Desconectado';
  connected: boolean;
}
