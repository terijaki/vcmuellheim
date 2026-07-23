import { createClient } from "@hey-api/openapi-ts";

createClient({
  output: {
    path: "codegen/sams/generated",
    postProcess: ["oxfmt"],
    preferExportAll: true,
    source: true,
  },
  input: "https://www.volleyball-baden.de/api/v2/swagger.json",
  plugins: [
    {
      name: "zod",
      dates: {
        local: true, // Allow datetimes without timezone offset
        offset: true, // Allow datetimes with timezone offset like +00:00
      },
      metadata: true,
      types: {
        infer: false, // Must use infer: false due to Zod's type inference limitations with deeply-patched schemas.
      },
      exportFromIndex: true,
    },
    {
      name: "@hey-api/client-fetch",
      // Since @hey-api/openapi-ts 0.97, runtimeConfigPath resolves relative to the CWD (like `output.path`),
      // not relative to the generated file. Use a CWD-relative path here (not the @codegen alias): rolldown
      // fails to resolve aliased imports from within alias-resolved generated files.
      runtimeConfigPath: "./codegen/sams/hey-api.ts",
    },
    {
      name: "@hey-api/sdk",
      validator: true,
    },
  ],
  parser: {
    patch: {
      schemas: {
        // _embedded (team1/team2) is not in the upstream spec — injected here based on actual API responses.
        // results: null when no match has been played; referees: null when none assigned;
        // team1Mvp/team2Mvp: null when no MVP is assigned (typical for unplayed matches).
        //   NOTE: hey-api no longer respects nullable:true on $ref fields — must use explicit allOf+nullable instead.
        // date.format corrected to "date" (upstream uses "date-time" which generates wrong Zod type).
        CompetitionMatchDto: (schema) => {
          if (schema.properties) {
            schema.properties._embedded = {
              type: "object",
              properties: {
                team1: {
                  type: "object",
                  properties: {
                    uuid: { type: "string" },
                    name: { type: "string" },
                    sportsclubUuid: { type: "string" },
                  },
                  required: ["uuid", "name", "sportsclubUuid"],
                },
                team2: {
                  type: "object",
                  properties: {
                    uuid: { type: "string" },
                    name: { type: "string" },
                    sportsclubUuid: { type: "string" },
                  },
                  required: ["uuid", "name", "sportsclubUuid"],
                },
              },
            };
            for (const [key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                switch (key) {
                  case "uuid":
                    property.nullable = false;
                    break;
                  case "results":
                  case "referees":
                  case "location":
                  case "team1Mvp":
                  case "team2Mvp":
                    // hey-api silently drops nullable:true when paired with $ref — wrap in allOf
                    // so nullable:true is on a schema object (not a $ref), which the generator
                    // correctly converts to z.union([zType, z.null()]).
                    // team1Mvp/team2Mvp are null when no MVP is assigned (common for unplayed matches).
                    schema.properties[key] = { allOf: [property], nullable: true };
                    break;
                  default:
                    property.nullable = true;
                }
              }
            }
            schema.required = ["uuid"];
          }
          if (typeof schema.properties?.date === "object" && "format" in schema.properties.date) {
            schema.properties.date.format = "date";
          }
        },
        LeagueMatchDto: (schema) => {
          if (schema.properties) {
            schema.properties._embedded = {
              type: "object",
              properties: {
                team1: {
                  type: "object",
                  properties: {
                    uuid: { type: "string" },
                    name: { type: "string" },
                    sportsclubUuid: { type: "string" },
                  },
                  required: ["uuid", "name", "sportsclubUuid"],
                },
                team2: {
                  type: "object",
                  properties: {
                    uuid: { type: "string" },
                    name: { type: "string" },
                    sportsclubUuid: { type: "string" },
                  },
                  required: ["uuid", "name", "sportsclubUuid"],
                },
              },
            };
            for (const [key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                switch (key) {
                  case "uuid":
                    property.nullable = false;
                    break;
                  case "results":
                  case "referees":
                  case "location":
                  case "team1Mvp":
                  case "team2Mvp":
                    // hey-api silently drops nullable:true when paired with $ref — wrap in allOf
                    // so nullable:true is on a schema object (not a $ref), which the generator
                    // correctly converts to z.union([zType, z.null()]).
                    // team1Mvp/team2Mvp are null when no MVP is assigned (common for unplayed matches).
                    schema.properties[key] = { allOf: [property], nullable: true };
                    break;
                  default:
                    property.nullable = true;
                }
              }
            }
            schema.required = ["uuid"];
          }
          if (typeof schema.properties?.date === "object" && "format" in schema.properties.date) {
            schema.properties.date.format = "date";
          }
        },
        RefereeTeamDto: (schema) => {
          if (schema.properties) {
            for (const [_key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                property.nullable = true;
              }
            }
          }
        },
        Location: (schema) => {
          if (schema.properties) {
            for (const [_key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                property.nullable = true;
              }
            }
          }
        },
        VolleyballMatchResultsDto: (schema) => {
          if (schema.properties) {
            for (const [_key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                property.nullable = true;
              }
            }
          }
        },
        LeagueRankingsEntryDto: (schema) => {
          if (schema.properties) {
            for (const [key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                switch (key) {
                  case "uuid":
                    property.nullable = false;
                    break;
                  case "rank":
                    property.nullable = false;
                    break;
                  case "ballRatio":
                  case "setRatio":
                    property.nullable = true;
                    property.additionalProperties = true;
                    property.oneOf = [{ type: "number" }, { type: "string" }]; // needed because during preSeason this property is a "Infinity" string
                    break;
                  default:
                    property.nullable = true;
                }
              }
            }
          }
        },
        Address: (schema) => {
          if (schema.properties) {
            for (const [_key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                property.nullable = true;
              }
            }
          }
        },
        TeamDto: (schema) => {
          if (schema.properties) {
            for (const [key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                switch (key) {
                  case "uuid":
                  case "name":
                    property.nullable = false;
                    break;
                  default:
                    property.nullable = true;
                }
              }
            }
          }
        },
        // SAMS returns null (not omitted) for unset optional player/official fields.
        // Without nullable:true, responseValidator rejects the roster and teams-sync
        // silently skips writing (data=undefined, error set, no throw).
        TeamPlayerDto: (schema) => {
          if (schema.properties) {
            for (const [key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                switch (key) {
                  case "uuid":
                  case "name":
                    property.nullable = false;
                    break;
                  default:
                    property.nullable = true;
                }
              }
            }
          }
        },
        TeamOfficialDto: (schema) => {
          if (schema.properties) {
            for (const [key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                switch (key) {
                  case "uuid":
                  case "name":
                    property.nullable = false;
                    break;
                  default:
                    property.nullable = true;
                }
              }
            }
          }
        },
        SportsclubDto: (schema) => {
          if (schema.properties) {
            schema.required = ["uuid", "name"];
            for (const [key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                switch (key) {
                  case "uuid":
                  case "name":
                    property.nullable = false;
                    break;
                  default:
                    property.nullable = true;
                }
              }
            }
          }
        },
        Association: (schema) => {
          if (schema.properties) {
            schema.required = ["uuid", "name"];
            for (const [key, property] of Object.entries(schema.properties)) {
              if (typeof property === "object" && property !== null) {
                switch (key) {
                  case "uuid":
                  case "name":
                    property.nullable = false;
                    break;
                  default:
                    property.nullable = true;
                }
              }
            }
          }
        },
        LeagueHierarchyDto: (schema) => {
          if (schema.properties) {
            for (const [key, property] of Object.entries(schema.properties)) {
              if (typeof property !== "object" || property === null) {
                continue;
              }

              switch (key) {
                case "uuid":
                  property.nullable = false;
                  break;
                case "parentLeagueHierarchyUuid":
                  // Upstream may return null for root hierarchy nodes.
                  property.nullable = true;
                  break;
                default:
                  break;
              }
            }
          }
        },
      },
    },
  },
});
