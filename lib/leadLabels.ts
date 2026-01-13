import type { LeadStatus, AccountStatus } from '@/lib/api/caos';

const STATUS_LABELS: Record<LeadStatus, string> = {
  lead_added: 'New Lead',
  contacted: 'Contacted',
  interested: 'Interested',
  documents_submitted: 'Documents Received',
  under_verification: 'Verifying',
  approved: 'Approved',
  rejected: 'Rejected',
  inactive: 'Inactive',
};

const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  not_created: 'Not Created',
  invited: 'Invited',
  activated: 'Activated',
  suspended: 'Suspended',
};

export function accountStatusLabel(status: AccountStatus): string {
  return ACCOUNT_STATUS_LABELS[status] || status;
}

export function leadStatusLabel(status: LeadStatus): string {
  return STATUS_LABELS[status] || status;
}




