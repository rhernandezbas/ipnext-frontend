/**
 * InboxViewsMenu.contrast.test.tsx — contrato de contraste + touch target del
 * sub-menú de vistas (inbox-views Ola 1). Mismo criterio que
 * `ConversationListItem.contrast.test.tsx`: jsdom no computa color contra
 * fondo real, así que se lee el `.module.css` crudo y se calcula el ratio
 * WCAG 2.1 a mano sobre los tokens reales de `tokens/variables.css`.
 *
 * Superficies verificadas (regla innegociable: ≥ 4.5:1 CALCULADO):
 *  - item reposo: --color-text-primary sobre --color-surface
 *  - item activo: --badge-active-fg sobre --badge-active-bg
 *  - badge contador reposo: --color-gray-600 sobre --color-gray-100
 *  - badge contador activo: --color-white sobre --badge-active-fg
 *
 * Touch target (a11y): .item declara min-height con --space-11 (44px) — el
 * mínimo WCAG 2.5.8 / iOS HIG para un control táctil.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const menuCss = readFileSync(join(__dirname, 'InboxViewsMenu.module.css'), 'utf-8');
const tokensCss = readFileSync(join(__dirname, '..', '..', '..', '..', 'tokens', 'variables.css'), 'utf-8');

type Rgb = [number, number, number];

function resolveToken(name: string): string {
  const m = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`Token "${name}" no encontrado en tokens/variables.css`);
  return m[1]!;
}

function extractRule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Selector "${selector}" no encontrado en el CSS.`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function extractDeclValue(block: string, prop: string): string {
  const m = block.match(new RegExp(`(?:^|[\\s;{])${prop}:\\s*([^;]+);`));
  if (!m) throw new Error(`Declaración "${prop}" no encontrada en el bloque.`);
  return m[1]!.trim();
}

function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(rgbA: Rgb, rgbB: Rgb): number {
  const l1 = relLuminance(rgbA);
  const l2 = relLuminance(rgbB);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

function tokenContrast(fgToken: string, bgToken: string): number {
  return contrastRatio(hexToRgb(resolveToken(fgToken)), hexToRgb(resolveToken(bgToken)));
}

const WCAG_AA_SMALL_TEXT = 4.5;

describe('InboxViewsMenu.module.css — tokens declarados (nunca hex sueltos en las superficies de texto)', () => {
  it('.item usa --color-text-primary como color de reposo', () => {
    const block = extractRule(menuCss, '.item {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-primary)');
  });

  it(".item[aria-current='true'] usa la dupla --badge-active-bg/fg", () => {
    const block = extractRule(menuCss, ".item[aria-current='true'] {");
    expect(extractDeclValue(block, 'background')).toBe('var(--badge-active-bg)');
    expect(extractDeclValue(block, 'color')).toBe('var(--badge-active-fg)');
  });

  it('.count usa la dupla --color-gray-100/--color-gray-600 (superficie propia, no la fila)', () => {
    const block = extractRule(menuCss, '.count {');
    expect(extractDeclValue(block, 'background')).toBe('var(--color-gray-100)');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-gray-600)');
  });

  it(".count del item activo invierte a --badge-active-fg de fondo con --color-white de texto", () => {
    const block = extractRule(menuCss, ".item[aria-current='true'] .count {");
    expect(extractDeclValue(block, 'background')).toBe('var(--badge-active-fg)');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-white)');
  });
});

describe('InboxViewsMenu.module.css — contraste ≥ 4.5:1 CALCULADO (WCAG 2.1 AA texto chico)', () => {
  it('item reposo: --color-text-primary sobre --color-surface', () => {
    expect(tokenContrast('--color-text-primary', '--color-surface')).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('item activo: --badge-active-fg sobre --badge-active-bg', () => {
    expect(tokenContrast('--badge-active-fg', '--badge-active-bg')).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('badge contador reposo: --color-gray-600 sobre --color-gray-100', () => {
    expect(tokenContrast('--color-gray-600', '--color-gray-100')).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('badge contador activo: --color-white sobre --badge-active-fg', () => {
    expect(tokenContrast('--color-white', '--badge-active-fg')).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});

describe('InboxViewsMenu.module.css — touch target (WCAG 2.5.8: ≥44px)', () => {
  it('.item declara min-height: var(--space-11) (44px del scale de spacing)', () => {
    const block = extractRule(menuCss, '.item {');
    expect(extractDeclValue(block, 'min-height')).toBe('var(--space-11)');
  });
});

describe('InboxViewsMenu.module.css — lecciones del repo (animaciones)', () => {
  it("jamás animation-fill-mode both (mantiene stacking contexts / elementos invisibles — lección bulk-z-root)", () => {
    // Se strippean los comentarios ANTES de matchear (mismo criterio que el
    // guard de data-context-collapsed en WhatsappInboxPage.layout.test.tsx):
    // el header del CSS menciona la lección en PROSA — eso no es una regla.
    const withoutComments = menuCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/fill-mode:\s*both|animation:[^;]*\bboth\b/);
  });
});
