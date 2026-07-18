import { describe, it, expect } from 'vitest';
import {
  validateNewsFiles,
  NEWS_ATTACHMENT_MAX_BYTES,
  NEWS_ATTACHMENT_MAX_COUNT,
} from '@/utils/validateNewsAttachment';

function file(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('validateNewsFiles', () => {
  it('accepts jpeg/png/webp/gif/pdf and a .md by extension', () => {
    const files = [
      file('a.jpg', 'image/jpeg', 100),
      file('b.png', 'image/png', 100),
      file('c.webp', 'image/webp', 100),
      file('d.gif', 'image/gif', 100),
      file('e.pdf', 'application/pdf', 100),
      file('notes.md', '', 100), // browser often reports empty MIME for .md
    ];
    expect(validateNewsFiles(files, 0)).toBeNull();
  });

  it('rejects an unsupported type with UNSUPPORTED_TYPE', () => {
    const res = validateNewsFiles([file('a.exe', 'application/x-msdownload', 100)], 0);
    expect(res?.code).toBe('UNSUPPORTED_TYPE');
  });

  it('rejects a file over 10MB with TOO_LARGE', () => {
    const res = validateNewsFiles([file('big.png', 'image/png', NEWS_ATTACHMENT_MAX_BYTES + 1)], 0);
    expect(res?.code).toBe('TOO_LARGE');
  });

  it('rejects when the batch would exceed the 20-attachment cap', () => {
    const many = Array.from({ length: 5 }, (_, i) => file(`f${i}.png`, 'image/png', 10));
    const res = validateNewsFiles(many, NEWS_ATTACHMENT_MAX_COUNT - 2);
    expect(res?.code).toBe('TOO_MANY');
  });

  it('allows filling up to exactly the cap', () => {
    const two = [file('a.png', 'image/png', 10), file('b.png', 'image/png', 10)];
    expect(validateNewsFiles(two, NEWS_ATTACHMENT_MAX_COUNT - 2)).toBeNull();
  });
});
