/**
 * ElectroDB-compatible DynamoDB key bytes for the `vcm` service.
 *
 * Stored keys use `$vcm#<attr>_<value>` partition segments and `$<entity>_1`
 * sort-key facets, with attribute names and string values lowercased in the
 * final key string. Multi-part sort keys append `#<attr>_<value>` segments.
 */

/** Service name embedded in partition keys (`$vcm#...`). */
export const ELECTRODB_SERVICE_NAME = "vcm";

/** Version suffix on entity sort-key facets (`$news_1`). */
export const ELECTRODB_ENTITY_VERSION = "1";

/** One composite segment in an ElectroDB partition or sort key. */
export type ElectroDbKeyCompositePart = {
  /** Entity attribute name (camelCase); lowercased in the key. */
  attribute: string;
  /** Raw stored value (before read-time getters such as email trim). */
  value: string;
};

/**
 * Build a service-scoped partition key (`pk`, `gsiNpk`).
 *
 * @example `$vcm#id_<uuid>`
 */
export function buildElectroDbServicePartitionKey(
  parts: readonly ElectroDbKeyCompositePart[],
): string {
  let key = `$${ELECTRODB_SERVICE_NAME}`;
  for (const part of parts) {
    key += `#${part.attribute.toLowerCase()}_${part.value}`;
  }
  return key.toLowerCase();
}

/**
 * Build an entity sort key (`sk`, `gsiNsk`).
 *
 * An empty `parts` array yields the entity facet alone (`$news_1`).
 *
 * @example `$news_1#updatedat_<iso>`
 */
export function buildElectroDbEntitySortKey(
  entityName: string,
  parts: readonly ElectroDbKeyCompositePart[],
): string {
  let key = `$${entityName.toLowerCase()}_${ELECTRODB_ENTITY_VERSION}`;
  for (const part of parts) {
    key += `#${part.attribute.toLowerCase()}_${part.value}`;
  }
  return key.toLowerCase();
}

/** `__edb_e__` / `__edb_v__` markers ElectroDB writes on items. */
export function buildElectroDbEntityMarkers(entityName: string): {
  __edb_e__: string;
  __edb_v__: string;
} {
  return {
    __edb_e__: entityName,
    __edb_v__: ELECTRODB_ENTITY_VERSION,
  };
}
