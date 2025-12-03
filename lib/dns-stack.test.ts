import { describe, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { DnsStack } from "./dns-stack";

describe("DnsStack", () => {
	const testProps = {
		hostedZoneId: "Z1234567890ABC",
		hostedZoneName: "new.vcmuellheim.de",
		regionalCertificateArn: "arn:aws:acm:eu-central-1:123456789012:certificate/test-cert-id",
	};

	it("should create stack without any new resources", () => {
		const app = new App();
		const stack = new DnsStack(app, "TestStack", testProps);

		const template = Template.fromStack(stack);

		// DNS stack only imports existing resources, creates no new ones
		// It should have no Route53 HostedZone resources (only imports)
		template.resourceCountIs("AWS::Route53::HostedZone", 0);

		// It should have no ACM Certificate resources (only imports)
		template.resourceCountIs("AWS::CertificateManager::Certificate", 0);
	});

	it("should import hosted zone correctly", () => {
		const app = new App();
		const stack = new DnsStack(app, "TestStack", testProps);

		// Access the imported hosted zone
		const hostedZone = stack.hostedZone;

		// Verify hosted zone attributes
		if (hostedZone.hostedZoneId !== "Z1234567890ABC") {
			throw new Error(`Expected hosted zone ID Z1234567890ABC, got ${hostedZone.hostedZoneId}`);
		}

		if (hostedZone.zoneName !== "new.vcmuellheim.de") {
			throw new Error(`Expected zone name new.vcmuellheim.de, got ${hostedZone.zoneName}`);
		}
	});

	it("should import certificate correctly", () => {
		const app = new App();
		const stack = new DnsStack(app, "TestStack", testProps);

		// Access the imported certificate
		const certificate = stack.regionalCertificate;

		// Verify certificate ARN
		if (certificate.certificateArn !== testProps.regionalCertificateArn) {
			throw new Error(`Expected certificate ARN ${testProps.regionalCertificateArn}, got ${certificate.certificateArn}`);
		}
	});

	it("should import CloudFront certificate when provided", () => {
		const app = new App();
		const cloudFrontCertArn = "arn:aws:acm:us-east-1:123456789012:certificate/cloudfront-cert-id";
		const stack = new DnsStack(app, "TestStack", {
			...testProps,
			cloudFrontCertificateArn: cloudFrontCertArn,
		});

		// Access the imported CloudFront certificate
		const cloudFrontCertificate = stack.cloudFrontCertificate;

		if (!cloudFrontCertificate) {
			throw new Error("Expected CloudFront certificate to be imported");
		}

		if (cloudFrontCertificate.certificateArn !== cloudFrontCertArn) {
			throw new Error(`Expected CloudFront certificate ARN ${cloudFrontCertArn}, got ${cloudFrontCertificate.certificateArn}`);
		}
	});

	it("should not import CloudFront certificate when not provided", () => {
		const app = new App();
		const stack = new DnsStack(app, "TestStack", testProps);

		// CloudFront certificate should be undefined
		if (stack.cloudFrontCertificate !== undefined) {
			throw new Error("Expected CloudFront certificate to be undefined");
		}
	});

	it("should create correct outputs", () => {
		const app = new App();
		const stack = new DnsStack(app, "TestStack", {
			...testProps,
			cloudFrontCertificateArn: "arn:aws:acm:us-east-1:123456789012:certificate/cloudfront-cert-id",
		});

		const template = Template.fromStack(stack);

		// Should have outputs for hosted zone, regional certificate, and CloudFront certificate
		const outputs = template.findOutputs("*");
		const outputKeys = Object.keys(outputs);

		if (!outputKeys.includes("HostedZoneId")) {
			throw new Error("Expected HostedZoneId output");
		}

		if (!outputKeys.includes("RegionalCertificateArn")) {
			throw new Error("Expected RegionalCertificateArn output");
		}

		if (!outputKeys.includes("CloudFrontCertificateArn")) {
			throw new Error("Expected CloudFrontCertificateArn output");
		}
	});

	it("should not create CloudFront certificate output when not provided", () => {
		const app = new App();
		const stack = new DnsStack(app, "TestStack", testProps);

		const template = Template.fromStack(stack);

		const outputs = template.findOutputs("*");
		const outputKeys = Object.keys(outputs);

		if (outputKeys.includes("CloudFrontCertificateArn")) {
			throw new Error("Should not have CloudFrontCertificateArn output when not provided");
		}
	});
});
