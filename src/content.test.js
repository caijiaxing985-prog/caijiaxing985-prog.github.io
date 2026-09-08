import { describe, expect, it } from "vitest";
import { comments, posts } from "./content.js";

describe("workbook content", () => {
  it("contains every non-empty comment", () => {
    expect(comments).toHaveLength(35);
    expect(new Set(comments.map((item) => item.id)).size).toBe(35);
    expect(comments.every((item) => item.text.trim())).toBe(true);
  });

  it("contains all 35 posts with complete copy fields", () => {
    expect(posts).toHaveLength(35);
    expect(new Set(posts.map((item) => item.id)).size).toBe(35);
    expect(posts.every((item) => item.text.trim() && item.keywords.trim())).toBe(true);
  });

  it("does not publish local workbook paths", () => {
    const serialized = JSON.stringify({ comments, posts });
    expect(serialized).not.toMatch(/C:\\Users|Desktop|\.xlsx/i);
  });
});
