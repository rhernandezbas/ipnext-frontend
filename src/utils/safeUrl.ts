/**
 * safeUrl (N2-FE) — scheme-allowlist for any user/BE-provided URL that becomes
 * an `href`. Shared by SafeMarkdown (inline links) and NewsAttachmentGallery
 * (link attachments) so the XSS guard lives in ONE place.
 *
 * Allowed: http(s), mailto, and scheme-less relative paths / fragments.
 * Rejected: javascript:, data:, vbscript:, file:, and any other explicit scheme,
 * plus anything containing control characters.
 */

const ALLOWED_SCHEME = /^(https?:|mailto:)/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
// eslint-disable-next-line no-control-regex -- deliberately reject control chars in an href
const CONTROL_CHARS = new RegExp('[\u0000-\u001F]');

/** Returns a safe href, or `null` when the URL uses a disallowed scheme. */
export function safeHref(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const url = raw.trim();
  if (!url || CONTROL_CHARS.test(url)) return null;
  if (ALLOWED_SCHEME.test(url)) return url;
  if (!HAS_SCHEME.test(url)) return url; // relative path / fragment
  return null; // any other explicit scheme -> unsafe
}

/** True for absolute http(s) URLs (which should open in a new tab with rel guards). */
export const isExternalUrl = (href: string): boolean => /^https?:/i.test(href);
