/**
 * Select — combobox/listbox PROPIO accesible (messaging-bulk-v11 FE apply
 * chunk 1). Reemplaza el `<select>` nativo de cara al operador (regla nueva
 * del WORKFLOW: prohibido el `<select>` nativo genérico).
 *
 * Patrón WAI-ARIA APG "Select-Only Combobox": el trigger es un `<button
 * role="combobox">` (foco se queda SIEMPRE ahí, nunca entra al listbox),
 * `aria-expanded` + `aria-controls` + `aria-activedescendant` apuntan al
 * popup `role="listbox"` con `role="option"` hijos.
 *
 *  SEL-1  cerrado: sin listbox en el DOM; trigger combobox aria-expanded=false,
 *         aria-haspopup=listbox; muestra placeholder si el value no matchea
 *         ninguna opción
 *  SEL-2  click en el trigger abre el listbox; opciones con label; la opción
 *         que matchea `value` tiene aria-selected + check visual
 *  SEL-3  click en una opción llama a onChange, cierra el listbox y devuelve
 *         el foco al trigger
 *  SEL-4  click en una opción disabled NO llama a onChange y NO cierra
 *  SEL-5  Enter/Espacio en el trigger (cerrado) abre el listbox
 *  SEL-6  ArrowDown en el trigger (cerrado) abre el listbox
 *  SEL-7  ArrowDown (abierto) mueve el activedescendant a la siguiente opción
 *         habilitada, saltando las disabled
 *  SEL-8  ArrowUp (abierto) mueve al activedescendant anterior habilitado
 *  SEL-9  Home/End mueven al primer/último habilitado
 *  SEL-10 Enter (abierto) selecciona la opción activa y cierra
 *  SEL-11 Escape (abierto) cierra SIN cambiar el value; foco vuelve al trigger
 *  SEL-12 click afuera cierra sin cambiar el value
 *  SEL-13 disabled (de todo el Select) — trigger disabled, no abre
 *  SEL-14 label visible da nombre accesible al combobox
 *  SEL-15 aria-label (sin label visible) da nombre accesible sin <label>
 *  SEL-16 placeholder se muestra cuando el value no matchea ninguna opción
 *  SEL-17 el foco NUNCA entra al listbox — se queda en el trigger durante toda la navegación
 */
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';

const OPTIONS: SelectOption[] = [
  { value: 'a', label: 'Opción A' },
  { value: 'b', label: 'Opción B', disabled: true },
  { value: 'c', label: 'Opción C' },
];

// >6 opciones — con max-height 280px del listbox, navegar más allá de las
// primeras deja la opción activa fuera del viewport (FIX-2).
const MANY: SelectOption[] = Array.from({ length: 10 }, (_, i) => ({
  value: `o${i}`,
  label: `Opción ${i}`,
}));

describe('SEL-1: cerrado', () => {
  it('no renderiza el listbox y el trigger es un combobox colapsado', () => {
    render(<Select options={OPTIONS} value="" onChange={vi.fn()} label="Estado" placeholder="Elegí…" />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveTextContent('Elegí…');
  });
});

describe('SEL-2: abrir por click', () => {
  it('lista las opciones; la seleccionada tiene aria-selected + check', () => {
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Estado" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Estado' }));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const optA = screen.getByRole('option', { name: /Opción A/ });
    expect(optA).toHaveAttribute('aria-selected', 'true');
    expect(optA).toHaveTextContent('✓');
    expect(screen.getByRole('option', { name: /Opción C/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('las opciones disabled tienen aria-disabled', () => {
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Estado" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Estado' }));
    expect(screen.getByRole('option', { name: /Opción B/ })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('SEL-3: click en una opción', () => {
  it('llama a onChange, cierra el listbox y devuelve el foco al trigger', () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} value="a" onChange={onChange} label="Estado" />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole('option', { name: /Opción C/ }));

    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('SEL-4: click en opción disabled', () => {
  it('NO llama a onChange y el listbox sigue abierto', () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} value="a" onChange={onChange} label="Estado" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Estado' }));

    fireEvent.click(screen.getByRole('option', { name: /Opción B/ }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});

describe('SEL-5: Enter/Espacio abre', () => {
  it('Enter en el trigger cerrado abre el listbox', async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Estado" />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    trigger.focus();

    await user.keyboard('{Enter}');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('Espacio en el trigger cerrado abre el listbox', async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Estado" />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    trigger.focus();

    await user.keyboard(' ');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});

describe('SEL-6: ArrowDown abre', () => {
  it('ArrowDown en el trigger cerrado abre el listbox', async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Estado" />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    trigger.focus();

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});

describe('SEL-7/8/9: navegación con flechas y Home/End', () => {
  it('ArrowDown desde la opción activa "a" salta la disabled "b" y activa "c"', async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Estado" />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    trigger.focus();
    await user.keyboard('{ArrowDown}'); // abre, activa = value actual ("a")

    await user.keyboard('{ArrowDown}'); // salta "b" (disabled) -> "c"

    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Opción C/ }).id);
  });

  it('ArrowUp desde "c" vuelve a "a" (salta la disabled "b")', async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} value="c" onChange={vi.fn()} label="Estado" />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    trigger.focus();
    await user.keyboard('{ArrowDown}'); // abre, activa = "c"

    await user.keyboard('{ArrowUp}'); // salta "b" (disabled) -> "a"

    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Opción A/ }).id);
  });

  it('Home activa la primera opción habilitada, End la última', async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Estado" />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    trigger.focus();
    await user.keyboard('{ArrowDown}'); // abre

    await user.keyboard('{End}');
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Opción C/ }).id);

    await user.keyboard('{Home}');
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /Opción A/ }).id);
  });
});

describe('SEL-10: Enter selecciona la opción activa', () => {
  it('Enter estando abierto llama a onChange con la opción activa y cierra', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select options={OPTIONS} value="a" onChange={onChange} label="Estado" />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    trigger.focus();
    await user.keyboard('{ArrowDown}'); // abre, activa "a"
    await user.keyboard('{ArrowDown}'); // activa "c" (salta "b")

    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('SEL-11: Escape cierra sin cambiar', () => {
  it('Escape cierra el listbox, no llama a onChange y el foco queda en el trigger', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select options={OPTIONS} value="a" onChange={onChange} label="Estado" />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('SEL-12: click afuera cierra', () => {
  it('clickear fuera del componente cierra el listbox sin cambiar el value', () => {
    const onChange = vi.fn();
    render(
      <div>
        <Select options={OPTIONS} value="a" onChange={onChange} label="Estado" />
        <button type="button">afuera</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Estado' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'afuera' }));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SEL-13: disabled', () => {
  it('el trigger queda disabled y clickearlo no abre el listbox', () => {
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Estado" disabled />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    expect(trigger).toBeDisabled();

    fireEvent.click(trigger);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('SEL-14: label visible', () => {
  it('el texto de `label` es el nombre accesible del combobox', () => {
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Prioridad" />);
    expect(screen.getByRole('combobox', { name: 'Prioridad' })).toBeInTheDocument();
    expect(screen.getByText('Prioridad')).toBeInTheDocument();
  });
});

describe('SEL-15: aria-label sin label visible', () => {
  it('da nombre accesible sin renderizar un <label>', () => {
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} aria-label="Prioridad" />);
    expect(screen.getByRole('combobox', { name: 'Prioridad' })).toBeInTheDocument();
    expect(screen.queryByText('Prioridad')).not.toBeInTheDocument();
  });
});

describe('SEL-16: placeholder', () => {
  it('se muestra cuando el value no matchea ninguna opción', () => {
    render(<Select options={OPTIONS} value="zzz" onChange={vi.fn()} label="Estado" placeholder="Elegí una opción…" />);
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveTextContent('Elegí una opción…');
  });
});

describe('SEL-17: el foco no entra al listbox', () => {
  it('el activeElement sigue siendo el trigger durante toda la navegación', async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Estado" />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    trigger.focus();

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Home}{End}');

    expect(document.activeElement).toBe(trigger);
  });
});

describe('SEL-18: controlado, sin estado propio (integración con un caller con estado)', () => {
  function Wrapper() {
    const [value, setValue] = useState('a');
    return <Select options={OPTIONS} value={value} onChange={setValue} label="Estado" />;
  }

  it('refleja el value elegido en el trigger tras seleccionar', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByRole('combobox', { name: 'Estado' }));
    await user.click(screen.getByRole('option', { name: /Opción C/ }));

    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveTextContent('Opción C');
  });
});

describe('FIX-2: la opción activa por teclado se scrollea a la vista', () => {
  it('llama a scrollIntoView({block:"nearest"}) sobre la opción activa al navegar', async () => {
    const scrollSpy = vi.fn();
    // jsdom no implementa scrollIntoView — lo definimos para poder aseverar.
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = scrollSpy;
    try {
      const user = userEvent.setup();
      render(<Select options={MANY} value="" onChange={vi.fn()} label="Estado" />);
      const trigger = screen.getByRole('combobox', { name: 'Estado' });
      trigger.focus();
      await user.keyboard('{ArrowDown}'); // abre, activa la primera
      scrollSpy.mockClear();

      await user.keyboard('{ArrowDown}'); // mueve el activedescendant

      expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest' });
    } finally {
      delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

describe('FIX-3: las teclas manejadas hacen stopPropagation', () => {
  it('Escape con el dropdown abierto NO llega a un listener de keydown del document', async () => {
    const docHandler = vi.fn();
    document.addEventListener('keydown', docHandler);
    try {
      const user = userEvent.setup();
      render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Estado" />);
      const trigger = screen.getByRole('combobox', { name: 'Estado' });
      trigger.focus();
      await user.keyboard('{ArrowDown}'); // abre
      docHandler.mockClear();

      await user.keyboard('{Escape}'); // manejada por el Select → debe detener la burbuja

      expect(docHandler).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', docHandler);
    }
  });
});

describe('FIX-6: click en el label no re-togglea (sin parpadeo close+reopen)', () => {
  it('mousedown en el <label> con el dropdown abierto NO lo cierra', () => {
    render(<Select options={OPTIONS} value="a" onChange={vi.fn()} label="Estado" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Estado' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Antes: el mousedown en el label caía como "click afuera" y cerraba; luego
    // el click del label (htmlFor→button) reabría → parpadeo. El label es parte
    // del componente: un mousedown ahí no debe cerrar.
    fireEvent.mouseDown(screen.getByText('Estado'));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});

describe('SEL-18: estado inválido (aditivo)', () => {
  it('reenvía aria-invalid/aria-describedby al combobox cuando se pasan', () => {
    render(
      <Select
        options={OPTIONS}
        value=""
        onChange={vi.fn()}
        label="Estado"
        aria-invalid
        aria-describedby="estado-error"
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-describedby', 'estado-error');
  });

  it('sin las props NO agrega los atributos (no rompe los usos existentes)', () => {
    render(<Select options={OPTIONS} value="" onChange={vi.fn()} label="Estado" />);
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    expect(trigger).not.toHaveAttribute('aria-invalid');
    expect(trigger).not.toHaveAttribute('aria-describedby');
  });
});
