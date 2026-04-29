import axiosClient from './axios-client';
import type { ReportDefinition, ReportResult } from '@/types/report';

export const getReportDefinitions = () =>
  axiosClient.get<ReportDefinition[]>('/reports').then(r => r.data);

export const generateReport = (type: string, filters: Record<string, string>) =>
  axiosClient.post<ReportResult>('/reports/generate', { type, filters }).then(r => r.data);

export const exportReport = (type: string, filters: Record<string, string>) =>
  axiosClient.post('/reports/export', { type, filters }, { responseType: 'blob' }).then(r => r.data);
