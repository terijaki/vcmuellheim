/* tslint:disable */
/* eslint-disable */
/**
 * This file was automatically generated by Payload.
 * DO NOT MODIFY IT BY HAND. Instead, modify your source Payload config,
 * and re-run `payload generate:types` to regenerate this file.
 */

/**
 * Supported timezones in IANA format.
 *
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "supportedTimezones".
 */
export type SupportedTimezones =
  | 'Pacific/Midway'
  | 'Pacific/Niue'
  | 'Pacific/Honolulu'
  | 'Pacific/Rarotonga'
  | 'America/Anchorage'
  | 'Pacific/Gambier'
  | 'America/Los_Angeles'
  | 'America/Tijuana'
  | 'America/Denver'
  | 'America/Phoenix'
  | 'America/Chicago'
  | 'America/Guatemala'
  | 'America/New_York'
  | 'America/Bogota'
  | 'America/Caracas'
  | 'America/Santiago'
  | 'America/Buenos_Aires'
  | 'America/Sao_Paulo'
  | 'Atlantic/South_Georgia'
  | 'Atlantic/Azores'
  | 'Atlantic/Cape_Verde'
  | 'Europe/London'
  | 'Europe/Berlin'
  | 'Africa/Lagos'
  | 'Europe/Athens'
  | 'Africa/Cairo'
  | 'Europe/Moscow'
  | 'Asia/Riyadh'
  | 'Asia/Dubai'
  | 'Asia/Baku'
  | 'Asia/Karachi'
  | 'Asia/Tashkent'
  | 'Asia/Calcutta'
  | 'Asia/Dhaka'
  | 'Asia/Almaty'
  | 'Asia/Jakarta'
  | 'Asia/Bangkok'
  | 'Asia/Shanghai'
  | 'Asia/Singapore'
  | 'Asia/Tokyo'
  | 'Asia/Seoul'
  | 'Australia/Brisbane'
  | 'Australia/Sydney'
  | 'Pacific/Guam'
  | 'Pacific/Noumea'
  | 'Pacific/Auckland'
  | 'Pacific/Fiji';

export interface Config {
  auth: {
    users: UserAuthOperations;
  };
  blocks: {};
  collections: {
    users: User;
    media: Media;
    events: Event;
    news: News;
    roles: Role;
    members: Member;
    teams: Team;
    locations: Location;
    sponsors: Sponsor;
    'sams-teams': SamsTeam;
    'sams-clubs': SamsClub;
    'bus-bookings': BusBooking;
    'payload-locked-documents': PayloadLockedDocument;
    'payload-preferences': PayloadPreference;
    'payload-migrations': PayloadMigration;
  };
  collectionsJoins: {
    media: {
      news: 'news';
      members: 'members';
      events: 'events';
      sponsors: 'sponsors';
    };
  };
  collectionsSelect: {
    users: UsersSelect<false> | UsersSelect<true>;
    media: MediaSelect<false> | MediaSelect<true>;
    events: EventsSelect<false> | EventsSelect<true>;
    news: NewsSelect<false> | NewsSelect<true>;
    roles: RolesSelect<false> | RolesSelect<true>;
    members: MembersSelect<false> | MembersSelect<true>;
    teams: TeamsSelect<false> | TeamsSelect<true>;
    locations: LocationsSelect<false> | LocationsSelect<true>;
    sponsors: SponsorsSelect<false> | SponsorsSelect<true>;
    'sams-teams': SamsTeamsSelect<false> | SamsTeamsSelect<true>;
    'sams-clubs': SamsClubsSelect<false> | SamsClubsSelect<true>;
    'bus-bookings': BusBookingsSelect<false> | BusBookingsSelect<true>;
    'payload-locked-documents': PayloadLockedDocumentsSelect<false> | PayloadLockedDocumentsSelect<true>;
    'payload-preferences': PayloadPreferencesSelect<false> | PayloadPreferencesSelect<true>;
    'payload-migrations': PayloadMigrationsSelect<false> | PayloadMigrationsSelect<true>;
  };
  db: {
    defaultIDType: string;
  };
  globals: {};
  globalsSelect: {};
  locale: null;
  user: User & {
    collection: 'users';
  };
  jobs: {
    tasks: unknown;
    workflows: unknown;
  };
}
export interface UserAuthOperations {
  forgotPassword: {
    email: string;
    password: string;
  };
  login: {
    email: string;
    password: string;
  };
  registerFirstUser: {
    email: string;
    password: string;
  };
  unlock: {
    email: string;
    password: string;
  };
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "users".
 */
export interface User {
  id: string;
  name?: string | null;
  /**
   * Administratoren haben Zugriff auf alle Inhalte und Einstellungen.
   * Moderatoren können Inhalte erstellen und bearbeiten, aber keine Einstellungen oder neue Benutzer erstellen ändern.
   * Funktionäre können Inhalte erstellen und die eigenen Inhalte bearbeiten.
   */
  role: 'admin' | 'moderator' | 'official' | 'none';
  updatedAt: string;
  createdAt: string;
  email: string;
  resetPasswordToken?: string | null;
  resetPasswordExpiration?: string | null;
  salt?: string | null;
  hash?: string | null;
  loginAttempts?: number | null;
  lockUntil?: string | null;
  password?: string | null;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "media".
 */
export interface Media {
  id: string;
  /**
   * Alternativtext (für Screenreader, etc.)
   */
  alt?: string | null;
  news?: {
    docs?: (string | News)[];
    hasNextPage?: boolean;
    totalDocs?: number;
  };
  members?: {
    docs?: (string | Member)[];
    hasNextPage?: boolean;
    totalDocs?: number;
  };
  events?: {
    docs?: (string | Event)[];
    hasNextPage?: boolean;
    totalDocs?: number;
  };
  sponsors?: {
    docs?: (string | Sponsor)[];
    hasNextPage?: boolean;
    totalDocs?: number;
  };
  updatedAt: string;
  createdAt: string;
  url?: string | null;
  thumbnailURL?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  filesize?: number | null;
  width?: number | null;
  height?: number | null;
  focalX?: number | null;
  focalY?: number | null;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "news".
 */
export interface News {
  id: string;
  title: string;
  content: {
    root: {
      type: string;
      children: {
        type: string;
        version: number;
        [k: string]: unknown;
      }[];
      direction: ('ltr' | 'rtl') | null;
      format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
      indent: number;
      version: number;
    };
    [k: string]: unknown;
  };
  publishedDate: string;
  authors?: (string | User)[] | null;
  images?: (string | Media)[] | null;
  /**
   * Automatisch generiert vom Inhalt
   */
  excerpt?: string | null;
  updatedAt: string;
  createdAt: string;
  _status?: ('draft' | 'published') | null;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "members".
 */
export interface Member {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  roles?: (string | Role)[] | null;
  avatar?: (string | null) | Media;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "roles".
 */
export interface Role {
  id: string;
  name: string;
  vorstand: boolean;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "events".
 */
export interface Event {
  id: string;
  title: string;
  description?: {
    root: {
      type: string;
      children: {
        type: string;
        version: number;
        [k: string]: unknown;
      }[];
      direction: ('ltr' | 'rtl') | null;
      format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
      indent: number;
      version: number;
    };
    [k: string]: unknown;
  } | null;
  date: {
    startDate: string;
    endDate?: string | null;
  };
  address?: {
    name?: string | null;
    street?: string | null;
    postalCode?: number | null;
    city?: string | null;
  };
  images?: (string | Media)[] | null;
  authors?: (string | User)[] | null;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "sponsors".
 */
export interface Sponsor {
  id: string;
  name: string;
  website?: string | null;
  logo?: (string | null) | Media;
  /**
   * Nach Ablauf wird der Sponsor nicht mehr angezeigt.
   */
  expiryDate?: string | null;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "teams".
 */
export interface Team {
  id: string;
  name: string;
  gender: 'men' | 'woman' | 'mixed';
  age?: number | null;
  /**
   * Automatisch generiert vom Namen
   */
  slug?: string | null;
  /**
   * Für Mannschaften die nicht am Ligabetrieb teilnehmen, lasse das Feld frei.
   */
  league?:
    | (
        | '1. Bundesliga'
        | '2. Bundesliga'
        | 'Dritte Liga'
        | 'Regionalliga'
        | 'Oberliga'
        | 'Verbandsliga'
        | 'Landesliga'
        | 'Bezirksliga'
        | 'Bezirksklasse'
        | 'Kreisliga'
        | 'Kreisklasse'
      )
    | null;
  /**
   * Verknüpfung zu einem Team im SBVV-System. Wird für den Spielplan und die Ergebnisse benötigt.
   */
  sbvvTeam?: (string | null) | SamsTeam;
  description?: string | null;
  people?: {
    /**
     * Alle Trainer werden auf der Mannschaftskarte angezeigt; auch Co-Trainer.
     */
    coaches?: (string | Member)[] | null;
    /**
     * Kontaktpersonen zusätzlich oder alternativ zu den Trainern. Diese werden auf der Mannschaftskarte angezeigt.
     */
    contactPeople?: (string | Member)[] | null;
  };
  schedules?:
    | {
        day: ('montags' | 'dienstags' | 'mittwochs' | 'donnerstags' | 'freitags' | 'samstags' | 'sonntags')[];
        time: {
          startTime: string;
          endTime: string;
        };
        location: string | Location;
        id?: string | null;
      }[]
    | null;
  images?: (string | Media)[] | null;
  /**
   * Instagram-Handle der Mannschaft, ohne @-Zeichen (e.g. "tagesschau"). Wird auf der Mannschaftskarte angezeigt und Beiträge der letzten 30 Tage werden automatisch eingebunden. Die Synchronisierung kann bis zu 24 Stunden dauern.
   */
  instagram?: string | null;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "sams-teams".
 */
export interface SamsTeam {
  id: string;
  nameWithSeries?: string | null;
  name: string;
  uuid: string;
  associationUuid?: string | null;
  sportsclubUuid?: string | null;
  leagueUuid?: string | null;
  leagueName?: string | null;
  seasonUuid?: string | null;
  seasonName?: string | null;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "locations".
 */
export interface Location {
  id: string;
  name: string;
  description?: string | null;
  address?: {
    street?: string | null;
    postalCode?: number | null;
    city?: string | null;
  };
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "sams-clubs".
 */
export interface SamsClub {
  id: string;
  name: string;
  sportsclubUuid: string;
  logo?: string | null;
  associationUuid?: string | null;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "bus-bookings".
 */
export interface BusBooking {
  id: string;
  traveler?: string | null;
  comment?: string | null;
  schedule: {
    start: string;
    end: string;
  };
  booker: string | User;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-locked-documents".
 */
export interface PayloadLockedDocument {
  id: string;
  document?:
    | ({
        relationTo: 'users';
        value: string | User;
      } | null)
    | ({
        relationTo: 'media';
        value: string | Media;
      } | null)
    | ({
        relationTo: 'events';
        value: string | Event;
      } | null)
    | ({
        relationTo: 'news';
        value: string | News;
      } | null)
    | ({
        relationTo: 'roles';
        value: string | Role;
      } | null)
    | ({
        relationTo: 'members';
        value: string | Member;
      } | null)
    | ({
        relationTo: 'teams';
        value: string | Team;
      } | null)
    | ({
        relationTo: 'locations';
        value: string | Location;
      } | null)
    | ({
        relationTo: 'sponsors';
        value: string | Sponsor;
      } | null)
    | ({
        relationTo: 'sams-teams';
        value: string | SamsTeam;
      } | null)
    | ({
        relationTo: 'sams-clubs';
        value: string | SamsClub;
      } | null)
    | ({
        relationTo: 'bus-bookings';
        value: string | BusBooking;
      } | null);
  globalSlug?: string | null;
  user: {
    relationTo: 'users';
    value: string | User;
  };
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-preferences".
 */
export interface PayloadPreference {
  id: string;
  user: {
    relationTo: 'users';
    value: string | User;
  };
  key?: string | null;
  value?:
    | {
        [k: string]: unknown;
      }
    | unknown[]
    | string
    | number
    | boolean
    | null;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-migrations".
 */
export interface PayloadMigration {
  id: string;
  name?: string | null;
  batch?: number | null;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "users_select".
 */
export interface UsersSelect<T extends boolean = true> {
  name?: T;
  role?: T;
  updatedAt?: T;
  createdAt?: T;
  email?: T;
  resetPasswordToken?: T;
  resetPasswordExpiration?: T;
  salt?: T;
  hash?: T;
  loginAttempts?: T;
  lockUntil?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "media_select".
 */
export interface MediaSelect<T extends boolean = true> {
  alt?: T;
  news?: T;
  members?: T;
  events?: T;
  sponsors?: T;
  updatedAt?: T;
  createdAt?: T;
  url?: T;
  thumbnailURL?: T;
  filename?: T;
  mimeType?: T;
  filesize?: T;
  width?: T;
  height?: T;
  focalX?: T;
  focalY?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "events_select".
 */
export interface EventsSelect<T extends boolean = true> {
  title?: T;
  description?: T;
  date?:
    | T
    | {
        startDate?: T;
        endDate?: T;
      };
  address?:
    | T
    | {
        name?: T;
        street?: T;
        postalCode?: T;
        city?: T;
      };
  images?: T;
  authors?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "news_select".
 */
export interface NewsSelect<T extends boolean = true> {
  title?: T;
  content?: T;
  publishedDate?: T;
  authors?: T;
  images?: T;
  excerpt?: T;
  updatedAt?: T;
  createdAt?: T;
  _status?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "roles_select".
 */
export interface RolesSelect<T extends boolean = true> {
  name?: T;
  vorstand?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "members_select".
 */
export interface MembersSelect<T extends boolean = true> {
  name?: T;
  email?: T;
  phone?: T;
  roles?: T;
  avatar?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "teams_select".
 */
export interface TeamsSelect<T extends boolean = true> {
  name?: T;
  gender?: T;
  age?: T;
  slug?: T;
  league?: T;
  sbvvTeam?: T;
  description?: T;
  people?:
    | T
    | {
        coaches?: T;
        contactPeople?: T;
      };
  schedules?:
    | T
    | {
        day?: T;
        time?:
          | T
          | {
              startTime?: T;
              endTime?: T;
            };
        location?: T;
        id?: T;
      };
  images?: T;
  instagram?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "locations_select".
 */
export interface LocationsSelect<T extends boolean = true> {
  name?: T;
  description?: T;
  address?:
    | T
    | {
        street?: T;
        postalCode?: T;
        city?: T;
      };
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "sponsors_select".
 */
export interface SponsorsSelect<T extends boolean = true> {
  name?: T;
  website?: T;
  logo?: T;
  expiryDate?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "sams-teams_select".
 */
export interface SamsTeamsSelect<T extends boolean = true> {
  nameWithSeries?: T;
  name?: T;
  uuid?: T;
  associationUuid?: T;
  sportsclubUuid?: T;
  leagueUuid?: T;
  leagueName?: T;
  seasonUuid?: T;
  seasonName?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "sams-clubs_select".
 */
export interface SamsClubsSelect<T extends boolean = true> {
  name?: T;
  sportsclubUuid?: T;
  logo?: T;
  associationUuid?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "bus-bookings_select".
 */
export interface BusBookingsSelect<T extends boolean = true> {
  traveler?: T;
  comment?: T;
  schedule?:
    | T
    | {
        start?: T;
        end?: T;
      };
  booker?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-locked-documents_select".
 */
export interface PayloadLockedDocumentsSelect<T extends boolean = true> {
  document?: T;
  globalSlug?: T;
  user?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-preferences_select".
 */
export interface PayloadPreferencesSelect<T extends boolean = true> {
  user?: T;
  key?: T;
  value?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "payload-migrations_select".
 */
export interface PayloadMigrationsSelect<T extends boolean = true> {
  name?: T;
  batch?: T;
  updatedAt?: T;
  createdAt?: T;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "auth".
 */
export interface Auth {
  [k: string]: unknown;
}


declare module 'payload' {
  export interface GeneratedTypes extends Config {}
}