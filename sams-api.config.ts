import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	output: {
		path: "data/sams/client",
		format: "biome",
		lint: "biome",
	},
	input: {
		patch: {
			schemas: {
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
						schema.properties.referees = {
							additionalProperties: true,
							nullable: true,
						};
						schema.required = ["uuid"];
					}
					if (typeof schema.properties?.date === "object" && "format" in schema.properties.date) {
						schema.properties.date.format = "date";
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
							// biome-ignore lint/suspicious/noExplicitAny: <explanation>
							properties: initalProperties as any,
							required: ["uuid", "name", "startDate", "endDate", "currentSeason"],
						};
					}
				},
				Address: (schema) => {
					if (schema.properties) {
						for (const [key, property] of Object.entries(schema.properties)) {
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
		path: "https://www.volleyball-baden.de/api/v2/swagger.json",
	},
	plugins: [
		"zod",
		{
			name: "@hey-api/client-next",
			runtimeConfigPath: "./data/sams/hey-api.ts",
		},
		{
			name: "@hey-api/sdk",
			validator: true,
		},
	],
});
