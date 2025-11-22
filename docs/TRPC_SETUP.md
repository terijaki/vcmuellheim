# tRPC Setup Guide

## Overview

tRPC provides end-to-end type safety between your backend (DynamoDB + Lambda) and frontend (React). Your Zod schemas serve as the single source of truth for both runtime validation and TypeScript types.

## Architecture

```
Zod Schemas → DynamoDB Repository → tRPC Procedures → React Frontend
     ↓              ↓                      ↓               ↓
  Validation   Data Access           API Layer      Type-safe calls
```

## Backend (Lambda)

The tRPC API is deployed as a Lambda function behind API Gateway:

- **Handler**: `lambda/trpc/handler.ts`
- **Routers**: `lib/trpc/routers/*.ts` (one per entity)
- **Main Router**: `lib/trpc/index.ts` (combines all routers)

## Frontend Setup (React + Vite)

### 1. Create tRPC Provider

```typescript
// src/lib/trpc-provider.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { trpc } from "../../lib/trpc/client";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "https://api.vcmuellheim.de/trpc", // Your API Gateway URL
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

### 2. Wrap Your App

```typescript
// src/main.tsx
import { TRPCProvider } from "./lib/trpc-provider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <TRPCProvider>
    <App />
  </TRPCProvider>
);
```

### 3. Use in Components

```typescript
// src/components/NewsList.tsx
import { trpc } from "../../lib/trpc/client";

export function NewsList() {
  // Fully typed query - autocomplete works!
  const { data, isLoading, error } = trpc.news.list.useQuery({ limit: 10 });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.items.map((news) => (
        <div key={news.id}>
          <h2>{news.title}</h2>
          <p>{news.excerpt}</p>
        </div>
      ))}
    </div>
  );
}
```

### 4. Mutations (Create/Update/Delete)

```typescript
// src/components/NewsEditor.tsx
import { trpc } from "../../lib/trpc/client";

export function NewsEditor() {
  const utils = trpc.useUtils();
  
  // Fully typed mutation
  const createNews = trpc.news.create.useMutation({
    onSuccess: () => {
      // Invalidate and refetch news list
      utils.news.list.invalidate();
    },
  });

  const handleSubmit = (data: NewsFormData) => {
    createNews.mutate({
      title: data.title,
      slug: data.slug,
      content: data.content,
      status: "published",
      publishedDate: new Date().toISOString(),
      // TypeScript ensures all required fields are present!
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={createNews.isPending}>
        {createNews.isPending ? "Creating..." : "Create News"}
      </button>
    </form>
  );
}
```

## Available Routers

### News Router (`trpc.news.*`)

- `list({ limit? })` - Get published news
- `getById({ id })` - Get by ID
- `getBySlug({ slug })` - Get by slug
- `create(data)` - Create (admin)
- `update({ id, data })` - Update (admin)
- `delete({ id })` - Delete (admin)

### Events Router (`trpc.events.*`)

- `upcoming({ limit? })` - Get upcoming events
- `getById({ id })` - Get by ID
- `create(data)` - Create (admin)
- `update({ id, data })` - Update (admin)
- `delete({ id })` - Delete (admin)

### Teams Router (`trpc.teams.*`)

- `list()` - Get active teams
- `getById({ id })` - Get by ID
- `getBySlug({ slug })` - Get by slug
- `getBySamsId({ sbvvTeamId })` - Get by SAMS ID
- `create(data)` - Create (admin)
- `update({ id, data })` - Update (admin)
- `delete({ id })` - Delete (admin)

### Members Router (`trpc.members.*`)

- `list()` - Get all members
- `board()` - Get board members (Vorstand)
- `trainers()` - Get trainers
- `getById({ id })` - Get by ID
- `create(data)` - Create (admin)
- `update({ id, data })` - Update (admin)
- `delete({ id })` - Delete (admin)

### Media Router (`trpc.media.*`)

- `getById({ id })` - Get by ID
- `getMany({ ids })` - Get multiple items
- `create(data)` - Create (admin)
- `update({ id, data })` - Update (admin)
- `delete({ id })` - Delete (admin, triggers S3 cleanup)

### Sponsors Router (`trpc.sponsors.*`)

- `list()` - Get active sponsors
- `getById({ id })` - Get by ID
- `create(data)` - Create (admin)
- `update({ id, data })` - Update (admin)
- `delete({ id })` - Delete (admin)

## Authentication

Admin mutations require authentication via Cognito:

1. User logs in with Cognito
2. Frontend sends JWT token in request headers
3. Lambda extracts `userId` from JWT claims
4. `protectedProcedure` validates authentication
5. Mutation executes with user context

## Benefits

✅ **End-to-end type safety** - No API code generation needed  
✅ **Autocomplete everywhere** - IntelliSense in your IDE  
✅ **Runtime validation** - Zod validates all inputs  
✅ **Single source of truth** - Zod schemas power everything  
✅ **Automatic serialization** - Dates, Maps, Sets work natively  
✅ **Request batching** - Multiple calls bundled into one HTTP request  
✅ **React Query integration** - Caching, refetching, optimistic updates

## Next Steps

1. Deploy Lambda function with tRPC handler
2. Set up API Gateway HTTP API
3. Configure Cognito User Pool
4. Create React admin interface
5. Migrate from Payload to DynamoDB
