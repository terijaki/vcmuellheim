import { describe, expect, it } from "vite-plus/test";
import {
  dedupeSamsRosterOfficials,
  rosterOfficialDisplayName,
  rosterOfficialNameSlug,
  SAMS_ROSTER_EXCLUDED_ROLE,
} from "./sams-roster-officials";

describe("rosterOfficialDisplayName", () => {
  it("converts SAMS comma format to Vorname Nachname", () => {
    expect(rosterOfficialDisplayName("Mustermann, Erika")).toBe("Erika Mustermann");
  });

  it("collapses extra whitespace", () => {
    expect(rosterOfficialDisplayName("  Erika   Mustermann  ")).toBe("Erika Mustermann");
  });
});

describe("rosterOfficialNameSlug", () => {
  it("matches SAMS and CMS name forms", () => {
    expect(rosterOfficialNameSlug("Mustermann, Erika")).toBe("erikamustermann");
    expect(rosterOfficialNameSlug("Erika Mustermann")).toBe("erikamustermann");
    expect(rosterOfficialNameSlug("ERIKA MUSTERMANN")).toBe("erikamustermann");
  });

  it("normalizes umlauts consistently with slugify", () => {
    expect(rosterOfficialNameSlug("Müller, Hans")).toBe("hansmueller");
    expect(rosterOfficialNameSlug("Hans Müller")).toBe("hansmueller");
  });
});

describe("dedupeSamsRosterOfficials", () => {
  it("merges multiple SAMS rows for the same person into one entry with combined roles", () => {
    const result = dedupeSamsRosterOfficials([
      { uuid: "1", name: "Mustermann, Erika", role: "Physiotherapeut" },
      { uuid: "2", name: "Erika Mustermann", role: "Mannschaftsverantwortlicher" },
    ]);

    expect(result).toEqual([
      {
        uuid: "1",
        name: "Mustermann, Erika",
        role: "Mannschaftsverantwortlicher, Physiotherapeut",
      },
    ]);
  });

  it("drops Kontaktperson Spieltag by exact role name", () => {
    const result = dedupeSamsRosterOfficials([
      { uuid: "1", name: "Mustermann, Erika", role: SAMS_ROSTER_EXCLUDED_ROLE },
      { uuid: "2", name: "Mustermann, Erika", role: "Arzt" },
    ]);

    expect(result).toEqual([{ uuid: "2", name: "Mustermann, Erika", role: "Arzt" }]);
  });

  it("hides SAMS trainer roles when the person is a CMS team trainer with the same name slug", () => {
    const result = dedupeSamsRosterOfficials(
      [{ uuid: "1", name: "Erika Mustermann", role: "Trainer" }],
      { cmsTrainerNames: ["Erika Mustermann"] },
    );

    expect(result).toEqual([]);
  });

  it("keeps non-trainer SAMS roles when CMS trainer matches", () => {
    const result = dedupeSamsRosterOfficials(
      [
        { uuid: "1", name: "Mustermann, Erika", role: "Trainer" },
        { uuid: "2", name: "Erika Mustermann", role: "Arzt" },
      ],
      { cmsTrainerNames: ["Erika Mustermann"] },
    );

    expect(result).toEqual([{ uuid: "1", name: "Mustermann, Erika", role: "Arzt" }]);
  });

  it("strips trainer roles but not other roles when merged after multiple rows", () => {
    const result = dedupeSamsRosterOfficials(
      [
        { uuid: "1", name: "Erika Mustermann", role: "Trainer" },
        { uuid: "2", name: "Erika Mustermann", role: "Co-Trainer" },
        { uuid: "3", name: "Erika Mustermann", role: "Betreuer" },
      ],
      { cmsTrainerNames: ["Erika Mustermann"] },
    );

    expect(result).toEqual([{ uuid: "1", name: "Erika Mustermann", role: "Betreuer" }]);
  });

  it("leaves officials unchanged when they are not CMS trainers", () => {
    const result = dedupeSamsRosterOfficials(
      [{ uuid: "1", name: "Erika Mustermann", role: "Trainer" }],
      { cmsTrainerNames: ["Someone Else"] },
    );

    expect(result).toEqual([{ uuid: "1", name: "Erika Mustermann", role: "Trainer" }]);
  });
});
