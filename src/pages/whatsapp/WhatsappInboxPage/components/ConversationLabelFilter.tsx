import { useMemo } from 'react';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import type { WhatsappLabel } from '@/types/whatsapp';

interface ConversationLabelFilterProps {
  /** Catálogo de etiquetas a filtrar (viene de `useMessagingLabels`, gate `messaging.read`). */
  labels: WhatsappLabel[];
  /** `query.labelId` actual — `undefined` = "Todas las etiquetas". */
  value: string | undefined;
  /** `undefined` cuando se elige "Todas" (limpia el filtro server-side). */
  onChange: (labelId: string | undefined) => void;
}

/** Sentinel del value interno del `Select` para "Todas las etiquetas" (mismo
 *  criterio que `ConversationCampaignFilter`: el `Select` es `value: string`,
 *  el string vacío mapea a "sin filtro"). */
const ALL = '';

/**
 * ConversationLabelFilter — filtro de etiqueta del inbox (Ola 5 — labels).
 * Filtra la lista SERVER-SIDE (el `labelId` viaja en `WhatsappPaginatedQuery`;
 * `WhatsappInboxPage` lo pasa a `useWhatsappConversations`). Eje ORTOGONAL a la
 * campaña y a las vistas — combina con todos.
 *
 * Combobox PROPIO (`Select` molecule), NUNCA un `<select>` nativo (regla del
 * repo) — clon del `ConversationCampaignFilter`, pero cada opción lleva el
 * `swatch` (color de la etiqueta) para que el operador la reconozca por color.
 * 100% controlado (`value` + `onChange`), sin estado propio.
 */
export function ConversationLabelFilter({ labels, value, onChange }: ConversationLabelFilterProps) {
  const options = useMemo<SelectOption[]>(
    () => [
      { value: ALL, label: 'Todas las etiquetas' },
      ...labels.map((l) => ({ value: l.id, label: l.name, swatch: l.color })),
    ],
    [labels],
  );

  return (
    <Select
      options={options}
      value={value ?? ALL}
      onChange={(next) => onChange(next === ALL ? undefined : next)}
      aria-label="Filtrar conversaciones por etiqueta"
      placeholder="Todas las etiquetas"
    />
  );
}
