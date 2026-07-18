import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SafeMarkdown } from '@/components/markdown/SafeMarkdown';

/**
 * SafeMarkdown (N2-FE) — the news body renderer. It emits React NODES (never
 * dangerouslySetInnerHTML), so text is auto-escaped: the only XSS vector left is
 * a link href, which is scheme-allowlisted. These tests pin BOTH: the useful
 * markdown subset renders, and hostile input can NOT execute.
 */

describe('SafeMarkdown — safe by construction (no XSS)', () => {
  it('renders a raw <script> tag as LITERAL text, not as a script element', () => {
    const { container } = render(<SafeMarkdown source={'Hola <script>alert(1)</script> chau'} />);
    // The angle-bracket text is visible, verbatim.
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    // No real <script> element was ever created in the DOM.
    expect(container.querySelector('script')).toBeNull();
  });

  it('does NOT emit a javascript: link — [xss](javascript:...) renders without an unsafe anchor', () => {
    const { container } = render(<SafeMarkdown source={'[xss](javascript:alert(1))'} />);
    // The link text stays visible (as plain text, not a link)…
    expect(container).toHaveTextContent('xss');
    // …but no anchor carries a javascript: href.
    const anchors = Array.from(container.querySelectorAll('a'));
    for (const a of anchors) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/javascript:/i);
    }
  });

  it('does NOT emit a data: link either', () => {
    const { container } = render(<SafeMarkdown source={'[x](data:text/html,<script>alert(1)</script>)'} />);
    const anchors = Array.from(container.querySelectorAll('a'));
    for (const a of anchors) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/^data:/i);
    }
  });
});

describe('SafeMarkdown — useful subset renders', () => {
  it('renders an http(s) link as a real anchor with the correct href and safe rel', () => {
    render(<SafeMarkdown source={'Mirá [el panel](https://example.com/x) acá'} />);
    const link = screen.getByRole('link', { name: 'el panel' });
    expect(link).toHaveAttribute('href', 'https://example.com/x');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('autolinks a bare URL', () => {
    render(<SafeMarkdown source={'Entrá a https://ipnext.test/noticias ahora'} />);
    const link = screen.getByRole('link', { name: /ipnext\.test\/noticias/ });
    expect(link).toHaveAttribute('href', 'https://ipnext.test/noticias');
  });

  it('renders **bold** as <strong> and `code` as <code>', () => {
    const { container } = render(<SafeMarkdown source={'esto es **muy** `importante`'} />);
    expect(container.querySelector('strong')).toHaveTextContent('muy');
    expect(container.querySelector('code')).toHaveTextContent('importante');
  });

  it('renders a markdown heading as a heading element', () => {
    render(<SafeMarkdown source={'# Corte programado\n\nDetalle'} />);
    expect(screen.getByRole('heading', { name: 'Corte programado' })).toBeInTheDocument();
  });

  it('renders an unordered list as <ul><li>', () => {
    const { container } = render(<SafeMarkdown source={'- uno\n- dos\n- tres'} />);
    const items = container.querySelectorAll('ul li');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('uno');
  });

  it('renders blank-line-separated blocks as distinct paragraphs', () => {
    const { container } = render(<SafeMarkdown source={'Primer parrafo.\n\nSegundo parrafo.'} />);
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('renders empty/whitespace source as nothing (no crash)', () => {
    const { container } = render(<SafeMarkdown source={'   '} />);
    expect(container.textContent?.trim()).toBe('');
  });
});
