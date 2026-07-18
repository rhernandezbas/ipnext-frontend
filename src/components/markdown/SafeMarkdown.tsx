import { Fragment, useMemo, type JSX, type ReactNode } from 'react';
import { safeHref, isExternalUrl } from '@/utils/safeUrl';
import styles from './SafeMarkdown.module.css';

/**
 * SafeMarkdown (N2-FE) — a SMALL, dependency-free markdown renderer for the
 * news body.
 *
 * DECISION (why not a library): package.json ships NO markdown lib (only
 * @tiptap, an editor — not a renderer). Pulling react-markdown + remark +
 * rehype-sanitize would add a heavy dependency tree for a short internal-news
 * body. Instead this renders a useful SUBSET straight to React nodes.
 *
 * Why it is XSS-safe BY CONSTRUCTION: it never builds an HTML string and never
 * touches `dangerouslySetInnerHTML`. Every piece of source text becomes a React
 * text child, which React auto-escapes — so `<script>...</script>` in the body
 * is shown verbatim, it can never become a live element. The ONLY tainted sink
 * is a link's `href`, which is scheme-allowlisted (`safeHref`): http(s)/mailto
 * and scheme-less relative paths pass; `javascript:` / `data:` / any other
 * scheme is dropped and the label degrades to plain text.
 *
 * Supported: ATX headings (#..######), unordered lists (-,*,+), ordered lists
 * (1.), blockquotes (>), paragraphs with soft line breaks, and inline
 * **bold** / __bold__, *italic* / _italic_, `code`, [label](url), and bare-URL
 * autolinks.
 */

// (safeHref / isExternalUrl live in @/utils/safeUrl — shared with NewsAttachmentGallery)

function anchor(href: string, children: ReactNode, key: string): ReactNode {
  const external = isExternalUrl(href);
  return (
    <a
      key={key}
      href={href}
      className={styles.link}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
    >
      {children}
    </a>
  );
}

interface InlineRule {
  re: RegExp;
  build: (m: RegExpExecArray, key: string) => ReactNode;
}

// Order matters: earlier rules win ties (same match index) — bold before italic,
// code before everything (its content is literal).
const INLINE_RULES: InlineRule[] = [
  {
    re: /`([^`]+)`/,
    build: (m, key) => (
      <code key={key} className={styles.code}>
        {m[1]}
      </code>
    ),
  },
  {
    re: /\[([^\]]+)\]\(([^)]+)\)/,
    build: (m, key) => {
      const href = safeHref(m[2]);
      const label = parseInline(m[1], `${key}l`);
      if (!href) return <Fragment key={key}>{label}</Fragment>;
      return anchor(href, label, key);
    },
  },
  {
    re: /\*\*([^*]+)\*\*|__([^_]+)__/,
    build: (m, key) => <strong key={key}>{parseInline(m[1] ?? m[2] ?? '', `${key}b`)}</strong>,
  },
  {
    re: /\*([^*]+)\*|_([^_]+)_/,
    build: (m, key) => <em key={key}>{parseInline(m[1] ?? m[2] ?? '', `${key}i`)}</em>,
  },
  {
    re: /(https?:\/\/[^\s<>()]+)/,
    build: (m, key) => {
      const href = safeHref(m[1]);
      if (!href) return <Fragment key={key}>{m[1]}</Fragment>;
      return anchor(href, m[1], key);
    },
  },
];

/** Parse a single line of inline markdown into React nodes (auto-escaped text). */
function parseInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let n = 0;
  // Bound the loop defensively — each iteration consumes at least one char.
  let guard = 0;
  while (rest.length > 0 && guard++ < 5000) {
    let best: { index: number; length: number; node: ReactNode } | null = null;
    for (const rule of INLINE_RULES) {
      const m = rule.re.exec(rest);
      if (!m) continue;
      if (best === null || m.index < best.index) {
        best = { index: m.index, length: m[0].length, node: rule.build(m, `${keyBase}-${n}`) };
      }
      if (best.index === 0) break; // can't beat index 0
    }
    if (!best) {
      nodes.push(rest);
      break;
    }
    if (best.index > 0) nodes.push(rest.slice(0, best.index));
    nodes.push(best.node);
    rest = rest.slice(best.index + best.length);
    n++;
  }
  return nodes;
}

const RE_HEADING = /^(#{1,6})\s+(.*)$/;
const RE_QUOTE = /^>\s?/;
const RE_UL = /^[-*+]\s+/;
const RE_OL = /^\d+\.\s+/;

const isBlockStart = (t: string): boolean =>
  RE_HEADING.test(t) || RE_QUOTE.test(t) || RE_UL.test(t) || RE_OL.test(t);

/** Split the source into block-level React elements. */
function renderBlocks(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === '') {
      i++;
      continue;
    }

    // ── Heading ──────────────────────────────────────────────────────────────
    const h = RE_HEADING.exec(trimmed);
    if (h) {
      // Shift down so a body "#" never competes with the page's h1/h2.
      const level = Math.min(h[1].length + 2, 6);
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      blocks.push(
        <Tag key={key} className={styles.heading}>
          {parseInline(h[2], `h${key}`)}
        </Tag>,
      );
      key++;
      i++;
      continue;
    }

    // ── Blockquote ───────────────────────────────────────────────────────────
    if (RE_QUOTE.test(trimmed)) {
      const quote: string[] = [];
      while (i < lines.length && RE_QUOTE.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(RE_QUOTE, ''));
        i++;
      }
      blocks.push(
        <blockquote key={key} className={styles.blockquote}>
          {parseInline(quote.join(' '), `q${key}`)}
        </blockquote>,
      );
      key++;
      continue;
    }

    // ── Unordered list ───────────────────────────────────────────────────────
    if (RE_UL.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && RE_UL.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(RE_UL, ''));
        i++;
      }
      blocks.push(
        <ul key={key} className={styles.list}>
          {items.map((it, j) => (
            <li key={j}>{parseInline(it, `ul${key}-${j}`)}</li>
          ))}
        </ul>,
      );
      key++;
      continue;
    }

    // ── Ordered list ─────────────────────────────────────────────────────────
    if (RE_OL.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && RE_OL.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(RE_OL, ''));
        i++;
      }
      blocks.push(
        <ol key={key} className={styles.list}>
          {items.map((it, j) => (
            <li key={j}>{parseInline(it, `ol${key}-${j}`)}</li>
          ))}
        </ol>,
      );
      key++;
      continue;
    }

    // ── Paragraph (soft line breaks between consecutive lines) ───────────────
    const para: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === '' || isBlockStart(t)) break;
      para.push(t);
      i++;
    }
    const inner: ReactNode[] = [];
    para.forEach((pl, j) => {
      if (j > 0) inner.push(<br key={`br-${j}`} />);
      inner.push(...parseInline(pl, `p${key}-${j}`));
    });
    blocks.push(
      <p key={key} className={styles.paragraph}>
        {inner}
      </p>,
    );
    key++;
  }

  return blocks;
}

export interface SafeMarkdownProps {
  source: string;
}

export function SafeMarkdown({ source }: SafeMarkdownProps) {
  const blocks = useMemo(() => renderBlocks(source ?? ''), [source]);
  return <div className={styles.root}>{blocks}</div>;
}
