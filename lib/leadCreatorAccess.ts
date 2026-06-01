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

/**
 * Any qualifier can edit any lead — regardless of who created or claimed it.
 * The only requirement is that the caller is a valid authenticated qualifier
 * (identityIds must be non-empty).
 */
export function canQualifierEditLead(
  lead: { addedBy: string; pickedBy?: string | null },
  identityIds: string[]
): boolean {
  return identityIds.length > 0;
}
