export type StaffRoleId =
  | "worlds-kitchen-team"
  | "supervision-team"
  | "management-team"
  | "corporate-team"
  | "human-resources-department"
  | "public-relations-department"
  | "leadership-team"
  | "owner";

export type StaffRole = {
  id: StaffRoleId;
  name: string;
  discordRoleId?: string;
  discordUserId?: string;
  level: number;
};

export const ownerDiscordUserId = "1455543306300948611";

export const staffRoles: StaffRole[] = [
  {
    id: "worlds-kitchen-team",
    name: "World's Kitchen Team",
    discordRoleId: "1452617563996553318",
    level: 10,
  },
  {
    id: "supervision-team",
    name: "Supervision Team",
    discordRoleId: "1452617495507632250",
    level: 20,
  },
  {
    id: "management-team",
    name: "Management Team",
    discordRoleId: "1452617358366736434",
    level: 30,
  },
  {
    id: "corporate-team",
    name: "Corporate Team",
    discordRoleId: "1452617282768474192",
    level: 40,
  },
  {
    id: "leadership-team",
    name: "Leadership Team",
    discordRoleId: "1452617062672240702",
    level: 100,
  },
  {
    id: "owner",
    name: "Owner",
    discordUserId: ownerDiscordUserId,
    level: 999,
  },
];

export function getHighestRole(discordRoleIds: string[], discordUserId?: string) {
  if (discordUserId === ownerDiscordUserId) {
    return staffRoles.find((role) => role.id === "owner")!;
  }

  return staffRoles
    .filter((role) => role.discordRoleId && discordRoleIds.includes(role.discordRoleId))
    .sort((a, b) => b.level - a.level)[0];
}

export function getStaffRoleFromRobloxRank(rank: number | null | undefined) {
  if (!rank) return null;
  if (rank === 255) return staffRoles.find((role) => role.id === "owner") || null;
  if (rank >= 120) return staffRoles.find((role) => role.id === "leadership-team") || null;
  if (rank >= 65) return staffRoles.find((role) => role.id === "corporate-team") || null;
  if (rank >= 45) return staffRoles.find((role) => role.id === "management-team") || null;
  if (rank >= 25) return staffRoles.find((role) => role.id === "supervision-team") || null;
  if (rank >= 5) return staffRoles.find((role) => role.id === "worlds-kitchen-team") || null;
  return null;
}

export function canCreateActivityLogs(role: StaffRole) {
  return role.level >= 30;
}

export function canViewActivityLogs(role: StaffRole) {
  return role.level >= 20;
}

export function canManageAssignments(role: StaffRole) {
  return role.id === "leadership-team" || role.id === "owner";
}
