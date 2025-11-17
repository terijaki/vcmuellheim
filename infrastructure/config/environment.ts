export interface EnvironmentConfig {
	environment: "dev" | "staging" | "prod";
	account: string;
	region: string;
	vpcCidr: string;
	domainName: string;
	subdomain?: string;
	auroraInstanceType: string;
	amplifyBranch: string;
	githubRepo: string;
	githubOwner: string;
}

export const getConfig = (environment: string = "dev"): EnvironmentConfig => {
	const env = environment as "dev" | "staging" | "prod";

	// Base configuration
	const baseConfig = {
		account: process.env.CDK_DEFAULT_ACCOUNT || "",
		region: process.env.CDK_DEFAULT_REGION || "eu-central-1",
		githubRepo: "vcmuellheim",
		githubOwner: "terijaki",
	};

	// Environment-specific configurations
	const configs: Record<"dev" | "staging" | "prod", EnvironmentConfig> = {
		dev: {
			...baseConfig,
			environment: "dev",
			vpcCidr: "10.0.0.0/16",
			domainName: "vcmuellheim.de",
			subdomain: "dev",
			auroraInstanceType: "db.t4g.medium",
			amplifyBranch: "develop",
		},
		staging: {
			...baseConfig,
			environment: "staging",
			vpcCidr: "10.1.0.0/16",
			domainName: "vcmuellheim.de",
			subdomain: "staging",
			auroraInstanceType: "db.t4g.medium",
			amplifyBranch: "staging",
		},
		prod: {
			...baseConfig,
			environment: "prod",
			vpcCidr: "10.2.0.0/16",
			domainName: "vcmuellheim.de",
			auroraInstanceType: "db.r6g.large",
			amplifyBranch: "main",
		},
	};

	return configs[env];
};
