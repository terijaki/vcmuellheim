import { createHash } from "node:crypto";
import type { RosterOfficial, RosterPlayer } from "@/lambda/sams/types";

export function pseudoRosterUuid(
  teamUuid: string,
  kind: "player" | "official",
  ...parts: (string | number | undefined)[]
): string {
  const input = [teamUuid, kind, ...parts.map((part) => String(part ?? ""))].join("|");
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function mapRosterPlayers(
  teamUuid: string,
  players: Array<{
    uuid?: string;
    name?: string | null;
    jerseyNumber?: number | null;
    position?: string | null;
    portraitImageLink?: string | null;
  }> = [],
): RosterPlayer[] {
  return players
    .filter((p): p is typeof p & { name: string } => !!p.name?.trim())
    .map((p) => ({
      uuid: p.uuid ?? pseudoRosterUuid(teamUuid, "player", p.name, p.jerseyNumber ?? undefined),
      name: p.name,
      ...(p.jerseyNumber != null ? { jerseyNumber: p.jerseyNumber } : {}),
      ...(p.position ? { position: p.position } : {}),
      ...(p.portraitImageLink ? { portraitImageLink: p.portraitImageLink } : {}),
    }));
}

export function mapRosterOfficials(
  teamUuid: string,
  officials: Array<{
    uuid?: string;
    name?: string | null;
    role?: string | null;
  }> = [],
): RosterOfficial[] {
  return officials
    .filter((o): o is typeof o & { name: string } => !!o.name?.trim())
    .map((o) => ({
      uuid: o.uuid ?? pseudoRosterUuid(teamUuid, "official", o.name, o.role ?? undefined),
      name: o.name,
      ...(o.role ? { role: o.role } : {}),
    }));
}
