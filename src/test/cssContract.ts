/**
 * Helpers compartidos para los tests que validan contratos leyendo el `.css`
 * CRUDO (contraste WCAG, tamaños, estados hover/activo). jsdom no computa
 * layout ni paint, así que el `.css` es la única fuente observable.
 *
 * Por qué existe este módulo (BAJO-1, 3ª review adversarial): la versión
 * copy-pasteada de `extractRule` usaba `source.indexOf(selector)` — SIN anclar.
 * Con eso, pedir el bloque de `.breakdownSource {` devolvía el de
 * `.breakdownRow[aria-pressed='true'] .breakdownSource {` (que aparece antes en
 * el archivo y CONTIENE la subcadena), y el "estado base" se validaba contra la
 * regla del estado activo: un falso verde silencioso. El mismo defecto vivía en
 * `resolveToken` (regex sin anclar y sin escapar), donde
 * `resolveToken('--color-.rimary')` resolvía a `#0d6efd` porque el `.` matcheaba
 * la `p`.
 *
 * DEUDA CONOCIDA: hay 12 archivos de test más en el repo con la copia vieja de
 * `extractRule` (inbox de WhatsApp, media, clientContext). No se migraron en el
 * commit que creó este módulo para no tocar tests ajenos; ver BACKLOG.
 */
import { readFileSync } from 'node:fs';

export type Rgb = [number, number, number];

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Bloque de declaraciones de una regla CSS.
 *
 * El selector se ancla a PRINCIPIO DE LÍNEA y se escapa: un selector
 * descendiente que TERMINE con el buscado (`.a .b {` cuando se pide `.b {`) ya
 * no puede secuestrar la búsqueda, y los metacaracteres de regex del selector
 * (`.`, `[`, `]`, `(`, `)`) se tratan como literales.
 */
export function extractRule(source: string, selector: string): string {
  const m = new RegExp(`^${escapeRegExp(selector)}`, 'm').exec(source);
  if (!m) throw new Error(`Selector "${selector}" no encontrado (a principio de línea) en el CSS.`);
  const open = source.indexOf('{', m.index);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

/**
 * Valor crudo de una declaración dentro de un bloque, anclado para que
 * `border-color:` no matchee cuando se pide `color:`.
 */
export function declaration(block: string, prop: string): string {
  const m = new RegExp(`(?:^|;|\\n)\\s*${escapeRegExp(prop)}:\\s*([^;]+);`).exec(block);
  if (!m) throw new Error(`Declaración "${prop}" no encontrada en el bloque:\n${block}`);
  return m[1]!.trim();
}

/**
 * Valor hex de un custom property en `tokens/variables.css`.
 *
 * Anclado a principio de línea (los tokens viven indentados dentro de `:root`)
 * y con el nombre ESCAPADO — un nombre con metacaracteres ya no puede resolver
 * a un token distinto.
 */
export function makeTokenResolver(tokensCss: string): (name: string) => string {
  return (name: string) => {
    const m = new RegExp(`^\\s*${escapeRegExp(name)}:\\s*(#[0-9a-fA-F]+)`, 'm').exec(tokensCss);
    if (!m) throw new Error(`Token "${name}" no encontrado en tokens/variables.css`);
    return m[1]!;
  };
}

/**
 * `#rgb` / `#rrggbb` → RGB.
 *
 * MEDIO-4 (3ª review adversarial): los hex de 4 y 8 dígitos (con canal alpha)
 * REVIENTAN en vez de decodificarse mal. Antes `#0d6efd80` devolvía
 * `[110, 253, 128]` — leía `GG BB AA` como `RR GG BB` — y los contratos de
 * contraste se calculaban sobre un color INVENTADO, en silencio. El contraste
 * de un color con alpha no es computable sin conocer lo que hay detrás, así que
 * la única respuesta honesta es fallar ruidosamente.
 */
export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]+$/.test(h)) throw new Error(`Hex inválido: "${hex}"`);
  if (h.length === 4 || h.length === 8) {
    throw new Error(
      `Hex con canal alpha no soportado ("${hex}"): el contraste depende de lo que haya detrás. ` +
        `Usá un color opaco o un color-mix() explícito.`,
    );
  }
  if (h.length !== 3 && h.length !== 6) throw new Error(`Hex de largo no soportado: "${hex}"`);
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** color-mix(in srgb, A p%, B) — misma fórmula lineal que usa el browser para sRGB. */
export function mix(a: Rgb, b: Rgb, percentA: number): Rgb {
  const p = percentA / 100;
  return [0, 1, 2].map((i) => p * a[i]! + (1 - p) * b[i]!) as Rgb;
}

export function relLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG 2.1 contrast ratio: (L1+0.05)/(L2+0.05), L1 >= L2. */
export function contrastRatio(rgbA: Rgb, rgbB: Rgb): number {
  const l1 = relLuminance(rgbA);
  const l2 = relLuminance(rgbB);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

export function readCss(path: string): string {
  return readFileSync(path, 'utf-8');
}
