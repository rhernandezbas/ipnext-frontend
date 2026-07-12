/**
 * formatFileSize (messaging-inbox-v2-media F1.5 fase A, design §10) — bytes →
 * humano ("820 B" | "12.3 KB" | "4.1 MB"). Base 1024, 1 decimal desde KB.
 * `null`/`NaN`/negativo → `null` — el consumidor (`MediaFile`/`MediaAudio`)
 * omite el tamaño en ese caso, nunca muestra la palabra "null".
 */
const BYTES_PER_KB = 1024;

export function formatFileSize(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < BYTES_PER_KB) return `${bytes} B`;

  const kb = bytes / BYTES_PER_KB;
  if (kb < BYTES_PER_KB) return `${kb.toFixed(1)} KB`;

  const mb = kb / BYTES_PER_KB;
  return `${mb.toFixed(1)} MB`;
}
