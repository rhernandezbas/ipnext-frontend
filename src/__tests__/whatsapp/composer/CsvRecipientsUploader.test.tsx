/**
 * CsvRecipientsUploader (bulk-csv-recipients FE, CSV-FE-4) — uploader de CSV
 * en el composer: parsea client-side (`parseRecipientsCsv`) y muestra el
 * resumen o el rechazo total. Presentacional + estado local del archivo
 * (controlado sólo hacia AFUERA vía `onChange(contacts, fileName)` — molde
 * `ManualRecipientsPicker`/`ImportCsvModal`, `file.text()` + `fireEvent.change`).
 *
 *  CU-1  carga válida: resumen "N destinatarios del archivo" + "M fila(s)
 *        inválida(s)" con detalle expandible línea+motivo
 *  CU-2  rechazo total: role=alert con motivo + línea, NINGÚN contacto sale
 *        (onChange recibe [], null)
 *  CU-3  "Quitar archivo" limpia el estado y llama onChange([], null)
 *  CU-4  un archivo nuevo reemplaza al anterior (onChange con el set nuevo)
 *  CU-5  archivo 100% válido (sin inválidas) no muestra "fila inválida"
 *  CU-6  input asociado a un <label>, accept=".csv,text/csv"
 *  CU-7  M1 (review adversarial) — archivo > 1MB se rechaza por `file.size`
 *        ANTES de `file.text()` (sin cargar el contenido en memoria)
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CsvRecipientsUploader } from '@/pages/whatsapp/BulkMessagingPage/components/composer/CsvRecipientsUploader';

function makeCsvFile(content: string, name = 'destinatarios.csv') {
  return new File([content], name, { type: 'text/csv' });
}

function getFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error('file input no encontrado');
  return input as HTMLInputElement;
}

describe('CU-1: carga válida', () => {
  it('muestra el resumen con destinatarios válidos e inválidos con detalle expandible', async () => {
    const onChange = vi.fn();
    render(<CsvRecipientsUploader onChange={onChange} />);

    const csv = ['nombre;telefono', 'Ana;1123456789', ';1122334455', 'Juan;1122223333'].join('\n');
    fireEvent.change(getFileInput(), { target: { files: [makeCsvFile(csv)] } });

    expect(await screen.findByText(/2 destinatarios del archivo/i)).toBeInTheDocument();
    expect(screen.getByText(/1 fila inválida/i)).toBeInTheDocument();

    // Detalle expandible: línea + motivo.
    const user = userEvent.setup();
    await user.click(screen.getByText(/ver detalle/i));
    expect(screen.getByText(/línea 3/i)).toBeInTheDocument();
    expect(screen.getByText(/sin nombre/i)).toBeInTheDocument();

    expect(onChange).toHaveBeenCalledWith(
      [
        { name: 'Ana', phone: '1123456789' },
        { name: 'Juan', phone: '1122223333' },
      ],
      'destinatarios.csv',
    );
  });
});

describe('CU-2: rechazo total visible', () => {
  it('muestra el error (role=alert, con línea) y NINGÚN contacto sale', async () => {
    const onChange = vi.fn();
    render(<CsvRecipientsUploader onChange={onChange} />);

    const csv = ['nombre;telefono', 'Ana;1123456789;dato-extra'].join('\n');
    fireEvent.change(getFileInput(), { target: { files: [makeCsvFile(csv)] } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/línea 2/i);
    expect(onChange).toHaveBeenCalledWith([], null);
    // No queda ningún resumen de éxito.
    expect(screen.queryByText(/destinatarios del archivo/i)).not.toBeInTheDocument();
  });
});

describe('CU-3: "Quitar archivo"', () => {
  it('limpia el estado y llama onChange([], null)', async () => {
    const onChange = vi.fn();
    render(<CsvRecipientsUploader onChange={onChange} />);

    fireEvent.change(getFileInput(), {
      target: { files: [makeCsvFile('nombre;telefono\nAna;1123456789')] },
    });
    await screen.findByText(/1 destinatario del archivo/i);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /quitar archivo/i }));

    expect(screen.queryByText(/destinatario.*del archivo/i)).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith([], null);
  });
});

describe('CU-4: un archivo nuevo reemplaza al anterior', () => {
  it('el segundo archivo pisa completamente al primero', async () => {
    const onChange = vi.fn();
    render(<CsvRecipientsUploader onChange={onChange} />);

    fireEvent.change(getFileInput(), {
      target: { files: [makeCsvFile('nombre;telefono\nAna;1123456789', 'primero.csv')] },
    });
    await screen.findByText('primero.csv');

    fireEvent.change(getFileInput(), {
      target: { files: [makeCsvFile('nombre;telefono\nJuan;1199998888\nMaria;1177776666', 'segundo.csv')] },
    });

    await screen.findByText('segundo.csv');
    expect(await screen.findByText(/2 destinatarios del archivo/i)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      [
        { name: 'Juan', phone: '1199998888' },
        { name: 'Maria', phone: '1177776666' },
      ],
      'segundo.csv',
    );
  });
});

describe('CU-5: archivo 100% válido', () => {
  it('no muestra la línea de filas inválidas', async () => {
    const onChange = vi.fn();
    render(<CsvRecipientsUploader onChange={onChange} />);

    fireEvent.change(getFileInput(), {
      target: { files: [makeCsvFile('nombre;telefono\nAna;1123456789')] },
    });

    await screen.findByText(/1 destinatario del archivo/i);
    expect(screen.queryByText(/fila inválida/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ver detalle/i)).not.toBeInTheDocument();
  });
});

describe('CU-6: a11y del input', () => {
  it('el input de archivo está asociado a un label y acepta sólo CSV', () => {
    render(<CsvRecipientsUploader onChange={vi.fn()} />);

    const input = getFileInput();
    expect(input).toHaveAttribute('accept', '.csv,text/csv');
    // Asociado por <label for> o aria-labelledby — accesible por rol implícito.
    expect(within(document.body).getByLabelText(/archivo csv/i)).toBe(input);
  });
});

describe('CU-7: archivo > 1MB se rechaza SIN leer el contenido (M1, review adversarial)', () => {
  it('rechaza por file.size antes de llamar file.text() — evita el blowup de memoria', async () => {
    const onChange = vi.fn();
    render(<CsvRecipientsUploader onChange={onChange} />);

    // Contenido chico a propósito (el test NO depende de generar 1MB reales) —
    // se fuerza `file.size` por encima del cap y se espía `file.text` para
    // probar que el guard corta ANTES de leer.
    const file = makeCsvFile('nombre;telefono\nAna;1123456789', 'gigante.csv');
    Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 }); // 2MB > MAX_CSV_BYTES (1MB)
    const textSpy = vi.spyOn(file, 'text');

    fireEvent.change(getFileInput(), { target: { files: [file] } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/1MB/i);
    expect(textSpy).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith([], null);
  });
});
