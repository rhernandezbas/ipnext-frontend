/**
 * ExternalBulkMessagingCard.module.css — style-source assertions.
 *
 * jsdom does not compute real layout (no getBoundingClientRect from CSS), so
 * touch-target sizes and responsive breakpoints can't be asserted via
 * computed style in a component test. These read the CSS module SOURCE and
 * assert the class/variables used instead — documented tradeoff (fix wave
 * finding 6/7/8, external-bulk-messaging FE).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// `__dirname` — mismo shim que el resto de los CSS-source tests del repo
// (`WhatsappInboxPage.layout.test.tsx`, `InfoTab.contrast.test.tsx`).
const cssPath = join(__dirname, '..', '..', 'components', 'settings', 'ExternalBulkMessagingCard.module.css');
const css = readFileSync(cssPath, 'utf-8');

function ruleBlock(selector: string): string {
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}`);
  return css.match(re)?.[0] ?? '';
}

describe('ExternalBulkMessagingCard.module.css — touch targets, tokens, responsive', () => {
  it('gives the toggle switch a >=44px (--space-11) tall hit area', () => {
    const block = ruleBlock('.switch');
    expect(block).toMatch(/height:\s*var\(--space-11\)/);
  });

  it('bumps .btnRetry from 36px to a 44px (--space-11) touch target', () => {
    const block = ruleBlock('.btnRetry');
    expect(block).toMatch(/min-height:\s*var\(--space-11\)/);
  });

  it('uses design tokens instead of raw px for the badge dot, switch thumb and translate offset', () => {
    expect(css).not.toMatch(/top:\s*3px/);
    expect(css).not.toMatch(/left:\s*3px/);
    expect(css).not.toMatch(/width:\s*18px/);
    expect(css).not.toMatch(/height:\s*18px/);
    expect(css).not.toMatch(/translateX\(20px\)/);
    expect(css).not.toMatch(/padding:\s*3px 10px/);
    expect(css).not.toMatch(/width:\s*6px/);
    expect(css).not.toMatch(/height:\s*6px/);
  });

  it('adds a max-width: 860px breakpoint (matches WhatsApp messaging pages convention)', () => {
    expect(css).toMatch(/@media \(max-width: 860px\)/);
  });

  it('stacks statusHeader/statusActionRow/banner and collapses the caps grid inside the breakpoint', () => {
    const mediaBlock = css.match(/@media \(max-width: 860px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(mediaBlock).toMatch(/\.statusHeader/);
    expect(mediaBlock).toMatch(/\.statusActionRow/);
    expect(mediaBlock).toMatch(/\.banner/);
    expect(mediaBlock).toMatch(/\.formGrid/);
    expect(mediaBlock).toMatch(/flex-wrap:\s*wrap|flex-direction:\s*column|grid-template-columns:\s*1fr/);
  });
});
