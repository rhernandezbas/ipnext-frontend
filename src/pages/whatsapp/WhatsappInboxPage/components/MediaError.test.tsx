/**
 * MediaError — status `failed` (messaging-inbox-v2-media F1.5 fase A, F3.2,
 * design §3.6). `role="alert"` para que el lector lo anuncie. El botón
 * "Reintentar" es semántica honesta: fuerza un re-check, NO re-dispara la
 * descarga real (eso lo hace el scheduler del BE) — acá solo se valida que
 * dispare el callback que el consumidor decida.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MediaError } from './MediaError';

describe('MediaError', () => {
  it('anuncia el error con role=alert y el texto honesto', () => {
    render(<MediaError />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el adjunto');
  });

  it('muestra el filename como subtexto cuando está presente', () => {
    render(<MediaError filename="factura.pdf" />);
    expect(screen.getByText('factura.pdf')).toBeInTheDocument();
  });

  it('NO muestra subtexto cuando filename es null', () => {
    render(<MediaError filename={null} />);
    expect(screen.queryByText(/\.pdf|\.jpg/)).toBeNull();
  });

  it('el botón Reintentar dispara onRetry al click', () => {
    const onRetry = vi.fn();
    render(<MediaError onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('el aria-label del botón incluye el filename cuando existe', () => {
    render(<MediaError filename="foto.jpg" onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: /reintentar cargar foto\.jpg/i })).toBeInTheDocument();
  });
});
