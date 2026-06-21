/**
 * Open Location Code (OLC / Plus Code) encoder.
 * Self-contained implementation — no external dependency.
 *
 * References:
 *   https://github.com/google/open-location-code/blob/main/docs/specification.md
 *
 * Returns a 10-character Plus Code string (e.g. "48Q3CJ2C+22").
 * The "+" separator is inserted after the 8th character.
 */

const CODE_ALPHABET = '23456789CFGHJMPQRVWX';
const ENCODING_BASE = CODE_ALPHABET.length; // 20
const SEPARATOR = '+';
const SEPARATOR_POSITION = 8;

/**
 * Resolution per pair position (degrees). Both latitude and longitude use
 * the same step at each pair position per the OLC specification.
 */
const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];

/**
 * Encode (lat, lng) into an Open Location Code string of the default 10-digit
 * length.
 *
 * @param lat  Latitude in degrees, −90 to +90
 * @param lng  Longitude in degrees, −180 to +180
 * @returns    A Plus Code string, e.g. "48Q3CJ2C+22"
 */
export function encodePlusCode(lat: number, lng: number): string {
  // Clip latitude to valid range (exclusive of 90 to avoid rounding issues)
  lat = Math.min(90 - 1e-10, Math.max(-90, lat));
  // Normalize longitude to [−180, 180)
  while (lng < -180) lng += 360;
  while (lng >= 180) lng -= 360;

  // Shift to positive offsets: lat → [0, 180), lng → [0, 360)
  let adjustedLat = lat + 90;
  let adjustedLng = lng + 180;

  // Encode 5 pairs (lat digit + lng digit per pair = 10 total characters)
  const code: string[] = [];
  for (let i = 0; i < 5; i++) {
    const step = PAIR_RESOLUTIONS[i];
    const latDigit = Math.floor(adjustedLat / step) % ENCODING_BASE;
    const lngDigit = Math.floor(adjustedLng / step) % ENCODING_BASE;
    code.push(CODE_ALPHABET[latDigit]);
    code.push(CODE_ALPHABET[lngDigit]);
  }

  return code.slice(0, SEPARATOR_POSITION).join('') +
    SEPARATOR +
    code.slice(SEPARATOR_POSITION).join('');
}
