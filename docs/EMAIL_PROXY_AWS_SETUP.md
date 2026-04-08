# Email Proxy AWS Manual Setup

This document records the manual AWS setup for the email proxy feature.

## Overview

The email proxy uses SES receipt rules to route inbound member alias emails to S3, where a Lambda processor (deployed via CDK in later phases) forwards them to member private inboxes.

## Production Environment (vcmuellheim.de)

### S3 Bucket

- **Name**: `vcm-mail-inbound-041632640830-eu-central-1-an`
- **Region**: `eu-central-1`
- **Encryption**: Enabled
- **Lifecycle Policy**:
  - Expire current versions of objects: **14 days**
- **EventBridge Notifications**: Enabled (sends all events to default EventBridge bus)

### SES Receipt Rule Set

- **Rule Set Name**: `vcm-inbound-prod`
- **Status**: Active
- **Region**: `eu-central-1`

### SES Receipt Rule

- **Rule Name**: `store-inbound-prod`
- **Status**: Enabled
- **Recipient Conditions**: `vcmuellheim.de` (catch-all)
- **Security & Protection**:
  - Spam and virus scanning: **Enabled**
  - TLS requirement: **Optional**
- **Action**: Write to S3 bucket
  - Bucket: `vcm-mail-inbound-041632640830-eu-central-1-an`
  - IAM Role: `ses-write-to-s3-role` (or similar auto-generated name)
    - Trust policy includes: SES service principal with source account and source ARN conditions
    - Permission policy allows: `s3:PutObject` on the inbound bucket

### DNS & Identity

- **SES Domain Identity**: `vcmuellheim.de` (manually verified in prior setup)
- **DKIM Records**: Configured in Route53 (see DNS stack)
- **SPF/DMARC**: Configured per existing mail setup

## Development Environment (new.vcmuellheim.de)

### S3 Bucket

- **Name**: `vcm-mail-inbound-418553863544-eu-central-1-an`
- **Region**: `eu-central-1`
- **Encryption**: Enabled
- **Lifecycle Policy**:
  - Expire current versions of objects: **3 days**
- **EventBridge Notifications**: Enabled (sends all events to default EventBridge bus)

### SES Receipt Rule Set

- **Rule Set Name**: `vcm-inbound-dev`
- **Status**: Active
- **Region**: `eu-central-1`

### SES Receipt Rule

- **Rule Name**: `store-inbound-dev`
- **Status**: Enabled
- **Recipient Conditions**: `new.vcmuellheim.de` (catch-all)
- **Security & Protection**:
  - Spam and virus scanning: **Enabled**
  - TLS requirement: **Optional**
- **Action**: Write to S3 bucket
  - Bucket: `vcm-mail-inbound-418553863544-eu-central-1-an`
  - IAM Role: `ses-write-to-s3-role` (or similar auto-generated name)
    - Trust policy includes: SES service principal with source account and source ARN conditions
    - Permission policy allows: `s3:PutObject` on the inbound bucket

### DNS & Identity

- **SES Domain Identity**: `new.vcmuellheim.de` (manually verified)
- **DKIM Records**: Configured in Route53 (dev hosted zone)
- **SPF/DMARC**: Configured per existing dev mail setup

## Google Workspace Routing (Production Only)

- Unknown recipients at `vcmuellheim.de` will route to SES inbound endpoint.
- Existing aliases/accounts (e.g. `firstname@vcmuellheim.de`) remain in Google.
