import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SendStaffTicketReplyInput } from '@/types/ticketMessages';
import * as api from '@/api/ticketMessages.api';

const commentsQueryKey = (ticketId: string) => ['ticket-comments', ticketId] as const;
const unreadCountQueryKey = (ticketId: string) => ['ticket-messages-unread-count', ticketId] as const;

/**
 * Responder al cliente — POST /:ticketId/messages. El hilo (`useTicketComments`)
 * es la MISMA lista que ya incluye los mensajes públicos (mismo repo en el BE),
 * así que invalidar esa key alcanza para que el nuevo mensaje aparezca en el
 * feed. También invalida el contador de no leídos (best-effort, ver
 * `useTicketUnreadCount`).
 */
export function useSendStaffTicketReply(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendStaffTicketReplyInput) => api.sendStaffTicketReply(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: commentsQueryKey(ticketId) });
      void qc.invalidateQueries({ queryKey: unreadCountQueryKey(ticketId) });
    },
  });
}

/**
 * Contador de no leídos (lado staff) — GET /:ticketId/messages/unread-count.
 *
 * `staleTime: Infinity` A PROPÓSITO: abrir el hilo (`GET /:ticketId/comments`,
 * `useTicketComments`) marca los mensajes como leídos como efecto secundario
 * en el BE (`ListTicketComments`, ver su docblock) — si este contador
 * refetcheara solo, el badge "N sin leer" que el operador vio al entrar
 * colapsaría a 0 en cuanto el hilo cargue, dando la falsa sensación de que
 * nunca hubo nada pendiente. Se fetchea UNA vez por ticket y se invalida
 * explícitamente (nueva respuesta enviada, o el caller lo fuerza).
 */
export function useTicketUnreadCount(ticketId: string) {
  return useQuery({
    queryKey: unreadCountQueryKey(ticketId),
    queryFn: () => api.getTicketUnreadCount(ticketId),
    enabled: !!ticketId,
    staleTime: Infinity,
  });
}
