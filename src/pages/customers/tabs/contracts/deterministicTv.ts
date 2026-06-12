/**
 * #65 — deterministic TV register credentials (FE replica of the BE domain helper
 * `src/infrastructure/security/gigaredPassword.ts`). The BE is the authority — it
 * validates the CUA policy [a-z0-9] on register — but the form prefills reactively
 * from this pure replica, mirroring the #47h PASSWORD_RE pattern (one rule, both sides).
 *
 *   email    = {lastname normalized}{grId}@gmail.com
 *   password = "ip{grId}" right-padded with '0' up to the 8-char minimum
 */

const MIN_LENGTH = 8;
const EMAIL_FALLBACK = 'cliente';

/** First word of the last name → CUA-safe [a-z] slug (lowercase, no accents, ñ→n). */
function normalizeLastName(lastName: string): string {
  const first = lastName.trim().split(/\s+/).filter(Boolean)[0] ?? '';
  return first
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .replace(/ñ/g, 'n')
    .replace(/[^a-z]/g, '');
}

/** #65 — `{lastname}{grId}@gmail.com`; degrades to `cliente{grId}` when empty. */
export function deterministicTvEmail(lastName: string, grId: string): string {
  const slug = normalizeLastName(lastName) || EMAIL_FALLBACK;
  return `${slug}${grId}@gmail.com`;
}

/** #65 — `ip{grId}` padded with trailing '0' up to the 8-char minimum. */
export function deterministicTvPassword(grId: string): string {
  return `ip${grId}`.padEnd(MIN_LENGTH, '0');
}
