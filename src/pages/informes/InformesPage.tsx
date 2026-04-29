import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReportDefinitions, useGenerateReport, useExportReport } from '@/hooks/useReports';
import type { ReportDefinition, ReportCategory, ReportResult } from '@/types/report';
import styles from './InformesPage.module.css';

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  clients: 'Clientes',
  finance: 'Finanzas',
  network: 'Red',
  scheduling: 'Scheduling',
  voice: 'Voz',
  inventory: 'Inventario',
};

const CATEGORIES: ReportCategory[] = ['clients', 'finance', 'network', 'scheduling', 'voice', 'inventory'];

function InformesContent() {
  const { data: definitions = [] } = useReportDefinitions();
  const generateMutation = useGenerateReport();
  const exportMutation = useExportReport();

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['clients']));
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);

  const selectedDef = definitions.find(d => d.type === selectedType) ?? null;

  function toggleCategory(cat: string) {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function selectReport(def: ReportDefinition) {
    setSelectedType(def.type);
    setFilterValues({});
    setReportResult(null);
  }

  function handleFilterChange(key: string, value: string) {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  }

  async function handleGenerate() {
    if (!selectedDef) return;
    const result = await generateMutation.mutateAsync({ type: selectedDef.type, filters: filterValues });
    setReportResult(result);
  }

  async function handleExport() {
    if (!selectedDef) return;
    const blob = await exportMutation.mutateAsync({ type: selectedDef.type, filters: filterValues });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDef.type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.page}>
      {/* Left sidebar */}
      <aside className={styles.sidebar}>
        <p className={styles.sidebarTitle}>Informes</p>
        {CATEGORIES.map(cat => {
          const catDefs = definitions.filter(d => d.category === cat);
          const isOpen = openCategories.has(cat);
          return (
            <div key={cat} className={styles.categoryGroup}>
              <button
                className={styles.categoryButton}
                onClick={() => toggleCategory(cat)}
                aria-expanded={isOpen}
              >
                <span>{CATEGORY_LABELS[cat]}</span>
                <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>›</span>
              </button>
              {isOpen && (
                <div className={styles.reportList}>
                  {catDefs.map(def => (
                    <button
                      key={def.id}
                      className={`${styles.reportItem} ${selectedType === def.type ? styles.reportItemActive : ''}`}
                      onClick={() => selectReport(def)}
                    >
                      {def.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </aside>

      {/* Right content panel */}
      <main className={styles.content}>
        {!selectedDef ? (
          <div className={styles.emptyState}>
            Seleccioná un informe del menú para comenzar
          </div>
        ) : (
          <>
            <div className={styles.reportHeader}>
              <h1 className={styles.reportTitle}>{selectedDef.name}</h1>
              <p className={styles.reportDescription}>{selectedDef.description}</p>
            </div>

            {/* Filter form */}
            {selectedDef.filters.length > 0 && (
              <div className={styles.filterForm}>
                {selectedDef.filters.map(filter => (
                  <div key={filter.key} className={styles.filterField}>
                    <label className={styles.filterLabel} htmlFor={`filter-${filter.key}`}>
                      {filter.label}
                    </label>
                    {filter.type === 'select' ? (
                      <select
                        id={`filter-${filter.key}`}
                        className={styles.filterInput}
                        value={filterValues[filter.key] ?? ''}
                        onChange={e => handleFilterChange(filter.key, e.target.value)}
                      >
                        <option value="">Seleccioná...</option>
                        {filter.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`filter-${filter.key}`}
                        type={filter.type === 'date' ? 'date' : 'text'}
                        className={styles.filterInput}
                        value={filterValues[filter.key] ?? ''}
                        onChange={e => handleFilterChange(filter.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className={styles.actions}>
              <button
                className={styles.btnPrimary}
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? 'Generando...' : 'Generar informe'}
              </button>
              <button
                className={styles.btnSecondary}
                onClick={handleExport}
                disabled={!reportResult || exportMutation.isPending}
              >
                Exportar CSV
              </button>
            </div>

            {/* Loading state */}
            {generateMutation.isPending && (
              <div className={styles.loadingState}>
                Generando informe...
              </div>
            )}

            {/* Results table */}
            {reportResult && !generateMutation.isPending && (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      {reportResult.columns.map(col => (
                        <th key={col.key} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportResult.rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        {reportResult.columns.map(col => (
                          <td key={col.key} style={{ padding: '8px 12px', color: '#374151' }}>
                            {row[col.key] === null || row[col.key] === undefined ? '—' : String(row[col.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const qc = new QueryClient();

export default function InformesPage() {
  return (
    <QueryClientProvider client={qc}>
      <InformesContent />
    </QueryClientProvider>
  );
}
