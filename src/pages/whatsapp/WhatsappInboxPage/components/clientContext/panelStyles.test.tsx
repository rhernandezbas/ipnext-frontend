/**
 * ClientContextPanel.module.css — invariantes de CSS puro (messaging-inbox-v2
 * F1.5, review adversarial). Mismo patrón que `FinancialSection.contrast.test.tsx`:
 * se lee el `.css` crudo (classNameStrategy:'non-scoped') y se assertan
 * declaraciones puntuales — jsdom no computa layout real (no hay forma de
 * medir overflow/scroll horizontal en un test), así que el contrato se fija
 * a nivel de reglas CSS.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = join(__dirname, '..', 'ClientContextPanel.module.css');
const css = readFileSync(cssPath, 'utf-8');

function extractRule(cssText: string, selector: string): string {
  const start = cssText.indexOf(selector);
  if (start === -1) throw new Error(`Selector "${selector}" no encontrado en el CSS.`);
  const open = cssText.indexOf('{', start);
  const close = cssText.indexOf('}', open);
  return cssText.slice(open + 1, close);
}

function extractDeclValue(block: string, prop: string): string {
  const m = block.match(new RegExp(`(?:^|[\\s;{])${prop}:\\s*([^;]+);`));
  if (!m) throw new Error(`Declaración "${prop}" no encontrada en el bloque.`);
  return m[1]!.trim();
}

describe('ClientContextPanel.module.css — bug MEDIO responsive (truncado en 320px, sin scroll horizontal)', () => {
  it('.id-contactLink trunca (min-width:0 + ellipsis, mismo patrón que .id-name)', () => {
    const block = extractRule(css, '.id-contactLink {');
    expect(extractDeclValue(block, 'min-width')).toBe('0');
    expect(extractDeclValue(block, 'overflow')).toBe('hidden');
    expect(extractDeclValue(block, 'text-overflow')).toBe('ellipsis');
    expect(extractDeclValue(block, 'white-space')).toBe('nowrap');
  });

  it('.id-contactMuted trunca (min-width:0 + ellipsis)', () => {
    const block = extractRule(css, '.id-contactMuted {');
    expect(extractDeclValue(block, 'min-width')).toBe('0');
    expect(extractDeclValue(block, 'overflow')).toBe('hidden');
    expect(extractDeclValue(block, 'text-overflow')).toBe('ellipsis');
    expect(extractDeclValue(block, 'white-space')).toBe('nowrap');
  });

  it('.svc-plan trunca (min-width:0 + ellipsis — un plan largo no debe forzar scroll horizontal)', () => {
    const block = extractRule(css, '.svc-plan {');
    expect(extractDeclValue(block, 'min-width')).toBe('0');
    expect(extractDeclValue(block, 'overflow')).toBe('hidden');
    expect(extractDeclValue(block, 'text-overflow')).toBe('ellipsis');
    expect(extractDeclValue(block, 'white-space')).toBe('nowrap');
  });
});

describe('ClientContextPanel.module.css — bug MEDIO a11y (.cand-link sin touch target de 44px)', () => {
  it('.cand-link tiene min-height 44px + display inline-flex centrado (mismo patrón que .id-link)', () => {
    const block = extractRule(css, '.cand-link {');
    expect(extractDeclValue(block, 'min-height')).toBe('var(--space-11)');
    expect(extractDeclValue(block, 'display')).toBe('inline-flex');
    expect(extractDeclValue(block, 'align-items')).toBe('center');
  });
});

describe('ClientContextPanel.module.css — bug BAJO (:focus-visible explícito en los links/botones interactivos)', () => {
  it.each(['.int-link', '.cand-link', '.cand-choose', '.st-retryBtn', '.id-contactLink'])(
    '%s tiene una regla :focus-visible con outline',
    (selector) => {
      expect(css).toContain(`${selector}:focus-visible`);
    },
  );
});

describe('ClientContextPanel.module.css — bug BAJO (.svc-link CSS muerto, no se usa en ningún .tsx)', () => {
  it('.svc-link ya no existe en el CSS', () => {
    expect(css).not.toContain('.svc-link');
  });
});

describe('ClientContextPanel.module.css — bug IMPORTANTE animación (crossfade+blur §8.3/§8.4 estaban declarados pero MUERTOS)', () => {
  it('.fin-hero--refreshing existe con opacity + filter:blur (crossfade real del refresh de balance, toggled por isRefreshingBalance)', () => {
    const block = extractRule(css, '.fin-hero--refreshing {');
    expect(extractDeclValue(block, 'opacity')).toBeTruthy();
    expect(extractDeclValue(block, 'filter')).toMatch(/blur\(/);
  });

  it('.fin-hero usa la curva --wa-ease-out para el crossfade (no un "ease" genérico)', () => {
    const block = extractRule(css, '.fin-hero {');
    expect(extractDeclValue(block, 'transition')).toContain('var(--wa-ease-out)');
  });

  it('waContextEnter (skeleton→contenido) anima filter:blur DE VERDAD — ya no queda el filter:blur(0) estático que nunca se togglea', () => {
    const block = extractRule(css, '@keyframes waContextEnter {');
    expect(block).toMatch(/filter:\s*blur\(/);
    expect(css).not.toMatch(/\.st-matched\s*\{\s*filter:\s*blur\(0\)/);
  });
});
