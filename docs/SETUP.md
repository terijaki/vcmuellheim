# vcmuellheim.de

Source code for the [VC Müllheim](https://vcmuellheim.de) website and infrastructure.

## Prerequisites

- [Vite+](https://viteplus.dev/) — installs Bun automatically if absent
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) — for AWS access
- [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting-started.html) — for infrastructure deployments

## Getting started

```sh
vp install
```

Create a `.env.local` file at the repo root with the following environment variables (ask a maintainer for the values):

```sh
# CDK
CDK_ENVIRONMENT="dev"
CDK_BUDGET_ALERT_EMAIL="you@example.com"
CDK_MONITORING_ALERT_EMAIL="you@example.com"

# Auth
BETTER_AUTH_SECRET=""

# Mastodon
MASTODON_ACCESS_TOKEN=""
MASTODON_CLIENT_KEY=""
MASTODON_CLIENT_SECRET=""

# Sentry
SENTRY_AUTH_TOKEN=""
SENTRY_ENVIRONMENT="development"
```

## AWS Authentication

This project uses **AWS SSO** with two accounts:

| Profile    | Account        | Purpose     |
| ---------- | -------------- | ----------- |
| `vcm-dev`  | `418553863544` | Development |
| `vcm-prod` | `041632640830` | Production  |

### Initial setup

Configure your AWS SSO session once in `~/.aws/config`:

```ini
[sso-session <your-session-name>]
sso_start_url = https://<your-sso-start-url>
sso_region = eu-central-1
sso_registration_scopes = sso:account:access

[profile vcm-dev]
sso_session = <your-session-name>
sso_account_id = 418553863544
sso_role_name = DeveloperAdministratorAccess
region = eu-central-1

[profile vcm-prod]
sso_session = <your-session-name>
sso_account_id = 041632640830
sso_role_name = DeveloperAdministratorAccess
region = eu-central-1
```

### Authenticating before development

Once per day (when credentials expire), log in and export credentials into your shell:

```sh
# 1. Refresh the SSO session (opens browser)
aws sso login --sso-session <your-session-name>

# 2. Export credentials for the dev account into your shell
eval "$(aws configure export-credentials --profile vcm-dev --format env)"
export AWS_PROFILE=vcm-dev
export AWS_REGION=eu-central-1
```

After this, all `vpr cdk:*` and `vpr db:*` commands will use your dev account automatically.

For prod operations, replace `vcm-dev` with `vcm-prod` in step 2.

## Common commands

```sh
vp dev              # Start local dev server
vp check            # Lint + typecheck
vp test             # Run tests
vpr verify      # Lint + typecheck + tests (full quality gate)

vpr db:seed         # Seed dev DynamoDB with fake data
vpr db:seed:sams    # Publish mock SAMS provider events (dev only)

vpr cdk:synth       # Synthesize CDK stacks (dev)
vpr cdk:diff        # Show changes vs deployed (dev)
vpr cdk:deploy:all  # Deploy all stacks (dev)
vpr cdk:deploy:prod # Deploy all stacks (prod, requires vcm-prod credentials)
```

## Bun runtime layer (image processing)

Image processing uses `Bun.Image` on a custom Lambda runtime. The Bun binary is published as an account-scoped layer via `BunTimeStack` — deploy **once per AWS account** before MediaStack can deploy:

```sh
# Dev account (418553863544)
vpr cdk:deploy:buntime

# Prod account (041632640830)
vpr cdk:deploy:buntime:prod
```

`BunTimeStack` is **not** part of `cdk deploy --all` or GitHub Actions. Feature-branch destroy workflows never include it. The layer ARN is stored in SSM at `/vcmuellheim/lambda/buntime-arn`. After buntime exists, deploy MediaStack and WebAppStack together so the webapp can invoke `vcm-bun-image-processor-*`.

## GitHub Actions / CI

### How deployments work

| Branch    | AWS account | Role secret         |
| --------- | ----------- | ------------------- |
| `main`    | prod        | `AWS_ROLE_ARN_PROD` |
| any other | dev         | `AWS_ROLE_ARN_DEV`  |

Feature-branch deploys create branch-scoped app stacks only. **Budget** and **Monitoring** stacks are account-baseline resources and deploy for prod and shared dev (`main`) — not per feature branch.

Deployments use OIDC — no long-lived access keys. The trust policies are in:

- `github-actions-trust-policy.json` — prod account (`041632640830`)
- `github-actions-trust-policy-dev.json` — dev account (`418553863544`)

### Required repository secrets

| Secret              | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `AWS_ROLE_ARN_DEV`  | ARN of the GitHub Actions OIDC role in the dev account  |
| `AWS_ROLE_ARN_PROD` | ARN of the GitHub Actions OIDC role in the prod account |

Application and deployment environment values such as `BETTER_AUTH_SECRET` and `CDK_BUDGET_ALERT_EMAIL` are **not** stored as GitHub repository secrets. GitHub Actions assumes the appropriate AWS role via OIDC, then Varlock loads those values from AWS SSM Parameter Store / AWS Secrets Manager as defined by the environment schema.
