/**
 * WhatsappInboxPage.module.css — contrato de breakpoints (messaging-inbox F1,
 * design §2, FB4 task 4.3): "<1200 oculta contexto, <860 oculta lista
 * (thread-only si selectedId)".
 *
 * jsdom NO evalúa `@media` contra un viewport real (no hay motor de layout),
 * así que un test de RTL no puede verificar "se oculta visualmente" — eso
 * queda para el gate Playwright de tasks.md (G.4). Lo que SÍ podemos fijar
 * con TDD es el CONTRATO del CSS: que los breakpoints existan con los valores
 * correctos y que las reglas de `display:none` apunten a las columnas
 * correctas.
 *
 * Se lee el `.css` crudo vía `fs.readFileSync` — NO `?raw` de Vite: bajo
 * `vite.config.ts` (`test.css.modules.classNameStrategy:'non-scoped'`), el
 * plugin de CSS Modules intercepta `*.module.css` ANTES que la query `?raw`
 * y devuelve `{}` (el objeto de clases, vacío para non-scoped) en vez del
 * texto — confirmado corriendo el import a mano. `fs` lee el archivo tal
 * cual, sin pasar por el pipeline de Vite. Se parsea contando llaves (un
 * regex simple no alcanza: los bloques `@media` tienen reglas anidadas con
 * sus propias llaves).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `__dirname` — mismo shim que `no-browser-tz.test.ts` (`src/__tests__/_utils/node-types.d.ts`).
const cssPath = join(__dirname, '..', '..', 'pages', 'whatsapp', 'WhatsappInboxPage.module.css');
const cssText = readFileSync(cssPath, 'utf-8');

/** Extrae el contenido de un bloque `@media (...) { ... }` contando llaves,
 * para no cortar en la primera `}` interna (de una regla anidada). */
function extractMediaBlock(css: string, mediaQuery: string): string {
  const start = css.indexOf(mediaQuery);
  if (start === -1) {
    throw new Error(`No se encontró "${mediaQuery}" en el CSS.`);
  }
  const openBraceIdx = css.indexOf('{', start);
  let depth = 0;
  let i = openBraceIdx;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return css.slice(openBraceIdx + 1, i);
}

describe('WhatsappInboxPage.module.css — bug #1 (banda de 48px al fondo: height debe compensar el margin negativo)', () => {
  it('.page usa height: calc(100% + var(--space-6) * 2), NO height:100% a secas', () => {
    const pageBlock = extractMediaBlock(cssText, '.page {');
    expect(pageBlock).toMatch(/height:\s*calc\(100%\s*\+\s*var\(--space-6\)\s*\*\s*2\)/);
  });

  it('NO deja un height:100% suelto (sin el calc) en la regla .page', () => {
    const pageBlock = extractMediaBlock(cssText, '.page {');
    expect(pageBlock).not.toMatch(/^\s*height:\s*100%;\s*$/m);
  });
});

describe('WhatsappInboxPage.module.css — breakpoint <=1200px (oculta el panel de contexto)', () => {
  it('define @media (max-width: 1200px) con .contextCol en display:none', () => {
    const block = extractMediaBlock(cssText, '@media (max-width: 1200px)');
    expect(block).toMatch(/\.contextCol\s*\{[^}]*display:\s*none/);
  });

  it('reduce la grilla a 2 columnas (lista + thread) en ese breakpoint', () => {
    const block = extractMediaBlock(cssText, '@media (max-width: 1200px)');
    expect(block).toMatch(/\.page\s*\{[^}]*grid-template-columns:/);
  });
});

describe('WhatsappInboxPage.module.css — breakpoint <=860px (thread-only si hay selección)', () => {
  it('define @media (max-width: 860px) con una sola columna', () => {
    const block = extractMediaBlock(cssText, '@media (max-width: 860px)');
    expect(block).toMatch(/\.page\s*\{[^}]*grid-template-columns:\s*1fr/);
  });

  it('oculta .listCol SOLO cuando data-has-selection="true" (toggle vía selectedId, no oculto siempre)', () => {
    const block = extractMediaBlock(cssText, '@media (max-width: 860px)');
    expect(block).toMatch(/\[data-has-selection=['"]true['"]\][^{]*\.listCol\s*\{[^}]*display:\s*none/);
    // Sin selección, la lista NO debe estar en una regla incondicional de
    // display:none (si lo estuviera, el usuario nunca podría ver la lista en mobile).
    expect(block).not.toMatch(/^\s*\.listCol\s*\{[^}]*display:\s*none/m);
  });

  it('oculta thread + contexto cuando data-has-selection="false" (estado inicial, sin selección)', () => {
    const block = extractMediaBlock(cssText, '@media (max-width: 860px)');
    expect(block).toMatch(/\[data-has-selection=['"]false['"]\][\s\S]*display:\s*none/);
  });
});
