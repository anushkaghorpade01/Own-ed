import { describe, it, expect } from "vitest";
import { SpaceImageSchema } from "../schemas";

describe("Space item persistence shape", () => {
  it("round-trips uploaded image metadata", () => {
    const image = SpaceImageSchema.parse({
      id: "space-1",
      board: "Overall Studio",
      title: "Reception mood",
      category: "Reception",
      itemType: "image",
      mimeType: "image/jpeg",
      imageUrl: "data:image/jpeg;base64,abc",
      tags: ["reception"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const restored = SpaceImageSchema.parse(JSON.parse(JSON.stringify(image)));
    expect(restored.title).toBe("Reception mood");
    expect(restored.board).toBe("Overall Studio");
    expect(restored.imageUrl).toContain("image/jpeg");
  });

  it("round-trips pasted link reference", () => {
    const link = SpaceImageSchema.parse({
      id: "space-2",
      board: "Lighting",
      title: "Pinterest board",
      category: "Lighting",
      itemType: "link",
      sourceUrl: "https://pinterest.com/pin/123",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const restored = SpaceImageSchema.parse(JSON.parse(JSON.stringify(link)));
    expect(restored.sourceUrl).toBe("https://pinterest.com/pin/123");
    expect(restored.board).toBe("Lighting");
  });
});
