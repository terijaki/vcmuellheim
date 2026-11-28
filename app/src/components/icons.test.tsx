import { FaUser, FaVolleyball, type Fa6IconProps } from "@webapp/components/icons";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import * as Icons from "@webapp/components/icons";

const iconEntries = Object.entries(Icons).filter(
  (entry): entry is [string, (props: Fa6IconProps) => ReactElement] =>
    entry[0].startsWith("Fa") && typeof entry[1] === "function",
);

/** Locked FA6 geometry; first-path prefix catches accidental SVG edits. */
const ICON_FINGERPRINTS = {
  FaAnglesDown: {
    viewBox: "0 0 448 512",
    pathPrefix: "M246.6 470.6c-12.5 12.5-32.8 12.5-45.3 0",
  },
  FaArrowUpRightFromSquare: {
    viewBox: "0 0 512 512",
    pathPrefix: "M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 ",
  },
  FaBullhorn: {
    viewBox: "0 0 512 512",
    pathPrefix: "M480 32c0-12.9-7.8-24.6-19.8-29.6s-25.7-",
  },
  FaBus: {
    viewBox: "0 0 576 512",
    pathPrefix: "M288 0C422.4 0 512 35.2 512 80l0 16 0 32",
  },
  FaCalendarDays: {
    viewBox: "0 0 448 512",
    pathPrefix: "M128 0c17.7 0 32 14.3 32 32l0 32 128 0 0",
  },
  FaChevronDown: {
    viewBox: "0 0 512 512",
    pathPrefix: "M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l",
  },
  FaClock: {
    viewBox: "0 0 512 512",
    pathPrefix: "M256 0a256 256 0 1 1 0 512A256 256 0 1 1",
  },
  FaEnvelope: {
    viewBox: "0 0 512 512",
    pathPrefix: "M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 2",
  },
  FaFacebook: {
    viewBox: "0 0 512 512",
    pathPrefix: "M512 256C512 114.6 397.4 0 256 0S0 114.6",
  },
  FaFileExcel: {
    viewBox: "0 0 384 512",
    pathPrefix: "M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28",
  },
  FaFilePdf: {
    viewBox: "0 0 512 512",
    pathPrefix: "M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 1",
  },
  FaInstagram: {
    viewBox: "0 0 448 512",
    pathPrefix: "M224.1 141c-63.6 0-114.9 51.3-114.9 114.",
  },
  FaLocationDot: {
    viewBox: "0 0 384 512",
    pathPrefix: "M215.7 499.2C267 435 384 279.4 384 192C3",
  },
  FaMastodon: {
    viewBox: "0 0 448 512",
    pathPrefix: "M433 179.11c0-97.2-63.71-125.7-63.71-125",
  },
  FaSquarePollVertical: {
    viewBox: "0 0 448 512",
    pathPrefix: "M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 ",
  },
  FaUser: {
    viewBox: "0 0 448 512",
    pathPrefix: "M224 256A128 128 0 1 0 224 0a128 128 0 1",
  },
  FaUserGroup: {
    viewBox: "0 0 640 512",
    pathPrefix: "M96 128a128 128 0 1 1 256 0A128 128 0 1 ",
  },
  FaVolleyball: {
    viewBox: "0 0 512 512",
    pathPrefix: "M511.8 267.4c-26.1 8.7-53.4 13.8-81 15.1",
  },
} as const;

describe("Fa6 icons", () => {
  it.each(iconEntries)("%s renders an svg with a path", (_name, Icon) => {
    const markup = renderToStaticMarkup(createElement(Icon));
    expect(markup).toMatch(/^<svg/);
    expect(markup).toContain("<path");
    expect(markup).toContain('fill="currentColor"');
  });

  it.each(
    Object.entries(ICON_FINGERPRINTS) as [
      keyof typeof ICON_FINGERPRINTS,
      (typeof ICON_FINGERPRINTS)[keyof typeof ICON_FINGERPRINTS],
    ][],
  )("%s matches locked viewBox and path data", (name, expected) => {
    const Icon = Icons[name];
    const markup = renderToStaticMarkup(createElement(Icon));
    expect(markup).toContain(`viewBox="${expected.viewBox}"`);
    const pathData = markup.match(/\sd="([^"]+)"/)?.[1];
    expect(pathData?.slice(0, 40)).toBe(expected.pathPrefix);
  });

  it("applies size after width and height so size wins (react-icons 5.7.0)", () => {
    const markup = renderToStaticMarkup(
      createElement(FaUser, { width: "100%", height: "100%", size: 32 }),
    );
    expect(markup).toContain('width="32"');
    expect(markup).toContain('height="32"');
    expect(markup).not.toContain('width="100%"');
    expect(markup).not.toContain('height="100%"');
  });

  it("sets the svg color attribute and style when color is passed", () => {
    const markup = renderToStaticMarkup(createElement(FaVolleyball, { color: "#336699" }));
    expect(markup).toContain('color="#336699"');
    expect(markup).toContain("color:#336699");
  });
});
