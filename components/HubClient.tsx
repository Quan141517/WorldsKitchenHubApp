"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { activitySlots, adminPermissions, type ActivityLog, type ActivityMinuteEntry, type ActivitySlots, type AdminGrant, type AdminLevel, type AdminPermission, type AuditLog, type Category, type HubData, type QuickLink, type Resource, type ShiftRoles, type StaffProfile, type TrainingRoles, type WeeklyAssignment } from "@/lib/mock-data";
import { staffRoles, type StaffRole, type StaffRoleId } from "@/lib/roles";
import type { DiscordSession } from "@/lib/session";

type HubView = "home" | "category" | "reader" | "staff-activity" | "bin" | "audit" | "admin";
type ActivityTab = "my" | "lookup" | "logs" | "assignments" | "leaders";
type ActivityLogPayload = { type: "training" | "shift"; dateLabel: string; time: string; roles: TrainingRoles | ShiftRoles; notes: string; creditedMinutes?: number };
type ActivityLogUpdatePayload = { roles: TrainingRoles | ShiftRoles; notes: string; creditedMinutes?: number };
type RobloxSuggestion = { userId: string; username: string; displayName: string; avatarUrl: string | null; source: string; roleName?: string; roleRank?: number };

const robloxSuggestionCache = new Map<string, RobloxSuggestion[]>();

function getTodayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildRecentWeeks(count = 8) {
  const currentWeekStart = startOfWeek(getTodayDate());
  return Array.from({ length: count }, (_, index) => {
    const start = addDays(currentWeekStart, index * -7);
    const end = addDays(start, 7);
    return {
      start,
      end,
      range: `${formatShortDate(start)} - ${formatShortDate(end)}`,
    };
  });
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatHeadingDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function sameDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function isBeforeDay(first: Date, second: Date) {
  return new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime() < new Date(second.getFullYear(), second.getMonth(), second.getDate()).getTime();
}

function isAfterDay(first: Date, second: Date) {
  return new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime() > new Date(second.getFullYear(), second.getMonth(), second.getDate()).getTime();
}

function getEasternMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value || "0");
  return hour * 60 + minute;
}

function getSlotMinutes(slotLabel: string) {
  const inputValue = timeLabelToInputValue(slotLabel);
  const [hour, minute] = inputValue.split(":").map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function getSlotStatusLabel(selectedDate: Date, slotLabel: string) {
  const today = getTodayDate();
  if (isBeforeDay(selectedDate, today)) return "Happened";
  if (isAfterDay(selectedDate, today)) return "Scheduled";

  const diff = getSlotMinutes(slotLabel) - getEasternMinutesNow();
  if (diff > 0) {
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `Starts in ${hours ? `${hours}h ` : ""}${minutes}m`;
  }
  if (diff > -60) return "Happening";
  return "Happened";
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function isDateInRange(value: string, start: Date, end: Date) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= start && date < end;
}

function logIsInRange(log: ActivityLog, start: Date, end: Date) {
  return isDateInRange(log.dateLabel, start, end);
}

function sumTrackedMinutes(entries: ActivityMinuteEntry[], names: string[], start: Date, end: Date, robloxUserId?: string) {
  const normalizedNames = names.map((name) => name.toLowerCase()).filter(Boolean);
  return entries
    .filter((entry) => isDateInRange(entry.recordedAt, start, end))
    .filter((entry) => normalizedNames.includes(entry.robloxUsername.toLowerCase()) || (robloxUserId && entry.robloxUserId === robloxUserId))
    .reduce((total, entry) => total + entry.minutes, 0);
}

async function getRobloxSuggestions(query: string) {
  const key = query.trim().toLowerCase();
  if (robloxSuggestionCache.has(key)) return robloxSuggestionCache.get(key)!;

  const response = await fetch(`/api/roblox/users?q=${encodeURIComponent(key)}`);
  if (!response.ok) return [];

  const result = (await response.json()) as { users: RobloxSuggestion[] };
  const users = result.users || [];
  robloxSuggestionCache.set(key, users);
  return users;
}

function findExactSuggestion(users: RobloxSuggestion[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;
  return users.find((user) => user.username.toLowerCase() === normalizedQuery || user.displayName.toLowerCase() === normalizedQuery) || null;
}

function canSee(role: StaffRole | null, allowedRoleIds: string[]) {
  if (!role) return false;
  return allowedRoleIds.includes(role.id);
}

function canManageContent(role: StaffRole | null, adminPermissions?: Set<AdminPermission>) {
  return Boolean((role && role.level >= 100) || adminPermissions?.has("create_resources") || adminPermissions?.has("edit_resources"));
}

function canViewStaffActivity(role: StaffRole | null) {
  return Boolean(role && role.level >= 20);
}

function canCreateActivityLogs(role: StaffRole | null) {
  return Boolean(role && role.level >= 30);
}

function canViewAssignments(role: StaffRole | null) {
  return Boolean(role && role.level >= 40);
}

function canViewAdminTools(role: StaffRole | null) {
  return Boolean(role && role.id === "owner");
}

function getSessionAdminPermissions(data: HubData, discordUserId: string) {
  const permissions = new Set<AdminPermission>();
  const activeGrants = data.adminGrants.filter((grant) => grant.discordUserId === discordUserId && !grant.revokedAt);

  for (const grant of activeGrants) {
    const level = data.adminLevels.find((item) => item.id === grant.adminLevelId);
    level?.permissions.forEach((permission) => permissions.add(permission));
  }

  return permissions;
}

const leaderboards = [
  ["Minutes", "SamuelWK", "248 min", "#4 - 176 min"],
  ["Trainings", "LucaHost", "9 logs", "#2 - 7 logs"],
  ["Shifts", "AveryHR", "5 logs", "#3 - 4 logs"],
] as const;

const cardAccentOptions = [
  ["", "Neutral"],
  ["purple", "Soft Purple"],
  ["green", "Fresh Green"],
  ["blue", "Sky Blue"],
  ["gold", "Warm Gold"],
  ["rose", "Soft Rose"],
] as const;

const robloxRankRanges: Array<{ roleId: StaffRoleId; min: number; max: number }> = [
  { roleId: "worlds-kitchen-team", min: 5, max: 20 },
  { roleId: "supervision-team", min: 25, max: 40 },
  { roleId: "management-team", min: 45, max: 60 },
  { roleId: "corporate-team", min: 65, max: 80 },
  { roleId: "leadership-team", min: 120, max: 255 },
  { roleId: "owner", min: 255, max: 255 },
];

const adminPermissionLabels: Record<AdminPermission, string> = {
  create_resources: "Create resources",
  edit_resources: "Edit resources",
  move_resources_to_bin: "Move resources to bin",
  restore_from_bin: "Restore from bin",
  delete_permanently: "Delete permanently",
  create_announcements: "Create announcements",
  delete_announcements: "Delete announcements",
  view_audit_logs: "View audit logs",
  manage_activity_logs: "Manage activity logs",
  manage_category_links: "Manage category links",
  manage_assignments: "Manage assignments",
  manage_categories: "Manage categories",
  manage_home_links: "Manage home links",
  manage_admin_levels: "Manage admin levels",
  manage_admin_grants: "Grant admin levels",
  manage_activity_slots: "Manage activity slots",
  view_recovery_bin: "View recovery bin",
  manage_recovery_bin: "Manage recovery bin",
  view_staff_activity: "View staff activity",
  view_corporate_lookup: "Use corporate lookup",
};

const adminPermissionKeys = adminPermissions;

export function HubClient({ session: initialSession, initialData }: { session: DiscordSession; initialData: HubData }) {
  const [session, setSession] = useState<DiscordSession>(initialSession);
  const sessionRole = session.role;
  const [previewRoleId, setPreviewRoleId] = useState<StaffRoleId | "">("");
  const [previewDiscordUserId, setPreviewDiscordUserId] = useState("");
  const role = sessionRole?.id === "owner" && previewRoleId ? staffRoles.find((staffRole) => staffRole.id === previewRoleId) || sessionRole : sessionRole;
  const [hubData, setHubData] = useState<HubData>(initialData);
  const [editorState, setEditorState] = useState<{ categoryId: string; resourceId: string | null } | null>(null);
  const [categoryEditorState, setCategoryEditorState] = useState<{ categoryId: string | null } | null>(null);
  const [categoryLinkManagerState, setCategoryLinkManagerState] = useState<{ categoryId: string } | null>(null);
  const [announcementEditorOpen, setAnnouncementEditorOpen] = useState(false);
  const [linkManagerOpen, setLinkManagerOpen] = useState(false);
  const visibleCategories = useMemo(() => hubData.categories.filter((category) => !category.deletedAt && canSee(role, category.allowedRoleIds)), [hubData.categories, role]);
  const visibleAnnouncements = useMemo(() => hubData.announcements.filter((announcement) => !announcement.deletedAt && canSee(role, announcement.allowedRoleIds)), [hubData.announcements, role]);
  const visibleQuickLinks = useMemo(() => hubData.quickLinks.filter((link) => !link.deletedAt), [hubData.quickLinks]);
  const adminPermissionSet = useMemo(() => getSessionAdminPermissions(hubData, session.discordUserId), [hubData, session.discordUserId]);
  const previewAdminPermissionSet = useMemo(() => getSessionAdminPermissions(hubData, previewDiscordUserId.trim()), [hubData, previewDiscordUserId]);
  const isPreviewingNonOwner = Boolean(sessionRole?.id === "owner" && previewRoleId && previewRoleId !== "owner");
  const effectiveAdminPermissionSet = useMemo(() => {
    if (sessionRole?.id === "owner" && previewDiscordUserId.trim()) return previewAdminPermissionSet;
    return isPreviewingNonOwner ? new Set<AdminPermission>() : adminPermissionSet;
  }, [adminPermissionSet, isPreviewingNonOwner, previewAdminPermissionSet, previewDiscordUserId, sessionRole?.id]);
  const currentProfile = hubData.profiles.find((profile) => profile.discordUserId === session.discordUserId);
  const activitySession = useMemo<DiscordSession>(() => {
    if (!isPreviewingNonOwner) return { ...session, username: currentProfile?.robloxUsername || session.username };
    return {
      ...session,
      discordUserId: previewDiscordUserId.trim() || "__preview_user__",
      username: previewDiscordUserId.trim() ? `Preview ${previewDiscordUserId.trim()}` : `Preview ${role?.name || "User"}`,
      avatarUrl: null,
    };
  }, [currentProfile?.robloxUsername, isPreviewingNonOwner, previewDiscordUserId, role?.name, session]);
  const [activeView, setActiveView] = useState<HubView>("home");
  const [activeCategoryId, setActiveCategoryId] = useState(visibleCategories[0]?.id || "");
  const [activeResourceId, setActiveResourceId] = useState("");
  const [activityTab, setActivityTab] = useState<ActivityTab>("my");
  const canCopyProtectedContent = Boolean(role && role.level >= 100);
  const copyProtected = Boolean(role && !canCopyProtectedContent);
  const activeCategory = visibleCategories.find((category) => category.id === activeCategoryId) || visibleCategories[0];
  const activeResources = activeCategory?.resources.filter((resource) => !resource.deletedAt) || [];
  const activeCategoryLinks = activeCategory?.links?.filter((link) => !link.deletedAt) || [];
  const activeResource = activeResources.find((resource) => resource.id === activeResourceId);
  const deletedCategories = hubData.categories.filter((category) => category.deletedAt);
  const deletedAssignments = hubData.weeklyAssignments.filter((assignment) => assignment.deletedAt);
  const deletedActivityLogs = hubData.activityLogs.filter((log) => log.deletedAt);
  const deletedLinks = hubData.quickLinks.filter((link) => link.deletedAt);
  const deletedCategoryLinks = hubData.categories.flatMap((category) =>
    (category.links || [])
      .filter((link) => link.deletedAt)
      .map((link) => ({ categoryId: category.id, categoryName: category.name, link }))
  );
  const deletedResources = hubData.categories.flatMap((category) =>
    category.resources
      .filter((resource) => resource.deletedAt)
      .map((resource) => ({ categoryId: category.id, categoryName: category.name, resource }))
  );

  useEffect(() => {
    let stopped = false;

    async function refreshAccess() {
      const response = await fetch("/api/auth/session");
      if (!response.ok) return;
      const result = (await response.json()) as { session: DiscordSession | null };
      if (!result.session) {
        window.location.href = "/";
        return;
      }

      const roleChanged = result.session.role?.id !== session.role?.id || result.session.robloxRoleRank !== session.robloxRoleRank;
      if (!stopped && roleChanged) {
        setSession(result.session);
        const dataResponse = await fetch("/api/hub-data");
        if (dataResponse.ok) {
          setHubData((await dataResponse.json()) as HubData);
        }
      }
    }

    const interval = window.setInterval(() => {
      void refreshAccess();
    }, 60 * 1000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [session.role?.id, session.robloxRoleRank]);
  const canSeeStaffActivity = canViewStaffActivity(role) || effectiveAdminPermissionSet.has("view_staff_activity") || effectiveAdminPermissionSet.has("view_corporate_lookup") || effectiveAdminPermissionSet.has("manage_activity_logs") || effectiveAdminPermissionSet.has("manage_assignments");
  const canSeeRecoveryBin = Boolean((role?.level && role.level >= 100) || effectiveAdminPermissionSet.has("view_recovery_bin") || effectiveAdminPermissionSet.has("manage_recovery_bin") || effectiveAdminPermissionSet.has("restore_from_bin") || effectiveAdminPermissionSet.has("delete_permanently") || effectiveAdminPermissionSet.has("move_resources_to_bin"));
  const canSeeAuditLogs = Boolean((role?.level && role.level >= 100) || effectiveAdminPermissionSet.has("view_audit_logs"));
  const canSeeAdminUsers = canViewAdminTools(role);
  const canManageCategories = canViewAdminTools(role) || effectiveAdminPermissionSet.has("manage_categories");

  useEffect(() => {
    const blockedView =
      (activeView === "staff-activity" && !canSeeStaffActivity) ||
      (activeView === "bin" && !canSeeRecoveryBin) ||
      (activeView === "audit" && !canSeeAuditLogs) ||
      (activeView === "admin" && !canSeeAdminUsers);

    if (blockedView) setActiveView("home");
    if (!canManageCategories && categoryEditorState) setCategoryEditorState(null);
  }, [activeView, canManageCategories, canSeeAdminUsers, canSeeAuditLogs, canSeeRecoveryBin, canSeeStaffActivity, categoryEditorState]);

  function openCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
    setActiveResourceId("");
    setActiveView("category");
  }

  function openResource(categoryId: string, resourceId: string) {
    setActiveCategoryId(categoryId);
    setActiveResourceId(resourceId);
    setActiveView("reader");
  }

  async function saveResource(categoryId: string, nextResource: Resource) {
    const isExisting = hubData.categories.some((category) => category.resources.some((resource) => resource.id === nextResource.id));
    const response = await fetch(isExisting ? `/api/resources/${nextResource.id}` : "/api/resources", {
      method: isExisting ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId, title: nextResource.title, status: nextResource.status, contentHtml: nextResource.contentHtml, accentColor: nextResource.accentColor }),
    });

    if (!response.ok) {
      window.alert("The resource could not be saved.");
      return;
    }

    const result = (await response.json()) as { data: HubData; resource: Resource };
    setHubData(result.data);
    setActiveCategoryId(categoryId);
    setActiveResourceId(result.resource.id);
    setActiveView("reader");
    setEditorState(null);
  }

  async function deleteResource(resourceId: string) {
    const response = await fetch(`/api/resources/${resourceId}`, { method: "DELETE" });

    if (!response.ok) {
      window.alert("The resource could not be moved to the recovery bin.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
    setActiveResourceId("");
    setActiveView("bin");
  }

  async function restoreResource(resourceId: string) {
    const response = await fetch(`/api/resources/${resourceId}/restore`, { method: "POST" });

    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function permanentlyDeleteResource(resourceId: string) {
    if (!window.confirm("Permanently delete this resource?")) return;
    const response = await fetch(`/api/resources/${resourceId}/permanent`, { method: "DELETE" });

    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function deleteCategory(categoryId: string) {
    const response = await fetch(`/api/categories/${categoryId}`, { method: "DELETE" });

    if (!response.ok) {
      window.alert("The category could not be moved to the recovery bin.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
    setActiveCategoryId("");
    setActiveView("bin");
  }

  async function restoreCategory(categoryId: string) {
    const response = await fetch(`/api/categories/${categoryId}/restore`, { method: "POST" });

    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function permanentlyDeleteCategory(categoryId: string) {
    if (!window.confirm("Permanently delete this category and its resources?")) return;
    const response = await fetch(`/api/categories/${categoryId}/permanent`, { method: "DELETE" });

    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function reorderCategory(categoryId: string, direction: "up" | "down") {
    const response = await fetch("/api/categories/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId, direction }),
    });

    if (!response.ok) {
      window.alert("The category could not be moved.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function addQuickLink(link: { label: string; url: string }) {
    const response = await fetch("/api/links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(link),
    });

    if (!response.ok) {
      window.alert("The link could not be saved.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function deleteQuickLink(linkId: string) {
    const response = await fetch(`/api/links/${linkId}`, { method: "DELETE" });

    if (!response.ok) {
      window.alert("The link could not be moved to the recovery bin.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function restoreQuickLink(linkId: string) {
    const response = await fetch(`/api/links/${linkId}/restore`, { method: "POST" });

    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function permanentlyDeleteQuickLink(linkId: string) {
    if (!window.confirm("Permanently delete this link?")) return;
    const response = await fetch(`/api/links/${linkId}/permanent`, { method: "DELETE" });

    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function saveWeeklyAssignment(assignment: Partial<WeeklyAssignment> & Pick<WeeklyAssignment, "teamRoleId" | "sessions" | "minutes" | "shifts">) {
    const isExisting = Boolean(assignment.id);
    const response = await fetch(isExisting ? `/api/activity/assignments/${assignment.id}` : "/api/activity/assignments", {
      method: isExisting ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(assignment),
    });

    if (!response.ok) {
      window.alert("The weekly assignment could not be saved.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function saveActivitySlots(nextSlots: ActivitySlots) {
    const response = await fetch("/api/activity/slots", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextSlots),
    });

    if (!response.ok) {
      window.alert("The activity slots could not be saved.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function deleteAnnouncement(announcementId: string) {
    const response = await fetch(`/api/announcements/${announcementId}`, { method: "DELETE" });

    if (!response.ok) {
      window.alert("The announcement could not be deleted.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function deleteWeeklyAssignment(assignmentId: string) {
    const response = await fetch(`/api/activity/assignments/${assignmentId}`, { method: "DELETE" });

    if (!response.ok) {
      window.alert("The weekly assignment could not be moved to the recovery bin.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function createActivityLog(log: ActivityLogPayload) {
    const response = await fetch("/api/activity/logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(log),
    });

    if (!response.ok) {
      window.alert("The activity log could not be saved.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function updateActivityLog(logId: string, log: ActivityLogUpdatePayload) {
    const response = await fetch(`/api/activity/logs/${logId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(log),
    });

    if (!response.ok) {
      window.alert("The activity log could not be updated.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function deleteActivityLog(logId: string) {
    const response = await fetch(`/api/activity/logs/${logId}`, { method: "DELETE" });

    if (!response.ok) {
      window.alert("The activity log could not be moved to the recovery bin.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function restoreWeeklyAssignment(assignmentId: string) {
    const response = await fetch(`/api/activity/assignments/${assignmentId}/restore`, { method: "POST" });
    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function permanentlyDeleteWeeklyAssignment(assignmentId: string) {
    if (!window.confirm("Permanently delete this assignment?")) return;
    const response = await fetch(`/api/activity/assignments/${assignmentId}/permanent`, { method: "DELETE" });
    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function restoreActivityLog(logId: string) {
    const response = await fetch(`/api/activity/logs/${logId}/restore`, { method: "POST" });
    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function permanentlyDeleteActivityLog(logId: string) {
    if (!window.confirm("Permanently delete this activity log?")) return;
    const response = await fetch(`/api/activity/logs/${logId}/permanent`, { method: "DELETE" });
    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function saveAdminLevels(adminLevels: AdminLevel[]) {
    const response = await fetch("/api/admin/levels", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminLevels }),
    });

    if (!response.ok) {
      window.alert("Admin levels could not be saved.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function addAdminGrant(grant: { discordUserId: string; adminLevelId: string }) {
    const response = await fetch("/api/admin/grants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(grant),
    });

    if (!response.ok) {
      window.alert("Admin grant could not be saved.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function revokeAdminGrant(grantId: string) {
    const response = await fetch(`/api/admin/grants/${grantId}`, { method: "DELETE" });

    if (!response.ok) {
      window.alert("Admin grant could not be revoked.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function addCategoryLink(categoryId: string, link: { label: string; url: string }) {
    const response = await fetch(`/api/categories/${categoryId}/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(link),
    });

    if (!response.ok) {
      window.alert("The category link could not be saved.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function deleteCategoryLink(categoryId: string, linkId: string) {
    const response = await fetch(`/api/categories/${categoryId}/links/${linkId}`, { method: "DELETE" });

    if (!response.ok) {
      window.alert("The category link could not be moved to the recovery bin.");
      return;
    }

    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function restoreCategoryLink(categoryId: string, linkId: string) {
    const response = await fetch(`/api/categories/${categoryId}/links/${linkId}/restore`, { method: "POST" });

    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  async function permanentlyDeleteCategoryLink(categoryId: string, linkId: string) {
    if (!window.confirm("Permanently delete this category link?")) return;
    const response = await fetch(`/api/categories/${categoryId}/links/${linkId}/permanent`, { method: "DELETE" });

    if (!response.ok) return;
    const result = (await response.json()) as { data: HubData };
    setHubData(result.data);
  }

  function openStaffActivity() {
    setActiveView("staff-activity");
    setActivityTab("my");
  }

  useEffect(() => {
    if (!copyProtected) return;

    function blockCopy(event: Event) {
      event.preventDefault();
    }

    function blockShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && ["c", "x", "s", "p", "a"].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    }

    document.addEventListener("copy", blockCopy);
    document.addEventListener("cut", blockCopy);
    document.addEventListener("contextmenu", blockCopy);
    document.addEventListener("dragstart", blockCopy);
    document.addEventListener("keydown", blockShortcut);

    return () => {
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("cut", blockCopy);
      document.removeEventListener("contextmenu", blockCopy);
      document.removeEventListener("dragstart", blockCopy);
      document.removeEventListener("keydown", blockShortcut);
    };
  }, [copyProtected]);

  return (
    <main className={`app-shell ${copyProtected ? "copy-protected" : ""}`}>
      <aside className="sidebar" aria-label="Resource categories">
        <div className="brand">
          <Image className="brand-logo" src="/assets/worlds-kitchen-logo.png" alt="World's Kitchen logo" width={48} height={48} />
          <div>
            <p className="eyebrow">Staff Portal</p>
            <h1>World&apos;s Kitchen Hub</h1>
          </div>
        </div>

        {canViewAdminTools(sessionRole) ? (
          <div className="role-panel">
            <label htmlFor="previewRole">Preview access as</label>
            <select id="previewRole" value={previewRoleId || sessionRole?.id || ""} onChange={(event) => setPreviewRoleId(event.target.value as StaffRoleId)}>
              {staffRoles.map((staffRole) => (
                <option value={staffRole.id} key={staffRole.id}>{staffRole.name}</option>
              ))}
            </select>
            <input
              value={previewDiscordUserId}
              onChange={(event) => setPreviewDiscordUserId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              placeholder="Optional preview Discord user ID"
            />
            <p className="muted">{visibleCategories.length} visible categories. {previewDiscordUserId.trim() ? "Custom admin grants are included." : "Highest matching role controls access."}</p>
            {previewDiscordUserId.trim() ? (
              <p className="muted">
                {effectiveAdminPermissionSet.size ? `${effectiveAdminPermissionSet.size} custom permissions active.` : "No custom admin permissions found for this Discord ID."}
              </p>
            ) : null}
          </div>
        ) : null}

        <nav className="category-nav">
          <button className={`category-button ${activeView === "home" ? "active" : ""}`} type="button" onClick={() => setActiveView("home")}>Home</button>
          {visibleCategories.map((category) => (
            <button className={`category-button ${activeView === "category" && activeCategory?.id === category.id ? "active" : ""}`} key={category.id} type="button" onClick={() => openCategory(category.id)}>
              {category.name}
            </button>
          ))}
        </nav>

        {canManageCategories ? <button className="button primary" type="button" onClick={() => setCategoryEditorState({ categoryId: null })}>New Category</button> : null}
        {canSeeStaffActivity ? <button className={`sidebar-button activity ${activeView === "staff-activity" ? "active" : ""}`} type="button" onClick={openStaffActivity}>Staff Activity</button> : null}
        <div className="sidebar-footer">
          {canSeeRecoveryBin ? <button className={`sidebar-button ${activeView === "bin" ? "active" : ""}`} type="button" onClick={() => setActiveView("bin")}>Recovery Bin</button> : null}
          {canSeeAuditLogs ? <button className={`sidebar-button ${activeView === "audit" ? "active" : ""}`} type="button" onClick={() => setActiveView("audit")}>Audit Logs</button> : null}
          {canSeeAdminUsers ? <button className={`sidebar-button ${activeView === "admin" ? "active" : ""}`} type="button" onClick={() => setActiveView("admin")}>Admin Users</button> : null}
        </div>
      </aside>

      <section className="main-content">
        <Header
          session={session}
          role={role}
          profile={currentProfile}
          saveRobloxUsername={async (robloxUsername) => {
            const response = await fetch("/api/profile/roblox", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ robloxUsername }),
            });

            if (!response.ok) {
              const result = (await response.json().catch(() => null)) as { error?: string } | null;
              window.alert(result?.error || "The Roblox username could not be saved.");
              return;
            }

            const result = (await response.json()) as { data: HubData };
            setHubData(result.data);
          }}
        />
        {activeView === "home" ? (
          <HomeView
            role={role}
            visibleAnnouncements={visibleAnnouncements}
            visibleQuickLinks={visibleQuickLinks}
            openAnnouncementEditor={() => setAnnouncementEditorOpen(true)}
            deleteAnnouncement={deleteAnnouncement}
            openLinkManager={() => setLinkManagerOpen(true)}
            canManageHomeLinks={canViewAdminTools(role) || effectiveAdminPermissionSet.has("manage_home_links")}
            adminPermissions={effectiveAdminPermissionSet}
          />
        ) : null}
        {activeView === "category" && activeCategory ? (
          <CategoryView
            category={activeCategory}
            categoryLinks={activeCategoryLinks}
            resources={activeResources}
            role={role}
            adminPermissions={effectiveAdminPermissionSet}
            openResource={openResource}
            openEditor={(categoryId) => setEditorState({ categoryId, resourceId: null })}
            editCategory={(categoryId) => setCategoryEditorState({ categoryId })}
            openCategoryLinks={(categoryId) => setCategoryLinkManagerState({ categoryId })}
            deleteCategory={deleteCategory}
            reorderCategory={reorderCategory}
            canManageCategoryStructure={canManageCategories}
          />
        ) : null}
        {activeView === "reader" && activeCategory && activeResource ? (
          <ReaderView
            categoryName={activeCategory.name}
            resource={activeResource}
            role={role}
            adminPermissions={effectiveAdminPermissionSet}
            backToCategory={() => openCategory(activeCategory.id)}
            editResource={() => setEditorState({ categoryId: activeCategory.id, resourceId: activeResource.id })}
            deleteResource={() => deleteResource(activeResource.id)}
          />
        ) : null}
        {activeView === "staff-activity" && canSeeStaffActivity ? (
          <StaffActivityView
            role={role}
            session={activitySession}
            adminPermissions={effectiveAdminPermissionSet}
            activeTab={activityTab}
            setActiveTab={setActivityTab}
            activitySlotsConfig={hubData.activitySlots || activitySlots}
            activityLogs={hubData.activityLogs}
            activityMinuteEntries={hubData.activityMinuteEntries || []}
            profiles={hubData.profiles}
            weeklyAssignments={hubData.weeklyAssignments}
            saveWeeklyAssignment={saveWeeklyAssignment}
            saveActivitySlots={saveActivitySlots}
            deleteWeeklyAssignment={deleteWeeklyAssignment}
            createActivityLog={createActivityLog}
            updateActivityLog={updateActivityLog}
            deleteActivityLog={deleteActivityLog}
          />
        ) : null}
        {activeView === "bin" && canSeeRecoveryBin ? (
          <RecoveryBinView
            deletedCategories={deletedCategories}
            deletedAssignments={deletedAssignments}
            deletedActivityLogs={deletedActivityLogs}
            deletedCategoryLinks={deletedCategoryLinks}
            deletedLinks={deletedLinks}
            deletedResources={deletedResources}
            role={role}
            adminPermissions={effectiveAdminPermissionSet}
            restoreCategory={restoreCategory}
            restoreWeeklyAssignment={restoreWeeklyAssignment}
            restoreActivityLog={restoreActivityLog}
            restoreCategoryLink={restoreCategoryLink}
            restoreQuickLink={restoreQuickLink}
            restoreResource={restoreResource}
            permanentlyDeleteCategory={permanentlyDeleteCategory}
            permanentlyDeleteWeeklyAssignment={permanentlyDeleteWeeklyAssignment}
            permanentlyDeleteActivityLog={permanentlyDeleteActivityLog}
            permanentlyDeleteCategoryLink={permanentlyDeleteCategoryLink}
            permanentlyDeleteQuickLink={permanentlyDeleteQuickLink}
            permanentlyDeleteResource={permanentlyDeleteResource}
          />
        ) : null}
        {activeView === "audit" && canSeeAuditLogs ? <AuditLogsView logs={hubData.auditLogs} /> : null}
        {activeView === "admin" && canSeeAdminUsers ? (
          <AdminUsersView
            profiles={hubData.profiles}
            adminLevels={hubData.adminLevels}
            adminGrants={hubData.adminGrants.filter((grant) => !grant.revokedAt)}
            saveAdminLevels={saveAdminLevels}
            addAdminGrant={addAdminGrant}
            revokeAdminGrant={revokeAdminGrant}
          />
        ) : null}
      </section>
      {editorState ? (
        <ResourceEditor
          category={hubData.categories.find((category) => category.id === editorState.categoryId)!}
          resource={hubData.categories.find((category) => category.id === editorState.categoryId)?.resources.find((resource) => resource.id === editorState.resourceId)}
          close={() => setEditorState(null)}
          save={saveResource}
        />
      ) : null}
      {categoryEditorState && canManageCategories ? (
        <CategoryEditor
          category={categoryEditorState.categoryId ? hubData.categories.find((category) => category.id === categoryEditorState.categoryId) : undefined}
          close={() => setCategoryEditorState(null)}
          save={async (nextCategory) => {
            const isExisting = Boolean(nextCategory.id);
            const response = await fetch(isExisting ? `/api/categories/${nextCategory.id}` : "/api/categories", {
              method: isExisting ? "PATCH" : "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name: nextCategory.name, allowedRoleIds: nextCategory.allowedRoleIds }),
            });

            if (!response.ok) {
              window.alert("The category could not be saved.");
              return;
            }

            const result = (await response.json()) as { data: HubData; categoryId?: string };
            setHubData(result.data);
            setActiveCategoryId(result.categoryId || nextCategory.id);
            setActiveView("category");
            setCategoryEditorState(null);
          }}
        />
      ) : null}
      {announcementEditorOpen ? (
        <AnnouncementEditor
          close={() => setAnnouncementEditorOpen(false)}
          save={async (announcement) => {
            const response = await fetch("/api/announcements", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(announcement),
            });

            if (!response.ok) {
              window.alert("The announcement could not be saved.");
              return;
            }

            const result = (await response.json()) as { data: HubData };
            setHubData(result.data);
            setAnnouncementEditorOpen(false);
            setActiveView("home");
          }}
        />
      ) : null}
      {categoryLinkManagerState ? (
        <CategoryLinkManager
          category={hubData.categories.find((category) => category.id === categoryLinkManagerState.categoryId)!}
          close={() => setCategoryLinkManagerState(null)}
          addCategoryLink={addCategoryLink}
          deleteCategoryLink={deleteCategoryLink}
        />
      ) : null}
      {linkManagerOpen ? (
        <LinkManager
          links={visibleQuickLinks}
          close={() => setLinkManagerOpen(false)}
          addQuickLink={addQuickLink}
          deleteQuickLink={deleteQuickLink}
        />
      ) : null}
    </main>
  );
}

function Header({ session, role, profile }: { session: DiscordSession; role: StaffRole | null; profile?: StaffProfile; saveRobloxUsername: (robloxUsername: string) => Promise<void> }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileAvatarUrl = profile?.robloxAvatarUrl || session.avatarUrl;

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Welcome</p>
        <h2>Find the resources you need to work with us.</h2>
      </div>
      <div className="account-pill">
        {profileAvatarUrl ? <Image className="avatar" src={profileAvatarUrl} alt="" width={42} height={42} /> : null}
        <div className="account-text">
          <strong>{session.username}</strong>
          <span className="muted">{profile?.robloxUsername ? `${profile.robloxUsername} - ${role?.name || "No matching role"}` : role?.name || "No matching role"}</span>
        </div>
        <button className="button secondary" type="button" onClick={() => setProfileOpen((open) => !open)}>Profile</button>
        <a className="button secondary" href="/api/auth/logout">Log out</a>
      </div>
      {profileOpen ? (
        <div className="profile-popover">
          <label>Roblox username<input value={profile?.robloxUsername || session.robloxUsername || session.username} readOnly /></label>
          <p className="muted">{profile?.robloxUserId || session.robloxUserId ? `Roblox user ID ${profile?.robloxUserId || session.robloxUserId}. Rank: ${profile?.robloxRoleName || session.robloxRoleName || "No group role"}.` : "Signed in with Roblox."}</p>
          <div className="dialog-actions">
            <button className="button secondary" type="button" onClick={() => setProfileOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function HomeView({
  role,
  visibleAnnouncements,
  visibleQuickLinks,
  openAnnouncementEditor,
  deleteAnnouncement,
  openLinkManager,
  canManageHomeLinks,
  adminPermissions,
}: {
  role: StaffRole | null;
  visibleAnnouncements: HubData["announcements"];
  visibleQuickLinks: QuickLink[];
  openAnnouncementEditor: () => void;
  deleteAnnouncement: (announcementId: string) => void;
  openLinkManager: () => void;
  canManageHomeLinks: boolean;
  adminPermissions: Set<AdminPermission>;
}) {
  const canDeleteAnnouncements = Boolean((role?.level && role.level >= 100) || adminPermissions.has("delete_announcements"));
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<HubData["announcements"][number] | null>(null);

  return (
    <section className="home-view">
      <div className="home-hero">
        <p className="eyebrow">World&apos;s Kitchen Hub</p>
        <h3>Welcome to your staff workspace.</h3>
        <p>Find official resources, internal guides, and important links in one organized place.</p>
      </div>
      <div className="section-block">
        <div className="content-header">
          <div>
            <p className="eyebrow">Quick Links</p>
            <h3>Useful places</h3>
          </div>
          {canManageHomeLinks ? <button className="button primary" type="button" onClick={openLinkManager}>Manage Links</button> : null}
        </div>
        <div className="quick-link-grid">
          {visibleQuickLinks.map((link) => (
            <a className="quick-link-card" href={link.url} key={link.id}>
              <h4>{link.label}</h4>
              <p>Open resource</p>
            </a>
          ))}
        </div>
      </div>
      <div className="section-block">
        <div className="content-header">
          <div>
            <p className="eyebrow">Announcements</p>
            <h3>Latest updates</h3>
          </div>
          {(canManageContent(role, adminPermissions) || adminPermissions.has("create_announcements")) ? <button className="button primary" type="button" onClick={openAnnouncementEditor}>New Announcement</button> : null}
        </div>
        <div className="announcement-grid">
          {visibleAnnouncements.length ? visibleAnnouncements.map((announcement) => (
            <article className={`announcement-card accent-${announcement.accentColor || "neutral"}`} key={announcement.id} role="button" tabIndex={0} onClick={() => setSelectedAnnouncement(announcement)} onKeyDown={(event) => event.key === "Enter" && setSelectedAnnouncement(announcement)}>
              <div className="announcement-meta">
                <span className={`status-pill ${announcement.status}`}>{announcement.status}</span>
                {canDeleteAnnouncements ? <button className="button secondary danger-text compact-action" type="button" onClick={(event) => {
                  event.stopPropagation();
                  deleteAnnouncement(announcement.id);
                }}>Delete</button> : null}
              </div>
              <h4>{announcement.title}</h4>
              <p>{announcement.content}</p>
            </article>
          )) : <EmptyState title="No announcements" text="Important updates will appear here when they are available." />}
        </div>
      </div>
      {selectedAnnouncement ? (
        <div className="modal-backdrop blurred-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedAnnouncement(null)}>
          <article className="editor-modal announcement-modal">
            <div className="dialog-header">
              <div>
                <p className="eyebrow">Announcement</p>
                <h3>{selectedAnnouncement.title}</h3>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedAnnouncement(null)}>x</button>
            </div>
            <p>{selectedAnnouncement.content}</p>
          </article>
        </div>
      ) : null}
    </section>
  );
}

function AnnouncementEditor({ close, save }: { close: () => void; save: (announcement: { title: string; content: string; status: "draft" | "published"; accentColor?: string; allowedRoleIds: StaffRoleId[] }) => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [accentColor, setAccentColor] = useState("");
  const [allowedRoleIds, setAllowedRoleIds] = useState<StaffRoleId[]>(["leadership-team", "owner"]);
  const editableRoles = staffRoles.filter((role) => role.id !== "owner");

  function toggleRole(roleId: StaffRoleId) {
    setAllowedRoleIds((current) => (current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !content.trim()) return;
    save({ title: title.trim(), content: content.trim(), status, accentColor: accentColor || undefined, allowedRoleIds: Array.from(new Set([...allowedRoleIds, "owner"])) });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form className="editor-modal compact-modal" onSubmit={handleSubmit}>
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Announcements</p>
            <h3>New Announcement</h3>
          </div>
          <button className="icon-button" type="button" onClick={close}>x</button>
        </div>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Announcement title" />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "published")}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label>
          Message
          <textarea value={content} maxLength={900} onChange={(event) => setContent(event.target.value)} rows={5} placeholder="Write the announcement..." />
          <span className="field-hint">{content.length}/900 characters</span>
        </label>
        <label>
          Card color
          <select value={accentColor} onChange={(event) => setAccentColor(event.target.value)}>
            {cardAccentOptions.map(([value, label]) => <option value={value} key={value || "neutral"}>{label}</option>)}
          </select>
        </label>
        <fieldset className="role-checklist">
          <legend>Who can view this announcement?</legend>
          {editableRoles.map((staffRole) => (
            <label className="role-option" key={staffRole.id}>
              <input type="checkbox" checked={allowedRoleIds.includes(staffRole.id)} onChange={() => toggleRole(staffRole.id)} />
              <span>{staffRole.name}</span>
            </label>
          ))}
        </fieldset>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={close}>Cancel</button>
          <button className="button primary" type="submit">Save Announcement</button>
        </div>
      </form>
    </div>
  );
}

function LinkManager({
  links,
  close,
  addQuickLink,
  deleteQuickLink,
}: {
  links: QuickLink[];
  close: () => void;
  addQuickLink: (link: { label: string; url: string }) => Promise<void>;
  deleteQuickLink: (linkId: string) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!label.trim() || !url.trim()) return;
    if (!isValidHttpUrl(url.trim())) {
      window.alert("Please enter a valid link starting with http:// or https://.");
      return;
    }
    await addQuickLink({ label: label.trim(), url: url.trim() });
    setLabel("");
    setUrl("");
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form className="editor-modal compact-modal" onSubmit={handleSubmit}>
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Home Links</p>
            <h3>Manage Quick Links</h3>
          </div>
          <button className="icon-button" type="button" onClick={close}>x</button>
        </div>
        <div className="link-manager-list">
          {links.length ? links.map((link) => (
            <div className="link-manager-row" key={link.id}>
              <div>
                <strong>{link.label}</strong>
                <p className="muted">{link.url}</p>
              </div>
              <button className="button secondary danger-text" type="button" onClick={() => deleteQuickLink(link.id)}>Remove</button>
            </div>
          )) : <p className="muted">No quick links yet.</p>}
        </div>
        <label>
          Link name
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Discord Server" />
        </label>
        <label>
          URL
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
        </label>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={close}>Done</button>
          <button className="button primary" type="submit">Add Link</button>
        </div>
      </form>
    </div>
  );
}

function CategoryLinkManager({
  category,
  close,
  addCategoryLink,
  deleteCategoryLink,
}: {
  category: Category;
  close: () => void;
  addCategoryLink: (categoryId: string, link: { label: string; url: string }) => Promise<void>;
  deleteCategoryLink: (categoryId: string, linkId: string) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const links = (category.links || []).filter((link) => !link.deletedAt);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!label.trim() || !url.trim()) return;
    if (!isValidHttpUrl(url.trim())) {
      window.alert("Please enter a valid link starting with http:// or https://.");
      return;
    }
    await addCategoryLink(category.id, { label: label.trim(), url: url.trim() });
    setLabel("");
    setUrl("");
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form className="editor-modal compact-modal" onSubmit={handleSubmit}>
        <div className="dialog-header">
          <div>
            <p className="eyebrow">{category.name}</p>
            <h3>Manage Category Links</h3>
          </div>
          <button className="icon-button" type="button" onClick={close}>x</button>
        </div>
        <div className="link-manager-list">
          {links.length ? links.map((link) => (
            <div className="link-manager-row" key={link.id}>
              <div>
                <strong>{link.label}</strong>
                <p className="muted">{link.url}</p>
              </div>
              <button className="button secondary danger-text" type="button" onClick={() => deleteCategoryLink(category.id, link.id)}>Remove</button>
            </div>
          )) : <p className="muted">No links in this category yet.</p>}
        </div>
        <label>
          Link name
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Resource name" />
        </label>
        <label>
          URL
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
        </label>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={close}>Done</button>
          <button className="button primary" type="submit">Add Link</button>
        </div>
      </form>
    </div>
  );
}

function CategoryView({
  category,
  categoryLinks,
  resources,
  role,
  adminPermissions,
  openResource,
  openEditor,
  editCategory,
  openCategoryLinks,
  deleteCategory,
  reorderCategory,
  canManageCategoryStructure,
}: {
  category: Category;
  categoryLinks: QuickLink[];
  resources: Resource[];
  role: StaffRole | null;
  adminPermissions: Set<AdminPermission>;
  openResource: (categoryId: string, resourceId: string) => void;
  openEditor: (categoryId: string) => void;
  editCategory: (categoryId: string) => void;
  openCategoryLinks: (categoryId: string) => void;
  deleteCategory: (categoryId: string) => void;
  reorderCategory: (categoryId: string, direction: "up" | "down") => void;
  canManageCategoryStructure: boolean;
}) {
  const canCreateResource = Boolean((role?.level && role.level >= 100) || adminPermissions.has("create_resources"));
  const canManageCategoryLinks = Boolean((role?.level && role.level >= 100) || adminPermissions.has("manage_category_links"));
  const hasHeaderActions = canCreateResource || canManageCategoryLinks || canManageCategoryStructure;

  return (
    <section className="workspace">
      <div className="content-header">
        <div>
          <p className="eyebrow">Category</p>
          <h3>{category.name}</h3>
        </div>
        {hasHeaderActions ? (
          <div className="header-actions">
            {canManageCategoryLinks ? <button className="button secondary" type="button" onClick={() => openCategoryLinks(category.id)}>Manage Links</button> : null}
            {canManageCategoryStructure ? <button className="button secondary danger-text" type="button" onClick={() => deleteCategory(category.id)}>Delete Category</button> : null}
            {canManageCategoryStructure ? <button className="button secondary" type="button" onClick={() => reorderCategory(category.id, "up")}>Move Up</button> : null}
            {canManageCategoryStructure ? <button className="button secondary" type="button" onClick={() => reorderCategory(category.id, "down")}>Move Down</button> : null}
            {canManageCategoryStructure ? <button className="button secondary" type="button" onClick={() => editCategory(category.id)}>Manage Category</button> : null}
            {canCreateResource ? <button className="button primary" type="button" onClick={() => openEditor(category.id)}>New Resource</button> : null}
          </div>
        ) : null}
      </div>
      {categoryLinks.length ? (
        <div className="category-link-section">
          <p className="eyebrow">Category Links</p>
          <div className="quick-link-grid">
            {categoryLinks.map((link) => (
              <a className="quick-link-card" href={link.url} key={link.id}>
                <h4>{link.label}</h4>
                <p>Open resource</p>
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <div className="resource-grid category-resource-grid">
        {resources.length ? resources.map((resource) => (
          <button className={`resource-card resource-button accent-${resource.accentColor || "neutral"}`} key={resource.id} type="button" onClick={() => openResource(category.id, resource.id)}>
            <h4>{resource.title}</h4>
            <span className={`status-pill ${resource.status}`}>{resource.status}</span>
          </button>
        )) : <EmptyState title="No resources yet" text="This category is ready for its first resource." />}
      </div>
    </section>
  );
}

function CategoryEditor({ category, close, save }: { category?: Category; close: () => void; save: (category: { id: string; name: string; allowedRoleIds: StaffRoleId[] }) => void }) {
  const [name, setName] = useState(category?.name || "");
  const [allowedRoleIds, setAllowedRoleIds] = useState<StaffRoleId[]>(category?.allowedRoleIds || ["worlds-kitchen-team", "owner"]);
  const editableRoles = staffRoles.filter((role) => role.id !== "owner");

  function toggleRole(roleId: StaffRoleId) {
    setAllowedRoleIds((current) => (current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    save({ id: category?.id || "", name: name.trim(), allowedRoleIds: Array.from(new Set([...allowedRoleIds, "owner"])) });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form className="editor-modal compact-modal" onSubmit={handleSubmit}>
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Category Access</p>
            <h3>{category ? "Manage Category" : "New Category"}</h3>
          </div>
          <button className="icon-button" type="button" onClick={close}>x</button>
        </div>
        <label>
          Category name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Category name" />
        </label>
        <fieldset className="role-checklist">
          <legend>Who can view this category?</legend>
          {editableRoles.map((staffRole) => (
            <label className="role-option" key={staffRole.id}>
              <input type="checkbox" checked={allowedRoleIds.includes(staffRole.id)} onChange={() => toggleRole(staffRole.id)} />
              <span>{staffRole.name}</span>
            </label>
          ))}
        </fieldset>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={close}>Cancel</button>
          <button className="button primary" type="submit">Save Category</button>
        </div>
      </form>
    </div>
  );
}

function ReaderView({ categoryName, resource, role, adminPermissions, backToCategory, editResource, deleteResource }: { categoryName: string; resource: Resource; role: StaffRole | null; adminPermissions: Set<AdminPermission>; backToCategory: () => void; editResource: () => void; deleteResource: () => void }) {
  return (
    <section className="reader-view">
      <div className="reader-actions">
        <button className="back-button" type="button" onClick={backToCategory}>Back to category</button>
        {canManageContent(role, adminPermissions) ? (
          <div className="header-actions">
            {adminPermissions.has("move_resources_to_bin") || (role?.level && role.level >= 100) ? <button className="button secondary danger-text" type="button" onClick={deleteResource}>Delete Resource</button> : null}
            {adminPermissions.has("edit_resources") || (role?.level && role.level >= 100) ? <button className="button primary" type="button" onClick={editResource}>Edit Resource</button> : null}
          </div>
        ) : null}
      </div>
      <article className="document-page">
        <p className="eyebrow">{categoryName}</p>
        <h3>{resource.title}</h3>
        <div className="reader-content" dangerouslySetInnerHTML={{ __html: resource.contentHtml }} />
      </article>
    </section>
  );
}

function ResourceEditor({ category, resource, close, save }: { category: Category; resource?: Resource; close: () => void; save: (categoryId: string, resource: Resource) => void }) {
  const [title, setTitle] = useState(resource?.title || "");
  const [status, setStatus] = useState<Resource["status"]>(resource?.status || "draft");
  const [content, setContent] = useState(resource?.contentHtml || "<h2>New Resource</h2><p>Write the content here.</p>");
  const [accentColor, setAccentColor] = useState(resource?.accentColor || "");
  const [blockStyle, setBlockStyle] = useState("p");
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorSelectionRef = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = content;
    // Only seed the contentEditable when this editor instance opens.
    // Updating it on every keystroke resets the caret position.
  }, []);

  function runCommand(command: string, value?: string) {
    restoreEditorSelection();
    document.execCommand(command, false, value);
    const editor = document.querySelector<HTMLElement>("[data-resource-editor]");
    if (editor) setContent(editor.innerHTML);
  }

  function saveEditorSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
    editorSelectionRef.current = selection.getRangeAt(0).cloneRange();
  }

  function restoreEditorSelection() {
    const selection = window.getSelection();
    const range = editorSelectionRef.current;
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function applyFontSize(size: string) {
    restoreEditorSelection();
    document.execCommand("fontSize", false, "7");
    const editor = editorRef.current;
    if (!editor) return;

    editor.querySelectorAll("font[size='7']").forEach((fontElement) => {
      const span = document.createElement("span");
      span.style.setProperty("font-size", size, "important");
      span.style.lineHeight = "1.35";
      span.innerHTML = fontElement.innerHTML;
      fontElement.replaceWith(span);
    });
    setContent(editor.innerHTML);
    saveEditorSelection();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const currentContent = editorRef.current?.innerHTML || content;
    const plainText = currentContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const nextResource: Resource = {
      id: resource?.id || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `resource-${Date.now()}`,
      title: title.trim(),
      status,
      accentColor: accentColor || undefined,
      excerpt: plainText.slice(0, 120) || "No preview available yet.",
      contentHtml: currentContent,
    };

    if (!nextResource.title) return;
    save(category.id, nextResource);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form className="editor-modal" onSubmit={handleSubmit}>
        <div className="dialog-header">
          <div>
            <p className="eyebrow">{category.name}</p>
            <h3>{resource ? "Edit Resource" : "New Resource"}</h3>
          </div>
          <button className="icon-button" type="button" onClick={close}>x</button>
        </div>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Resource title" />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as Resource["status"])}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label>
          Preview card color
          <select value={accentColor} onChange={(event) => setAccentColor(event.target.value)}>
            {cardAccentOptions.map(([value, label]) => <option value={value} key={value || "neutral"}>{label}</option>)}
          </select>
        </label>
        <div className="format-toolbar" aria-label="Formatting tools">
          <select value={blockStyle} onChange={(event) => {
            setBlockStyle(event.target.value);
            runCommand("formatBlock", event.target.value);
          }}>
            <option value="p">Normal text</option>
            <option value="h2">Title</option>
            <option value="h3">Subtitle</option>
          </select>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")}>Bold</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("italic")}>Italic</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("underline")}>Underline</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertUnorderedList")}>List</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("justifyLeft")}>Left</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("justifyCenter")}>Center</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("justifyRight")}>Right</button>
          <select defaultValue="1rem" onMouseDown={saveEditorSelection} onChange={(event) => applyFontSize(event.target.value)} aria-label="Text size">
            <option value="0.9rem">Small</option>
            <option value="1rem">Normal size</option>
            <option value="1.25rem">Large</option>
            <option value="1.55rem">Extra large</option>
            <option value="2rem">Huge</option>
          </select>
          <label className="compact-tool">
            Text
            <input type="color" defaultValue="#1f2933" onChange={(event) => runCommand("foreColor", event.target.value)} />
          </label>
          <label className="compact-tool">
            Highlight
            <input type="color" defaultValue="#fff3a3" onChange={(event) => runCommand("backColor", event.target.value)} />
          </label>
        </div>
        <label>
          Content
          <div
            className="rich-editor"
            contentEditable
            data-resource-editor
            ref={editorRef}
            suppressContentEditableWarning
            onInput={(event) => {
              setContent(event.currentTarget.innerHTML);
              saveEditorSelection();
            }}
            onKeyUp={saveEditorSelection}
            onMouseUp={saveEditorSelection}
          />
        </label>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={close}>Cancel</button>
          <button className="button primary" type="submit">Save Resource</button>
        </div>
      </form>
    </div>
  );
}

function StaffActivityView({
  role,
  session,
  adminPermissions,
  activeTab,
  setActiveTab,
  activitySlotsConfig,
  activityLogs,
  activityMinuteEntries,
  profiles,
  weeklyAssignments,
  saveWeeklyAssignment,
  saveActivitySlots,
  deleteWeeklyAssignment,
  createActivityLog,
  updateActivityLog,
  deleteActivityLog,
}: {
  role: StaffRole | null;
  session: DiscordSession;
  adminPermissions: Set<AdminPermission>;
  activeTab: ActivityTab;
  setActiveTab: (tab: ActivityTab) => void;
  activitySlotsConfig: ActivitySlots;
  activityLogs: ActivityLog[];
  activityMinuteEntries: ActivityMinuteEntry[];
  profiles: StaffProfile[];
  weeklyAssignments: WeeklyAssignment[];
  saveWeeklyAssignment: (assignment: Partial<WeeklyAssignment> & Pick<WeeklyAssignment, "teamRoleId" | "sessions" | "minutes" | "shifts">) => Promise<void>;
  saveActivitySlots: (slots: ActivitySlots) => Promise<void>;
  deleteWeeklyAssignment: (assignmentId: string) => Promise<void>;
  createActivityLog: (log: ActivityLogPayload) => Promise<void>;
  updateActivityLog: (logId: string, log: ActivityLogUpdatePayload) => Promise<void>;
  deleteActivityLog: (logId: string) => Promise<void>;
}) {
  const activeLogs = activityLogs.filter((log) => !log.deletedAt);
  const activeAssignments = weeklyAssignments.filter((assignment) => !assignment.deletedAt);
  const usernameSuggestions = collectUsernamesFromLogs(activeLogs, profiles);
  const canUseLookup = canViewAssignments(role) || adminPermissions.has("view_corporate_lookup");
  const canUseAssignments = canViewAssignments(role) || adminPermissions.has("manage_assignments") || adminPermissions.has("manage_activity_slots");

  return (
    <section className="workspace">
      <div className="content-header">
        <div>
          <p className="eyebrow">Performance</p>
          <h3>Staff Activity</h3>
        </div>
      </div>
      <div className="activity-tabs">
        <ActivityTabButton activeTab={activeTab} tab="my" setActiveTab={setActiveTab}>My Activity</ActivityTabButton>
        {canUseLookup ? <ActivityTabButton activeTab={activeTab} tab="lookup" setActiveTab={setActiveTab}>Lookup</ActivityTabButton> : null}
        <ActivityTabButton activeTab={activeTab} tab="logs" setActiveTab={setActiveTab}>Logs</ActivityTabButton>
        {canUseAssignments ? <ActivityTabButton activeTab={activeTab} tab="assignments" setActiveTab={setActiveTab}>Assignments</ActivityTabButton> : null}
        <ActivityTabButton activeTab={activeTab} tab="leaders" setActiveTab={setActiveTab}>Top Performers</ActivityTabButton>
      </div>
      {activeTab === "my" ? <MyActivityPanel role={role} session={session} profiles={profiles} activityLogs={activeLogs} activityMinuteEntries={activityMinuteEntries} weeklyAssignments={activeAssignments} /> : null}
      {activeTab === "lookup" && canUseLookup ? <LookupPanel role={role} profiles={profiles} activityLogs={activeLogs} activityMinuteEntries={activityMinuteEntries} weeklyAssignments={activeAssignments} /> : null}
      {activeTab === "logs" ? <LogsPanel role={role} session={session} adminPermissions={adminPermissions} activitySlotsConfig={activitySlotsConfig} activityLogs={activeLogs} profiles={profiles} createActivityLog={createActivityLog} updateActivityLog={updateActivityLog} deleteActivityLog={deleteActivityLog} /> : null}
      {activeTab === "assignments" && canUseAssignments ? <AssignmentsPanel role={role} adminPermissions={adminPermissions} activitySlotsConfig={activitySlotsConfig} weeklyAssignments={activeAssignments} saveWeeklyAssignment={saveWeeklyAssignment} saveActivitySlots={saveActivitySlots} deleteWeeklyAssignment={deleteWeeklyAssignment} /> : null}
      {activeTab === "leaders" ? <LeaderboardsPanel activityLogs={activeLogs} /> : null}
      <datalist id="staffUsernameSuggestions">
        {usernameSuggestions.map((username) => <option value={username} key={username} />)}
      </datalist>
    </section>
  );
}

function ActivityTabButton({ activeTab, tab, setActiveTab, children }: { activeTab: ActivityTab; tab: ActivityTab; setActiveTab: (tab: ActivityTab) => void; children: React.ReactNode }) {
  return <button className={`activity-tab ${activeTab === tab ? "active" : ""}`} type="button" onClick={() => setActiveTab(tab)}>{children}</button>;
}

function activityLogIncludesUser(log: ActivityLog, username: string) {
  const needle = username.toLowerCase();
  return JSON.stringify(log.roles).toLowerCase().includes(needle);
}

function collectUsernamesFromLogs(activityLogs: ActivityLog[], profiles: StaffProfile[]) {
  const names = new Set<string>(["SamuelWK", "MayaChef", "LucaHost", "NoraPR", "AveryHR"]);
  profiles.forEach((profile) => {
    if (profile.robloxUsername) names.add(profile.robloxUsername);
    if (profile.discordUsername) names.add(profile.discordUsername);
  });
  for (const log of activityLogs) {
    const matches = JSON.stringify(log.roles).match(/[A-Za-z0-9_]{3,20}/g) || [];
    matches.forEach((name) => names.add(name));
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function MyActivityPanel({ role, session, profiles, activityLogs, activityMinuteEntries, weeklyAssignments }: { role: StaffRole | null; session: DiscordSession; profiles: StaffProfile[]; activityLogs: ActivityLog[]; activityMinuteEntries: ActivityMinuteEntry[]; weeklyAssignments: WeeklyAssignment[] }) {
  const ownProfile = profiles.find((profile) => profile.discordUserId === session.discordUserId);
  const ownNames = [session.username, ownProfile?.robloxUsername, ownProfile?.robloxDisplayName].filter(Boolean).map((name) => String(name).toLowerCase());
  const currentWeekStart = startOfWeek(getTodayDate());
  const nextWeekStart = addDays(currentWeekStart, 7);
  const ownLogs = activityLogs.filter((log) => logIsInRange(log, currentWeekStart, nextWeekStart) && ownNames.some((name) => activityLogIncludesUser(log, name)));
  const trackedMinutes = sumTrackedMinutes(activityMinuteEntries, ownNames, currentWeekStart, nextWeekStart, ownProfile?.robloxUserId);
  const trainingCount = ownLogs.filter((log) => log.type === "training").length;
  const shiftCount = ownLogs.filter((log) => log.type === "shift").length;
  const creditedMinutes = ownLogs.reduce((total, log) => total + (log.creditedMinutes || 0), 0) + trackedMinutes;
  const assignmentRole = getAssignableRole(role);
  const assignment = weeklyAssignments.find((item) => item.teamRoleId === assignmentRole?.id);
  const sessionGoal = assignment?.sessions || 0;
  const shiftGoal = assignment?.shifts || 0;
  const minutesGoal = assignment?.minutes || 0;
  const hasAssignment = Boolean(assignment);
  const completion = {
    trainings: sessionGoal ? Math.min(100, Math.round((trainingCount / sessionGoal) * 100)) : 0,
    shifts: shiftGoal ? Math.min(100, Math.round((shiftCount / shiftGoal) * 100)) : 0,
    minutes: minutesGoal ? Math.min(100, Math.round((creditedMinutes / minutesGoal) * 100)) : 0,
  };
  const shouldShowHistory = Boolean(hasAssignment && (!role || role.level < 100));

  return (
    <div className="activity-panel">
      {!hasAssignment ? <EmptyState title="No assignments" text="This role does not currently have weekly assignments." /> : null}
      <div className="metric-grid">
        {[
          ["Trainings", `${trainingCount} / ${sessionGoal}`, completion.trainings],
          ["Minutes", `${creditedMinutes} / ${minutesGoal}`, completion.minutes],
          ["Shifts", `${shiftCount} / ${shiftGoal}`, completion.shifts],
        ].map(([label, value, percent]) => (
          <article className="metric-card" key={label as string}>
            <p className="eyebrow">{label}</p>
            <h4>{value}</h4>
            <div className="meter"><span style={{ width: `${percent}%` }} /></div>
          </article>
        ))}
      </div>
      {shouldShowHistory ? <div className="section-block">
        <div className="content-header">
          <div>
            <p className="eyebrow">History</p>
            <h3>Last 8 weeks</h3>
          </div>
        </div>
        <div className="week-history">
          {buildRecentWeeks().map((week) => {
            const weekLogs = activityLogs.filter((log) => logIsInRange(log, week.start, week.end) && ownNames.some((name) => activityLogIncludesUser(log, name)));
            const weekTrainings = weekLogs.filter((log) => log.type === "training").length;
            const weekShifts = weekLogs.filter((log) => log.type === "shift").length;
            const weekMinutes = weekLogs.reduce((total, log) => total + (log.creditedMinutes || 0), 0) + sumTrackedMinutes(activityMinuteEntries, ownNames, week.start, week.end, ownProfile?.robloxUserId);
            const weekTrainingPercent = sessionGoal ? Math.min(100, Math.round((weekTrainings / sessionGoal) * 100)) : 100;
            const weekMinutePercent = minutesGoal ? Math.min(100, Math.round((weekMinutes / minutesGoal) * 100)) : 100;
            const weekShiftPercent = shiftGoal ? Math.min(100, Math.round((weekShifts / shiftGoal) * 100)) : 100;
            const weekPercent = Math.round((weekTrainingPercent + weekMinutePercent + weekShiftPercent) / 3);
            const weekValues = [`${weekTrainings}/${sessionGoal}`, `${weekMinutes}/${minutesGoal}`, `${weekShifts}/${shiftGoal}`];
            return (
              <article className={`week-cell ${weekPercent >= 50 ? "complete" : "incomplete"}`} key={week.range}>
                <p className="muted">{week.range}</p>
                <h4>{assignmentRole?.name || role?.name || "Staff"} Assignments</h4>
                <div className="week-progress">
                  <span style={{ width: `${weekPercent}%` }} />
                  <strong>{weekPercent}%</strong>
                </div>
                <div className="week-cell-body">
                  {["Trainings", "Minutes", "Shifts"].map((label, metricIndex) => (
                    <div className="week-metric" key={label}>
                      <p>{label}</p>
                      <strong>{weekValues[metricIndex]}</strong>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div> : null}
    </div>
  );
}

function profileMatchesQuery(profile: StaffProfile, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return false;

  return [
    profile.robloxUsername,
    profile.robloxDisplayName,
    profile.discordUsername,
    profile.discordUserId,
  ].some((value) => value?.toLowerCase() === normalizedQuery);
}

function canLookupProfile(viewerRole: StaffRole | null, profile: StaffProfile) {
  if (!viewerRole) return false;
  if (viewerRole.level >= 100) return true;

  const targetRole = staffRoles.find((staffRole) => staffRole.id === profile.highestRoleId);
  if (!targetRole) return true;

  return targetRole.level < viewerRole.level;
}

function getAssignmentForProfile(profile: StaffProfile | undefined, weeklyAssignments: WeeklyAssignment[]) {
  if (!profile?.highestRoleId) return undefined;
  return weeklyAssignments.find((assignment) => assignment.teamRoleId === getAssignableRoleId(profile.highestRoleId));
}

function getAssignableRoleId(roleId: StaffRoleId | null | undefined) {
  if (roleId === "human-resources-department" || roleId === "public-relations-department") return "corporate-team";
  return roleId;
}

function getAssignableRole(role: StaffRole | null) {
  const assignmentRoleId = getAssignableRoleId(role?.id);
  return staffRoles.find((staffRole) => staffRole.id === assignmentRoleId) || role;
}

function inferAssignableRoleFromRoblox(user: RobloxSuggestion | null): StaffRole | undefined {
  const roleName = user?.roleName?.toLowerCase() || "";
  const roleRank = user?.roleRank || 0;
  const rankMatch = robloxRankRanges.find((range) => roleRank >= range.min && roleRank <= range.max);
  if (rankMatch) return staffRoles.find((staffRole) => staffRole.id === rankMatch.roleId);
  if (roleRank > 0) return undefined;

  if (roleName.includes("president") || roleName.includes("chief") || roleName.includes("leadership")) return staffRoles.find((staffRole) => staffRole.id === "leadership-team");
  if (roleName.includes("corporate")) return staffRoles.find((staffRole) => staffRole.id === "corporate-team");
  if (roleName.includes("director") || roleName.includes("management") || roleName.includes("manager")) return staffRoles.find((staffRole) => staffRole.id === "management-team");
  if (roleName.includes("supervisor") || roleName.includes("supervision")) return staffRoles.find((staffRole) => staffRole.id === "supervision-team");
  return undefined;
}

function defaultWeeklyAssignmentForRole(roleId: StaffRoleId) {
  if (roleId === "corporate-team") return { sessions: 0, minutes: 75, shifts: 1 };
  if (roleId === "management-team") return { sessions: 2, minutes: 60, shifts: 1 };
  if (roleId === "supervision-team") return { sessions: 2, minutes: 60, shifts: 0 };
  return undefined;
}

async function findExactRobloxSuggestion(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  try {
    const exactResponse = await fetch(`/api/roblox/users/exact?username=${encodeURIComponent(normalizedQuery)}`);
    if (exactResponse.ok) {
      const exactResult = (await exactResponse.json()) as { user: RobloxSuggestion | null };
      if (exactResult.user) return exactResult.user;
    }
  } catch {
    // Fall back to suggestion search below.
  }

  const users = await getRobloxSuggestions(normalizedQuery);
  return users.find((user) => user.username.toLowerCase() === normalizedQuery || user.displayName.toLowerCase() === normalizedQuery) || null;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function timeLabelToInputValue(label: string) {
  const match = label.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return "18:00";

  let hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeInputValueToLabel(value: string) {
  const [hourValue, minuteValue] = value.split(":").map(Number);
  const safeHour = Number.isFinite(hourValue) ? hourValue : 18;
  const safeMinute = Number.isFinite(minuteValue) ? minuteValue : 0;
  const meridiem = safeHour >= 12 ? "PM" : "AM";
  const hour12 = safeHour % 12 || 12;
  return `${hour12}:${String(safeMinute).padStart(2, "0")} ${meridiem} EST`;
}

function slotLabelsToInputs(slots: string[]) {
  return slots.length ? slots.map(timeLabelToInputValue) : ["18:00"];
}

function slotInputsToLabels(values: string[]) {
  return Array.from(new Set(values.filter(Boolean).map(timeInputValueToLabel)));
}

function RobloxUserInput({ value, onChange, onSelect, placeholder = "Roblox username" }: { value: string; onChange: (value: string) => void; onSelect?: (user: RobloxSuggestion) => void; placeholder?: string }) {
  const [suggestions, setSuggestions] = useState<RobloxSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  async function loadSuggestions(query: string, openAfterLoad: boolean) {
    try {
      const users = await getRobloxSuggestions(query);
      setSuggestions(users);
      const exactUser = findExactSuggestion(users, query);
      if (exactUser) onSelect?.(exactUser);
      if (openAfterLoad) setOpen(Boolean(users.length));
    } catch {
      setSuggestions([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const query = value.trim();

    const timer = window.setTimeout(async () => {
      try {
        const users = await getRobloxSuggestions(query);
        if (!cancelled) {
          setSuggestions(users);
          const exactUser = findExactSuggestion(users, query);
          if (exactUser) onSelect?.(exactUser);
          setOpen(focused && Boolean(users.length));
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, query ? 70 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [focused, value]);

  return (
    <div className="roblox-search-field">
      <input
        value={value}
        onBlur={() => window.setTimeout(() => {
          setFocused(false);
          setOpen(false);
        }, 120)}
        onChange={(event) => {
          onChange(event.target.value);
          if (focused) setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
          void loadSuggestions(value, true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && suggestions[0]) {
            event.preventDefault();
            onChange(suggestions[0].username);
            onSelect?.(suggestions[0]);
            setOpen(false);
          }
        }}
        placeholder={placeholder}
      />
      {open && suggestions.length ? (
        <div className="roblox-suggestion-list">
          {suggestions.map((user) => (
            <button
              type="button"
              key={`${user.source}-${user.userId || user.username}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(user.username);
                onSelect?.(user);
                setOpen(false);
              }}
            >
              {user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={28} height={28} /> : <span className="suggestion-avatar">{user.username.slice(0, 2).toUpperCase()}</span>}
              <span>
                <strong>{user.username}</strong>
                <em>{user.displayName || user.username}</em>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LookupPanel({ role, profiles, activityLogs, activityMinuteEntries, weeklyAssignments }: { role: StaffRole | null; profiles: StaffProfile[]; activityLogs: ActivityLog[]; activityMinuteEntries: ActivityMinuteEntry[]; weeklyAssignments: WeeklyAssignment[] }) {
  const [query, setQuery] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<RobloxSuggestion | null>(null);
  const [lookupAttempted, setLookupAttempted] = useState(false);
  const [lookupSearching, setLookupSearching] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const matchingKnownProfile = profiles.find((profile) => profileMatchesQuery(profile, normalizedQuery));
  const inferredRole = matchingKnownProfile ? undefined : inferAssignableRoleFromRoblox(selectedSuggestion);
  const visibleRole = staffRoles.find((staffRole) => staffRole.id === matchingKnownProfile?.highestRoleId) || inferredRole;
  const matchingRole = getAssignableRole(visibleRole || null);
  const lookupNames = [
    selectedSuggestion?.username,
    selectedSuggestion?.displayName,
    matchingKnownProfile?.robloxUsername,
    matchingKnownProfile?.robloxDisplayName,
    matchingKnownProfile?.discordUsername,
    query.trim(),
  ].filter(Boolean).map((name) => String(name).toLowerCase());
  const lookupBlocked = Boolean(
    matchingKnownProfile
      ? !canLookupProfile(role, matchingKnownProfile)
      : role && visibleRole && role.level < 100 && visibleRole.level >= role.level
  );
  const assignment = matchingKnownProfile
    ? getAssignmentForProfile(matchingKnownProfile, weeklyAssignments)
    : weeklyAssignments.find((item) => item.teamRoleId === matchingRole?.id);
  const defaultAssignment = matchingRole ? defaultWeeklyAssignmentForRole(matchingRole.id) : undefined;
  const trainingGoal = assignment?.sessions ?? defaultAssignment?.sessions ?? 0;
  const minuteGoal = assignment?.minutes ?? defaultAssignment?.minutes ?? 0;
  const shiftGoal = assignment?.shifts ?? defaultAssignment?.shifts ?? 0;
  const hasLookupTarget = Boolean(matchingKnownProfile || selectedSuggestion);
  const canShowLookupHistory = Boolean(query.trim() && !lookupBlocked && matchingRole && hasLookupTarget);
  const lookupUsername = selectedSuggestion?.username || matchingKnownProfile?.robloxUsername || query.trim();

  async function runLookup() {
    if (!query.trim()) return;
    setLookupAttempted(true);
    if (selectedSuggestion?.username.toLowerCase() === query.trim().toLowerCase()) return;

    setLookupSearching(true);
    const exactSuggestion = await findExactRobloxSuggestion(query);
    if (exactSuggestion) setSelectedSuggestion(exactSuggestion);
    setLookupSearching(false);
  }

  function handleLookupSubmit(event: React.FormEvent) {
    event.preventDefault();
    void runLookup();
  }

  return (
    <div className="activity-panel">
      <div className="content-header">
        <div>
          <p className="eyebrow">Corporate Lookup</p>
          <h3>Search staff activity</h3>
        </div>
      </div>
      <form className="lookup-row" onSubmit={handleLookupSubmit}>
        <RobloxUserInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setLookupAttempted(false);
            if (selectedSuggestion && selectedSuggestion.username.toLowerCase() !== value.trim().toLowerCase()) setSelectedSuggestion(null);
          }}
          onSelect={setSelectedSuggestion}
        />
        <button className="button primary" type="button" onClick={() => void runLookup()}>{lookupSearching ? "Searching..." : "Search"}</button>
      </form>
      {selectedSuggestion ? (
        <div className="lookup-selected-user">
          <strong>{selectedSuggestion.username}</strong>
          <span>{selectedSuggestion.roleName || "Roblox group member"}{selectedSuggestion.roleRank ? ` - rank ${selectedSuggestion.roleRank}` : ""}</span>
        </div>
      ) : null}
      {lookupBlocked ? <EmptyState title="Lookup restricted" text="This profile is not below your current access level." /> : null}
      {query.trim() && lookupAttempted && !lookupBlocked && !matchingKnownProfile && !selectedSuggestion ? <EmptyState title="No Roblox group member found" text="Check the exact username and make sure this person is still in the Roblox group." /> : null}
      {query.trim() && !lookupBlocked && hasLookupTarget && !matchingRole ? <EmptyState title="No assignment role" text="This Roblox group role is not mapped to a staff activity team yet." /> : null}
      {query.trim() && !lookupBlocked && hasLookupTarget && matchingRole && !assignment ? <p className="muted lookup-note">Using the default {matchingRole.name} goals until weekly assignments are saved.</p> : null}
      {canShowLookupHistory ? (
        <div className="section-block">
          <div className="content-header">
            <div>
              <p className="eyebrow">History</p>
              <h3>Last 8 weeks</h3>
            </div>
          </div>
          <div className="week-history">
            {buildRecentWeeks().map((week) => {
              const weekResults = activityLogs.filter((log) => logIsInRange(log, week.start, week.end) && lookupNames.some((name) => activityLogIncludesUser(log, name)));
            const trainings = weekResults.filter((log) => log.type === "training").length;
            const shifts = weekResults.filter((log) => log.type === "shift").length;
            const minutes = weekResults.reduce((total, log) => total + (log.creditedMinutes || 0), 0) + sumTrackedMinutes(activityMinuteEntries, lookupNames.length ? lookupNames : [lookupUsername], week.start, week.end, selectedSuggestion?.userId || matchingKnownProfile?.robloxUserId);
            const trainingPercent = trainingGoal ? Math.min(100, Math.round((trainings / trainingGoal) * 100)) : 100;
            const minutePercent = minuteGoal ? Math.min(100, Math.round((minutes / minuteGoal) * 100)) : 100;
            const shiftPercent = shiftGoal ? Math.min(100, Math.round((shifts / shiftGoal) * 100)) : 100;
            const percent = Math.round((trainingPercent + minutePercent + shiftPercent) / 3);
            return (
              <article className={`week-cell ${percent >= 50 ? "complete" : "incomplete"}`} key={`${week.range}-${query}`}>
                <p className="muted">{week.range}</p>
                <h4>{matchingRole ? `${matchingRole.name} Assignments` : "Staff Assignments"}</h4>
                <div className="week-progress">
                  <span style={{ width: `${percent}%` }} />
                  <strong>{percent}%</strong>
                </div>
                <div className="week-cell-body">
                  <div className="week-metric"><p>Trainings</p><strong>{trainings}/{trainingGoal}</strong></div>
                  <div className="week-metric"><p>Minutes</p><strong>{minutes}/{minuteGoal}</strong></div>
                  <div className="week-metric"><p>Shifts</p><strong>{shifts}/{shiftGoal}</strong></div>
                </div>
              </article>
            );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LogsPanel({
  role,
  session,
  adminPermissions,
  activitySlotsConfig,
  activityLogs,
  profiles,
  createActivityLog,
  updateActivityLog,
  deleteActivityLog,
}: {
  role: StaffRole | null;
  session: DiscordSession;
  adminPermissions: Set<AdminPermission>;
  activitySlotsConfig: ActivitySlots;
  activityLogs: ActivityLog[];
  profiles: StaffProfile[];
  createActivityLog: (log: ActivityLogPayload) => Promise<void>;
  updateActivityLog: (logId: string, log: ActivityLogUpdatePayload) => Promise<void>;
  deleteActivityLog: (logId: string) => Promise<void>;
}) {
  const today = useMemo(() => getTodayDate(), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<{ type: "training" | "shift"; time: string } | null>(null);
  const weekStart = useMemo(() => addDays(startOfWeek(today), weekOffset * 7), [today, weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const dateLabel = formatDateLabel(selectedDate);
  const weekHasStarted = weekStart <= today;
  const canLog = (canCreateActivityLogs(role) || adminPermissions.has("manage_activity_logs")) && weekHasStarted;

  useEffect(() => {
    const selectedDateInWeek = weekDays.some((date) => sameDay(date, selectedDate));
    if (!selectedDateInWeek) {
      setSelectedDate(weekOffset === 0 ? today : weekStart);
      setSelectedSlot(null);
    }
  }, [selectedDate, today, weekDays, weekOffset, weekStart]);

  return (
    <div className="activity-panel">
      <div className="content-header">
        <div>
          <p className="eyebrow">Sessions</p>
          <h3>{formatHeadingDate(selectedDate)}</h3>
        </div>
        {canLog ? <span className="status-pill published">Can log</span> : <span className="status-pill">Read only</span>}
      </div>
      <div className="week-strip">
        <button className="week-arrow" type="button" disabled={weekOffset <= -5} onClick={() => setWeekOffset((offset) => Math.max(-5, offset - 1))}>‹</button>
        {weekDays.map((date) => (
          <button className={sameDay(selectedDate, date) ? "active" : ""} type="button" key={date.toISOString()} onClick={() => {
            setSelectedDate(date);
            setSelectedSlot(null);
          }}>
            <strong>{date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1)}</strong>
            <span>{date.getDate()}</span>
          </button>
        ))}
        <button className="week-arrow" type="button" disabled={weekOffset >= 5} onClick={() => setWeekOffset((offset) => Math.min(5, offset + 1))}>›</button>
      </div>
      {weekOffset < 0 ? <p className="muted centered-note">You are viewing previous weeks.</p> : null}
      {!weekHasStarted ? <p className="muted centered-note">Future weeks can be previewed, but logs cannot be edited before that week begins.</p> : null}
      <div className="slot-board">
        <div>
          <p className="eyebrow">Trainings</p>
          <div className="slot-grid">
            {activitySlotsConfig.trainings.map((time) => (
              <button className="slot-card training" type="button" key={time} onClick={() => setSelectedSlot({ type: "training", time })}>
                <p>{dateLabel}</p>
                <h4>Training {time}</h4>
                <span className={`slot-status ${getSlotStatusLabel(selectedDate, time).toLowerCase().replace(/\s+/g, "-")}`}>{getSlotStatusLabel(selectedDate, time)}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow">Shifts</p>
          <div className="slot-grid">
            {activitySlotsConfig.shifts.map((time) => (
              <button className="slot-card shift" type="button" key={time} onClick={() => setSelectedSlot({ type: "shift", time })}>
                <p>{dateLabel}</p>
                <h4>Shift {time}</h4>
                <span className={`slot-status ${getSlotStatusLabel(selectedDate, time).toLowerCase().replace(/\s+/g, "-")}`}>{getSlotStatusLabel(selectedDate, time)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {selectedSlot ? (
        <ActivityLogDetail
          role={role}
          session={session}
          adminPermissions={adminPermissions}
          slot={selectedSlot}
          dateLabel={dateLabel}
          canCreateServer={canLog}
          logs={activityLogs.filter((log) => log.type === selectedSlot.type && log.time === selectedSlot.time && log.dateLabel === dateLabel)}
          profiles={profiles}
          createActivityLog={createActivityLog}
          updateActivityLog={updateActivityLog}
          deleteActivityLog={deleteActivityLog}
          close={() => setSelectedSlot(null)}
        />
      ) : null}
    </div>
  );
}

function ActivityLogDetail({
  role,
  session,
  adminPermissions,
  slot,
  dateLabel,
  canCreateServer,
  logs,
  profiles,
  createActivityLog,
  updateActivityLog,
  deleteActivityLog,
  close,
}: {
  role: StaffRole | null;
  session: DiscordSession;
  adminPermissions: Set<AdminPermission>;
  slot: { type: "training" | "shift"; time: string };
  dateLabel: string;
  canCreateServer: boolean;
  logs: ActivityLog[];
  profiles: StaffProfile[];
  createActivityLog: (log: ActivityLogPayload) => Promise<void>;
  updateActivityLog: (logId: string, log: ActivityLogUpdatePayload) => Promise<void>;
  deleteActivityLog: (logId: string) => Promise<void>;
  close: () => void;
}) {
  const canLog = canCreateServer && (canCreateActivityLogs(role) || adminPermissions.has("manage_activity_logs"));
  const isTraining = slot.type === "training";
  const [formOpen, setFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<ActivityLog | null>(null);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="editor-modal activity-detail-modal">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Staff Activity</p>
            <h3>{isTraining ? "Training" : "Shift"} {slot.time}</h3>
            <p className="muted">{dateLabel}</p>
          </div>
          <button className="icon-button" type="button" onClick={close}>x</button>
        </div>
        <div className="server-log-toolbar">
          {canLog ? <button className="button primary" type="button" onClick={() => setFormOpen(true)}>Create New Server</button> : <span className="status-pill">Read only</span>}
        </div>
        {formOpen ? (
          <ActivityLogForm
            session={session}
            slot={slot}
            dateLabel={dateLabel}
            close={() => setFormOpen(false)}
            createActivityLog={async (log) => {
              await createActivityLog(log);
              setFormOpen(false);
            }}
          />
        ) : null}
        {editingLog ? (
          <ActivityLogForm
            session={session}
            slot={slot}
            dateLabel={dateLabel}
            existingLog={editingLog}
            close={() => setEditingLog(null)}
            createActivityLog={async (log) => {
              await updateActivityLog(editingLog.id, { roles: log.roles, notes: log.notes, creditedMinutes: log.creditedMinutes });
              setEditingLog(null);
            }}
          />
        ) : null}
        <div className="server-log-stack">
          {logs.length ? logs.map((log) => (
            <article className="server-log-card" key={log.id}>
              <div className="server-log-header">
                <h4>Server {log.serverNumber}</h4>
                <span className="status-pill published">Logged</span>
              </div>
              {log.type === "training" ? <TrainingServerPreview roles={log.roles as TrainingRoles} notes={log.notes} profiles={profiles} /> : <ShiftServerPreview roles={log.roles as ShiftRoles} notes={log.notes} profiles={profiles} />}
              {(role?.level && role.level >= 100) || adminPermissions.has("manage_activity_logs") || log.loggerDiscordUserId === session.discordUserId ? (
                <div className="dialog-actions">
                  <button className="button secondary" type="button" onClick={() => setEditingLog(log)}>Edit</button>
                  <button className="button secondary danger-text" type="button" onClick={() => deleteActivityLog(log.id)}>Delete</button>
                </div>
              ) : null}
            </article>
          )) : <EmptyState title="No server logged yet" text={canLog ? "Create a server log when a session is ready to be recorded." : "Published logs will appear here after Management+ logs them."} />}
        </div>
      </div>
    </div>
  );
}

function ActivityLogForm({
  session,
  slot,
  dateLabel,
  existingLog,
  close,
  createActivityLog,
}: {
  session: DiscordSession;
  slot: { type: "training" | "shift"; time: string };
  dateLabel: string;
  existingLog?: ActivityLog;
  close: () => void;
  createActivityLog: (log: ActivityLogPayload) => Promise<void>;
}) {
  const isTraining = slot.type === "training";
  const existingTrainingRoles = existingLog?.type === "training" ? existingLog.roles as TrainingRoles : null;
  const existingShiftRoles = existingLog?.type === "shift" ? existingLog.roles as ShiftRoles : null;
  const [host, setHost] = useState(existingTrainingRoles?.host || existingShiftRoles?.host || session.username);
  const [coHost, setCoHost] = useState(existingTrainingRoles?.coHost || existingShiftRoles?.coHost || "");
  const [overseerOne, setOverseerOne] = useState(existingTrainingRoles?.overseers[0] || "");
  const [overseerTwo, setOverseerTwo] = useState(existingTrainingRoles?.overseers[1] || "");
  const [trainerA, setTrainerA] = useState(existingTrainingRoles?.trainerA || "");
  const [assistantAOne, setAssistantAOne] = useState(existingTrainingRoles?.assistantsA[0] || "");
  const [assistantATwo, setAssistantATwo] = useState(existingTrainingRoles?.assistantsA[1] || "");
  const [trainerB, setTrainerB] = useState(existingTrainingRoles?.trainerB || "");
  const [assistantBOne, setAssistantBOne] = useState(existingTrainingRoles?.assistantsB[0] || "");
  const [assistantBTwo, setAssistantBTwo] = useState(existingTrainingRoles?.assistantsB[1] || "");
  const [trainerC, setTrainerC] = useState(existingTrainingRoles?.trainerC || "");
  const [assistantCOne, setAssistantCOne] = useState(existingTrainingRoles?.assistantsC[0] || "");
  const [assistantCTwo, setAssistantCTwo] = useState(existingTrainingRoles?.assistantsC[1] || "");
  const [attendeeOne, setAttendeeOne] = useState(existingShiftRoles?.attendees[0] || "");
  const [attendeeTwo, setAttendeeTwo] = useState(existingShiftRoles?.attendees[1] || "");
  const [notes, setNotes] = useState(existingLog?.notes || "");
  const [creditedMinutes, setCreditedMinutes] = useState(existingLog?.creditedMinutes || 0);

  function clean(values: string[]) {
    return values.map((value) => value.trim()).filter(Boolean).slice(0, 2);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!host.trim()) return;

    if (isTraining) {
      await createActivityLog({
        type: "training",
        dateLabel,
        time: slot.time,
        notes,
        creditedMinutes: 0,
        roles: {
          logger: session.username,
          host: host.trim(),
          coHost: coHost.trim(),
          overseers: clean([overseerOne, overseerTwo]),
          trainerA: trainerA.trim(),
          assistantsA: clean([assistantAOne, assistantATwo]),
          trainerB: trainerB.trim(),
          assistantsB: clean([assistantBOne, assistantBTwo]),
          trainerC: trainerC.trim(),
          assistantsC: clean([assistantCOne, assistantCTwo]),
        },
      });
      return;
    }

    await createActivityLog({
      type: "shift",
      dateLabel,
      time: slot.time,
      notes,
      creditedMinutes,
      roles: {
        logger: session.username,
        host: host.trim(),
        coHost: coHost.trim(),
        attendees: clean([attendeeOne, attendeeTwo]),
      },
    });
  }

  return (
    <form className="inline-log-form" onSubmit={handleSubmit}>
      <div className="content-header">
        <div>
          <p className="eyebrow">New Server</p>
          <h4>{existingLog ? "Edit" : "New"} {isTraining ? "Training Log" : "Shift Log"}</h4>
        </div>
        <button className="button secondary" type="button" onClick={close}>Cancel</button>
      </div>
      <div className="activity-form-grid">
        <label>Host<RobloxUserInput value={host} onChange={setHost} /></label>
        <label>Co-Host<RobloxUserInput value={coHost} onChange={setCoHost} placeholder="Optional" /></label>
        {isTraining ? (
          <>
            <label className="split-field"><span>Overseers</span><div className="split-inputs"><RobloxUserInput value={overseerOne} onChange={setOverseerOne} placeholder="Optional" /><RobloxUserInput value={overseerTwo} onChange={setOverseerTwo} placeholder="Optional" /></div></label>
            <label>Trainer A<RobloxUserInput value={trainerA} onChange={setTrainerA} placeholder="Optional" /></label>
            <label className="split-field"><span>Assistant A</span><div className="split-inputs"><RobloxUserInput value={assistantAOne} onChange={setAssistantAOne} placeholder="Optional" /><RobloxUserInput value={assistantATwo} onChange={setAssistantATwo} placeholder="Optional" /></div></label>
            <label>Trainer B<RobloxUserInput value={trainerB} onChange={setTrainerB} placeholder="Optional" /></label>
            <label className="split-field"><span>Assistant B</span><div className="split-inputs"><RobloxUserInput value={assistantBOne} onChange={setAssistantBOne} placeholder="Optional" /><RobloxUserInput value={assistantBTwo} onChange={setAssistantBTwo} placeholder="Optional" /></div></label>
            <label>Trainer C<RobloxUserInput value={trainerC} onChange={setTrainerC} placeholder="Optional" /></label>
            <label className="split-field"><span>Assistant C</span><div className="split-inputs"><RobloxUserInput value={assistantCOne} onChange={setAssistantCOne} placeholder="Optional" /><RobloxUserInput value={assistantCTwo} onChange={setAssistantCTwo} placeholder="Optional" /></div></label>
          </>
        ) : (
          <label className="split-field"><span>Attendees</span><div className="split-inputs"><RobloxUserInput value={attendeeOne} onChange={setAttendeeOne} placeholder="Optional" /><RobloxUserInput value={attendeeTwo} onChange={setAttendeeTwo} placeholder="Optional" /></div></label>
        )}
      </div>
      <label className="notes-field">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional notes" /></label>
      {!isTraining ? <label className="notes-field">Credited minutes<input min={0} type="number" value={creditedMinutes} onChange={(event) => setCreditedMinutes(Number(event.target.value))} placeholder="0" /></label> : null}
      <div className="dialog-actions">
        <button className="button primary" type="submit">Save {isTraining ? "Training" : "Shift"} Log</button>
      </div>
    </form>
  );
}

function getProfileForName(profiles: StaffProfile[], name: string) {
  const normalizedName = name.trim().toLowerCase();
  return profiles.find((profile) =>
    profile.robloxUsername?.toLowerCase() === normalizedName ||
    profile.discordUsername.toLowerCase() === normalizedName
  );
}

function NamePills({ names, profiles = [], tone = "default" }: { names: string[]; profiles?: StaffProfile[]; tone?: string }) {
  if (!names.length) return <span className="muted-name">None</span>;
  return (
    <span className={`name-pills role-tone-${tone}`}>
      {names.map((name, index) => <RobloxNameCard name={name} profiles={profiles} key={`${name}-${index}`} />)}
    </span>
  );
}

function RobloxNameCard({ name, profiles }: { name: string; profiles: StaffProfile[] }) {
  const profile = getProfileForName(profiles, name);
  const [avatarUrl, setAvatarUrl] = useState(profile?.robloxAvatarUrl || profile?.avatarUrl || "");
  const displayName = profile?.robloxUsername || name;

  useEffect(() => {
    let cancelled = false;
    if (avatarUrl || name.trim().length < 2) return;

    getRobloxSuggestions(name).then((users) => {
      if (cancelled) return;
      const exactUser = users.find((user) => user.username.toLowerCase() === name.trim().toLowerCase());
      if (exactUser?.avatarUrl) setAvatarUrl(exactUser.avatarUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [avatarUrl, name]);

  return (
    <em title={displayName}>
      {avatarUrl ? <Image src={avatarUrl} alt="" width={32} height={32} /> : <span className="name-initials">{displayName.slice(0, 2).toUpperCase()}</span>}
      <span>{displayName}</span>
    </em>
  );
}

function TrainingServerPreview({ roles, notes, profiles }: { roles: TrainingRoles; notes: string; profiles: StaffProfile[] }) {
  return (
    <div className="assignment-lanes">
      <div className="assignment-lane">
        <h3>Oversight</h3>
        <div className="role-line"><strong>Logger</strong><NamePills names={[roles.logger].filter(Boolean)} profiles={profiles} tone="logger" /></div>
        <div className="role-line"><strong>Overseers</strong><NamePills names={roles.overseers} profiles={profiles} tone="overseer" /></div>
      </div>
      <div className="assignment-lane">
        <h3>Hosting</h3>
        <div className="role-line"><strong>Host</strong><NamePills names={[roles.host].filter(Boolean)} profiles={profiles} tone="host" /></div>
        <div className="role-line"><strong>Co-Host</strong><NamePills names={[roles.coHost || ""].filter(Boolean)} profiles={profiles} tone="cohost" /></div>
      </div>
      <div className="assignment-lane"><h3>Group A</h3><div className="role-line"><strong>Trainer</strong><NamePills names={[roles.trainerA || ""].filter(Boolean)} profiles={profiles} tone="trainer" /></div><div className="role-line"><strong>Assistants</strong><NamePills names={roles.assistantsA} profiles={profiles} tone="assistant" /></div></div>
      <div className="assignment-lane"><h3>Group B</h3><div className="role-line"><strong>Trainer</strong><NamePills names={[roles.trainerB || ""].filter(Boolean)} profiles={profiles} tone="trainer" /></div><div className="role-line"><strong>Assistants</strong><NamePills names={roles.assistantsB} profiles={profiles} tone="assistant" /></div></div>
      <div className="assignment-lane"><h3>Group C</h3><div className="role-line"><strong>Trainer</strong><NamePills names={[roles.trainerC || ""].filter(Boolean)} profiles={profiles} tone="trainer" /></div><div className="role-line"><strong>Assistants</strong><NamePills names={roles.assistantsC} profiles={profiles} tone="assistant" /></div></div>
      <div className="assignment-lane notes-lane">
        <h3>Notes</h3>
        <p>{notes || "No notes added."}</p>
      </div>
    </div>
  );
}

function ShiftServerPreview({ roles, notes, profiles }: { roles: ShiftRoles; notes: string; profiles: StaffProfile[] }) {
  return (
    <div className="assignment-lanes shift-lanes">
      <div className="assignment-lane">
        <h3>Shift Roles</h3>
        <div className="role-line"><strong>Logger</strong><NamePills names={[roles.logger].filter(Boolean)} profiles={profiles} tone="logger" /></div>
        <div className="role-line"><strong>Host</strong><NamePills names={[roles.host].filter(Boolean)} profiles={profiles} tone="host" /></div>
        <div className="role-line"><strong>Co-Host</strong><NamePills names={[roles.coHost || ""].filter(Boolean)} profiles={profiles} tone="cohost" /></div>
        <div className="role-line"><strong>Attendees</strong><NamePills names={roles.attendees} profiles={profiles} tone="attendee" /></div>
      </div>
      <div className="assignment-lane notes-lane">
        <h3>Notes</h3>
        <p>{notes || "No notes added."}</p>
      </div>
    </div>
  );
}

function AssignmentsPanel({ role, adminPermissions, activitySlotsConfig, weeklyAssignments, saveWeeklyAssignment, saveActivitySlots, deleteWeeklyAssignment }: { role: StaffRole | null; adminPermissions: Set<AdminPermission>; activitySlotsConfig: ActivitySlots; weeklyAssignments: WeeklyAssignment[]; saveWeeklyAssignment: (assignment: Partial<WeeklyAssignment> & Pick<WeeklyAssignment, "teamRoleId" | "sessions" | "minutes" | "shifts">) => Promise<void>; saveActivitySlots: (slots: ActivitySlots) => Promise<void>; deleteWeeklyAssignment: (assignmentId: string) => Promise<void> }) {
  const [teamRoleId, setTeamRoleId] = useState<StaffRoleId>("management-team");
  const [sessions, setSessions] = useState(2);
  const [minutes, setMinutes] = useState(60);
  const [shifts, setShifts] = useState(1);
  const [trainingSlotInputs, setTrainingSlotInputs] = useState(slotLabelsToInputs(activitySlotsConfig.trainings));
  const [shiftSlotInputs, setShiftSlotInputs] = useState(slotLabelsToInputs(activitySlotsConfig.shifts));
  const manageableTeams = staffRoles.filter((staffRole) => ["supervision-team", "management-team", "corporate-team"].includes(staffRole.id));
  const canManageAssignments = Boolean((role?.level && role.level >= 100) || adminPermissions.has("manage_assignments"));
  const canManageSlots = Boolean((role?.level && role.level >= 100) || adminPermissions.has("manage_assignments") || adminPermissions.has("manage_activity_slots"));

  useEffect(() => {
    setTrainingSlotInputs(slotLabelsToInputs(activitySlotsConfig.trainings));
    setShiftSlotInputs(slotLabelsToInputs(activitySlotsConfig.shifts));
  }, [activitySlotsConfig]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await saveWeeklyAssignment({ teamRoleId, sessions, minutes, shifts });
  }

  async function handleSlotSubmit(event: React.FormEvent) {
    event.preventDefault();
    await saveActivitySlots({
      trainings: slotInputsToLabels(trainingSlotInputs),
      shifts: slotInputsToLabels(shiftSlotInputs),
    });
  }

  function updateSlot(type: "training" | "shift", index: number, value: string) {
    const updater = (current: string[]) => current.map((slot, slotIndex) => (slotIndex === index ? value : slot));
    if (type === "training") setTrainingSlotInputs(updater);
    else setShiftSlotInputs(updater);
  }

  function addSlot(type: "training" | "shift") {
    if (type === "training") setTrainingSlotInputs((current) => [...current, "18:00"]);
    else setShiftSlotInputs((current) => [...current, "18:00"]);
  }

  function removeSlot(type: "training" | "shift", index: number) {
    const updater = (current: string[]) => current.filter((_, slotIndex) => slotIndex !== index);
    if (type === "training") setTrainingSlotInputs((current) => updater(current).length ? updater(current) : ["18:00"]);
    else setShiftSlotInputs((current) => updater(current).length ? updater(current) : ["18:00"]);
  }

  return (
    <div className="activity-panel">
      <div className="content-header">
        <div>
          <p className="eyebrow">Weekly Assignments</p>
          <h3>Team quotas</h3>
        </div>
      </div>
      {canManageAssignments ? (
        <form className="assignment-form" onSubmit={handleSubmit}>
          <select value={teamRoleId} onChange={(event) => setTeamRoleId(event.target.value as StaffRoleId)}>
            {manageableTeams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
          </select>
          <input min={0} type="number" value={sessions} onChange={(event) => setSessions(Number(event.target.value))} placeholder="Sessions" />
          <input min={0} type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} placeholder="Minutes" />
          <input min={0} type="number" value={shifts} onChange={(event) => setShifts(Number(event.target.value))} placeholder="Shifts" />
          <button className="button primary" type="submit">Save Assignment</button>
        </form>
      ) : null}
      <div className="resource-grid assignment-card-grid">
        {weeklyAssignments.map((assignment) => {
          const team = staffRoles.find((staffRole) => staffRole.id === assignment.teamRoleId);
          return (
            <article className="resource-card" key={assignment.id}>
              <p className="eyebrow">{assignment.effectiveFrom}</p>
              <h4>{team?.name || assignment.teamRoleId}</h4>
              <p>{pluralize(assignment.sessions, "session")} - {pluralize(assignment.minutes, "minute")} - {pluralize(assignment.shifts, "shift")}</p>
              {canManageAssignments ? <button className="button secondary danger-text" type="button" onClick={() => deleteWeeklyAssignment(assignment.id)}>Delete</button> : null}
            </article>
          );
        })}
      </div>
      {canManageSlots ? (
        <form className="slot-editor-form" onSubmit={handleSlotSubmit}>
          <div>
            <p className="eyebrow">Activity Slots</p>
            <h4>Training and shift times</h4>
            <p className="muted">One slot per line. These control the visible training and shift cards.</p>
          </div>
          <SlotTimeEditor title="Training slots" type="training" values={trainingSlotInputs} updateSlot={updateSlot} addSlot={addSlot} removeSlot={removeSlot} />
          <SlotTimeEditor title="Shift slots" type="shift" values={shiftSlotInputs} updateSlot={updateSlot} addSlot={addSlot} removeSlot={removeSlot} />
          <div className="dialog-actions">
            <button className="button primary" type="submit">Save Slots</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function SlotTimeEditor({
  title,
  type,
  values,
  updateSlot,
  addSlot,
  removeSlot,
}: {
  title: string;
  type: "training" | "shift";
  values: string[];
  updateSlot: (type: "training" | "shift", index: number, value: string) => void;
  addSlot: (type: "training" | "shift") => void;
  removeSlot: (type: "training" | "shift", index: number) => void;
}) {
  return (
    <div className="slot-time-editor">
      <div className="slot-time-header">
        <strong>{title}</strong>
        <button className="button secondary compact-action" type="button" onClick={() => addSlot(type)}>Add time</button>
      </div>
      <div className="slot-time-list">
        {values.map((value, index) => (
          <label className="slot-time-row" key={`${type}-${index}`}>
            <span>{type === "training" ? "Training" : "Shift"} {index + 1}</span>
            <input type="time" value={value} onChange={(event) => updateSlot(type, index, event.target.value)} />
            <em>{timeInputValueToLabel(value)}</em>
            <button className="icon-button" type="button" onClick={() => removeSlot(type, index)}>x</button>
          </label>
        ))}
      </div>
    </div>
  );
}

function LeaderboardsPanel({ activityLogs }: { activityLogs: ActivityLog[] }) {
  const trainingLeaders = activityLogs.filter((log) => log.type === "training").length;
  const shiftLeaders = activityLogs.filter((log) => log.type === "shift").length;
  return (
    <div className="leaderboard-grid">
      {leaderboards.map(([title, winner, value, current], index) => (
        <article className={`leaderboard-card tone-${index}`} key={title}>
          <div className="leaderboard-head">
            <div>
              <p className="eyebrow">{title}</p>
              <h4>{title} board</h4>
            </div>
            <span>Top 3</span>
          </div>
          <div className="leaderboard-winner">
            <span className="rank-avatar">{winner.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{winner}</strong>
              <p className="muted">Top spot - {value}</p>
            </div>
          </div>
          <div className="leaderboard-rows">
            <div className="leaderboard-row"><span>#2</span><strong>{index === 0 ? "MayaChef" : index === 1 ? "SamuelWK" : "NoraPR"}</strong><em>{index === 0 ? "214 min" : index === 1 ? "7 logs" : "4 logs"}</em></div>
            <div className="leaderboard-row"><span>#3</span><strong>{index === 0 ? "LucaHost" : index === 1 ? "AveryHR" : "MayaChef"}</strong><em>{index === 0 ? "199 min" : index === 1 ? "6 logs" : "3 logs"}</em></div>
          </div>
          <div className="leaderboard-current">
            <span>Your position</span>
            <strong>{title === "Trainings" ? `${trainingLeaders} logged` : title === "Shifts" ? `${shiftLeaders} logged` : current}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}

function RecoveryBinView({
  deletedCategories,
  deletedAssignments,
  deletedActivityLogs,
  deletedCategoryLinks,
  deletedLinks,
  deletedResources,
  role,
  adminPermissions,
  restoreCategory,
  restoreWeeklyAssignment,
  restoreActivityLog,
  restoreCategoryLink,
  restoreQuickLink,
  restoreResource,
  permanentlyDeleteCategory,
  permanentlyDeleteWeeklyAssignment,
  permanentlyDeleteActivityLog,
  permanentlyDeleteCategoryLink,
  permanentlyDeleteQuickLink,
  permanentlyDeleteResource,
}: {
  deletedCategories: Category[];
  deletedAssignments: WeeklyAssignment[];
  deletedActivityLogs: ActivityLog[];
  deletedCategoryLinks: Array<{ categoryId: string; categoryName: string; link: QuickLink }>;
  deletedLinks: QuickLink[];
  deletedResources: Array<{ categoryId: string; categoryName: string; resource: Resource }>;
  role: StaffRole | null;
  adminPermissions: Set<AdminPermission>;
  restoreCategory: (categoryId: string) => void;
  restoreWeeklyAssignment: (assignmentId: string) => void;
  restoreActivityLog: (logId: string) => void;
  restoreCategoryLink: (categoryId: string, linkId: string) => void;
  restoreQuickLink: (linkId: string) => void;
  restoreResource: (resourceId: string) => void;
  permanentlyDeleteCategory: (categoryId: string) => void;
  permanentlyDeleteWeeklyAssignment: (assignmentId: string) => void;
  permanentlyDeleteActivityLog: (logId: string) => void;
  permanentlyDeleteCategoryLink: (categoryId: string, linkId: string) => void;
  permanentlyDeleteQuickLink: (linkId: string) => void;
  permanentlyDeleteResource: (resourceId: string) => void;
}) {
  const hasDeletedItems = deletedCategories.length || deletedAssignments.length || deletedActivityLogs.length || deletedCategoryLinks.length || deletedLinks.length || deletedResources.length;
  const canDeletePermanently = role?.id === "owner" || adminPermissions.has("delete_permanently");
  const canRestoreStandardItem = Boolean((role?.level && role.level >= 100) || adminPermissions.has("restore_from_bin"));
  const canRestoreOwnerItem = role?.id === "owner" || adminPermissions.has("restore_from_bin");

  return (
    <section className="workspace">
      <div className="content-header">
        <div>
          <p className="eyebrow">Recovery</p>
          <h3>Recovery Bin</h3>
        </div>
      </div>
      <div className="resource-grid">
        {deletedCategories.map((category) => (
          <article className="resource-card" key={category.id}>
            <p className="eyebrow">Category</p>
            <h4>{category.name}</h4>
            <p>Moved by {category.deletedBy || "Unknown"}</p>
            <p className="muted">{category.resources.length} resources included</p>
            <div className="header-actions">
              {canRestoreOwnerItem ? <button className="button secondary" type="button" onClick={() => restoreCategory(category.id)}>Restore</button> : null}
              {canDeletePermanently ? <button className="button secondary danger-text" type="button" onClick={() => permanentlyDeleteCategory(category.id)}>Permanently Delete</button> : null}
            </div>
          </article>
        ))}
        {deletedLinks.map((link) => (
          <article className="resource-card" key={link.id}>
            <p className="eyebrow">Quick Link</p>
            <h4>{link.label}</h4>
            <p>Moved by {link.deletedBy || "Unknown"}</p>
            <p className="muted">{link.url}</p>
            <div className="header-actions">
              {canRestoreOwnerItem ? <button className="button secondary" type="button" onClick={() => restoreQuickLink(link.id)}>Restore</button> : null}
              {canDeletePermanently ? <button className="button secondary danger-text" type="button" onClick={() => permanentlyDeleteQuickLink(link.id)}>Permanently Delete</button> : null}
            </div>
          </article>
        ))}
        {deletedAssignments.map((assignment) => {
          const team = staffRoles.find((staffRole) => staffRole.id === assignment.teamRoleId);
          return (
            <article className="resource-card" key={assignment.id}>
              <p className="eyebrow">Weekly Assignment</p>
              <h4>{team?.name || assignment.teamRoleId}</h4>
              <p>{assignment.sessions} sessions - {assignment.minutes} minutes - {assignment.shifts} shifts</p>
              <p className="muted">Moved by {assignment.deletedBy || "Unknown"}</p>
              <div className="header-actions">
                {canRestoreStandardItem ? <button className="button secondary" type="button" onClick={() => restoreWeeklyAssignment(assignment.id)}>Restore</button> : null}
                {canDeletePermanently ? <button className="button secondary danger-text" type="button" onClick={() => permanentlyDeleteWeeklyAssignment(assignment.id)}>Permanently Delete</button> : null}
              </div>
            </article>
          );
        })}
        {deletedActivityLogs.map((log) => (
          <article className="resource-card" key={log.id}>
            <p className="eyebrow">Activity Log</p>
            <h4>{log.type} - {log.dateLabel} {log.time}</h4>
            <p>Server {log.serverNumber} - logged by {log.loggerUsername}</p>
            <p className="muted">Moved by {log.deletedBy || "Unknown"}</p>
            <div className="header-actions">
              {canRestoreStandardItem ? <button className="button secondary" type="button" onClick={() => restoreActivityLog(log.id)}>Restore</button> : null}
              {canDeletePermanently ? <button className="button secondary danger-text" type="button" onClick={() => permanentlyDeleteActivityLog(log.id)}>Permanently Delete</button> : null}
            </div>
          </article>
        ))}
        {deletedCategoryLinks.map((item) => (
          <article className="resource-card" key={`${item.categoryId}-${item.link.id}`}>
            <p className="eyebrow">{item.categoryName} Link</p>
            <h4>{item.link.label}</h4>
            <p>Moved by {item.link.deletedBy || "Unknown"}</p>
            <p className="muted">{item.link.url}</p>
            <div className="header-actions">
              {canRestoreStandardItem ? <button className="button secondary" type="button" onClick={() => restoreCategoryLink(item.categoryId, item.link.id)}>Restore</button> : null}
              {canDeletePermanently ? <button className="button secondary danger-text" type="button" onClick={() => permanentlyDeleteCategoryLink(item.categoryId, item.link.id)}>Permanently Delete</button> : null}
            </div>
          </article>
        ))}
        {deletedResources.length ? deletedResources.map((item) => (
          <article className="resource-card" key={item.resource.id}>
            <p className="eyebrow">{item.categoryName}</p>
            <h4>{item.resource.title}</h4>
            <p>Moved by {item.resource.deletedBy || "Unknown"}</p>
            <div className="header-actions">
              {canRestoreStandardItem ? <button className="button secondary" type="button" onClick={() => restoreResource(item.resource.id)}>Restore</button> : null}
              {canDeletePermanently ? <button className="button secondary danger-text" type="button" onClick={() => permanentlyDeleteResource(item.resource.id)}>Permanently Delete</button> : null}
            </div>
          </article>
        )) : null}
        {!hasDeletedItems ? <EmptyState title="The recovery bin is empty" text="Deleted resources and categories will appear here." /> : null}
      </div>
    </section>
  );
}

function AuditLogsView({ logs }: { logs: AuditLog[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const logsPerPage = 12;
  const filteredLogs = logs.filter((log) => `${log.action} ${log.detail} ${log.actor} ${log.type}`.toLowerCase().includes(query.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / logsPerPage));
  const currentPage = Math.min(page, pageCount);
  const pageLogs = filteredLogs.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage);

  useEffect(() => {
    setPage(1);
  }, [query, logs.length]);

  return (
    <section className="workspace">
      <div className="content-header">
        <div>
          <p className="eyebrow">Security</p>
          <h3>Audit Logs</h3>
        </div>
      </div>
      <div className="audit-filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by user, document, category, or action" />
      </div>
      <div className="audit-pagination">
        <span>{filteredLogs.length} logs - Page {currentPage} of {pageCount}</span>
        <div className="header-actions">
          <button className="button secondary" type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <button className="button secondary" type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button>
        </div>
      </div>
      <div className="audit-log-list">
        {pageLogs.length ? pageLogs.map((log) => (
          <article className="audit-log-item" key={log.id}>
            <strong>{log.action}</strong>
            <span>{log.detail}</span>
            <span>By {log.actor} - {new Date(log.createdAt).toLocaleString()} - {log.type}</span>
          </article>
        )) : <EmptyState title="No activity yet" text="Actions taken by Leadership and admins will appear here." />}
      </div>
    </section>
  );
}

function AdminUsersView({
  profiles,
  adminLevels,
  adminGrants,
  saveAdminLevels,
  addAdminGrant,
  revokeAdminGrant,
}: {
  profiles: StaffProfile[];
  adminLevels: AdminLevel[];
  adminGrants: AdminGrant[];
  saveAdminLevels: (adminLevels: AdminLevel[]) => Promise<void>;
  addAdminGrant: (grant: { discordUserId: string; adminLevelId: string }) => Promise<void>;
  revokeAdminGrant: (grantId: string) => Promise<void>;
}) {
  const [levelsDraft, setLevelsDraft] = useState<AdminLevel[]>(adminLevels);
  const [discordUserId, setDiscordUserId] = useState("");
  const [adminLevelId, setAdminLevelId] = useState(adminLevels[0]?.id || "");

  function updateLevelName(levelId: string, name: string) {
    setLevelsDraft((current) => current.map((level) => level.id === levelId ? { ...level, name } : level));
  }

  function togglePermission(levelId: string, permission: AdminPermission) {
    setLevelsDraft((current) => current.map((level) => {
      if (level.id !== levelId) return level;
      const permissions = level.permissions.includes(permission)
        ? level.permissions.filter((item) => item !== permission)
        : [...level.permissions, permission];
      return { ...level, permissions };
    }));
  }

  function addLevel() {
    const id = `custom-admin-${Date.now()}`;
    setLevelsDraft((current) => [...current, { id, name: "New Admin Level", permissions: [] }]);
    setAdminLevelId(id);
  }

  async function submitGrant(event: React.FormEvent) {
    event.preventDefault();
    if (!discordUserId.trim() || !adminLevelId) return;
    await addAdminGrant({ discordUserId: discordUserId.trim(), adminLevelId });
    setDiscordUserId("");
  }

  return (
    <section className="workspace">
      <div className="content-header">
        <div>
          <p className="eyebrow">Owner Controls</p>
          <h3>Admin Users</h3>
        </div>
        <div className="header-actions">
          <button className="button secondary" type="button" onClick={addLevel}>Add Level</button>
          <button className="button primary" type="button" onClick={() => saveAdminLevels(levelsDraft)}>Save Levels</button>
        </div>
      </div>
      <div className="admin-layout">
        <article className="admin-card">
          <p className="eyebrow">Permission Matrix</p>
          <h4>What each admin level can do</h4>
          <div className="admin-levels-table">
            <div className="admin-level-row admin-level-head">
              <span>Level</span>
              {adminPermissionKeys.map((permission) => <span key={permission}>{adminPermissionLabels[permission]}</span>)}
            </div>
            {levelsDraft.map((level) => (
              <div className="admin-level-row" key={level.id}>
                <input value={level.name} onChange={(event) => updateLevelName(level.id, event.target.value)} />
                {adminPermissionKeys.map((permission) => {
                  const hasPermission = level.permissions.includes(permission);
                  return (
                    <label className={hasPermission ? "permission-check checked" : "permission-check"} key={permission}>
                      <input type="checkbox" checked={hasPermission} onChange={() => togglePermission(level.id, permission)} />
                      <span>{hasPermission ? "Allowed" : "Blocked"}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </article>
        <article className="admin-card">
          <p className="eyebrow">Current Grants</p>
          <h4>Extra admins</h4>
          <form className="admin-grant-form" onSubmit={submitGrant}>
            <input value={discordUserId} onChange={(event) => setDiscordUserId(event.target.value)} placeholder="Discord user ID" />
            <select value={adminLevelId} onChange={(event) => setAdminLevelId(event.target.value)}>
              {levelsDraft.map((level) => <option value={level.id} key={level.id}>{level.name}</option>)}
            </select>
            <button className="button primary" type="submit">Add Admin</button>
          </form>
          <div className="admin-grant-list">
            {adminGrants.length ? adminGrants.map((grant) => {
              const level = levelsDraft.find((item) => item.id === grant.adminLevelId);
              return (
                <div className="admin-grant-row" key={grant.id}>
                  <div>
                    <strong>{grant.discordUserId}</strong>
                    <p className="muted">{level?.name || grant.adminLevelId} - granted by {grant.grantedBy}</p>
                  </div>
                  <button className="button secondary danger-text" type="button" onClick={() => revokeAdminGrant(grant.id)}>Revoke</button>
                </div>
              );
            }) : (
              <div>
                <strong>No extra admins yet</strong>
                <p className="muted">When you grant a Discord user an admin level, they will appear here.</p>
              </div>
            )}
          </div>
        </article>
        <article className="admin-card">
          <p className="eyebrow">Connected Profiles</p>
          <h4>Recent Discord accounts</h4>
          <div className="admin-grant-list">
            {profiles.length ? profiles.map((profile) => {
              const role = staffRoles.find((staffRole) => staffRole.id === profile.highestRoleId);
              return (
                <div className="admin-grant-row profile-row" key={profile.discordUserId}>
                  {profile.robloxAvatarUrl ? <Image className="avatar" src={profile.robloxAvatarUrl} alt="" width={42} height={42} /> : null}
                  <div>
                    <strong>{profile.discordUsername}</strong>
                    <p className="muted">{role?.name || "No matching role"} - {profile.robloxUsername || "Roblox not linked"}</p>
                    {profile.robloxUserId ? <p className="muted">Roblox ID {profile.robloxUserId}</p> : null}
                    <p className="muted">{profile.discordUserId}</p>
                  </div>
                </div>
              );
            }) : (
              <div>
                <strong>No profile history yet</strong>
                <p className="muted">Profiles appear here after staff sign in with Discord.</p>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

