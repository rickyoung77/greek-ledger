// ── Canonical chapter roles ──────────────────────────────────
// Single source of truth. Every dropdown and permission check imports
// from here so role strings never drift between pages again.
//
// IMPORTANT: these strings must match the admin check in supabase/schema.sql
// (user_is_chapter_admin → role in ('Treasurer','President')). If you add or
// rename a role here, update that function too.

export const ROLES = [
  'Treasurer',
  'President',
  'Vice President',
  'Secretary',
  'Social Chair',
  'Philanthropy Chair',
  'Risk Manager',
  'Member',
]

// Roles that grant full chapter-admin powers (in addition to the chapter
// creator, who is always an admin regardless of role).
export const ADMIN_ROLES = ['Treasurer', 'President']

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role)
}

// Class years used for dues classification + member records.
export const CLASS_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', '5th Year']
