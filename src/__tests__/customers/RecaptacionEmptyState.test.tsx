/**
 * RecaptacionTableView — role-aware empty state (recapture-ventas-access)
 *
 * RVA-4.1  admin (canAssign): ingest-oriented copy
 * RVA-4.2  sales agent (!canAssign): "no assigned leads yet" copy, no "Ingestar bajas"
 * RVA-4.3  filtered-empty unchanged for both roles
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RecaptacionTableView } from '@/pages/customers/RecaptacionPage/components/RecaptacionTableView';

describe('RecaptacionTableView — empty state by role', () => {
  it('RVA-4.1 — admin (canAssign) sees the ingest-oriented empty state', () => {
    render(<RecaptacionTableView leads={[]} canAssign />);
    const empty = screen.getByTestId('recaptacion-empty-state');
    expect(empty).toHaveTextContent(/no hay leads de recaptación/i);
    expect(empty).toHaveTextContent(/ingestar bajas/i);
  });

  it('RVA-4.2 — agent (!canAssign) sees the assignment-oriented empty state', () => {
    render(<RecaptacionTableView leads={[]} />);
    const empty = screen.getByTestId('recaptacion-empty-state');
    // Title mentions the agent has no assigned leads yet.
    expect(empty).toHaveTextContent(/todavía no tenés leads asignados/i);
    // Explains the admin hasn't assigned leads.
    expect(empty).toHaveTextContent(/administrador/i);
    // Must NOT show the admin-only ingest instruction.
    expect(empty).not.toHaveTextContent(/ingestar bajas/i);
  });

  it('RVA-4.3 — filtered-empty state is unchanged for an admin', () => {
    render(<RecaptacionTableView leads={[]} hasActiveFilters canAssign onClearFilters={() => {}} />);
    const empty = screen.getByTestId('recaptacion-empty-state');
    expect(empty).toHaveTextContent(/sin resultados para los filtros/i);
    expect(screen.getByRole('button', { name: /limpiar filtros/i })).toBeInTheDocument();
  });

  it('RVA-4.3b — filtered-empty state is unchanged for an agent', () => {
    render(<RecaptacionTableView leads={[]} hasActiveFilters onClearFilters={() => {}} />);
    const empty = screen.getByTestId('recaptacion-empty-state');
    expect(empty).toHaveTextContent(/sin resultados para los filtros/i);
    expect(screen.getByRole('button', { name: /limpiar filtros/i })).toBeInTheDocument();
  });
});
