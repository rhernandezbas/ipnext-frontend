/**
 * Rediseño card del TemplateSendPanel (inbox-template-card) — pins a nivel CSS
 * (molde `bulkA11y.test.ts`: parsea la CSS Module + `tokens/variables.css`,
 * resuelve `var(--token)` y calcula contraste WCAG 2.1).
 *
 *  CLIP-1  el listbox del Select NO se recorta dentro del modal: cap de altura
 *          local (`--template-listbox-cap`) + el canvas de preview reserva
 *          SIEMPRE más aire que el cap (min-height derivado del MISMO token) —
 *          root cause: `.body { overflow-y: auto }` recorta cualquier absolute
 *          que se pase de su caja; con el invariante canvas >= cap el dropdown
 *          cae dentro de la caja del body en todos los estados.
 *  CLIP-2  cinturón anti-stacking-context (lección bulk-dropdown-z/bulk-z-root):
 *          `:focus-within` sube la prioridad de apilado de la sección del
 *          combobox, y NINGUNA animación del archivo usa fill-mode `both`.
 *  MOTION  entrada de la burbuja con `backwards` (jamás `both`), keyframes que
 *          declaran transform terminan en `transform: none`, reduced-motion
 *          neutraliza la entrada.
 *  A11Y    contrastes CALCULADOS >= 4.5:1 (subtítulo, hint del placeholder,
 *          burbuja, chip pendiente) + touch >= 44px (confirm/cancel/inputs).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const PANEL_CSS = 'src/pages/whatsapp/WhatsappInboxPage/components/TemplateSendPanel.module.css';

function readCss(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf8');
}

/** Mapa token→hex leído de tokens/variables.css. */
function loadTokens(): Record<string, string> {
  const css = readCss('src/tokens/variables.css');
  const map: Record<string, string> = {};
  for (const m of css.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    map[m[1]] = m[2];
  }
  return map;
}

/** Extrae los tokens de `color` y `background(-color)` de una clase de una CSS Module. */
function ruleTokens(relPath: string, className: string): { color?: string; background?: string } {
  const css = readCss(relPath);
  const body = css.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  const color = body.match(/(?<!-)color:\s*var\((--[\w-]+)\)/)?.[1];
  const background = body.match(/background(?:-color)?:\s*var\((--[\w-]+)\)/)?.[1];
  return { color, background };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const tokens = loadTokens();

/** Resuelve el contraste de una clase (fg del rule, bg = del rule o forzado por el contenedor). */
function ruleContrast(relPath: string, className: string, forcedBgToken?: string): number {
  const { color, background } = ruleTokens(relPath, className);
  const fg = tokens[color ?? ''];
  const bg = tokens[(forcedBgToken ?? background) ?? ''];
  expect(fg, `fg token ${color} en .${className}`).toBeTruthy();
  expect(bg, `bg token ${forcedBgToken ?? background} en .${className}`).toBeTruthy();
  return contrastRatio(fg, bg);
}

/** Bloque completo de un `@keyframes` por nombre, contando llaves anidadas
 * (mismo helper que `bulkA11y.test.ts` — `[^}]*` no alcanza con sub-reglas). */
function keyframesBlock(css: string, name: string): string {
  const marker = `@keyframes ${name}`;
  const start = css.indexOf(marker);
  expect(start, `@keyframes ${name}`).toBeGreaterThanOrEqual(0);
  const braceStart = css.indexOf('{', start);
  let depth = 0;
  let i = braceStart;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return css.slice(braceStart, i);
}

describe('CLIP-1: el dropdown del Select no se recorta dentro del modal', () => {
  it('declara el cap local --template-listbox-cap derivado de tokens de espacio', () => {
    const css = readCss(PANEL_CSS);
    expect(css).toMatch(/--template-listbox-cap:\s*calc\([^)]*var\(--space-\d+\)/);
  });

  it('el listbox del Select (descendiente, [role=listbox]) queda capado a ese token', () => {
    const css = readCss(PANEL_CSS);
    expect(css).toMatch(/\[role='listbox'\]\s*\{[^}]*max-height:\s*var\(--template-listbox-cap\)/);
  });

  it('el canvas de preview reserva SIEMPRE más aire que el cap (min-height = cap + extra)', () => {
    const css = readCss(PANEL_CSS);
    expect(css).toMatch(
      /\.previewCanvas\s*\{[^}]*min-height:\s*calc\(var\(--template-listbox-cap\)\s*\+\s*var\(--space-\d+\)\)/,
    );
  });
});

describe('CLIP-2: cinturón anti-stacking-context (lección bulk-dropdown-z / bulk-z-root)', () => {
  it('la sección del combobox sube su prioridad de apilado con :focus-within', () => {
    const css = readCss(PANEL_CSS);
    expect(css).toMatch(/\.selectorSection:focus-within\s*\{[^}]*z-index/);
  });

  it('NINGUNA animación del archivo usa fill-mode "both" (retiene transform → stacking context permanente)', () => {
    const css = readCss(PANEL_CSS);
    expect(css, 'animation-fill-mode: both').not.toMatch(/animation-fill-mode:\s*both\b/);
    expect(css, 'shorthand "animation: … both"').not.toMatch(/animation:\s*[^;]*\bboth\b/);
  });
});

describe('MOTION: entrada de la burbuja de preview', () => {
  it('.previewBubble entra con una animación "backwards" (jamás "both")', () => {
    const css = readCss(PANEL_CSS);
    expect(css).toMatch(/\.previewBubble\s*\{[^}]*animation:\s*[\w-]+\s+[^;]*\bbackwards\b/);
  });

  it('todo @keyframes del archivo que declara transform termina en transform: none', () => {
    const css = readCss(PANEL_CSS);
    const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of new Set(names)) {
      const block = keyframesBlock(css, name);
      const toBlock = block.match(/(?:to|100%)\s*\{([^}]*)\}/)?.[1] ?? '';
      if (/transform\s*:/.test(toBlock)) {
        expect(toBlock, `@keyframes ${name} — estado final sin transform residual`).toMatch(/transform:\s*none\s*;/);
      }
    }
  });

  it('prefers-reduced-motion neutraliza la entrada de la burbuja', () => {
    const css = readCss(PANEL_CSS);
    const media = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(media).toMatch(/\.previewBubble/);
  });
});

describe('A11Y: contrastes calculados >= 4.5:1 del rediseño', () => {
  it('.subtitle (header) sobre la surface blanca del dialog', () => {
    expect(ruleContrast(PANEL_CSS, 'subtitle', '--color-surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('.previewTitle (heading de sección) sobre la surface blanca', () => {
    expect(ruleContrast(PANEL_CSS, 'previewTitle', '--color-surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('.previewPlaceholder (hint) sobre el canvas tintado (surface-hover)', () => {
    expect(ruleContrast(PANEL_CSS, 'previewPlaceholder', '--color-surface-hover')).toBeGreaterThanOrEqual(4.5);
  });

  it('.previewBubble (texto del template) sobre su propio fondo', () => {
    expect(ruleContrast(PANEL_CSS, 'previewBubble')).toBeGreaterThanOrEqual(4.5);
  });

  it('.pending (chip de variable pendiente) fg/bg propios', () => {
    expect(ruleContrast(PANEL_CSS, 'pending')).toBeGreaterThanOrEqual(4.5);
  });

  it('la cola de la burbuja (::before) usa el MISMO fondo que la burbuja (cola nunca de otro color)', () => {
    const css = readCss(PANEL_CSS);
    const bubbleBg = ruleTokens(PANEL_CSS, 'previewBubble').background;
    const tail = css.match(/\.previewBubble::before\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(bubbleBg).toBeTruthy();
    expect(tail).toMatch(new RegExp(`background(?:-color)?:\\s*var\\(${bubbleBg}\\)`));
  });
});

describe('A11Y: touch targets >= 44px (var(--space-11))', () => {
  it('.cancel/.confirm del footer', () => {
    const css = readCss(PANEL_CSS);
    const body = css.match(/\.cancel,\s*\.confirm\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(body).toMatch(/min-height:\s*var\(--space-11\)/);
  });

  it('.variableInput (inputs de variables)', () => {
    const css = readCss(PANEL_CSS);
    const body = css.match(/\.variableInput\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(body).toMatch(/min-height:\s*var\(--space-11\)/);
  });
});
