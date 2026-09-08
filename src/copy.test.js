// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPostText, copyText } from "./copy.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildPostText", () => {
  const post = {
    text: "正文第一行\n正文第二行",
    keywords: "#关键词一 #关键词二",
  };

  it("copies the post body unchanged", () => {
    expect(buildPostText(post)).toBe(post.text);
  });

  it("separates keywords from the body with one blank line", () => {
    expect(buildPostText(post, true)).toBe("正文第一行\n正文第二行\n\n#关键词一 #关键词二");
  });

  it("does not add blank lines when keywords are empty", () => {
    expect(buildPostText({ text: "正文", keywords: "" }, true)).toBe("正文");
  });
});

describe("copyText", () => {
  it("falls back when the async clipboard is present but blocked", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("blocked"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    document.execCommand = vi.fn(() => true);

    await copyText("要复制的文案");

    expect(writeText).toHaveBeenCalledWith("要复制的文案");
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });
});
