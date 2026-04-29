import type { Messenger } from '@/types/messenger';

export function getMessengers(): Messenger[] {
  return [
    { id: 'whatsapp', name: 'WhatsApp', status: 'Conectado', connected: true },
    { id: 'telegram', name: 'Telegram', status: 'Conectado', connected: true },
    { id: 'facebook', name: 'Facebook Messenger', status: 'Desconectado', connected: false },
  ];
}
