/**
 * TaskStagesTabPanel — bulk-task-recipients FE (D8, Parte B): panel PRESENTACIONAL
 * del tab "Tarea" de la card "Destinatarios" (`CampaignComposer`). El fetch de
 * `GET /config/task-stages` vive UNA sola vez en el composer (`useTaskStageConfig`)
 * — este panel solo recibe props (mismo criterio que `SegmentBuilder`/
 * `NetworkFilterPanel`: controlado, sin estado propio de selección).
 *
 *  TSP-1 loading → mensaje de carga, sin checkboxes
 *  TSP-2 error → mensaje legible, sin checkboxes
 *  TSP-3 config vacía (sin stages mapeados) → hint accionable, sin checkboxes
 *  TSP-4 con stages mapeados → checkboxes tildables, value refleja lo tildado
 *  TSP-5 tildar/destildar llama onChange con el subset correcto
 *  TSP-6 chip "preview actual" visible cuando hay selección Y previewCount
 *  TSP-7 chip noCustomerCount visible solo si > 0
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { MappedStageDto } from '@/types/taskStageConfig';
import { TaskStagesTabPanel } from '@/pages/whatsapp/BulkMessagingPage/components/composer/TaskStagesTabPanel';

const MAPPED: MappedStageDto[] = [
  { stageId: 's1', stageName: 'Pendiente', stageCode: 'PEND', color: '#111111', workflowId: 'wf1', workflowName: 'Instalaciones' },
  { stageId: 's3', stageName: 'Abierto', stageCode: 'ABIERTO', color: '#333333', workflowId: 'wf2', workflowName: 'Reclamos' },
];

describe('TSP-1: loading', () => {
  it('muestra un mensaje de carga y ningún checkbox', () => {
    render(<TaskStagesTabPanel mappedStages={[]} isLoading isError={false} value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('TSP-2: error', () => {
  it('muestra un mensaje legible y ningún checkbox', () => {
    render(<TaskStagesTabPanel mappedStages={[]} isLoading={false} isError value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('TSP-3: config vacía', () => {
  it('sin estados mapeados, muestra el hint accionable ("Configurá... Ajustes → WhatsApp")', () => {
    render(<TaskStagesTabPanel mappedStages={[]} isLoading={false} isError={false} value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/configur[aá].*ajustes.*whatsapp/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('TSP-4/5: checklist tildable', () => {
  it('renderiza un checkbox por stage mapeado, tildado según `value`', () => {
    render(
      <TaskStagesTabPanel mappedStages={MAPPED} isLoading={false} isError={false} value={['s1']} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('checkbox', { name: /pendiente/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /abierto/i })).not.toBeChecked();
  });

  it('tildar un stage llama onChange con el subset agregado', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TaskStagesTabPanel mappedStages={MAPPED} isLoading={false} isError={false} value={['s1']} onChange={onChange} />,
    );
    await user.click(screen.getByRole('checkbox', { name: /abierto/i }));
    expect(onChange).toHaveBeenCalledWith(['s1', 's3']);
  });

  it('destildar un stage llama onChange con el subset reducido', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TaskStagesTabPanel
        mappedStages={MAPPED}
        isLoading={false}
        isError={false}
        value={['s1', 's3']}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: /pendiente/i }));
    expect(onChange).toHaveBeenCalledWith(['s3']);
  });
});

describe('TSP-6: chip de preview actual', () => {
  it('con selección y previewCount, muestra el total combinado', () => {
    render(
      <TaskStagesTabPanel
        mappedStages={MAPPED}
        isLoading={false}
        isError={false}
        value={['s1']}
        onChange={vi.fn()}
        previewCount={42}
      />,
    );
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('sin selección, no muestra el chip de preview', () => {
    render(
      <TaskStagesTabPanel
        mappedStages={MAPPED}
        isLoading={false}
        isError={false}
        value={[]}
        onChange={vi.fn()}
        previewCount={42}
      />,
    );
    expect(screen.queryByText(/42/)).not.toBeInTheDocument();
  });
});

describe('TSP-7: chip noCustomerCount', () => {
  it('con noCustomerCount > 0, muestra la cuenta de tareas de red sin cliente', () => {
    render(
      <TaskStagesTabPanel
        mappedStages={MAPPED}
        isLoading={false}
        isError={false}
        value={['s1']}
        onChange={vi.fn()}
        noCustomerCount={3}
      />,
    );
    expect(screen.getByText(/3.*tareas de red sin cliente/i)).toBeInTheDocument();
  });

  it('con noCustomerCount 0/ausente, no muestra el chip', () => {
    render(
      <TaskStagesTabPanel mappedStages={MAPPED} isLoading={false} isError={false} value={['s1']} onChange={vi.fn()} noCustomerCount={0} />,
    );
    expect(screen.queryByText(/tareas de red sin cliente/i)).not.toBeInTheDocument();
  });
});
