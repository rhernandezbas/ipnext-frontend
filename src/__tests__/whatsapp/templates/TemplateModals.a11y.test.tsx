/**
 * Fixes de a11y del review adversarial (Change 3) — modales del ABM de
 * templates. TDD donde jsdom lo permite (foco + atributos ARIA).
 *
 *  A11Y-1 SubmitTemplateModal: al abrir, el foco entra al diálogo (input de
 *         nombre) — incluso si el template NO trae category (el confirmar
 *         arrancaría disabled → foco al <body>, WCAG 2.4.3)
 *  A11Y-2 SubmitTemplateModal: el Select de category asocia su estado inválido
 *         (aria-invalid + aria-describedby) tras un intento inválido
 *  A11Y-3 DeleteTemplateModal: tras el 409 (blocked) el foco se mueve al
 *         "Cerrar" (no queda huérfano en el <body> por el confirmar disabled)
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SubmitTemplateModal } from '@/pages/whatsapp/WhatsappTemplatesPage/components/SubmitTemplateModal';
import { DeleteTemplateModal } from '@/pages/whatsapp/WhatsappTemplatesPage/components/DeleteTemplateModal';
import type { TemplateInUseError } from '@/hooks/useTemplatesAdmin';
import type { TemplateDetailDto } from '@/types/messagingTemplates';

/** Template SIN category (es opcional en el DTO) — dispara el caso del confirmar disabled. */
const TEMPLATE_NO_CATEGORY: TemplateDetailDto = {
  contentSid: 'HX_nocat',
  friendlyName: 'Aviso sin categoría',
  language: 'es',
  variables: [],
  approvalStatus: 'unsubmitted',
  sendable: false,
  body: 'Hola.',
};

const TEMPLATE_APPROVED: TemplateDetailDto = {
  ...TEMPLATE_NO_CATEGORY,
  contentSid: 'HX_ap',
  friendlyName: 'Recordatorio',
  approvalStatus: 'approved',
  category: 'UTILITY',
  sendable: true,
};

describe('A11Y-1: SubmitTemplateModal — el foco entra al diálogo al abrir', () => {
  it('enfoca el input de nombre (no el confirmar disabled) → el foco NO cae al <body>', () => {
    render(
      <SubmitTemplateModal
        open
        template={TEMPLATE_NO_CATEGORY}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    const nameInput = within(dialog).getByLabelText('Nombre para Meta');
    expect(document.activeElement).toBe(nameInput);
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe('A11Y-2: SubmitTemplateModal — Select de category asocia su estado inválido', () => {
  it('tras un intento inválido, el combobox tiene aria-invalid + aria-describedby al error', async () => {
    const user = userEvent.setup();
    render(
      <SubmitTemplateModal
        open
        template={TEMPLATE_NO_CATEGORY}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    const combobox = within(dialog).getByRole('combobox', { name: /categoría/i });
    expect(combobox).not.toHaveAttribute('aria-invalid', 'true');

    await user.click(within(dialog).getByRole('button', { name: /enviar a aprobación/i }));

    expect(combobox).toHaveAttribute('aria-invalid', 'true');
    expect(combobox).toHaveAttribute('aria-describedby', 'template-submit-category-error');
    expect(within(dialog).getByText('Elegí una categoría.')).toBeInTheDocument();
  });
});

describe('A11Y-3: DeleteTemplateModal — foco al "Cerrar" tras el 409', () => {
  it('cuando aparece el estado blocked, el foco se mueve al botón "Cerrar" (no al <body>)', () => {
    const inUseError: TemplateInUseError = {
      code: 'TEMPLATE_IN_USE',
      message: 'El template está en uso',
      campaignIds: ['camp-1'],
    };
    const { rerender } = render(
      <DeleteTemplateModal open template={TEMPLATE_APPROVED} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    // Simulamos el foco en el confirmar (el usuario acaba de clickear "Borrar").
    const confirmBtn = screen.getByRole('button', { name: /borrar definitivamente/i });
    confirmBtn.focus();

    // Llega el 409 → blocked. El confirmar pasa a disabled; el foco debe ir al Cerrar.
    rerender(
      <DeleteTemplateModal
        open
        template={TEMPLATE_APPROVED}
        inUseError={inUseError}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const closeBtn = screen.getByRole('button', { name: 'Cerrar' });
    expect(document.activeElement).toBe(closeBtn);
    expect(document.activeElement).not.toBe(document.body);
  });
});
