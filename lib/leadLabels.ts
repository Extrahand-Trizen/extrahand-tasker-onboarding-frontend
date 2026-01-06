import type { LeadStatus } from '@/lib/api/caos';

const STATUS_LABELS: Record<LeadStatus, string> = {
  lead_added: 'New Lead',
  contacted: 'Contacted',
  interested: 'Interested',
  documents_submitted: 'Documents Received',
  under_verification: 'Verifying',
  approved: 'Approved',
  account_created: 'Account Created',
  activated: 'Activated',
  rejected: 'Rejected',
  inactive: 'Inactive',
};

export function leadStatusLabel(status: LeadStatus): string {
  return STATUS_LABELS[status] || status;
}




