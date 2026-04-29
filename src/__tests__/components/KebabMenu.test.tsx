import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { KebabMenu } from '@/components/atoms/KebabMenu/KebabMenu';

const items = [
  { label: 'Editar', onClick: vi.fn() },
  { label: 'Eliminar', onClick: vi.fn() },
];

describe('KebabMenu', () => {
  it('renders the trigger button', () => {
    render(<KebabMenu items={items} />);
    expect(screen.getByRole('button', { name: 'Acciones' })).toBeInTheDocument();
  });

  it('menu is closed by default', () => {
    render(<KebabMenu items={items} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens menu on trigger click', async () => {
    const user = userEvent.setup();
    render(<KebabMenu items={items} />);
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('closes menu on second trigger click', async () => {
    const user = userEvent.setup();
    render(<KebabMenu items={items} />);
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls item onClick and closes menu', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<KebabMenu items={[{ label: 'Editar', onClick: onEdit }]} />);
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes menu when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <KebabMenu items={items} />
        <div data-testid="outside">Outside</div>
      </div>
    );
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
