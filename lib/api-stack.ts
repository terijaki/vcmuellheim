import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import { Club } from "@/project.config";
import { TABLES, type TableEntity, tableEnvVar } from "./db/env";

interface ApiStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	contentDbStack: Record<`${Lowercase<TableEntity>}Table`, dynamodb.Table>;
	samsApiStack?: {
		samsClubsTable: dynamodb.Table;
		samsTeamsTable: dynamodb.Table;
	};
	mediaBucket?: s3.Bucket;
	cloudFrontUrl?: string;
	cmsUrl?: string;
	samsApiUrl?: string;
	hostedZone: route53.IHostedZone;
	certificate: acm.ICertificate;
}

export class ApiStack extends cdk.Stack {
	public readonly api: apigatewayv2.HttpApi;
	public readonly userPool: cognito.UserPool;
	public readonly userPoolClient: cognito.UserPoolClient;
	public readonly userPoolDomain: cognito.CfnUserPoolDomain;
	public readonly trpcLambda: lambda.Function;
	public readonly apiDomainName?: apigatewayv2.DomainName;
	public readonly apiUrl: string;
	public readonly cmsCallbackUrl: string;
	public readonly cognitoHostedUiUrl: string;

	constructor(scope: Construct, id: string, props: ApiStackProps) {
		super(scope, id, props);

		const environment = props.stackProps?.environment || "dev";
		const branch = props.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const isProd = environment === "prod";
		const envPrefix = isProd ? "" : `${environment}${branchSuffix}-`;
		const apiDomain = `${envPrefix}api.new.${Club.domain}`;
		const cmsDomain = `${envPrefix}admin.new.${Club.domain}`;

		// CMS callback URL for OAuth2
		this.cmsCallbackUrl = `https://${cmsDomain}/auth/callback`;

		// 1. Cognito User Pool for admin authentication
		this.userPool = new cognito.UserPool(this, "AdminUserPool", {
			userPoolName: `vcm-admin-${environment}${branchSuffix}`,
			featurePlan: cognito.FeaturePlan.ESSENTIALS,
			selfSignUpEnabled: !isProd,
			signInCaseSensitive: false,
			signInAliases: {
				email: true,
				username: false,
			},
			autoVerify: {
				email: true,
			},
			standardAttributes: {
				email: {
					required: true,
					mutable: true,
				},
				givenName: {
					required: true,
					mutable: true,
				},
				familyName: {
					required: true,
					mutable: true,
				},
			},
			passkeyUserVerification: cognito.PasskeyUserVerification.PREFERRED,
			passkeyRelyingPartyId: isProd ? Club.domain : undefined,
			email: cognito.UserPoolEmail.withCognito(),
			passwordPolicy: {
				minLength: 8,
				requireLowercase: isProd,
				requireUppercase: isProd,
				requireDigits: isProd,
				requireSymbols: isProd,
				tempPasswordValidity: cdk.Duration.days(30),
			},
			accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
			mfaMessage: `Dein Verifizierungscode für ${Club.shortName} ist {####}`,
			mfa: cognito.Mfa.OPTIONAL,
			mfaSecondFactor: {
				sms: false,
				otp: true,
				email: false,
			},
			deviceTracking: {
				challengeRequiredOnNewDevice: true,
				deviceOnlyRememberedOnUserPrompt: true,
			},
			removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
		});

		// User Pool Client for admin app
		this.userPoolClient = this.userPool.addClient("AdminAppClient", {
			authFlows: {
				userPassword: true,
				userSrp: true,
				user: true,
			},
			oAuth: {
				flows: {
					authorizationCodeGrant: true,
				},
				scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
				callbackUrls: [
					this.cmsCallbackUrl,
					// Add localhost for development only
					...(!isProd ? ["http://localhost:3081/auth/callback"] : []),
				],
				logoutUrls: [
					`https://${cmsDomain}/login`,
					// Add localhost for development only
					...(!isProd ? ["http://localhost:3081/login"] : []),
				],
			},
			preventUserExistenceErrors: true,
			supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
		});

		// Add Cognito Domain with Managed Login v2 (prefix domain)
		// Remove reserved words (aws, amazon, cognito) from branch name
		const cognitoDomainPrefix = String(`${envPrefix}vcmuellheim-cms`)
			.toLowerCase()
			.replace(/aws|amazon|cognito/g, "");
		this.userPoolDomain = new cognito.CfnUserPoolDomain(this, "CognitoDomain", {
			userPoolId: this.userPool.userPoolId,
			domain: cognitoDomainPrefix,
			managedLoginVersion: 2,
		});

		this.cognitoHostedUiUrl = `https://${cognitoDomainPrefix}.auth.${cdk.Stack.of(this).region}.amazoncognito.com`;

		// Managed Login Branding (required for Managed Login v2 to work)
		const managedLoginBranding = new cognito.CfnManagedLoginBranding(this, "ManagedLoginBranding", {
			userPoolId: this.userPool.userPoolId,
			clientId: this.userPoolClient.userPoolClientId,
			useCognitoProvidedValues: false,
			settings: {
				categories: {
					global: {
						colorSchemeMode: "LIGHT", // Use LIGHT mode by default (users can switch)
					},
				},
				components: {
					pageBackground: {
						image: {
							enabled: false, // Disable default background image
						},
						lightMode: {
							color: "eff5f5ff", // aquahaze
						},
						darkMode: {
							color: "363b40ff", // onyx
						},
					},
					form: {
						lightMode: {
							backgroundColor: "ffffffff",
							borderColor: "366273ff", // blumine
						},
						darkMode: {
							backgroundColor: "363b40ff", // onyx
							borderColor: "366273ff", // blumine
						},
					},
					primaryButton: {
						lightMode: {
							defaults: {
								backgroundColor: "366273ff", // blumine
								textColor: "ffffffff",
							},
							hover: {
								backgroundColor: "2d4f5eff", // darker blumine
								textColor: "ffffffff",
							},
						},
						darkMode: {
							defaults: {
								backgroundColor: "366273ff", // blumine
								textColor: "ffffffff",
							},
							hover: {
								backgroundColor: "539fe5ff", // lighter blue for dark mode
								textColor: "ffffffff",
							},
						},
					},
				},
				componentClasses: {
					link: {
						lightMode: {
							defaults: {
								textColor: "01a29aff", // turquoise
							},
							hover: {
								textColor: "008580ff", // darker turquoise
							},
						},
						darkMode: {
							defaults: {
								textColor: "01a29aff", // turquoise
							},
							hover: {
								textColor: "33beb6ff", // lighter turquoise
							},
						},
					},
				},
			},
		});
		// Ensure branding is created after the client
		managedLoginBranding.addDependency(this.userPoolClient.node.defaultChild as cognito.CfnUserPoolClient);

		// 2. tRPC Lambda Function
		const tables = {
			NEWS: props.contentDbStack.newsTable,
			EVENTS: props.contentDbStack.eventsTable,
			TEAMS: props.contentDbStack.teamsTable,
			MEMBERS: props.contentDbStack.membersTable,
			MEDIA: props.contentDbStack.mediaTable,
			SPONSORS: props.contentDbStack.sponsorsTable,
			LOCATIONS: props.contentDbStack.locationsTable,
			BUS: props.contentDbStack.busTable,
		} satisfies Record<TableEntity, dynamodb.Table>;

		this.trpcLambda = new NodejsFunction(this, "TrpcApiLambda", {
			functionName: `vcm-trpc-api-${environment}${branchSuffix}`,
			entry: "lambda/content/handler.ts",
			handler: "handler",
			runtime: lambda.Runtime.NODEJS_LATEST,
			timeout: cdk.Duration.seconds(30),
			memorySize: 512,
			environment: {
				...Object.fromEntries(TABLES.map((entity) => [tableEnvVar(entity), tables[entity].tableName])),
				CDK_ENVIRONMENT: environment,
				COGNITO_USER_POOL_ID: this.userPool.userPoolId,
				COGNITO_USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
				COGNITO_HOSTED_UI_URL: this.cognitoHostedUiUrl,
				CMS_CALLBACK_URL: this.cmsCallbackUrl,
				...(props.samsApiUrl ? { SAMS_API_URL: props.samsApiUrl } : {}),
				...(props.mediaBucket ? { MEDIA_BUCKET_NAME: props.mediaBucket.bucketName } : {}),
				...(props.cloudFrontUrl ? { CLOUDFRONT_URL: props.cloudFrontUrl } : {}),
			},
			bundling: {
				minify: true,
				sourceMap: true,
				externalModules: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
			},
		});

		// Grant Lambda access to DynamoDB tables
		for (const table of Object.values(tables)) {
			table.grantReadWriteData(this.trpcLambda);
		}

		// Grant DynamoDB access to SAMS tables
		if (props.samsApiStack?.samsTeamsTable) {
			props.samsApiStack.samsTeamsTable.grantReadWriteData(this.trpcLambda);
		}
		if (props.samsApiStack?.samsClubsTable) {
			props.samsApiStack.samsClubsTable.grantReadWriteData(this.trpcLambda);
		}

		// Grant Lambda access to S3 bucket for uploads
		if (props.mediaBucket) {
			props.mediaBucket.grantPut(this.trpcLambda);
			props.mediaBucket.grantRead(this.trpcLambda);
		}

		// 3. HTTP API Gateway with custom domain
		// Custom domain for API
		this.apiDomainName = new apigatewayv2.DomainName(this, "ApiDomainName", {
			domainName: apiDomain,
			certificate: props.certificate,
		});

		// Build explicit allowed origins for CORS. When `allowCredentials` is
		// enabled, `Access-Control-Allow-Origin` must not be `*` so we use a
		// whitelist that includes localhost (dev), the admin domain and any
		// provided CloudFront or CMS URLs.
		const allowedOriginsSet = new Set<string>();
		allowedOriginsSet.add(Club.url);
		allowedOriginsSet.add(`https://${envPrefix}admin.new.${Club.domain}`);
		if (!isProd) {
			allowedOriginsSet.add("http://localhost:3081");
		}
		if (props.cloudFrontUrl) {
			const cloudFrontOrigin = props.cloudFrontUrl.startsWith("https://") ? props.cloudFrontUrl : `https://${props.cloudFrontUrl}`;
			allowedOriginsSet.add(cloudFrontOrigin);
		}
		if (props.cmsUrl) {
			const cmsOrigin = props.cmsUrl.startsWith("https://") ? props.cmsUrl : `https://${props.cmsUrl}`;
			allowedOriginsSet.add(cmsOrigin);
		}

		const allowedOrigins = Array.from(allowedOriginsSet);

		this.api = new apigatewayv2.HttpApi(this, "TrpcHttpApi", {
			apiName: `vcm-trpc-api-${environment}${branchSuffix}`,
			description: "tRPC API for VCM admin and public endpoints",
			defaultDomainMapping: {
				domainName: this.apiDomainName,
			},
			corsPreflight: {
				allowOrigins: allowedOrigins,
				allowMethods: [apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.OPTIONS],
				allowHeaders: isProd ? ["content-type", "authorization", "x-trpc-source"] : ["content-type", "authorization", "x-trpc-source", "*"],
				exposeHeaders: ["content-type"],
				allowCredentials: true, // Enable credentials for flows that require cookies (OAuth etc.)
				maxAge: cdk.Duration.hours(1),
			},
		});

		// Create A record pointing to API Gateway
		new route53.ARecord(this, "ApiARecord", {
			zone: props.hostedZone,
			recordName: apiDomain,
			target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayv2DomainProperties(this.apiDomainName.regionalDomainName, this.apiDomainName.regionalHostedZoneId)),
		});

		this.apiUrl = `https://${apiDomain}`;

		// Lambda integration
		const lambdaIntegration = new HttpLambdaIntegration("TrpcLambdaIntegration", this.trpcLambda);

		// Route all /api/* requests to Lambda (excluding OPTIONS which is handled by CORS preflight)
		this.api.addRoutes({
			path: "/api/{proxy+}",
			methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
			integration: lambdaIntegration,
		});

		// Also accept requests without the `/api` prefix so deployed frontends
		// that call e.g. `/news.list` will reach the same Lambda and receive
		// CORS headers from API Gateway.
		this.api.addRoutes({
			path: "/{proxy+}",
			methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
			integration: lambdaIntegration,
		});

		// Outputs
		new cdk.CfnOutput(this, "ApiUrl", {
			value: this.apiUrl,
			description: "tRPC API URL",
			exportName: `vcm-trpc-api-url-${environment}${branchSuffix}`,
		});

		new cdk.CfnOutput(this, "UserPoolId", {
			value: this.userPool.userPoolId,
			description: "Cognito User Pool ID",
			exportName: `vcm-user-pool-id-${environment}${branchSuffix}`,
		});

		new cdk.CfnOutput(this, "UserPoolClientId", {
			value: this.userPoolClient.userPoolClientId,
			description: "Cognito User Pool Client ID",
			exportName: `vcm-user-pool-client-id-${environment}${branchSuffix}`,
		});

		new cdk.CfnOutput(this, "CognitoHostedUiUrl", {
			value: this.cognitoHostedUiUrl,
			description: "Cognito Managed Login URL",
			exportName: `vcm-cognito-hosted-ui-url-${environment}${branchSuffix}`,
		});

		new cdk.CfnOutput(this, "CmsCallbackUrl", {
			value: this.cmsCallbackUrl,
			description: "CMS OAuth2 Callback URL",
			exportName: `vcm-cms-callback-url-${environment}${branchSuffix}`,
		});
	}
}
