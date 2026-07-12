/**
 * Skeleton — shimmer compartido para los estados de carga del inbox
 * (messaging-inbox F1, design §7, task FB2 2.6: "Skeleton shimmer compartido
 * (porta DataTable.module.css:81-92) para lista/thread/contexto"). Consumido
 * por ConversationList/MessageThread/ClientContextPanel (FB3) — acá solo se
 * construye el primitivo presentacional.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renderiza un bloque de shimmer con role presentation (decorativo)', () => {
    render(<Skeleton />);
    expect(screen.getByRole('presentation')).toBeInTheDocument();
  });

  it('aplica width/height custom vía inline style', () => {
    render(<Skeleton width="60%" height={20} />);
    const el = screen.getByRole('presentation');
    expect(el.style.width).toBe('60%');
    expect(el.style.height).toBe('20px');
  });

  it('usa valores por defecto razonables cuando no se pasan props', () => {
    render(<Skeleton />);
    const el = screen.getByRole('presentation');
    expect(el.style.width).toBe('100%');
    expect(el.style.height).not.toBe('');
  });

  it('circle=true aplica border-radius full (para skeletons de avatar)', () => {
    render(<Skeleton circle width={36} height={36} />);
    expect(screen.getByRole('presentation')).toHaveClass('circle');
  });

  it('acepta className adicional del consumidor (composición)', () => {
    render(<Skeleton className="my-extra-class" />);
    expect(screen.getByRole('presentation')).toHaveClass('my-extra-class');
  });
});
