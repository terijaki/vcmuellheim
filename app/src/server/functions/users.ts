/**
 * Users server functions — replaces lib/trpc/routers/users.ts
 * All functions require Admin role.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import type { CmsUser } from "@/lib/db/types";
import { requireAdminMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";
import { getAllCmsUsers, getCmsUserByEmail } from "../queries";

const UserRole = z.enum(["Admin", "Moderator"]);

function formatUser(user: CmsUser) {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		givenName: user.name.split(" ")[0] || user.name,
		familyName: user.name.split(" ").slice(1).join(" ") || "",
		role: user.role,
		groups: [user.role],
		created: user.createdAt,
		modified: user.updatedAt,
	};
}

export const listUsersFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.handler(async () => {
		const users = await getAllCmsUsers();
		return users.map(formatUser);
	});

export const createUserFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(
		z.object({
			email: z.email(),
			givenName: z.string().min(1),
			familyName: z.string().min(1),
			role: UserRole,
		}),
	)
	.handler(async ({ data }) => {
		const existing = await getCmsUserByEmail(data.email);
		if (existing) throw new Error("A user with this email already exists");

		const name = `${data.givenName} ${data.familyName}`.trim();
		const userId = crypto.randomUUID();
		const user = withTimestamps({
			id: userId,
			email: data.email,
			name,
			emailVerified: false,
			role: data.role,
		});

		await db().user.create(user).go();

		return { email: data.email, givenName: data.givenName, familyName: data.familyName, role: data.role };
	});

export const updateUserFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(
		z.object({
			email: z.email(),
			givenName: z.string().min(1).optional(),
			familyName: z.string().min(1).optional(),
			role: UserRole.optional(),
		}),
	)
	.handler(async ({ data, context }) => {
		if (context.userEmail === data.email && data.role) {
			throw new Error("You cannot change your own role");
		}
		const user = await getCmsUserByEmail(data.email);
		if (!user) throw new Error("User not found");

		const newName = data.givenName || data.familyName ? `${data.givenName ?? user.name.split(" ")[0]} ${data.familyName ?? user.name.split(" ").slice(1).join(" ")}`.trim() : user.name;

		const updates: Partial<{ name: string; role: "Admin" | "Moderator" }> = {};
		if (newName !== user.name) updates.name = newName;
		if (data.role && data.role !== user.role) updates.role = data.role;

		if (Object.keys(updates).length > 0) {
			await db()
				.user.patch({ id: user.id })
				.set({ ...updates, updatedAt: new Date().toISOString() })
				.go();
		}

		return { success: true };
	});

export const deleteUserFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(z.object({ email: z.email() }))
	.handler(async ({ data, context }) => {
		if (context.userEmail === data.email) {
			throw new Error("You cannot delete your own account");
		}
		const user = await getCmsUserByEmail(data.email);
		if (!user) throw new Error("User not found");
		await db().user.delete({ id: user.id }).go();
		return { success: true };
	});
