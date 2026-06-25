import { beforeEach, expect, it, vi } from "vite-plus/test";

const { putItemsMock } = vi.hoisted(() => ({
  putItemsMock: vi.fn(),
}));

vi.mock("./common", () => ({
  putItems: putItemsMock,
}));

import { seedVolunteerEventsData } from "./volunteer-events";
import type { SeedContext } from "./common";

beforeEach(() => {
  putItemsMock.mockReset();
  putItemsMock.mockResolvedValue(undefined);
});

it("creates multiple open-house signups with explicit role assignments or preferences", async () => {
  const ctx = {
    entities: {
      volunteerEvent: {
        create: vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue(undefined) }),
      },
      volunteerSignup: {
        create: vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue(undefined) }),
      },
    },
  } as unknown as SeedContext;

  await seedVolunteerEventsData(ctx);

  const eventItems = putItemsMock.mock.calls[0][1] as Array<{
    id: string;
    title: string;
    shifts?: Array<{ label: string }>;
  }>;
  const signupItems = putItemsMock.mock.calls[1][1] as Array<{
    eventId: string;
    status: string;
    assignedRoleId?: string;
    preferredRoleIds: string[];
  }>;

  const springCleanEvent = eventItems.find(
    (event) => event.title === "Frühjahrsputz im Vereinsheim",
  );

  expect(springCleanEvent).toBeDefined();
  expect(springCleanEvent?.shifts).toHaveLength(3);
  expect(
    springCleanEvent?.shifts?.filter((shift) => shift.label === "Aufräumen und Staub wischen"),
  ).toHaveLength(2);

  const springCleanSignups = signupItems.filter(
    (signup) => signup.eventId === springCleanEvent?.id,
  );
  expect(springCleanSignups).toHaveLength(4);
  expect(
    springCleanSignups.some((signup) => signup.status === "confirmed" && signup.assignedRoleId),
  ).toBe(true);

  const openHouseEvent = eventItems.find(
    (event) => event.title === "Tag der offenen Tür für neue Mitglieder",
  );

  expect(openHouseEvent).toBeDefined();

  const openHouseSignups = signupItems.filter((signup) => signup.eventId === openHouseEvent?.id);

  expect(openHouseSignups).toHaveLength(5);
  expect(
    openHouseSignups.filter((signup) => signup.status === "confirmed" && signup.assignedRoleId),
  ).toHaveLength(3);
  expect(
    openHouseSignups.some(
      (signup) => signup.status === "pending" && signup.preferredRoleIds.length > 0,
    ),
  ).toBe(true);
});
