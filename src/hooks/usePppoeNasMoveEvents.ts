import { useQuery } from '@tanstack/react-query';
import { pppoeApi } from '@/api/pppoe.api';
import type { PppoeNasMoveEventsParams } from '@/api/pppoe.api';

/**
 * Registro de movimientos de NAS PPPoE (tab "Movimientos NAS" de la page de
 * auditoría, pppoe-move-nas W1). Lista paginada server-side con filtros
 * outcome/trigger/username. Endpoint gated `pppoe.read` en el BE.
 */
export function usePppoeNasMoveEvents(params: PppoeNasMoveEventsParams) {
  return useQuery({
    queryKey: ['pppoe-nas-move-events', params],
    queryFn: () => pppoeApi.listNasMoveEvents(params),
  });
}
