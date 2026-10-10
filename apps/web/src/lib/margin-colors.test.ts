import { describe, expect, it } from "vitest";
import { getMarginColor } from "./margin-colors";

describe("margin-colors", () => {
  it("returns neutral style for null or undefined", () => {
    expect(getMarginColor(null).status).toBe("neutral");
    expect(getMarginColor(undefined).status).toBe("neutral");
  });

  it("returns danger style for negative margin", () => {
    const res = getMarginColor(-0.05, 0.18);
    expect(res.status).toBe("danger");
    expect(res.text).toContain("rose");
  });

  it("returns warning style when margin is below target", () => {
    const res = getMarginColor(0.12, 0.18);
    expect(res.status).toBe("warning");
    expect(res.text).toContain("amber");
  });

  it("returns success style when margin is at or above target", () => {
    const resExact = getMarginColor(0.18, 0.18);
    expect(resExact.status).toBe("success");
    expect(resExact.text).toContain("emerald");

    const resAbove = getMarginColor(0.25, 0.18);
    expect(resAbove.status).toBe("success");
    expect(resAbove.text).toContain("emerald");
  });
});
