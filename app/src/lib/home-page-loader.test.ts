import { describe, expect, it, vi } from "vite-plus/test";
import { resolveHomePageLoader, type HomePageSnapshot } from "./home-page-loader";

describe("resolveHomePageLoader", () => {
  it("returns a fresh cache hit without calling load", async () => {
    const load = vi.fn(async () => "fresh");
    const cache: HomePageSnapshot<string> = { value: "cached", storedAt: 1_000 };

    const result = await resolveHomePageLoader({
      load,
      cache,
      now: 1_500,
      wait: async () => {},
      store: () => {},
      ttlMs: 30_000,
    });

    expect(result).toEqual({ ready: true, data: "cached" });
    expect(load).not.toHaveBeenCalled();
  });

  it("returns stale data immediately and refreshes in the background", async () => {
    let stored: HomePageSnapshot<string> | null = null;
    let release: (value: string) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    const result = await resolveHomePageLoader({
      load,
      cache: { value: "stale", storedAt: 0 },
      now: 60_000,
      wait: async () => {},
      store: (snapshot) => {
        stored = snapshot;
      },
      ttlMs: 30_000,
    });

    expect(result).toEqual({ ready: true, data: "stale" });
    release("next");
    await vi.waitFor(() => {
      expect(stored?.value).toBe("next");
    });
  });

  it("does not block a cold read past the budget", async () => {
    let release: (value: string) => void = () => {};
    const load = () =>
      new Promise<string>((resolve) => {
        release = resolve;
      });
    let stored: HomePageSnapshot<string> | null = null;

    const result = await resolveHomePageLoader({
      load,
      cache: null,
      now: 0,
      wait: async () => {},
      store: (snapshot) => {
        stored = snapshot;
      },
      budgetMs: 200,
    });

    expect(result).toEqual({ ready: false });
    release("later");
    await vi.waitFor(() => {
      expect(stored?.value).toBe("later");
    });
  });

  it("returns cold data that arrives inside the budget", async () => {
    const result = await resolveHomePageLoader({
      load: async () => "fast",
      cache: null,
      now: 0,
      wait: () => new Promise(() => {}),
      store: () => {},
      budgetMs: 200,
    });

    expect(result).toEqual({ ready: true, data: "fast" });
  });
});
