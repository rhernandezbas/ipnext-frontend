import { DatosForm } from './DatosForm';
import { UbicacionMap } from './UbicacionMap';
import { DescriptionEditor } from './DescriptionEditor';
import { ChecklistSection } from './ChecklistSection';
import type { DatosFormValues } from './DatosForm';
import type { Admin } from '@/types/admin';
import type { Partner } from '@/types/partner';
import type { TaskChecklistItem } from '@/types/scheduling';
import styles from './TaskDetailsTab.module.css';

export interface TaskDetailsTabProps {
  datosForm: {
    initial: DatosFormValues;
    onSubmit: (values: DatosFormValues) => Promise<void>;
    isSaving: boolean;
    admins: Admin[];
    partners: Partner[];
    onDirtyChange?: (isDirty: boolean) => void;
  };
  ubicacionMap: {
    address: string | null;
    coordinates: { lat: number; lng: number } | null;
    onChange: (next: { address: string | null; coordinates: { lat: number; lng: number } | null }) => void;
  };
  descriptionEditor: {
    initialHtml: string | null;
    onSave: (html: string) => Promise<void>;
    isSaving: boolean;
  };
  checklistSection: {
    taskId: string;
    checklist: TaskChecklistItem[];
    onError?: (msg: string) => void;
  };
}

export function TaskDetailsTab({
  datosForm,
  ubicacionMap,
  descriptionEditor,
  checklistSection,
}: TaskDetailsTabProps) {
  return (
    <div className={styles.shell}>
      {/* 1. DESCRIPCIÓN */}
      <DescriptionEditor
        initialHtml={descriptionEditor.initialHtml}
        onSave={descriptionEditor.onSave}
        isSaving={descriptionEditor.isSaving}
      />

      <hr className={styles.divider} />

      {/* 2. DATOS */}
      <DatosForm
        initial={datosForm.initial}
        onSubmit={datosForm.onSubmit}
        isSaving={datosForm.isSaving}
        admins={datosForm.admins}
        partners={datosForm.partners}
        onDirtyChange={datosForm.onDirtyChange}
      />

      <hr className={styles.divider} />

      {/* 3. UBICACIÓN */}
      <UbicacionMap
        address={ubicacionMap.address}
        coordinates={ubicacionMap.coordinates}
        onChange={ubicacionMap.onChange}
      />

      <hr className={styles.divider} />

      {/* 4. LISTA DE VERIFICACIÓN */}
      <ChecklistSection
        taskId={checklistSection.taskId}
        checklist={checklistSection.checklist}
        onError={checklistSection.onError}
      />
    </div>
  );
}
