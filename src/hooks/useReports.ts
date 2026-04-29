import { useQuery, useMutation } from '@tanstack/react-query';
import * as api from '@/api/reports.api';
import type { ReportDefinition, ReportResult } from '@/types/report';

export function useReportDefinitions() {
  return useQuery<ReportDefinition[]>({
    queryKey: ['report-definitions'],
    queryFn: api.getReportDefinitions,
  });
}

export function useGenerateReport() {
  return useMutation<ReportResult, Error, { type: string; filters: Record<string, string> }>({
    mutationFn: ({ type, filters }) => api.generateReport(type, filters),
  });
}

export function useExportReport() {
  return useMutation<Blob, Error, { type: string; filters: Record<string, string> }>({
    mutationFn: ({ type, filters }) => api.exportReport(type, filters),
  });
}
