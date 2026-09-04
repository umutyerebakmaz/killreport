import { describe, expect, it } from "vitest";

import { getSecurityStatusColor } from "./securityStatus";

describe("getSecurityStatusColor", () => {
  it("returns gray for missing values", () => {
    expect(getSecurityStatusColor(null)).toBe("text-gray-400");
    expect(getSecurityStatusColor(undefined)).toBe("text-gray-400");
  });

  it("maps each band to its colour", () => {
    expect(getSecurityStatusColor(5)).toBe("text-blue-400");
    expect(getSecurityStatusColor(0)).toBe("text-green-400");
    expect(getSecurityStatusColor(-1.9)).toBe("text-yellow-400");
    expect(getSecurityStatusColor(-4.9)).toBe("text-orange-400");
    expect(getSecurityStatusColor(-10)).toBe("text-red-400");
  });
});
