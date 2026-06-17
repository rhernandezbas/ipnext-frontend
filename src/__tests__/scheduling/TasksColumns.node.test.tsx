/**
 * #124 — Columna "Nodo" en posición 2 en la página "Tareas Nodos".
 *
 * La página Tareas Nodos comparte ALL_TASK_COLUMNS con la página Tareas (general).
 * El catálogo debe incluir 'networkSiteName' en índice 1 (posición 2, justo
 * después de '#'). Ambas páginas usan useVisibleColumns con namespaces distintos
 * ('scheduling-node-tasks-visible-columns' vs 'scheduling-tasks-visible-columns').
 *
 * Reglas que estos tests pinen:
 *  1. 'networkSiteName' está en ALL_TASK_COLUMNS en índice 1.
 *  2. Un usuario nuevo en Tareas Nodos ve 'networkSiteName' en posición 2.
 *  3. Un usuario con orden guardado en Tareas Nodos NO es pisado.
 *  4. En Tareas general, la columna queda excluida del catálogo efectivo
 *     (hiddenColumns la filtra desde TasksPageBase).
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ALL_TASK_COLUMNS } from '@/pages/scheduling/SchedulingTasksPage/components/TasksTableView';
import { useVisibleColumns } from '@/pages/scheduling/SchedulingTasksPage/hooks/useVisibleColumns';

const NODE_STORAGE_KEY = 'scheduling-node-tasks-visible-columns';
const GENERAL_STORAGE_KEY = 'scheduling-tasks-visible-columns';

describe('Scheduling Tasks — columna Nodo (#124)', () => {
  beforeEach(() => window.localStorage.clear());

  // ── 1. Catálogo ──────────────────────────────────────────────────────────

  it('ALL_TASK_COLUMNS tiene networkSiteName en índice 1 (posición 2)', () => {
    const keys = ALL_TASK_COLUMNS.map(c => c.key);
    expect(keys[0]).toBe('sequenceNumber');
    expect(keys[1]).toBe('networkSiteName');
  });

  it('ALL_TASK_COLUMNS tiene label "Nodo" para networkSiteName', () => {
    const col = ALL_TASK_COLUMNS.find(c => c.key === 'networkSiteName');
    expect(col).toBeDefined();
    expect(col?.label).toBe('Nodo');
  });

  // ── 2. Default order para usuario nuevo en Tareas Nodos ──────────────────

  it('usuario nuevo en Tareas Nodos ve networkSiteName en posición 2', () => {
    // Tareas Nodos oculta 'customerName' via hiddenColumns — simulamos el
    // subset que TasksPageBase pasa como defaultVisibleColumns.
    const hiddenInNodePage = new Set(['customerName']);
    const defaults = ALL_TASK_COLUMNS
      .filter(c => !hiddenInNodePage.has(c.key))
      .map(c => c.key);

    const { result } = renderHook(() =>
      useVisibleColumns(defaults, NODE_STORAGE_KEY),
    );

    expect(result.current.visible[0]).toBe('sequenceNumber');
    expect(result.current.visible[1]).toBe('networkSiteName');
  });

  // ── 3. Orden custom guardado en Tareas Nodos no se pisa ──────────────────

  it('orden guardado custom en Tareas Nodos no es pisado por el nuevo default', () => {
    // El usuario tenía un orden previo (sin networkSiteName porque no existía).
    const saved = ['sequenceNumber', 'title', 'stageCategory', 'assigneeName'];
    window.localStorage.setItem(NODE_STORAGE_KEY, JSON.stringify(saved));

    const hiddenInNodePage = new Set(['customerName']);
    const defaults = ALL_TASK_COLUMNS
      .filter(c => !hiddenInNodePage.has(c.key))
      .map(c => c.key);

    const { result } = renderHook(() =>
      useVisibleColumns(defaults, NODE_STORAGE_KEY),
    );

    // El orden guardado se respeta al principio.
    expect(result.current.visible.slice(0, 4)).toEqual(saved);
    // networkSiteName se backfillea al FINAL, no se inyecta en posición 2.
    expect(result.current.visible[1]).not.toBe('networkSiteName');
    expect(result.current.visible).toContain('networkSiteName');
  });

  // ── 4. Tareas general: networkSiteName oculto via hiddenColumns ───────────

  it('en Tareas general, networkSiteName NO está en el conjunto visible por defecto', () => {
    // La página general (SchedulingTasksPage/index.tsx) pasa
    // hiddenColumns={['networkSiteName']} a TasksPageBase, que filtra
    // ALL_TASK_COLUMNS antes de pasarlos a useVisibleColumns.
    const hiddenInGeneralPage = new Set(['networkSiteName']);
    const defaults = ALL_TASK_COLUMNS
      .filter(c => !hiddenInGeneralPage.has(c.key))
      .map(c => c.key);

    const { result } = renderHook(() =>
      useVisibleColumns(defaults, GENERAL_STORAGE_KEY),
    );

    expect(result.current.visible).not.toContain('networkSiteName');
  });
});
