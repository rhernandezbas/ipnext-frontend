/** #79 — SLA timer thresholds for the tickets list "Timer" column. Wire shape of
 *  GET/PUT /api/tickets/sla-config (mirrors the BE TicketSlaConfigDto). */
export interface TicketSlaConfig {
  /** Minutes elapsed at which the timer turns amber (green→amber). */
  warnMinutes: number;
  /** Minutes elapsed at which the timer turns red (amber→red). Must be > warnMinutes. */
  dangerMinutes: number;
}
