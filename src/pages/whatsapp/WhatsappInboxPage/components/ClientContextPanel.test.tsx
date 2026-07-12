/**
 * ClientContextPanel — panel derecho con el contexto de cliente
 * (messaging-inbox F1, design §1, tasks FB3 3.7/3.8). CONTEXT-1: 3 estados
 * excluyentes (`matched`/`unknown`/`ambiguous`) + neutro cuando `clientContext`
 * está ausente. Extiende el patrón visual de `CustomerCard`
 * (SchedulingTaskDetailPage), que solo maneja 2 estados (con/sin cliente).
 *
 * Drift de contrato (design §3, tipos ya congelados en FB1
 * `types/whatsapp.ts`): el DTO real usa `clients: {id,name,status}[]` para
 * los 3 estados, NO `customerId`/`candidates` sueltos como sugería el boceto
 * del spec.md pre-design. `matched` usa `clients[0]`; `ambiguous` lista todo
 * `clients`.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { ClientContextPanel } from './ClientContextPanel';
import type { WhatsappClientContext } from '@/types/whatsapp';

function renderPanel(ctx?: WhatsappClientContext | null) {
  return render(
    <MemoryRouter>
      <ClientContextPanel clientContext={ctx} />
    </MemoryRouter>,
  );
}

describe('ClientContextPanel — CONTEXT-1 (matched)', () => {
  it('muestra ficha básica + link al cliente', () => {
    renderPanel({ status: 'matched', clients: [{ id: '42', name: 'Juan Perez', status: 'active' }] });
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver perfil/i })).toHaveAttribute('href', '/admin/customers/view/42');
  });
});

describe('ClientContextPanel — CONTEXT-1 (unknown)', () => {
  it('muestra "contacto desconocido" sin datos de cliente', () => {
    renderPanel({ status: 'unknown', clients: [] });
    expect(screen.getByText(/contacto desconocido/i)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('ClientContextPanel — CONTEXT-1 (ambiguous)', () => {
  it('muestra la lista de candidatos (nombre + link) sin elegir uno solo', () => {
    renderPanel({
      status: 'ambiguous',
      clients: [
        { id: '1', name: 'Juan Perez', status: 'active' },
        { id: '2', name: 'Juan P.', status: 'active' },
      ],
    });
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText('Juan P.')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /ver perfil/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/admin/customers/view/1');
    expect(links[1]).toHaveAttribute('href', '/admin/customers/view/2');
  });
});

describe('ClientContextPanel — CONTEXT-1 (contexto ausente)', () => {
  it('sin clientContext (null), muestra un estado neutro y no rompe', () => {
    renderPanel(null);
    expect(screen.getByText(/sin informaci.n de contexto/i)).toBeInTheDocument();
  });

  it('sin clientContext (prop omitida), también neutro', () => {
    render(
      <MemoryRouter>
        <ClientContextPanel />
      </MemoryRouter>,
    );
    expect(screen.getByText(/sin informaci.n de contexto/i)).toBeInTheDocument();
  });

  it('matched con clients vacío (dato malformado) cae a neutro sin crashear', () => {
    renderPanel({ status: 'matched', clients: [] });
    expect(screen.getByText(/sin informaci.n de contexto/i)).toBeInTheDocument();
  });
});
