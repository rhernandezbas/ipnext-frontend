/**
 * MessagingRatesCard.module.css — style-source assertions. Mismo tradeoff
 * documentado que `ExternalBulkMessagingCard.styles.test.ts`: jsdom no
 * computa layout real, así que los touch targets y el breakpoint responsive
 * se pinean leyendo la fuente CSS en vez de `getComputedStyle`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const cssPath = join(__dirname, '..', '..', 'components', 'settings', 'MessagingRatesCard.module.css');
const css = readFileSync(cssPath, 'utf-8');

function ruleBlock(selector: string): string {
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}`);
  return css.match(re)?.[0] ?? '';
}

describe('MessagingRatesCard.module.css — touch targets, tokens, responsive', () => {
  it('gives inputs and the retry/save buttons a >=44px (--space-11) touch target', () => {
    expect(ruleBlock('.input')).toMatch(/min-height:\s*var\(--space-11\)/);
    expect(ruleBlock('.btnRetry')).toMatch(/min-height:\s*var\(--space-11\)/);
    expect(ruleBlock('.btnPrimary')).toMatch(/min-height:\s*var\(--space-11\)/);
  });

  it('uses design tokens (no raw px) for spacing, radius and typography', () => {
    // Excepciones documentadas en el header del CSS (hairlines 1px/2px y
    // minmax(200px,...) de los grids) — todo lo demás debe ser var(--...).
    expect(css).not.toMatch(/padding:\s*\d+px/);
    expect(css).not.toMatch(/margin:\s*\d+px/);
    expect(css).not.toMatch(/font-size:\s*\d+px/);
  });

  it('adds a max-width: 860px breakpoint (matches WhatsApp messaging pages convention)', () => {
    expect(css).toMatch(/@media \(max-width: 860px\)/);
  });

  it('collapses formGrid and estimatorRow to a single column inside the breakpoint', () => {
    const mediaBlock = css.match(/@media \(max-width: 860px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(mediaBlock).toMatch(/\.formGrid,?\s*\n?\s*\.estimatorRow/);
    expect(mediaBlock).toMatch(/grid-template-columns:\s*1fr/);
  });
});
