/**
 * tRPC client setup for React applications
 * Use this in your Vite/React frontend
 */

import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "./index";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();
