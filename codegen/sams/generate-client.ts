import { createClient } from "@hey-api/openapi-ts";

createClient({
	output: {
		path: "codegen/sams/generated",
		format: "biome",
		lint: "biome",
	},
	input: "codegen/sams/swagger.json", // some fixes are applied via scripts/update-sams-swagger.sh before generation
	plugins: [
		{
			name: "zod",
			dates: {
				local: true, // Allow datetimes without timezone offset
				offset: true, // Allow datetimes with timezone offset like +00:00
			},
			metadata: true,
			types: {
				infer: false, // Must use infer: false due to Zod's type inference limitations. This is partially related to the fix we are applying via update-sams-swagger.sh script.
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
