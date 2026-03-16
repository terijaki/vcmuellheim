import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { cmsUsersRepository, getAllCmsUsers, getCmsUserByEmail } from "@/lib/db/repositories";
import { adminProcedure, router } from "../trpc";

// Zod schemas
const UserRole = z.enum(["Admin", "Moderator"]);

export const usersRouter = router({
	/**
	 * List all CMS users
	 */
	list: adminProcedure.query(async () => {
		try {
			const users = await getAllCmsUsers();
			return users.map((user) => ({
				id: user.id,
				email: user.email,
				name: user.name,
				givenName: user.name.split(" ")[0] || user.name,
				familyName: user.name.split(" ").slice(1).join(" ") || "",
				role: user.role,
				groups: [user.role],
				created: user.createdAt,
				modified: user.updatedAt,
			}));
		} catch (error) {
			console.error("Failed to list users:", error);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to list users",
			});
		}
	}),

	/**
	 * Get a single user by email
	 */
	getByEmail: adminProcedure.input(z.object({ email: z.string().email() })).query(async ({ input }) => {
		try {
			const user = await getCmsUserByEmail(input.email);
			if (!user) {
				throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
			}
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
		} catch (error) {
			if (error instanceof TRPCError) throw error;
			console.error("Failed to get user:", error);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to get user",
			});
		}
	}),

	/**
	 * Create a new CMS user (whitelisted email)
	 * Registers the user in DynamoDB for email OTP whitelist
	 */
	create: adminProcedure
		.input(
			z.object({
				email: z.email(),
				givenName: z.string().min(1),
				familyName: z.string().min(1),
				role: UserRole,
			}),
		)
		.mutation(async ({ input }) => {
			// Check if user already exists
			const existing = await getCmsUserByEmail(input.email);
			if (existing) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "A user with this email already exists",
				});
			}

			const name = `${input.givenName} ${input.familyName}`.trim();
			const userId = crypto.randomUUID();

			try {
				await cmsUsersRepository.create({
					id: userId,
					email: input.email,
					name,
					emailVerified: false,
					role: input.role,
				});

				return {
					email: input.email,
					givenName: input.givenName,
					familyName: input.familyName,
					role: input.role,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to create user: ${errorMessage}`,
				});
			}
		}),

	/**
	 * Update user name and role
	 */
	update: adminProcedure
		.input(
			z.object({
				email: z.email(),
				givenName: z.string().min(1).optional(),
				familyName: z.string().min(1).optional(),
				role: UserRole.optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// Prevent users from changing their own role
			if (ctx.userEmail === input.email && input.role) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You cannot change your own role",
				});
			}

			const user = await getCmsUserByEmail(input.email);
			if (!user) {
				throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
			}

			try {
				const newName = input.givenName || input.familyName ? `${input.givenName ?? user.name.split(" ")[0]} ${input.familyName ?? user.name.split(" ").slice(1).join(" ")}`.trim() : user.name;

				const updates: Partial<{ name: string; role: "Admin" | "Moderator" }> = {};
				if (newName !== user.name) updates.name = newName;
				if (input.role && input.role !== user.role) updates.role = input.role;

				if (Object.keys(updates).length > 0) {
					await cmsUsersRepository.update(user.id, updates);
				}

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update user",
				});
			}
		}),

	/**
	 * Delete user permanently
	 */
	delete: adminProcedure.input(z.object({ email: z.email() })).mutation(async ({ input, ctx }) => {
		// Prevent users from deleting themselves
		if (ctx.userEmail === input.email) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You cannot delete your own account",
			});
		}

		const user = await getCmsUserByEmail(input.email);
		if (!user) {
			throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
		}

		try {
			await cmsUsersRepository.delete(user.id);
			return { success: true };
		} catch (error) {
			if (error instanceof TRPCError) throw error;
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to delete user",
			});
		}
	}),
});
