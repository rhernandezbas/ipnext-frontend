/**
 * FinanceGrowth.contrast.test.tsx — contrato de contraste (bloqueante del
 * review adversarial de fix-wave-5). El repo NO tiene tema oscuro (un único
 * bloque `:root` en tokens/variables.css) — todos los ratios se calculan
 * contra ese bloque, mismo criterio que
 * `ConversationListItem.contrast.test.tsx` (jsdom no computa color contra
 * fondo real, así que se lee el `.module.css` crudo y se calcula el ratio
 * WCAG 2.1 a mano).
 *
 * Los 3 fondos relevantes de este change:
 *   - blanco puro (KPI tiles, banners, bridge card — `--color-surface`/página)
 *   - `--color-surface-hover` (#f0f0f5) — `DataTable.module.css` `.row:hover td`,
 *     así que CUALQUIER texto de celda (tierGood/tierBad/secondaryMetric) tiene
 *     que pasar EN AMBOS fondos, no sólo el de reposo.
 *   - el fondo PROPIO de cada badge (badgeDanger/badgeNeutral no dependen del
 *     fondo de la fila — tienen su propio background-color).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const listCss = readFileSync(join(__dirname, 'FinanceGrowthListPage.module.css'), 'utf-8');
const overviewCss = readFileSync(join(__dirname, 'FinanceGrowthOverviewPage.module.css'), 'utf-8');
const settingsCss = readFileSync(join(__dirname, 'settings', 'SettingsBody.module.css'), 'utf-8');
const tokensCss = readFileSync(join(__dirname, '..', '..', 'tokens', 'variables.css'), 'utf-8');

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

/** Resuelve `var(--token)` a un hex crudo leyendo tokens/variables.css. */
function resolveColor(declValue: string): string {
  const m = declValue.match(/^var\((--[a-z0-9-]+)/i);
  if (!m) {
    if (/^#[0-9a-fA-F]{3,8}$/.test(declValue)) return declValue;
    throw new Error(`No se pudo resolver un color crudo de "${declValue}" — usá tokens.`);
  }
  return resolveToken(m[1]!);
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
const WHITE: Rgb = [255, 255, 255];
const SURFACE_HOVER: Rgb = hexToRgb(resolveToken('--color-surface-hover'));

/** Contraste de una clase `color: var(--token)` contra un fondo fijo dado. */
function ratioOf(css: string, selector: string, bg: Rgb): number {
  const block = extractRule(css, selector);
  const fg = hexToRgb(resolveColor(extractDeclValue(block, 'color')));
  return contrastRatio(fg, bg);
}

describe('FinanceGrowthListPage.module.css — texto de celda sobre fondo de reposo Y de :hover', () => {
  it('.tierGood pasa AA sobre blanco', () => {
    expect(ratioOf(listCss, '.tierGood {', WHITE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
  it('.tierGood pasa AA sobre --color-surface-hover (DataTable .row:hover)', () => {
    expect(ratioOf(listCss, '.tierGood {', SURFACE_HOVER)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
  it('.tierBad pasa AA sobre blanco', () => {
    expect(ratioOf(listCss, '.tierBad {', WHITE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
  it('.tierBad pasa AA sobre --color-surface-hover', () => {
    expect(ratioOf(listCss, '.tierBad {', SURFACE_HOVER)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
  it('.secondaryMetric pasa AA sobre blanco', () => {
    expect(ratioOf(listCss, '.secondaryMetric {', WHITE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
  it('.secondaryMetric pasa AA sobre --color-surface-hover', () => {
    expect(ratioOf(listCss, '.secondaryMetric {', SURFACE_HOVER)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});

describe('FinanceGrowthListPage.module.css — badges con superficie propia', () => {
  it('.badgeDanger: fg sobre su propio bg (no el de la fila) pasa AA', () => {
    const block = extractRule(listCss, '.badgeDanger {');
    const fg = hexToRgb(resolveColor(extractDeclValue(block, 'color')));
    const bg = hexToRgb(resolveColor(extractDeclValue(block, 'background-color')));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
  it('.badgeNeutral: fg sobre su propio bg pasa AA', () => {
    const block = extractRule(listCss, '.badgeNeutral {');
    const fg = hexToRgb(resolveColor(extractDeclValue(block, 'color')));
    const bg = hexToRgb(resolveColor(extractDeclValue(block, 'background-color')));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});

describe('FinanceGrowthOverviewPage.module.css — texto de éxito/verde sobre blanco', () => {
  it('.syncOk ("● Sincronización al día") pasa AA', () => {
    expect(ratioOf(overviewCss, '.syncOk {', WHITE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
  it('.feedbackSuccess pasa AA', () => {
    expect(ratioOf(overviewCss, '.feedbackSuccess {', WHITE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
  it('.bridge_up ("+ Altas"/"+ Upgrades") pasa AA', () => {
    expect(ratioOf(overviewCss, '.bridge_up {', WHITE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});

describe('settings/SettingsBody.module.css — feedback y estado disabled', () => {
  it('.feedbackSuccess ("Metas actualizadas") pasa AA', () => {
    expect(ratioOf(settingsCss, '.feedbackSuccess {', WHITE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.btnPrimary:disabled declara un color de texto (no queda blanco heredado sobre --color-border)', () => {
    const block = extractRule(settingsCss, '.btnPrimary:disabled {');
    // Si no declara `color`, el texto blanco de .btnPrimary se hereda intacto
    // sobre el fondo --color-border (#dee2e6) → 1.30:1, INVISIBLE.
    expect(() => extractDeclValue(block, 'color')).not.toThrow();
  });

  it('.btnPrimary:disabled ("Guardando…") pasa AA — texto sobre --color-border', () => {
    const block = extractRule(settingsCss, '.btnPrimary:disabled {');
    const fg = hexToRgb(resolveColor(extractDeclValue(block, 'color')));
    const bg = hexToRgb(resolveColor(extractDeclValue(block, 'background-color')));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});
