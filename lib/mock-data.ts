import type { StaffRoleId } from "./roles";

export type Category = {
  id: string;
  name: string;
  allowedRoleIds: StaffRoleId[];
  resources: Resource[];
  links?: QuickLink[];
  deletedAt?: string;
  deletedBy?: string;
};

export type Resource = {
  id: string;
  title: string;
  status: "draft" | "published";
  pinned?: boolean;
  needsReview?: boolean;
  accentColor?: string;
  excerpt: string;
  contentHtml: string;
  deletedAt?: string;
  deletedBy?: string;
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published";
  accentColor?: string;
  allowedRoleIds: StaffRoleId[];
  deletedAt?: string;
  deletedBy?: string;
};

export type QuickLink = {
  id: string;
  label: string;
  url: string;
  deletedAt?: string;
  deletedBy?: string;
};

export type AuditLog = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  type: "documents" | "categories" | "links" | "announcements" | "admins" | "activity" | "bin";
  createdAt: string;
};

export type StaffProfile = {
  discordUserId: string;
  discordUsername: string;
  avatarUrl: string | null;
  highestRoleId: StaffRoleId | null;
  discordRoleIds: string[];
  robloxUserId?: string;
  robloxUsername?: string;
  robloxDisplayName?: string;
  robloxAvatarUrl?: string | null;
  robloxRoleName?: string;
  robloxRoleRank?: number;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
};

export type WeeklyAssignment = {
  id: string;
  teamRoleId: StaffRoleId;
  sessions: number;
  minutes: number;
  shifts: number;
  effectiveFrom: string;
  createdAt: string;
  createdBy: string;
  deletedAt?: string;
  deletedBy?: string;
};

export type ActivitySlots = {
  trainings: string[];
  shifts: string[];
};

export type TrainingRoles = {
  logger: string;
  host: string;
  coHost?: string;
  overseers: string[];
  trainerA?: string;
  assistantsA: string[];
  trainerB?: string;
  assistantsB: string[];
  trainerC?: string;
  assistantsC: string[];
};

export type ShiftRoles = {
  logger: string;
  host: string;
  coHost?: string;
  attendees: string[];
};

export type ActivityLog = {
  id: string;
  type: "training" | "shift";
  dateLabel: string;
  time: string;
  serverNumber: number;
  loggerDiscordUserId: string;
  loggerUsername: string;
  roles: TrainingRoles | ShiftRoles;
  notes: string;
  creditedMinutes?: number;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
};

export type ActivityMinuteEntry = {
  id: string;
  robloxUserId: string;
  robloxUsername: string;
  minutes: number;
  placeId?: string;
  universeId?: string;
  recordedAt: string;
};

export type AdminPermission =
  | "create_resources"
  | "edit_resources"
  | "move_resources_to_bin"
  | "restore_from_bin"
  | "delete_permanently"
  | "create_announcements"
  | "delete_announcements"
  | "view_audit_logs"
  | "manage_activity_logs"
  | "manage_category_links"
  | "manage_assignments"
  | "manage_categories"
  | "manage_home_links"
  | "manage_admin_levels"
  | "manage_admin_grants"
  | "manage_activity_slots"
  | "view_recovery_bin"
  | "manage_recovery_bin"
  | "view_staff_activity"
  | "view_corporate_lookup";

export const adminPermissions: AdminPermission[] = [
  "create_resources",
  "edit_resources",
  "move_resources_to_bin",
  "restore_from_bin",
  "delete_permanently",
  "create_announcements",
  "delete_announcements",
  "view_audit_logs",
  "manage_activity_logs",
  "manage_category_links",
  "manage_assignments",
  "manage_categories",
  "manage_home_links",
  "manage_admin_levels",
  "manage_admin_grants",
  "manage_activity_slots",
  "view_recovery_bin",
  "manage_recovery_bin",
  "view_staff_activity",
  "view_corporate_lookup",
];

export type AdminLevel = {
  id: string;
  name: string;
  permissions: AdminPermission[];
};

export type AdminGrant = {
  id: string;
  discordUserId: string;
  adminLevelId: string;
  grantedBy: string;
  createdAt: string;
  revokedAt?: string;
  revokedBy?: string;
};

export type HubData = {
  profiles: StaffProfile[];
  categories: Category[];
  announcements: Announcement[];
  quickLinks: QuickLink[];
  activitySlots: ActivitySlots;
  weeklyAssignments: WeeklyAssignment[];
  activityLogs: ActivityLog[];
  activityMinuteEntries: ActivityMinuteEntry[];
  adminLevels: AdminLevel[];
  adminGrants: AdminGrant[];
  auditLogs: AuditLog[];
  auditLogsPaused?: boolean;
};

export const categories: Category[] = [
  {
    id: "basic-information",
    name: "Basic Information",
    allowedRoleIds: ["worlds-kitchen-team", "supervision-team", "management-team", "corporate-team", "leadership-team", "owner"],
    resources: [
      {
        id: "welcome-guide",
        title: "Welcome Guide",
        status: "published",
        excerpt: "A short introduction for staff members joining World's Kitchen.",
        contentHtml: "<h2>Welcome to World's Kitchen</h2><p>This guide will introduce the expectations, staff conduct, and important links for working with us.</p><h3>Getting Started</h3><p>Use the Hub to find official resources and announcements. Confidential documents should stay inside the Hub.</p>",
      },
    ],
  },
  {
    id: "supervision-resources",
    name: "Supervision Resources",
    allowedRoleIds: ["supervision-team", "management-team", "corporate-team", "leadership-team", "owner"],
    resources: [],
  },
  {
    id: "management-resources",
    name: "Management Resources",
    allowedRoleIds: ["management-team", "corporate-team", "leadership-team", "owner"],
    resources: [
      {
        id: "management-handbook",
        title: "Management Handbook",
        status: "draft",
        pinned: true,
        excerpt: "Draft placeholder for leadership-written management procedures.",
        contentHtml: "<h2>Management Handbook</h2><p>This handbook is a draft space for management procedures, expectations, and internal standards.</p><h3>Responsibilities</h3><p>Managers are expected to supervise operations, support lower ranks, and keep internal information private.</p>",
      },
      {
        id: "punishment-guide",
        title: "Punishment Guide",
        status: "draft",
        needsReview: true,
        excerpt: "Draft placeholder for internal moderation and punishment guidance.",
        contentHtml: "<h2>Punishment Guide</h2><p>This guide will hold internal rules for moderation decisions, escalation, and documentation.</p><h3>Review Needed</h3><p>Leadership should review this page before it is treated as official.</p>",
      },
    ],
  },
  {
    id: "corporate-resources",
    name: "Corporate Resources",
    allowedRoleIds: ["corporate-team", "leadership-team", "owner"],
    resources: [],
  },
  {
    id: "leadership-information",
    name: "Leadership Information",
    allowedRoleIds: ["leadership-team", "owner"],
    resources: [],
  },
];

export const announcements: Announcement[] = [
  {
    id: "layout-finished",
    title: "Base layout complete",
    content: "The Hub layout is ready. We are now connecting real login, permissions, and saved data.",
    status: "published",
    allowedRoleIds: ["leadership-team", "owner"],
  },
];

export const quickLinks: QuickLink[] = [
  {
    id: "discord-server",
    label: "Discord Server",
    url: "https://discord.com/channels/1452614312798584852/1452805570254999745",
  },
  {
    id: "roblox-group",
    label: "Roblox Group",
    url: "https://www.roblox.com",
  },
];

export const activitySlots: ActivitySlots = {
  trainings: ["7:00 PM EST", "8:00 PM EST", "9:00 PM EST", "10:00 PM EST", "11:00 PM EST"],
  shifts: ["6:00 PM EST", "8:00 PM EST", "10:00 PM EST"],
};

export const weeklyAssignments: WeeklyAssignment[] = [
  {
    id: "management-default",
    teamRoleId: "management-team",
    sessions: 2,
    minutes: 60,
    shifts: 1,
    effectiveFrom: "2026-06-15",
    createdAt: "2026-06-15T00:00:00.000Z",
    createdBy: "System",
  },
  {
    id: "supervision-default",
    teamRoleId: "supervision-team",
    sessions: 2,
    minutes: 60,
    shifts: 0,
    effectiveFrom: "2026-06-15",
    createdAt: "2026-06-15T00:00:00.000Z",
    createdBy: "System",
  },
  {
    id: "corporate-default",
    teamRoleId: "corporate-team",
    sessions: 0,
    minutes: 75,
    shifts: 1,
    effectiveFrom: "2026-06-15",
    createdAt: "2026-06-15T00:00:00.000Z",
    createdBy: "System",
  },
];

export const activityLogs: ActivityLog[] = [];
export const activityMinuteEntries: ActivityMinuteEntry[] = [];

export const adminLevels: AdminLevel[] = [
  {
    id: "leadership-editor",
    name: "Leadership Editor",
    permissions: [
      "create_resources",
      "edit_resources",
      "move_resources_to_bin",
      "create_announcements",
      "delete_announcements",
      "view_audit_logs",
      "manage_activity_logs",
      "manage_category_links",
      "view_staff_activity",
      "view_corporate_lookup",
      "view_recovery_bin",
    ],
  },
  {
    id: "operations-admin",
    name: "Operations Admin",
    permissions: [
      "create_resources",
      "edit_resources",
      "move_resources_to_bin",
      "restore_from_bin",
      "create_announcements",
      "delete_announcements",
      "view_audit_logs",
      "manage_activity_logs",
      "manage_category_links",
      "manage_assignments",
      "manage_activity_slots",
      "view_staff_activity",
      "view_corporate_lookup",
      "view_recovery_bin",
      "manage_recovery_bin",
    ],
  },
  {
    id: "owner",
    name: "Owner",
    permissions: adminPermissions,
  },
];

export const adminGrants: AdminGrant[] = [];

export function createInitialHubData(): HubData {
  return {
    profiles: [],
    categories,
    announcements,
    quickLinks,
    activitySlots,
    weeklyAssignments,
    activityLogs,
    activityMinuteEntries,
    adminLevels,
    adminGrants,
    auditLogs: [],
  };
}
