import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { IClassSendResultModal } from '@/components/molecules/IClassSendResultModal/IClassSendResultModal';

describe('IClassSendResultModal', () => {
  const onClose = vi.fn();
  const onRetry = vi.fn();
  const onEditTask = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('does not render when closed', () => {
    const { container } = render(
      <IClassSendResultModal open={false} error={null} onClose={onClose} onRetry={onRetry} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when error is null', () => {
    const { container } = render(
      <IClassSendResultModal open error={null} onClose={onClose} onRetry={onRetry} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  describe('MISSING_REQUIRED_FIELDS', () => {
    function setup() {
      return render(
        <IClassSendResultModal
          open
          error={{ code: 'MISSING_REQUIRED_FIELDS', missingFields: ['phone', 'description'] }}
          onClose={onClose}
          onRetry={onRetry}
          onEditTask={onEditTask}
        />,
      );
    }

    it('lists the Spanish labels of the missing fields', () => {
      setup();
      expect(screen.getByText('Teléfono')).toBeInTheDocument();
      expect(screen.getByText('Descripción')).toBeInTheDocument();
    });

    it('shows "Editar tarea" and "Cerrar" buttons', () => {
      setup();
      expect(screen.getByRole('button', { name: 'Editar tarea' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    });

    it('does NOT show "Reintentar" for missing fields', () => {
      setup();
      expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    });

    it('calls onEditTask when "Editar tarea" is clicked', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: 'Editar tarea' }));
      expect(onEditTask).toHaveBeenCalledTimes(1);
    });

    it('falls back to the raw code for an unknown field', () => {
      render(
        <IClassSendResultModal
          open
          error={{ code: 'MISSING_REQUIRED_FIELDS', missingFields: ['foobar'] }}
          onClose={onClose}
          onRetry={onRetry}
        />,
      );
      expect(screen.getByText('foobar')).toBeInTheDocument();
    });
  });

  describe('ICLASS_NODE_NOT_FOUND', () => {
    function setup() {
      return render(
        <IClassSendResultModal
          open
          error={{ code: 'ICLASS_NODE_NOT_FOUND' }}
          onClose={onClose}
          onRetry={onRetry}
        />,
      );
    }

    it('shows a message about the city not matching an IClass node', () => {
      setup();
      expect(screen.getByText(/nodo de IClass/i)).toBeInTheDocument();
    });

    it('shows "Reintentar" and "Cerrar"', () => {
      setup();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    });

    it('calls onRetry when "Reintentar" is clicked', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('ICLASS_UNAVAILABLE', () => {
    function setup() {
      return render(
        <IClassSendResultModal
          open
          error={{ code: 'ICLASS_UNAVAILABLE' }}
          onClose={onClose}
          onRetry={onRetry}
        />,
      );
    }

    it('shows a service-unavailable message', () => {
      setup();
      expect(screen.getByText(/El servicio de IClass no está disponible/i)).toBeInTheDocument();
    });

    it('shows "Reintentar" and "Cerrar"', () => {
      setup();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    });
  });

  describe('ICLASS_REJECTED', () => {
    function setup(reason?: string) {
      return render(
        <IClassSendResultModal
          open
          error={{ code: 'ICLASS_REJECTED', reason }}
          onClose={onClose}
          onRetry={onRetry}
        />,
      );
    }

    it('shows a title about IClass rejecting the order', () => {
      setup('ICLERR_0045: codigoCliente ultrapassou o limite');
      expect(screen.getByText(/rechazó la orden/i)).toBeInTheDocument();
    });

    it('renders the reason detail', () => {
      setup('ICLERR_0045: codigoCliente ultrapassou o limite de caracteres');
      expect(screen.getByText('ICLERR_0045: codigoCliente ultrapassou o limite de caracteres')).toBeInTheDocument();
    });

    it('shows a generic message when reason is empty', () => {
      setup('');
      expect(screen.getByText(/IClass rechazó la orden por un problema en los datos/i)).toBeInTheDocument();
    });

    it('shows "Reintentar" and "Cerrar"', () => {
      setup('whatever');
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    });

    it('calls onRetry when "Reintentar" is clicked', () => {
      setup('whatever');
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('MISSING_PROJECT_FOR_ICLASS', () => {
    function setup() {
      return render(
        <IClassSendResultModal
          open
          error={{ code: 'MISSING_PROJECT_FOR_ICLASS' }}
          onClose={onClose}
          onRetry={onRetry}
          onEditTask={onEditTask}
        />,
      );
    }

    it('shows a title about the task missing a project', () => {
      setup();
      expect(screen.getByText(/no tiene proyecto asignado/i)).toBeInTheDocument();
    });

    it('shows "Editar tarea" and "Cerrar"', () => {
      setup();
      expect(screen.getByRole('button', { name: 'Editar tarea' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    });

    it('does NOT show "Reintentar"', () => {
      setup();
      expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    });

    it('calls onEditTask when "Editar tarea" is clicked', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: 'Editar tarea' }));
      expect(onEditTask).toHaveBeenCalledTimes(1);
    });
  });

  describe('MISSING_ICLASS_MAPPING', () => {
    function setup(projectTitle?: string) {
      return render(
        <IClassSendResultModal
          open
          error={{ code: 'MISSING_ICLASS_MAPPING', projectTitle }}
          onClose={onClose}
          onRetry={onRetry}
        />,
      );
    }

    it('shows a title about the project not being configured for IClass', () => {
      setup('INSTALACION FIBRA');
      expect(screen.getByText(/no está configurado para IClass/i)).toBeInTheDocument();
    });

    it('renders the projectTitle in the body when provided', () => {
      setup('INSTALACION FIBRA');
      expect(screen.getByText(/INSTALACION FIBRA/)).toBeInTheDocument();
    });

    it('still renders a usable body when projectTitle is missing', () => {
      setup(undefined);
      expect(screen.getByText(/administrador/i)).toBeInTheDocument();
    });

    it('only shows "Cerrar" (no Reintentar, no Editar)', () => {
      setup('INSTALACION FIBRA');
      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Editar tarea' })).not.toBeInTheDocument();
    });
  });

  it('calls onClose when "Cerrar" is clicked', () => {
    render(
      <IClassSendResultModal
        open
        error={{ code: 'ICLASS_UNAVAILABLE' }}
        onClose={onClose}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', () => {
    render(
      <IClassSendResultModal
        open
        error={{ code: 'ICLASS_UNAVAILABLE' }}
        onClose={onClose}
        onRetry={onRetry}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
