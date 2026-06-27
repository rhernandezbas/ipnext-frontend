/**
 * exportToCsv — shared CSV download utility.
 *
 * Covers: header building, value extraction, RFC 4180 escaping, filename
 * assignment, anchor click trigger, and URL revocation.
 */
import { vi, describe, it, expect, afterEach } from 'vitest';
import { exportToCsv } from '@/utils/exportToCsv';

// ── Helpers ──────────────────────────────────────────────────────────────────

interface AnchorStub {
  href: string;
  download: string;
  click: ReturnType<typeof vi.fn>;
}

let anchorStub: AnchorStub;
let capturedBlob: Blob | undefined;

function setupDownloadSpies() {
  capturedBlob = undefined;
  anchorStub = { href: '', download: '', click: vi.fn() };

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') return anchorStub as unknown as HTMLElement;
    // Fall through for any other element the modal/portal may create.
    return document.createElement(tag);
  });

  vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => {
    capturedBlob = b as Blob;
    return 'blob:test-url';
  });

  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
  capturedBlob = undefined;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('exportToCsv', () => {
  it('does nothing when rows array is empty', () => {
    setupDownloadSpies();
    exportToCsv([], [{ label: 'A', value: () => '1' }], 'out.csv');
    expect(anchorStub.click).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('builds the header row from column labels', async () => {
    setupDownloadSpies();
    exportToCsv(
      [{ x: 1 }],
      [
        { label: 'Fecha', value: () => '01 ene 2026 - 10:00' },
        { label: 'Operador', value: () => 'Ana' },
      ],
      'out.csv',
    );
    const text = await capturedBlob!.text();
    const csv = text.replace(/^﻿/, '');
    expect(csv.split('\n')[0]).toBe('Fecha,Operador');
  });

  it('builds one data row per input row with correct values', async () => {
    setupDownloadSpies();
    exportToCsv(
      [
        { name: 'Alice', score: 10 },
        { name: 'Bob', score: 20 },
      ],
      [
        { label: 'Name', value: (r) => r.name },
        { label: 'Score', value: (r) => String(r.score) },
      ],
      'out.csv',
    );
    const text = await capturedBlob!.text();
    const csv = text.replace(/^﻿/, '');
    const lines = csv.split('\n');
    expect(lines[1]).toBe('Alice,10');
    expect(lines[2]).toBe('Bob,20');
  });

  // ── RFC 4180 escaping ─────────────────────────────────────────────────────

  it('escapes values containing commas by wrapping them in double quotes', async () => {
    setupDownloadSpies();
    exportToCsv([{ v: 'a,b' }], [{ label: 'V', value: (r) => r.v }], 'out.csv');
    const text = await capturedBlob!.text();
    expect(text).toContain('"a,b"');
  });

  it('escapes double-quotes by doubling them and wrapping the cell', async () => {
    setupDownloadSpies();
    exportToCsv(
      [{ v: 'he said "hi"' }],
      [{ label: 'V', value: (r) => r.v }],
      'out.csv',
    );
    const text = await capturedBlob!.text();
    expect(text).toContain('"he said ""hi"""');
  });

  it('escapes newlines inside a cell by wrapping it in double quotes', async () => {
    setupDownloadSpies();
    exportToCsv(
      [{ v: 'line1\nline2' }],
      [{ label: 'V', value: (r) => r.v }],
      'out.csv',
    );
    const text = await capturedBlob!.text();
    expect(text).toContain('"line1\nline2"');
  });

  it('does not wrap plain values without special chars', async () => {
    setupDownloadSpies();
    exportToCsv([{ v: 'hello' }], [{ label: 'V', value: (r) => r.v }], 'out.csv');
    const text = await capturedBlob!.text();
    const csv = text.replace(/^﻿/, '');
    // Plain value — no wrapping quotes.
    expect(csv.split('\n')[1]).toBe('hello');
  });

  // ── Download behaviour ────────────────────────────────────────────────────

  it('sets the correct download filename on the anchor', () => {
    setupDownloadSpies();
    exportToCsv([{ x: 1 }], [{ label: 'X', value: () => '1' }], 'historial-internet.csv');
    expect(anchorStub.download).toBe('historial-internet.csv');
  });

  it('triggers the anchor click to initiate the download', () => {
    setupDownloadSpies();
    exportToCsv([{ x: 1 }], [{ label: 'X', value: () => '1' }], 'out.csv');
    expect(anchorStub.click).toHaveBeenCalledOnce();
  });

  it('revokes the object URL after triggering the download', () => {
    setupDownloadSpies();
    exportToCsv([{ x: 1 }], [{ label: 'X', value: () => '1' }], 'out.csv');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('creates the Blob with text/csv charset', () => {
    setupDownloadSpies();
    exportToCsv([{ x: 1 }], [{ label: 'X', value: () => '1' }], 'out.csv');
    expect(capturedBlob!.type).toBe('text/csv;charset=utf-8;');
  });

  it('prefixes the CSV with a UTF-8 BOM for Excel compatibility', async () => {
    setupDownloadSpies();
    exportToCsv([{ x: 1 }], [{ label: 'X', value: () => '1' }], 'out.csv');
    // Blob.text() strips the BOM per spec — check raw bytes via arrayBuffer instead.
    const buffer = await capturedBlob!.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // UTF-8 BOM = EF BB BF
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
  });
});
