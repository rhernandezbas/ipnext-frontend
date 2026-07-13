/**
 * ComposerAttachButton — botón "clip" + input file oculto (molde
 * `TaskPhotosGallery`, messaging-inbox-v2-media F1.5 fase A, Tanda 2, design
 * §5.1). Presentacional puro: sin red, sin queryClient.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ComposerAttachButton } from './ComposerAttachButton';

describe('ComposerAttachButton', () => {
  it('click en el botón abre el picker (dispara el click del input file oculto)', async () => {
    render(<ComposerAttachButton onFiles={vi.fn()} count={0} max={10} />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    await userEvent.click(screen.getByRole('button', { name: /adjuntar archivos/i }));

    expect(clickSpy).toHaveBeenCalled();
  });

  it('onChange mapea los files elegidos a un array y llama onFiles', async () => {
    const onFiles = vi.fn();
    render(<ComposerAttachButton onFiles={onFiles} count={0} max={10} />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

    await userEvent.upload(input, file);

    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('resetea input.value tras onChange (re-permite elegir el mismo archivo)', async () => {
    render(<ComposerAttachButton onFiles={vi.fn()} count={0} max={10} />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

    await userEvent.upload(input, file);

    expect(input.value).toBe('');
  });

  it('el input acepta múltiples archivos (atributo multiple)', () => {
    render(<ComposerAttachButton onFiles={vi.fn()} count={0} max={10} />);
    const input = screen.getByTestId('composer-attach-input') as HTMLInputElement;
    expect(input.multiple).toBe(true);
  });

  it('el botón NO es de tipo submit (no manda el form)', () => {
    render(<ComposerAttachButton onFiles={vi.fn()} count={0} max={10} />);
    expect(screen.getByRole('button', { name: /adjuntar archivos/i })).toHaveAttribute('type', 'button');
  });

  it('disabled deshabilita el botón visible', () => {
    render(<ComposerAttachButton onFiles={vi.fn()} count={0} max={10} disabled />);
    expect(screen.getByRole('button', { name: /adjuntar archivos/i })).toBeDisabled();
  });

  it('aria-label describe la acción', () => {
    render(<ComposerAttachButton onFiles={vi.fn()} count={0} max={10} />);
    expect(screen.getByRole('button', { name: 'Adjuntar archivos' })).toBeInTheDocument();
  });
});

describe('ComposerAttachButton — bug CRÍTICO #4 (count/max ya NO son props muertas)', () => {
  it('count === max deshabilita el botón aunque disabled sea false', () => {
    render(<ComposerAttachButton onFiles={vi.fn()} count={10} max={10} />);
    expect(screen.getByRole('button', { name: /adjuntar archivos/i })).toBeDisabled();
  });

  it('count por debajo de max, el botón sigue habilitado', () => {
    render(<ComposerAttachButton onFiles={vi.fn()} count={5} max={10} />);
    expect(screen.getByRole('button', { name: /adjuntar archivos/i })).toBeEnabled();
  });

  it('al tope, el aria-label refleja el máximo alcanzado', () => {
    render(<ComposerAttachButton onFiles={vi.fn()} count={10} max={10} />);
    expect(screen.getByRole('button', { name: /máximo 10 alcanzado/i })).toBeInTheDocument();
  });
});
