/**
 * Test entity factory helpers — typed fixtures for commonly tested entities.
 *
 * Each factory returns a complete, valid object matching the production type.
 * Pass only the fields you care about as overrides; defaults are safe no-ops.
 *
 * Pattern mirrors reactQueryMocks.ts: honest shapes, no `as unknown as X` on data.
 */

import type { ScheduledTask } from '@/types/scheduling';
import type { WorkflowStage } from '@/types/workflow';
import type { Ticket } from '@/types/ticket';
import type { GigaredAccount } from '@/types/gigared';
import type { PaginatedResponse } from '@/types/api';
import type { NetworkSite } from '@/types/networkSite';
import type { NasServer } from '@/types/nas';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import type { RbacUserWithRolesDto } from '@/types/rbacUser';
import type { TicketArea } from '@/types/ticketArea';
import { vi } from 'vitest';

// ─── WorkflowStage ───────────────────────────────────────────────────────────

export function makeWorkflowStage(overrides: Partial<WorkflowStage> = {}): WorkflowStage {
  return {
    id: 'stage-1',
    workflowId: 'wf-1',
    name: 'Nuevo',
    code: 'nuevo',
    category: 'nuevo',
    order: 0,
    ...overrides,
  };
}

// ─── ScheduledTask ───────────────────────────────────────────────────────────

export function makeScheduledTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: 'task-1',
    sequenceNumber: 1,
    title: 'Test Task',
    description: null,
    priority: 'normal',
    estimatedHours: 1,
    address: null,
    coordinates: null,
    category: 'installation',
    projectId: null,
    projectName: null,
    completedAt: null,
    notes: null,
    stageId: 'stage-1',
    stageCategory: 'nuevo',
    startDate: null,
    endDate: null,
    customerId: null,
    customerName: null,
    customerCity: null,
    contractId: null,
    partnerId: null,
    reporterId: null,
    assigneeId: null,
    assigneeName: null,
    watcherIds: [],
    travelTimeTo: null,
    travelTimeFrom: null,
    checklist: [],
    generalStatus: 'open',
    reviewedByInventory: false,
    iclassOrderCode: null,
    kind: 'customer',
    networkSiteId: null,
    networkSiteName: null,
    iclassCityCode: null,
    networkType: null,
    archivedAt: null,
    iclassStatus: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── Ticket ──────────────────────────────────────────────────────────────────

export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't-1',
    sequenceNumber: 1,
    subject: 'Test ticket',
    description: '',
    status: 'open',
    priority: 'medium',
    customerId: 'c-1',
    customerName: 'Test Customer',
    contractId: null,
    assigneeId: null,
    assigneeName: null,
    reporterId: null,
    reporterName: null,
    reporter: null,
    areaId: null,
    areaName: null,
    areaColor: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    resolvedAt: null,
    archivedAt: null,
    tags: [],
    ...overrides,
  };
}

// ─── GigaredAccount ──────────────────────────────────────────────────────────

export function makeGigaredAccount(overrides: Partial<GigaredAccount> = {}): GigaredAccount {
  return {
    cic: 'CIC001',
    gigaredId: null,
    email: null,
    firstName: null,
    lastName: null,
    registrationDate: null,
    services: [],
    internalId: null,
    clientId: null,
    ott: null,
    ...overrides,
  };
}

// ─── PaginatedResponse ───────────────────────────────────────────────────────

export function makePaginated<T>(
  items: T[],
  overrides: Partial<PaginatedResponse<T>> = {},
): PaginatedResponse<T> {
  return {
    data: items,
    total: items.length,
    page: 1,
    pageSize: 20,
    totalPages: Math.ceil(items.length / 20) || 1,
    ...overrides,
  };
}

// ─── NetworkSite ─────────────────────────────────────────────────────────────

export function makeNetworkSite(overrides: Partial<NetworkSite> = {}): NetworkSite {
  return {
    id: 'ns-1',
    siteNumber: 1,
    fixedCode: 'NODO 1',
    name: 'Nodo Test',
    address: 'Calle Test 1',
    city: 'Buenos Aires',
    coordinates: null,
    type: 'nodo',
    status: 'active',
    deviceCount: 0,
    clientCount: 0,
    uplink: '',
    parentSiteId: null,
    description: '',
    iclassNodeCode: null,
    uispSiteId: null,
    ...overrides,
  };
}

// ─── NasServer ───────────────────────────────────────────────────────────────

export function makeNasServer(overrides: Partial<NasServer> = {}): NasServer {
  return {
    id: 'nas-1',
    name: 'Test NAS',
    type: 'mikrotik_api',
    ipAddress: '192.168.1.1',
    radiusSecret: 'secret',
    nasIpAddress: '192.168.1.1',
    apiPort: null,
    apiLogin: null,
    apiPassword: null,
    status: 'active',
    lastSeen: null,
    clientCount: 0,
    description: '',
    ...overrides,
  };
}

// ─── UseMyPermissionsResult ──────────────────────────────────────────────────

/**
 * Returns a typed UseMyPermissionsResult mock.
 * `canFn` is the implementation for `can`; defaults to always returning true.
 */
export function mockPermissions(
  overrides: Partial<UseMyPermissionsResult> = {},
): UseMyPermissionsResult {
  return {
    can: vi.fn().mockReturnValue(true) as UseMyPermissionsResult['can'],
    isLoading: false,
    isError: false,
    user: null,
    roles: [],
    permissions: [],
    ...overrides,
  };
}

// ─── RbacUserWithRolesDto ────────────────────────────────────────────────────

export function makeRbacUser(overrides: Partial<RbacUserWithRolesDto> = {}): RbacUserWithRolesDto {
  return {
    id: 'u-1',
    name: 'Test User',
    email: 'test@example.com',
    login: 'testuser',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
    lockedUntil: null,
    roles: [],
    ...overrides,
  };
}

// ─── TicketArea ──────────────────────────────────────────────────────────────

export function makeTicketArea(overrides: Partial<TicketArea> = {}): TicketArea {
  return {
    id: 'area-1',
    name: 'Soporte',
    color: '#3b82f6',
    ...overrides,
  };
}
