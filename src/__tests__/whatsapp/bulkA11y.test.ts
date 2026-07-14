/**
 * Fix wave — verificación de accesibilidad del Bulk Messaging (F2), atada a
 * los ARCHIVOS reales (no a hex hardcodeados sueltos): parsea las CSS Modules
 * + `tokens/variables.css`, resuelve los `var(--token)` y calcula el contraste
 * WCAG 2.1 de cada notice/hint sobre su fondo tintado.
 *
 *  FIX-6a  notices/hints del bulk sobre `--color-surface-hover` >= 4.5:1
 *  FIX-6b  StatusBadge `.inactive` (fg/bg) >= 4.5:1 (token compartido)
 *  FIX-7b  CampaignsTable `.nameLink` tap target >= 44px
 *  FIX-8c  ConfirmModal `.cancel`/`.confirm` con anillo :focus-visible
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');

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

const COMPOSER = 'src/pages/whatsapp/BulkMessagingPage/components/composer';

describe('FIX-6a: notices/hints del bulk sobre fondo tintado >= 4.5:1', () => {
  it('SegmentPreviewPanel .notice', () => {
    expect(ruleContrast(`${COMPOSER}/SegmentPreviewPanel.module.css`, 'notice')).toBeGreaterThanOrEqual(4.5);
  });

  it('SegmentBuilder .hint', () => {
    expect(ruleContrast(`${COMPOSER}/SegmentBuilder.module.css`, 'hint')).toBeGreaterThanOrEqual(4.5);
  });

  it('TemplateSelector .notice', () => {
    expect(ruleContrast(`${COMPOSER}/TemplateSelector.module.css`, 'notice')).toBeGreaterThanOrEqual(4.5);
  });

  it('TemplateSelector .variablesList (sobre el .details tintado)', () => {
    // .variablesList no declara bg propio: hereda el surface-hover de .details.
    expect(
      ruleContrast(`${COMPOSER}/TemplateSelector.module.css`, 'variablesList', '--color-surface-hover'),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('FIX-6b: StatusBadge .inactive >= 4.5:1 (token compartido)', () => {
  it('badge-inactive-fg sobre badge-inactive-bg', () => {
    expect(
      ruleContrast('src/components/atoms/StatusBadge/StatusBadge.module.css', 'inactive'),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('FIX-7b: CampaignsTable .nameLink tap target >= 44px', () => {
  it('el link "ver detalle" tiene min-height de 44px', () => {
    const css = readCss('src/pages/whatsapp/BulkMessagingPage/components/history/CampaignsTable.module.css');
    const body = css.match(/\.nameLink\s*\{([^}]*)\}/)?.[1] ?? '';
    const minHeight = body.match(/min-height:\s*([^;]+);/)?.[1]?.trim();
    expect(minHeight, '.nameLink min-height').toBeTruthy();
    const px = minHeight === 'var(--space-11)' ? 44 : parseInt(minHeight ?? '0', 10);
    expect(px).toBeGreaterThanOrEqual(44);
  });
});

describe('FIX-8c: ConfirmModal :focus-visible en cancel/confirm', () => {
  it('declara un anillo de foco para los botones', () => {
    const css = readCss('src/components/molecules/ConfirmModal/ConfirmModal.module.css');
    expect(css).toMatch(/\.(cancel|confirm)[^{]*:focus-visible/);
  });
});
