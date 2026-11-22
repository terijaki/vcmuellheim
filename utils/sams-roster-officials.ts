import { slugify } from "@utils/slugify";

/** SAMS role with no value on the public team page — filtered by exact label match (after trim). */
export const SAMS_ROSTER_EXCLUDED_ROLE = "Kontaktperson Spieltag";

/** SAMS roster role labels that duplicate CMS team trainers — stripped on name match. */
export const SAMS_ROSTER_TRAINER_ROLES: ReadonlySet<string> = new Set([
  "Trainer",
  "Trainerin",
  "Co-Trainer",
  "Co-Trainerin",
  "Coach",
]);

export type SamsRosterOfficialView = {
  uuid: string;
  name: string;
  role?: string;
};

/** SAMS often returns "Nachname, Vorname" — prefer "Vorname Nachname" for display and matching. */
export function rosterOfficialDisplayName(name: string): string {
  const comma = name.indexOf(",");
  if (comma === -1) {
    return name.trim().replaceAll(/\s+/g, " ");
  }
  const last = name.slice(0, comma).trim();
  const first = name.slice(comma + 1).trim();
  if (!last || !first) {
    return name.trim().replaceAll(/\s+/g, " ");
  }
  return `${first} ${last}`;
}

/** Given name used for roster player sorting (Vorname when SAMS uses comma format). */
export function rosterOfficialSortGivenName(name: string): string {
  const comma = name.indexOf(",");
  if (comma === -1) {
    return rosterOfficialDisplayName(name);
  }
  const last = name.slice(0, comma).trim();
  const first = name.slice(comma + 1).trim();
  if (!last || !first) {
    return rosterOfficialDisplayName(name);
  }
  return first;
}

export function rosterOfficialNameSlug(name: string): string {
  return slugify(rosterOfficialDisplayName(name), true);
}

function isSamsTrainerRole(role: string): boolean {
  return SAMS_ROSTER_TRAINER_ROLES.has(role.trim());
}

function mergeRoleLabels(roles: string[]): string {
  const unique = [...new Set(roles.map((role) => role.trim()).filter(Boolean))];
  unique.sort((a, b) => a.localeCompare(b, "de"));
  return unique.join(", ");
}

export type DedupeSamsRosterOfficialsOptions = {
  /** Display names of trainers assigned to the team in the CMS (used for slug matching). */
  cmsTrainerNames?: readonly string[];
};

/**
 * Prepares SAMS roster officials for the public team page: drops excluded roles,
 * merges duplicate people by name slug, and hides SAMS trainer roles when the
 * same person is already listed as a CMS team trainer.
 *
 * People are matched by a normalized full-name slug (Vorname + Nachname). Rows with
 * the same slug merge; different middle names or spelling in the slug keep separate entries.
 */
export function dedupeSamsRosterOfficials(
  officials: readonly SamsRosterOfficialView[],
  options: DedupeSamsRosterOfficialsOptions = {},
): SamsRosterOfficialView[] {
  const cmsTrainerSlugs = new Set(
    (options.cmsTrainerNames ?? []).map((name) => rosterOfficialNameSlug(name)).filter(Boolean),
  );

  const roleRows = officials
    .map((official) => ({
      ...official,
      role: official.role?.trim(),
    }))
    .filter((official) => official.role && official.role.trim() !== SAMS_ROSTER_EXCLUDED_ROLE);

  const byNameSlug = new Map<
    string,
    { uuid: string; name: string; roles: string[]; sortKey: string }
  >();

  for (const official of roleRows) {
    const nameSlug = rosterOfficialNameSlug(official.name);
    if (!nameSlug) continue;

    const existing = byNameSlug.get(nameSlug);
    const role = official.role as string;
    if (existing) {
      existing.roles.push(role);
      if (official.uuid.localeCompare(existing.sortKey) < 0) {
        existing.uuid = official.uuid;
        existing.sortKey = official.uuid;
      }
    } else {
      byNameSlug.set(nameSlug, {
        uuid: official.uuid,
        name: official.name,
        roles: [role],
        sortKey: official.uuid,
      });
    }
  }

  const merged: SamsRosterOfficialView[] = [];

  for (const [nameSlug, group] of byNameSlug) {
    let roles = group.roles;
    if (cmsTrainerSlugs.has(nameSlug)) {
      roles = roles.filter((role) => !isSamsTrainerRole(role));
    }
    if (roles.length === 0) continue;

    merged.push({
      uuid: group.uuid,
      name: group.name,
      role: mergeRoleLabels(roles),
    });
  }

  merged.sort((a, b) =>
    rosterOfficialDisplayName(a.name).localeCompare(rosterOfficialDisplayName(b.name), "de"),
  );

  return merged;
}
