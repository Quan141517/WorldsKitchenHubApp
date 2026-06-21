import type { ShiftRoles, TrainingRoles } from "./mock-data";

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 32) : "";
}

function uniqueNames(values: unknown[], limit: number) {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const value of values) {
    const name = cleanName(value);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= limit) break;
  }

  return names;
}

export function sanitizeTrainingRoles(roles: Partial<TrainingRoles> | undefined, loggerUsername: string): TrainingRoles {
  return {
    logger: loggerUsername,
    host: cleanName(roles?.host),
    coHost: cleanName(roles?.coHost),
    overseers: uniqueNames(roles?.overseers || [], 2),
    trainerA: cleanName(roles?.trainerA),
    assistantsA: uniqueNames(roles?.assistantsA || [], 2),
    trainerB: cleanName(roles?.trainerB),
    assistantsB: uniqueNames(roles?.assistantsB || [], 2),
    trainerC: cleanName(roles?.trainerC),
    assistantsC: uniqueNames(roles?.assistantsC || [], 2),
  };
}

export function sanitizeShiftRoles(roles: Partial<ShiftRoles> | undefined, loggerUsername: string): ShiftRoles {
  return {
    logger: loggerUsername,
    host: cleanName(roles?.host),
    coHost: cleanName(roles?.coHost),
    attendees: uniqueNames(roles?.attendees || [], 2),
  };
}
