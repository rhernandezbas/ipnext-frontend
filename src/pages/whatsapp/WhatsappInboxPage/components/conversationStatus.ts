import type { WhatsappConversationStatus } from '@/types/whatsapp';

/**
 * conversationStatus — mapeo COMPARTIDO status→(variante de color del
 * `StatusBadge`, label) entre `ConversationListItem` (F1, fila de la lista)
 * y `ConversationStatusToggle` (messaging-inbox-productivity F1.5-C v1 —
 * RESOLVER/REABRIR, header del thread abierto). Un solo lugar para no
 * divergir el copy/color entre ambas superficies.
 */
export const CONVERSATION_STATUS_VARIANT: Record<string, 'active' | 'blocked' | 'inactive' | 'late'> = {
  open: 'active',
  pending: 'blocked',
  resolved: 'inactive',
  // Ola 6 (snooze): 'snoozed' = pospuesta → variante ámbar/'late' (misma
  // semántica de "en espera / va a volver", distinta del gris 'inactive' de
  // resuelta y del rojo 'blocked' de pending). Sin esta entrada, la fila de la
  // vista Pospuestas y las previas snoozed caían al fallback (texto crudo
  // "snoozed" en inglés + badge gris genérico).
  snoozed: 'late',
};

export const CONVERSATION_STATUS_LABEL: Record<string, string> = {
  open: 'Abierta',
  pending: 'Pendiente',
  resolved: 'Resuelta',
  snoozed: 'Pospuesta',
};

/**
 * nextConversationStatus — v1 SOLO alterna open↔resolved (contrato de la
 * tarea: "v1: solo open↔resolved; pending no se expone en la UI todavía").
 * Decisión documentada: cualquier status que NO sea exactamente 'resolved'
 * (incluido 'pending' o uno desconocido/drift de Chatwoot) se trata como "no
 * resuelta" — el próximo paso siempre es 'resolved'. Solo 'resolved' ofrece
 * el camino inverso a 'open'. Dejar 'pending' sin ninguna acción posible acá
 * sería peor (el agente no podría resolver esa conversación desde el
 * header) — el tipo (`WhatsappConversationStatus`) contempla 'pending' como
 * status LEÍDO, pero v1 no le da un botón dedicado para SETEARLO.
 */
export function nextConversationStatus(
  current: WhatsappConversationStatus | string,
): WhatsappConversationStatus {
  return current === 'resolved' ? 'open' : 'resolved';
}
