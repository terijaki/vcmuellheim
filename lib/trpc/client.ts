/**
 * tRPC client setup for React applications
 * Use this in your Vite/React frontend
 */

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./index";

export const trpc = createTRPCReact<AppRouter>();
