import type { ManualContactInput } from '@/types/messagingBulk';

/**
 * parseRecipientNumbers (bulk-granular-perms FE) — parser PURO del tab
 * "Números" de la card Destinatarios. El operador pega números sueltos, uno
 * por línea, opcionalmente `número, nombre`. Molde `parseRecipientsCsv` pero
 * MUCHO más liviano: acá NO se valida la ESTRUCTURA de un archivo (2 columnas,
 * comillas, separador) — son líneas sueltas escritas a mano.
 *
 * Contrato:
 *  - una línea = un contacto `{ name, phone }`.
 *  - `número, nombre` → el texto tras la PRIMERA coma es el nombre; el resto
 *    de comas quedan dentro del nombre (un nombre puede tener comas, un
 *    teléfono no).
 *  - nombre OMITIDO → `name = phone` (el número se muestra como su propio
 *    nombre, mismo criterio que un CSV sin columna de nombre).
 *  - líneas vacías / de sólo espacios → se ignoran.
 *  - validación LIVIANA: la línea debe aportar al menos un dígito; si no, no es
 *    un número y se descarta. La AUTORIDAD del formato AR (E.164) es el BE
 *    (`toWhatsAppE164`) — acá NO se normaliza ni se rechaza por formato, sólo
 *    se exige presencia de dígitos (mismo criterio de "el BE decide" que el
 *    CSV en `parseRecipientsCsv`).
 *
 * El `phone` se preserva TAL CUAL lo tipeó el operador (trim de bordes): el BE
 * lo normaliza y dedup por teléfono contra el CSV y el segmento.
 */
export function parseRecipientNumbers(text: string): ManualContactInput[] {
  const contacts: ManualContactInput[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') continue;

    const commaIdx = line.indexOf(',');
    const phone = (commaIdx === -1 ? line : line.slice(0, commaIdx)).trim();
    const name = (commaIdx === -1 ? '' : line.slice(commaIdx + 1)).trim() || phone;

    // Sin ningún dígito no es un teléfono — se descarta (el BE valida el formato).
    if (!/\d/.test(phone)) continue;

    contacts.push({ name, phone });
  }

  return contacts;
}
