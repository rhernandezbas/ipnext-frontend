/**
 * Media.contrast.test.tsx — contrato de contraste de los labels de media
 * (messaging-inbox-v2-media F1.5 fase A, F5.1, design §3/§8). Mismo criterio
 * que `MessageBubble.contrast.test.tsx`: jsdom no computa color contra fondo
 * real, así que se lee el `.module.css` crudo y se calcula el ratio WCAG 2.1
 * a mano sobre los tokens reales de `tokens/variables.css`.
 *
 * Principio verificado (design §3, apple-design §12): TODA superficie de
 * media es una superficie propia — el texto de labels/filename/tamaño nunca
 * se apoya en el color del bubble (inbound gray-100 / outbound
 * primary-hover), evita el mismo campo minado de contraste que documenta
 * `MessageBubble.contrast.test.tsx`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mediaCss = readFileSync(join(__dirname, 'Media.module.css'), 'utf-8');
const lightboxCss = readFileSync(
  join(__dirname, '..', '..', '..', '..', 'components', 'media', 'ImageLightbox.module.css'),
  'utf-8',
);
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

const WCAG_AA_SMALL_TEXT = 4.5;

function assertPairContrast(textToken: string, bgToken: string) {
  const ratio = contrastRatio(hexToRgb(resolveToken(textToken)), hexToRgb(resolveToken(bgToken)));
  expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
}

describe('Media.module.css — F5.1 (contraste de labels de media >= 4.5:1)', () => {
  it('.placeholderContent (--color-text-primary) sobre --color-gray-50 ("Descargando adjunto…")', () => {
    const block = extractRule(mediaCss, '.placeholderContent {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-primary)');
    assertPairContrast('--color-text-primary', '--color-gray-50');
  });

  it('.errorText (--color-text-primary) sobre --color-danger-bg-hover ("No se pudo cargar el adjunto")', () => {
    const block = extractRule(mediaCss, '.errorText {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-primary)');
    assertPairContrast('--color-text-primary', '--color-danger-bg-hover');
  });

  it('.errorFilename usa --color-text-primary (NO --color-text-secondary — ese da ~4.24:1 sobre este fondo, falla 4.5:1)', () => {
    const block = extractRule(mediaCss, '.errorFilename {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-primary)');
    assertPairContrast('--color-text-primary', '--color-danger-bg-hover');
  });

  it('.mediaFileName (--color-text-primary) sobre --color-surface (card de MediaFile)', () => {
    const block = extractRule(mediaCss, '.mediaFileName {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-primary)');
    assertPairContrast('--color-text-primary', '--color-surface');
  });

  it('.mediaFileMeta (--color-text-secondary) sobre --color-surface', () => {
    assertPairContrast('--color-text-secondary', '--color-surface');
  });

  it('.mediaAudioWrapper le da superficie propia (--color-surface) — nunca el fondo del bubble', () => {
    const block = extractRule(mediaCss, '.mediaAudioWrapper {');
    expect(extractDeclValue(block, 'background')).toBe('var(--color-surface)');
  });

  it('.mediaAudioMeta (--color-text-secondary) sobre --color-surface (superficie propia del audio)', () => {
    assertPairContrast('--color-text-secondary', '--color-surface');
  });

  it('.mediaImageBroken (--color-text-primary, NO --color-gray-400 — ese da ~1.75:1 sobre este fondo) sobre --color-gray-100 ("No se pudo mostrar")', () => {
    const block = extractRule(mediaCss, '.mediaImageBroken {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-primary)');
    assertPairContrast('--color-text-primary', '--color-gray-100');
  });
});

describe('ImageLightbox.module.css — F5.1 (contraste >= 4.5:1, extraído de TaskPhotosGallery)', () => {
  it('.lightboxBroken (--color-text-primary, NO --color-text-secondary — ese da ~3.96:1 sobre este fondo) sobre --color-gray-100 (fallback del lightbox)', () => {
    const block = extractRule(lightboxCss, '.lightboxBroken {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-primary)');
    assertPairContrast('--color-text-primary', '--color-gray-100');
  });
});
