/**
 * CDK Stack for AWS Budgets - Cost monitoring and alerts
 */

import * as cdk from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import type { Construct } from "constructs";

export interface BudgetStackProps extends cdk.StackProps {
	stackProps?: {
		environment?: string;
		branch?: string;
	};
	alertEmail: string;
}

export class BudgetStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props: BudgetStackProps) {
		super(scope, id, props);

		const environment = props.stackProps?.environment || "dev";
		const branch = props.stackProps?.branch || "";
		const branchSuffix = branch ? `-${branch}` : "";

		const alertThreshold = 5; // USD
		const capThreshold = 10; // USD

		new budgets.CfnBudget(this, "MonthlyBudget", {
			budget: {
				budgetName: `vcm-monthly-budget-${environment}${branchSuffix}`,
				budgetType: "COST",
				timeUnit: "MONTHLY",
				budgetLimit: {
					amount: capThreshold,
					unit: "USD",
				},
				costFilters: {
					// Filter by environment tag to track costs per environment
					TagKeyValue: [`user:Environment$${environment}`],
				},
			},
			notificationsWithSubscribers: [
				{
					notification: {
						notificationType: "ACTUAL",
						comparisonOperator: "GREATER_THAN",
						threshold: (alertThreshold / capThreshold) * 100, // Alert at 50% of budget
						thresholdType: "PERCENTAGE",
					},
					subscribers: [
						{
							subscriptionType: "EMAIL",
							address: props.alertEmail,
						},
					],
				},
				{
					notification: {
						notificationType: "ACTUAL",
						comparisonOperator: "GREATER_THAN",
						threshold: 90, // Alert at 90% of budget
						thresholdType: "PERCENTAGE",
					},
					subscribers: [
						{
							subscriptionType: "EMAIL",
							address: props.alertEmail,
						},
					],
				},
				{
					notification: {
						notificationType: "FORECASTED",
						comparisonOperator: "GREATER_THAN",
						threshold: 100, // Alert if forecasted to exceed budget
						thresholdType: "PERCENTAGE",
					},
					subscribers: [
						{
							subscriptionType: "EMAIL",
							address: props.alertEmail,
						},
					],
				},
			],
		});

		// Outputs
		new cdk.CfnOutput(this, "BudgetName", {
			value: `vcm-monthly-budget-${environment}${branchSuffix}`,
			description: "AWS Budget name for cost monitoring",
		});

		new cdk.CfnOutput(this, "AlertThreshold", {
			value: `$${alertThreshold} USD`,
			description: "First alert threshold",
		});

		new cdk.CfnOutput(this, "BudgetCap", {
			value: `$${capThreshold} USD (~€10 EUR)`,
			description: "Monthly budget cap",
		});
	}
}
