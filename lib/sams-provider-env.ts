import { computeResourceBranchSuffix } from "./db/env";

/** Provider prod account that publishes SAMS events via EventBridge. */
export const SAMS_PROVIDER_ACCOUNT_ID = "550271577754";

/** Shared EventBridge bus name in the provider account. */
export const SAMS_PROVIDER_EVENT_BUS_NAME = "sams-provider";

/** AWS region for provider EventBridge → consumer SQS delivery. */
export const SAMS_PROVIDER_REGION = "eu-central-1";

export function computeSamsProviderEventsQueueName(environment: string, branch: string): string {
  const suffix = computeResourceBranchSuffix(environment, branch);
  return `sams-provider-events-${environment}${suffix}`;
}

export function computeSamsProviderEventsDlqName(environment: string, branch: string): string {
  const suffix = computeResourceBranchSuffix(environment, branch);
  return `sams-provider-events-dlq-${environment}${suffix}`;
}

/** ARN of the provider prod EventBridge bus (cross-account event source). */
export function getProviderEventBusArn(): string {
  return `arn:aws:events:${SAMS_PROVIDER_REGION}:${SAMS_PROVIDER_ACCOUNT_ID}:event-bus/${SAMS_PROVIDER_EVENT_BUS_NAME}`;
}

/** IAM role in the provider account that EventBridge assumes to deliver events to consumer SQS. */
export const SAMS_PROVIDER_EVENT_DELIVERY_ROLE_NAME = "sp-event-delivery-prod";

/** ARN of the provider EventBridge cross-account delivery execution role. */
export function getProviderEventDeliveryRoleArn(): string {
  return `arn:aws:iam::${SAMS_PROVIDER_ACCOUNT_ID}:role/${SAMS_PROVIDER_EVENT_DELIVERY_ROLE_NAME}`;
}
