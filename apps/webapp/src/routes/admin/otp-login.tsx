import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const otpSearchSchema = z.union([z.string().regex(/^\d{1,6}$/), z.coerce.number().int().min(0).max(999999)]).transform((value) => String(value).padStart(6, "0"));

export const Route = createFileRoute("/admin/otp-login")({
	validateSearch: z.object({
		email: z.email().optional(),
		otp: otpSearchSchema.optional(),
	}),
	beforeLoad: ({ search }) => {
		throw redirect({
			to: "/admin",
			search,
			replace: true,
		});
	},
	component: () => null,
});
