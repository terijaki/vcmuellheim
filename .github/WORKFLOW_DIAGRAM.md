# GitHub Actions Workflow Diagram

## Feature Branch Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ Developer Workflow                                              │
└─────────────────────────────────────────────────────────────────┘

1. Create Feature Branch
   ├─ git checkout -b feature/new-endpoint
   └─ git push origin feature/new-endpoint
        │
        ▼
   ┌──────────────────────────────────┐
   │  GitHub Actions: cdk-deploy.yml  │
   │  - Detects: Not main branch      │
   │  - Environment: dev              │
   │  - Action: Deploy                │
   └──────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────────────────────┐
   │  AWS Resources Created:                          │
   │  - Stack: SamsApiStack-Dev-feature-new-endpo     │
   │  - Lambda: dev-feature-new-endpo-sams-*          │
   │  - DynamoDB: dev-feature-new-endpo-sams-*        │
   │  - API Gateway, CloudFront, EventBridge...       │
   └──────────────────────────────────────────────────┘

2. Work on Feature
   ├─ Make changes
   ├─ git commit -m "Update endpoint"
   └─ git push
        │
        ▼
   ┌──────────────────────────────────┐
   │  GitHub Actions: cdk-deploy.yml  │
   │  - Updates existing stack        │
   └──────────────────────────────────┘

3. Merge/Delete Branch
   ├─ Create PR and merge
   └─ Delete feature branch
        │
        ▼
   ┌──────────────────────────────────┐
   │ GitHub Actions: cdk-destroy.yml  │
   │ - Detects: Branch closed/deleted │
   │ - Action: Destroy stack          │
   └──────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────┐
   │  AWS Resources Cleaned Up        │
   │  ✓ All resources deleted         │
   │  ✓ No orphaned stacks            │
   │  ✓ Costs stopped                 │
   └──────────────────────────────────┘
```

## Main Branch Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ Production Deployment                                           │
└─────────────────────────────────────────────────────────────────┘

1. Merge to Main
   ├─ PR approved and merged
   └─ git push origin main
        │
        ▼
   ┌──────────────────────────────────┐
   │  GitHub Actions: cdk-deploy.yml  │
   │  - Detects: Main branch          │
   │  - Environment: prod             │
   │  - Action: Deploy                │
   └──────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────────────────────┐
   │  AWS Production Resources:                       │
   │  - Stack: SamsApiStack-Prod                      │
   │  - Lambda: prod-sams-*                           │
   │  - DynamoDB: prod-sams-* (RETAINED)              │
   │  - API Gateway, CloudFront, EventBridge...       │
   └──────────────────────────────────────────────────┘

⚠️  Production stack is NEVER auto-destroyed
    Manual destruction only via: bun run cdk:destroy:prod
```

## Multiple Feature Branches

```
┌──────────────────────────────────────────────────────────────┐
│ Parallel Development (No Conflicts!)                         │
└──────────────────────────────────────────────────────────────┘

Developer A                    Developer B                    Developer C
feature/auth                   feature/search                 bugfix/rate-limit
     │                              │                              │
     ▼                              ▼                              ▼
SamsApiStack-Dev-             SamsApiStack-Dev-             SamsApiStack-Dev-
feature-auth                  feature-search                bugfix-rate-limit
     │                              │                              │
     ├─ dev-feature-auth-*          ├─ dev-feature-search-*        ├─ dev-bugfix-rate-lim-*
     ├─ Isolated resources          ├─ Isolated resources          ├─ Isolated resources
     └─ No conflicts!               └─ No conflicts!               └─ No conflicts!

Each developer has their own:
✓ DynamoDB tables
✓ Lambda functions  
✓ API Gateway
✓ CloudFront distribution
✓ EventBridge rules
```

## Resource Naming Pattern

```
Stack Name Pattern:
SamsApiStack-{Environment}-{BranchSuffix}
                │             │
                │             └─ Only on non-main branches
                │                (sanitized, max 20 chars)
                └─ "Dev" or "Prod"

Examples:
┌─────────────────────┬──────────────────────────────────────┐
│ Branch              │ Stack Name                           │
├─────────────────────┼──────────────────────────────────────┤
│ main (dev)          │ SamsApiStack-Dev                     │
│ main (prod)         │ SamsApiStack-Prod                    │
│ feature/api-v2      │ SamsApiStack-Dev-feature-api-v2      │
│ bugfix/issue-123    │ SamsApiStack-Dev-bugfix-issue-123    │
│ feat/new-endpoint   │ SamsApiStack-Dev-feat-new-endpoint   │
└─────────────────────┴──────────────────────────────────────┘

Resource Name Pattern:
{environment}-{branchSuffix}-{resource}
      │             │            │
      │             │            └─ Resource type (sams-clubs, etc.)
      │             └─ Only on non-main branches
      └─ "dev" or "prod"

Examples:
┌─────────────────────┬──────────────────────────────────────────┐
│ Branch              │ Lambda Function Name                     │
├─────────────────────┼──────────────────────────────────────────┤
│ main (dev)          │ dev-sams-league-matches                  │
│ main (prod)         │ prod-sams-league-matches                 │
│ feature/api-v2      │ dev-feature-api-v2-sams-league-matches   │
└─────────────────────┴──────────────────────────────────────────┘
```
