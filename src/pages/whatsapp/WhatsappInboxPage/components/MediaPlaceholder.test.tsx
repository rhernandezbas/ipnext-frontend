/**
 * MediaPlaceholder — "Descargando…" type-aware (messaging-inbox-v2-media
 * F1.5 fase A, F3.1, design §3.5/§6). Ocupa EXACTAMENTE la misma caja que la
 * media real (aspect-ratio de width/height) → el reemplazo pending→downloaded
 * es cero layout shift.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MediaPlaceholder } from './MediaPlaceholder';

describe('MediaPlaceholder', () => {
  it('anuncia el estado de descarga con role=status y aria-live=polite', () => {
    render(<MediaPlaceholder fileType="image" width={800} height={600} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/descargando adjunto/i)).toBeInTheDocument();
  });

  it('reserva la caja con aspect-ratio de width/height cuando ambos existen (image)', () => {
    render(<MediaPlaceholder fileType="image" width={800} height={400} />);
    expect(screen.getByRole('status').style.getPropertyValue('--media-ar')).toBe('800 / 400');
  });

  it('fallback 4/3 cuando faltan width/height (image)', () => {
    render(<MediaPlaceholder fileType="image" width={null} height={null} />);
    expect(screen.getByRole('status').style.getPropertyValue('--media-ar')).toBe('4 / 3');
  });

  it('fallback 16/9 para video sin dimensiones', () => {
    render(<MediaPlaceholder fileType="video" width={null} height={null} />);
    expect(screen.getByRole('status').style.getPropertyValue('--media-ar')).toBe('16 / 9');
  });

  it('audio reserva min-height 54px (sin aspect-ratio, alto fijo conocido)', () => {
    render(<MediaPlaceholder fileType="audio" width={null} height={null} />);
    expect(screen.getByRole('status').style.minHeight).toBe('54px');
    expect(screen.getByRole('status').style.getPropertyValue('--media-ar')).toBe('');
  });

  it('file reserva min-height 72px', () => {
    render(<MediaPlaceholder fileType="file" width={null} height={null} />);
    expect(screen.getByRole('status').style.minHeight).toBe('72px');
  });
});
