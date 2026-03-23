type CacheKeyPrimitive = string | number | boolean | null | undefined;
export type CacheKeyValue = CacheKeyPrimitive | readonly CacheKeyPrimitive[];

export type ExpiringCacheEntry<TValue> = {
	value: TValue;
	expiresAt: number;
};

export function createExpiringCache<TValue>() {
	return new Map<string, ExpiringCacheEntry<TValue>>();
}

function normalizeCacheKeyPrimitive(value: CacheKeyPrimitive): string | number | boolean {
	return value ?? "";
}

function isCacheKeyArray(value: CacheKeyValue): value is readonly CacheKeyPrimitive[] {
	return Array.isArray(value);
}

function normalizeCacheKeyValue(value: CacheKeyValue): string | number | boolean | Array<string | number | boolean> {
	if (isCacheKeyArray(value)) {
		return [...new Set(value.map(normalizeCacheKeyPrimitive))].sort((left, right) => String(left).localeCompare(String(right)));
	}

	return normalizeCacheKeyPrimitive(value);
}

export function createCacheKey(input: Record<string, CacheKeyValue>): string {
	const normalizedEntries = Object.entries(input)
		.sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
		.map(([key, value]) => [key, normalizeCacheKeyValue(value)] as const);

	return JSON.stringify(Object.fromEntries(normalizedEntries));
}

export async function getOrSetExpiringCacheValue<TValue>({
	cache,
	keyParts,
	ttlMs,
	load,
	now = Date.now,
}: {
	cache: Map<string, ExpiringCacheEntry<TValue>>;
	keyParts: Record<string, CacheKeyValue>;
	ttlMs: number;
	load: () => Promise<TValue>;
	now?: () => number;
}): Promise<TValue> {
	const cacheKey = createCacheKey(keyParts);
	const currentTime = now();
	const cached = cache.get(cacheKey);

	if (cached && cached.expiresAt > currentTime) {
		return cached.value;
	}

	const value = await load();
	cache.set(cacheKey, {
		value,
		expiresAt: currentTime + ttlMs,
	});

	return value;
}
