import { describe, expect, it } from "vite-plus/test";
import { captionLineClamp } from "./InstagramCard";

describe("captionLineClamp", () => {
  it("reserves fewer caption lines when hashtags are shown", () => {
    expect(captionLineClamp(0)).toBeGreaterThan(captionLineClamp(3));
  });
});
