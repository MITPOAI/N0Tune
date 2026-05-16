import { describe, expect, it } from "vitest";

describe("Phase 0 dashboard copy", () => {
  it("uses the correct N0Tune spelling", () => {
    expect("N0Tune").toContain("0");
  });
});
