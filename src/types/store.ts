/**
 * store-admin — espejo del contrato de `/api/store` (BE implementado en
 * paralelo por otro agente, worktree `store-be` en ipnext-backend — al momento
 * de construir este panel ese worktree estaba SIN diff contra `main`, no hay
 * DTO real contra el cual verificar; este shape sigue el contrato tal cual lo
 * definió el proposal). `priceArs`/`priceArsAtOrder` llegan como decimal —
 * pueden venir como `string` o `number` según el serializador del BE, hay que
 * manejar ambos (ver `utils/decimal.ts`).
 */
export interface StoreProductDto {
  id: string;
  title: string;
  summary: string;
  description: string;
  priceArs: string | number;
  maxInstallments: number;
  warrantyText: string;
  badge: string | null;
  /**
   * Key de storage de la imagen — NO es una URL. El BE no documenta (todavía)
   * un endpoint GET de imagen para el panel de staff (solo POST/DELETE de
   * `/products/:id/image`, servido a los clientes por la ruta del portal). El
   * panel usa este campo solo como booleano "tiene imagen" — ver
   * `ProductsTab` (columna miniatura) y `ProductFormModal` (preview, que usa
   * `URL.createObjectURL` del archivo elegido, NUNCA esta key como src).
   */
  imageStorageKey: string | null;
  ticketAreaId: string | null;
  active: boolean;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Los 3 estados derivados que ve el operador — NO son un campo propio del BE. Ver `utils/productStatus.ts`. */
export type StoreProductStatus = 'draft' | 'active' | 'archived';

export interface StoreOrderProductRef {
  title: string;
}

export interface StoreOrderClientRef {
  id: string;
  name: string;
}

/**
 * `ticketNumber` — contrato dado por el proposal, shape aproximado (no
 * verificable contra el BE real, ver comentario de arriba). El nombre sugiere
 * el número de EXHIBICIÓN del reclamo (`sequenceNumber`, "#N"), NO el `id` real
 * — pero la ruta existente `/admin/tickets/:id` busca por `id` real (UUID),
 * verificado contra `GetTicket.execute(id) → repo.getById(id)` en el backend.
 * Si el BE efectivamente manda el `sequenceNumber` acá (no el `id`), el link
 * de Pedidos → Ticket va a 404 en producción. Reportado como desvío/riesgo —
 * ver informe final. El panel linkea de buena fe con `ticketNumber` tal cual
 * llega, mostrando la etiqueta "#N".
 */
export interface StoreOrderDto {
  id: string;
  product: StoreOrderProductRef;
  client: StoreOrderClientRef;
  contractId: string;
  installments: number;
  priceArsAtOrder: string | number;
  /** UUID real del Ticket — es lo que resuelve la ruta `/admin/tickets/:id`
   * del panel (getById; NO acepta sequenceNumber). Confirmado contra el DTO
   * real del BE (`storeOrders.dto.ts`). */
  ticketId: string | null;
  /** sequenceNumber visible ("#586") — SOLO para display, jamás para el link. */
  ticketNumber: number | null;
  createdAt: string;
}
