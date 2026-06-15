/** Wire item of GET /api/admin/iclass/dispatch-preview */
export interface DispatchPreviewRow {
  projectId: string;
  projectTitle: string;
  soType: { code: string; description: string } | null;
  nodeResolution: 'by-customer-city';
  customerCodeSource: 'contractCode-or-customerCode';
  phoneSource: 'customer-phone';
  soCodeSource: 'task-sequence-number';
  initialStatus: 'assigned-by-iclass';
  hardcoded: {
    networkPhone: '0000000000';
    networkCustomerCode: 'NETWORK';
  };
}
