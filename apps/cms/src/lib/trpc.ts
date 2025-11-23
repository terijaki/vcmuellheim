import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../../lib/trpc";

export const trpc = createTRPCReact<AppRouter>();
