import type { AdminPermission, HubData } from "./mock-data";
import type { StaffRole } from "./roles";
import type { DiscordSession } from "./session";

function getPermissions(data: HubData, discordUserId?: string) {
  const permissions = new Set<AdminPermission>();
  if (!discordUserId) return permissions;

  for (const grant of data.adminGrants) {
    if (grant.discordUserId !== discordUserId || grant.revokedAt) continue;
    const level = data.adminLevels.find((item) => item.id === grant.adminLevelId);
    level?.permissions.forEach((permission) => permissions.add(permission));
  }

  return permissions;
}

function canSeeDeleted(role: StaffRole | null, permissions: Set<AdminPermission>) {
  return Boolean((role && role.level >= 100) || permissions.has("restore_from_bin") || permissions.has("delete_permanently"));
}

function canSeeAudit(role: StaffRole | null, permissions: Set<AdminPermission>) {
  return Boolean((role && role.level >= 100) || permissions.has("view_audit_logs"));
}

function canSeeActivity(role: StaffRole | null, permissions: Set<AdminPermission>) {
  return Boolean(
    (role && role.level >= 20) ||
    permissions.has("view_staff_activity") ||
    permissions.has("view_corporate_lookup") ||
    permissions.has("manage_activity_logs") ||
    permissions.has("manage_assignments") ||
    permissions.has("manage_activity_slots")
  );
}

function canSeeAllAssignments(role: StaffRole | null, permissions: Set<AdminPermission>) {
  return Boolean((role && role.level >= 40) || permissions.has("view_corporate_lookup") || permissions.has("manage_assignments"));
}

export function filterHubDataForSession(data: HubData, session: DiscordSession | null): HubData {
  const role = session?.role || null;
  const permissions = getPermissions(data, session?.discordUserId);
  const owner = role?.id === "owner";
  const includeDeleted = canSeeDeleted(role, permissions);
  const activeOwnGrants = data.adminGrants.filter((grant) => grant.discordUserId === session?.discordUserId && !grant.revokedAt);
  const ownAdminLevelIds = new Set(activeOwnGrants.map((grant) => grant.adminLevelId));

  if (owner) return data;

  const categories = data.categories
    .filter((category) => includeDeleted || !category.deletedAt)
    .filter((category) => role && category.allowedRoleIds.includes(role.id))
    .map((category) => ({
      ...category,
      links: (category.links || []).filter((link) => includeDeleted || !link.deletedAt),
      resources: category.resources.filter((resource) => includeDeleted || !resource.deletedAt),
    }));

  const weeklyAssignments = data.weeklyAssignments.filter((assignment) => {
    if (!includeDeleted && assignment.deletedAt) return false;
    if (canSeeAllAssignments(role, permissions)) return true;
    return assignment.teamRoleId === role?.id;
  });

  return {
    profiles: session ? data.profiles.filter((profile) => profile.discordUserId === session.discordUserId) : [],
    categories,
    announcements: data.announcements.filter((announcement) => !announcement.deletedAt && role && announcement.allowedRoleIds.includes(role.id)),
    quickLinks: data.quickLinks.filter((link) => includeDeleted || !link.deletedAt),
    activitySlots: data.activitySlots,
    weeklyAssignments,
    activityLogs: canSeeActivity(role, permissions) ? data.activityLogs.filter((log) => includeDeleted || !log.deletedAt) : [],
    activityMinuteEntries: canSeeActivity(role, permissions) ? data.activityMinuteEntries : [],
    adminLevels: owner ? data.adminLevels : data.adminLevels.filter((level) => ownAdminLevelIds.has(level.id)),
    adminGrants: owner ? data.adminGrants : activeOwnGrants,
    auditLogs: canSeeAudit(role, permissions) ? data.auditLogs : [],
  };
}
