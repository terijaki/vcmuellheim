import {
	AdminAddUserToGroupCommand,
	AdminCreateUserCommand,
	AdminDeleteUserCommand,
	AdminGetUserCommand,
	AdminListGroupsForUserCommand,
	AdminRemoveUserFromGroupCommand,
	AdminUpdateUserAttributesCommand,
	CognitoIdentityProviderClient,
	ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "../trpc";

// Cognito client (singleton)
const cognitoClient = new CognitoIdentityProviderClient({
	region: process.env.AWS_REGION || "eu-central-1",
});

const userPoolId = process.env.COGNITO_USER_POOL_ID;

if (!userPoolId) {
	throw new Error("COGNITO_USER_POOL_ID environment variable is required");
}

// Zod schemas
const UserRole = z.enum(["Admin", "Moderator"]);

export const usersRouter = router({
	/**
	 * List all users in the Cognito User Pool
	 */
	list: adminProcedure.query(async () => {
		try {
			const command = new ListUsersCommand({
				UserPoolId: userPoolId,
				Limit: 60, // Max users to return
			});

			const response = await cognitoClient.send(command);

			const users = await Promise.all(
				(response.Users || []).map(async (user) => {
					// Extract attributes
					const attrs = user.Attributes || [];
					const getAttr = (name: string) => attrs.find((a) => a.Name === name)?.Value;
					const email = getAttr("email") || "";
					if (!email) return null;

					// Get user's groups
					const groupsCommand = new AdminListGroupsForUserCommand({
						UserPoolId: userPoolId,
						Username: email,
					});
					const groupsResponse = await cognitoClient.send(groupsCommand);
					const groups = (groupsResponse.Groups || []).map((g) => g.GroupName || "").filter(Boolean);

					return {
						email,
						givenName: getAttr("given_name") || "",
						familyName: getAttr("family_name") || "",
						status: user.UserStatus || "UNKNOWN",
						created: user.UserCreateDate?.toISOString() || "",
						modified: user.UserLastModifiedDate?.toISOString() || "",
						groups,
					};
				}),
			);

			return users.filter((u): u is NonNullable<typeof u> => u !== null);
		} catch (error) {
			console.error("Failed to list users:", error);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to list users from Cognito",
			});
		}
	}),

	/**
	 * Get a single user by email
	 */
	getByEmail: adminProcedure.input(z.object({ email: z.string().email() })).query(async ({ input }) => {
		try {
			const command = new AdminGetUserCommand({
				UserPoolId: userPoolId,
				Username: input.email,
			});

			const response = await cognitoClient.send(command);

			// Get user's groups
			const groupsCommand = new AdminListGroupsForUserCommand({
				UserPoolId: userPoolId,
				Username: input.email,
			});
			const groupsResponse = await cognitoClient.send(groupsCommand);
			const groups = (groupsResponse.Groups || []).map((g) => g.GroupName || "").filter(Boolean);

			// Extract attributes
			const attrs = response.UserAttributes || [];
			const getAttr = (name: string) => attrs.find((a) => a.Name === name)?.Value;

			return {
				email: input.email,
				givenName: getAttr("given_name") || "",
				familyName: getAttr("family_name") || "",
				status: response.UserStatus || "UNKNOWN",
				created: response.UserCreateDate?.toISOString() || "",
				modified: response.UserLastModifiedDate?.toISOString() || "",
				groups,
			};
		} catch (error) {
			console.error("Failed to get user:", error);
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "User not found",
			});
		}
	}),

	/**
	 * Create a new user
	 */
	create: adminProcedure
		.input(
			z.object({
				email: z.email(),
				givenName: z.string().min(1),
				familyName: z.string().min(1),
				role: UserRole,
				sendInvite: z.boolean().default(true),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				// Create user
				const command = new AdminCreateUserCommand({
					UserPoolId: userPoolId,
					Username: input.email,
					UserAttributes: [
						{ Name: "email", Value: input.email },
						{ Name: "email_verified", Value: "true" },
						{ Name: "given_name", Value: input.givenName },
						{ Name: "family_name", Value: input.familyName },
					],
					DesiredDeliveryMediums: input.sendInvite ? ["EMAIL"] : undefined,
					MessageAction: input.sendInvite ? undefined : "SUPPRESS",
				});

				const createResponse = await cognitoClient.send(command);
				const cognitoUsername = createResponse.User?.Username;

				if (!cognitoUsername) {
					throw new Error("User creation succeeded but no username was returned");
				}

				// Add user to group
				const groupCommand = new AdminAddUserToGroupCommand({
					UserPoolId: userPoolId,
					Username: cognitoUsername,
					GroupName: input.role,
				});

				await cognitoClient.send(groupCommand);
				return {
					email: input.email,
					givenName: input.givenName,
					familyName: input.familyName,
					role: input.role,
				};
			} catch (error) {
				console.error("Failed to create user:", error);

				if (error && typeof error === "object" && "name" in error && error.name === "UsernameExistsException") {
					throw new TRPCError({
						code: "CONFLICT",
						message: "A user with this email already exists",
					});
				}

				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to create user: ${errorMessage}`,
				});
			}
		}),

	/**
	 * Update user attributes and role
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
			try {
				const attributes = [];

				if (input.givenName) {
					attributes.push({ Name: "given_name", Value: input.givenName });
				}

				if (input.familyName) {
					attributes.push({ Name: "family_name", Value: input.familyName });
				}

				if (attributes.length > 0) {
					const command = new AdminUpdateUserAttributesCommand({
						UserPoolId: userPoolId,
						Username: input.email,
						UserAttributes: attributes,
					});

					await cognitoClient.send(command);
				}

				// Handle role change if provided
				if (input.role) {
					// Prevent users from changing their own role
					if (ctx.userEmail === input.email) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message: "You cannot change your own role",
						});
					}

					// Get user's current groups
					const groupsCommand = new AdminListGroupsForUserCommand({
						UserPoolId: userPoolId,
						Username: input.email,
					});
					const groupsResponse = await cognitoClient.send(groupsCommand);
					const currentGroups = (groupsResponse.Groups || []).map((g) => g.GroupName || "").filter(Boolean);

					// Remove from all current groups
					for (const group of currentGroups) {
						const removeCommand = new AdminRemoveUserFromGroupCommand({
							UserPoolId: userPoolId,
							Username: input.email,
							GroupName: group,
						});
						await cognitoClient.send(removeCommand);
					}

					// Add to new group
					const addCommand = new AdminAddUserToGroupCommand({
						UserPoolId: userPoolId,
						Username: input.email,
						GroupName: input.role,
					});

					await cognitoClient.send(addCommand);
				}

				return { success: true };
			} catch (error) {
				console.error("Failed to update user:", error);

				if (error instanceof TRPCError && error.code === "FORBIDDEN") {
					throw error;
				}

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
		try {
			// Prevent users from deleting themselves
			if (ctx.userEmail === input.email) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You cannot delete your own account",
				});
			}

			const command = new AdminDeleteUserCommand({
				UserPoolId: userPoolId,
				Username: input.email,
			});

			await cognitoClient.send(command);

			return { success: true };
		} catch (error) {
			console.error("Failed to delete user:", error);

			if (error instanceof TRPCError && error.code === "FORBIDDEN") {
				throw error;
			}

			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to delete user",
			});
		}
	}),
});
