/**
 * DynamoDB adapter for better-auth
 * Uses ElectroDB entities (CmsUserEntity, AuthVerificationEntity, SessionEntity)
 * so that all auth records land in the single shared content table with
 * the correct pk/sk composite keys.
 */

import { createAdapterFactory } from "better-auth/adapters";
import { createDb } from "@/lib/db/electrodb-client";
import { BetterAuthAdapterEnvironmentSchema } from "../content/types";
import { parseLambdaEnv } from "./env";
import { createDynamoDocClient, createLambdaResources } from "./resources";

// ── Adapter environment ──────────────────────────────────────────────────────

const env = parseLambdaEnv(BetterAuthAdapterEnvironmentSchema);

// Use a dedicated tracer for the adapter so it can be loaded standalone.
const { tracer } = createLambdaResources("vcm-auth-adapter");
const docClient = createDynamoDocClient(tracer);

// Lazily initialised to avoid evaluating CONTENT_TABLE_NAME at import time.
let _db: ReturnType<typeof createDb> | null = null;
function db() {
	if (!_db) _db = createDb(docClient, env.CONTENT_TABLE_NAME);
	return _db;
}

// ── Type helpers ──────────────────────────────────────────────────────────────

type AdapterWhere = Array<{ field: string; value: unknown; operator?: string; connector?: string }>;
type AdapterSortBy = { field: string; direction: "asc" | "desc" };
type AdapterJoin = { user?: boolean };
type AdapterFindManyArgs = {
	model: string;
	where?: AdapterWhere;
	limit?: number;
	select?: string[];
	sortBy?: AdapterSortBy;
	offset?: number;
	join?: AdapterJoin;
};

type ElectroItem = Record<string, unknown>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDateLike(value: unknown): number | null {
	if (value instanceof Date) return value.getTime();
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		if (!Number.isNaN(parsed)) return parsed;
	}
	return null;
}

function compareValues(a: unknown, b: unknown): number {
	const aDate = parseDateLike(a);
	const bDate = parseDateLike(b);
	if (aDate !== null && bDate !== null) return aDate - bDate;
	if (typeof a === "number" && typeof b === "number") return a - b;
	if (typeof a === "boolean" && typeof b === "boolean") {
		if (a === b) return 0;
		return a ? 1 : -1;
	}
	return String(a ?? "").localeCompare(String(b ?? ""));
}

function matchesWhere(item: ElectroItem, where: AdapterWhere): boolean {
	for (const condition of where) {
		const operator = condition.operator ?? "eq";
		const itemValue = item[condition.field];
		const expected = condition.value;

		switch (operator) {
			case "eq": {
				const iDate = parseDateLike(itemValue);
				const eDate = parseDateLike(expected);
				if (iDate !== null && eDate !== null) {
					if (iDate !== eDate) return false;
					break;
				}
				if (itemValue !== expected) return false;
				break;
			}
			case "ne": {
				const iDate = parseDateLike(itemValue);
				const eDate = parseDateLike(expected);
				if (iDate !== null && eDate !== null) {
					if (iDate === eDate) return false;
					break;
				}
				if (itemValue === expected) return false;
				break;
			}
			case "gt":
				if (compareValues(itemValue, expected) <= 0) return false;
				break;
			case "gte":
				if (compareValues(itemValue, expected) < 0) return false;
				break;
			case "lt":
				if (compareValues(itemValue, expected) >= 0) return false;
				break;
			case "lte":
				if (compareValues(itemValue, expected) > 0) return false;
				break;
			case "contains": {
				if (typeof itemValue === "string" && typeof expected === "string") {
					if (!itemValue.includes(expected)) return false;
					break;
				}
				if (Array.isArray(itemValue)) {
					if (!itemValue.includes(expected)) return false;
					break;
				}
				return false;
			}
			case "starts_with": {
				if (typeof itemValue !== "string" || typeof expected !== "string") return false;
				if (!itemValue.startsWith(expected)) return false;
				break;
			}
			default:
				if (itemValue !== expected) return false;
		}
	}
	return true;
}

function sortItems(items: ElectroItem[], sortBy?: AdapterSortBy) {
	if (!sortBy) return items;
	const sorted = [...items];
	sorted.sort((a, b) => {
		const comparison = compareValues(a[sortBy.field], b[sortBy.field]);
		return sortBy.direction === "asc" ? comparison : -comparison;
	});
	return sorted;
}

function selectFields(item: ElectroItem, select?: string[]): ElectroItem {
	if (!select || select.length === 0) return item;
	const filtered: ElectroItem = {};
	for (const key of select) {
		if (key in item) filtered[key] = item[key];
	}
	return filtered;
}

/** Derive date-to-TTL for expiring auth records (verification / session). */
function computeTtl(data: ElectroItem): number | undefined {
	if (!data.expiresAt) return undefined;
	const expiresAt = data.expiresAt instanceof Date ? data.expiresAt : new Date(String(data.expiresAt));
	if (Number.isNaN(expiresAt.getTime())) return undefined;
	return Math.floor(expiresAt.getTime() / 1000);
}

/**
 * Minimal interface representing the ElectroDB operations this adapter needs.
 * Typed through `unknown` to sidestep TypeScript's inability to call methods
 * on a union of ElectroDB entity types whose overload signatures are
 * incompatible with each other.
 */
type MinimalEntity = {
	get(key: { id: string }): { go(): Promise<{ data: ElectroItem | null }> };
	put(item: ElectroItem): { go(): Promise<unknown> };
	delete(key: { id: string }): { go(): Promise<unknown> };
	scan: { go(opts?: { pages?: "all" | number }): Promise<{ data: ElectroItem[] }> };
};

/** Resolve the correct ElectroDB entity for a given better-auth model name. */
function entityFor(model: string): MinimalEntity {
	const entities = db();
	let entity: unknown;
	switch (model) {
		case "user":
			entity = entities.user;
			break;
		case "verification":
			entity = entities.verification;
			break;
		case "session":
			entity = entities.session;
			break;
		default:
			throw new Error(`Unknown better-auth model: "${model}". Expected user | verification | session`);
	}
	return entity as MinimalEntity;
}

/** Join user data onto a session item when the caller requests it. */
async function withSessionUserJoin(item: ElectroItem | null, model: string, join: unknown): Promise<ElectroItem | null> {
	if (!item) return null;
	if (model !== "session") return item;
	if (!join || typeof join !== "object" || !("user" in join) || (join as AdapterJoin).user !== true) return item;

	const userId = item.userId;
	if (typeof userId !== "string" || !userId) return { ...item, user: null };

	const userResult = await db().user.get({ id: userId }).go();
	return { ...item, user: userResult.data ?? null };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export const dynamoDBAdapter = createAdapterFactory({
	config: {
		adapterId: "dynamodb",
		adapterName: "DynamoDB",
		supportsNumericIds: false,
		supportsUUIDs: true,
		supportsDates: false,
		usePlural: false,
		transaction: false,
	},
	adapter: ({ getModelName }) => {
		return {
			async create({ model, data }) {
				const resolvedModel = getModelName(model);
				const entity = entityFor(resolvedModel);

				const item: ElectroItem = { ...(data as ElectroItem) };

				// Inject TTL for expiring records so DynamoDB can clean them up automatically.
				if (resolvedModel === "verification" || resolvedModel === "session") {
					const ttl = computeTtl(item);
					if (ttl !== undefined) item.ttl = ttl;
				}

				await entity.put(item).go();
				return data as typeof data;
			},

			async findOne({ model, where, select, join }) {
				const resolvedModel = getModelName(model);
				const entity = entityFor(resolvedModel);

				// ── Optimised single-item lookup by id ────────────────────────────────
				const idWhere = where.find((w) => w.field === "id");
				if (idWhere) {
					const { data: item } = await entity.get({ id: idWhere.value as string }).go();
					if (!item) return null;
					const projected = selectFields(item as ElectroItem, select);
					return withSessionUserJoin(projected, resolvedModel, join) as ReturnType<typeof Object.assign>;
				}

				// ── User by email → GSI4-ByIdentifier ─────────────────────────────────
				if (resolvedModel === "user") {
					const emailWhere = where.find((w) => w.field === "email");
					if (emailWhere) {
						const { data: items } = await db()
							.user.query.byEmail({ email: emailWhere.value as string })
							.go({ limit: 1 });
						const first = (items[0] as ElectroItem | undefined) ?? null;
						return withSessionUserJoin(selectFields(first ?? {}, select), resolvedModel, join) as ReturnType<typeof Object.assign>;
					}
				}

				// ── Session by token → GSI3-BySlug (token uses gsi3pk) ────────────────
				if (resolvedModel === "session") {
					const tokenWhere = where.find((w) => w.field === "token");
					if (tokenWhere) {
						const { data: items } = await db()
							.session.query.byToken({ token: tokenWhere.value as string })
							.go({ limit: 1 });
						const first = (items[0] as ElectroItem | undefined) ?? null;
						return withSessionUserJoin(selectFields(first ?? {}, select), resolvedModel, join) as ReturnType<typeof Object.assign>;
					}
				}

				// ── Verification: always use the deterministic GSI path ────────────────
				if (resolvedModel === "verification") {
					const items = await this.findMany<ElectroItem>({
						model,
						where,
						limit: 1,
						sortBy: { field: "createdAt", direction: "desc" },
					});
					const first = items[0] ?? null;
					return withSessionUserJoin(selectFields(first ?? {}, select), resolvedModel, join) as ReturnType<typeof Object.assign>;
				}

				// ── Fallback: entity-scoped scan + in-memory filter ────────────────────
				const { data: scanned } = await entity.scan.go({ pages: "all" });
				const matched = (scanned as ElectroItem[]).find((item) => matchesWhere(item, where));
				if (!matched) return null;
				return withSessionUserJoin(selectFields(matched, select), resolvedModel, join) as ReturnType<typeof Object.assign>;
			},

			async findMany<T>({ model, where, limit = 100, sortBy, offset }: AdapterFindManyArgs): Promise<T[]> {
				const resolvedModel = getModelName(model);
				const entity = entityFor(resolvedModel);
				const startIndex = offset ?? 0;

				// ── Verification by identifier → GSI4-ByIdentifier ───────────────────
				if (resolvedModel === "verification" && where && where.length > 0) {
					const identifierWhere = where.find((w) => w.field === "identifier" && (!w.operator || w.operator === "eq"));
					if (identifierWhere) {
						const { data: items } = await db()
							.verification.query.byIdentifier({ identifier: identifierWhere.value as string })
							.go({ pages: "all" });
						const filtered = (items as ElectroItem[]).filter((item) => matchesWhere(item, where));
						const sorted = sortItems(filtered, sortBy);
						return sorted.slice(startIndex, startIndex + limit) as T[];
					}
				}

				// ── Session by userId → GSI1 ──────────────────────────────────────────
				if (resolvedModel === "session" && where && where.length > 0) {
					const userIdWhere = where.find((w) => w.field === "userId" && (!w.operator || w.operator === "eq"));
					if (userIdWhere) {
						const { data: items } = await db()
							.session.query.byUserId({ userId: userIdWhere.value as string })
							.go({ pages: "all" });
						const filtered = (items as ElectroItem[]).filter((item) => matchesWhere(item, where));
						const sorted = sortItems(filtered, sortBy);
						return sorted.slice(startIndex, startIndex + limit) as T[];
					}
				}

				// ── General entity-scoped scan + in-memory filter ─────────────────────
				const { data: allItems } = await entity.scan.go({ pages: "all" });
				const filtered = where && where.length > 0 ? (allItems as ElectroItem[]).filter((item) => matchesWhere(item, where)) : (allItems as ElectroItem[]);
				const sorted = sortItems(filtered, sortBy);
				return sorted.slice(startIndex, startIndex + limit) as T[];
			},

			async update({ model, where, update }) {
				const resolvedModel = getModelName(model);

				const existing = await this.findOne<ElectroItem>({ model, where });
				if (!existing || !("id" in existing)) return null;

				const now = new Date().toISOString();
				const updatedItem: ElectroItem = { ...existing, ...(update as ElectroItem), updatedAt: now };

				if ((resolvedModel === "verification" || resolvedModel === "session") && updatedItem.expiresAt) {
					const ttl = computeTtl(updatedItem);
					if (ttl !== undefined) updatedItem.ttl = ttl;
				}

				await entityFor(resolvedModel).put(updatedItem).go();
				return updatedItem as ReturnType<typeof Object.assign>;
			},

			async updateMany({ model, where, update }) {
				const resolvedModel = getModelName(model);
				const items = await this.findMany<ElectroItem>({ model, where, limit: 1000 });
				const now = new Date().toISOString();

				for (const item of items) {
					const updatedItem: ElectroItem = { ...item, ...(update as ElectroItem), updatedAt: now };
					await entityFor(resolvedModel).put(updatedItem).go();
				}
				return items.length;
			},

			async delete({ model, where }) {
				const resolvedModel = getModelName(model);

				const idWhere = where.find((w) => w.field === "id");
				if (idWhere) {
					await entityFor(resolvedModel)
						.delete({ id: idWhere.value as string })
						.go();
					return;
				}

				// Token-based session delete (logout)
				if (resolvedModel === "session") {
					const tokenWhere = where.find((w) => w.field === "token");
					if (tokenWhere) {
						const { data: items } = await db()
							.session.query.byToken({ token: tokenWhere.value as string })
							.go({ limit: 1 });
						const session = items[0] as ElectroItem | undefined;
						if (session?.id) {
							await db()
								.session.delete({ id: session.id as string })
								.go();
						}
						return;
					}
				}

				const existing = await this.findOne<ElectroItem>({ model, where, select: ["id"] });
				if (existing?.id) {
					await entityFor(resolvedModel)
						.delete({ id: existing.id as string })
						.go();
				}
			},

			async deleteMany({ model, where }) {
				const resolvedModel = getModelName(model);
				const items = await this.findMany<ElectroItem>({ model, where, limit: 1000 });

				for (const item of items) {
					if (item.id) {
						await entityFor(resolvedModel)
							.delete({ id: item.id as string })
							.go();
					}
				}
				return items.length;
			},

			async count({ model, where }) {
				const resolvedModel = getModelName(model);
				const entity = entityFor(resolvedModel);

				if (!where || where.length === 0) {
					const { data } = await entity.scan.go({ pages: "all" });
					return data.length;
				}

				const items = await this.findMany<ElectroItem>({ model, where, limit: 10000 });
				return items.length;
			},
		};
	},
});
