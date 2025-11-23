import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";

export interface DnsStackProps extends cdk.StackProps {
	// Manually created resources in AWS Console
	hostedZoneId: string;
	hostedZoneName: string;
	certificateArn: string;
	cloudFrontCertificateArn?: string; // Certificate in us-east-1 for CloudFront
}

/**
 * DNS Stack - References manually created Route53 and ACM resources
 *
 * These resources are shared across all environments (prod, dev, dev-feature)
 * and should be created manually in the AWS Console:
 *
 * 1. Route53 Hosted Zone: new.vcmuellheim.de
 * 2. ACM Certificate: *.new.vcmuellheim.de (with SAN: new.vcmuellheim.de)
 *
 * This prevents accidental deletion and ensures stable nameservers.
 */
export class DnsStack extends cdk.Stack {
	public readonly hostedZone: route53.IHostedZone;
	public readonly certificate: acm.ICertificate;
	public readonly cloudFrontCertificate: acm.ICertificate | undefined;

	constructor(scope: Construct, id: string, props: DnsStackProps) {
		super(scope, id, props);

		// Import existing hosted zone created manually
		this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
			hostedZoneId: props.hostedZoneId,
			zoneName: props.hostedZoneName,
		});

		// Import existing ACM certificate for API Gateway (eu-central-1)
		this.certificate = acm.Certificate.fromCertificateArn(this, "Certificate", props.certificateArn);

		// Import CloudFront certificate if provided (must be in us-east-1)
		this.cloudFrontCertificate = props.cloudFrontCertificateArn ? acm.Certificate.fromCertificateArn(this, "CloudFrontCertificate", props.cloudFrontCertificateArn) : undefined;

		// Outputs for reference
		new cdk.CfnOutput(this, "HostedZoneId", {
			value: this.hostedZone.hostedZoneId,
			description: "Route53 Hosted Zone ID (manually created)",
		});

		new cdk.CfnOutput(this, "CertificateArn", {
			value: this.certificate.certificateArn,
			description: "ACM Certificate ARN for API Gateway (manually created)",
		});

		if (this.cloudFrontCertificate) {
			new cdk.CfnOutput(this, "CloudFrontCertificateArn", {
				value: this.cloudFrontCertificate.certificateArn,
				description: "ACM Certificate ARN for CloudFront (manually created)",
			});
		}
	}
}
