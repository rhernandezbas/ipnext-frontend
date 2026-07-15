import { useMemo } from 'react';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import type { WhatsappCampaignTag } from '@/types/whatsapp';

interface ConversationCampaignFilterProps {
  /** Catálogo de campañas a filtrar (viene de `useCampaigns`, gateado por `messaging.bulk`). */
  campaigns: WhatsappCampaignTag[];
  /** `query.campaignId` actual — `undefined` = "Todas las campañas". */
  value: string | undefined;
  /** `undefined` cuando se elige "Todas" (limpia el filtro server-side). */
  onChange: (campaignId: string | undefined) => void;
}

/** Sentinel del value interno del `Select` para "Todas las campañas" (el `Select`
 *  es `value: string`, no admite `undefined`; el string vacío mapea a "sin filtro"). */
const ALL = '';

/**
 * ConversationCampaignFilter — filtro de campaña del inbox (messaging-bulk-inbox
 * Change 2). Filtra la lista SERVER-SIDE (el `campaignId` viaja en
 * `WhatsappPaginatedQuery`; `WhatsappInboxPage` lo pasa a
 * `useWhatsappConversations`) — NO es un filtro client-side como la búsqueda de
 * `ConversationList`.
 *
 * Usa el combobox PROPIO (`Select` molecule), NUNCA un `<select>` nativo (regla
 * INNEGOCIABLE del WORKFLOW) — mismo criterio que `ConversationAssignmentFilter`
 * (que usa radios nativos por ser un toggle de 3, pero acá el catálogo es
 * dinámico y arbitrariamente largo → combobox). 100% controlado (`value` +
 * `onChange`), sin estado propio.
 */
export function ConversationCampaignFilter({ campaigns, value, onChange }: ConversationCampaignFilterProps) {
  const options = useMemo<SelectOption[]>(
    () => [
      { value: ALL, label: 'Todas las campañas' },
      ...campaigns.map((c) => ({ value: c.id, label: c.name })),
    ],
    [campaigns],
  );

  return (
    <Select
      options={options}
      value={value ?? ALL}
      onChange={(next) => onChange(next === ALL ? undefined : next)}
      aria-label="Filtrar conversaciones por campaña"
      placeholder="Todas las campañas"
    />
  );
}
