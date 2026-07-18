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

describe('WhatsappInboxPage.module.css — inbox-views Ola 1: grid base de 4 columnas (vistas | lista | thread | contexto)', () => {
  it('.page declara grid-template-columns: 200px 340px minmax(0, 1fr) 320px', () => {
    const pageBlock = extractMediaBlock(cssText, '.page {');
    expect(pageBlock).toMatch(/grid-template-columns:\s*200px\s+340px\s+minmax\(0,\s*1fr\)\s+320px/);
  });

  it('.viewsCol existe como columna con su propio scroll interno (mismo contrato que las otras columnas)', () => {
    const block = extractMediaBlock(cssText, '.viewsCol {');
    expect(block).toMatch(/height:\s*100%/);
    expect(block).toMatch(/overflow:\s*hidden/);
  });
});

describe('WhatsappInboxPage.module.css — breakpoint <=1200px (oculta contexto, colapsa vistas a rail de íconos)', () => {
  it('define @media (max-width: 1200px) con .contextCol en display:none', () => {
    const block = extractMediaBlock(cssText, '@media (max-width: 1200px)');
    expect(block).toMatch(/\.contextCol\s*\{[^}]*display:\s*none/);
  });

  it('reduce la grilla a rail (56px) + lista + thread en ese breakpoint', () => {
    const block = extractMediaBlock(cssText, '@media (max-width: 1200px)');
    expect(block).toMatch(/\.page\s*\{[^}]*grid-template-columns:\s*56px\s+300px\s+minmax\(0,\s*1fr\)/);
  });
});

describe('WhatsappInboxPage.module.css — breakpoint <=860px (thread-only si hay selección; rail + lista sin selección)', () => {
  it('define @media (max-width: 860px) con rail + lista (56px 1fr) como base', () => {
    const block = extractMediaBlock(cssText, '@media (max-width: 860px)');
    expect(block).toMatch(/\.page\s*\{[^}]*grid-template-columns:\s*56px\s+1fr/);
  });

  it('con selección pasa a una sola columna (thread-only)', () => {
    const block = extractMediaBlock(cssText, '@media (max-width: 860px)');
    expect(block).toMatch(/\.page\[data-has-selection=['"]true['"]\]\s*\{[^}]*grid-template-columns:\s*1fr/);
  });

  it('oculta .listCol y .viewsCol SOLO cuando data-has-selection="true" (toggle vía selectedId, no ocultos siempre)', () => {
    const block = extractMediaBlock(cssText, '@media (max-width: 860px)');
    expect(block).toMatch(/\[data-has-selection=['"]true['"]\][^{]*\.listCol\s*\{[^}]*display:\s*none/);
    expect(block).toMatch(/\[data-has-selection=['"]true['"]\][^{]*\.viewsCol\s*\{[^}]*display:\s*none/);
    // Sin selección, la lista/rail NO deben estar en una regla incondicional
    // de display:none (el usuario nunca podría verlas en mobile).
    expect(block).not.toMatch(/^\s*\.listCol\s*\{[^}]*display:\s*none/m);
    expect(block).not.toMatch(/^\s*\.viewsCol\s*\{[^}]*display:\s*none/m);
  });

  it('oculta thread + contexto cuando data-has-selection="false" (estado inicial, sin selección)', () => {
    const block = extractMediaBlock(cssText, '@media (max-width: 860px)');
    expect(block).toMatch(/\[data-has-selection=['"]false['"]\][\s\S]*display:\s*none/);
  });
});

describe('WhatsappInboxPage.module.css — F1.5 spec #1 (panel de contexto COLAPSABLE, SOLO >1200px)', () => {
  it('define @media (min-width: 1201px) con el grid a 3 columnas (vistas + lista + thread) cuando data-context-collapsed="true"', () => {
    const block = extractMediaBlock(cssText, '@media (min-width: 1201px)');
    expect(block).toMatch(
      /\.page\[data-context-collapsed=['"]true['"]\]\s*\{[^}]*grid-template-columns:\s*200px\s+340px\s+minmax\(0,\s*1fr\)/,
    );
  });

  it('oculta .contextCol con display:none cuando data-context-collapsed="true", dentro de ESE media query', () => {
    const block = extractMediaBlock(cssText, '@media (min-width: 1201px)');
    expect(block).toMatch(/\[data-context-collapsed=['"]true['"]\][^{]*\.contextCol\s*\{[^}]*display:\s*none/);
  });

  it('NO agrega ninguna regla de data-context-collapsed fuera del media query >1200px (no debe interferir con los breakpoints <=1200/<=860 existentes)', () => {
    const block = extractMediaBlock(cssText, '@media (min-width: 1201px)');
    const withoutBlock = cssText.replace(block, '');
    // Selector real (`[data-context-collapsed=`), NO el texto libre del
    // comentario de arriba — el bloque de rationale menciona la palabra
    // `data-context-collapsed` en prosa (sin corchetes) para explicar el
    // porqué del gate; eso no es una regla CSS y no debe hacer fallar este
    // guard de regresión.
    expect(withoutBlock).not.toMatch(/\[data-context-collapsed=/);
  });

  it('los breakpoints <=1200px y <=860px existentes siguen intactos (composición, no regresión)', () => {
    const block1200 = extractMediaBlock(cssText, '@media (max-width: 1200px)');
    expect(block1200).toMatch(/\.contextCol\s*\{[^}]*display:\s*none/);
    const block860 = extractMediaBlock(cssText, '@media (max-width: 860px)');
    expect(block860).toMatch(/\.page\s*\{[^}]*grid-template-columns:\s*56px\s+1fr/);
  });
});
