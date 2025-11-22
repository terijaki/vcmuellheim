import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	output: {
		path: "data/sams/client",
		format: "biome",
		lint: "biome",
	},
	input: "https://www.volleyball-baden.de/api/v2/swagger.json",
	parser: {
		patch: {
			schemas: {
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
										property.nullable = true; // this is not working because the field is a reference
										property.additionalProperties = true;
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
										property.nullable = true; // this is not working because the field is a reference
										property.additionalProperties = true;
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
				SeasonDto: (schema) => {
					const { properties: initalProperties } = schema;
					if (initalProperties) {
						schema.type = "array";
						schema.items = {
							type: "object",
							// biome-ignore lint/suspicious/noExplicitAny: casting needed
							properties: initalProperties as any,
							required: ["uuid", "name", "startDate", "endDate", "currentSeason"],
						};
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
	plugins: [
		"zod",
		{
			name: "@hey-api/client-next",
			runtimeConfigPath: "../hey-api",
		},
		{
			name: "@hey-api/sdk",
			validator: true,
		},
	],
});
