/**
 * tRPC client setup for website frontend
 * Connects to Lambda/API Gateway via HTTP
 */

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../../lib/trpc";

export const trpc = createTRPCReact<AppRouter>();
