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

# SAMS
SAMS_API_KEY=""

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
vpr verify:all      # Lint + typecheck + tests (full quality gate)

vpr db:seed         # Seed dev DynamoDB with fake data
vpr db:seed:sams    # Trigger SAMS sync Lambdas

vpr cdk:synth       # Synthesize CDK stacks (dev)
vpr cdk:diff        # Show changes vs deployed (dev)
vpr cdk:deploy:all  # Deploy all stacks (dev)
vpr cdk:deploy:prod # Deploy all stacks (prod, requires vcm-prod credentials)
```

## GitHub Actions / CI

### How deployments work

| Branch    | AWS account | Role secret         |
| --------- | ----------- | ------------------- |
| `main`    | prod        | `AWS_ROLE_ARN_PROD` |
| any other | dev         | `AWS_ROLE_ARN_DEV`  |

Deployments use OIDC — no long-lived access keys. The trust policies are in:

- `github-actions-trust-policy.json` — prod account (`041632640830`)
- `github-actions-trust-policy-dev.json` — dev account (`418553863544`)

### Required repository secrets

| Secret                   | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `AWS_ROLE_ARN_DEV`       | ARN of the GitHub Actions OIDC role in the dev account  |
| `AWS_ROLE_ARN_PROD`      | ARN of the GitHub Actions OIDC role in the prod account |
| `SAMS_API_KEY`           | SAMS API key                                            |
| `BETTER_AUTH_SECRET`     | Secret used to sign auth sessions                       |
| `CDK_BUDGET_ALERT_EMAIL` | Email for AWS budget alerts                             |
