import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import * as Icons from "./icons";

const iconEntries = Object.entries(Icons).filter(
  (entry): entry is [string, (typeof Icons)[keyof typeof Icons]] =>
    entry[0].startsWith("Fa") && typeof entry[1] === "function",
);

describe("Fa6 icons", () => {
  it.each(iconEntries)("%s renders an svg with a path", (_name, Icon) => {
    const markup = renderToStaticMarkup(createElement(Icon));
    expect(markup).toMatch(/^<svg/);
    expect(markup).toContain("<path");
    expect(markup).toContain('fill="currentColor"');
  });
});
