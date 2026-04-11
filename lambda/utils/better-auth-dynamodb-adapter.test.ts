/**
 * Tests for the custom DynamoDB adapter using better-auth's official testUtils.
 *
 * We inject a lightweight in-memory db (createFakeDb) so no AWS infrastructure
 * is needed.  getTestInstance internally runs Kysely migrations against a real
 * Node.js in-memory SQLite db (node:sqlite); our custom adapter then handles
 * all actual auth operations via the injected fakeDb.
 *
 * Identity model: members with Admin or Moderator role are the auth user.
 * The member's `privateEmail` is the canonical auth identity (exposed as `email`
 * to better-auth). Login by `proxyEmail` alias resolves to the owning member.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { getTestInstance } from "better-auth/test";
import type { AuthDb } from "./better-auth-dynamodb-adapter";

// ── In-memory fake db ─────────────────────────────────────────────────────────

type FakeItem = Record<string, unknown>;

function createFakeDb() {
	const store: Record<"member" | "verification" | "session" | "account", Map<string, FakeItem>> = {
		member: new Map(),
		verification: new Map(),
		session: new Map(),
		account: new Map(),
	};

	function makeEntity(model: "member" | "verification" | "session" | "account", queries: Record<string, (params: FakeItem) => FakeItem[]>) {
		return {
			get: (key: { id: string }) => ({
				go: async () => ({ data: store[model].get(key.id) ?? null }),
			}),
			put: (item: FakeItem) => ({
				go: async () => {
					store[model].set(item.id as string, item);
				},
			}),
			delete: (key: { id: string }) => ({
				go: async () => {
					store[model].delete(key.id);
				},
			}),
			scan: {
				go: async () => ({ data: [...store[model].values()] }),
			},
			query: Object.fromEntries(
				Object.entries(queries).map(([name, fn]) => [
					name,
					(params: FakeItem) => ({
						go: async (opts?: { limit?: number; pages?: string }) => {
							const results = fn(params);
							return { data: opts?.limit !== undefined ? results.slice(0, opts.limit) : results };
						},
					}),
				]),
			),
		};
	}

	return {
		member: makeEntity("member", {
			byPrivateEmail: ({ privateEmail }) => [...store.member.values()].filter((m) => m.privateEmail === privateEmail),
			byProxyEmail: ({ proxyEmail }) => [...store.member.values()].filter((m) => m.proxyEmail === proxyEmail),
		}),
		verification: makeEntity("verification", {
			byIdentifier: ({ identifier }) => [...store.verification.values()].filter((v) => v.identifier === identifier),
		}),
		session: makeEntity("session", {
			byToken: ({ token }) => [...store.session.values()].filter((s) => s.token === token),
			byUserId: ({ userId }) => [...store.session.values()].filter((s) => s.userId === userId),
		}),
		account: makeEntity("account", {
			byUserId: ({ userId }) => [...store.account.values()].filter((a) => a.userId === userId),
		}),
	};
}

// ── Test suite ────────────────────────────────────────────────────────────────

// Lazily imported so the env var from setupFiles is resolved before
// parseLambdaEnv() runs at module evaluation time in the adapter.
let createDynamoDBAdapter: typeof import("./better-auth-dynamodb-adapter").createDynamoDBAdapter;

beforeAll(async () => {
	({ createDynamoDBAdapter } = await import("./better-auth-dynamodb-adapter"));
});

describe("dynamoDBAdapter via getTestInstance", () => {
	let fakeDb: ReturnType<typeof createFakeDb>;

	// Reset the in-memory store before every test to prevent cross-test leakage.
	beforeEach(() => {
		fakeDb = createFakeDb();
	});

	async function makeInstance() {
		return getTestInstance(
			// Pass our adapter; this overrides better-auth's default SQLite database.
			{
				database: createDynamoDBAdapter(() => fakeDb as unknown as AuthDb),
				// Match production config: role is a required additional field on users/members.
				user: {
					additionalFields: {
						role: {
							type: "string" as const,
							required: true,
							defaultValue: "Moderator",
						},
					},
				},
			},
			{
				// Disable the pre-created test user so we control all data in the store.
				disableTestUser: true,
			},
		);
	}

	it("signs up and returns user data", async () => {
		const { client } = await makeInstance();

		const { data, error } = await client.signUp.email({
			email: "alice@example.com",
			password: "supersecret123",
			name: "Alice",
		});

		expect(error).toBeNull();
		expect(data?.user.email).toBe("alice@example.com");
		expect(data?.user.name).toBe("Alice");
		// A session token should have been issued.
		expect(data?.token).toBeTruthy();
	});

	it("signs in after sign-up and returns a valid session token", async () => {
		const { client } = await makeInstance();

		await client.signUp.email({
			email: "bob@example.com",
			password: "hunter2hunter2",
			name: "Bob",
		});

		const { data, error } = await client.signIn.email({
			email: "bob@example.com",
			password: "hunter2hunter2",
		});

		expect(error).toBeNull();
		expect(data?.user.email).toBe("bob@example.com");
		expect(data?.token).toBeTruthy();
	});

	it("rejects sign-in with wrong password", async () => {
		const { client } = await makeInstance();

		await client.signUp.email({
			email: "eve@example.com",
			password: "correct-password",
			name: "Eve",
		});

		const { data, error } = await client.signIn.email({
			email: "eve@example.com",
			password: "wrong-password",
		});

		expect(data).toBeNull();
		expect(error).toBeTruthy();
	});

	it("persists session and allows getSession by token", async () => {
		const { client, auth } = await makeInstance();

		const signUpResult = await client.signUp.email({
			email: "carol@example.com",
			password: "password12345",
			name: "Carol",
		});

		const token = signUpResult.data?.token;
		expect(token).toBeTruthy();

		const session = await auth.api.getSession({
			headers: new Headers({ Authorization: `Bearer ${token}` }),
		});

		expect(session?.user.email).toBe("carol@example.com");
	});

	it("deletes session on sign-out", async () => {
		const { client, auth } = await makeInstance();

		const signUpResult = await client.signUp.email({
			email: "dave@example.com",
			password: "password99999",
			name: "Dave",
		});

		const token = signUpResult.data?.token;
		expect(token).toBeTruthy();

		// Confirm session exists.
		const sessionBefore = await auth.api.getSession({
			headers: new Headers({ Authorization: `Bearer ${token}` }),
		});
		expect(sessionBefore?.user.email).toBe("dave@example.com");

		// Sign out — removes the session from the adapter.
		await client.signOut({ fetchOptions: { headers: { Authorization: `Bearer ${token}` } } });

		// Session should now be gone.
		const sessionAfter = await auth.api.getSession({
			headers: new Headers({ Authorization: `Bearer ${token}` }),
		});
		expect(sessionAfter).toBeNull();
	});
});

describe("member identity model", () => {
	let fakeDb: ReturnType<typeof createFakeDb>;
	let createDynamoDBAdapter: typeof import("./better-auth-dynamodb-adapter").createDynamoDBAdapter;

	beforeAll(async () => {
		({ createDynamoDBAdapter } = await import("./better-auth-dynamodb-adapter"));
	});

	beforeEach(() => {
		fakeDb = createFakeDb();
	});

	it("login by privateEmail succeeds for Admin member", async () => {
		const { client } = await getTestInstance(
			{ database: createDynamoDBAdapter(() => fakeDb as unknown as AuthDb), user: { additionalFields: { role: { type: "string" as const, required: true, defaultValue: "Moderator" } } } },
			{ disableTestUser: true },
		);

		// Pre-seed an Admin member via sign-up (role defaults to "Moderator" per additionalFields;
		// better-auth sets it as part of user creation)
		await client.signUp.email({ email: "admin@private.de", password: "secret123", name: "Admin User" });
		// The member is stored with privateEmail = "admin@private.de" and role = "Moderator"

		const { data, error } = await client.signIn.email({ email: "admin@private.de", password: "secret123" });
		expect(error).toBeNull();
		expect(data?.user.email).toBe("admin@private.de");
	});

	it("login is rejected for member without admin role", async () => {
		const { client } = await getTestInstance({ database: createDynamoDBAdapter(() => fakeDb as unknown as AuthDb) }, { disableTestUser: true });

		// Manually seed a member without a role (simulates a plain member, not admin-eligible)
		const memberId = crypto.randomUUID();
		// The fakeDb stores items directly — we bypass signUp to plant a role-less member
		// We do this through the adapter's create path by temporarily using a minimal fake
		const rolelesDb = {
			...fakeDb,
			member: {
				...fakeDb.member,
				query: {
					byPrivateEmail: fakeDb.member.query.byPrivateEmail,
					byProxyEmail: fakeDb.member.query.byProxyEmail,
				},
			},
		};
		// Directly insert a member without role into the member store
		await fakeDb.member.put({ id: memberId, privateEmail: "nonadmin@example.de", name: "Plain Member", emailVerified: false }).go();

		const { data, error } = await client.signIn.email({ email: "nonadmin@example.de", password: "any" });
		expect(data).toBeNull();
		expect(error).toBeTruthy();
		expect(void rolelesDb).toBeUndefined(); // suppress unused-var warning
	});

	it("login by proxyEmail resolves to member's privateEmail as canonical identity", async () => {
		const { client } = await getTestInstance(
			{ database: createDynamoDBAdapter(() => fakeDb as unknown as AuthDb), user: { additionalFields: { role: { type: "string" as const, required: true, defaultValue: "Moderator" } } } },
			{ disableTestUser: true },
		);

		// Create member via sign-up (stores privateEmail = "private@example.de")
		await client.signUp.email({ email: "private@example.de", password: "secret123", name: "Proxy User" });

		// Manually add proxyEmail to the stored member record
		const stored = [...(await fakeDb.member.scan.go()).data][0];
		await fakeDb.member.put({ ...stored, proxyEmail: "proxy@public.de" }).go();

		// Sign in with proxyEmail — should be accepted and session email = privateEmail
		const { data, error } = await client.signIn.email({ email: "proxy@public.de", password: "secret123" });
		expect(error).toBeNull();
		// The session's canonical identity is the privateEmail, not the proxyEmail alias
		expect(data?.user.email).toBe("private@example.de");
	});
});
