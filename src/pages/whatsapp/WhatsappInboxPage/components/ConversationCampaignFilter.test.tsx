/**
 * ConversationCampaignFilter — filtro de campaña del inbox (messaging-bulk-inbox
 * Change 2). Combobox PROPIO (molecule `Select`, NUNCA `<select>` nativo — regla
 * INNEGOCIABLE del WORKFLOW): setea `query.campaignId` SERVER-SIDE. Componente
 * 100% controlado (`value` + `onChange`), sin estado propio — mismo criterio que
 * `ConversationAssignmentFilter`. "Todas las campañas" limpia el filtro
 * (`onChange(undefined)`).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConversationCampaignFilter } from './ConversationCampaignFilter';
import type { WhatsappCampaignTag } from '@/types/whatsapp';

const CAMPAIGNS: WhatsappCampaignTag[] = [
  { id: 'c1', name: 'Recordatorio Julio' },
  { id: 'c2', name: 'Black Friday' },
];

describe('ConversationCampaignFilter — a11y (combobox propio, no nativo)', () => {
  it('expone un combobox con nombre accesible que menciona "campaña"', () => {
    render(<ConversationCampaignFilter campaigns={CAMPAIGNS} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /campaña/i })).toBeInTheDocument();
  });

  it('NO usa un <select> nativo (usa el combobox propio: role=combobox sobre un <button>)', () => {
    const { container } = render(
      <ConversationCampaignFilter campaigns={CAMPAIGNS} value={undefined} onChange={vi.fn()} />,
    );
    expect(container.querySelector('select')).toBeNull();
    expect(screen.getByRole('combobox', { name: /campaña/i }).tagName).toBe('BUTTON');
  });

  it('sin value muestra "Todas las campañas" en el trigger', () => {
    render(<ConversationCampaignFilter campaigns={CAMPAIGNS} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /campaña/i })).toHaveTextContent(/todas las campañas/i);
  });

  it('con value = un id de campaña, el trigger muestra el nombre de esa campaña', () => {
    render(<ConversationCampaignFilter campaigns={CAMPAIGNS} value="c2" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /campaña/i })).toHaveTextContent('Black Friday');
  });
});

describe('ConversationCampaignFilter — opciones', () => {
  it('al abrir, lista "Todas las campañas" + cada campaña', async () => {
    const user = userEvent.setup();
    render(<ConversationCampaignFilter campaigns={CAMPAIGNS} value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));

    expect(screen.getByRole('option', { name: /todas las campañas/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Recordatorio Julio' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Black Friday' })).toBeInTheDocument();
  });
});

describe('ConversationCampaignFilter — interacción (server-side)', () => {
  it('elegir una campaña dispara onChange(id)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ConversationCampaignFilter campaigns={CAMPAIGNS} value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));
    await user.click(screen.getByRole('option', { name: 'Black Friday' }));

    expect(onChange).toHaveBeenCalledWith('c2');
  });

  it('elegir "Todas las campañas" LIMPIA el filtro → onChange(undefined)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ConversationCampaignFilter campaigns={CAMPAIGNS} value="c1" onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: /campaña/i }));
    await user.click(screen.getByRole('option', { name: /todas las campañas/i }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
