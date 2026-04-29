import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { DataTable } from '@/components/organisms/DataTable/DataTable';

interface Row { id: number; name: string; status: string; }

const columns = [
  { label: 'Nombre', key: 'name' as const, sortable: true },
  { label: 'Estado', key: 'status' as const },
];

const data: Row[] = [
  { id: 1, name: 'Alice', status: 'active' },
  { id: 2, name: 'Bob', status: 'inactive' },
  { id: 3, name: 'Carol', status: 'active' },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
  });

  it('shows empty message when data is empty', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Sin datos." />);
    expect(screen.getByText('Sin datos.')).toBeInTheDocument();
  });

  it('renders skeleton rows when loading', () => {
    const { container } = render(<DataTable columns={columns} data={data} loading />);
    const skeletonRows = container.querySelectorAll('tbody tr');
    expect(skeletonRows).toHaveLength(5);
  });

  it('sorts data ascending when sortable header clicked', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} />);

    await user.click(screen.getByRole('columnheader', { name: /nombre/i }));

    const cells = screen.getAllByRole('cell').filter((_, i) => i % 2 === 0); // name column
    expect(cells[0].textContent).toBe('Alice');
    expect(cells[1].textContent).toBe('Bob');
    expect(cells[2].textContent).toBe('Carol');
  });

  it('sorts data descending on second click of sortable header', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} />);

    const header = screen.getByRole('columnheader', { name: /nombre/i });
    await user.click(header); // asc
    await user.click(header); // desc

    const cells = screen.getAllByRole('cell').filter((_, i) => i % 2 === 0);
    expect(cells[0].textContent).toBe('Carol');
    expect(cells[1].textContent).toBe('Bob');
    expect(cells[2].textContent).toBe('Alice');
  });

  it('renders actions via KebabMenu', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const actions = [{ label: 'Editar', onClick: onEdit }];
    render(<DataTable columns={columns} data={[data[0]]} actions={actions} />);

    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(onEdit).toHaveBeenCalledWith(data[0]);
  });

  it('renders custom cell content via render prop', () => {
    const customColumns = [
      { label: 'Estado', key: 'status', render: (row: Row) => <span data-testid="badge">{row.status.toUpperCase()}</span> },
    ];
    render(<DataTable columns={customColumns} data={[data[0]]} />);
    expect(screen.getByTestId('badge')).toHaveTextContent('ACTIVE');
  });

  it('expands row on expand button click', async () => {
    const user = userEvent.setup();
    const expandedContent = (row: Row) => <div>Details for {row.name}</div>;
    render(<DataTable columns={columns} data={[data[0]]} expandedContent={expandedContent} />);

    expect(screen.queryByText('Details for Alice')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expandir' }));
    expect(screen.getByText('Details for Alice')).toBeInTheDocument();
  });

  describe('selectable', () => {
    it('renders checkboxes when selectable=true', () => {
      render(<DataTable columns={columns} data={data} selectable />);
      const checkboxes = screen.getAllByRole('checkbox');
      // 1 header + 3 rows = 4
      expect(checkboxes).toHaveLength(4);
    });

    it('select-all checkbox selects all rows', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();
      render(<DataTable columns={columns} data={data} selectable onSelectionChange={onSelectionChange} />);

      const [selectAll] = screen.getAllByRole('checkbox');
      await user.click(selectAll);

      expect(onSelectionChange).toHaveBeenCalledWith(['1', '2', '3']);
    });

    it('unchecking a row deselects it and calls onSelectionChange', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();
      render(<DataTable columns={columns} data={data} selectable onSelectionChange={onSelectionChange} />);

      const [selectAll] = screen.getAllByRole('checkbox');
      await user.click(selectAll); // select all (3 rows)
      await user.click(selectAll); // deselect all

      const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1][0];
      expect(lastCall).toHaveLength(0);
    });

    it('checkbox column is first when selectable=true', () => {
      const { container } = render(<DataTable columns={columns} data={data} selectable />);
      const headerCells = container.querySelectorAll('thead th');
      // first header cell should contain a checkbox
      expect(headerCells[0].querySelector('input[type="checkbox"]')).toBeInTheDocument();
    });
  });

  describe('totals row', () => {
    it('renders totals row in tfoot when totals prop provided', () => {
      const { container } = render(
        <DataTable
          columns={columns}
          data={data}
          totals={{ name: 'Total: 3', status: '-' }}
        />
      );
      expect(container.querySelector('tfoot')).toBeInTheDocument();
      expect(screen.getByText('Total: 3')).toBeInTheDocument();
    });

    it('renders empty cell for columns without a total', () => {
      const { container } = render(
        <DataTable
          columns={columns}
          data={data}
          totals={{ name: 'Total: 3' }}
        />
      );
      const tfootCells = container.querySelectorAll('tfoot td');
      expect(tfootCells).toHaveLength(2); // name + status
      expect(tfootCells[1].textContent).toBe('');
    });
  });
});
