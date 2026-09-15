import { describe, expect, it } from "vitest";
import { getBasePath, isAdminPath, sitePath } from "./paths.js";

describe("site paths", () => {
  it("keeps root deployments at the domain root", () => {
    expect(getBasePath("/")).toBe("");
    expect(getBasePath("/admin")).toBe("");
    expect(sitePath("/api/library", "/admin")).toBe("/api/library");
    expect(isAdminPath("/admin")).toBe(true);
  });

  it("keeps subdirectory deployments under their prefix", () => {
    expect(getBasePath("/wenan/")).toBe("/wenan");
    expect(getBasePath("/wenan/admin")).toBe("/wenan");
    expect(sitePath("/api/library", "/wenan/")).toBe("/wenan/api/library");
    expect(sitePath("/uploads/example.png", "/wenan/admin")).toBe("/wenan/uploads/example.png");
    expect(isAdminPath("/wenan/admin")).toBe(true);
  });
});
