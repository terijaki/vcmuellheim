import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";

interface DomainStackProps extends cdk.StackProps {
  domainName: string;
  subdomainName: string;
}

export class DomainStack extends cdk.Stack {
  public readonly hostedZone: route53.IHostedZone;
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, props);

    // Look up existing hosted zone for vcmuellheim.de
    this.hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.domainName,
    });

    // Create SSL certificate for the domain
    this.certificate = new acm.Certificate(this, "Certificate", {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
      subjectAlternativeNames: [`www.${props.domainName}`],
    });

    // Output certificate ARN
    new cdk.CfnOutput(this, "CertificateArn", {
      value: this.certificate.certificateArn,
      description: "SSL Certificate ARN",
      exportName: "VcmuellheimCertificateArn",
    });

    new cdk.CfnOutput(this, "HostedZoneId", {
      value: this.hostedZone.hostedZoneId,
      description: "Route 53 Hosted Zone ID",
      exportName: "VcmuellheimHostedZoneId",
    });
  }
}