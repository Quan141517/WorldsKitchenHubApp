import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { activitySlots, adminLevels, adminPermissions, activityMinuteEntries, createInitialHubData, teamPermissions, weeklyAssignments, type AchievementBadgeId, type AdminLevel, type AdminPermission, type AuditLog, type HubData, type Resource, type StaffProfile, type TeamPermissionGrant } from "./mock-data";
import type { StaffRoleId } from "./roles";
import type { DiscordSession } from "./session";
import { createSupabaseServerClient, isSupabaseConfigured } from "./supabase";

const dataDirectory = path.join(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "hub-data.json");
const backupDirectory = path.join(dataDirectory, "backups");
const maxBackups = 25;

function canUseLocalDataFiles() {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

async function ensureDataFile() {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeHubData(createInitialHubData());
  }
}

async function readLocalHubData(): Promise<HubData> {
  await ensureDataFile();
  return normalizeHubData(JSON.parse(await readFile(dataFile, "utf8")) as HubData);
}

async function writeLocalHubData(data: HubData) {
  await mkdir(dataDirectory, { recursive: true });
  await backupCurrentDataFile();
  await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}

export async function readHubData(): Promise<HubData> {
  if (!isSupabaseConfigured()) return readLocalHubData();

  try {
    return await readSupabaseHubData();
  } catch (error) {
    if (!canUseLocalDataFiles()) throw error;
    console.warn("Supabase read failed. Falling back to local JSON data.", error);
    return readLocalHubData();
  }
}

export async function writeHubData(data: HubData) {
  if (!isSupabaseConfigured()) {
    await writeLocalHubData(data);
    return;
  }

  try {
    await writeSupabaseHubData(data);
    if (canUseLocalDataFiles()) {
      await writeLocalHubData(data);
    }
  } catch (error) {
    if (!canUseLocalDataFiles()) throw error;
    console.warn("Supabase write failed. Saving to local JSON data instead.", error);
    await writeLocalHubData(data);
  }
}

async function readSupabaseHubData(): Promise<HubData> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hub_state")
    .select("data")
    .eq("id", "main")
    .maybeSingle();

  if (error) throw error;
  if (data?.data) return normalizeHubData(data.data as HubData);

  const initialData = canUseLocalDataFiles() ? await readLocalHubData() : createInitialHubData();
  await writeSupabaseHubData(initialData);
  return initialData;
}

async function writeSupabaseHubData(data: HubData) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("hub_state")
    .upsert({
      id: "main",
      data,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

async function backupCurrentDataFile() {
  try {
    const currentData = await readFile(dataFile, "utf8");
    await mkdir(backupDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(path.join(backupDirectory, `hub-data-${timestamp}.json`), currentData, "utf8");

    const backups = (await readdir(backupDirectory))
      .filter((file) => file.startsWith("hub-data-") && file.endsWith(".json"))
      .sort();

    const oldBackups = backups.slice(0, Math.max(0, backups.length - maxBackups));
    await Promise.all(oldBackups.map((file) => unlink(path.join(backupDirectory, file))));
  } catch {
    // No existing data file yet, or backup cleanup failed. The main write should still continue.
  }
}

export function createSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `resource-${Date.now()}`;
}

function normalizeHubData(data: HubData): HubData {
  return {
    ...data,
    profiles: (data.profiles || []).map((profile) => ({ ...profile, achievementBadges: profile.achievementBadges || [] })),
    categories: (data.categories || []).map((category) => ({
      ...category,
      links: (category.links || []).map((link) => ({
        ...link,
        id: link.id || `${createSlug(link.label)}-${Date.now()}`,
      })),
      resources: category.resources || [],
    })),
    quickLinks: (data.quickLinks || []).map((link) => ({
      ...link,
      id: link.id || `${createSlug(link.label)}-${Date.now()}`,
    })),
    activitySlots: data.activitySlots || activitySlots,
    weeklyAssignments: data.weeklyAssignments || weeklyAssignments,
    activityLogs: data.activityLogs || [],
    activityMinuteEntries: data.activityMinuteEntries || activityMinuteEntries,
    adminLevels: normalizeAdminLevels(data.adminLevels),
    adminGrants: data.adminGrants || [],
    teamPermissions: normalizeTeamPermissions(data.teamPermissions),
    roleOverrides: data.roleOverrides || [],
    auditLogs: data.auditLogs || [],
    auditLogsPaused: data.auditLogsPaused || false,
  };
}

function normalizeTeamPermissions(grants?: TeamPermissionGrant[]) {
  const validPermissions = new Set<AdminPermission>(adminPermissions);
  const byRoleId = new Map<StaffRoleId, TeamPermissionGrant>();

  for (const grant of grants || []) {
    if (grant.roleId === "owner") continue;
    byRoleId.set(grant.roleId, {
      ...grant,
      permissions: (grant.permissions || []).filter((permission): permission is AdminPermission => validPermissions.has(permission as AdminPermission)),
    });
  }

  return teamPermissions.map((defaultGrant) => byRoleId.get(defaultGrant.roleId) || defaultGrant);
}

function normalizeAdminLevels(levels?: AdminLevel[]) {
  const validPermissions = new Set<AdminPermission>(adminPermissions);
  const defaultLevelMap = new Map(adminLevels.map((level) => [level.id, level]));
  const sourceLevels = levels?.length ? levels : adminLevels;

  return sourceLevels.map((level) => {
    const defaultLevel = defaultLevelMap.get(level.id);
    const mergedPermissions = new Set<AdminPermission>([
      ...(defaultLevel?.permissions || []),
      ...(level.permissions || []),
    ].filter((permission): permission is AdminPermission => validPermissions.has(permission as AdminPermission)));

    if (level.id === "owner") {
      return {
        ...level,
        name: level.name || defaultLevel?.name || "Owner",
        permissions: [...adminPermissions],
      };
    }

    return {
      ...level,
      name: level.name || defaultLevel?.name || "Admin Level",
      permissions: [...mergedPermissions],
    };
  });
}

export function getResourceExcerpt(contentHtml: string) {
  return contentHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) || "No preview available yet.";
}

export async function updateHubData(mutator: (data: HubData) => HubData | void) {
  const data = await readHubData();
  const nextData = mutator(data) || data;
  syncAchievementBadges(nextData);
  await writeHubData(nextData);
  return nextData;
}

function syncAchievementBadges(data: HubData) {
  awardTopMinuteBadges(data);
  awardTopLogBadges(data, "training", "most_trainings");
  awardTopLogBadges(data, "shift", "most_shifts");
}

function awardTopMinuteBadges(data: HubData) {
  const totals = new Map<string, { value: number; userId?: string; username: string }>();

  for (const entry of data.activityMinuteEntries || []) {
    const key = entry.robloxUserId || entry.robloxUsername.toLowerCase();
    const current = totals.get(key) || { value: 0, userId: entry.robloxUserId, username: entry.robloxUsername };
    current.value += entry.minutes;
    totals.set(key, current);
  }

  const topValue = Math.max(0, ...Array.from(totals.values()).map((item) => item.value));
  if (!topValue) return;

  for (const winner of totals.values()) {
    if (winner.value !== topValue) continue;
    const profile = data.profiles.find((item) =>
      item.robloxUserId === winner.userId ||
      item.robloxUsername?.toLowerCase() === winner.username.toLowerCase() ||
      item.discordUsername.toLowerCase() === winner.username.toLowerCase()
    );
    if (profile) grantAchievementBadge(profile, "most_minutes", winner.value);
  }
}

function awardTopLogBadges(data: HubData, type: "training" | "shift", badgeId: AchievementBadgeId) {
  const totals = new Map<string, number>();

  for (const log of data.activityLogs || []) {
    if (log.deletedAt || log.type !== type) continue;
    for (const name of getActivityLogNames(log.roles)) {
      const key = name.toLowerCase();
      totals.set(key, (totals.get(key) || 0) + 1);
    }
  }

  const topValue = Math.max(0, ...Array.from(totals.values()));
  if (!topValue) return;

  for (const [name, value] of totals) {
    if (value !== topValue) continue;
    const profile = data.profiles.find((item) =>
      item.robloxUsername?.toLowerCase() === name ||
      item.robloxDisplayName?.toLowerCase() === name ||
      item.discordUsername.toLowerCase() === name
    );
    if (profile) grantAchievementBadge(profile, badgeId, value);
  }
}

function getActivityLogNames(roles: HubData["activityLogs"][number]["roles"]) {
  const values = Object.values(roles).flatMap((value) => Array.isArray(value) ? value : [value]);
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function grantAchievementBadge(profile: StaffProfile, id: AchievementBadgeId, value: number) {
  const badges = profile.achievementBadges || [];
  if (badges.some((badge) => badge.id === id)) {
    profile.achievementBadges = badges;
    return;
  }

  profile.achievementBadges = [...badges, { id, value, awardedAt: new Date().toISOString() }];
}

export function addAuditLog(data: HubData, entry: Omit<AuditLog, "id" | "createdAt">) {
  if (data.auditLogsPaused) return;

  data.auditLogs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  });
}

export function getAdminPermissions(data: HubData, discordUserId?: string) {
  if (!discordUserId) return new Set<AdminPermission>();
  const profile = data.profiles.find((item) => item.discordUserId === discordUserId);
  return getRolePermissions(data, profile?.highestRoleId);
}

export function hasAdminPermission(data: HubData, discordUserId: string | undefined, permission: AdminPermission) {
  return getAdminPermissions(data, discordUserId).has(permission);
}

export function getRolePermissions(data: HubData, roleId?: StaffRoleId | null) {
  if (roleId === "owner") return new Set<AdminPermission>(adminPermissions);
  if (!roleId) return new Set<AdminPermission>();

  const teamGrant = data.teamPermissions.find((grant) => grant.roleId === roleId);
  return new Set<AdminPermission>(teamGrant?.permissions || []);
}

export function hasRolePermission(data: HubData, roleId: StaffRoleId | null | undefined, permission: AdminPermission) {
  return getRolePermissions(data, roleId).has(permission);
}

export function hasSessionPermission(data: HubData, session: DiscordSession | null | undefined, permission: AdminPermission) {
  return hasRolePermission(data, session?.role?.id, permission);
}

export async function upsertStaffProfile(session: DiscordSession) {
  return updateHubData((data) => {
    const now = new Date().toISOString();
    const existing = data.profiles.find((profile) => profile.discordUserId === session.discordUserId);
    const nextProfile: StaffProfile = {
      discordUserId: session.discordUserId,
      discordUsername: session.username,
      avatarUrl: session.avatarUrl,
      highestRoleId: session.role?.id || null,
      discordRoleIds: session.discordRoleIds,
      robloxUserId: session.robloxUserId || existing?.robloxUserId,
      robloxUsername: session.robloxUsername || existing?.robloxUsername,
      robloxDisplayName: session.robloxDisplayName || existing?.robloxDisplayName,
      robloxAvatarUrl: session.robloxAvatarUrl || existing?.robloxAvatarUrl,
      robloxRoleName: session.robloxRoleName || existing?.robloxRoleName,
      robloxRoleRank: session.robloxRoleRank || existing?.robloxRoleRank,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastSeenAt: now,
      achievementBadges: existing?.achievementBadges || [],
    };

    if (existing) {
      Object.assign(existing, nextProfile);
    } else {
      data.profiles.push(nextProfile);
    }

    return data;
  });
}

export function findResource(data: HubData, resourceId: string) {
  for (const category of data.categories) {
    const resource = category.resources.find((item) => item.id === resourceId);
    if (resource) return { category, resource };
  }

  return null;
}

export function createResource(title: string, status: Resource["status"], contentHtml: string, accentColor?: string): Resource {
  return {
    id: `${createSlug(title)}-${Date.now()}`,
    title,
    status,
    accentColor,
    excerpt: getResourceExcerpt(contentHtml),
    contentHtml,
  };
}
