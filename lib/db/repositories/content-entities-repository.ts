import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import {
  apiKeyItemFromDomain,
  apiKeyMainKeys,
  busItemFromDomain,
  busMainKeys,
  eventItemFromDomain,
  eventMainKeys,
  locationItemFromDomain,
  locationMainKeys,
  mediaItemFromDomain,
  mediaMainKeys,
  publicSnapshotItemFromDomain,
  publicSnapshotKeys,
  sponsorItemFromDomain,
  sponsorMainKeys,
  volunteerEventItemFromDomain,
  volunteerEventMainKeys,
  volunteerSignupCollectionItemFromDomain,
  volunteerSignupCollectionKeys,
  volunteerSignupIdLookupFromDomain,
  volunteerSignupIdLookupKeys,
  volunteerTokenItemFromDomain,
  volunteerTokenMainKeys,
} from "@/lib/db/content-keys";
import { getContentTableName } from "@/lib/db/env";
import {
  apiKeySchema,
  busSchema,
  eventSchema,
  locationSchema,
  mediaSchema,
  publicSnapshotSchema,
  sponsorSchema,
  volunteerEventSchema,
  volunteerSignupSchema,
  volunteerTokenSchema,
  type PublicSnapshotSection,
} from "@/lib/db/schemas";
import type {
  ApiKey,
  Bus,
  Event,
  Location,
  Media,
  Sponsor,
  VolunteerEvent,
  VolunteerSignup,
  VolunteerToken,
} from "@/lib/db/types";
import {
  deleteItem,
  getItem,
  parseDomain,
  putItem,
  queryGsi1,
  queryTablePk,
} from "@/lib/db/repositories/dynamo-helpers";

export class EventRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table() {
    return this.tableName ?? getContentTableName();
  }

  async getById(id: string): Promise<Event | null> {
    const item = await getItem(this.documentClient, this.table(), eventMainKeys(id));
    return item ? parseDomain(eventSchema, item, "Failed to parse event") : null;
  }

  async listAll(): Promise<Event[]> {
    const page = await queryGsi1(this.documentClient, this.table(), {
      gsi1pk: "event",
      scanIndexForward: true,
    });
    return page.items.map((item) => parseDomain(eventSchema, item, "Failed to parse event"));
  }

  async create(event: Event): Promise<Event> {
    const parsed = eventSchema.parse(event);
    await putItem(this.documentClient, this.table(), eventItemFromDomain(parsed));
    return parsed;
  }

  async update(id: string, updates: Partial<Event>): Promise<Event | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const merged = eventSchema.parse({ ...existing, ...updates, id });
    await putItem(this.documentClient, this.table(), eventItemFromDomain(merged));
    return merged;
  }

  async delete(id: string): Promise<void> {
    await deleteItem(this.documentClient, this.table(), eventMainKeys(id));
  }

  async listFromStartDate(startDate: string): Promise<Event[]> {
    const all = await this.listAll();
    return all.filter((event) => event.startDate >= startDate);
  }
}

export class BusRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table() {
    return this.tableName ?? getContentTableName();
  }

  async listAll(): Promise<Bus[]> {
    const page = await queryGsi1(this.documentClient, this.table(), { gsi1pk: "bus" });
    return page.items.map((item) => parseDomain(busSchema, item, "Failed to parse bus"));
  }

  async getById(id: string): Promise<Bus | null> {
    const item = await getItem(this.documentClient, this.table(), busMainKeys(id));
    return item ? parseDomain(busSchema, item, "Failed to parse bus") : null;
  }

  async create(bus: Bus): Promise<Bus> {
    const parsed = busSchema.parse(bus);
    await putItem(this.documentClient, this.table(), busItemFromDomain(parsed));
    return parsed;
  }

  async update(id: string, updates: Partial<Bus>): Promise<Bus | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const merged = busSchema.parse({ ...existing, ...updates, id });
    await putItem(this.documentClient, this.table(), busItemFromDomain(merged));
    return merged;
  }

  async delete(id: string): Promise<void> {
    await deleteItem(this.documentClient, this.table(), busMainKeys(id));
  }
}

export class LocationRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table() {
    return this.tableName ?? getContentTableName();
  }

  async listAll(): Promise<Location[]> {
    const page = await queryGsi1(this.documentClient, this.table(), { gsi1pk: "location" });
    return page.items.map((item) => parseDomain(locationSchema, item, "Failed to parse location"));
  }

  async create(location: Location): Promise<Location> {
    const parsed = locationSchema.parse(location);
    await putItem(this.documentClient, this.table(), locationItemFromDomain(parsed));
    return parsed;
  }

  async update(id: string, updates: Partial<Location>): Promise<Location | null> {
    const existing = await getItem(this.documentClient, this.table(), locationMainKeys(id));
    if (!existing) return null;
    const merged = locationSchema.parse({
      ...parseDomain(locationSchema, existing, "parse"),
      ...updates,
      id,
    });
    await putItem(this.documentClient, this.table(), locationItemFromDomain(merged));
    return merged;
  }

  async delete(id: string): Promise<void> {
    await deleteItem(this.documentClient, this.table(), locationMainKeys(id));
  }
}

export class SponsorRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table() {
    return this.tableName ?? getContentTableName();
  }

  async getById(id: string): Promise<Sponsor | null> {
    const item = await getItem(this.documentClient, this.table(), sponsorMainKeys(id));
    return item ? parseDomain(sponsorSchema, item, "Failed to parse sponsor") : null;
  }

  async listAll(): Promise<Sponsor[]> {
    const page = await queryGsi1(this.documentClient, this.table(), { gsi1pk: "sponsor" });
    return page.items.map((item) => parseDomain(sponsorSchema, item, "Failed to parse sponsor"));
  }

  async create(sponsor: Sponsor): Promise<Sponsor> {
    const parsed = sponsorSchema.parse(sponsor);
    await putItem(this.documentClient, this.table(), sponsorItemFromDomain(parsed));
    return parsed;
  }

  async update(id: string, updates: Partial<Sponsor>): Promise<Sponsor | null> {
    const item = await getItem(this.documentClient, this.table(), sponsorMainKeys(id));
    if (!item) return null;
    const merged = sponsorSchema.parse({
      ...parseDomain(sponsorSchema, item, "parse"),
      ...updates,
      id,
    });
    await putItem(this.documentClient, this.table(), sponsorItemFromDomain(merged));
    return merged;
  }

  async delete(id: string): Promise<void> {
    await deleteItem(this.documentClient, this.table(), sponsorMainKeys(id));
  }
}

export class VolunteerEventRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table() {
    return this.tableName ?? getContentTableName();
  }

  async getById(id: string): Promise<VolunteerEvent | null> {
    const item = await getItem(this.documentClient, this.table(), volunteerEventMainKeys(id));
    return item ? parseDomain(volunteerEventSchema, item, "Failed to parse volunteer event") : null;
  }

  async listAll(): Promise<VolunteerEvent[]> {
    const page = await queryGsi1(this.documentClient, this.table(), {
      gsi1pk: "volunteerEvent",
      scanIndexForward: false,
    });
    return page.items.map((item) =>
      parseDomain(volunteerEventSchema, item, "Failed to parse volunteer event"),
    );
  }

  async create(event: VolunteerEvent): Promise<VolunteerEvent> {
    const parsed = volunteerEventSchema.parse(event);
    await putItem(this.documentClient, this.table(), volunteerEventItemFromDomain(parsed));
    return parsed;
  }

  async update(id: string, updates: Partial<VolunteerEvent>): Promise<VolunteerEvent | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const merged = volunteerEventSchema.parse({ ...existing, ...updates, id });
    await putItem(this.documentClient, this.table(), volunteerEventItemFromDomain(merged));
    return merged;
  }

  async delete(id: string): Promise<void> {
    await deleteItem(this.documentClient, this.table(), volunteerEventMainKeys(id));
  }
}

export class VolunteerSignupRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table() {
    return this.tableName ?? getContentTableName();
  }

  async getById(id: string): Promise<VolunteerSignup | null> {
    const lookup = await getItem(
      this.documentClient,
      this.table(),
      volunteerSignupIdLookupKeys(id),
    );
    if (!lookup || typeof lookup.eventId !== "string" || typeof lookup.shiftId !== "string") {
      return null;
    }
    const item = await getItem(
      this.documentClient,
      this.table(),
      volunteerSignupCollectionKeys(lookup.eventId, lookup.shiftId, id),
    );
    return item ? parseDomain(volunteerSignupSchema, item, "Failed to parse signup") : null;
  }

  async listByEvent(eventId: string): Promise<VolunteerSignup[]> {
    const page = await queryTablePk(this.documentClient, this.table(), {
      pk: `volunteerSignup#${eventId}`,
    });
    return page.items.map((item) =>
      parseDomain(volunteerSignupSchema, item, "Failed to parse signup"),
    );
  }

  async create(signup: VolunteerSignup): Promise<VolunteerSignup> {
    const parsed = volunteerSignupSchema.parse(signup);
    const table = this.table();
    await putItem(this.documentClient, table, volunteerSignupCollectionItemFromDomain(parsed));
    await putItem(this.documentClient, table, volunteerSignupIdLookupFromDomain(parsed));
    return parsed;
  }

  async save(signup: VolunteerSignup, previous?: VolunteerSignup): Promise<VolunteerSignup> {
    const parsed = volunteerSignupSchema.parse(signup);
    const table = this.table();
    if (previous && (previous.eventId !== parsed.eventId || previous.shiftId !== parsed.shiftId)) {
      await deleteItem(
        this.documentClient,
        table,
        volunteerSignupCollectionKeys(previous.eventId, previous.shiftId, parsed.id),
      );
    }
    await putItem(this.documentClient, table, volunteerSignupCollectionItemFromDomain(parsed));
    await putItem(this.documentClient, table, volunteerSignupIdLookupFromDomain(parsed));
    return parsed;
  }

  async update(
    id: string,
    setFields: Record<string, unknown>,
    removeFields: string[] = [],
  ): Promise<VolunteerSignup | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const merged = volunteerSignupSchema.parse({
      ...existing,
      ...setFields,
    }) as VolunteerSignup;
    for (const key of removeFields) {
      delete (merged as Record<string, unknown>)[key];
    }
    return this.save(merged, existing);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;
    const table = this.table();
    await deleteItem(
      this.documentClient,
      table,
      volunteerSignupCollectionKeys(existing.eventId, existing.shiftId, id),
    );
    await deleteItem(this.documentClient, table, volunteerSignupIdLookupKeys(id));
  }
}

export class VolunteerTokenRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table() {
    return this.tableName ?? getContentTableName();
  }

  async getById(id: string): Promise<VolunteerToken | null> {
    const item = await getItem(this.documentClient, this.table(), volunteerTokenMainKeys(id));
    return item ? parseDomain(volunteerTokenSchema, item, "Failed to parse token") : null;
  }

  async create(token: VolunteerToken): Promise<VolunteerToken> {
    const parsed = volunteerTokenSchema.parse(token);
    await putItem(this.documentClient, this.table(), volunteerTokenItemFromDomain(parsed));
    return parsed;
  }

  async delete(id: string): Promise<void> {
    await deleteItem(this.documentClient, this.table(), volunteerTokenMainKeys(id));
  }
}

export class ApiKeyRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table() {
    return this.tableName ?? getContentTableName();
  }

  async getById(id: string): Promise<ApiKey | null> {
    const item = await getItem(this.documentClient, this.table(), apiKeyMainKeys(id));
    return item ? parseDomain(apiKeySchema, item, "Failed to parse api key") : null;
  }

  async listAll(): Promise<ApiKey[]> {
    const page = await queryGsi1(this.documentClient, this.table(), {
      gsi1pk: "apiKey",
      scanIndexForward: false,
    });
    return page.items.map((item) => parseDomain(apiKeySchema, item, "Failed to parse api key"));
  }

  async create(record: ApiKey): Promise<ApiKey> {
    const parsed = apiKeySchema.parse(record);
    await putItem(this.documentClient, this.table(), apiKeyItemFromDomain(parsed));
    return parsed;
  }

  async patch(id: string, updates: Partial<ApiKey>): Promise<ApiKey | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const merged = apiKeySchema.parse({ ...existing, ...updates, id });
    await putItem(this.documentClient, this.table(), apiKeyItemFromDomain(merged));
    return merged;
  }

  async delete(id: string): Promise<void> {
    await deleteItem(this.documentClient, this.table(), apiKeyMainKeys(id));
  }
}

export class PublicSnapshotRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table() {
    return this.tableName ?? getContentTableName();
  }

  async get(section: PublicSnapshotSection): Promise<Record<string, unknown> | null> {
    const item = await getItem(this.documentClient, this.table(), publicSnapshotKeys(section));
    return item;
  }

  async put(section: PublicSnapshotSection, payload: unknown): Promise<void> {
    const item = publicSnapshotSchema.parse({
      section,
      type: "publicSnapshot",
      payload,
      updatedAt: new Date().toISOString(),
    });
    await putItem(this.documentClient, this.table(), publicSnapshotItemFromDomain(item));
  }
}

export class MediaRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table() {
    return this.tableName ?? getContentTableName();
  }

  async getById(id: string): Promise<Media | null> {
    const item = await getItem(this.documentClient, this.table(), mediaMainKeys(id));
    return item ? parseDomain(mediaSchema, item, "Failed to parse media") : null;
  }

  async create(media: Media): Promise<Media> {
    const parsed = mediaSchema.parse(media);
    await putItem(this.documentClient, this.table(), mediaItemFromDomain(parsed));
    return parsed;
  }
}

export const eventRepository = new EventRepository();
export const busRepository = new BusRepository();
export const locationRepository = new LocationRepository();
export const sponsorRepository = new SponsorRepository();
export const volunteerEventRepository = new VolunteerEventRepository();
export const volunteerSignupRepository = new VolunteerSignupRepository();
export const volunteerTokenRepository = new VolunteerTokenRepository();
export const apiKeyRepository = new ApiKeyRepository();
export const publicSnapshotRepository = new PublicSnapshotRepository();
export const mediaRepository = new MediaRepository();
