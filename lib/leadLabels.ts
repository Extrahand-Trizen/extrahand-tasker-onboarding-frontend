import type { LeadStatus, AccountStatus } from '@/lib/api/caos';

const STATUS_LABELS: Record<LeadStatus, string> = {
  lead_added: 'New Lead',
  contacted_not_lifted: 'Contacted & Not Lifted',
  contacted_not_interested: 'Contacted & Not Interested',
  contacted_interested: 'Contacted & Interested',
  documents_submitted: 'Documents Received',
  under_verification: 'Verifying',
  approved: 'Approved',
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

const PRIMARY_CATEGORY_LABELS: Record<string, string> = {
  cleaning: 'Cleaning',
  handyperson: 'Handyperson',
  moving: 'Moving & Delivery',
  gardening: 'Gardening',
  business: 'Business Services',
  marketing: 'Marketing & Design',
  tech: 'Tech Support',
  tutoring: 'Tutoring',
  photography: 'Photography',
  beauty: 'Beauty & Wellness',
  'pet-care': 'Pet Care',
  events: 'Events & Entertainment',
  'water-tanker': 'Water & Tanker Services',
  'ac-repair-service': 'AC Repair & Service',
  'security-services': 'Security Services',
  'senior-care': 'Senior Care / Elder Care',
  'driver-chauffeur': 'Driver / Chauffeur Services',
  'cooking-home-chef': 'Cooking / Home Chef',
  'laundry-ironing': 'Laundry & Ironing',
  'auto-electricians': 'Auto Electricians',
  'av-specialist': 'AV Specialist',
  'alteration-services': 'Alteration Services',
  'assembly-services': 'Assembly Services',
  'bakers-services': 'Bakers Services',
  'bicycle-services': 'Bicycle Services',
  'bricklaying-services': 'Bricklaying Services',
  'decking': 'Decking',
  'florist': 'Florist',
  'flooring-services': 'Flooring Services',
  'draftsman': 'Draftsman',
  'gate-installation': 'Gate Installation',
  'home-automation': 'Home Automation',
  'home-theatre-services': 'Home Theatre Services',
  'receptionist-services': 'Receptionist Services',
  'sharpening-services': 'Sharpening Services',
  'writing-services': 'Writing Services',
  'admin-office-services': 'Admin / Office Services',
  'interior-architecture': 'Interior & Architecture',
  'building-construction': 'Building & Construction',
  other: 'Other',
};

export function primaryCategoryLabel(primaryCategory?: string | null): string {
  if (!primaryCategory) return 'Not specified';
  return PRIMARY_CATEGORY_LABELS[primaryCategory] || primaryCategory;
}

export const PRIMARY_CATEGORY_OPTIONS = Object.entries(PRIMARY_CATEGORY_LABELS)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** Display text for primary + optional secondary (e.g. "Water & Tanker Services (General)" when secondary empty for water-tanker) */
export function categoryDisplay(primaryCategory?: string | null, secondaryCategory?: string | null): string {
  const primary = primaryCategoryLabel(primaryCategory);
  if (!primary || primary === 'Not specified') return 'Not specified';
  const secondary = (secondaryCategory ?? '').trim();
  if (secondary) return `${primary} - ${secondary}`;
  if (primaryCategory === 'water-tanker') return `${primary} (General)`;
  return primary;
}


