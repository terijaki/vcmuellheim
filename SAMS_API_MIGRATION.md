# SAMS API Client Generation - HeyAPI v0.88 Migration

This document explains the migration to HeyAPI `@hey-api/openapi-ts` v0.88 and how to use the API client generation.

## What Changed in v0.88

The configuration format in `sams-api.config.ts` is already compatible with HeyAPI v0.88. The main changes from earlier versions include:

- Uses `defineConfig` from `@hey-api/openapi-ts`
- Properly structured `output`, `parser`, and `plugins` options
- Uses the new plugin format with named plugins (`zod`, `@hey-api/client-next`, `@hey-api/sdk`)

## Usage

### Standard Usage (Fetch from URL)

To update the SAMS client by fetching the latest OpenAPI spec from the remote server:

```bash
bun run sams:update
```

This command will:
1. Fetch the OpenAPI specification from `https://www.volleyball-baden.de/api/v2/swagger.json`
2. Apply custom schema patches defined in `sams-api.config.ts`
3. Generate TypeScript types, Zod schemas, and SDK code in `data/sams/client/`

### Local Development Usage (Use Cached File)

If the remote API is not accessible or you want faster generation using a cached spec:

```bash
bun run sams:update:local
```

This command will:
1. Use the local `data/sams/swagger.json` file
2. Apply the same schema patches
3. Generate the same output as the URL-based command

### Troubleshooting

#### "Request failed with status 200" Error

This error typically occurs when:
- The remote API server is unreachable
- Network/DNS issues prevent access to the API
- The API response is malformed or unexpected

**Solution**: Use the local configuration:
```bash
bun run sams:update:local
```

#### Updating the Local Swagger File

To download and cache the latest OpenAPI spec locally:

```bash
curl -o data/sams/swagger.json https://www.volleyball-baden.de/api/v2/swagger.json
```

Then use `bun run sams:update:local` to generate from the cached file.

## Configuration Files

- **`sams-api.config.ts`**: Main configuration that fetches from the remote URL
- **`sams-api.local.config.ts`**: Alternative configuration that uses the local cached file

Both configurations:
- Use identical schema patches and output settings
- Generate the same TypeScript types and Zod validators
- Support the same plugins and options

## Error Logs

Error logs are automatically saved to `openapi-ts-error-*.log` files when generation fails. These files are git-ignored and can be reviewed for debugging.

## Migration from Earlier Versions

If you're coming from an earlier version of HeyAPI openapi-ts (< v0.87):

1. ✅ The configuration format has already been updated to v0.88
2. ✅ All plugins use the new naming convention
3. ✅ Parser patches are in the correct v0.88 format
4. ✅ Output configuration uses the modern structure

No additional migration steps are required. Just run:
```bash
bun run sams:update
```

## References

- [HeyAPI Migration Guide](https://heyapi.dev/openapi-ts/migrating)
- [HeyAPI Configuration Docs](https://heyapi.dev/openapi-ts/configuration)
- [HeyAPI OpenAPI-TS Docs](https://heyapi.dev/openapi-ts/)

## Known Issues

### Lambda Function Imports

The lambda functions in `lambda/sams/` directory currently have incorrect import paths:
- They use `../data/sams/client` which should be `../../data/sams/client`  
- They use `../utils/slugify` which should be `../../utils/slugify`

These lambda functions are excluded from the Next.js build and will need to be fixed separately when they are deployed or tested.
