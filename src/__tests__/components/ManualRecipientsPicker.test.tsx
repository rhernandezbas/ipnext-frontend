/**
 * ManualRecipientsPicker (manual-recipients-fe T3, PICK-1/PICK-2) — multi-select
 * con chips que envuelve el `CustomerPicker` single-select. Se mockea el
 * `CustomerPicker` con un doble que expone un botón por candidato + el
 * `excludeIds` que recibió, para probar la responsabilidad del WRAPPER (dedup,
 * pasaje de excludeIds, chips, quitar) SIN re-testear el typeahead del picker
 * (eso vive en `CustomerPicker.test.tsx`). El wiring real con el picker vivo lo
 * cubre `CampaignComposer.test.tsx`.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useState } from 'react';

const CANDIDATES = [
  { id: 'c-1', name: 'Juan García', email: 'juan@test.com', phone: '+5491111111111', status: 'active' },
  { id: 'c-2', name: 'María López', email: 'maria@test.com', phone: '+5492222222222', status: 'active' },
];

// Doble del CustomerPicker: un botón por candidato (permite "elegir" cualquiera,
// incluso ya-agregados, para probar el dedup del wrapper) + refleja el excludeIds
// recibido como data-attr (para probar que el wrapper lo pasa). Renderiza un
// <input id={id}> real para que el wrapper pueda devolverle el foco (FIX 3) y el
// <label htmlFor> externo lo asocie.
vi.mock('@/components/molecules/CustomerPicker/CustomerPicker', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- doble de test
  CustomerPicker: ({ onChange, excludeIds, id }: any) => (
    <div data-testid="picker">
      <input id={id} data-testid="picker-input" />
      {CANDIDATES.map((c) => (
        <button
          key={c.id}
          type="button"
          data-testid={`pick-${c.id}`}
          data-excluded={excludeIds?.includes(c.id) ? 'true' : 'false'}
          onClick={() => onChange(String(c.id), c.name, c)}
        >
          pick {c.name}
        </button>
      ))}
    </div>
  ),
}));

import { ManualRecipientsPicker, type ManualRecipient } from '@/components/molecules/ManualRecipientsPicker/ManualRecipientsPicker';

function Harness({ initial = [], invalidIds }: { initial?: ManualRecipient[]; invalidIds?: string[] }) {
  const [value, setValue] = useState<ManualRecipient[]>(initial);
  return <ManualRecipientsPicker value={value} onChange={setValue} invalidIds={invalidIds} />;
}

describe('ManualRecipientsPicker', () => {
  it('agrega un cliente como chip con nombre + teléfono y actualiza el contador', () => {
    render(<Harness />);

    fireEvent.click(screen.getByTestId('pick-c-1'));

    const list = screen.getByRole('list', { name: /destinatarios manuales agregados/i });
    expect(within(list).getByText('Juan García')).toBeInTheDocument();
    expect(within(list).getByText('+5491111111111')).toBeInTheDocument();
    expect(screen.getByText(/1 destinatario manual/i)).toBeInTheDocument();
  });

  it('no agrega el mismo cliente dos veces (dedup por id)', () => {
    render(<Harness />);

    fireEvent.click(screen.getByTestId('pick-c-1'));
    fireEvent.click(screen.getByTestId('pick-c-1'));

    const list = screen.getByRole('list', { name: /destinatarios manuales agregados/i });
    expect(within(list).getAllByText('Juan García')).toHaveLength(1);
    expect(screen.getByText(/1 destinatario manual/i)).toBeInTheDocument();
  });

  it('pasa los ids ya agregados como excludeIds al CustomerPicker', () => {
    render(<Harness />);

    expect(screen.getByTestId('pick-c-1')).toHaveAttribute('data-excluded', 'false');
    fireEvent.click(screen.getByTestId('pick-c-1'));
    expect(screen.getByTestId('pick-c-1')).toHaveAttribute('data-excluded', 'true');
    expect(screen.getByTestId('pick-c-2')).toHaveAttribute('data-excluded', 'false');
  });

  it('quita un cliente con el botón ✕', () => {
    render(<Harness initial={[{ id: 'c-1', name: 'Juan García', phone: '+5491111111111' }]} />);

    fireEvent.click(screen.getByRole('button', { name: /quitar juan garcía/i }));

    expect(screen.queryByText('Juan García')).not.toBeInTheDocument();
    expect(screen.getByText(/sin destinatarios manuales/i)).toBeInTheDocument();
  });

  it('estado vacío: explica que no hay destinatarios manuales', () => {
    render(<Harness />);
    expect(screen.getByText(/sin destinatarios manuales/i)).toBeInTheDocument();
  });

  // FIX 4 — antes había DOS live regions (la <ul> y el contador): al agregar se
  // anunciaba doble, y los removals sólo los anunciaba el contador (el
  // aria-relevant default de la lista no incluye removals). Se deja UN solo live
  // region: el contador (role=status), que cubre altas Y bajas (el número siempre
  // cambia). La <ul> queda como lista con su aria-label, SIN aria-live.
  describe('FIX 4 — un solo live region (evita el doble anuncio de SR)', () => {
    it('la lista NO es aria-live (el anuncio lo da el contador)', () => {
      render(<Harness initial={[{ id: 'c-1', name: 'Juan García', phone: '+5491111111111' }]} />);
      const list = screen.getByRole('list', { name: /destinatarios manuales agregados/i });
      expect(list).not.toHaveAttribute('aria-live');
    });

    it('el contador es el ÚNICO live region: role=status (cubre altas y bajas)', () => {
      render(<Harness />);
      expect(screen.getByText(/sin destinatarios manuales/i)).toHaveAttribute('role', 'status');
    });

    it('cada ✕ conserva su aria-label descriptivo', () => {
      render(<Harness initial={[{ id: 'c-1', name: 'Juan García', phone: '+5491111111111' }]} />);
      expect(screen.getByRole('button', { name: 'Quitar Juan García' })).toBeInTheDocument();
    });
  });

  // FIX 3 (WCAG 2.4.3 Focus Order) — al quitar un chip, su ✕ enfocado se desmonta
  // y el foco caería al <body>. Debe moverse al ✕ del chip SIGUIENTE (o el
  // ANTERIOR si era el último, o el input de búsqueda si la lista quedó vacía).
  describe('FIX 3 — foco tras quitar un chip', () => {
    const THREE: ManualRecipient[] = [
      { id: 'c-1', name: 'Juan García', phone: '+5491111111111' },
      { id: 'c-2', name: 'María López', phone: '+5492222222222' },
      { id: 'c-3', name: 'Pedro Sosa', phone: '+5493333333333' },
    ];

    it('quitar un chip del medio mueve el foco al ✕ del SIGUIENTE', () => {
      render(<Harness initial={THREE} />);
      fireEvent.click(screen.getByRole('button', { name: /quitar maría lópez/i }));
      expect(screen.getByRole('button', { name: /quitar pedro sosa/i })).toHaveFocus();
    });

    it('quitar el ÚLTIMO chip mueve el foco al ✕ del anterior', () => {
      render(<Harness initial={THREE} />);
      fireEvent.click(screen.getByRole('button', { name: /quitar pedro sosa/i }));
      expect(screen.getByRole('button', { name: /quitar maría lópez/i })).toHaveFocus();
    });

    it('quitar el ÚNICO chip devuelve el foco al input de búsqueda', () => {
      render(<Harness initial={[THREE[0]]} />);
      fireEvent.click(screen.getByRole('button', { name: /quitar juan garcía/i }));
      expect(screen.getByLabelText(/buscar cliente/i)).toHaveFocus();
    });
  });

  // FIX 7 — el picker usaba <section><h3> mientras su hermano SegmentBuilder usa
  // <fieldset><legend> (correcto para agrupar controles), y la page tiene <h1>
  // sin <h2> intermedio → salto h1→h3 (viola 1.3.1). Ahora es <fieldset><legend>.
  describe('FIX 7 — agrupación semántica (fieldset, sin salto de heading)', () => {
    it('el grupo es un <fieldset> (role=group) nombrado por su <legend>, sin un <h3> que rompa la jerarquía', () => {
      render(<Harness />);
      const group = screen.getByRole('group', { name: /destinatarios manuales/i });
      expect(group.tagName).toBe('FIELDSET');
      expect(screen.queryByRole('heading', { name: /destinatarios manuales/i })).not.toBeInTheDocument();
    });
  });

  it('marca como inválido el chip cuyo id el BE reportó como inexistente', () => {
    render(
      <Harness
        initial={[{ id: 'c-1', name: 'Juan García', phone: '+5491111111111' }]}
        invalidIds={['c-1']}
      />,
    );
    // Indicador NO solo-color: hay un texto que lo explica.
    expect(screen.getByText(/ya no existe/i)).toBeInTheDocument();
  });
});
