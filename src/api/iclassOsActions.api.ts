import axiosClient from './axios-client';
import type { ScheduledTask } from '@/types/scheduling';

// ── Close OS ─────────────────────────────────────────────────────────────────

export interface CloseIClassOSPayload {
  resultCode: string;
  commentary: string;
  closeDate?: string;
}

// FIX 2: BE returns ScheduledTask directly (no {task} wrapper), aligned with assignIClassTeam.
export const closeIClassOS = (taskId: string, payload: CloseIClassOSPayload) =>
  axiosClient
    .post<ScheduledTask>(`/scheduling/${taskId}/iclass/close`, payload)
    .then(r => r.data);

// ── Assign team ───────────────────────────────────────────────────────────────

export interface AssignIClassTeamPayload {
  teamLogin: string;
}

export const assignIClassTeam = (taskId: string, payload: AssignIClassTeamPayload) =>
  axiosClient
    .post<ScheduledTask>(`/scheduling/${taskId}/iclass/assign-team`, payload)
    .then(r => r.data);
