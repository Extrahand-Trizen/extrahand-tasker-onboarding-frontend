export function getUserIdentityIds(user: { userId?: string; uid?: string } | null | undefined): string[] {
  if (!user) return [];
  return Array.from(
    new Set(
      [user.userId, user.uid].filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0
      )
    )
  );
}

export function isLeadCreator(leadAddedBy: string | undefined, identityIds: string[]): boolean {
  if (!leadAddedBy || identityIds.length === 0) return false;
  return identityIds.includes(leadAddedBy);
}

/** Qualifier may edit lead details if they created it or claimed it (pickedBy). */
export function canQualifierEditLead(
  lead: { addedBy: string; pickedBy?: string | null },
  identityIds: string[]
): boolean {
  if (identityIds.length === 0) return false;
  if (isLeadCreator(lead.addedBy, identityIds)) return true;
  return !!lead.pickedBy && identityIds.includes(lead.pickedBy);
}
