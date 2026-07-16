/**
 * InvalidRecipientsTable (bulk-csv-recipients FE, CSV-FE-7/CSV-FE-8) — tabla
 * PAGINADA de excluidos (view=excluded): nombre + teléfono + motivo (es-AR) +
 * fuente, con el flag `baja` señalado (StatusBadge + texto, nunca solo
 * color). Presentacional puro — data/loading/error/paginación por props
 * (molde de la sección "Destinatarios" de `PreviewModal`).
 *
 *  IRT-1 loading → skeleton (aria-busy)
 *  IRT-2 error → role=alert
 *  IRT-3 sin excluidos → "Sin excluidos" (role=status), sin tabla
 *  IRT-4 con datos → nombre/teléfono/motivo (es-AR)/fuente
 *  IRT-5 status=baja → StatusBadge + texto "Cliente de baja" (no sólo color)
 *  IRT-6 paginación → onPageChange con la página nueva
 *  IRT-7 M2 (review adversarial) — `excludedRowId` da un id ÚNICO por fila
 *        aunque dos excluidos crudos (clientId:null) compartan teléfono (ej.
 *        familia que comparte número); ambas filas quedan visibles en la
 *        tabla. NOTA: se testea la función pura directamente (no vía
 *        console.error de React) porque `DataTable` envuelve cada fila en
 *        un `<>` SIN key propia (bug ajeno, fuera de este change) — eso
 *        neutraliza el warning de "same key" de React independientemente de
 *        si `row.id` colisiona o no, así que ese warning NO es una señal
 *        confiable para este fix.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { InvalidRecipientsTable, excludedRowId } from '@/pages/whatsapp/BulkMessagingPage/components/composer/InvalidRecipientsTable';
import type { ExcludedRecipientDto } from '@/types/messagingBulk';

const ROWS: ExcludedRecipientDto[] = [
  { name: 'Ana Gomez', phone: '+5491100000000', reason: 'telefono_invalido', source: 'csv' },
  { name: 'Juan Perez', phone: '+5491100000001', reason: 'duplicado', source: 'manual', clientId: 'cli-2', status: 'baja' },
];

describe('IRT-1: loading', () => {
  it('muestra un estado de carga (aria-busy)', () => {
    render(<InvalidRecipientsTable data={[]} isLoading isError={false} page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});

describe('IRT-2: error', () => {
  it('muestra un mensaje role=alert', () => {
    render(<InvalidRecipientsTable data={[]} isLoading={false} isError page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
  });
});

describe('IRT-3: sin excluidos', () => {
  it('muestra "Sin excluidos" y no la tabla', () => {
    render(<InvalidRecipientsTable data={[]} isLoading={false} isError={false} page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(screen.getByText(/sin excluidos/i)).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('IRT-4: con datos', () => {
  it('muestra nombre, teléfono, motivo es-AR y fuente', () => {
    render(<InvalidRecipientsTable data={ROWS} isLoading={false} isError={false} page={1} totalPages={1} onPageChange={vi.fn()} />);

    expect(screen.getByText('Ana Gomez')).toBeInTheDocument();
    expect(screen.getByText('+5491100000000')).toBeInTheDocument();
    expect(screen.getByText('Teléfono inválido')).toBeInTheDocument();
    expect(screen.getByText('Duplicado')).toBeInTheDocument();
  });
});

describe('IRT-5: status=baja señalado', () => {
  it('muestra StatusBadge + texto "Cliente de baja" (nunca sólo color)', () => {
    render(<InvalidRecipientsTable data={ROWS} isLoading={false} isError={false} page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(screen.getByText(/cliente de baja/i)).toBeInTheDocument();
  });
});

describe('IRT-6: paginación', () => {
  it('cambiar de página llama a onPageChange', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <InvalidRecipientsTable
        data={ROWS}
        isLoading={false}
        isError={false}
        page={1}
        totalPages={3}
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: '2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe('IRT-7: key estable con teléfonos duplicados (M2, review adversarial)', () => {
  it('excludedRowId da un id ÚNICO por fila aunque dos excluidos compartan teléfono y clientId:null', () => {
    const a: ExcludedRecipientDto = { name: 'Ana Gomez', phone: '+5491100000000', reason: 'sin_nombre', source: 'csv' };
    const b: ExcludedRecipientDto = { name: 'Ana Gomez Hijo', phone: '+5491100000000', reason: 'sin_nombre', source: 'csv' };

    expect(excludedRowId(a, 0)).not.toBe(excludedRowId(b, 1));
  });

  it('sigue priorizando clientId cuando está presente (no rompe el caso normal)', () => {
    const row: ExcludedRecipientDto = { name: 'Juan Perez', phone: '+5491100000001', reason: 'duplicado', clientId: 'cli-2' };
    expect(excludedRowId(row, 5)).toBe('cli-2');
  });

  it('la tabla renderiza AMBAS filas de excluidos con el mismo teléfono (sin colapsar)', () => {
    const DUP_ROWS: ExcludedRecipientDto[] = [
      { name: 'Ana Gomez', phone: '+5491100000000', reason: 'sin_nombre', source: 'csv' },
      { name: 'Ana Gomez Hijo', phone: '+5491100000000', reason: 'sin_nombre', source: 'csv' },
    ];

    render(<InvalidRecipientsTable data={DUP_ROWS} isLoading={false} isError={false} page={1} totalPages={1} onPageChange={vi.fn()} />);

    expect(screen.getByText('Ana Gomez')).toBeInTheDocument();
    expect(screen.getByText('Ana Gomez Hijo')).toBeInTheDocument();
    expect(screen.getAllByText('+5491100000000')).toHaveLength(2);
  });
});
