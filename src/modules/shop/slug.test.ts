import { describe, expect, it } from "vitest";
import { slugify, withSuffix } from "./slug.js";

describe("slugify", () => {
  it("normalizes names to lowercase hyphenated slugs", () => {
    expect(slugify("Rael's Fabric  Shop")).toBe("rael-s-fabric-shop");
  });

  it("falls back when the name has no latin characters", () => {
    expect(slugify("!!!")).toBe("item");
  });

  it("keeps suffix within length bounds", () => {
    const slug = withSuffix("a".repeat(80), "deadbeef");
    expect(slug.length).toBeLessThanOrEqual(80);
  });
});
