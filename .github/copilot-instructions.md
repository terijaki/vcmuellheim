# Project Guidelines for GitHub Copilot

## Development Stack

- **Framework:** AWS CDK, Vite, TanStack Router, TRPC
- **UI Library:** Mantine (components and styling)
- **Package Manager:** Bun
- **Formatting/Linting:** Biome
- **Date Library:** dayjs
- **Deployment:** AWS CDK

## Code Style Guidelines

- Use double quotes for strings
- Always include semicolons
- Use 2 spaces for indentation
- Prefer Server Components for data fetching
- Follow Biome formatting and linting rules
- Template literals are preferred over string concatenation
- Prefer for...of statement instead of Array.forEach
- Avoid else block when the if block breaks early
- Promote the use of import type for types
- Use Mantine components instead of custom UI components when possible
- Follow Mantine's theming and styling patterns

## Development Preferences

- Avoid suggesting installation of new dependencies
- Prefer solutions using existing project dependencies
- Use dayjs for all date operations instead of native Date or other date libraries
- When generating components, follow the project's established patterns
- Prefer Mantine components and hooks over custom implementations

## Architecture

- AWS Serverless architecture using Lambda functions
- API Gateway for REST endpoints
- DynamoDB for data storage
- EventBridge for scheduling sync tasks
- CDK for infrastructure as code
