/**
 * MessageBubble.note.contrast.test.tsx — contrato de contraste de la
 * variante `.row.note` (messaging-inbox-notes F1.5 fase D — NOTA PRIVADA,
 * design §4.2). Mismo patrón que `MessageBubble.contrast.test.tsx` (outbound,
 * bug #3 A11Y-1): jsdom no computa color contra fondo real, así que el
 * contrato se valida leyendo el `.css` crudo (`fs.readFileSync`) y calculando
 * el ratio WCAG 2.1 a mano (relative luminance + `(L1+0.05)/(L2+0.05)`) sobre
 * los tokens reales de `tokens/variables.css`.
 *
 * design §4.2 documenta los ratios esperados: texto `#78350f` sobre fondo
 * `#fef3c7` = 8.15:1; mismo par a opacity 0.85 (burbuja optimista `sending`)
 * = 5.61:1; acento `#b45309` sobre `#fef3c7` = 4.51:1. Este archivo los
 * REAFIRMA contra el CSS real (no hardcodea los números — los deriva).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const bubbleCssPath = join(__dirname, 'MessageBubble.module.css');
const bubbleCss = readFileSync(bubbleCssPath, 'utf-8');

const tokensCssPath = join(__dirname, '..', '..', '..', '..', 'tokens', 'variables.css');
const tokensCss = readFileSync(tokensCssPath, 'utf-8');

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
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => alpha * fg[i]! + (1 - alpha) * bg[i]!) as Rgb;
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

const WCAG_AA_SMALL_TEXT = 4.5;
const WCAG_UI_MIN = 3;

describe('MessageBubble.module.css — variante nota, tokens dedicados (design §4.2)', () => {
  it('.note .bubble usa --color-note-bg/--color-note-fg (NO --badge-blocked-* — mentira semántica)', () => {
    const block = extractRule(bubbleCss, '.note .bubble {');
    expect(extractDeclValue(block, 'background-color')).toBe('var(--color-note-bg)');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-note-fg)');
    expect(block).not.toMatch(/--badge-blocked/);
  });

  it('.note .bubble lleva la barra de acento izquierda con --color-note-accent', () => {
    const block = extractRule(bubbleCss, '.note .bubble {');
    const borderLeft = extractDeclValue(block, 'border-left');
    expect(borderLeft).toMatch(/var\(--color-note-accent\)/);
  });

  it('.note .bubble ocupa el ancho completo (ignora la alineación izq/der del chat)', () => {
    const block = extractRule(bubbleCss, '.note .bubble {');
    expect(extractDeclValue(block, 'width')).toBe('100%');
    expect(extractDeclValue(block, 'max-width')).toBe('100%');
  });
});

describe('MessageBubble.module.css — variante nota, contraste WCAG 2.1 (design §4.2)', () => {
  it('texto --color-note-fg sobre --color-note-bg cumple >= 4.5:1 (esperado ~8.15:1)', () => {
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const fg = hexToRgb(resolveToken('--color-note-fg'));
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
    expect(ratio).toBeGreaterThan(8);
  });

  it('peor caso: burbuja de nota "sending" (.bubble.sending, opacity 0.85) sigue cumpliendo >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const fg = hexToRgb(resolveToken('--color-note-fg'));
    const sendingBlock = extractRule(bubbleCss, '.bubble.sending {');
    const opacity = parseFloat(extractDeclValue(sendingBlock, 'opacity'));

    // La burbuja entera atenúa contra la página (blanco) detrás, no contra sí
    // misma — mismo criterio que el .time/.sender de la variante outbound.
    const white = hexToRgb('#ffffff');
    const blendedBg = blend(bg, white, opacity);
    const blendedFg = blend(fg, white, opacity);
    const ratio = contrastRatio(blendedFg, blendedBg);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('acento --color-note-accent sobre --color-note-bg cumple >= 3:1 (UI/ícono, esperado ~4.51:1)', () => {
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const accent = hexToRgb(resolveToken('--color-note-accent'));
    expect(contrastRatio(accent, bg)).toBeGreaterThanOrEqual(WCAG_UI_MIN);
  });

  it('acento --color-note-accent sobre página blanca cumple >= 3:1 (la barra de acento en el borde de la página)', () => {
    const white = hexToRgb('#ffffff');
    const accent = hexToRgb(resolveToken('--color-note-accent'));
    expect(contrastRatio(accent, white)).toBeGreaterThanOrEqual(WCAG_UI_MIN);
  });
});

describe('MessageBubble.module.css — timestamp/remitente en .bubble.sending, DOBLE opacidad compuesta (fix-fe hallazgo #3)', () => {
  // `.time`/`.sender` traen su PROPIO opacity (0.85/0.92, de-énfasis normal
  // a nivel texto) — dentro de una burbuja `.bubble.sending` ese opacity se
  // COMPONE (multiplica, no se reemplaza) con el opacity del `.bubble`
  // padre: primero el texto se mezcla contra el fondo LOCAL de la burbuja
  // (su propio opacity), y ESE resultado se vuelve a mezclar contra la
  // página blanca (el opacity del `.bubble.sending`) — dos capas, no una.
  // El fondo de la burbuja solo pasa por la segunda mezcla (no tiene
  // opacity propio) — por eso el texto cae más que el fondo.
  //
  // `tryExtractOpacity` respeta la cascada real: si existe una regla MÁS
  // ESPECÍFICA para `.time`/`.sender` dentro de `.bubble.sending` (la que
  // debería agregar el fix), esa gana sobre la genérica `.time {}` — así el
  // test detecta la ausencia del fix (cae a la genérica, compone 2 capas y
  // falla < 4.5:1) y lo confirma una vez agregado (una sola capa efectiva).
  function tryExtractOpacity(css: string, selector: string): number | null {
    const idx = css.indexOf(selector);
    if (idx === -1) return null;
    const open = css.indexOf('{', idx);
    const close = css.indexOf('}', open);
    const block = css.slice(open + 1, close);
    const m = block.match(/(?:^|[\s;{])opacity:\s*([\d.]+)/);
    return m ? parseFloat(m[1]!) : null;
  }

  function effectiveOpacityWhileSending(overrideSelector: string, baseSelector: string): number {
    const override = tryExtractOpacity(bubbleCss, overrideSelector);
    if (override !== null) return override;
    return parseFloat(extractDeclValue(extractRule(bubbleCss, baseSelector), 'opacity'));
  }

  function nestedTextContrast(fg: Rgb, bg: Rgb, localOpacity: number, bubbleOpacity: number): number {
    const white: Rgb = [255, 255, 255];
    const inner = blend(fg, bg, localOpacity);
    const outerText = blend(inner, white, bubbleOpacity);
    const outerBg = blend(bg, white, bubbleOpacity);
    return contrastRatio(outerText, outerBg);
  }

  it('nota: .time dentro de .bubble.sending cumple >= 4.5:1 (antes ~4.10:1, 0.85 opacity propio x 0.85 de la burbuja)', () => {
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const fg = hexToRgb(resolveToken('--color-note-fg'));
    const bubbleOpacity = parseFloat(extractDeclValue(extractRule(bubbleCss, '.bubble.sending {'), 'opacity'));
    const timeOpacity = effectiveOpacityWhileSending('.bubble.sending .time', '.time {');

    const ratio = nestedTextContrast(fg, bg, timeOpacity, bubbleOpacity);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('nota: .sender dentro de .bubble.sending cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const fg = hexToRgb(resolveToken('--color-note-fg'));
    const bubbleOpacity = parseFloat(extractDeclValue(extractRule(bubbleCss, '.bubble.sending {'), 'opacity'));
    const senderOpacity = effectiveOpacityWhileSending('.bubble.sending .sender', '.sender {');

    const ratio = nestedTextContrast(fg, bg, senderOpacity, bubbleOpacity);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('outbound (preexistente, la feature reafirmaba un contraste "verificado" que no cubría esto): .time dentro de .bubble.sending cumple >= 4.5:1 (antes ~3.64:1)', () => {
    const bg = hexToRgb(resolveToken('--color-primary-hover'));
    const fg = hexToRgb(resolveToken('--color-white'));
    const bubbleOpacity = parseFloat(extractDeclValue(extractRule(bubbleCss, '.bubble.sending {'), 'opacity'));
    const timeOpacity = effectiveOpacityWhileSending('.bubble.sending .time', '.time {');

    const ratio = nestedTextContrast(fg, bg, timeOpacity, bubbleOpacity);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('outbound: .sender dentro de .bubble.sending cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-primary-hover'));
    const fg = hexToRgb(resolveToken('--color-white'));
    const bubbleOpacity = parseFloat(extractDeclValue(extractRule(bubbleCss, '.bubble.sending {'), 'opacity'));
    const senderOpacity = effectiveOpacityWhileSending('.bubble.sending .sender', '.sender {');

    const ratio = nestedTextContrast(fg, bg, senderOpacity, bubbleOpacity);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});

describe('MessageBubble.module.css — variante nota, foco de Reintentar/Descartar NO hereda blanco (design §6, riesgo explícito)', () => {
  it('.note .deliveryRetryBtn:focus-visible / .deliveryDiscardBtn:focus-visible usan --color-note-accent (NO --color-white)', () => {
    const start = bubbleCss.indexOf('.note .deliveryRetryBtn:focus-visible,');
    expect(start).toBeGreaterThan(-1);
    const open = bubbleCss.indexOf('{', start);
    const close = bubbleCss.indexOf('}', open);
    const block = bubbleCss.slice(open + 1, close);

    // El bloque puede declarar `outline` completo o solo `outline-color` —
    // cualquiera de los dos formatos es válido en tanto NO sea --color-white.
    expect(block).not.toMatch(/--color-white/);
    expect(block).toMatch(/var\(--color-note-accent\)/);
  });

  it('el outline --color-note-accent contra --color-note-bg cumple >= 3:1 (WCAG 2.1 SC 1.4.11)', () => {
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const accent = hexToRgb(resolveToken('--color-note-accent'));
    expect(contrastRatio(accent, bg)).toBeGreaterThanOrEqual(WCAG_UI_MIN);
  });
});
