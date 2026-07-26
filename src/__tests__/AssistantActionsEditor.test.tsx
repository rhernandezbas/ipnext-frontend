import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AssistantActionsEditor } from '@/components/settings/AssistantActionsEditor';
import type { AssistantAction } from '@/types/assistant';

/**
 * ai-assistant-multiagent (ACT-1/ACT-2) — editor de acciones del asistente.
 *
 * Lo que se prueba acá no es que el checkbox tilde: es que **habilitar una acción de alto
 * riesgo cueste más que un click distraído**. `resolve_conversation` marca una conversación
 * como resuelta; si el pedido del cliente seguía abierto, el reclamo queda enterrado.
 */

const ACTIONS: AssistantAction[] = [
  { key: 'private_note', label: 'Dejar nota privada en Chatwoot', riskLevel: 'green' },
  { key: 'apply_label', label: 'Etiquetar la conversación', riskLevel: 'green' },
  { key: 'whatsapp_reply', label: 'Responder al cliente por WhatsApp', riskLevel: 'yellow' },
  { key: 'resolve_conversation', label: 'Marcar la conversación como resuelta', riskLevel: 'red' },
];

const setup = (enabledKeys: string[] = []) => {
  const onChange = vi.fn();
  render(<AssistantActionsEditor actions={ACTIONS} enabledKeys={enabledKeys} onChange={onChange} />);
  return { onChange };
};

describe('AssistantActionsEditor', () => {
  it('lista todas las acciones con su nivel de riesgo en TEXTO, no sólo color', () => {
    setup();

    // WCAG 1.4.1 — el color nunca puede ser la única señal.
    expect(screen.getAllByText('Bajo')).toHaveLength(2);
    expect(screen.getByText('Medio')).toBeInTheDocument();
    expect(screen.getByText('Alto')).toBeInTheDocument();
  });

  it('cada checkbox tiene un label asociado (nombre accesible)', () => {
    setup();

    expect(
      screen.getByRole('checkbox', { name: /Dejar nota privada en Chatwoot/ }),
    ).toBeInTheDocument();
  });

  it('habilitar una acción de riesgo BAJO es inmediato, sin fricción', () => {
    const { onChange } = setup();

    fireEvent.click(screen.getByRole('checkbox', { name: /nota privada/ }));

    expect(onChange).toHaveBeenCalledWith(['private_note']);
  });

  it('habilitar una acción AMARILLA tampoco pide confirmación', () => {
    const { onChange } = setup();

    fireEvent.click(screen.getByRole('checkbox', { name: /Responder al cliente/ }));

    expect(onChange).toHaveBeenCalledWith(['whatsapp_reply']);
  });

  // ── El caso que importa ───────────────────────────────────────────────────
  it('habilitar una acción ROJA NO aplica el cambio hasta confirmar', () => {
    const { onChange } = setup();

    fireEvent.click(screen.getByRole('checkbox', { name: /Marcar la conversación como resuelta/ }));

    // El tilde NO se propaga todavía: primero hay que leer el impacto.
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Habilitar una acción de alto riesgo')).toBeInTheDocument();
  });

  it('la confirmación explica el IMPACTO concreto, no un "¿estás seguro?"', () => {
    setup();

    fireEvent.click(screen.getByRole('checkbox', { name: /Marcar la conversación como resuelta/ }));

    expect(screen.getByText(/el reclamo queda\s+enterrado/)).toBeInTheDocument();
  });

  it('confirmando, la acción roja se habilita', () => {
    const { onChange } = setup(['private_note']);

    fireEvent.click(screen.getByRole('checkbox', { name: /Marcar la conversación como resuelta/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, habilitar/ }));

    expect(onChange).toHaveBeenCalledWith(['private_note', 'resolve_conversation']);
  });

  it('cancelando, NO se habilita nada', () => {
    const { onChange } = setup();

    fireEvent.click(screen.getByRole('checkbox', { name: /Marcar la conversación como resuelta/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('APAGAR una acción roja NO pide confirmación', () => {
    // Quitar una capacidad peligrosa siempre debe ser más fácil que darla.
    const { onChange } = setup(['resolve_conversation']);

    fireEvent.click(screen.getByRole('checkbox', { name: /Marcar la conversación como resuelta/ }));

    expect(onChange).toHaveBeenCalledWith([]);
    expect(screen.queryByText('Habilitar una acción de alto riesgo')).not.toBeInTheDocument();
  });

  it('refleja el estado habilitado que viene del backend', () => {
    setup(['whatsapp_reply']);

    expect(screen.getByRole('checkbox', { name: /Responder al cliente/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /nota privada/ })).not.toBeChecked();
  });
});
