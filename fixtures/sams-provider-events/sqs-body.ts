import type { SamsProviderFixture } from "./build-seed-fixtures";

const DEFAULT_OCCURRED_AT = "2026-08-27T12:00:00.000Z";

export function buildMockSamsProviderSqsBody(
  fixture: SamsProviderFixture,
  eventId = "550e8400-e29b-41d4-a716-446655440000",
  occurredAt = DEFAULT_OCCURRED_AT,
): string {
  return JSON.stringify({
    detail: {
      schemaVersion: "1.0.0",
      eventId,
      occurredAt,
      source: "sams-provider",
      type: fixture.type,
      sourceSyncId: "seed-mock-events",
      snapshotVersion: fixture.snapshotVersion,
      payload: fixture.payload,
    },
  });
}
