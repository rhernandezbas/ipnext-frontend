import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ContextError } from './ContextError';

describe('ContextError (messaging-inbox-v2 F1.5, design §4 "error sin data")', () => {
  it('muestra el mensaje de error y un botón "Reintentar"', () => {
    render(<ContextError onRetry={vi.fn()} />);
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('clickear "Reintentar" invoca onRetry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ContextError onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
