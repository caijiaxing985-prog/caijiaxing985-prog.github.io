import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { galleryItems } from "./gallery.js";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("promotion gallery", () => {
  it("contains 15 named, uniquely identified images", () => {
    expect(galleryItems).toHaveLength(15);
    expect(new Set(galleryItems.map((item) => item.id)).size).toBe(15);
    expect(galleryItems.every((item) => item.title.trim())).toBe(true);
  });

  it("points to valid PNG assets", () => {
    for (const item of galleryItems) {
      const asset = path.join(projectDir, "public", item.file.replace(/^\//, ""));
      const data = fs.readFileSync(asset);
      expect(data.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
  });

  it("keeps comment references numeric", () => {
    expect(galleryItems.every((item) => item.commentIds.every(Number.isInteger))).toBe(true);
  });
});
