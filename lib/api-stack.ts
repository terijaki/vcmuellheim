import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";
import { Club } from "@/project.config";
import { TABLES, type TableEntity, tableEnvVar } from "./db/env";

interface ApiStackProps extends cdk.StackProps {
	stackProps?: {
		environment: string;
		branch: string;
	};
	contentDbStack: Record<`${Lowercase<TableEntity>}Table`, dynamodb.Table>;
}

export class ApiStack extends cdk.Stack {
	public readonly api: apigatewayv2.HttpApi;
	public readonly userPool: cognito.UserPool;
	public readonly trpcLambda: lambda.Function;

	constructor(scope: Construct, id: string, props: ApiStackProps) {
		super(scope, id, props);

		const environment = props.stackProps?.environment || "dev";
		const branch = props.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";
		const isProd = environment === "prod";

		// 1. Cognito User Pool for admin authentication
		this.userPool = new cognito.UserPool(this, "AdminUserPool", {
			userPoolName: `vcm-admin-${environment}${branchSuffix}`,
			featurePlan: cognito.FeaturePlan.ESSENTIALS,
			selfSignUpEnabled: false, // Only admins can create accounts
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
				requireLowercase: true,
				requireUppercase: true,
				requireDigits: true,
				requireSymbols: true,
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
		const userPoolClient = this.userPool.addClient("AdminAppClient", {
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
			},
		});

		// 2. tRPC Lambda Function
		const tables = {
			NEWS: props.contentDbStack.newsTable,
			EVENTS: props.contentDbStack.eventsTable,
			TEAMS: props.contentDbStack.teamsTable,
			MEMBERS: props.contentDbStack.membersTable,
			MEDIA: props.contentDbStack.mediaTable,
			SPONSORS: props.contentDbStack.sponsorsTable,
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
				COGNITO_USER_POOL_ID: this.userPool.userPoolId,
			},
			bundling: {
				minify: true,
				sourceMap: true,
				externalModules: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb"],
			},
		});

		// Grant Lambda access to DynamoDB tables
		for (const table of Object.values(tables)) {
			table.grantReadWriteData(this.trpcLambda);
		}

		// 3. HTTP API Gateway
		this.api = new apigatewayv2.HttpApi(this, "TrpcHttpApi", {
			apiName: `vcm-trpc-api-${environment}${branchSuffix}`,
			description: "tRPC API for VCM admin and public endpoints",
			corsPreflight: {
				allowOrigins: isProd ? [Club.url, "https://admin.vcmuellheim.de"] : ["*"],
				allowMethods: [apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.OPTIONS],
				allowHeaders: ["content-type", "authorization"],
				maxAge: cdk.Duration.hours(1),
			},
		});

		// Lambda integration
		const lambdaIntegration = new HttpLambdaIntegration("TrpcLambdaIntegration", this.trpcLambda);

		// Route all /api/* requests to Lambda
		this.api.addRoutes({
			path: "/api/{proxy+}",
			methods: [apigatewayv2.HttpMethod.ANY],
			integration: lambdaIntegration,
		});

		// Outputs
		new cdk.CfnOutput(this, "ApiUrl", {
			value: this.api.apiEndpoint,
			description: "tRPC API URL",
			exportName: `vcm-trpc-api-url-${environment}${branchSuffix}`,
		});

		new cdk.CfnOutput(this, "UserPoolId", {
			value: this.userPool.userPoolId,
			description: "Cognito User Pool ID",
			exportName: `vcm-user-pool-id-${environment}${branchSuffix}`,
		});

		new cdk.CfnOutput(this, "UserPoolClientId", {
			value: userPoolClient.userPoolClientId,
			description: "Cognito User Pool Client ID",
			exportName: `vcm-user-pool-client-id-${environment}${branchSuffix}`,
		});
	}
}
