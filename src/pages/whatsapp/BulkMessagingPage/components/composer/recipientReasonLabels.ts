/**
 * recipientReasonLabels (bulk-csv-recipients FE) — labels es-AR compartidos
 * para los motivos de fila inválida/excluida. `CsvRecipientsUploader` sólo
 * produce el subset FE-local (`sin_nombre`/`sin_telefono`, D9 — el resto es
 * autoridad del BE); `InvalidRecipientsTable` consume el set COMPLETO que
 * devuelve `/segment/recipients?view=excluded` (CSV-FE-7). Un solo mapa evita
 * que las dos copias del texto diverjan.
 */
import type { ExcludedRecipientReason } from '@/types/messagingBulk';

export const RECIPIENT_REASON_LABELS: Record<ExcludedRecipientReason, string> = {
  sin_nombre: 'Sin nombre',
  sin_telefono: 'Sin teléfono',
  telefono_invalido: 'Teléfono inválido',
  opt_out: 'Optó por no recibir mensajes',
  duplicado: 'Duplicado',
};
