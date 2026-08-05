import axiosClient from './axios-client';
import type { PushServiceAlertPreview, PushServiceAlertResult } from '@/types/push';

const BASE = '/notifications';

/**
 * Filtro de segmentación del aviso. `null` = TODOS los opt-in con token vivo
 * (sin filtro de nodo). Se manda SIEMPRE explícito (`null`, nunca `undefined`)
 * para que el body diga qué se pidió — el BE trata ambos igual, pero un body
 * con el campo presente es lo que se puede auditar después.
 */
export interface PushServiceAlertScopeInput {
  networkSiteId?: string | null;
}

export interface SendPushServiceAlertInput extends PushServiceAlertScopeInput {
  title: string;
  body: string;
}

export const pushApi = {
  /**
   * Preview — MISMOS filtros que el envío (el BE comparte el resolver), cero
   * efectos. NO exige `title`/`body`: el BE los valida sólo en el envío real.
   */
  previewServiceAlert: (input: PushServiceAlertScopeInput) =>
    axiosClient
      .post<PushServiceAlertPreview>(`${BASE}/push-service-alert/preview`, {
        networkSiteId: input.networkSiteId ?? null,
      })
      .then((r) => r.data),

  sendServiceAlert: (input: SendPushServiceAlertInput) =>
    axiosClient
      .post<PushServiceAlertResult>(`${BASE}/push-service-alert`, {
        title: input.title,
        body: input.body,
        networkSiteId: input.networkSiteId ?? null,
      })
      .then((r) => r.data),
};
