export interface TicketArea {
  id: string;
  name: string;
  /** #69 — Hex color for the area pill in the tickets list. */
  color: string;
  /**
   * portal-topic-admin — el área se muestra como tópico elegible al abrir un
   * reclamo desde la app mobile de clientes. Las áreas internas (NOC, etc.)
   * quedan afuera por default.
   */
  portalVisible: boolean;
  /** Nombre que ve el cliente en la app. Si es null, el BE cae al `name` interno. */
  portalLabel: string | null;
  /** Línea de ayuda debajo del tópico en la app, para que el cliente sepa cuándo elegirlo. */
  portalDescription: string | null;
  /** Orden de aparición del tópico dentro de la app. */
  portalOrder: number;
}
