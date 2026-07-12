import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ContextNeutral } from './ContextNeutral';

describe('ContextNeutral (messaging-inbox-v2 F1.5, design §4)', () => {
  it('renderiza el mensaje recibido', () => {
    render(<ContextNeutral message="Contacto desconocido — sin cliente asociado." />);
    expect(screen.getByText(/contacto desconocido/i)).toBeInTheDocument();
  });

  it('renderiza mensajes distintos sin acoplarse a un texto fijo', () => {
    render(<ContextNeutral message="Sin información de contexto disponible." />);
    expect(screen.getByText(/sin informaci.n de contexto/i)).toBeInTheDocument();
  });
});
