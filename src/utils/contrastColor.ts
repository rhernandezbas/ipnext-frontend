/**
 * #69 — Pick a legible text color (white or near-black) for a given background.
 *
 * The status pill always hardcodes white text and relies on the operator picking
 * a dark color. Areas are operator-defined and the seed palette includes a light
 * amber, so we resolve contrast from the background's perceived luminance instead
 * of assuming white is always readable.
 *
 * Returns '#ffffff' on dark backgrounds and '#111827' (slate-900) on light ones.
 * Any unparseable input falls back to dark text on the assumption the pill will
 * sit on a light/transparent surface.
 */
const DARK_TEXT = '#111827';
const LIGHT_TEXT = '#ffffff';

/** Perceived-luminance threshold above which a background needs dark text. */
const LUMINANCE_THRESHOLD = 0.55;

function parseHex(input: string): { r: number; g: number; b: number } | null {
  if (typeof input !== 'string') return null;
  let hex = input.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function readableTextColor(background: string): string {
  const rgb = parseHex(background);
  if (!rgb) return DARK_TEXT;
  // ITU-R BT.601 perceived luminance, normalized to 0..1.
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > LUMINANCE_THRESHOLD ? DARK_TEXT : LIGHT_TEXT;
}
