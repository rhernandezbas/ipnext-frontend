/**
 * computeSuricataReplyConfirmation (Fase I, task I.1, spec REPLY-2, design D10)
 * — MUST produce the exact sha256-hex digest the BE recomputes and compares
 * (`ipnext-backend/src/domain/entities/suricataReplyConfirmation.ts`:
 * `createHash('sha256').update(body).digest('hex')`). A mismatch here would
 * make EVERY real reply fail REPLY-2's confirmation check.
 */
import { describe, it, expect } from 'vitest';
import { computeSuricataReplyConfirmation } from '@/pages/suricata/utils/suricataReplyConfirmation';

describe('computeSuricataReplyConfirmation', () => {
  it('matches the BE reference digest for a known string (node crypto sha256("hola"))', async () => {
    const digest = await computeSuricataReplyConfirmation('hola');
    expect(digest).toBe('b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79');
  });

  it('is deterministic — same input always produces the same digest', async () => {
    const a = await computeSuricataReplyConfirmation('Ya revisamos tu reclamo');
    const b = await computeSuricataReplyConfirmation('Ya revisamos tu reclamo');
    expect(a).toBe(b);
  });

  it('different text produces a different digest', async () => {
    const a = await computeSuricataReplyConfirmation('texto A');
    const b = await computeSuricataReplyConfirmation('texto B');
    expect(a).not.toBe(b);
  });
});
