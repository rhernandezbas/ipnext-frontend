/**
 * ConversationAssignmentControls — dropdowns "Asignar a"/"Área" del header del
 * thread (messaging-inbox-assignment F1.5-C2 — ASIGNACIÓN). Presentacional
 * puro: recibe `assignee`/`area`/`users`/`areas` como props — `MessageThread`
 * lo monta gateado por `<Can permission="messaging.send">` (igual que
 * `ConversationStatusToggle`), `WhatsappInboxPage` orquesta las mutations
 * (`useSetConversationAssignee`/`useSetConversationArea`) y los catálogos
 * (`useAssignableUsers`/`useMessagingAreas`).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConversationAssignmentControls } from './ConversationAssignmentControls';
import type { WhatsappArea, WhatsappAssignee } from '@/types/whatsapp';

const USERS: WhatsappAssignee[] = [
  { id: 'u1', name: 'Ana Torres' },
  { id: 'u2', name: 'Beto Diaz' },
];

const AREAS: WhatsappArea[] = [
  { id: 'a1', name: 'Soporte', color: '#2563eb' },
  { id: 'a2', name: 'Ventas', color: '#f59e0b' },
];

describe('ConversationAssignmentControls — muestra el valor actual', () => {
  it('sin assignee, el select "Asignar a" queda en "Sin asignar"', () => {
    render(<ConversationAssignmentControls assignee={null} area={null} users={USERS} areas={AREAS} />);
    expect(screen.getByRole('combobox', { name: /asignar a/i })).toHaveValue('');
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
  });

  it('con assignee, el select muestra al agente asignado', () => {
    render(<ConversationAssignmentControls assignee={USERS[0]!} area={null} users={USERS} areas={AREAS} />);
    expect(screen.getByRole('combobox', { name: /asignar a/i })).toHaveValue('u1');
  });

  it('sin area, el select "Área" queda en "Sin área"', () => {
    render(<ConversationAssignmentControls assignee={null} area={null} users={USERS} areas={AREAS} />);
    expect(screen.getByRole('combobox', { name: /^área$/i })).toHaveValue('');
    expect(screen.getByText('Sin área')).toBeInTheDocument();
  });

  it('con area, el select muestra el área asignada', () => {
    render(<ConversationAssignmentControls assignee={null} area={AREAS[1]!} users={USERS} areas={AREAS} />);
    expect(screen.getByRole('combobox', { name: /^área$/i })).toHaveValue('a2');
  });

  it('assignee asignado que YA NO está en el catálogo (agente desactivado): se muestra igual vía opción fantasma, no queda en blanco', () => {
    const STALE_USER: WhatsappAssignee = { id: 'u-gone', name: 'Ex Agente' };
    render(<ConversationAssignmentControls assignee={STALE_USER} area={null} users={USERS} areas={AREAS} />);
    expect(screen.getByRole('combobox', { name: /asignar a/i })).toHaveValue('u-gone');
    expect(screen.getByText('Ex Agente')).toBeInTheDocument();
  });
});

describe('ConversationAssignmentControls — cambio optimista', () => {
  it('elegir un agente dispara onAssigneeChange con el objeto {id,name} completo', async () => {
    const onAssigneeChange = vi.fn();
    render(<ConversationAssignmentControls assignee={null} area={null} users={USERS} areas={AREAS} onAssigneeChange={onAssigneeChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), 'u2');

    expect(onAssigneeChange).toHaveBeenCalledWith({ id: 'u2', name: 'Beto Diaz' });
  });

  it('elegir "Sin asignar" (ya con un assignee) dispara onAssigneeChange(null)', async () => {
    const onAssigneeChange = vi.fn();
    render(<ConversationAssignmentControls assignee={USERS[0]!} area={null} users={USERS} areas={AREAS} onAssigneeChange={onAssigneeChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), '');

    expect(onAssigneeChange).toHaveBeenCalledWith(null);
  });

  it('elegir un área dispara onAreaChange con el objeto {id,name,color} completo', async () => {
    const onAreaChange = vi.fn();
    render(<ConversationAssignmentControls assignee={null} area={null} users={USERS} areas={AREAS} onAreaChange={onAreaChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /^área$/i }), 'a1');

    expect(onAreaChange).toHaveBeenCalledWith({ id: 'a1', name: 'Soporte', color: '#2563eb' });
  });

  it('elegir "Sin área" (ya con un área) dispara onAreaChange(null)', async () => {
    const onAreaChange = vi.fn();
    render(<ConversationAssignmentControls assignee={null} area={AREAS[0]!} users={USERS} areas={AREAS} onAreaChange={onAreaChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /^área$/i }), '');

    expect(onAreaChange).toHaveBeenCalledWith(null);
  });
});

describe('ConversationAssignmentControls — estado de carga (isAssigneePending/isAreaPending)', () => {
  it('isAssigneePending deshabilita SOLO el select de asignado, no el de área', () => {
    render(<ConversationAssignmentControls assignee={null} area={null} users={USERS} areas={AREAS} isAssigneePending />);
    expect(screen.getByRole('combobox', { name: /asignar a/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /^área$/i })).not.toBeDisabled();
  });

  it('isAreaPending deshabilita SOLO el select de área', () => {
    render(<ConversationAssignmentControls assignee={null} area={null} users={USERS} areas={AREAS} isAreaPending />);
    expect(screen.getByRole('combobox', { name: /^área$/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /asignar a/i })).not.toBeDisabled();
  });

  it('sin pending (default), ambos selects están habilitados', () => {
    render(<ConversationAssignmentControls assignee={null} area={null} users={USERS} areas={AREAS} />);
    expect(screen.getByRole('combobox', { name: /asignar a/i })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: /^área$/i })).toBeEnabled();
  });
});

describe('ConversationAssignmentControls — A11Y', () => {
  it('ambos selects tienen nombre accesible vía <label>', () => {
    render(<ConversationAssignmentControls assignee={null} area={null} users={USERS} areas={AREAS} />);
    expect(screen.getByRole('combobox', { name: /asignar a/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^área$/i })).toBeInTheDocument();
  });

  it('son alcanzables por teclado (Tab) sin ARIA extra', () => {
    render(<ConversationAssignmentControls assignee={null} area={null} users={USERS} areas={AREAS} />);
    const select = screen.getByRole('combobox', { name: /asignar a/i });
    select.focus();
    expect(select).toHaveFocus();
  });
});
