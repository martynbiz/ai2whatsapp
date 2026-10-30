import { describe, it, expect } from "vitest";
import { getFacts } from "./facts";

describe("getFacts", () => {
  it("returns a facts object with the expected keys and non-empty string values", () => {
    const facts = getFacts();

    expect(facts).toHaveProperty("home");
    expect(facts).toHaveProperty("office");
    expect(facts).toHaveProperty("karate");

    for (const value of Object.values(facts)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
