export interface ContractLabelInput {
  /** UUID string (real contracts) or legacy numeric id — both render in `Contrato #${id}`. */
  id: string | number;
  plan: string | null | undefined;
  address?: string | null;
  technology?: string | null;
}

/**
 * Build a human-readable label for a contract picker option.
 *
 * Format: "plan - address - technology"
 * Absent segments (null / undefined / '') are omitted.
 * When plan is absent → "Contrato #id".
 */
export function buildContractLabel({ id, plan, address, technology }: ContractLabelInput): string {
  if (!plan) return `Contrato #${id}`;
  const parts = [plan];
  if (address) parts.push(address);
  if (technology) parts.push(technology);
  return parts.join(' - ');
}
