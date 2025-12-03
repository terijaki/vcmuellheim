import type { CreateClientConfig } from "./generated/client.gen";

export const createClientConfig: CreateClientConfig = (config) => ({
	...config,
	baseUrl: `${process.env.SAMS_SERVER}/api/v2`,
	headers: { "X-API-Key": process.env.SAMS_API_TOKEN },
	parseAs: "json",
});
