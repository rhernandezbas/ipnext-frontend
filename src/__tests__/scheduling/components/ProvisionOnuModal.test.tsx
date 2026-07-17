/**
 * smartolt-provision-fe (K2-FE) — modal multi-paso "Aprovisionar ONU".
 *
 * Flujo button-driven con aprobación del dry-run (INNEGOCIABLE):
 *  Paso 1 (picker) → Paso 2 (plan dry-run) → Paso 3 (ejecución real).
 *
 * TODO mockeado a nivel hooks (@/hooks/useFiberProvision) — cero red.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockQuery, mockMutation } from '@/__tests__/_utils/reactQueryMocks';
import type {
  UnconfiguredOnu,
  ProvisionPlanResult,
  ProvisionExecutedResult,
  FiberPppoeSummary,
} from '@/types/fiber';

vi.mock('@/hooks/useFiberProvision', () => ({
  useUnconfiguredOnus: vi.fn(),
  useProvisionOnu: vi.fn(),
}));

import { useUnconfiguredOnus, useProvisionOnu } from '@/hooks/useFiberProvision';
import { ProvisionOnuModal } from '@/pages/scheduling/SchedulingTaskDetailPage/components/ProvisionOnuModal';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const onuHuawei: UnconfiguredOnu = {
  sn: 'HWTC12345678',
  onuTypeName: 'HG8145V5',
  oltId: 'olt-1',
  oltName: 'OLT CENTRO',
  board: '0',
  port: '1',
  ponType: 'gpon',
  huawei: true,
  authorizable: true,
  serviceVlanDefault: 100,
  vlanRequired: false,
};

const onuNoHuawei: UnconfiguredOnu = {
  sn: 'ZTEG87654321',
  onuTypeName: 'F660',
  oltId: 'olt-1',
  oltName: 'OLT CENTRO',
  board: '0',
  port: '2',
  ponType: 'gpon',
  huawei: false,
  authorizable: false,
  serviceVlanDefault: 100,
  vlanRequired: false,
};

// M3 — Huawei detectada pero SmartOLT no ofrece authorize (authorizable:false).
const onuNotAuthorizable: UnconfiguredOnu = {
  sn: 'HWTCFFEE0011',
  onuTypeName: 'HG8145V5',
  oltId: 'olt-1',
  oltName: 'OLT CENTRO',
  board: '0',
  port: '4',
  ponType: 'gpon',
  huawei: true,
  authorizable: false,
  serviceVlanDefault: 100,
  vlanRequired: false,
};

const onuChivilcoy: UnconfiguredOnu = {
  sn: 'HWTCAABBCC01',
  onuTypeName: 'HG8145V5',
  oltId: 'olt-chi',
  oltName: 'CHIVILCOY',
  board: '1',
  port: '3',
  ponType: 'gpon',
  huawei: true,
  authorizable: true,
  serviceVlanDefault: null,
  vlanRequired: true,
};

const planFixture: ProvisionPlanResult = {
  dryRun: true,
  contractId: 'c-1',
  onuSn: 'HWTC12345678',
  vlan: null,
  wifi: { ssid24: 'PEREZ JUAN', ssid5: 'PEREZ JUAN 5G', password: '(se genera al ejecutar)' },
  pppoe: { action: 'generate', username: 'jperez4821' },
  plan: [
    { call: 'GET onu/unconfigured_onus', params: { resolver: 'board/port de HWTC12345678' } },
    { call: 'POST onu/authorize_onu', params: { sn: 'HWTC12345678', vlan: '<default del catálogo>' } },
    { call: 'POST onu/set_onu_mgmt_ip_static_ip/<sn>', params: { vlan: '<mgmtVlan del catálogo>' } },
    { call: 'POST onu/enable_tr069/<sn>', params: { tr069_profile: 'SmartOLT' } },
    { call: 'POST onu/enable_allow_remote_access_to_wan_ip/<sn>', params: {} },
    { call: 'POST onu/set_wifi_port_lan/<sn> (2.4GHz)', params: { ssid: 'PEREZ JUAN' } },
    { call: 'POST onu/set_wifi_port_lan/<sn> (5GHz)', params: { ssid: 'PEREZ JUAN 5G' } },
  ],
};

function executedFixture(pppoe: FiberPppoeSummary, taskUpdated = true): ProvisionExecutedResult {
  return {
    dryRun: false,
    contractId: 'c-1',
    onuSn: 'HWTC12345678',
    olt: { smartoltOltId: 'olt-1', name: 'OLT CENTRO' },
    vlan: 100,
    wifi: { ssid24: 'PEREZ JUAN', ssid5: 'PEREZ JUAN 5G', password: 'clave-wifi-real' },
    pppoe,
    steps: [
      { step: 'authorize', status: 'ok' },
      { step: 'mgmt_ip', status: 'ok' },
      { step: 'tr069', status: 'ok' },
      { step: 'remote_wan', status: 'failed', detail: 'timeout SmartOLT' },
      { step: 'wifi_24', status: 'ok' },
      { step: 'wifi_5', status: 'skipped', detail: 'requiere TR-069 (el paso tr069 no completó)' },
    ],
    taskUpdated,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Mismo criterio que reactQueryMocks: los overrides de función aceptan vi.fn().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

function setupHooks(opts?: {
  onus?: UnconfiguredOnu[];
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  refetch?: AnyFn;
  mutateAsync?: AnyFn;
}) {
  const refetch: AnyFn = opts?.refetch ?? vi.fn().mockResolvedValue({});
  vi.mocked(useUnconfiguredOnus).mockReturnValue(mockQuery({
    data: opts?.isLoading || opts?.isError ? undefined : (opts?.onus ?? [onuHuawei, onuNoHuawei, onuChivilcoy]),
    isLoading: opts?.isLoading ?? false,
    isError: opts?.isError ?? false,
    error: (opts?.error as Error) ?? null,
    refetch,
  }));
  const mutateAsync: AnyFn = opts?.mutateAsync ?? vi.fn().mockImplementation(
    (payload: { dryRun?: boolean }) =>
      Promise.resolve(payload.dryRun ? planFixture : executedFixture({ status: 'created', username: 'jperez4821', password: 'ppp-secreta' })),
  );
  vi.mocked(useProvisionOnu).mockReturnValue(mockMutation({ mutateAsync }));
  return { refetch, mutateAsync };
}

function renderModal(onClose = vi.fn()) {
  render(<ProvisionOnuModal contractId="c-1" onClose={onClose} />);
  return onClose;
}

function apiError(status: number, code: string) {
  return { response: { status, data: { code, error: code } } };
}

/** Avanza al paso 2 (plan) eligiendo la ONU Huawei con VLAN default. */
async function goToPlan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: /HWTC12345678/ }));
  await user.click(screen.getByRole('button', { name: /ver plan/i }));
  await screen.findByRole('button', { name: /ejecutar aprovisionamiento/i });
}

// ── Paso 1: picker ────────────────────────────────────────────────────────────

describe('ProvisionOnuModal — paso 1 (picker)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista las ONUs con sn, tipo, OLT y board/port', () => {
    setupHooks();
    renderModal();
    const row = screen.getByRole('radio', { name: /HWTC12345678/ }).closest('li')!;
    expect(within(row).getByText('HWTC12345678')).toBeInTheDocument();
    expect(within(row).getByText(/HG8145V5/)).toBeInTheDocument();
    expect(within(row).getByText(/OLT CENTRO/)).toBeInTheDocument();
    expect(within(row).getByText(/board 0/i)).toBeInTheDocument();
    expect(within(row).getByText(/port 1/i)).toBeInTheDocument();
  });

  it('las no-Huawei van DESHABILITADAS con el motivo', () => {
    setupHooks();
    renderModal();
    const radio = screen.getByRole('radio', { name: /ZTEG87654321/ });
    expect(radio).toBeDisabled();
    const row = radio.closest('li')!;
    expect(within(row).getByText(/solo huawei se auto-aprovisiona/i)).toBeInTheDocument();
  });

  it('M3: las no autorizables (authorizable:false) van DESHABILITADAS con su motivo', () => {
    setupHooks({ onus: [onuHuawei, onuNotAuthorizable] });
    renderModal();
    const radio = screen.getByRole('radio', { name: /HWTCFFEE0011/ });
    expect(radio).toBeDisabled();
    const row = radio.closest('li')!;
    expect(within(row).getByText(/no autorizable — revisar en smartolt/i)).toBeInTheDocument();
  });

  it('L1: 403 en la lista → el copy menciona network.read (no manage)', () => {
    setupHooks({ isError: true, error: apiError(403, 'FORBIDDEN') });
    renderModal();
    expect(screen.getByRole('alert')).toHaveTextContent(/network\.read/);
  });

  it('estado loading: skeleton accesible', () => {
    setupHooks({ isLoading: true });
    renderModal();
    expect(screen.getByRole('status')).toHaveTextContent(/buscando onus/i);
  });

  it('estado vacío: explica que no hay ONUs detectadas', () => {
    setupHooks({ onus: [] });
    renderModal();
    expect(screen.getByText(/no hay onus sin configurar/i)).toBeInTheDocument();
  });

  it('error de la lista: alert reintentable que llama refetch', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn().mockResolvedValue({});
    setupHooks({ isError: true, error: apiError(502, 'SMARTOLT_UNREACHABLE'), refetch });
    renderModal();
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo contactar a smartolt/i);
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('409 FIBER_PROVISION_DISABLED en la lista: copy humano del flag', () => {
    setupHooks({ isError: true, error: apiError(409, 'FIBER_PROVISION_DISABLED') });
    renderModal();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'El aprovisionamiento automático está apagado — se prende desde el flag fiber-auto-provision',
    );
  });

  it('503 SMARTOLT_NOT_CONFIGURED en la lista: copy humano de envs', () => {
    setupHooks({ isError: true, error: apiError(503, 'SMARTOLT_NOT_CONFIGURED') });
    renderModal();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'SmartOLT no está configurado en el servidor (envs)',
    );
  });

  it('botón refrescar: llama refetch de la lista', async () => {
    const user = userEvent.setup();
    const { refetch } = setupHooks();
    renderModal();
    await user.click(screen.getByRole('button', { name: /refrescar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('ONU con VLAN default: input readonly con opción de override', async () => {
    const user = userEvent.setup();
    setupHooks();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /HWTC12345678/ }));
    const vlanInput = screen.getByLabelText(/vlan de servicio/i);
    expect(vlanInput).toHaveValue(100);
    expect(vlanInput).toHaveAttribute('readonly');
    await user.click(screen.getByRole('button', { name: /cambiar vlan/i }));
    expect(screen.getByLabelText(/vlan de servicio/i)).not.toHaveAttribute('readonly');
  });

  it('ONU vlanRequired (CHIVILCOY): input obligatorio con hint del operador', async () => {
    const user = userEvent.setup();
    setupHooks();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /HWTCAABBCC01/ }));
    const vlanInput = screen.getByLabelText(/vlan de servicio/i);
    expect(vlanInput).not.toHaveAttribute('readonly');
    expect(vlanInput).toBeRequired();
    expect(screen.getByText(/esta olt no tiene vlan default — la elige el operador/i)).toBeInTheDocument();
  });

  it('vlanRequired sin VLAN tipeada: error de validación y NO postea', async () => {
    const user = userEvent.setup();
    const { mutateAsync } = setupHooks();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /HWTCAABBCC01/ }));
    await user.click(screen.getByRole('button', { name: /ver plan/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/ingresá la vlan/i);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('vlan fuera de rango (>4094): error de validación y NO postea', async () => {
    const user = userEvent.setup();
    const { mutateAsync } = setupHooks();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /HWTCAABBCC01/ }));
    await user.type(screen.getByLabelText(/vlan de servicio/i), '5000');
    await user.click(screen.getByRole('button', { name: /ver plan/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/1.*4094/);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('sin ONU elegida el botón de continuar está deshabilitado', () => {
    setupHooks();
    renderModal();
    expect(screen.getByRole('button', { name: /ver plan/i })).toBeDisabled();
  });
});

// ── Paso 2: dry-run / plan ────────────────────────────────────────────────────

describe('ProvisionOnuModal — paso 2 (dry-run)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirmar el picker postea dryRun:true SIN vlan cuando usa la default', async () => {
    const user = userEvent.setup();
    const { mutateAsync } = setupHooks();
    renderModal();
    await goToPlan(user);
    expect(mutateAsync).toHaveBeenCalledWith({
      contractId: 'c-1',
      onuSn: 'HWTC12345678',
      dryRun: true,
    });
  });

  it('override de VLAN viaja explícito en el dry-run', async () => {
    const user = userEvent.setup();
    const { mutateAsync } = setupHooks();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /HWTC12345678/ }));
    await user.click(screen.getByRole('button', { name: /cambiar vlan/i }));
    const input = screen.getByLabelText(/vlan de servicio/i);
    await user.clear(input);
    await user.type(input, '200');
    await user.click(screen.getByRole('button', { name: /ver plan/i }));
    await screen.findByRole('button', { name: /ejecutar aprovisionamiento/i });
    expect(mutateAsync).toHaveBeenCalledWith({
      contractId: 'c-1',
      onuSn: 'HWTC12345678',
      vlan: 200,
      dryRun: true,
    });
  });

  it('vlanRequired viaja con la VLAN tipeada', async () => {
    const user = userEvent.setup();
    const { mutateAsync } = setupHooks();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /HWTCAABBCC01/ }));
    await user.type(screen.getByLabelText(/vlan de servicio/i), '300');
    await user.click(screen.getByRole('button', { name: /ver plan/i }));
    await screen.findByRole('button', { name: /ejecutar aprovisionamiento/i });
    expect(mutateAsync).toHaveBeenCalledWith({
      contractId: 'c-1',
      onuSn: 'HWTCAABBCC01',
      vlan: 300,
      dryRun: true,
    });
  });

  it('renderiza el PLAN completo: los 7 calls con sus params', async () => {
    const user = userEvent.setup();
    setupHooks();
    renderModal();
    await goToPlan(user);
    for (const item of planFixture.plan) {
      expect(screen.getByText(item.call)).toBeInTheDocument();
    }
  });

  it('muestra WiFi (ssid 2.4/5), el placeholder de la clave, el pppoe y la VLAN', async () => {
    const user = userEvent.setup();
    setupHooks();
    renderModal();
    await goToPlan(user);
    expect(screen.getByText('PEREZ JUAN')).toBeInTheDocument();
    expect(screen.getByText('PEREZ JUAN 5G')).toBeInTheDocument();
    expect(screen.getByText('(se genera al ejecutar)')).toBeInTheDocument();
    expect(screen.getByText('jperez4821')).toBeInTheDocument();
    // pppoe.action 'generate' → copy humano
    expect(screen.getByText(/genera credenciales pppoe nuevas/i)).toBeInTheDocument();
    // vlan null → se resuelve del catálogo del OLT al ejecutar (copy propio del
    // dd — distinto del literal '<default del catálogo>' de los params del plan)
    expect(screen.getByText(/se resuelve al ejecutar/i)).toBeInTheDocument();
  });

  it('el botón ejecutar es danger con texto de impacto', async () => {
    const user = userEvent.setup();
    setupHooks();
    renderModal();
    await goToPlan(user);
    expect(screen.getByText(/configura la onu real del cliente/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('Volver regresa al picker CONSERVANDO la selección', async () => {
    const user = userEvent.setup();
    setupHooks();
    renderModal();
    await goToPlan(user);
    await user.click(screen.getByRole('button', { name: /volver/i }));
    expect(screen.getByRole('radio', { name: /HWTC12345678/ })).toBeChecked();
  });

  it('error del dry-run (422 FIBER_VLAN_REQUIRED): alert con copy humano, sigue en el picker', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockRejectedValue(apiError(422, 'FIBER_VLAN_REQUIRED'));
    setupHooks({ mutateAsync });
    renderModal();
    await user.click(screen.getByRole('radio', { name: /HWTC12345678/ }));
    await user.click(screen.getByRole('button', { name: /ver plan/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/no tiene vlan default — ingresá la vlan/i);
    // H2 — el dry-run NO tiene side-effects: jamás asustar con "a medias" acá.
    expect(alert).not.toHaveTextContent(/a medias/i);
    // sigue en el picker, reintentable
    expect(screen.getByRole('button', { name: /ver plan/i })).toBeEnabled();
  });

  it('L2: el dry-run responde con eco dryRun:false → error visible, NO avanza al plan', async () => {
    const user = userEvent.setup();
    // El server contesta como EJECUCIÓN a un pedido de dry-run (eco inesperado).
    const mutateAsync = vi.fn().mockResolvedValue(
      executedFixture({ status: 'existing', username: 'jperez4821' }),
    );
    setupHooks({ mutateAsync });
    renderModal();
    await user.click(screen.getByRole('radio', { name: /HWTC12345678/ }));
    await user.click(screen.getByRole('button', { name: /ver plan/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/respuesta inesperada/i);
    // No hay plan aprobable: no debe existir el botón de ejecutar.
    expect(screen.queryByRole('button', { name: /ejecutar aprovisionamiento/i })).not.toBeInTheDocument();
  });
});

// ── Paso 3: ejecución ─────────────────────────────────────────────────────────

describe('ProvisionOnuModal — paso 3 (ejecución)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function execute(user: ReturnType<typeof userEvent.setup>) {
    await goToPlan(user);
    await user.click(screen.getByRole('button', { name: /ejecutar aprovisionamiento/i }));
  }

  it('ejecutar postea dryRun:false con los mismos params', async () => {
    const user = userEvent.setup();
    const { mutateAsync } = setupHooks();
    renderModal();
    await execute(user);
    expect(mutateAsync).toHaveBeenLastCalledWith({
      contractId: 'c-1',
      onuSn: 'HWTC12345678',
      dryRun: false,
    });
  });

  it('muestra los steps con estado por paso: ok ✓ / failed ✗ / skipped ⊘ con detail', async () => {
    const user = userEvent.setup();
    setupHooks();
    renderModal();
    await execute(user);
    expect(screen.getByTestId('step-authorize')).toHaveTextContent('✓');
    expect(screen.getByTestId('step-remote_wan')).toHaveTextContent('✗');
    expect(screen.getByTestId('step-remote_wan')).toHaveTextContent('timeout SmartOLT');
    expect(screen.getByTestId('step-wifi_5')).toHaveTextContent('⊘');
    expect(screen.getByTestId('step-wifi_5')).toHaveTextContent(/requiere tr-069/i);
  });

  it('WiFi de la ejecución: ssid + password REAL con botón copiar', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setupHooks();
    renderModal();
    await execute(user);
    expect(screen.getByText('clave-wifi-real')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /copiar clave wifi/i }));
    expect(writeText).toHaveBeenCalledWith('clave-wifi-real');
  });

  it('pppoe created: credenciales visibles con botón copiar', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setupHooks();
    renderModal();
    await execute(user);
    expect(screen.getByText('jperez4821')).toBeInTheDocument();
    expect(screen.getByText('ppp-secreta')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /copiar clave pppoe/i }));
    expect(writeText).toHaveBeenCalledWith('ppp-secreta');
  });

  it('pppoe existing: "ya existente" sin clave', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockImplementation((p: { dryRun?: boolean }) =>
      Promise.resolve(p.dryRun ? planFixture : executedFixture({ status: 'existing', username: 'jperez4821' })));
    setupHooks({ mutateAsync });
    renderModal();
    await execute(user);
    expect(screen.getByText(/ya existente/i)).toBeInTheDocument();
    expect(screen.queryByText('ppp-secreta')).not.toBeInTheDocument();
  });

  it.each([
    ['disabled', /usuario previo dado de baja — revisar/i],
    ['pending', /aprovisionamiento previo pendiente/i],
    ['radius-desync', /ya existe en el radius — verificar manualmente/i],
  ] as const)('pppoe stale (%s): advertencia con el reason correcto', async (reason, copy) => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockImplementation((p: { dryRun?: boolean }) =>
      Promise.resolve(p.dryRun ? planFixture : executedFixture({ status: 'stale', username: 'jperez4821', reason })));
    setupHooks({ mutateAsync });
    renderModal();
    await execute(user);
    expect(screen.getByText(copy)).toBeInTheDocument();
  });

  it('pppoe failed y skipped: mensaje explicativo', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockImplementation((p: { dryRun?: boolean }) =>
      Promise.resolve(p.dryRun ? planFixture : executedFixture({ status: 'failed' })));
    setupHooks({ mutateAsync });
    renderModal();
    await execute(user);
    expect(screen.getByText(/pre-provisión pppoe falló/i)).toBeInTheDocument();
  });

  it('taskUpdated true: avisa que el detalle quedó en la descripción de la tarea', async () => {
    const user = userEvent.setup();
    setupHooks();
    renderModal();
    await execute(user);
    expect(screen.getByText(/descripción de la tarea/i)).toBeInTheDocument();
  });

  it('taskUpdated false: advierte que NO se pudo registrar en la tarea', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockImplementation((p: { dryRun?: boolean }) =>
      Promise.resolve(p.dryRun
        ? planFixture
        : executedFixture({ status: 'existing', username: 'jperez4821' }, false)));
    setupHooks({ mutateAsync });
    renderModal();
    await execute(user);
    expect(screen.getByText(/no se pudo registrar/i)).toBeInTheDocument();
  });

  it('doble-click en Ejecutar NO dispara doble provisión (botón deshabilitado en vuelo)', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockImplementation((p: { dryRun?: boolean }) =>
      p.dryRun ? Promise.resolve(planFixture) : new Promise(() => { /* nunca resuelve */ }));
    setupHooks({ mutateAsync });
    renderModal();
    await goToPlan(user);
    const btn = screen.getByRole('button', { name: /ejecutar aprovisionamiento/i });
    await user.click(btn);
    expect(btn).toBeDisabled();
    await user.click(btn);
    // 1 dry-run + 1 ejecución — el segundo click NO postea
    expect(mutateAsync).toHaveBeenCalledTimes(2);
  });

  it('error de la ejecución (409 flag OFF): alert con copy y Ejecutar reintentable', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockImplementation((p: { dryRun?: boolean }) =>
      p.dryRun ? Promise.resolve(planFixture) : Promise.reject(apiError(409, 'FIBER_PROVISION_DISABLED')));
    setupHooks({ mutateAsync });
    renderModal();
    await goToPlan(user);
    await user.click(screen.getByRole('button', { name: /ejecutar aprovisionamiento/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El aprovisionamiento automático está apagado — se prende desde el flag fiber-auto-provision',
    );
    expect(screen.getByRole('button', { name: /ejecutar aprovisionamiento/i })).toBeEnabled();
  });

  it('H2: el error de la ejecución avisa que pudo quedar A MEDIAS (side-effects inciertos)', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockImplementation((p: { dryRun?: boolean }) =>
      p.dryRun ? Promise.resolve(planFixture) : Promise.reject(apiError(502, 'SMARTOLT_UNREACHABLE')));
    setupHooks({ mutateAsync });
    renderModal();
    await goToPlan(user);
    await user.click(screen.getByRole('button', { name: /ejecutar aprovisionamiento/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/pudo quedar a medias/i);
    expect(alert).toHaveTextContent(/verificá el estado real en smartolt antes de reintentar/i);
    // El detalle del código sigue presente
    expect(alert).toHaveTextContent(/no se pudo contactar a smartolt/i);
  });

  it('M2: wifi parcial → banner PARCIAL + estado real junto a cada credencial', async () => {
    const user = userEvent.setup();
    // fixture default: wifi_24 ok, wifi_5 skipped
    setupHooks();
    renderModal();
    await execute(user);
    expect(screen.getByText(/aprovisionamiento parcial/i)).toBeInTheDocument();
    expect(screen.getByTestId('wifi-status-24')).toHaveTextContent('configurada ✓');
    expect(screen.getByTestId('wifi-status-5')).toHaveTextContent(/no configurada/i);
    expect(screen.getByTestId('wifi-status-5')).toHaveTextContent(/configurar manualmente/i);
  });

  it('M2: todos los pasos wifi ok → sin banner parcial y ambas marcadas configuradas', async () => {
    const user = userEvent.setup();
    const allOk: ProvisionExecutedResult = {
      ...executedFixture({ status: 'existing', username: 'jperez4821' }),
      steps: [
        { step: 'authorize', status: 'ok' },
        { step: 'mgmt_ip', status: 'ok' },
        { step: 'tr069', status: 'ok' },
        { step: 'remote_wan', status: 'ok' },
        { step: 'wifi_24', status: 'ok' },
        { step: 'wifi_5', status: 'ok' },
      ],
    };
    const mutateAsync = vi.fn().mockImplementation((p: { dryRun?: boolean }) =>
      Promise.resolve(p.dryRun ? planFixture : allOk));
    setupHooks({ mutateAsync });
    renderModal();
    await execute(user);
    expect(screen.queryByText(/aprovisionamiento parcial/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('wifi-status-24')).toHaveTextContent('configurada ✓');
    expect(screen.getByTestId('wifi-status-5')).toHaveTextContent('configurada ✓');
  });

  it('M5: sin navigator.clipboard NO miente "Copiado" — fallback honesto', async () => {
    const user = userEvent.setup();
    setupHooks();
    // Contexto no seguro: clipboard API ausente y execCommand también falla.
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;
    renderModal();
    await execute(user);
    await user.click(screen.getByRole('button', { name: /copiar clave wifi/i }));
    expect(screen.queryByText('Copiado')).not.toBeInTheDocument();
    expect(screen.getByText(/copiá manualmente/i)).toBeInTheDocument();
  });

  it('M5: fallback execCommand exitoso → confirma Copiado', async () => {
    const user = userEvent.setup();
    setupHooks();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand as unknown as typeof document.execCommand;
    renderModal();
    await execute(user);
    await user.click(screen.getByRole('button', { name: /copiar clave wifi/i }));
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(screen.getByText('Copiado')).toBeInTheDocument();
  });
});
