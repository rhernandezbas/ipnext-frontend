import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssistantProviderCard } from '@/components/settings/AssistantProviderCard';

const useAssistantProvider = vi.fn();
const updateMutateAsync = vi.fn();
const testMutate = vi.fn();
const testReset = vi.fn();
const useTest = vi.fn();

vi.mock('@/hooks/useAssistant', () => ({
  useAssistantProvider: () => useAssistantProvider(),
  useUpdateAssistantProvider: () => ({
    mutateAsync: updateMutateAsync,
    isPending: false,
    isError: false,
  }),
  useTestAssistantProvider: () => useTest(),
}));

/**
 * ai-assistant-multiagent — credenciales del proveedor.
 *
 * Lo que se prueba: que la key **no viva en el navegador** y que el formulario no la pise sin
 * querer. Son las dos formas en que este patrón se rompe en la práctica.
 */

const mockProvider = (data: Record<string, unknown> | null, extra = {}) => {
  useAssistantProvider.mockReturnValue({
    // `effectiveBaseUrl` por default: el backend SIEMPRE lo manda (tiene default en config), y
    // un mock sin él ejercita una forma que en prod no existe. Los tests que la necesitan
    // distinta la pisan al pasarla explícita.
    data: data && { effectiveBaseUrl: 'https://api.deepseek.com', ...data },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...extra,
  });
};

beforeEach(() => {
  useAssistantProvider.mockReset();
  updateMutateAsync.mockReset();
  testMutate.mockReset();
  testReset.mockReset();
  useTest.mockReturnValue({
    mutate: testMutate,
    reset: testReset,
    isPending: false,
    data: undefined,
  });
});

describe('AssistantProviderCard — la key nunca vive en el front', () => {
  it('el input de la key arranca VACÍO aunque haya una guardada', async () => {
    // No hay nada que precargar: el front no tiene la key, sólo sabe que existe.
    mockProvider({ baseUrl: 'https://api.deepseek.com', hasApiKey: true, apiKeyLast4: '9876', source: 'db' });
    render(<AssistantProviderCard />);

    expect(screen.getByLabelText('API key')).toHaveValue('');
  });

  it('muestra sólo los últimos 4, nunca la key', () => {
    mockProvider({ baseUrl: '', hasApiKey: true, apiKeyLast4: '9876', source: 'db' });
    const { container } = render(<AssistantProviderCard />);

    expect(screen.getByText('9876')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/sk-[a-zA-Z0-9]{8,}/);
  });

  it('el campo de la key es de tipo password y sin autocompletado', () => {
    mockProvider({ baseUrl: '', hasApiKey: false, apiKeyLast4: null, source: 'none' });
    render(<AssistantProviderCard />);

    const input = screen.getByLabelText('API key');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });
});

describe('AssistantProviderCard — guardar sin pisar la key', () => {
  it('guardar con el campo vacío NO manda apiKey (el backend preserva la guardada)', async () => {
    mockProvider({ baseUrl: 'https://api.deepseek.com', hasApiKey: true, apiKeyLast4: '9876', source: 'db' });
    render(<AssistantProviderCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    expect(updateMutateAsync.mock.calls[0][0]).not.toHaveProperty('apiKey');
  });

  it('con una key escrita, la manda y limpia el input', async () => {
    mockProvider({ baseUrl: '', hasApiKey: false, apiKeyLast4: null, source: 'none' });
    render(<AssistantProviderCard />);

    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk-nueva-1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'sk-nueva-1234' })),
    );
    // Limpiar el input evita que la key quede en el DOM tras guardar.
    await waitFor(() => expect(screen.getByLabelText('API key')).toHaveValue(''));
  });
});

describe('AssistantProviderCard — estado y prueba de conexión', () => {
  it('sin credencial avisa fuerte y NO deja probar', () => {
    mockProvider({ baseUrl: '', hasApiKey: false, apiKeyLast4: null, source: 'none' });
    render(<AssistantProviderCard />);

    expect(screen.getByText(/Sin credencial/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Probar conexión' })).toBeDisabled();
  });

  it('distingue si la credencial vino del deploy o de la pantalla', () => {
    mockProvider({ baseUrl: '', hasApiKey: true, apiKeyLast4: null, source: 'env' });
    render(<AssistantProviderCard />);

    expect(screen.getByText('Del secret del deploy')).toBeInTheDocument();
    // No se ofrece borrar lo que esta pantalla no administra.
    expect(screen.queryByRole('button', { name: /Borrar credencial/ })).not.toBeInTheDocument();
  });

  it('muestra el resultado exitoso con la latencia', () => {
    mockProvider({ baseUrl: '', hasApiKey: true, apiKeyLast4: '9876', source: 'db' });
    useTest.mockReturnValue({
      mutate: testMutate,
      reset: testReset,
      isPending: false,
      data: { ok: true, detail: 'Conexión OK usando la credencial de esta pantalla.', latencyMs: 820 },
    });
    render(<AssistantProviderCard />);

    expect(screen.getByRole('status')).toHaveTextContent('Conexión OK');
    expect(screen.getByRole('status')).toHaveTextContent('820 ms');
  });

  it('un fallo se anuncia con role=alert y sin filtrar credenciales', () => {
    mockProvider({ baseUrl: '', hasApiKey: true, apiKeyLast4: '9876', source: 'db' });
    useTest.mockReturnValue({
      mutate: testMutate,
      reset: testReset,
      isPending: false,
      data: { ok: false, detail: 'No se pudo contactar al proveedor.', latencyMs: 15000 },
    });
    const { container } = render(<AssistantProviderCard />);

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo contactar');
    expect(container.textContent).not.toMatch(/sk-[a-zA-Z0-9]{8,}/);
  });

  it('borrar la credencial pide confirmación con el impacto explícito', async () => {
    mockProvider({ baseUrl: '', hasApiKey: true, apiKeyLast4: '9876', source: 'db' });
    render(<AssistantProviderCard />);

    fireEvent.click(screen.getByRole('button', { name: /Borrar credencial/ }));

    expect(screen.getByText(/se queda sin poder responder/)).toBeInTheDocument();
    expect(updateMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Sí, borrar/ }));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledWith({ clearApiKey: true }));
  });

  it('rama loading', () => {
    mockProvider(null, { isLoading: true });
    render(<AssistantProviderCard />);

    expect(screen.getByText(/Cargando credenciales/)).toBeInTheDocument();
  });

  it('rama error con reintento', () => {
    mockProvider(null, { isError: true });
    render(<AssistantProviderCard />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });
});

describe('AssistantProviderCard — la URL del deploy no se promueve a la DB', () => {
  it('guardar sin tocar la URL manda la GUARDADA (vacía), no la del deploy', async () => {
    // Si mandara la efectiva, el primer Guardar —aunque sólo se haya tocado la key— escribiría
    // la URL del deploy en la DB. Y como la DB pisa al env, DEEPSEEK_BASE_URL quedaría muerta
    // en silencio para siempre.
    mockProvider({
      baseUrl: '',
      effectiveBaseUrl: 'https://api.deepseek.com',
      hasApiKey: true,
      apiKeyLast4: '9876',
      source: 'db',
    });
    render(<AssistantProviderCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    expect(updateMutateAsync.mock.calls[0][0]).toMatchObject({ baseUrl: '' });
  });

  it('muestra la URL en uso como placeholder, sin meterla en el input', () => {
    // El placeholder tiene que salir de `effectiveBaseUrl`, NO de un default hardcodeado.
    // Por eso el valor de prueba es distinto al default: si el componente hardcodea
    // 'https://api.deepseek.com', este test falla en vez de pasar por coincidencia.
    mockProvider({
      baseUrl: '',
      effectiveBaseUrl: 'https://gateway.del-deploy',
      hasApiKey: true,
      apiKeyLast4: null,
      source: 'env',
    });
    render(<AssistantProviderCard />);

    const input = screen.getByLabelText('URL del proveedor');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'https://gateway.del-deploy');
  });
});

describe('AssistantProviderCard — el resultado de la prueba no sobrevive a un cambio', () => {
  it('guardar limpia el resultado anterior', async () => {
    // Un "Conexión OK" viejo al lado de una credencial nueva afirma algo que nunca se probó.
    mockProvider({
      baseUrl: '',
      effectiveBaseUrl: 'https://api.deepseek.com',
      hasApiKey: true,
      apiKeyLast4: '9876',
      source: 'db',
    });
    useTest.mockReturnValue({
      mutate: testMutate,
      reset: testReset,
      isPending: false,
      data: { ok: true, detail: 'Conexión OK.', latencyMs: 800 },
    });
    render(<AssistantProviderCard />);

    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk-otra-9999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(testReset).toHaveBeenCalled());
  });
});

describe('AssistantProviderCard — borrar la credencial también invalida lo mostrado', () => {
  it('borrar limpia el resultado de la prueba anterior', async () => {
    // Mismo falso verde que al guardar: un "Conexión OK" sobreviviendo al borrado de la
    // credencial que lo produjo.
    mockProvider({
      baseUrl: '',
      effectiveBaseUrl: 'https://api.deepseek.com',
      hasApiKey: true,
      apiKeyLast4: '9876',
      source: 'db',
    });
    useTest.mockReturnValue({
      mutate: testMutate,
      reset: testReset,
      isPending: false,
      data: { ok: true, detail: 'Conexión OK.', latencyMs: 800 },
    });
    render(<AssistantProviderCard />);

    fireEvent.click(screen.getByRole('button', { name: /Borrar credencial/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, borrar/ }));

    await waitFor(() => expect(testReset).toHaveBeenCalled());
  });

  it('editar la key baja el cartel de "guardado" del save anterior', async () => {
    mockProvider({
      baseUrl: '',
      effectiveBaseUrl: 'https://api.deepseek.com',
      hasApiKey: true,
      apiKeyLast4: '9876',
      source: 'db',
    });
    render(<AssistantProviderCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByText('Credenciales guardadas.')).toBeInTheDocument());

    // Con una key nueva a medio escribir, "Credenciales guardadas" afirma algo que ya no aplica.
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk-otra' } });

    expect(screen.queryByText('Credenciales guardadas.')).not.toBeInTheDocument();
  });
});
