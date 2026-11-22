import { describe, expect, it } from "vite-plus/test";
import {
  dedupeSamsRosterOfficials,
  rosterOfficialDisplayName,
  rosterOfficialNameSlug,
  SAMS_ROSTER_EXCLUDED_ROLE,
  SAMS_ROSTER_TRAINER_ROLES,
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

  it("matches ß and ae spelling between SAMS comma form and CMS", () => {
    expect(rosterOfficialNameSlug("Groß, Anna")).toBe(rosterOfficialNameSlug("Anna Gross"));
    expect(rosterOfficialNameSlug("Groß, Anna")).toBe(rosterOfficialNameSlug("  Anna   Groß "));
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

  it("merges three or more SAMS rows into one combined role list", () => {
    const result = dedupeSamsRosterOfficials([
      { uuid: "1", name: "Mustermann, Erika", role: "Arzt" },
      { uuid: "2", name: "Erika Mustermann", role: "Betreuer" },
      { uuid: "3", name: "  ERIKA   MUSTERMANN ", role: "Physiotherapeut" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe("Arzt, Betreuer, Physiotherapeut");
  });

  it("sorts output by display name (German locale)", () => {
    const result = dedupeSamsRosterOfficials([
      { uuid: "1", name: "Zimmermann, Zara", role: "Arzt" },
      { uuid: "2", name: "Mustermann, Erika", role: "Betreuer" },
      { uuid: "3", name: "Aaberg, Anna", role: "Physio" },
    ]);

    expect(result.map((o) => rosterOfficialDisplayName(o.name))).toEqual([
      "Anna Aaberg",
      "Erika Mustermann",
      "Zara Zimmermann",
    ]);
  });

  it("drops Kontaktperson Spieltag by exact role name", () => {
    const result = dedupeSamsRosterOfficials([
      { uuid: "1", name: "Mustermann, Erika", role: SAMS_ROSTER_EXCLUDED_ROLE },
      { uuid: "2", name: "Mustermann, Erika", role: "Arzt" },
    ]);

    expect(result).toEqual([{ uuid: "2", name: "Mustermann, Erika", role: "Arzt" }]);
  });

  it("drops Kontaktperson Spieltag when the role label has surrounding whitespace", () => {
    const result = dedupeSamsRosterOfficials([
      { uuid: "1", name: "Mustermann, Erika", role: `  ${SAMS_ROSTER_EXCLUDED_ROLE}  ` },
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

  it("matches CMS trainer when CMS name uses comma form and odd spacing", () => {
    const result = dedupeSamsRosterOfficials(
      [{ uuid: "1", name: "Mustermann, Erika", role: "Trainer" }],
      { cmsTrainerNames: ["  Mustermann ,  Erika  "] },
    );

    expect(result).toEqual([]);
  });

  it("matches CMS and SAMS names with umlaut and ß variants", () => {
    const result = dedupeSamsRosterOfficials(
      [
        { uuid: "1", name: "Müller, Hans", role: "Trainer" },
        { uuid: "2", name: "Müller, Hans", role: "Arzt" },
      ],
      { cmsTrainerNames: ["Hans Mueller"] },
    );

    expect(result).toEqual([{ uuid: "1", name: "Müller, Hans", role: "Arzt" }]);
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

  it("strips only explicit SAMS trainer role labels", () => {
    for (const role of SAMS_ROSTER_TRAINER_ROLES) {
      const result = dedupeSamsRosterOfficials([{ uuid: "1", name: "Erika Mustermann", role }], {
        cmsTrainerNames: ["Erika Mustermann"],
      });
      expect(result).toEqual([]);
    }
  });

  it("does not strip Physiotherapeut when CMS trainer matches", () => {
    const result = dedupeSamsRosterOfficials(
      [{ uuid: "1", name: "Erika Mustermann", role: "Physiotherapeut" }],
      { cmsTrainerNames: ["Erika Mustermann"] },
    );

    expect(result).toEqual([{ uuid: "1", name: "Erika Mustermann", role: "Physiotherapeut" }]);
  });

  it("leaves officials unchanged when they are not CMS trainers", () => {
    const result = dedupeSamsRosterOfficials(
      [{ uuid: "1", name: "Erika Mustermann", role: "Trainer" }],
      { cmsTrainerNames: ["Someone Else"] },
    );

    expect(result).toEqual([{ uuid: "1", name: "Erika Mustermann", role: "Trainer" }]);
  });
});
