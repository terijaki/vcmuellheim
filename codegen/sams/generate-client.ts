import { createClient } from "@hey-api/openapi-ts";

createClient({
	output: {
		path: "codegen/sams/generated",
		postProcess: ["biome:format", "biome:lint"],
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
			runtimeConfigPath: "../hey-api",
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
				// results: null when no match has been played; referees: null when none assigned. Upstream spec omits nullable.
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
										property.nullable = true; // API returns null; upstream spec omits nullable
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
										property.nullable = true; // API returns null; upstream spec omits nullable
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
			},
		},
	},
});
