/**
 * suricata-tickets-mirror (Fase I, task I.1, spec `suricata-ticket-reply`
 * REPLY-2, design D10) — computes the SAME sha256-hex digest the BE
 * recomputes and compares (`ipnext-backend/src/domain/entities/
 * suricataReplyConfirmation.ts`: `createHash('sha256').update(body).digest
 * ('hex')`). Uses the browser's Web Crypto API (`crypto.subtle`), no extra
 * dependency — pure function of `body`: same input always produces the same
 * digest, no I/O, same "conceptually shared" contract the BE file's own
 * comment already calls out for the FE side.
 */
export async function computeSuricataReplyConfirmation(body: string): Promise<string> {
  const bytes = new TextEncoder().encode(body);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
